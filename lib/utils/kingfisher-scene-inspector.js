/**
 * 翠鸟引擎场景检查器 - 专门分析 window.scene 对象 (翠鸟引擎)
 * 基于翠鸟云SDK API进行场景分析和优化
 * 完整实现翠鸟SDK核心功能
 */

class KingfisherSceneInspector {
  constructor(options = {}) {
    this.options = {
      autoAnalyze: options.autoAnalyze !== false,
      analyzeInterval: options.analyzeInterval || 5000,
      reportToServer: options.reportToServer !== false,
      serverUrl: options.serverUrl || 'ws://localhost:8081/animation',
      engineType: 'kingfisher', // 明确标识引擎类型
      ...options
    };

    this.ws = null;
    this.isConnected = false;
    this.clientId = null;
    this.lastAnalysis = null;
    this.analysisTimer = null;
    this.highlightLayer = null; // 高亮层
    this.reconnectAttempts = 0; // 重连尝试次数
    this.maxReconnectAttempts = 2; // 最大重连次数：2次

    // 场景生命周期管理
    this.currentSceneId = null;
    this.currentUniqueId = null;
    this.heartbeatTimer = null;

    this.init();
  }

  /**
   * 初始化检查器
   */
  init() {
    console.log('🐠 翠鸟引擎场景检查器初始化');

    if (this.options.reportToServer) {
      this.connectToServer();
    }

    if (this.options.autoAnalyze) {
      this.startAutoAnalysis();
    }

    // 监听场景变化
    this.watchSceneChanges();

    // 设置页面生命周期处理器
    this.setupPageUnloadHandlers();
  }

  /**
   * 启动检查器 (兼容性方法)
   */
  start() {
    console.log('🚀 启动翠鸟引擎场景检查器');

    if (!this.isConnected && this.options.reportToServer) {
      this.connectToServer();
    }

    if (!this.analysisTimer && this.options.autoAnalyze) {
      this.startAutoAnalysis();
    }

    // 立即执行一次分析
    this.analyzeAndReport();

    return this;
  }

  /**
   * 连接到动画服务器
   */
  connectToServer() {
    if (this.isConnected) return;

    console.log('🔗 连接动画服务器:', this.options.serverUrl);

    try {
      this.ws = new WebSocket(this.options.serverUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0; // 重置重连计数器
        console.log('✅ 已连接到动画服务器');
        this.sendClientInfo();
      };

      this.ws.onmessage = (event) => {
        this.handleServerMessage(JSON.parse(event.data));
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.clientId = null;
        console.log('❌ 与动画服务器断开连接');

        // 增加重连尝试次数
        this.reconnectAttempts++;

        // 如果重连次数未超过最大限制，则自动重连
        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
          console.log(`🔄 准备第${this.reconnectAttempts}次重连 (最多${this.maxReconnectAttempts}次)`);
          setTimeout(() => this.connectToServer(), 5000);
        } else {
          console.log(`❌ 已达到最大重连次数(${this.maxReconnectAttempts})，停止重连`);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket连接错误:', error);
      };

    } catch (error) {
      console.error('❌ 连接服务器失败:', error);
    }
  }

  /**
   * 发送客户端信息
   */
  sendClientInfo() {
    this.sendMessage({
      type: 'client_info',
      timestamp: Date.now(),
      data: {
        userAgent: navigator.userAgent,
        clientType: 'kingfisher_scene_inspector',
        engineType: 'kingfisher',
        version: '1.0.0',
        url: window.location.href,
        capabilities: ['scene_analysis', 'object_inspection', 'kingfisher_api', 'kpath_queries', 'custom_scripts']
      }
    });
  }

  /**
   * 检查翠鸟引擎API可用性
   */
  checkKingfisherAPIs() {
    const apis = {};

    if (typeof window !== 'undefined' && window.puzzle) {
      apis.setActiveCameraArg = typeof window.puzzle.setActiveCameraArg === 'function';
      apis.focusCameraOnObject = typeof window.puzzle.focusCameraOnObject === 'function';
      apis.translateObject = typeof window.puzzle.translateObject === 'function';
      apis.rotateObject = typeof window.puzzle.rotateObject === 'function';
      apis.scaleObject = typeof window.puzzle.scaleObject === 'function';
      apis.setNodeHighlight = typeof window.puzzle.setNodeHighlight === 'function';
      apis.clearHighlight = typeof window.puzzle.clearHighlight === 'function';
    }

    if (typeof window !== 'undefined' && window.scene) {
      apis.getNodeByID = typeof window.scene.getNodeByID === 'function';
      apis.getNodeByPath = typeof window.scene.getNodeByPath === 'function';
      apis.getNodeListByPath = typeof window.scene.getNodeListByPath === 'function';
      apis.getAllTransformNodes = typeof window.scene.getAllTransformNodes === 'function';
      apis.getAllCameraArgs = typeof window.scene.getAllCameraArgs === 'function';
      apis.getAllMaterials = typeof window.scene.getAllMaterials === 'function';
    }

    return apis;
  }

  /**
   * 处理服务器消息
   */
  handleServerMessage(message) {
    console.log('📨 收到服务器消息:', message.type);

    switch (message.type) {
      case 'welcome':
        this.clientId = message.clientId;
        console.log('🆔 获得客户端ID:', this.clientId);
        // 发送初始场景信息
        this.analyzeAndReport();
        break;

      case 'inspect_command':
        this.handleInspectCommand(message);
        break;

      case 'scene_inspect_request':
        this.handleSceneInspectRequest(message);
        break;

      case 'custom_script':
      case 'execute_script':
        this.handleCustomScript(message);
        break;

      case 'mcp_response':
        console.log('🤖 MCP响应:', message.result);
        break;

      case 'pong':
        // 心跳响应
        break;

      case 'request_scene_heartbeat':
        this.handleHeartbeatRequest(message);
        break;

      case 'heartbeat_ack':
        console.log('💓 收到服务器心跳确认:', message.uniqueId);
        break;

      case 'apply_scene_configuration':
        this.handleApplySceneConfiguration(message);
        break;

      default:
        console.log('📦 未处理的消息类型:', message.type);
    }
  }

  /**
   * 处理心跳请求
   */
  handleHeartbeatRequest(message) {
    const { uniqueId } = message;

    // 生成场景心跳数据
    const heartbeatData = this.generateHeartbeatData();

    // 发送心跳响应
    this.sendMessage({
      type: 'scene_heartbeat',
      timestamp: Date.now(),
      data: {
        uniqueId: this.currentUniqueId || uniqueId,
        performance: heartbeatData.performance,
        status: heartbeatData.status,
        metadata: heartbeatData.metadata
      }
    });

    console.log('💓 已发送场景心跳:', this.currentUniqueId || uniqueId);
  }

  /**
   * 生成心跳数据
   */
  generateHeartbeatData() {
    const scene = window.scene;
    const performance = this.analyzePerformance(scene);

    return {
      performance: performance,
      status: scene ? 'active' : 'inactive',
      metadata: {
        nodeCount: scene ? this.getAllNodes().length : 0,
        hasScene: !!scene,
        url: window.location.href,
        lastActivity: Date.now()
      }
    };
  }

