/**
 * Web 服务器 - 深色主题，还原Claude输出效果
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const crypto = require('crypto');
const EventEmitter = require('events');
const { spawn } = require('child_process');

class WebServer extends EventEmitter {
  constructor(serverConfig, claudeProxy) {
    super();
    this.serverConfig = serverConfig;
    this.claudeProxy = claudeProxy;
    this.app = express();
    this.server = null;
    this.wss = null;
    this.isRunning = false;
    this.sessions = new Map();
    this.lastMessageId = 0;
    
    // 任务管理相关状态
    this.tasks = new Map(); // 任务存储
    this.taskIdCounter = 1;
    
    // 监听ClaudeProxy的截屏事件
    this.claudeProxy.on('screenshot', (screenshotData) => {
      this.broadcastScreenshot(screenshotData.data, screenshotData.timestamp);
    });

    this.setupExpress();
    this.setupRoutes();
    this.setupClaudeListener();
  }

  /**
   * 配置Express应用
   */
  setupExpress() {
    // Session配置
    this.app.use(session({
      secret: crypto.randomBytes(32).toString('hex'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24小时
      }
    }));

    // 中间件
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // 静态文件服务
    const staticPath = path.join(__dirname, '../web');
    this.app.use(express.static(staticPath));

    // CORS支持
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 主页
    this.app.get('/', (req, res) => {
      if (this.serverConfig.auth.enabled && !req.session.authenticated) {
        return res.redirect('/login');
      }
      res.sendFile(path.join(__dirname, '../web/index.html'));
    });

    // 登录页面
    this.app.get('/login', (req, res) => {
      if (!this.serverConfig.auth.enabled) {
        return res.redirect('/');
      }
      res.sendFile(path.join(__dirname, '../web/login.html'));
    });

    // 登录API
    this.app.post('/api/login', (req, res) => {
      if (!this.serverConfig.auth.enabled) {
        return res.json({ success: true, message: '认证已禁用' });
      }

      const { username, password } = req.body;
      
      if (username === this.serverConfig.auth.username && 
          password === this.serverConfig.auth.password) {
        req.session.authenticated = true;
        req.session.username = username;
        res.json({ success: true, message: '登录成功' });
      } else {
        res.status(401).json({ success: false, message: '用户名或密码错误' });
      }
    });

    // 登出API
    this.app.post('/api/logout', (req, res) => {
      req.session.destroy();
      res.json({ success: true, message: '已登出' });
    });

    // 服务器状态API
    this.app.get('/api/status', this.requireAuth.bind(this), (req, res) => {
      const claudeStatus = this.claudeProxy.getStatus();
      res.json({
        server: {
          name: this.serverConfig.name,
          displayName: this.serverConfig.displayName,
          directory: this.serverConfig.directory,
          port: this.serverConfig.port,
          isRunning: this.isRunning
        },
        claude: claudeStatus,
        sessions: this.sessions.size
      });
    });

    // 发送消息API
    this.app.post('/api/chat', this.requireAuth.bind(this), async (req, res) => {
      try {
        const { message, sessionId } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: '消息内容不能为空' });
        }

        // 广播用户消息
        this.broadcastMessage({
          type: 'user_message',
          content: message,
          sessionId: sessionId || 'default',
          timestamp: new Date().toISOString()
        });

        res.json({ success: true, message: '消息已发送' });

      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 获取消息历史API
    this.app.get('/api/history', this.requireAuth.bind(this), (req, res) => {
      // 不再需要从文件读取历史，直接返回空数组
      res.json({ messages: [] });
    });

    // 清除历史API
    this.app.delete('/api/history', this.requireAuth.bind(this), (req, res) => {
      // 不再需要清除文件，直接广播消息
      this.broadcastMessage({
        type: 'history_cleared',
        timestamp: new Date().toISOString()
      });
      res.json({ success: true, message: '历史记录已清除' });
    });

    // === 文件管理API ===
    // 获取文件列表
    this.app.get('/api/files/list', this.requireAuth.bind(this), (req, res) => {
      this.handleFileList(req, res);
    });

    // 读取文件内容
    this.app.get('/api/files/read', this.requireAuth.bind(this), (req, res) => {
      this.handleFileRead(req, res);
    });

    // 保存文件内容
    this.app.post('/api/files/save', this.requireAuth.bind(this), (req, res) => {
      this.handleFileSave(req, res);
    });

    // === 任务管理API ===
    // 获取任务列表
    this.app.get('/api/tasks', this.requireAuth.bind(this), (req, res) => {
      this.handleTaskList(req, res);
    });

    // 创建新任务
    this.app.post('/api/tasks', this.requireAuth.bind(this), (req, res) => {
      this.handleTaskCreate(req, res);
    });

    // 停止任务
    this.app.post('/api/tasks/:id/stop', this.requireAuth.bind(this), (req, res) => {
      this.handleTaskStop(req, res);
    });

    // 重启任务
    this.app.post('/api/tasks/:id/restart', this.requireAuth.bind(this), (req, res) => {
      this.handleTaskRestart(req, res);
    });

    // 删除任务
    this.app.delete('/api/tasks/:id', this.requireAuth.bind(this), (req, res) => {
      this.handleTaskDelete(req, res);
    });

    // 获取任务输出
    this.app.get('/api/tasks/:id/output', this.requireAuth.bind(this), (req, res) => {
      this.handleTaskOutput(req, res);
    });

    // 404处理
    this.app.use((req, res) => {
      res.status(404).json({ error: '页面不存在' });
    });
  }

  /**
   * 认证中间件
   */
  requireAuth(req, res, next) {
    if (!this.serverConfig.auth.enabled) {
      return next();
    }

    if (req.session.authenticated) {
      return next();
    }

    res.status(401).json({ error: '需要登录' });
  }

  /**
   * 设置Claude监听
   */
  setupClaudeListener() {
    if (!this.claudeProxy) return;

    // 监听Claude输出
    this.claudeProxy.on('output', (text, htmlContent) => {
      this.broadcastMessage({
        type: 'claude_message',
        content: text,
        htmlContent: htmlContent,
        timestamp: new Date().toISOString()
      });
    });

    // 监听Claude状态变化
    this.claudeProxy.on('started', () => {
      this.broadcastMessage({
        type: 'claude_status',
        status: 'started',
        timestamp: new Date().toISOString()
      });
    });

    this.claudeProxy.on('stopped', (data) => {
      this.broadcastMessage({
        type: 'claude_status',
        status: 'stopped',
        data: data,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 启动Web服务器
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Web服务器已在运行');
    }

    return new Promise((resolve, reject) => {
      // 创建HTTP服务器
      this.server = http.createServer(this.app);

      // 设置WebSocket服务器
      this.setupWebSocket();

      // 启动服务器
      this.server.listen(this.serverConfig.port, (error) => {
        if (error) {
          reject(error);
        } else {
          this.isRunning = true;
          this.emit('log', 'info', `🌐 Web服务器启动成功: http://localhost:${this.serverConfig.port}`);
          
          if (this.serverConfig.auth.enabled) {
            this.emit('log', 'info', `🔒 认证已启用 - 用户: ${this.serverConfig.auth.username}`);
          } else {
            this.emit('log', 'info', '🔓 认证已禁用');
          }
          
          // 文件管理功能信息
          console.log(`[文件管理] 📁 项目根目录: ${this.serverConfig.directory}`);
          console.log(`[文件管理] 🔧 文件管理功能已启用`);
          console.log(`[文件管理] 📝 支持的文本文件类型: .txt, .js, .json, .md, .css, .html, .xml, .yml, .yaml, .ts, .vue, .jsx, .tsx, .py, .java, .cpp, .c, .h, .php, .rb, .go, .rs, .sh, .bat, .ps1, .sql, .env, .gitignore, .dockerfile`);

          resolve();
        }
      });

      // 错误处理
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          this.emit('log', 'error', `❌ 端口 ${this.serverConfig.port} 已被占用`);
        } else {
          this.emit('log', 'error', `❌ Web服务器错误: ${error.message}`);
        }
        reject(error);
      });
    });
  }

  /**
   * 设置WebSocket服务器
   */
  setupWebSocket() {
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, request) => {
      const sessionId = this.generateSessionId();
      this.sessions.set(sessionId, {
        ws: ws,
        authenticated: !this.serverConfig.auth.enabled,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      this.emit('log', 'info', `📱 新客户端连接: ${sessionId}`);

      // WebSocket消息处理
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleWebSocketMessage(sessionId, message);
        } catch (error) {
          this.emit('log', 'error', `❌ WebSocket消息解析错误: ${error.message}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: '消息格式错误'
          }));
        }
      });

      // 连接关闭处理
      ws.on('close', () => {
        this.sessions.delete(sessionId);
        this.emit('log', 'info', `📱 客户端断开连接: ${sessionId}`);
      });

      // 连接错误处理
      ws.on('error', (error) => {
        this.emit('log', 'error', `❌ WebSocket错误: ${error.message}`);
      });

      // 发送欢迎消息
      ws.send(JSON.stringify({
        type: 'welcome',
        sessionId: sessionId,
        serverName: this.serverConfig.displayName,
        authRequired: this.serverConfig.auth.enabled && !this.sessions.get(sessionId).authenticated,
        timestamp: new Date().toISOString()
      }));
    });
  }

  /**
   * 处理WebSocket消息
   */
  handleWebSocketMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();

    switch (message.type) {
      case 'auth':
        this.handleAuthMessage(sessionId, message);
        break;
        
      case 'chat':
        if (this.serverConfig.auth.enabled && !session.authenticated) {
          session.ws.send(JSON.stringify({
            type: 'error',
            message: '需要先登录'
          }));
          return;
        }
        this.handleChatMessage(sessionId, message);
        break;
        
      case 'key':
        if (this.serverConfig.auth.enabled && !session.authenticated) {
          session.ws.send(JSON.stringify({
            type: 'error',
            message: '需要先登录'
          }));
          return;
        }
        this.handleKeyMessage(sessionId, message);
        break;
        
      case 'ping':
        session.ws.send(JSON.stringify({ type: 'pong' }));
        break;
        
      case 'screenshot':
        // 从Claude包装器接收到截屏数据，转发给所有已连接的客户端
        this.broadcastScreenshot(message.data, message.timestamp);
        break;
        
      default:
        session.ws.send(JSON.stringify({
          type: 'error',
          message: '未知消息类型'
        }));
    }
  }

  /**
   * 广播截屏数据给所有已连接的客户端
   */
  broadcastScreenshot(data, timestamp) {
    const screenshotMessage = JSON.stringify({
      type: 'screenshot',
      data: data,
      timestamp: timestamp
    });

    this.sessions.forEach((session) => {
      if (session.ws.readyState === 1) { // WebSocket.OPEN
        session.ws.send(screenshotMessage);
      }
    });
  }

  /**
   * 处理认证消息
   */
  handleAuthMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { username, password } = message;
    
    if (username === this.serverConfig.auth.username && 
        password === this.serverConfig.auth.password) {
      session.authenticated = true;
      session.ws.send(JSON.stringify({
        type: 'auth_success',
        message: '登录成功'
      }));
    } else {
      session.ws.send(JSON.stringify({
        type: 'auth_failed',
        message: '用户名或密码错误'
      }));
    }
  }

  /**
   * 处理聊天消息
   */
  async handleChatMessage(sessionId, message) {
    try {
      const userMessage = message.message;
      if (!userMessage) return;

      // 转发消息给ClaudeProxy处理
      this.claudeProxy.handleWebSocketMessage(message);

      // 广播用户消息给所有客户端
      this.broadcastMessage({
        type: 'user_message',
        content: userMessage,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.emit('log', 'error', `❌ 处理聊天消息错误: ${error.message}`);
      
      const session = this.sessions.get(sessionId);
      if (session) {
        session.ws.send(JSON.stringify({
          type: 'error',
          message: '消息处理失败'
        }));
      }
    }
  }

  /**
   * 处理按键消息
   */
  handleKeyMessage(sessionId, message) {
    try {
      const keyEvent = message.key;
      if (!keyEvent) return;

      // 转发按键消息给ClaudeProxy处理
      this.claudeProxy.handleWebSocketMessage(message);

      // 广播按键消息给所有客户端
      this.broadcastMessage({
        type: 'key_event',
        event: keyEvent,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.emit('log', 'error', `❌ 处理按键消息错误: ${error.message}`);
      
      const session = this.sessions.get(sessionId);
      if (session) {
        session.ws.send(JSON.stringify({
          type: 'error',
          message: '消息处理失败'
        }));
      }
    }
  }

  /**
   * 广播消息给所有客户端
   */
  broadcastMessage(message) {
    const messageStr = JSON.stringify(message);
    
    this.sessions.forEach((session, sessionId) => {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(messageStr);
      }
    });
  }

  /**
   * 生成会话ID
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 停止Web服务器
   */
  async stop() {
    if (!this.isRunning) return;

    this.emit('log', 'info', '🛑 正在停止Web服务器...');

    return new Promise((resolve) => {
      // 关闭所有WebSocket连接
      if (this.wss) {
        this.wss.clients.forEach((ws) => {
          ws.close();
        });
        this.wss.close();
      }

      // 关闭HTTP服务器
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          this.emit('log', 'info', '✅ Web服务器已停止');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取服务器状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.serverConfig.port,
      sessionsCount: this.sessions.size,
      authEnabled: this.serverConfig.auth.enabled
    };
  }

  // === 文件管理方法 ===

  /**
   * 验证文件路径安全性
   */
  validateFilePath(filePath) {
    // 空字符串表示根目录，应该允许
    if (filePath === '' || filePath === undefined || filePath === null) {
      return true;
    }
    
    // 防止目录遍历攻击
    if (filePath.includes('..') || filePath.includes('~')) {
      return false;
    }
    
    // 确保路径在项目目录内
    const fullPath = path.resolve(this.serverConfig.directory, filePath);
    const projectDir = path.resolve(this.serverConfig.directory);
    
    return fullPath.startsWith(projectDir);
  }

  /**
   * 检查是否为支持的文本文件
   */
  isTextFile(filePath) {
    const textExtensions = ['.txt', '.js', '.json', '.md', '.css', '.html', '.xml', '.yml', '.yaml', '.ts', '.vue', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs', '.sh', '.bat', '.ps1', '.sql', '.env', '.gitignore', '.dockerfile'];
    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext) || !ext; // 无扩展名也认为是文本文件
  }

  /**
   * 获取文件列表
   */
  handleFileList(req, res) {
    try {
      const dirPath = req.query.dir || '';
      console.log(`[文件管理] 📂 请求文件列表: "${dirPath}"`);
      
      if (!this.validateFilePath(dirPath)) {
        console.log(`[文件管理] ❌ 路径验证失败: "${dirPath}"`);
        return res.status(400).json({ error: '无效的路径' });
      }

      const fullPath = path.join(this.serverConfig.directory, dirPath);
      console.log(`[文件管理] 🔍 扫描目录: ${fullPath}`);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`[文件管理] ❌ 目录不存在: ${fullPath}`);
        return res.status(404).json({ error: '目录不存在' });
      }

      const items = [];
      const files = fs.readdirSync(fullPath);
      console.log(`[文件管理] 📋 发现 ${files.length} 个项目`);

      files.forEach(file => {
        const itemPath = path.join(fullPath, file);
        const stat = fs.statSync(itemPath);
        const relativePath = path.join(dirPath, file).replace(/\\/g, '/');
        
        items.push({
          name: file,
          path: relativePath,
          isDirectory: stat.isDirectory(),
          isTextFile: !stat.isDirectory() && this.isTextFile(file),
          size: stat.size,
          modified: stat.mtime
        });
      });

      // 目录排在前面，然后按名称排序
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      console.log(`[文件管理] ✅ 返回文件列表: ${items.length} 个项目 (目录: ${items.filter(i => i.isDirectory).length}, 文本文件: ${items.filter(i => i.isTextFile).length})`);

      res.json({
        success: true,
        currentPath: dirPath,
        items: items
      });

    } catch (error) {
      console.error(`[文件管理] ❌ 读取目录失败: ${error.message}`);
      res.status(500).json({ error: '读取目录失败: ' + error.message });
    }
  }

  /**
   * 读取文件内容
   */
  handleFileRead(req, res) {
    try {
      const filePath = req.query.path;
      console.log(`[文件管理] 📖 读取文件: "${filePath}"`);
      
      if (!this.validateFilePath(filePath)) {
        console.log(`[文件管理] ❌ 文件路径验证失败: "${filePath}"`);
        return res.status(400).json({ error: '无效的文件路径' });
      }

      if (!this.isTextFile(filePath)) {
        console.log(`[文件管理] ❌ 不支持的文件类型: "${filePath}"`);
        return res.status(400).json({ error: '不支持的文件类型' });
      }

      const fullPath = path.join(this.serverConfig.directory, filePath);
      console.log(`[文件管理] 🔍 文件完整路径: ${fullPath}`);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`[文件管理] ❌ 文件不存在: ${fullPath}`);
        return res.status(404).json({ error: '文件不存在' });
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const contentSize = Buffer.byteLength(content, 'utf8');
      console.log(`[文件管理] ✅ 文件读取成功: ${filePath} (大小: ${contentSize} 字节)`);
      
      res.json({
        success: true,
        path: filePath,
        content: content
      });

    } catch (error) {
      console.error(`[文件管理] ❌ 读取文件失败: ${filePath} - ${error.message}`);
      res.status(500).json({ error: '读取文件失败: ' + error.message });
    }
  }

  /**
   * 保存文件内容
   */
  handleFileSave(req, res) {
    try {
      const { path: filePath, content } = req.body;
      console.log(`[文件管理] 💾 保存文件: "${filePath}"`);
      
      if (!filePath || content === undefined) {
        console.log(`[文件管理] ❌ 缺少必要参数: path=${filePath}, content=${content !== undefined ? '已提供' : '未提供'}`);
        return res.status(400).json({ error: '缺少必要参数' });
      }

      if (!this.validateFilePath(filePath)) {
        console.log(`[文件管理] ❌ 文件路径验证失败: "${filePath}"`);
        return res.status(400).json({ error: '无效的文件路径' });
      }

      if (!this.isTextFile(filePath)) {
        console.log(`[文件管理] ❌ 不支持的文件类型: "${filePath}"`);
        return res.status(400).json({ error: '不支持的文件类型' });
      }

      const fullPath = path.join(this.serverConfig.directory, filePath);
      const contentSize = Buffer.byteLength(content, 'utf8');
      console.log(`[文件管理] 🔍 文件完整路径: ${fullPath}`);
      console.log(`[文件管理] 📏 内容大小: ${contentSize} 字节`);
      
      // 确保目录存在
      const dirPath = path.dirname(fullPath);
      if (!fs.existsSync(dirPath)) {
        console.log(`[文件管理] 📁 创建目录: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // 备份原文件（如果存在）
      let hasBackup = false;
      if (fs.existsSync(fullPath)) {
        const originalContent = fs.readFileSync(fullPath, 'utf8');
        const originalSize = Buffer.byteLength(originalContent, 'utf8');
        console.log(`[文件管理] 📄 原文件大小: ${originalSize} 字节`);
        hasBackup = true;
      }

      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`[文件管理] ✅ 文件保存成功: ${filePath} ${hasBackup ? '(已覆盖)' : '(新建)'}`);
      
      res.json({
        success: true,
        message: '文件保存成功',
        path: filePath
      });

    } catch (error) {
      console.error(`[文件管理] ❌ 保存文件失败: ${filePath} - ${error.message}`);
      res.status(500).json({ error: '保存文件失败: ' + error.message });
    }
  }

  // === 任务管理方法 ===

  /**
   * 获取任务列表
   */
  handleTaskList(req, res) {
    try {
      console.log(`[任务管理] 📋 请求任务列表`);
      
      const taskList = Array.from(this.tasks.values()).map(task => ({
        id: task.id,
        name: task.name,
        command: task.command,
        workDir: task.workDir,
        status: task.status,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        exitCode: task.exitCode
      }));

      console.log(`[任务管理] ✅ 返回任务列表: ${taskList.length} 个任务`);
      
      res.json({
        success: true,
        tasks: taskList
      });

    } catch (error) {
      console.error(`[任务管理] ❌ 获取任务列表失败: ${error.message}`);
      res.status(500).json({ error: '获取任务列表失败: ' + error.message });
    }
  }

  /**
   * 创建新任务
   */
  handleTaskCreate(req, res) {
    try {
      const { name, command, workDir } = req.body;
      console.log(`[任务管理] ➕ 创建新任务: "${name}" - "${command}"`);
      
      if (!name || !command) {
        console.log(`[任务管理] ❌ 缺少必要参数: name=${name}, command=${command}`);
        return res.status(400).json({ error: '任务名称和命令不能为空' });
      }

      const taskId = this.taskIdCounter++;
      const taskWorkDir = workDir || this.serverConfig.directory;
      
      // 验证工作目录
      if (!fs.existsSync(taskWorkDir)) {
        console.log(`[任务管理] ❌ 工作目录不存在: ${taskWorkDir}`);
        return res.status(400).json({ error: '工作目录不存在' });
      }

      const task = {
        id: taskId,
        name: name,
        command: command,
        workDir: taskWorkDir,
        status: 'created',
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        exitCode: null,
        process: null,
        output: []
      };

      this.tasks.set(taskId, task);
      
      // 立即启动任务
      this.startTask(taskId);

      console.log(`[任务管理] ✅ 任务创建成功: ID=${taskId}, 名称="${name}"`);
      
      res.json({
        success: true,
        message: '任务创建成功',
        task: {
          id: task.id,
          name: task.name,
          command: task.command,
          workDir: task.workDir,
          status: task.status,
          createdAt: task.createdAt
        }
      });

      // 广播任务状态更新
      this.broadcastTaskUpdate(task);

    } catch (error) {
      console.error(`[任务管理] ❌ 创建任务失败: ${error.message}`);
      res.status(500).json({ error: '创建任务失败: ' + error.message });
    }
  }

  /**
   * 启动任务
   */
  startTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      console.log(`[任务管理] 🚀 启动任务: ID=${taskId}, 命令="${task.command}"`);
      
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      
      // 解析命令和参数
      const commandParts = task.command.trim().split(/\s+/);
      const command = commandParts[0];
      const args = commandParts.slice(1);

      // 启动子进程
      task.process = spawn(command, args, {
        cwd: task.workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      // 监听标准输出
      task.process.stdout.on('data', (data) => {
        const text = data.toString();
        task.output.push({
          type: 'stdout',
          text: text,
          timestamp: new Date().toISOString()
        });
        
        // 广播输出更新
        this.broadcastTaskOutput(taskId, 'stdout', text);
      });

      // 监听标准错误
      task.process.stderr.on('data', (data) => {
        const text = data.toString();
        task.output.push({
          type: 'stderr',
          text: text,
          timestamp: new Date().toISOString()
        });
        
        // 广播输出更新
        this.broadcastTaskOutput(taskId, 'stderr', text);
      });

      // 监听进程退出
      task.process.on('exit', (code, signal) => {
        console.log(`[任务管理] 📴 任务退出: ID=${taskId}, 代码=${code}, 信号=${signal}`);
        
        task.status = code === 0 ? 'finished' : 'stopped';
        task.finishedAt = new Date().toISOString();
        task.exitCode = code;
        task.process = null;
        
        // 广播任务状态更新
        this.broadcastTaskUpdate(task);
      });

      // 监听进程错误
      task.process.on('error', (error) => {
        console.error(`[任务管理] ❌ 任务进程错误: ID=${taskId}, ${error.message}`);
        
        task.status = 'stopped';
        task.finishedAt = new Date().toISOString();
        task.exitCode = -1;
        task.process = null;
        
        task.output.push({
          type: 'error',
          text: `进程错误: ${error.message}`,
          timestamp: new Date().toISOString()
        });
        
        // 广播任务状态更新和错误输出
        this.broadcastTaskUpdate(task);
        this.broadcastTaskOutput(taskId, 'error', `进程错误: ${error.message}`);
      });

      console.log(`[任务管理] ✅ 任务启动成功: ID=${taskId}, PID=${task.process.pid}`);
      
      // 广播任务状态更新
      this.broadcastTaskUpdate(task);

    } catch (error) {
      console.error(`[任务管理] ❌ 启动任务失败: ID=${taskId}, ${error.message}`);
      
      task.status = 'stopped';
      task.finishedAt = new Date().toISOString();
      task.exitCode = -1;
      
      task.output.push({
        type: 'error',
        text: `启动失败: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      
      // 广播任务状态更新
      this.broadcastTaskUpdate(task);
    }
  }

  /**
   * 停止任务
   */
  handleTaskStop(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      console.log(`[任务管理] 🛑 停止任务: ID=${taskId}`);
      
      const task = this.tasks.get(taskId);
      if (!task) {
        console.log(`[任务管理] ❌ 任务不存在: ID=${taskId}`);
        return res.status(404).json({ error: '任务不存在' });
      }

      if (task.status !== 'running' || !task.process) {
        console.log(`[任务管理] ❌ 任务未运行: ID=${taskId}, 状态=${task.status}`);
        return res.status(400).json({ error: '任务未在运行' });
      }

      // 终止进程
      task.process.kill('SIGTERM');
      
      setTimeout(() => {
        if (task.process && !task.process.killed) {
          console.log(`[任务管理] 💀 强制终止任务: ID=${taskId}`);
          task.process.kill('SIGKILL');
        }
      }, 5000);

      console.log(`[任务管理] ✅ 任务停止请求发送: ID=${taskId}`);
      
      res.json({
        success: true,
        message: '任务停止请求已发送'
      });

    } catch (error) {
      console.error(`[任务管理] ❌ 停止任务失败: ${error.message}`);
      res.status(500).json({ error: '停止任务失败: ' + error.message });
    }
  }

  /**
   * 重启任务
   */
  handleTaskRestart(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      console.log(`[任务管理] 🔄 重启任务: ID=${taskId}`);
      
      const task = this.tasks.get(taskId);
      if (!task) {
        console.log(`[任务管理] ❌ 任务不存在: ID=${taskId}`);
        return res.status(404).json({ error: '任务不存在' });
      }

      if (task.status === 'running') {
        console.log(`[任务管理] ❌ 任务正在运行: ID=${taskId}`);
        return res.status(400).json({ error: '任务正在运行，无法重启' });
      }

      // 清理之前的输出和状态
      task.output = [];
      task.startedAt = null;
      task.finishedAt = null;
      task.exitCode = null;
      task.process = null;
      task.status = 'created';

      // 重新启动任务
      this.startTask(taskId);

      console.log(`[任务管理] ✅ 任务重启请求发送: ID=${taskId}`);
      
      res.json({
        success: true,
        message: '任务重启成功'
      });

    } catch (error) {
      console.error(`[任务管理] ❌ 重启任务失败: ${error.message}`);
      res.status(500).json({ error: '重启任务失败: ' + error.message });
    }
  }

  /**
   * 删除任务
   */
  handleTaskDelete(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      console.log(`[任务管理] 🗑️ 删除任务: ID=${taskId}`);
      
      const task = this.tasks.get(taskId);
      if (!task) {
        console.log(`[任务管理] ❌ 任务不存在: ID=${taskId}`);
        return res.status(404).json({ error: '任务不存在' });
      }

      // 如果任务正在运行，先停止它
      if (task.status === 'running' && task.process) {
        console.log(`[任务管理] 🛑 先停止运行中的任务: ID=${taskId}`);
        task.process.kill('SIGTERM');
        
        setTimeout(() => {
          if (task.process && !task.process.killed) {
            task.process.kill('SIGKILL');
          }
        }, 3000);
      }

      this.tasks.delete(taskId);
      
      console.log(`[任务管理] ✅ 任务删除成功: ID=${taskId}`);
      
      res.json({
        success: true,
        message: '任务删除成功'
      });

      // 广播任务删除事件
      this.broadcastMessage({
        type: 'task_deleted',
        taskId: taskId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`[任务管理] ❌ 删除任务失败: ${error.message}`);
      res.status(500).json({ error: '删除任务失败: ' + error.message });
    }
  }

  /**
   * 获取任务输出
   */
  handleTaskOutput(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      console.log(`[任务管理] 📄 获取任务输出: ID=${taskId}`);
      
      const task = this.tasks.get(taskId);
      if (!task) {
        console.log(`[任务管理] ❌ 任务不存在: ID=${taskId}`);
        return res.status(404).json({ error: '任务不存在' });
      }

      console.log(`[任务管理] ✅ 返回任务输出: ID=${taskId}, ${task.output.length} 条记录`);
      
      res.json({
        success: true,
        taskId: taskId,
        output: task.output
      });

    } catch (error) {
      console.error(`[任务管理] ❌ 获取任务输出失败: ${error.message}`);
      res.status(500).json({ error: '获取任务输出失败: ' + error.message });
    }
  }

  /**
   * 广播任务状态更新
   */
  broadcastTaskUpdate(task) {
    this.broadcastMessage({
      type: 'task_update',
      task: {
        id: task.id,
        name: task.name,
        command: task.command,
        workDir: task.workDir,
        status: task.status,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        exitCode: task.exitCode
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 广播任务输出
   */
  broadcastTaskOutput(taskId, type, text) {
    this.broadcastMessage({
      type: 'task_output',
      taskId: taskId,
      outputType: type,
      text: text,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = WebServer;