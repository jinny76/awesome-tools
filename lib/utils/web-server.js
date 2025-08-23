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

        // 写入输入文件
        const inputFile = path.join(this.claudeProxy.ipcDir, 'input.txt');
        fs.writeFileSync(inputFile, message);

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
      const fromId = parseInt(req.query.fromId) || 0;
      const messages = this.claudeProxy.readOutput(fromId);
      res.json({ messages });
    });

    // 清除历史API
    this.app.delete('/api/history', this.requireAuth.bind(this), (req, res) => {
      this.claudeProxy.clearOutput();
      this.broadcastMessage({
        type: 'history_cleared',
        timestamp: new Date().toISOString()
      });
      res.json({ success: true, message: '历史记录已清除' });
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

      // 发送历史消息
      const history = this.claudeProxy.readOutput(0);
      if (history.length > 0) {
        ws.send(JSON.stringify({
          type: 'history',
          messages: history,
          timestamp: new Date().toISOString()
        }));
      }
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
        
      case 'ping':
        session.ws.send(JSON.stringify({ type: 'pong' }));
        break;
        
      default:
        session.ws.send(JSON.stringify({
          type: 'error',
          message: '未知消息类型'
        }));
    }
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

      // 写入输入文件
      const inputFile = path.join(this.claudeProxy.ipcDir, 'input.txt');
      fs.writeFileSync(inputFile, userMessage);

      // 广播用户消息
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
}

module.exports = WebServer;