  /**
   * 处理应用场景配置
   */
  handleApplySceneConfiguration(message) {
    const { sourceUniqueId, configType, configData } = message.data || {};

    if (!configData) {
      console.warn('⚠️ 配置数据为空，跳过应用配置');
      return;
    }

    console.log(`🔧 开始应用场景配置: 来源 ${sourceUniqueId} (类型: ${configType})`);

    const scene = window.scene;
    if (!scene) {
      console.error('❌ 当前场景不存在，无法应用配置');
      return;
    }

    const kfAPI = this.getKingfisherAPI();
    const results = {
      success: 0,
      failed: 0,
      operations: []
    };

    try {
      // 应用相机配置
      if (configData.cameras && (configType === 'all' || configType === 'camera')) {
        console.log(`📷 应用相机配置: ${configData.cameras.length} 个机位`);
        configData.cameras.forEach(cameraConfig => {
          try {
            // 检查本地是否有同名相机，如果有则更新配置
            if (scene.cameraArgsArray) {
              const existingCamera = scene.cameraArgsArray.find(cam => cam.name === cameraConfig.name);
              if (existingCamera) {
                // 更新相机参数
                Object.assign(existingCamera, cameraConfig);
                results.success++;
                results.operations.push(`相机 ${cameraConfig.name} 配置已更新`);
                console.log(`✅ 相机 ${cameraConfig.name} 配置已应用`);
              }
            }
          } catch (error) {
            results.failed++;
            console.warn(`❌ 应用相机配置失败 (${cameraConfig.name}):`, error);
          }
        });
      }

      // 应用材质配置
      if (configData.materials && (configType === 'all' || configType === 'materials')) {
        console.log(`🎨 应用材质配置: ${configData.materials.length} 个材质`);
        configData.materials.forEach(materialConfig => {
          try {
            const material = scene.getMaterialByName ? scene.getMaterialByName(materialConfig.name) : null;
            if (material) {
              // 应用材质颜色等配置
              if (materialConfig.diffuseColor && material.diffuseColor) {
                material.diffuseColor = materialConfig.diffuseColor;
              }
              if (materialConfig.emissiveColor && material.emissiveColor) {
                material.emissiveColor = materialConfig.emissiveColor;
              }
              results.success++;
              results.operations.push(`材质 ${materialConfig.name} 配置已更新`);
              console.log(`✅ 材质 ${materialConfig.name} 配置已应用`);
            }
          } catch (error) {
            results.failed++;
            console.warn(`❌ 应用材质配置失败 (${materialConfig.name}):`, error);
          }
        });
      }

      // 应用灯光配置
      if (configData.lighting && (configType === 'all' || configType === 'lighting')) {
        console.log(`💡 应用灯光配置: ${configData.lighting.length} 个灯光`);
        configData.lighting.forEach(lightConfig => {
          try {
            const light = scene.getLightByName ? scene.getLightByName(lightConfig.name) : null;
            if (light) {
              if (typeof lightConfig.enabled === 'boolean') {
                light.setEnabled(lightConfig.enabled);
              }
              if (lightConfig.intensity !== undefined && light.intensity !== undefined) {
                light.intensity = lightConfig.intensity;
              }
              results.success++;
              results.operations.push(`灯光 ${lightConfig.name} 配置已更新`);
              console.log(`✅ 灯光 ${lightConfig.name} 配置已应用`);
            }
          } catch (error) {
            results.failed++;
            console.warn(`❌ 应用灯光配置失败 (${lightConfig.name}):`, error);
          }
        });
      }

      // 应用环境配置
      if (configData.environment && (configType === 'all' || configType === 'environment')) {
        console.log(`🌍 应用环境配置`);
        try {
          if (configData.environment.intensity !== undefined && scene.environmentIntensity !== undefined) {
            scene.environmentIntensity = configData.environment.intensity;
            results.success++;
            results.operations.push('环境光强度已更新');
          }
        } catch (error) {
          results.failed++;
          console.warn('❌ 应用环境配置失败:', error);
        }
      }

      const totalOperations = results.success + results.failed;
      console.log(`🎯 配置应用完成: 成功 ${results.success}/${totalOperations}, 失败 ${results.failed}/${totalOperations}`);

      // 发送应用结果回服务器
      this.sendMessage({
        type: 'configuration_applied',
        timestamp: Date.now(),
        data: {
          sourceUniqueId,
          targetUniqueId: this.currentUniqueId,
          configType,
          results
        }
      });

    } catch (error) {
      console.error('❌ 应用场景配置时发生错误:', error);

      // 发送错误回服务器
      this.sendMessage({
        type: 'configuration_apply_error',
        timestamp: Date.now(),
        data: {
          sourceUniqueId,
          targetUniqueId: this.currentUniqueId,
          configType,
          error: error.message
        }
      });
    }
  }

