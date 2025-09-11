/**
 * 动画服务器 - 作为网页和MCP之间的桥梁
 * 提供WebSocket服务器，处理3D场景数据和优化指令
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 动画服务器类
 */
class AnimationServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 8081,
      host: options.host || 'localhost',
      enableAuth: options.enableAuth || false,
      authToken: options.authToken || null,
      enableCORS: options.enableCORS !== false,
      maxConnections: options.maxConnections || 100,
      heartbeatInterval: options.heartbeatInterval || 30000,
      dataDir: options.dataDir || path.join(process.cwd(), '.animation-server-data'),
      enableMCPBridge: options.enableMCPBridge !== false,
      ...options
    };
    
    this.server = null;
    this.wss = null;
    this.clients = new Map();
    this.clientId = 0;
    this.scenes = new Map();
    this.optimizationQueue = [];
    this.pendingRequests = new Map(); // 初始化待处理请求映射
    
    this.heartbeatTimer = null;
    this.isRunning = false;
    
    this.ensureDataDirectory();
  }

  /**
   * 确保数据目录存在
   */
  ensureDataDirectory() {
    if (!fs.existsSync(this.options.dataDir)) {
      fs.mkdirSync(this.options.dataDir, { recursive: true });
      console.log(`📁 创建数据目录: ${this.options.dataDir}`);
    }
  }

  /**
   * 启动服务器
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // 创建HTTP服务器
        this.server = http.createServer(this.handleHttpRequest.bind(this));
        
        // 创建WebSocket服务器
        this.wss = new WebSocket.Server({ 
          server: this.server,
          verifyClient: this.verifyClient.bind(this)
        });
        
        // 设置WebSocket事件监听
        this.wss.on('connection', this.handleConnection.bind(this));
        
        // 启动HTTP服务器
        this.server.listen(this.options.port, this.options.host, () => {
          console.log(`🚀 动画服务器启动成功`);
          console.log(`📡 WebSocket: ws://${this.options.host}:${this.options.port}/animation`);
          console.log(`🌐 HTTP API: http://${this.options.host}:${this.options.port}/api`);
          console.log(`📊 状态页面: http://${this.options.host}:${this.options.port}/status`);
          
          this.isRunning = true;
          this.startHeartbeat();
          resolve();
        });
        
        this.server.on('error', (error) => {
          console.error('❌ 服务器启动失败:', error.message);
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 验证客户端连接
   */
  verifyClient(info) {
    // 检查连接数限制
    if (this.clients.size >= this.options.maxConnections) {
      console.log('⚠️ 连接数达到上限，拒绝新连接');
      return false;
    }
    
    // 检查认证token
    if (this.options.enableAuth && this.options.authToken) {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token !== this.options.authToken) {
        console.log('❌ 认证失败，拒绝连接');
        return false;
      }
    }
    
    return true;
  }

  /**
   * 处理WebSocket连接
   */
  handleConnection(ws, req) {
    const clientId = ++this.clientId;
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      lastPing: new Date(),
      sceneId: null,
      isAlive: true
    };
    
    this.clients.set(clientId, clientInfo);
    console.log(`✅ 新客户端连接 #${clientId} (${clientInfo.ip})`);
    
    // 发送欢迎消息
    this.sendMessage(ws, {
      type: 'welcome',
      clientId: clientId,
      serverInfo: {
        version: '1.0.0',
        features: ['scene_analysis', 'optimization', 'mcp_bridge'],
        maxConnections: this.options.maxConnections
      }
    });
    
    // 设置消息处理
    ws.on('message', (data) => this.handleMessage(clientId, data));
    
    // 设置连接关闭处理
    ws.on('close', () => this.handleDisconnection(clientId));
    
    // 设置错误处理
    ws.on('error', (error) => {
      console.error(`❌ 客户端 #${clientId} 连接错误:`, error.message);
    });
    
    // 设置pong响应
    ws.on('pong', () => {
      clientInfo.isAlive = true;
      clientInfo.lastPing = new Date();
    });
  }

  /**
   * 处理客户端消息
   */
  handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 收到客户端 #${clientId} 消息:`, message.type);
      
      switch (message.type) {
        case 'ping':
          this.handlePing(client, message);
          break;
          
        case 'scene_heartbeat':
          this.handleSceneHeartbeat(client, message);
          break;
          
        case 'client_info':
          this.handleClientInfo(client, message);
          break;
          
        case 'scene_info':
          this.handleSceneInfo(client, message);
          break;
          
        case 'performance_update':
          this.handlePerformanceUpdate(client, message);
          break;
          
        case 'optimization_request':
          this.handleOptimizationRequest(client, message);
          break;
          
        case 'animation_state':
          this.handleAnimationState(client, message);
          break;
          
        case 'mcp_command':
          this.handleMCPCommand(client, message);
          break;
          
        case 'inspect_response':
          this.handleInspectResponse(client, message);
          break;
          
        case 'custom_script_response':
          this.handleCustomScriptResponse(client, message);
          break;
          
        default:
          console.warn(`⚠️ 未知消息类型: ${message.type}`);
          this.sendMessage(client.ws, {
            type: 'error',
            message: `未知消息类型: ${message.type}`
          });
          break;
      }
      
    } catch (error) {
      console.error(`❌ 消息解析失败 (客户端 #${clientId}):`, error.message);
      this.sendMessage(client.ws, {
        type: 'error',
        message: '消息格式错误'
      });
    }
  }

  /**
   * 处理ping消息
   */
  handlePing(client, message) {
    this.sendMessage(client.ws, {
      type: 'pong',
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    });
  }
  
  /**
   * 处理场景心跳消息
   */
  handleSceneHeartbeat(client, message) {
    const { uniqueId, performance, status } = message.data || {};
    
    if (!uniqueId) {
      console.warn('⚠️ 心跳消息缺少uniqueId');
      return;
    }
    
    // 更新场景心跳时间
    const scene = this.getSceneByUniqueId(uniqueId);
    if (scene) {
      scene.lastHeartbeat = Date.now();
      scene.isActive = status !== 'inactive';
      
      // 更新性能数据
      if (performance) {
        scene.performance = { ...scene.performance, ...performance };
      }
      
      console.log(`💓 场景心跳: ${scene.nickname} (${uniqueId})`);
    } else {
      console.warn(`⚠️ 收到未知场景的心跳: ${uniqueId}`);
    }
    
    // 响应心跳确认
    this.sendMessage(client.ws, {
      type: 'heartbeat_ack',
      uniqueId: uniqueId,
      timestamp: Date.now(),
      serverTime: Date.now()
    });
  }

  /**
   * 处理客户端信息
   */
  handleClientInfo(client, message) {
    console.log(`📋 客户端 #${client.id} 信息:`, {
      userAgent: message.data.userAgent,
      clientType: message.data.clientType,
      version: message.data.version,
      capabilities: message.data.capabilities
    });
    
    // 存储客户端信息
    client.clientType = message.data.clientType;
    client.version = message.data.version;
    client.capabilities = message.data.capabilities;
    client.atomicCapabilities = message.data.atomicCapabilities; // 存储原子能力信息
    client.engineType = message.data.engineType;
    client.url = message.data.url;
  }

  /**
   * 处理场景信息 - 增强版本支持uniqueId和生命周期管理
   */
  handleSceneInfo(client, message) {
    const sceneUniqueId = message.data.uniqueId || message.data.sceneId;
    if (!sceneUniqueId) {
      console.warn('⚠️ 场景消息缺少uniqueId，忽略');
      return;
    }
    
    // 增强的场景数据结构
    const sceneData = {
      clientId: client.id,
      sceneId: message.data.sceneId || `scene_${client.id}_${Date.now()}`,
      uniqueId: sceneUniqueId, // 新增：场景唯一标识
      nickname: message.data.nickname || `场景_${sceneUniqueId.substring(0, 8)}`, // 新增：临时昵称
      timestamp: message.timestamp,
      lastHeartbeat: Date.now(), // 新增：最后心跳时间
      isActive: true, // 新增：场景是否活跃
      connectedAt: Date.now(), // 新增：连接时间
      engine: message.data.engine,
      engineVersion: message.data.engineVersion, // 新增：引擎版本
      performance: message.data.performance,
      animation: message.data.animation,
      suggestions: message.data.suggestions,
      metadata: message.data.metadata || {}, // 新增：场景元数据
      config: message.data.config || {} // 新增：场景配置信息
    };
    
    // 检查是否为同一场景的更新
    const existingScene = this.getSceneByUniqueId(sceneUniqueId);
    if (existingScene) {
      // 更新现有场景数据
      Object.assign(existingScene, sceneData);
      console.log(`🔄 场景更新: ${existingScene.nickname} (${sceneUniqueId})`);
    } else {
      // 新场景
      this.scenes.set(sceneData.sceneId, sceneData);
      console.log(`🎯 新场景注册: ${sceneData.nickname} (${sceneUniqueId})`);
    }
    
    client.sceneId = sceneData.sceneId;
    client.sceneUniqueId = sceneUniqueId;
    
    // 如果启用MCP桥接，保存数据供MCP工具查询
    if (this.options.enableMCPBridge) {
      this.saveMCPData('scenes', sceneData.uniqueId, sceneData);
    }
    
    // 响应确认，包含生成的昵称
    this.sendMessage(client.ws, {
      type: 'scene_info_ack',
      sceneId: sceneData.sceneId,
      uniqueId: sceneUniqueId,
      nickname: sceneData.nickname,
      status: 'received'
    });
  }

  /**
   * 处理性能更新
   */
  handlePerformanceUpdate(client, message) {
    const sceneId = client.sceneId;
    if (!sceneId) return;
    
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.performance = message.data;
      scene.lastUpdated = message.timestamp;
      
      // 检查是否需要优化建议
      this.checkPerformanceOptimization(scene);
    }
  }

  /**
   * 处理优化请求
   */
  async handleOptimizationRequest(client, message) {
    console.log(`🔧 收到优化请求 (客户端 #${client.id})`);
    
    try {
      // 生成优化建议
      const suggestions = await this.generateOptimizationSuggestions(message.data);
      
      this.sendMessage(client.ws, {
        type: 'optimization_response',
        requestId: message.requestId,
        suggestions: suggestions,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ 优化建议生成失败:', error.message);
      
      this.sendMessage(client.ws, {
        type: 'optimization_error',
        requestId: message.requestId,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理动画状态
   */
  handleAnimationState(client, message) {
    const sceneId = client.sceneId;
    if (!sceneId) return;
    
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.animation = message.data;
      scene.lastUpdated = message.timestamp;
      
      console.log(`🎬 动画状态更新: ${sceneId}`);
    }
  }

  /**
   * 处理MCP命令
   */
  async handleMCPCommand(client, message) {
    console.log(`🤖 收到MCP命令: ${message.data.command}`);
    
    try {
      let result;
      
      switch (message.data.command) {
        case 'get_scenes':
          result = this.getAllScenes();
          break;
          
        case 'get_performance':
          result = this.getPerformanceData(message.data.sceneId);
          break;
          
        case 'optimize_scene':
          result = await this.optimizeScene(message.data.sceneId, message.data.options);
          break;
          
        case 'get_server_status':
          result = this.getServerStatus();
          break;
          
        default:
          throw new Error(`未知MCP命令: ${message.data.command}`);
      }
      
      this.sendMessage(client.ws, {
        type: 'mcp_response',
        requestId: message.requestId,
        result: result,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ MCP命令执行失败:', error.message);
      
      this.sendMessage(client.ws, {
        type: 'mcp_error',
        requestId: message.requestId,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理检查响应
   */
  handleInspectResponse(client, message) {
    console.log(`🔬 收到检查响应 (客户端 #${client.id})`);
    
    const { requestId, result, data } = message;
    
    // 查找对应的待处理请求（支持新的pendingInspectRequests）
    const requests = this.pendingInspectRequests || this.pendingRequests;
    if (requests && requests.has(requestId)) {
      const { resolve, reject, res } = requests.get(requestId);
      requests.delete(requestId);
      
      try {
        // 处理详细的场景检查数据
        const inspectData = data || result;
        
        // 返回成功响应
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            data: inspectData,
            message: '场景检查完成'
          }));
        }
        
        if (resolve) resolve(inspectData);
      } catch (error) {
        console.error('处理检查响应失败:', error);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end(JSON.stringify({
            success: false,
            error: '处理检查响应失败',
            message: error.message
          }));
        }
        if (reject) reject(error);
      }
    } else {
      console.warn(`⚠️ 未找到请求ID ${requestId} 的待处理请求`);
    }
  }

  /**
   * 处理自定义脚本响应
   */
  handleCustomScriptResponse(client, message) {
    console.log(`🎭 收到脚本执行响应 (客户端 #${client.id})`);
    
    const { requestId, success, message: responseMessage, data } = message;
    
    // 查找对应的待处理请求
    if (this.pendingRequests && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      if (success) {
        console.log(`✅ 脚本执行成功: ${responseMessage}`);
        resolve(data);
      } else {
        console.error(`❌ 脚本执行失败: ${responseMessage}`);
        reject(new Error(responseMessage));
      }
    } else {
      console.warn(`⚠️ 未找到请求ID ${requestId} 的待处理脚本执行请求`);
    }
  }

  /**
   * 生成优化建议
   */
  async generateOptimizationSuggestions(sceneData) {
    const suggestions = [];
    
    // 基于性能数据生成建议
    if (sceneData.performance) {
      const perf = sceneData.performance;
      
      if (perf.fps < 30) {
        suggestions.push({
          type: 'performance',
          severity: 'high',
          message: `帧率过低 (${perf.fps} FPS)`,
          commands: [
            { action: 'reduce_quality', level: 2 },
            { action: 'enable_lod', distance: 100 }
          ]
        });
      }
      
      if (perf.triangles > 1000000) {
        suggestions.push({
          type: 'geometry',
          severity: 'high',
          message: `三角形数量过多 (${Math.round(perf.triangles / 1000)}K)`,
          commands: [
            { action: 'simplify_geometry', reduction: 0.5 },
            { action: 'enable_instancing' }
          ]
        });
      }
      
      if (perf.drawCalls > 500) {
        suggestions.push({
          type: 'drawcalls',
          severity: 'medium',
          message: `绘制调用过多 (${perf.drawCalls})`,
          commands: [
            { action: 'batch_materials' },
            { action: 'merge_meshes' }
          ]
        });
      }
    }
    
    return suggestions;
  }

  /**
   * 检查性能优化
   */
  checkPerformanceOptimization(scene) {
    const perf = scene.performance;
    if (!perf) return;
    
    // 如果性能过低，自动发送优化建议
    if (perf.fps < 20) {
      const client = this.clients.get(scene.clientId);
      if (client) {
        this.sendMessage(client.ws, {
          type: 'optimization_command',
          command: {
            action: 'reduce_quality',
            level: Math.floor((30 - perf.fps) / 5),
            reason: '帧率过低，自动降低质量'
          },
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * 获取所有场景 - 增强版本
   */
  getAllScenes() {
    return Array.from(this.scenes.values()).map(scene => ({
      sceneId: scene.sceneId,
      uniqueId: scene.uniqueId,
      nickname: scene.nickname,
      clientId: scene.clientId,
      engine: scene.engine,
      engineVersion: scene.engineVersion,
      isActive: scene.isActive,
      lastHeartbeat: scene.lastHeartbeat,
      connectedAt: scene.connectedAt,
      lastUpdated: scene.lastUpdated,
      heartbeatAge: Date.now() - (scene.lastHeartbeat || 0),
      performance: scene.performance ? {
        fps: scene.performance.fps,
        triangles: scene.performance.triangles,
        drawCalls: scene.performance.drawCalls
      } : null,
      metadata: scene.metadata,
      config: scene.config
    }));
  }

  /**
   * 通过uniqueId获取场景
   */
  getSceneByUniqueId(uniqueId) {
    return Array.from(this.scenes.values()).find(scene => scene.uniqueId === uniqueId);
  }

  /**
   * 获取活跃场景列表
   */
  getActiveScenes() {
    const now = Date.now();
    const heartbeatTimeout = 60000; // 60秒心跳超时
    
    return Array.from(this.scenes.values()).filter(scene => 
      scene.isActive && (now - (scene.lastHeartbeat || 0)) < heartbeatTimeout
    );
  }

  /**
   * 场景生命周期清理
   */
  cleanupInactiveScenes() {
    const now = Date.now();
    const heartbeatTimeout = 120000; // 2分钟无心跳即清理
    const scenesToRemove = [];
    
    this.scenes.forEach((scene, sceneId) => {
      if ((now - (scene.lastHeartbeat || 0)) > heartbeatTimeout) {
        scenesToRemove.push({ sceneId, scene });
      }
    });
    
    scenesToRemove.forEach(({ sceneId, scene }) => {
      this.scenes.delete(sceneId);
      console.log(`🧹 清理非活跃场景: ${scene.nickname || sceneId} (${scene.uniqueId})`);
    });
    
    return scenesToRemove.length;
  }

  /**
   * 生成场景配置副本
   */
  copySceneConfiguration(sourceUniqueId, targetUniqueId, configType = 'all') {
    const sourceScene = this.getSceneByUniqueId(sourceUniqueId);
    const targetScene = this.getSceneByUniqueId(targetUniqueId);
    
    if (!sourceScene || !targetScene) {
      throw new Error('源场景或目标场景不存在');
    }
    
    const configToCopy = {};
    
    switch (configType) {
      case 'camera':
        if (sourceScene.config.cameras) {
          configToCopy.cameras = sourceScene.config.cameras;
        }
        break;
      case 'materials':
        if (sourceScene.config.materials) {
          configToCopy.materials = sourceScene.config.materials;
        }
        break;
      case 'lighting':
        if (sourceScene.config.lighting) {
          configToCopy.lighting = sourceScene.config.lighting;
        }
        break;
      case 'all':
        configToCopy = { ...sourceScene.config };
        break;
      default:
        if (sourceScene.config[configType]) {
          configToCopy[configType] = sourceScene.config[configType];
        }
    }
    
    return configToCopy;
  }

  /**
   * 获取性能数据 - 支持uniqueId查询
   */
  getPerformanceData(sceneId) {
    let scene = this.scenes.get(sceneId);
    if (!scene) {
      // 尝试通过uniqueId查找
      scene = this.getSceneByUniqueId(sceneId);
    }
    return scene ? scene.performance : null;
  }

  /**
   * 优化场景
   */
  async optimizeScene(sceneId, options = {}) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new Error(`场景不存在: ${sceneId}`);
    }
    
    const client = this.clients.get(scene.clientId);
    if (!client) {
      throw new Error(`客户端不在线: ${scene.clientId}`);
    }
    
    // 发送优化命令到客户端
    this.sendMessage(client.ws, {
      type: 'optimization_command',
      command: {
        action: options.action || 'auto_optimize',
        options: options,
        sceneId: sceneId
      },
      timestamp: Date.now()
    });
    
    return {
      status: 'optimization_sent',
      sceneId: sceneId,
      clientId: scene.clientId
    };
  }

  /**
   * 获取服务器状态
   */
  getServerStatus() {
    return {
      isRunning: this.isRunning,
      port: this.options.port,
      host: this.options.host,
      connectedClients: this.clients.size,
      totalScenes: this.scenes.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now()
    };
  }

  /**
   * 保存MCP数据
   */
  saveMCPData(type, id, data) {
    try {
      const filePath = path.join(this.options.dataDir, `${type}_${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`❌ 保存MCP数据失败:`, error.message);
    }
  }

  /**
   * 处理HTTP请求
   */
  handleHttpRequest(req, res) {
    // 设置CORS头
    if (this.options.enableCORS) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // API路由
    if (url.pathname.startsWith('/api/')) {
      this.handleAPIRequest(req, res, url);
      return;
    }
    
    // 状态页面
    if (url.pathname === '/status') {
      this.handleStatusPage(req, res);
      return;
    }
    
    // 默认响应
    res.writeHead(404);
    res.end('Not Found');
  }

  /**
   * 处理API请求
   */
  handleAPIRequest(req, res, url) {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      switch (url.pathname) {
        case '/api/status':
          res.writeHead(200);
          res.end(JSON.stringify(this.getServerStatus()));
          break;
          
        case '/api/scenes':
          res.writeHead(200);
          res.end(JSON.stringify(this.getAllScenes()));
          break;
          
        case '/api/clients':
          const clients = Array.from(this.clients.values()).map(client => ({
            clientId: client.id,
            ip: client.ip,
            connectedAt: client.connectedAt,
            sceneId: client.sceneId,
            clientType: client.clientType,
            engineType: client.engineType,
            version: client.version,
            url: client.url,
            capabilities: client.capabilities,
            atomicCapabilities: client.atomicCapabilities
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            clients: clients,
            total: clients.length,
            timestamp: Date.now()
          }));
          break;
          
        case '/api/scene/inspect':
          if (req.method === 'POST') {
            this.handleSceneInspectAPI(req, res);
          } else if (req.method === 'GET') {
            // 简单的GET请求处理，返回当前场景数据
            this.handleSceneInspectGET(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/scene/optimize':
          if (req.method === 'POST') {
            this.handleSceneOptimizeAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/atomic/execute':
          if (req.method === 'POST') {
            this.handleAtomicExecuteAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/atomic/sequence':
          if (req.method === 'POST') {
            this.handleAtomicSequenceAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/atomic/revert':
          if (req.method === 'POST') {
            this.handleAtomicRevertAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/optimization/generate':
          if (req.method === 'POST') {
            this.handleOptimizationGenerateAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/atomic/capabilities':
          if (req.method === 'POST') {
            this.handleAtomicCapabilitiesAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/script/execute':
          if (req.method === 'POST') {
            this.handleScriptExecuteAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/scene/set_nickname':
          if (req.method === 'POST') {
            this.handleSetSceneNicknameAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/scene/copy_config':
          if (req.method === 'POST') {
            this.handleCopySceneConfigAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        case '/api/scene/cleanup':
          if (req.method === 'POST') {
            this.handleSceneCleanupAPI(req, res);
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;
          
        default:
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'API endpoint not found' }));
          break;
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * 处理状态页面
   */
  handleStatusPage(req, res) {
    const status = this.getServerStatus();
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>动画服务器状态</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: monospace; margin: 40px; background: #1e1e1e; color: #fff; }
        .status { background: #2d2d2d; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .online { color: #4CAF50; }
        .offline { color: #f44336; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #444; }
        th { background: #333; }
    </style>
</head>
<body>
    <h1>🚀 动画服务器状态</h1>
    
    <div class="status">
        <h2>服务器信息</h2>
        <p>状态: <span class="${status.isRunning ? 'online' : 'offline'}">${status.isRunning ? '运行中' : '已停止'}</span></p>
        <p>地址: ws://${status.host}:${status.port}/animation</p>
        <p>运行时间: ${Math.floor(status.uptime / 3600)}小时${Math.floor((status.uptime % 3600) / 60)}分钟</p>
        <p>内存使用: ${Math.round(status.memoryUsage.rss / 1024 / 1024)}MB</p>
    </div>
    
    <div class="status">
        <h2>连接统计</h2>
        <p>当前连接: ${status.connectedClients}</p>
        <p>活跃场景: ${status.totalScenes}</p>
    </div>
    
    <div class="status">
        <h2>API接口</h2>
        <p><a href="/api/status" style="color: #64B5F6;">/api/status</a> - 服务器状态</p>
        <p><a href="/api/scenes" style="color: #64B5F6;">/api/scenes</a> - 场景列表</p>
        <p><a href="/api/clients" style="color: #64B5F6;">/api/clients</a> - 客户端列表</p>
        <p><span style="color: #FFB74D;">/api/script/execute</span> - 执行自定义脚本 (POST)</p>
    </div>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end(html);
  }

  /**
   * 发送消息到客户端
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(message, excludeClientId = null) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendMessage(client.ws, message);
      }
    });
  }

  /**
   * 处理客户端断开连接
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`❌ 客户端断开连接 #${clientId}`);
      
      // 清理场景数据
      if (client.sceneId) {
        this.scenes.delete(client.sceneId);
      }
      
      this.clients.delete(clientId);
    }
  }

  /**
   * 启动心跳检测 - 增强版本支持场景生命周期管理
   */
  startHeartbeat() {
    // WebSocket客户端心跳检测
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          console.log(`💔 客户端 #${clientId} 心跳超时，断开连接`);
          client.ws.terminate();
          this.handleDisconnection(clientId);
          return;
        }
        
        client.isAlive = false;
        client.ws.ping();
      });
    }, this.options.heartbeatInterval);
    
    // 场景生命周期清理定时器
    this.sceneCleanupTimer = setInterval(() => {
      const cleanedCount = this.cleanupInactiveScenes();
      if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 个非活跃场景`);
      }
    }, 60000); // 每分钟清理一次
    
    // 定期请求场景心跳
    this.sceneHeartbeatTimer = setInterval(() => {
      this.requestSceneHeartbeats();
    }, 30000); // 每30秒请求一次心跳
  }

  /**
   * 请求所有连接客户端发送场景心跳
   */
  requestSceneHeartbeats() {
    this.clients.forEach((client) => {
      if (client.sceneUniqueId) {
        this.sendMessage(client.ws, {
          type: 'request_scene_heartbeat',
          uniqueId: client.sceneUniqueId,
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * 停止服务器
   */
  async stop() {
    console.log('🛑 正在停止动画服务器...');
    
    this.isRunning = false;
    
    // 停止所有定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.sceneCleanupTimer) {
      clearInterval(this.sceneCleanupTimer);
      this.sceneCleanupTimer = null;
    }
    
    if (this.sceneHeartbeatTimer) {
      clearInterval(this.sceneHeartbeatTimer);
      this.sceneHeartbeatTimer = null;
    }
    
    // 关闭所有WebSocket连接
    this.clients.forEach((client) => {
      this.sendMessage(client.ws, {
        type: 'server_shutdown',
        message: '服务器正在关闭'
      });
      client.ws.close(1001, '服务器关闭');
    });
    
    // 关闭WebSocket服务器
    if (this.wss) {
      this.wss.close();
    }
    
    // 关闭HTTP服务器
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('✅ 动画服务器已停止');
          resolve();
        });
      });
    }
  }

  /**
   * 处理场景检查GET请求 - 直接返回已缓存的场景数据
   */
  handleSceneInspectGET(req, res) {
    try {
      // 查找活跃的客户端
      const activeClients = Array.from(this.clients.values()).filter(client => 
        client.ws.readyState === 1 && client.clientType === 'kingfisher_scene_inspector'
      );
      
      if (activeClients.length === 0) {
        res.writeHead(200);
        res.end(JSON.stringify({
          success: false,
          error: '当前没有活跃的翠鸟场景检查器客户端',
          message: '请确保翠鸟场景检查器已连接到动画服务器'
        }));
        return;
      }

      // 向所有活跃的场景检查器客户端请求详细场景数据
      const requestId = `inspect_${Date.now()}`;
      const inspectRequest = {
        type: 'scene_inspect_request',
        requestId: requestId,
        timestamp: Date.now(),
        components: ['basic', 'meshes', 'materials', 'textures', 'lights', 'cameras', 'animations', 'performance', 'suggestions'],
        detailed: true
      };

      // 存储请求ID，用于响应匹配
      this.pendingInspectRequests = this.pendingInspectRequests || new Map();
      
      // 设置响应超时处理
      const responsePromise = new Promise((resolve, reject) => {
        this.pendingInspectRequests.set(requestId, { resolve, reject, res });
        
        // 10秒超时
        setTimeout(() => {
          if (this.pendingInspectRequests.has(requestId)) {
            this.pendingInspectRequests.delete(requestId);
            reject(new Error('场景检查请求超时'));
          }
        }, 10000);
      });

      // 发送检查请求到所有活跃客户端
      activeClients.forEach(client => {
        this.sendMessage(client.ws, inspectRequest);
      });

      // 等待响应 - 正确处理 Promise
      responsePromise
        .then(inspectData => {
          // 成功响应已在 handleInspectResponse 中处理
        })
        .catch(error => {
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(JSON.stringify({
              success: false,
              error: '场景检查失败',
              message: error.message
            }));
          }
        });

    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: '获取场景数据失败',
        message: error.message
      }));
    }
  }

  /**
   * 处理场景检查API请求
   */
  handleSceneInspectAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { components = ['basic'], detailed = false } = requestData;
        
        // 查找已连接的翠鸟场景检查器客户端
        const inspectorClients = Array.from(this.clients.values()).filter(
          client => client.clientType === 'kingfisher_scene_inspector'
        );
        
        if (inspectorClients.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '没有翠鸟场景检查器连接到服务器',
            message: '请确保网页中的翠鸟场景检查器已连接'
          }));
          return;
        }
        
        // 发送检查命令到第一个可用的检查器
        const client = inspectorClients[0];
        const requestId = 'inspect_' + Date.now();
        
        // 存储请求信息以便后续响应
        if (!this.pendingRequests) {
          this.pendingRequests = new Map();
        }
        
        this.pendingRequests.set(requestId, {
          req, res, timestamp: Date.now()
        });
        
        // 发送检查命令
        const command = {
          type: 'inspect_command',
          requestId: requestId,
          components: components,
          detailed: detailed
        };
        
        client.ws.send(JSON.stringify(command));
        
        // 设置超时
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            if (!res.headersSent) {
              res.writeHead(408);
              res.end(JSON.stringify({
                success: false,
                error: '请求超时',
                message: '场景检查器未在指定时间内响应'
              }));
            }
          }
        }, 10000); // 10秒超时
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          message: error.message
        }));
      }
    });
  }

  /**
   * 处理原子能力查询API请求
   */
  handleAtomicCapabilitiesAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { clientId } = requestData;
        
        // 查找指定客户端
        const client = this.clients.get(clientId);
        if (!client) {
          res.writeHead(404);
          res.end(JSON.stringify({
            success: false,
            error: '客户端不存在'
          }));
          return;
        }
        
        // 如果客户端已经报告了原子能力，直接返回
        if (client.atomicCapabilities) {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            capabilities: client.atomicCapabilities,
            clientId: clientId,
            clientType: client.clientType
          }));
          return;
        }
        
        // 否则请求客户端发送能力信息
        const requestId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 初始化待处理请求映射（如果还没有初始化）
        if (!this.pendingRequests) {
          this.pendingRequests = new Map();
        }
        
        // 设置响应处理
        this.pendingRequests.set(requestId, {
          resolve: (result) => {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              capabilities: result,
              clientId: clientId,
              clientType: client.clientType
            }));
          },
          reject: (error) => {
            res.writeHead(500);
            res.end(JSON.stringify({
              success: false,
              error: error.message
            }));
          }
        });
        
        // 发送查询命令
        const command = {
          type: 'query_capabilities',
          requestId: requestId
        };
        
        client.ws.send(JSON.stringify(command));
        
        // 设置超时
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            res.writeHead(504);
            res.end(JSON.stringify({
              success: false,
              error: '查询超时'
            }));
          }
        }, 5000);
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          details: error.message
        }));
      }
    });
  }

  /**
   * 处理脚本执行API
   */
  handleScriptExecuteAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { script, context = {}, options = {} } = requestData;
        
        if (!script || typeof script !== 'string') {
          res.writeHead(401);
          res.end(JSON.stringify({
            success: false,
            error: '脚本内容不能为空'
          }));
          return;
        }
        
        // 查找翠鸟场景检查器客户端
        let targetClient = null;
        for (const [clientId, client] of this.clients.entries()) {
          if (client.clientType === 'kingfisher_scene_inspector') {
            targetClient = client;
            break;
          }
        }
        
        if (!targetClient) {
          res.writeHead(404);
          res.end(JSON.stringify({
            success: false,
            error: '未找到连接的翠鸟场景检查器'
          }));
          return;
        }
        
        // 生成请求ID
        const requestId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 初始化待处理请求映射（如果还没有初始化）
        if (!this.pendingRequests) {
          this.pendingRequests = new Map();
        }
        
        // 设置响应处理
        this.pendingRequests.set(requestId, {
          resolve: (result) => {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              message: '脚本执行完成',
              data: result,
              clients: 1
            }));
          },
          reject: (error) => {
            res.writeHead(500);
            res.end(JSON.stringify({
              success: false,
              error: error.message
            }));
          }
        });
        
        // 发送脚本执行命令
        const command = {
          type: 'custom_script',
          requestId: requestId,
          script: script,
          context: context,
          options: {
            timeout: options.timeout || 10000,
            returnResult: options.returnResult !== false,
            ...options
          }
        };
        
        targetClient.ws.send(JSON.stringify(command));
        
        // 设置超时
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            res.writeHead(504);
            res.end(JSON.stringify({
              success: false,
              error: '脚本执行超时'
            }));
          }
        }, options.timeout || 10000);
        
      } catch (error) {
        res.writeHead(402);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          details: error.message
        }));
      }
    });
  }

  /**
   * 处理原子操作执行API请求
   */
  handleAtomicExecuteAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { operation } = requestData;
        
        if (!operation) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '缺少operation参数'
          }));
          return;
        }

        // 查找已连接的翠鸟场景检查器客户端
        const inspectorClients = Array.from(this.clients.values()).filter(
          client => client.clientType === 'kingfisher_scene_inspector'
        );
        
        if (inspectorClients.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '没有翠鸟场景检查器连接到服务器'
          }));
          return;
        }
        
        // 发送原子操作命令
        const command = {
          type: 'atomic_operation',
          operation: operation,
          timestamp: Date.now()
        };
        
        let successCount = 0;
        inspectorClients.forEach(client => {
          try {
            client.ws.send(JSON.stringify(command));
            successCount++;
          } catch (error) {
            console.error('发送原子操作命令失败:', error.message);
          }
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `原子操作已发送到 ${successCount} 个场景检查器`,
          operation: operation,
          clients: successCount
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          message: error.message
        }));
      }
    });
  }

  /**
   * 处理原子操作序列API请求
   */
  handleAtomicSequenceAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { sequence, options = {} } = requestData;
        
        if (!sequence || !sequence.operations) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '缺少sequence参数或operations数组'
          }));
          return;
        }

        // 查找已连接的翠鸟场景检查器客户端
        const inspectorClients = Array.from(this.clients.values()).filter(
          client => client.clientType === 'kingfisher_scene_inspector'
        );
        
        if (inspectorClients.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '没有翠鸟场景检查器连接到服务器'
          }));
          return;
        }
        
        // 发送操作序列命令
        const command = {
          type: 'atomic_sequence',
          sequence: sequence,
          options: options,
          timestamp: Date.now()
        };
        
        let successCount = 0;
        inspectorClients.forEach(client => {
          try {
            client.ws.send(JSON.stringify(command));
            successCount++;
          } catch (error) {
            console.error('发送操作序列命令失败:', error.message);
          }
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `操作序列已发送到 ${successCount} 个场景检查器`,
          sequence: {
            id: sequence.id,
            name: sequence.name,
            operationCount: sequence.operations.length
          },
          options: options,
          clients: successCount
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          message: error.message
        }));
      }
    });
  }

  /**
   * 处理原子操作回滚API请求
   */
  handleAtomicRevertAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { operationId } = requestData;
        
        if (!operationId) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '缺少operationId参数'
          }));
          return;
        }

        // 查找已连接的翠鸟场景检查器客户端
        const inspectorClients = Array.from(this.clients.values()).filter(
          client => client.clientType === 'kingfisher_scene_inspector'
        );
        
        if (inspectorClients.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '没有翠鸟场景检查器连接到服务器'
          }));
          return;
        }
        
        // 发送回滚命令
        const command = {
          type: 'atomic_revert',
          operationId: operationId,
          timestamp: Date.now()
        };
        
        let successCount = 0;
        inspectorClients.forEach(client => {
          try {
            client.ws.send(JSON.stringify(command));
            successCount++;
          } catch (error) {
            console.error('发送回滚命令失败:', error.message);
          }
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `回滚命令已发送到 ${successCount} 个场景检查器`,
          operationId: operationId,
          clients: successCount
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          message: error.message
        }));
      }
    });
  }

  /**
   * 处理优化策略生成API请求
   */
  handleOptimizationGenerateAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { 
          strategy = 'performance', 
          sceneData, 
          targetFPS = 60,
          targetObjects = [] 
        } = requestData;
        
        if (!sceneData) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '缺少sceneData参数'
          }));
          return;
        }

        // 这里我们返回策略定义，实际的策略生成逻辑在客户端执行
        let strategyInfo = {};
        
        switch (strategy) {
          case 'performance':
            strategyInfo = {
              name: 'performance_optimization',
              description: `性能优化 - 目标FPS: ${targetFPS}`,
              estimatedOperations: this.estimatePerformanceOperations(sceneData, targetFPS),
              category: 'performance'
            };
            break;
            
          case 'quality':
            strategyInfo = {
              name: 'quality_optimization',
              description: '视觉质量优化',
              estimatedOperations: this.estimateQualityOperations(sceneData),
              category: 'quality'
            };
            break;
            
          case 'cleanup':
            strategyInfo = {
              name: 'scene_cleanup',
              description: '场景清理优化',
              estimatedOperations: this.estimateCleanupOperations(sceneData),
              category: 'cleanup'
            };
            break;
            
          case 'focus':
            strategyInfo = {
              name: 'focus_mode',
              description: '专注模式 - 突出重要对象',
              estimatedOperations: this.estimateFocusOperations(sceneData, targetObjects),
              category: 'focus'
            };
            break;
            
          default:
            res.writeHead(400);
            res.end(JSON.stringify({
              success: false,
              error: `不支持的策略类型: ${strategy}`
            }));
            return;
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          strategy: strategyInfo,
          parameters: {
            strategy,
            targetFPS,
            targetObjects,
            sceneStats: {
              nodeCount: sceneData.basic?.nodeCount || 0,
              meshCount: sceneData.basic?.meshCount || 0,
              currentFPS: sceneData.performance?.fps || 60
            }
          },
          message: '优化策略已生成，可发送到场景检查器执行'
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          message: error.message
        }));
      }
    });
  }

  /**
   * 估算性能优化操作数量
   */
  estimatePerformanceOperations(sceneData, targetFPS) {
    const currentFPS = sceneData.performance?.fps || 60;
    let operations = [];
    
    if (currentFPS < targetFPS) {
      if (currentFPS < 30) {
        operations.push('SET_RENDER_QUALITY');
      }
      if (sceneData.basic?.nodeCount > 50) {
        operations.push('SET_LOD_DISTANCE');
      }
      if (sceneData.nodes) {
        const debugNodes = sceneData.nodes.filter(node => 
          node.name.includes('debug') || node.name.includes('helper')
        );
        operations.push(...debugNodes.map(() => 'HIDE_OBJECT'));
      }
      operations.push('BATCH_GEOMETRY');
    }
    
    return operations;
  }

  /**
   * 估算质量优化操作数量
   */
  estimateQualityOperations(sceneData) {
    let operations = ['TOGGLE_SHADOWS'];
    
    if (sceneData.materials) {
      operations.push(...sceneData.materials.map(() => 'SET_MATERIAL_PROPERTY'));
    }
    
    return operations;
  }

  /**
   * 估算清理优化操作数量
   */
  estimateCleanupOperations(sceneData) {
    let operations = [];
    
    if (sceneData.nodes) {
      const debugObjects = sceneData.nodes.filter(node => 
        node.name.includes('debug') || 
        node.name.includes('helper') || 
        node.name.includes('marker') ||
        node.name.includes('selectBox') ||
        node.name.includes('Rect')
      );
      operations.push(...debugObjects.map(() => 'HIDE_OBJECT'));
      
      const gridObjects = sceneData.nodes.filter(node => 
        node.name.includes('grid') || node.name.includes('Grid')
      );
      operations.push(...gridObjects.map(() => 'SET_OPACITY'));
    }
    
    return operations;
  }

  /**
   * 估算专注模式操作数量
   */
  estimateFocusOperations(sceneData, targetObjects) {
    let operations = [];
    
    if (sceneData.nodes && targetObjects.length > 0) {
      const backgroundObjects = sceneData.nodes.filter(node => 
        !targetObjects.includes(node.id)
      );
      operations.push(...backgroundObjects.map(() => 'SET_OPACITY'));
      operations.push(...targetObjects.map(() => 'SET_HIGHLIGHT'));
      operations.push('FOCUS_CAMERA');
    }
    
    return operations;
  }

  /**
   * 处理场景优化API请求
   */
  handleSceneOptimizeAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString('utf8');  // 明确指定UTF-8编码
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { action, ...otherParams } = requestData;
        
        console.log('📥 [SceneOptimize] 收到请求:', JSON.stringify(requestData, null, 2));
        
        // 查找已连接的翠鸟场景检查器客户端
        const inspectorClients = Array.from(this.clients.values()).filter(
          client => client.clientType === 'kingfisher_scene_inspector'
        );
        
        if (inspectorClients.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '没有翠鸟场景检查器连接到服务器'
          }));
          return;
        }
        
        // 发送优化命令到所有检查器
        // 将所有参数（除了action）都传递给命令
        const command = {
          type: 'optimization_command',
          command: {
            action: action,
            ...otherParams  // 包含objects、level等所有其他参数
          }
        };
        
        console.log('📤 [SceneOptimize] 发送命令:', JSON.stringify(command, null, 2));
        
        let successCount = 0;
        inspectorClients.forEach(client => {
          try {
            client.ws.send(JSON.stringify(command));
            successCount++;
          } catch (error) {
            console.error('发送优化命令失败:', error.message);
          }
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `优化命令已发送到 ${successCount} 个场景检查器`,
          action: action,
          clients: successCount
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          message: error.message
        }));
      }
    });
  }

  /**
   * 处理设置场景昵称API
   */
  handleSetSceneNicknameAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    
    req.on('end', () => {
      try {
        const { uniqueId, nickname } = JSON.parse(body);
        
        if (!uniqueId || !nickname) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '缺少必要参数：uniqueId 和 nickname'
          }));
          return;
        }
        
        // 查找并更新场景昵称
        const scene = this.getSceneByUniqueId(uniqueId);
        if (!scene) {
          res.writeHead(404);
          res.end(JSON.stringify({
            success: false,
            error: `场景 "${uniqueId}" 不存在`
          }));
          return;
        }
        
        const oldNickname = scene.nickname;
        scene.nickname = nickname;
        
        console.log(`🏷️ 场景昵称已更新: ${oldNickname} -> ${nickname} (${uniqueId})`);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: '场景昵称更新成功',
          data: {
            uniqueId,
            oldNickname,
            newNickname: nickname
          }
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: '请求格式错误',
          details: error.message
        }));
      }
    });
  }

  /**
   * 处理场景配置复制API
   */
  handleCopySceneConfigAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    
    req.on('end', () => {
      try {
        const { sourceUniqueId, targetUniqueId, configType = 'all' } = JSON.parse(body);
        
        if (!sourceUniqueId || !targetUniqueId) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: '缺少必要参数：sourceUniqueId 和 targetUniqueId'
          }));
          return;
        }
        
        // 执行配置复制
        const result = this.copySceneConfiguration(sourceUniqueId, targetUniqueId, configType);
        
        // 发送配置应用命令到目标场景的客户端
        const targetScene = this.getSceneByUniqueId(targetUniqueId);
        if (targetScene) {
          const targetClient = this.clients.get(targetScene.clientId);
          if (targetClient) {
            // 通知客户端应用新配置
            this.sendMessage(targetClient.ws, {
              type: 'apply_scene_configuration',
              timestamp: Date.now(),
              data: {
                sourceUniqueId,
                configType,
                configData: result
              }
            });
          }
        }
        
        console.log(`🔄 场景配置复制完成: ${sourceUniqueId} -> ${targetUniqueId} (类型: ${configType})`);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: '配置复制成功',
          data: {
            sourceUniqueId,
            targetUniqueId,
            configType,
            copiedItems: this.countConfigItems(result)
          }
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
  }

  /**
   * 处理场景清理API
   */
  handleSceneCleanupAPI(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    
    req.on('end', () => {
      try {
        const { maxAge = 300 } = JSON.parse(body);
        
        // 执行场景清理
        const cleanedCount = this.cleanupInactiveScenes();
        
        console.log(`🧹 手动清理了 ${cleanedCount} 个非活跃场景`);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `清理了 ${cleanedCount} 个非活跃场景`,
          data: {
            cleanedCount,
            maxAge
          }
        }));
        
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
  }

  /**
   * 计算配置项数量
   */
  countConfigItems(config) {
    const counts = {};
    
    if (config.cameras && Array.isArray(config.cameras)) {
      counts.cameras = config.cameras.length;
    }
    if (config.materials && Array.isArray(config.materials)) {
      counts.materials = config.materials.length;
    }
    if (config.lighting && Array.isArray(config.lighting)) {
      counts.lighting = config.lighting.length;
    }
    if (config.environment) {
      counts.environment = 1;
    }
    
    return counts;
  }
}

/**
 * 启动动画服务器命令
 */
async function startAnimationServer(options) {
  console.log('🚀 启动动画服务器\n');
  
  const server = new AnimationServer({
    port: parseInt(options.port) || 8081,
    host: options.host || 'localhost',
    enableAuth: options.auth || false,
    authToken: options.token || null,
    enableCORS: options.cors !== false,
    maxConnections: parseInt(options.maxConnections) || 100,
    dataDir: options.dataDir || path.join(process.cwd(), '.animation-server-data'),
    enableMCPBridge: options.mcpBridge !== false
  });
  
  try {
    await server.start();
    
    // 处理优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n📡 收到关闭信号...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n📡 收到终止信号...');
      await server.stop();
      process.exit(0);
    });
    
    // 如果启用了后台模式，不阻塞进程
    if (!options.background) {
      // 保持进程运行
      console.log('\n按 Ctrl+C 停止服务器');
      
      // 定期输出状态信息
      if (options.verbose) {
        setInterval(() => {
          const status = server.getServerStatus();
          console.log(`📊 [${new Date().toLocaleTimeString()}] 连接数: ${status.connectedClients}, 场景数: ${status.totalScenes}`);
        }, 30000);
      }
      
      // 阻塞进程，保持服务器运行
      await new Promise(() => {}); // 永远不会resolve，保持进程运行
    }
    
    return server;
    
  } catch (error) {
    console.error('❌ 动画服务器启动失败:', error.message);
    process.exit(1);
  }
}

module.exports = {
  startAnimationServer,
  AnimationServer
};