  /**
   * 启动场景心跳监控
   */
  startSceneHeartbeat() {
    // 清除现有定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // 每60秒发送一次主动心跳
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.currentUniqueId) {
        const heartbeatData = this.generateHeartbeatData();

        this.sendMessage({
          type: 'scene_heartbeat',
          timestamp: Date.now(),
          data: {
            uniqueId: this.currentUniqueId,
            performance: heartbeatData.performance,
            status: heartbeatData.status,
            metadata: heartbeatData.metadata
          }
        });

        console.log('💓 主动发送场景心跳:', this.currentUniqueId);
      }
    }, 60000); // 60秒间隔
  }

  /**
   * 处理检查命令 (用于MCP API)
   */
  handleInspectCommand(message) {
    console.log('🔬 执行检查命令:', message.components);

    const { requestId, components = ['basic'], detailed = false } = message;

    // 执行深度场景分析
    const inspectionResult = this.performInspection(components, detailed);

    // 发送检查结果回服务器
    this.sendMessage({
      type: 'inspect_response',
      requestId: requestId,
      result: inspectionResult,
      timestamp: Date.now()
    });
  }

  /**
   * 处理场景检查请求 (新版本API)
   */
  handleSceneInspectRequest(message) {
    console.log('🔍 处理场景检查请求:', message.requestId);

    const { requestId, components = ['basic'], detailed = false } = message;

    // 执行深度场景分析
    const inspectionResult = this.performInspection(components, detailed);

    // 发送检查结果回服务器
    this.sendMessage({
      type: 'inspect_response',
      requestId: requestId,
      data: inspectionResult,
      result: inspectionResult, // 兼容性
      timestamp: Date.now()
    });
  }

  /**
   * 执行场景检查 (用于MCP API)
   */
  performInspection(components, detailed = false) {
    const result = {
      timestamp: Date.now(),
      clientId: this.clientId,
      sceneId: this.currentSceneId,
      components: {}
    };

    // 获取场景对象（在所有分析中使用）
    const scene = window.scene;

    // 基础信息
    if (components.includes('basic') || components.includes('all')) {
      result.components.basic = {
        engine: 'kingfisher',
        sceneActive: !!scene,
        nodeCount: scene ? this.getAllNodes().length : 0,
        cameraCount: scene ? (scene.cameras ? scene.cameras.length : 0) : 0,
        meshCount: scene ? (scene.meshes ? scene.meshes.length : 0) : 0
      };
    }

    // 性能信息
    if (components.includes('performance') || components.includes('all')) {
      result.components.performance = this.analyzePerformance(scene);
    }

    // 网格信息 (meshes)
    if (components.includes('meshes') || components.includes('all')) {
      result.components.meshes = this.analyzeMeshes(scene, detailed);
    }

    // 节点信息
    if (components.includes('nodes') || components.includes('all')) {
      result.components.nodes = this.queryNodes({}, detailed);
    }

    // 材质信息
    if (components.includes('materials') || components.includes('all')) {
      result.components.materials = this.queryMaterials({}, detailed);
    }

    // 纹理信息
    if (components.includes('textures') || components.includes('all')) {
      result.components.textures = this.analyzeTextures(scene, detailed);
    }

    // 灯光信息
    if (components.includes('lights') || components.includes('all')) {
      result.components.lights = this.analyzeLights(scene, detailed);
    }

    // 摄像头信息
    if (components.includes('cameras') || components.includes('all')) {
      result.components.cameras = this.queryCameras({}, detailed);
    }

    // 动画信息
    if (components.includes('animations') || components.includes('all')) {
      result.components.animations = this.analyzeAnimations(scene, detailed);
    }

    // 全局对象数据
    if (components.includes('global') || components.includes('all')) {
      result.components.global = this.fetchGlobalData();
    }

    // 优化建议
    if (components.includes('suggestions') || components.includes('all')) {
      result.components.suggestions = this.generateOptimizationSuggestions(result.components);
    }

    console.log(`🎯 检查完成，包含组件: ${Object.keys(result.components).join(', ')}`);
    return result;
  }

  /**
   * 处理自定义脚本执行
   */
  handleCustomScript(message) {
    console.log('🎭 执行自定义脚本:', message.script ? message.script.substring(0, 100) + '...' : 'empty script');

    const { requestId, script, context = {}, options = {} } = message;

    // 安全性检查
    if (!script || typeof script !== 'string') {
      console.error('❌ 无效的脚本内容');
      this.sendScriptResponse(requestId, false, '脚本内容无效');
      return;
    }

    // 脚本长度限制
    if (script.length > 10000) {
      console.error('❌ 脚本内容过长');
      this.sendScriptResponse(requestId, false, '脚本内容超出长度限制(10000字符)');
      return;
    }

    // 安全性黑名单检查
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /XMLHttpRequest/,
      /fetch\s*\(/,
      /import\s*\(/,
      /require\s*\(/,
      /\.innerHTML\s*=/,
      /\.outerHTML\s*=/,
      /document\.write/,
      /location\s*=/,
      /window\.location/
    ];

    const hasDangerousCode = dangerousPatterns.some(pattern => pattern.test(script));
    if (hasDangerousCode) {
      console.error('❌ 脚本包含潜在危险的代码');
      this.sendScriptResponse(requestId, false, '脚本包含不允许的API调用');
      return;
    }

    try {
      // 创建安全的执行环境
      const scriptContext = this.createScriptContext(context);

      // 使用安全的Function构造器执行脚本
      const scriptFunction = new Function('context', 'scene', 'inspector',
        `
        "use strict";
        try {
          ${script}
        } catch (error) {
          throw new Error('脚本执行错误: ' + error.message);
        }
        `
      );

      // 执行脚本并获取结果
      const startTime = Date.now();
      const result = scriptFunction(scriptContext, window.scene, this);
      const executionTime = Date.now() - startTime;

      console.log(`✅ 自定义脚本执行成功 (${executionTime}ms)`);

      // 发送执行结果
      this.sendScriptResponse(requestId, true, '脚本执行成功', {
        result: this.serializeScriptResult(result),
        executionTime: executionTime,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ 自定义脚本执行失败:', error);
      this.sendScriptResponse(requestId, false, `脚本执行失败: ${error.message}`);
    }
  }

  /**
   * 创建脚本执行上下文
   */
  createScriptContext(additionalContext = {}) {
    return {
      // 提供安全的API访问
      console: {
        log: (...args) => console.log('[CustomScript]', ...args),
        warn: (...args) => console.warn('[CustomScript]', ...args),
        error: (...args) => console.error('[CustomScript]', ...args)
      },

      // 提供场景检查器的安全API
      inspector: {
        getNodeByID: (id) => this.getNodeByID(id),
        getNodeByPath: (path) => this.getNodeByPath(path),
        getAllNodes: () => this.getAllNodes(),
        queryNodes: (criteria) => this.queryNodes(criteria),
        queryMaterials: (criteria) => this.queryMaterials(criteria),
        queryCameras: (criteria) => this.queryCameras(criteria),
        analyzeScene: () => this.analyzeScene(),
        analyzePerformance: (scene) => this.analyzePerformance(scene)
      },

      // 提供翠鸟API的安全访问
      kingfisher: {
        setActiveCameraArg: (cameraName, duration) => this.setActiveCameraArg(cameraName, duration),
        focusCameraOnObject: (objectId, duration) => this.focusCameraOnObject(objectId, duration),
        translateObject: (objectId, vector, space) => this.translateObject(objectId, vector, space),
        rotateObject: (objectId, axis, angle, space) => this.rotateObject(objectId, axis, angle, space),
        scaleObject: (objectId, vector) => this.scaleObject(objectId, vector),
        setNodeHighlight: (nodeIds, color) => this.setNodeHighlight(nodeIds, color),
        clearHighlight: () => this.clearHighlight(),
        hideObjects: (objects) => this.hideObjects(objects),
        showObjects: (objects) => this.showObjects(objects),
        removeObjects: (objects) => this.removeObjects(objects)
      },

      // 提供数学工具
      Math: Math,

      // 提供用户定义的上下文
      ...additionalContext
    };
  }

  /**
   * 序列化脚本执行结果
   */
  serializeScriptResult(result) {
    try {
      // 处理不同类型的结果
      if (result === null || result === undefined) {
        return result;
      }

      if (typeof result === 'function') {
        return '[Function]';
      }

      if (typeof result === 'object') {
        // 避免循环引用
        const seen = new WeakSet();
        const serializedResult = JSON.parse(JSON.stringify(result, (key, val) => {
          if (val != null && typeof val === "object") {
            if (seen.has(val)) {
              return '[Circular Reference]';
            }
            seen.add(val);
          }

          // 限制对象深度和大小
          if (val != null && typeof val === 'object' && Object.keys(val).length > 100) {
            return '[Large Object]';
          }

          return val;
        }));

        return serializedResult;
      }

      return result;
    } catch (error) {
      console.warn('序列化脚本结果失败:', error);
      return '[Serialization Error]';
    }
  }

  /**
   * 发送脚本执行响应
   */
  sendScriptResponse(requestId, success, message, data = null) {
    const response = {
      type: 'custom_script_response',
      requestId: requestId,
      success: success,
      message: message,
      timestamp: Date.now()
    };

    if (data) {
      response.data = data;
    }

    this.sendMessage(response);
  }

  // ==================== 翠鸟SDK核心功能 ====================

  /**
   * KPath查询 - 获取单个节点
   * @param {string} path KPath路径 (如: "/[#root]/Mesh")
   * @param {Object} rootNode 根节点 (可选)
   * @returns {Object|null} 匹配的节点对象
   */
  getNodeByPath(path, rootNode = null) {
    console.log(`🔎 [getNodeByPath] 查找路径: ${path}`);

    if (!window.scene) {
      console.error('❌ [getNodeByPath] scene对象不存在');
      return null;
    }

    try {
      // 尝试使用翠鸟原生API
      if (typeof window.scene.getNodeByPath === 'function') {
        console.log('✅ [getNodeByPath] 使用scene.getNodeByPath方法');
        const node = window.scene.getNodeByPath(path, rootNode);
        if (node) {
          console.log(`✅ [getNodeByPath] 找到节点:`, node);
        } else {
          console.log(`❌ [getNodeByPath] scene.getNodeByPath未找到节点: ${path}`);
        }
        return node;
      }

      // 自实现KPath解析
      return this.parseKPath(path, rootNode, false);
    } catch (error) {
      console.warn('KPath查询失败:', error);
      return null;
    }
  }

  /**
   * KPath查询 - 获取节点列表
   * @param {string} path KPath路径
   * @param {Object} rootNode 根节点 (可选)
   * @returns {Array} 匹配的节点数组
   */
  getNodeListByPath(path, rootNode = null) {
    if (!window.scene) return [];

    try {
      // 尝试使用翠鸟原生API
      if (typeof window.scene.getNodeListByPath === 'function') {
        return window.scene.getNodeListByPath(path, rootNode);
      }

      // 自实现KPath解析
      return this.parseKPath(path, rootNode, true);
    } catch (error) {
      console.warn('KPath查询失败:', error);
      return [];
    }
  }

  /**
   * KPath解析器 - 翠鸟引擎路径查询
   * 支持格式:
   * - /[#root] - 根节点
   * - /TransformNode[#root] - 指定类型的根节点
   * - /[#root]/Mesh - 根节点下的Mesh
   * - /TransformNode[@name="机位.1"] - 按名称查询
   * - /Mesh[~序号~2] - 按序号查询
   * - /Light[%关键字%] - 按关键字查询
   * @param {string} path KPath路径
   * @param {Object} rootNode 起始节点
   * @param {boolean} returnArray 是否返回数组
   */
  parseKPath(path, rootNode = null, returnArray = false) {
    const scene = window.scene;
    if (!scene) return returnArray ? [] : null;

    // 获取起始节点集合
    const startNodes = rootNode ? (rootNode.childrenNode || [rootNode]) : this.getAllNodes();

    // 分割路径
    const segments = path.split('/').filter(s => s.length > 0);
    let currentNodes = startNodes;

    for (const segment of segments) {
      const nextNodes = [];

      // 解析段格式: Type[filter] 或 [filter]
      const match = segment.match(/^(?:(\w+))?\[([^\]]+)\]$/) || [null, segment, null];
      const nodeType = match[1] || null; // 节点类型 (如 TransformNode, Mesh)
      const filter = match[2] || null;   // 过滤条件

      for (const node of currentNodes) {
        let candidates = [];

        // 获取候选节点
        if (nodeType) {
          // 按类型筛选
          candidates = this.getNodesByType(node, nodeType);
        } else {
          // 获取所有子节点
          candidates = node.childrenNode || [node];
        }

        // 应用过滤条件
        for (const candidate of candidates) {
          if (this.matchFilter(candidate, filter)) {
            nextNodes.push(candidate);
          }
        }
      }

      currentNodes = nextNodes;
      if (currentNodes.length === 0) break;
    }

    if (returnArray) {
      return currentNodes;
    } else {
      return currentNodes.length > 0 ? currentNodes[0] : null;
    }
  }

  /**
   * 获取指定类型的节点
   */
  getNodesByType(parentNode, nodeType) {
    const nodes = [];
    const children = parentNode.childrenNode || [parentNode];

    for (const child of children) {
      if (child.getClassName && child.getClassName() === nodeType) {
        nodes.push(child);
      }
      // 递归搜索
      if (child.childrenNode) {
        nodes.push(...this.getNodesByType(child, nodeType));
      }
    }

    return nodes;
  }

  /**
   * 匹配过滤条件
   */
  matchFilter(node, filter) {
    if (!filter) return true;

    // #id - 按ID匹配
    if (filter.startsWith('#')) {
      const id = filter.substring(1);
      return node.id === id || node.name === id;
    }

    // @name="值" - 按属性匹配
    const attrMatch = filter.match(/^@(\w+)="([^"]+)"$/);
    if (attrMatch) {
      const [, attrName, attrValue] = attrMatch;
      return node[attrName] === attrValue;
    }

    // ~序号~N - 按序号匹配
    const seqMatch = filter.match(/^~序号~(\d+)$/);
    if (seqMatch) {
      const seqNum = parseInt(seqMatch[1]);
      return node.序号 === seqNum || node.sequence === seqNum;
    }

    // %关键字% - 按关键字匹配
    const keywordMatch = filter.match(/^%(.+)%$/);
    if (keywordMatch) {
      const keyword = keywordMatch[1];
      return node.name && node.name.includes(keyword);
    }

    // 默认按名称匹配
    return node.name === filter;
  }

  /**
   * 获取所有节点
   */
  getAllNodes() {
    const scene = window.scene;
    if (!scene) return [];

    try {
      // 尝试多种方式获取节点
      if (typeof scene.getAllTransformNodes === 'function') {
        return scene.getAllTransformNodes();
      }
      if (scene.rootNodes) {
        return scene.rootNodes;
      }
      if (scene.meshes) {
        return [...scene.meshes];
      }
      return [];
    } catch (error) {
      console.warn('获取节点失败:', error);
      return [];
    }
  }

  /**
   * 通过ID获取节点 (翠鸟引擎)
   */
  getNodeByID(nodeId) {
    console.log(`🔎 [getNodeByID] 查找节点: ${nodeId}`);

    if (!window.scene) {
      console.error('❌ [getNodeByID] scene对象不存在');
      return null;
    }

    try {
      // 首先尝试按ID查找
      if (typeof window.scene.getNodeByID === 'function') {
        console.log('✅ [getNodeByID] 尝试使用scene.getNodeByID方法');
        const node = window.scene.getNodeByID(nodeId);
        if (node) {
          console.log(`✅ [getNodeByID] 通过ID找到节点:`, node);
          return node;
        }
      }

      // 如果按ID找不到，尝试按名称查找
      console.log(`🔍 [getNodeByID] 按ID未找到，尝试按名称查找: ${nodeId}`);

      // 获取所有节点并按名称查找
      const allNodes = this.getAllNodes();
      for (const node of allNodes) {
        // 精确匹配名称
        if (node.name === nodeId) {
          console.log(`✅ [getNodeByID] 通过名称精确匹配找到节点:`, node);
          return node;
        }
        // 包含匹配（忽略大小写）
        if (node.name && node.name.toLowerCase().includes(nodeId.toLowerCase())) {
          console.log(`✅ [getNodeByID] 通过名称模糊匹配找到节点:`, node);
          return node;
        }
      }

      console.log(`❌ [getNodeByID] 未找到节点: ${nodeId}`);
      return null;
    } catch (error) {
      console.warn('通过ID获取节点失败:', error);
      return null;
    }
  }

  /**
   * 设置激活机位 (翠鸟引擎核心功能)
   * @param {string} cameraName 机位名称
   * @param {number} duration 动画时长 (秒)
   */
  setActiveCameraArg(cameraName, duration = 1) {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      // 尝试使用翠鸟SDK API
      if (typeof window.puzzle?.setActiveCameraArg === 'function') {
        window.puzzle.setActiveCameraArg(window.scene, cameraName, duration);
        return { success: true, message: `已切换到机位: ${cameraName}` };
      }

      // 备用实现
      if (window.scene.cameras) {
        const camera = window.scene.cameras.find(cam => cam.name === cameraName);
        if (camera) {
          window.scene.activeCamera = camera;
          return { success: true, message: `已切换到机位: ${cameraName}` };
        }
      }

      return { error: `未找到机位: ${cameraName}` };
    } catch (error) {
      return { error: `切换机位失败: ${error.message}` };
    }
  }

  /**
   * 聚焦摄像头到对象 (翠鸟引擎核心功能)
   * @param {string} objectId 对象ID
   * @param {number} animationTimeInSeconds 动画时长
   */
  focusCameraOnObject(objectId, animationTimeInSeconds = 0) {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      // 尝试使用翠鸟SDK API
      if (typeof window.puzzle?.focusCameraOnObject === 'function') {
        window.puzzle.focusCameraOnObject(window.scene, objectId, animationTimeInSeconds);
        return { success: true, message: `摄像头已聚焦到对象: ${objectId}` };
      }

      // 备用实现 - 查找对象并聚焦
      const targetNode = this.getNodeByID(objectId);
      if (targetNode && window.scene.activeCamera) {
        const camera = window.scene.activeCamera;
        if (typeof camera.setTarget === 'function' && targetNode.position) {
          camera.setTarget(targetNode.position);
          return { success: true, message: `摄像头已聚焦到对象: ${objectId}` };
        }
      }

      return { error: `无法聚焦到对象: ${objectId}` };
    } catch (error) {
      return { error: `聚焦失败: ${error.message}` };
    }
  }

  /**
   * 平移对象 (翠鸟引擎核心功能)
   * @param {string} objectId 对象ID
   * @param {Object} vector 平移向量 {x, y, z}
   * @param {string} space 坐标空间 ('LOCAL' | 'WORLD')
   */
  translateObject(objectId, vector, space = 'LOCAL') {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      // 尝试使用翠鸟SDK API
      if (typeof window.puzzle?.translateObject === 'function') {
        const spaceEnum = space === 'WORLD' ? window.Space?.WORLD : window.Space?.LOCAL;
        window.puzzle.translateObject(window.scene, objectId, vector, spaceEnum);
        return { success: true, message: `对象 ${objectId} 已平移` };
      }

      // 备用实现
      const node = this.getNodeByID(objectId);
      if (node && node.position) {
        if (space === 'WORLD') {
          node.position.x += vector.x;
          node.position.y += vector.y;
          node.position.z += vector.z;
        } else {
          // LOCAL空间需要考虑对象的旋转
          if (typeof node.translate === 'function') {
            node.translate(vector);
          } else {
            node.position.x += vector.x;
            node.position.y += vector.y;
            node.position.z += vector.z;
          }
        }
        return { success: true, message: `对象 ${objectId} 已平移` };
      }

      return { error: `未找到对象: ${objectId}` };
    } catch (error) {
      return { error: `平移失败: ${error.message}` };
    }
  }

  /**
   * 旋转对象 (翠鸟引擎核心功能)
   * @param {string} objectId 对象ID
   * @param {Object} axis 旋转轴 {x, y, z}
   * @param {number} amountInDegree 旋转角度 (度)
   * @param {string} space 坐标空间 ('LOCAL' | 'WORLD')
   */
  rotateObject(objectId, axis, amountInDegree, space = 'LOCAL') {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      // 尝试使用翠鸟SDK API
      if (typeof window.puzzle?.rotateObject === 'function') {
        const spaceEnum = space === 'WORLD' ? window.Space?.WORLD : window.Space?.LOCAL;
        window.puzzle.rotateObject(window.scene, objectId, axis, amountInDegree, spaceEnum);
        return { success: true, message: `对象 ${objectId} 已旋转 ${amountInDegree}°` };
      }

      // 备用实现
      const node = this.getNodeByID(objectId);
      if (node && node.rotation) {
        const radians = amountInDegree * Math.PI / 180;
        if (typeof node.rotate === 'function') {
          node.rotate(axis, radians);
        } else {
          // 简单的欧拉角旋转
          node.rotation.x += axis.x * radians;
          node.rotation.y += axis.y * radians;
          node.rotation.z += axis.z * radians;
        }
        return { success: true, message: `对象 ${objectId} 已旋转 ${amountInDegree}°` };
      }

      return { error: `未找到对象: ${objectId}` };
    } catch (error) {
      return { error: `旋转失败: ${error.message}` };
    }
  }

  /**
   * 缩放对象 (翠鸟引擎核心功能)
   * @param {string} objectId 对象ID
   * @param {Object} vector 缩放向量 {x, y, z}
   */
  scaleObject(objectId, vector) {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      // 尝试使用翠鸟SDK API
      if (typeof window.puzzle?.scaleObject === 'function') {
        window.puzzle.scaleObject(window.scene, objectId, vector);
        return { success: true, message: `对象 ${objectId} 已缩放` };
      }

      // 备用实现
      const node = this.getNodeByID(objectId);
      if (node && node.scaling) {
        node.scaling.x = vector.x;
        node.scaling.y = vector.y;
        node.scaling.z = vector.z;
        return { success: true, message: `对象 ${objectId} 已缩放` };
      }

      return { error: `未找到对象: ${objectId}` };
    } catch (error) {
      return { error: `缩放失败: ${error.message}` };
    }
  }

  /**
   * 设置节点高亮 (翠鸟引擎核心功能)
   * @param {Array} nodeIds 节点ID数组
   * @param {string} color 高亮颜色 (如: '#ff0000')
   */
  setNodeHighlight(nodeIds, color = '#ff0000') {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      // 尝试使用翠鸟SDK API
      if (typeof window.puzzle?.setNodeHighlight === 'function') {
        window.puzzle.setNodeHighlight(window.scene, nodeIds, color);
        return { success: true, message: `已高亮 ${nodeIds.length} 个节点` };
      }

      // 备用实现 - 创建高亮层
      if (!this.highlightLayer && window.BABYLON) {
        this.highlightLayer = new window.BABYLON.HighlightLayer('highlight', window.scene);
      }

      if (this.highlightLayer) {
        const colorObj = this.parseColor(color);
        for (const nodeId of nodeIds) {
          const node = this.getNodeByID(nodeId);
          if (node && typeof this.highlightLayer.addMesh === 'function') {
            this.highlightLayer.addMesh(node, colorObj);
          }
        }
        return { success: true, message: `已高亮 ${nodeIds.length} 个节点` };
      }

      return { error: '无法创建高亮层' };
    } catch (error) {
      return { error: `设置高亮失败: ${error.message}` };
    }
  }

  /**
   * 清空高亮层 (翠鸟引擎核心功能)
   */
  clearHighlight() {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      // 尝试使用翠鸟SDK API
      if (typeof window.puzzle?.clearHighlight === 'function') {
        window.puzzle.clearHighlight(window.scene);
        return { success: true, message: '已清空高亮' };
      }

      // 备用实现
      if (this.highlightLayer && typeof this.highlightLayer.removeAllMeshes === 'function') {
        this.highlightLayer.removeAllMeshes();
        return { success: true, message: '已清空高亮' };
      }

      return { success: true, message: '无高亮需要清空' };
    } catch (error) {
      return { error: `清空高亮失败: ${error.message}` };
    }
  }

  /**
   * 解析颜色字符串为Color3对象
   */
  parseColor(colorStr) {
    if (window.BABYLON && window.BABYLON.Color3) {
      if (colorStr.startsWith('#')) {
        const hex = colorStr.substring(1);
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        return new window.BABYLON.Color3(r, g, b);
      }
    }
    return { r: 1, g: 0, b: 0 }; // 默认红色
  }

  /**
   * 设置材质颜色 (翠鸟引擎)
   * @param {string} materialName 材质名称
   * @param {string} color 颜色值
   */
  setMaterialColor(materialName, color) {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      const material = this.getMaterialByName(materialName);
      if (material) {
        const colorObj = this.parseColor(color);
        if (material.diffuseColor) {
          material.diffuseColor = colorObj;
        }
        if (material.emissiveColor) {
          material.emissiveColor = colorObj;
        }
        return { success: true, message: `材质 ${materialName} 颜色已更新` };
      }

      return { error: `未找到材质: ${materialName}` };
    } catch (error) {
      return { error: `设置材质颜色失败: ${error.message}` };
    }
  }

  /**
   * 通过名称获取材质
   */
  getMaterialByName(materialName) {
    if (!window.scene) return null;

    try {
      if (window.scene.materials) {
        return window.scene.materials.find(mat => mat.name === materialName) || null;
      }
      return null;
    } catch (error) {
      console.warn('获取材质失败:', error);
      return null;
    }
  }

  /**
   * 销毁网格对象 (翠鸟引擎)
   */
  disposeMesh(meshId) {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    try {
      const mesh = this.getNodeByID(meshId);
      if (mesh && typeof mesh.dispose === 'function') {
        mesh.dispose();
        return { success: true, message: `网格 ${meshId} 已销毁` };
      }

      return { error: `未找到网格: ${meshId}` };
    } catch (error) {
      return { error: `销毁网格失败: ${error.message}` };
    }
  }

  // ==================== 其他辅助功能 ====================

  /**
   * 分析场景并报告
   */
  analyzeAndReport() {
    const analysis = this.analyzeScene();
    this.lastAnalysis = analysis;

    if (this.isConnected) {
      this.sendSceneInfo(analysis);
    }

    return analysis;
  }

  /**
   * 分析翠鸟引擎场景对象 (简化版)
   */
  analyzeScene() {
    if (!window.scene) {
      return {
        error: 'window.scene 对象不存在',
        timestamp: Date.now(),
        engineType: 'kingfisher'
      };
    }

    const scene = window.scene;
    const analysis = {
      timestamp: Date.now(),
      engineType: 'kingfisher',
      sceneId: scene.id || 'kingfisher_scene',

      // 基础信息
      basic: {
        id: scene.id,
        name: scene.name,
        isReady: scene.isReady ? scene.isReady() : true,
        isDisposed: scene?.isDisposed,
        engineType: 'kingfisher'
      },

      // 性能信息
      performance: this.analyzePerformance(scene)
    };

    return analysis;
  }

  /**
   * 分析性能指标
   */
  analyzePerformance(scene) {
    if (!scene) return null;

    try {
      const engine = scene.getEngine ? scene.getEngine() : null;
      return {
        fps: engine ? Math.round(engine.getFps()) : 60,
        triangles: scene.getTotalVertices ? scene.getTotalVertices() : 0,
        drawCalls: engine ? engine.drawCalls : 0,
        memory: window.performance && window.performance.memory ?
          Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) : 0
      };
    } catch (error) {
      console.warn('性能分析失败:', error);
      return null;
    }
  }

  /**
   * 隐藏对象
   */
  hideObjects(objectNames) {
    console.log('🎯 [hideObjects] 开始执行，要隐藏的对象:', objectNames);

    if (!window.scene) {
      console.error('❌ [hideObjects] scene对象不存在');
      return { error: 'scene对象不存在' };
    }

    console.log('✅ [hideObjects] scene对象存在:', window.scene);
    const results = [];

    objectNames.forEach(name => {
      console.log(`📋 [hideObjects] 正在处理对象: ${name}`);

      try {
        // 使用getNodeByID方法查找节点
        console.log(`🔍 [hideObjects] 尝试用getNodeByID查找: ${name}`);
        let node = this.getNodeByID(name);

        if (!node) {
          console.log(`🔍 [hideObjects] getNodeByID未找到，尝试KPath查询: /[%${name}%]`);
          // 尝试KPath查询，支持关键字匹配
          node = this.getNodeByPath(`/[%${name}%]`);
        }

        if (node) {
          console.log(`✅ [hideObjects] 找到节点:`, node);
          console.log(`📝 [hideObjects] 节点信息 - name: ${node.name}, id: ${node.id}, type: ${node.constructor?.name}`);

          // 隐藏节点
          if (typeof node.setEnabled === 'function') {
            console.log(`🔧 [hideObjects] 使用 setEnabled(false) 方法`);
            node.setEnabled(false);
            results.push(`隐藏节点: ${name} (setEnabled)`);
            console.log(`✅ [hideObjects] 成功隐藏: ${name} (setEnabled)`);
          } else if (node.hasOwnProperty('isVisible')) {
            console.log(`🔧 [hideObjects] 使用 isVisible = false 属性`);
            const oldValue = node.isVisible;
            node.isVisible = false;
            console.log(`✅ [hideObjects] 成功隐藏: ${name} (isVisible), 原值: ${oldValue}, 新值: ${node.isVisible}`);
            results.push(`隐藏节点: ${name} (isVisible)`);
          } else if (node.hasOwnProperty('visible')) {
            console.log(`🔧 [hideObjects] 使用 visible = false 属性`);
            const oldValue = node.visible;
            node.visible = false;
            console.log(`✅ [hideObjects] 成功隐藏: ${name} (visible), 原值: ${oldValue}, 新值: ${node.visible}`);
            results.push(`隐藏节点: ${name} (visible)`);
          } else {
            console.warn(`⚠️ [hideObjects] 节点不支持任何隐藏方法: ${name}`);
            console.log(`📊 [hideObjects] 节点属性:`, Object.keys(node));
            results.push(`无法隐藏节点: ${name} (不支持的方法)`);
          }
        } else {
          console.warn(`❌ [hideObjects] 未找到对象: ${name}`);
          results.push(`未找到对象: ${name}`);
        }

      } catch (error) {
        console.error(`❌ [hideObjects] 隐藏对象失败: ${name}`, error);
        results.push(`隐藏失败: ${name} - ${error.message}`);
      }
    });

    console.log('🏁 [hideObjects] 执行完成，结果:', results);
    return { success: true, actions: results };
  }

  /**
   * 显示对象
   */
  showObjects(objectNames) {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    const results = [];

    objectNames.forEach(name => {
      try {
        // 使用getNodeByID方法查找节点
        let node = this.getNodeByID(name);

        if (!node) {
          // 尝试KPath查询，支持关键字匹配
          node = this.getNodeByPath(`/[%${name}%]`);
        }

        if (node) {
          // 显示节点
          if (typeof node.setEnabled === 'function') {
            node.setEnabled(true);
            results.push(`显示节点: ${name} (setEnabled)`);
          } else if (node.hasOwnProperty('isVisible')) {
            node.isVisible = true;
            results.push(`显示节点: ${name} (isVisible)`);
          } else if (node.hasOwnProperty('visible')) {
            node.visible = true;
            results.push(`显示节点: ${name} (visible)`);
          } else {
            results.push(`无法显示节点: ${name} (不支持的方法)`);
          }
        } else {
          results.push(`未找到对象: ${name}`);
        }

      } catch (error) {
        console.warn(`显示对象失败: ${name}`, error);
        results.push(`显示失败: ${name} - ${error.message}`);
      }
    });

    return { success: true, actions: results };
  }

  /**
   * 删除对象 (使用新SDK方法)
   */
  removeObjects(objectNames) {
    if (!window.scene) {
      return { error: 'scene对象不存在' };
    }

    const results = [];

    objectNames.forEach(name => {
      try {
        // 使用新的getNodeByID方法查找节点
        let node = this.getNodeByID(name);

        if (!node) {
          // 尝试KPath查询，支持关键字匹配
          node = this.getNodeByPath(`/[%${name}%]`);
        }

        if (node) {
          // 使用新的disposeMesh方法
          const disposeResult = this.disposeMesh(node.id || node.name || name);
          if (disposeResult.success) {
            results.push(`删除节点: ${name} - ${disposeResult.message}`);
          } else {
            // 备用删除策略
            if (typeof node.dispose === 'function') {
              node.dispose();
              results.push(`删除节点: ${name}`);
            } else if (typeof node.setEnabled === 'function') {
              node.setEnabled(false);
              results.push(`隐藏节点: ${name}`);
            } else {
              node.isVisible = false;
              results.push(`标记隐藏: ${name}`);
            }
          }
        } else {
          results.push(`未找到对象: ${name}`);
        }

      } catch (error) {
        console.warn(`删除对象失败: ${name}`, error);
        results.push(`删除失败: ${name} - ${error.message}`);
      }
    });

    return { success: true, actions: results };
  }

  /**
   * 计算网格到摄像头的距离
   */
  getDistanceFromCamera(mesh) {
    if (!window.scene.activeCamera || !mesh.position) {
      return 0;
    }

    const camera = window.scene.activeCamera;
    const dx = camera.position.x - mesh.position.x;
    const dy = camera.position.y - mesh.position.y;
    const dz = camera.position.z - mesh.position.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 查询节点 (翠鸟引擎特定)
   */
  queryNodes(criteria) {
    if (!window.scene) return [];

    let nodes = [];

    try {
      // 使用KPath查询
      if (criteria.path) {
        nodes = this.getNodeListByPath(criteria.path);
      } else if (criteria.name && typeof window.scene.getNodeByName === 'function') {
        const node = window.scene.getNodeByName(criteria.name);
        if (node) nodes = [node];
      } else {
        nodes = this.getAllNodes();
      }
    } catch (error) {
      console.warn('查询节点失败:', error);
      return [];
    }

    return nodes.filter(node => {
      if (criteria.name && !node.name.includes(criteria.name)) return false;
      if (criteria.type && node.getClassName && !node.getClassName().includes(criteria.type)) return false;
      if (criteria.visible !== undefined && (node.isVisible !== false) !== criteria.visible) return false;
      return true;
    }).map(node => ({
      id: node.id,
      name: node.name,
      type: node.getClassName ? node.getClassName() : 'Unknown',
      isVisible: node.isVisible !== false,
      position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
      childrenCount: node.childrenNode ? node.childrenNode.length : 0
    }));
  }

  /**
   * 查询材质
   */
  queryMaterials(criteria) {
    if (!window.scene) return [];

    let materials = [];
    try {
      if (typeof window.scene.getAllMaterials === 'function') {
        materials = window.scene.getAllMaterials();
      } else if (window.scene.materials) {
        materials = window.scene.materials;
      }
    } catch (error) {
      console.warn('查询材质失败:', error);
      return [];
    }

    return materials.filter(material => {
      if (criteria.name && !material.name.includes(criteria.name)) return false;
      return true;
    }).map(material => ({
      id: material.id,
      name: material.name,
      type: material.getClassName ? material.getClassName() : 'Unknown'
    }));
  }

  /**
   * 查询摄像头/机位
   */
  queryCameras(criteria) {
    if (!window.scene) return [];

    let cameras = [];
    try {
      if (typeof window.scene.getAllCameraArgs === 'function') {
        cameras = window.scene.getAllCameraArgs();
      } else if (window.scene.cameras) {
        cameras = window.scene.cameras;
      }
    } catch (error) {
      console.warn('查询摄像头失败:', error);
      return [];
    }

    return cameras.map(camera => ({
      id: camera.id,
      name: camera.name,
      isActive: camera === window.scene.activeCamera
    }));
  }

  /**
   * 发送场景信息到服务器
   */
  sendSceneInfo(analysis) {
    // 生成或使用现有的uniqueId
    const scene = window.scene;
    const uniqueId = scene?.uniqueId || scene?.id || `kingfisher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 更新当前场景标识
    this.currentSceneId = analysis.sceneId;
    this.currentUniqueId = uniqueId;

    // 创建增强的场景数据
    const enhancedSceneData = {
      sceneId: analysis.sceneId,
      uniqueId: uniqueId, // 场景唯一标识
      nickname: this.generateSceneNickname(scene, uniqueId), // 生成友好的场景名称
      engine: 'kingfisher',
      engineVersion: this.getEngineVersion(),
      timestamp: analysis.timestamp,
      performance: analysis.performance,
      hasErrors: !!analysis.error,
      metadata: {
        nodeCount: scene ? this.getAllNodes().length : 0,
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      config: this.extractSceneConfiguration(scene) // 提取场景配置信息
    };

    this.sendMessage({
      type: 'scene_info',
      timestamp: Date.now(),
      data: enhancedSceneData
    });

    // 启动心跳监控（如果还没启动）
    if (!this.heartbeatTimer) {
      this.startSceneHeartbeat();
    }
  }

  /**
   * 生成场景友好名称
   */
  generateSceneNickname(scene, uniqueId) {
    if (scene?.name) {
      return scene.name;
    }

    // 根据URL生成友好名称
    const url = window.location.href;
    const pathName = window.location.pathname;

    // 将uniqueId转换为字符串，如果是数字则直接使用
    const idStr = typeof uniqueId === 'string' ? uniqueId.substring(0, 8) : String(uniqueId);

    if (pathName.includes('designer')) {
      return `设计器场景_${idStr}`;
    } else if (pathName.includes('viewer')) {
      return `查看器场景_${idStr}`;
    } else if (pathName.includes('preview')) {
      return `预览场景_${idStr}`;
    } else {
      return `翠鸟场景_${idStr}`;
    }
  }

  /**
   * 获取引擎版本信息
   */
  getEngineVersion() {
    // 尝试获取翠鸟引擎版本
    if (window.puzzle?.version) {
      return window.puzzle.version;
    }
    if (window.scene?.version) {
      return window.scene.version;
    }
    return '未知版本';
  }

  /**
   * 提取场景配置信息
   */
  extractSceneConfiguration(scene) {
    if (!scene) return {};

    const config = {};

    try {
      // 相机配置
      if (typeof scene.getAllCameraArgs === 'function') {
        config.cameras = scene.getAllCameraArgs();
      }

      // 材质配置
      if (typeof scene.getAllMaterials === 'function') {
        const materials = scene.getAllMaterials();
        config.materials = materials ? materials.map(mat => ({
          name: mat.name,
          id: mat.id,
          type: mat.constructor.name
        })) : [];
      }

      // 灯光配置
      if (scene.lights) {
        config.lighting = scene.lights.map(light => ({
          name: light.name,
          type: light.constructor.name,
          enabled: light.isEnabled ? light.isEnabled() : true
        }));
      }

      // 场景环境设置
      if (scene.environmentTexture) {
        config.environment = {
          hasTexture: !!scene.environmentTexture,
          intensity: scene.environmentIntensity || 1
        };
      }

    } catch (error) {
      console.warn('提取场景配置失败:', error);
    }

    return config;
  }

  // ==================== 翠鸟API集成层 ====================

  /**
   * 翠鸟API集成层 - 提供对PuzzleInterface方法的封装和扩展
   */
  getKingfisherAPI() {
    return {
      // 场景查询API
      queries: {
        getAllCameraArgs: () => {
          const scene = window.scene;
          if (!scene || typeof scene.getAllCameraArgs !== 'function') return [];
          return scene.getAllCameraArgs();
        },

        getAllMaterials: () => {
          const scene = window.scene;
          if (!scene || typeof scene.getAllMaterials !== 'function') return [];
          return scene.getAllMaterials();
        },

        getAllMeshes: () => {
          const scene = window.scene;
          if (!scene || !scene.meshes) return [];
          return scene.meshes;
        },

        getAllTransformNodes: () => {
          const scene = window.scene;
          if (!scene || !scene.transformNodes) return [];
          return scene.transformNodes;
        },

        getObjectByName: (name) => {
          const scene = window.scene;
          if (!scene) return null;
          return scene.getNodeByName(name) || scene.getMeshByName(name);
        }
      },

      // 相机控制API
      camera: {
        setActiveCameraArg: (cameraName, duration = 1) => {
          const scene = window.scene;
          if (!scene || !scene.cameraArgsArray) return false;

          const targetCamera = scene.cameraArgsArray.find(camera => camera.name === cameraName);
          if (!targetCamera) {
            console.warn(`相机 "${cameraName}" 不存在`);
            return false;
          }

          if (scene.activeCamera && typeof scene.activeCamera.focusOn === 'function') {
            scene.activeCamera.focusOn(targetCamera, duration);
            return true;
          } else {
            console.warn('当前活跃相机不支持focusOn方法');
            return false;
          }
        },

        focusCameraOnObject: (objectId, duration = 2) => {
          const scene = window.scene;
          if (!scene) return false;

          const targetObject = scene.getNodeByID(objectId) || scene.getMeshByID(objectId);
          if (!targetObject) {
            console.warn(`对象 "${objectId}" 不存在`);
            return false;
          }

          // 使用翠鸟的相机聚焦功能
          if (scene.activeCamera && typeof scene.activeCamera.setTarget === 'function') {
            scene.activeCamera.setTarget(targetObject.position);
            return true;
          }

          return false;
        }
      },

      // 对象变换API
      transform: {
        translateObject: (objectId, vector, space = 'LOCAL') => {
          const scene = window.scene;
          if (!scene) return false;

          const targetObject = scene.getNodeByID(objectId) || scene.getMeshByID(objectId);
          if (!targetObject || typeof targetObject.translate !== 'function') {
            console.warn(`对象 "${objectId}" 不存在或不支持translate方法`);
            return false;
          }

          // 转换space参数
          const spaceValue = space === 'WORLD' ? 1 : 0;
          const vectorObj = { x: vector.x || 0, y: vector.y || 0, z: vector.z || 0 };

          targetObject.translate(vectorObj, 1, spaceValue);
          return true;
        },

        rotateObject: (objectId, axis, angle, space = 'LOCAL') => {
          const scene = window.scene;
          if (!scene) return false;

          const targetObject = scene.getNodeByID(objectId) || scene.getMeshByID(objectId);
          if (!targetObject || typeof targetObject.rotate !== 'function') {
            console.warn(`对象 "${objectId}" 不存在或不支持rotate方法`);
            return false;
          }

          // 转换参数
          const spaceValue = space === 'WORLD' ? 1 : 0;
          const axisObj = { x: axis.x || 0, y: axis.y || 1, z: axis.z || 0 };
          const angleInRadians = (angle * Math.PI) / 180; // 转换为弧度

          targetObject.rotate(axisObj, angleInRadians, spaceValue);
          return true;
        },

        scaleObject: (objectId, vector) => {
          const scene = window.scene;
          if (!scene) return false;

          const targetObject = scene.getNodeByID(objectId) || scene.getMeshByID(objectId);
          if (!targetObject) {
            console.warn(`对象 "${objectId}" 不存在`);
            return false;
          }

          if (targetObject.scaling) {
            targetObject.scaling.x = vector.x || 1;
            targetObject.scaling.y = vector.y || 1;
            targetObject.scaling.z = vector.z || 1;
            return true;
          }

          return false;
        }
      },

      // 材质控制API
      material: {
        setMaterial: (meshId, materialId) => {
          const scene = window.scene;
          if (!scene) return false;

          const mesh = scene.getMeshByID(meshId);
          const material = scene.getMaterialByID(materialId);

          if (!mesh || !material) {
            console.warn(`网格 "${meshId}" 或材质 "${materialId}" 不存在`);
            return false;
          }

          mesh.material = material;
          return true;
        },

        setMaterialColor: (materialId, color) => {
          const scene = window.scene;
          if (!scene) return false;

          const material = scene.getMaterialByID(materialId);
          if (!material) {
            console.warn(`材质 "${materialId}" 不存在`);
            return false;
          }

          // 解析颜色
          const colorObj = this.parseColor(color);
          if (!colorObj) {
            console.warn(`无效的颜色值: "${color}"`);
            return false;
          }

          // 设置材质颜色
          if (material.diffuseColor) {
            material.diffuseColor = colorObj;
          } else if (material.baseColor) {
            material.baseColor = colorObj;
          }

          return true;
        }
      },

      // 视觉效果API
      visualEffects: {
        setNodeHighlight: (nodeIds, color = '#ff0000') => {
          if (!window.puzzle || typeof window.puzzle.setNodeHighlight !== 'function') {
            console.warn('翠鸟高亮API不可用');
            return false;
          }

          const results = [];
          const nodeArray = Array.isArray(nodeIds) ? nodeIds : [nodeIds];

          nodeArray.forEach(nodeId => {
            try {
              window.puzzle.setNodeHighlight(nodeId, color);
              results.push({ nodeId, success: true });
            } catch (error) {
              console.warn(`设置节点 "${nodeId}" 高亮失败:`, error);
              results.push({ nodeId, success: false, error: error.message });
            }
          });

          return results;
        },

        clearHighlight: () => {
          if (!window.puzzle || typeof window.puzzle.clearHighlight !== 'function') {
            console.warn('翠鸟清除高亮API不可用');
            return false;
          }

          try {
            window.puzzle.clearHighlight();
            return true;
          } catch (error) {
            console.warn('清除高亮失败:', error);
            return false;
          }
        }
      },

      // 对象可见性API
      visibility: {
        setObjectVisibility: (objectIds, visible) => {
          const scene = window.scene;
          if (!scene) return [];

          const results = [];
          const objectArray = Array.isArray(objectIds) ? objectIds : [objectIds];

          objectArray.forEach(objectId => {
            const targetObject = scene.getNodeByID(objectId) || scene.getMeshByID(objectId);
            if (targetObject) {
              if (typeof targetObject.setEnabled === 'function') {
                targetObject.setEnabled(visible);
                results.push({ objectId, success: true, method: 'setEnabled' });
              } else if ('isVisible' in targetObject) {
                targetObject.isVisible = visible;
                results.push({ objectId, success: true, method: 'isVisible' });
              } else {
                results.push({ objectId, success: false, error: '对象不支持可见性控制' });
              }
            } else {
              results.push({ objectId, success: false, error: '对象不存在' });
            }
          });

          return results;
        }
      }
    };
  }

  /**
   * 安全的JSON序列化，避免循环引用
   */
  safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, val) => {
      if (val != null && typeof val === "object") {
        if (seen.has(val)) {
          return "[Circular Reference]";
        }
        seen.add(val);
      }
      return val;
    });
  }

  /**
   * 发送消息到服务器
   */
  sendMessage(message) {
    if (this.isConnected && this.ws) {
      try {
        this.ws.send(this.safeStringify(message));
        return true;
      } catch (error) {
        //console.error('❌ 发送消息失败:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 开始自动分析
   */
  startAutoAnalysis() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }

    this.analysisTimer = setInterval(() => {
      this.analyzeAndReport();
    }, this.options.analyzeInterval);
  }

  /**
   * 场景状态监控和生命周期管理
   */
  watchSceneChanges() {
    let lastSceneState = null;

    // 定期检查场景状态变化
    this.sceneWatcher = setInterval(() => {
      const currentState = this.getSceneState();

      if (this.hasSceneStateChanged(lastSceneState, currentState)) {
        console.log('🔄 场景状态发生变化');

        // 更新场景标识
        if (currentState.hasScene && currentState.sceneId !== this.currentSceneId) {
          this.currentSceneId = currentState.sceneId;
          if (!this.currentUniqueId || this.currentUniqueId.toString().includes('_temp_')) {
            // 生成新的唯一标识
            this.currentUniqueId = `kingfisher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
        }

        // 如果场景消失，标记为非活跃
        if (!currentState.hasScene && lastSceneState?.hasScene) {
          this.handleSceneDisconnected();
        }

        // 如果场景重新出现，重新连接
        if (currentState.hasScene && !lastSceneState?.hasScene) {
          this.handleSceneReconnected();
        }

        lastSceneState = { ...currentState };
      }
    }, 5000); // 每5秒检查一次
  }

  /**
   * 获取当前场景状态
   */
  getSceneState() {
    const scene = window.scene;
    return {
      hasScene: !!scene,
      sceneId: scene?.id || scene?.name || 'unknown',
      isReady: scene?.isReady ? scene.isReady() : false,
      nodeCount: scene ? this.getAllNodes().length : 0,
      timestamp: Date.now()
    };
  }

  /**
   * 检查场景状态是否发生变化
   */
  hasSceneStateChanged(oldState, newState) {
    if (!oldState) return true;

    return (
      oldState.hasScene !== newState.hasScene ||
      oldState.sceneId !== newState.sceneId ||
      oldState.isReady !== newState.isReady ||
      Math.abs(oldState.nodeCount - newState.nodeCount) > 10 // 节点数变化超过10个
    );
  }

  /**
   * 处理场景断开连接
   */
  handleSceneDisconnected() {
    console.log('❌ 场景已断开连接');

    // 发送场景状态更新
    if (this.isConnected) {
      this.sendMessage({
        type: 'scene_heartbeat',
        timestamp: Date.now(),
        data: {
          uniqueId: this.currentUniqueId,
          status: 'disconnected',
          performance: null,
          metadata: {
            nodeCount: 0,
            hasScene: false,
            url: window.location.href,
            lastActivity: Date.now()
          }
        }
      });
    }
  }

  /**
   * 处理场景重新连接
   */
  handleSceneReconnected() {
    console.log('✅ 场景已重新连接');

    // 重新分析和报告场景信息
    if (this.isConnected) {
      this.analyzeAndReport();
    }

    // 重启心跳监控
    this.startSceneHeartbeat();
  }

  /**
   * 清理资源和停止监控
   */
  cleanup() {
    console.log('🧹 清理翠鸟场景检查器资源');

    // 停止所有定时器
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.sceneWatcher) {
      clearInterval(this.sceneWatcher);
      this.sceneWatcher = null;
    }

    // 发送断开连接通知
    if (this.isConnected && this.currentUniqueId) {
      this.sendMessage({
        type: 'scene_heartbeat',
        timestamp: Date.now(),
        data: {
          uniqueId: this.currentUniqueId,
          status: 'cleanup',
          performance: null,
          metadata: {
            nodeCount: 0,
            hasScene: false,
            url: window.location.href,
            lastActivity: Date.now()
          }
        }
      });
    }

    // 关闭WebSocket连接
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.currentSceneId = null;
    this.currentUniqueId = null;
  }

  /**
   * 页面卸载时的清理
   */
  setupPageUnloadHandlers() {
    // 页面刷新或关闭时清理资源
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // 页面隐藏时暂停分析
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('📱 页面隐藏，暂停场景分析');
        if (this.analysisTimer) {
          clearInterval(this.analysisTimer);
          this.analysisTimer = null;
        }
      } else {
        console.log('📱 页面显示，恢复场景分析');
        if (this.options.autoAnalyze && !this.analysisTimer) {
          this.startAutoAnalysis();
        }
      }
    });

    // 窗口大小变化时更新元数据
    window.addEventListener('resize', () => {
      if (this.isConnected && this.currentUniqueId) {
        // 延迟发送，避免频繁更新
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          this.sendMessage({
            type: 'scene_metadata_update',
            timestamp: Date.now(),
            data: {
              uniqueId: this.currentUniqueId,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight
              }
            }
          });
        }, 1000);
      }
    });
  }

  /**
   * 停止自动分析
   */
  stopAutoAnalysis() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }

  /**
   * 分析网格 (参考翠鸟SDK文档)
   */
  analyzeMeshes(scene, detailed = false) {
    if (!scene) return null;

    try {
      let meshes = [];
      let totalVertices = 0;
      let visibleMeshes = 0;

      // 使用翠鸟SDK方法获取所有网格
      if (typeof scene.getAllMeshes === 'function') {
        meshes = scene.getAllMeshes();
      } else if (scene.meshes) {
        meshes = scene.meshes;
      }

      const meshSummary = meshes.map(mesh => {
        const isVisible = mesh.isVisible !== false && mesh.visibility > 0;
        if (isVisible) visibleMeshes++;

        const vertices = mesh.getTotalVertices ? mesh.getTotalVertices() : 0;
        totalVertices += vertices;

        const meshInfo = {
          id: mesh.id,
          name: mesh.name,
          isVisible: isVisible,
          vertices: vertices,
          triangles: mesh.getTotalIndices ? Math.floor(mesh.getTotalIndices() / 3) : 0
        };

        if (detailed) {
          meshInfo.position = mesh.position ? [mesh.position.x, mesh.position.y, mesh.position.z] : null;
          meshInfo.scaling = mesh.scaling ? [mesh.scaling.x, mesh.scaling.y, mesh.scaling.z] : null;
          meshInfo.materialName = mesh.material ? mesh.material.name : null;
          meshInfo.hasLOD = !!mesh.getLOD;

          // 获取自定义属性（如果存在）
          if (mesh.metadata) {
            meshInfo.metadata = mesh.metadata;
          }

          // 获取翠鸟特定属性
          if (mesh.userData) {
            meshInfo.userData = mesh.userData;
          }
        }

        return meshInfo;
      });

      return {
        total: meshes.length,
        visible: visibleMeshes,
        summary: {
          totalVertices: totalVertices,
          totalTriangles: meshes.reduce((sum, mesh) => sum + (mesh.getTotalIndices ? Math.floor(mesh.getTotalIndices() / 3) : 0), 0)
        },
        meshes: detailed ? meshSummary : meshSummary.slice(0, 10) // 限制数量
      };

    } catch (error) {
      console.warn('网格分析失败:', error);
      return null;
    }
  }

  /**
   * 分析纹理
   */
  analyzeTextures(scene, detailed = false) {
    if (!scene) return null;

    try {
      let textures = [];

      // 获取纹理列表
      if (scene.textures) {
        textures = scene.textures;
      }

      const textureSummary = textures.map(texture => {
        const textureInfo = {
          id: texture.id,
          name: texture.name,
          url: texture.url,
          isReady: texture.isReady ? texture.isReady() : false
        };

        if (detailed) {
          textureInfo.width = texture.getSize ? texture.getSize().width : 0;
          textureInfo.height = texture.getSize ? texture.getSize().height : 0;
          textureInfo.format = texture.format;
          textureInfo.samplingMode = texture.samplingMode;
        }

        return textureInfo;
      });

      return {
        total: textures.length,
        textures: detailed ? textureSummary : textureSummary.slice(0, 5)
      };

    } catch (error) {
      console.warn('纹理分析失败:', error);
      return null;
    }
  }

  /**
   * 分析灯光 (参考翠鸟SDK文档)
   */
  analyzeLights(scene, detailed = false) {
    if (!scene) return null;

    try {
      let lights = [];

      // 获取灯光列表
      if (scene.lights) {
        lights = scene.lights;
      }

      const lightSummary = lights.map(light => {
        const lightInfo = {
          id: light.id,
          name: light.name,
          type: light.getClassName ? light.getClassName() : 'Unknown',
          isEnabled: light.isEnabled !== false,
          intensity: light.intensity || 0
        };

        if (detailed) {
          lightInfo.position = light.position ? [light.position.x, light.position.y, light.position.z] : null;
          lightInfo.direction = light.direction ? [light.direction.x, light.direction.y, light.direction.z] : null;
          lightInfo.diffuse = light.diffuse ? [light.diffuse.r, light.diffuse.g, light.diffuse.b] : null;
          lightInfo.range = light.range || 0;
        }

        return lightInfo;
      });

      return {
        total: lights.length,
        enabled: lights.filter(light => light.isEnabled !== false).length,
        lights: detailed ? lightSummary : lightSummary.slice(0, 5)
      };

    } catch (error) {
      console.warn('灯光分析失败:', error);
      return null;
    }
  }

  /**
   * 分析动画 (参考翠鸟SDK文档)
   */
  analyzeAnimations(scene, detailed = false) {
    if (!scene) return null;

    try {
      let animations = [];

      // 获取动画列表
      if (scene.animationGroups) {
        animations = scene.animationGroups;
      }

      const animationSummary = animations.map(anim => {
        const animInfo = {
          id: anim.id,
          name: anim.name,
          isPlaying: anim.isPlaying || false,
          isPaused: anim.isPaused || false
        };

        if (detailed) {
          animInfo.from = anim.from;
          animInfo.to = anim.to;
          animInfo.length = anim.to - anim.from;
          animInfo.targetedAnimations = anim.targetedAnimations ? anim.targetedAnimations.length : 0;
        }

        return animInfo;
      });

      return {
        total: animations.length,
        playing: animations.filter(anim => anim.isPlaying).length,
        animations: detailed ? animationSummary : animationSummary.slice(0, 5)
      };

    } catch (error) {
      console.warn('动画分析失败:', error);
      return null;
    }
  }

  /**
   * 获取全局对象数据
   */
  fetchGlobalData() {
    console.log('🌍 [fetchGlobalData] 开始获取全局对象数据');

    const globalData = {
      timestamp: Date.now(),
      hasKfAPI: false,
      data: null,
      error: null
    };

    try {
      // 检查是否存在 window.Kf.fetchGlobalData 方法
      if (typeof window !== 'undefined' &&
          window.Kf &&
          typeof window.Kf.fetchGlobalData === 'function') {

        console.log('✅ [fetchGlobalData] 找到 window.Kf.fetchGlobalData 方法');
        globalData.hasKfAPI = true;

        try {
          // 调用 window.Kf.fetchGlobalData 方法
          const result = window.Kf.fetchGlobalData();
          console.log('✅ [fetchGlobalData] 成功调用 window.Kf.fetchGlobalData');

          // 序列化结果，避免循环引用
          globalData.data = this.serializeScriptResult(result);

          console.log('📊 [fetchGlobalData] 全局数据获取完成，数据类型:', typeof result);
        } catch (apiError) {
          console.error('❌ [fetchGlobalData] 调用 window.Kf.fetchGlobalData 失败:', apiError);
          globalData.error = `调用失败: ${apiError.message}`;
        }
      } else {
        console.log('⚠️ [fetchGlobalData] window.Kf.fetchGlobalData 方法不存在');
        globalData.hasKfAPI = false;
        globalData.error = 'window.Kf.fetchGlobalData 方法不可用';
      }
    } catch (error) {
      console.error('❌ [fetchGlobalData] 获取全局数据时发生错误:', error);
      globalData.error = `获取失败: ${error.message}`;
    }

    console.log('🏁 [fetchGlobalData] 全局数据获取完成:', globalData);
    return globalData;
  }

  /**
   * 生成优化建议
   */
  generateOptimizationSuggestions(components) {
    // 这里可以根据组件分析结果生成优化建议
    const suggestions = [];

    if (components.performance) {
      const perf = components.performance;
      if (perf.fps < 30) {
        suggestions.push('帧率较低，建议优化渲染性能');
      }
      if (perf.triangles > 100000) {
        suggestions.push('三角形数量过多，建议使用LOD或简化模型');
      }
    }

    if (components.meshes) {
      if (components.meshes.total > 1000) {
        suggestions.push('网格数量过多，建议合并网格或使用实例化');
      }
    }

    return suggestions;
  }

  /**
   * 销毁检查器
   */
  destroy() {
    this.stopAutoAnalysis();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.clientId = null;
    console.log('🗑️ 翠鸟引擎场景检查器已销毁');
  }
}

// 导出给浏览器使用
if (typeof window !== 'undefined') {
  window.KingfisherSceneInspector = KingfisherSceneInspector;
}

// 导出给Node.js使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KingfisherSceneInspector;
}
