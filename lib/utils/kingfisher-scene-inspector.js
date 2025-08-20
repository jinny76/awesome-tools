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
        capabilities: ['scene_analysis', 'object_inspection', 'optimization', 'kingfisher_api', 'kpath_queries', 'custom_scripts'],
        atomicCapabilities: this.getAtomicCapabilities()
      }
    });
  }

  /**
   * 获取原子操作能力清单
   */
  getAtomicCapabilities() {
    return {
      // 对象操作能力
      objectOperations: {
        hide_objects: {
          description: '隐藏场景对象',
          parameters: ['objectIds'],
          supportedTargets: ['mesh', 'node', 'transformNode', 'light'],
          methods: ['setEnabled', 'isVisible', 'visible'],
          supportsKPath: true,
          supportsKeywordSearch: true
        },
        show_objects: {
          description: '显示场景对象',
          parameters: ['objectIds'],
          supportedTargets: ['mesh', 'node', 'transformNode', 'light'],
          methods: ['setEnabled', 'isVisible', 'visible'],
          supportsKPath: true,
          supportsKeywordSearch: true
        },
        remove_objects: {
          description: '删除场景对象',
          parameters: ['objectIds'],
          supportedTargets: ['mesh', 'node', 'transformNode'],
          methods: ['dispose', 'setEnabled', 'isVisible'],
          supportsKPath: true,
          supportsKeywordSearch: true,
          destructive: true
        }
      },

      // 变换操作能力
      transformOperations: {
        translate_object: {
          description: '平移对象',
          parameters: ['objectId', 'vector', 'space'],
          supportedSpaces: ['LOCAL', 'WORLD'],
          supportedTargets: ['mesh', 'node', 'transformNode'],
          methods: ['translateObject', 'translate', 'position'],
          requiresVector3: true
        },
        rotate_object: {
          description: '旋转对象',
          parameters: ['objectId', 'axis', 'angle', 'space'],
          supportedSpaces: ['LOCAL', 'WORLD'],
          supportedTargets: ['mesh', 'node', 'transformNode'],
          methods: ['rotateObject', 'rotate', 'rotation'],
          requiresVector3: true,
          angleUnit: 'degrees'
        },
        scale_object: {
          description: '缩放对象',
          parameters: ['objectId', 'vector'],
          supportedTargets: ['mesh', 'node', 'transformNode'],
          methods: ['scaleObject', 'scaling'],
          requiresVector3: true
        }
      },

      // 摄像头操作能力
      cameraOperations: {
        set_active_camera: {
          description: '切换激活机位',
          parameters: ['cameraName', 'duration'],
          supportedTargets: ['camera'],
          methods: ['setActiveCameraArg', 'activeCamera'],
          supportsAnimation: true
        },
        focus_camera: {
          description: '聚焦摄像头到对象',
          parameters: ['objectId', 'duration'],
          supportedTargets: ['any'],
          methods: ['focusCameraOnObject', 'setTarget'],
          supportsAnimation: true
        }
      },

      // 视觉效果操作能力
      visualEffectOperations: {
        set_highlight: {
          description: '设置对象高亮',
          parameters: ['objectIds', 'color'],
          supportedTargets: ['mesh', 'node'],
          methods: ['setNodeHighlight', 'HighlightLayer'],
          supportedColors: ['hex', 'rgb'],
          supportsMultipleObjects: true
        },
        clear_highlight: {
          description: '清空所有高亮',
          parameters: [],
          methods: ['clearHighlight', 'removeAllMeshes']
        }
      },

      // 材质操作能力
      materialOperations: {
        set_material_color: {
          description: '设置材质颜色',
          parameters: ['materialName', 'color'],
          supportedTargets: ['material'],
          methods: ['setMaterialColor', 'diffuseColor', 'emissiveColor'],
          supportedColors: ['hex', 'rgb']
        }
      },

      // 查询能力
      queryCapabilities: {
        kpath_query: {
          description: '翠鸟KPath路径查询',
          supportedSyntax: [
            '/[#root] - 根节点',
            '/TransformNode[#root] - 类型根节点',
            '/[#root]/Mesh - 子节点',
            '/TransformNode[@name="名称"] - 属性查询',
            '/Mesh[~序号~2] - 序号查询',
            '/Light[%关键字%] - 关键字查询'
          ],
          returnTypes: ['single', 'array']
        },
        scene_analysis: {
          description: '场景分析',
          supportedComponents: ['basic', 'nodes', 'materials', 'cameras', 'performance'],
          returnTypes: ['summary', 'detailed']
        }
      },

      // 引擎特定能力
      engineSpecificCapabilities: {
        kingfisher_sdk: {
          description: '翠鸟引擎SDK集成',
          availableAPIs: this.checkKingfisherAPIs(),
          puzzleSupport: !!window.puzzle,
          babylonSupport: !!window.BABYLON,
          sceneSupport: !!window.scene
        },
        custom_scripts: {
          description: '自定义脚本执行',
          maxScriptLength: 10000,
          allowedAPIs: ['inspector', 'kingfisher', 'Math', 'console'],
          securityLevel: 'sandboxed',
          supportedLanguage: 'javascript',
          features: [
            '场景查询和分析',
            '节点操作和变换',
            '材质和摄像头控制',
            '安全的API访问',
            '结果序列化和返回'
          ]
        }
      },

      // 性能和限制
      performance: {
        maxConcurrentOperations: 10,
        maxBatchSize: 50,
        supportsUndo: true,
        supportsHistory: true,
        atomicExecution: true
      }
    };
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
        
      case 'optimization_command':
        this.handleOptimizationCommand(message.command);
        break;
        
      case 'query_command':
        this.handleQueryCommand(message.command);
        break;
        
      case 'query_capabilities':
        this.handleCapabilitiesQuery(message);
        break;
        
      case 'inspect_command':
        this.handleInspectCommand(message);
        break;
        
      case 'scene_inspect_request':
        this.handleSceneInspectRequest(message);
        break;
        
      case 'atomic_operation':
        this.handleAtomicOperation(message);
        break;
        
      case 'atomic_sequence':
        this.handleAtomicSequence(message);
        break;
        
      case 'atomic_revert':
        this.handleAtomicRevert(message);
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
        
      default:
        console.log('📦 未处理的消息类型:', message.type);
    }
  }
  
  /**
   * 处理优化命令
   */
  handleOptimizationCommand(command) {
    console.log('⚡ 执行优化命令:', command.action);
    console.log('📦 [handleOptimizationCommand] 完整命令内容:', JSON.stringify(command, null, 2));
    
    switch (command.action) {
      case 'reduce_quality':
        console.log('🎨 [handleOptimizationCommand] 调用 reduceQuality, level:', command.level || 1);
        this.reduceQuality(command.level || 1);
        break;
        
      case 'hide_objects':
        console.log('👁️ [handleOptimizationCommand] 调用 hideObjects, objects:', command.objects || []);
        const hideResult = this.hideObjects(command.objects || []);
        console.log('📊 [handleOptimizationCommand] hideObjects 返回结果:', hideResult);
        break;
        
      case 'show_objects':
        console.log('👁️ [handleOptimizationCommand] 调用 showObjects, objects:', command.objects || []);
        const showResult = this.showObjects(command.objects || []);
        console.log('📊 [handleOptimizationCommand] showObjects 返回结果:', showResult);
        break;
        
      case 'remove_objects':
        this.removeObjects(command.objects || []);
        break;
        
      case 'optimize_materials':
        this.optimizeMaterials();
        break;
        
      case 'set_lod':
        this.setLOD(command.distance || 100);
        break;
        
      default:
        console.warn('❓ 未知优化命令:', command.action);
    }
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
    
    // 基础信息
    if (components.includes('basic') || components.includes('all')) {
      const scene = window.scene;
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
      result.components.performance = this.analyzePerformance(window.scene);
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
    
    // 优化建议
    if (components.includes('suggestions') || components.includes('all')) {
      result.components.suggestions = this.generateOptimizationSuggestions(result.components);
    }
    
    console.log(`🎯 检查完成，包含组件: ${Object.keys(result.components).join(', ')}`);
    return result;
  }

  // ==================== 原子操作处理 ====================

  /**
   * 处理原子操作
   */
  handleAtomicOperation(message) {
    console.log('⚛️ 执行原子操作:', message.operation.type);
    
    if (!this.atomicExecutor) {
      this.initializeAtomicExecutor();
    }
    
    const { operation } = message;
    
    this.atomicExecutor.executeOperation(operation)
      .then(result => {
        console.log('✅ 原子操作执行成功:', result);
        this.sendMessage({
          type: 'atomic_operation_result',
          operationId: operation.id,
          success: true,
          result: result,
          timestamp: Date.now()
        });
      })
      .catch(error => {
        console.error('❌ 原子操作执行失败:', error);
        this.sendMessage({
          type: 'atomic_operation_result',
          operationId: operation.id,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
      });
  }

  /**
   * 处理原子操作序列
   */
  handleAtomicSequence(message) {
    console.log('🔗 执行原子操作序列:', message.sequence.name);
    
    if (!this.atomicExecutor) {
      this.initializeAtomicExecutor();
    }
    
    const { sequence, options = {} } = message;
    
    this.atomicExecutor.executeSequence(sequence, options)
      .then(results => {
        console.log('✅ 操作序列执行完成:', results.length);
        
        const summary = sequence.getStatusSummary();
        this.sendMessage({
          type: 'atomic_sequence_result',
          sequenceId: sequence.id,
          success: true,
          summary: summary,
          results: results,
          timestamp: Date.now()
        });
      })
      .catch(error => {
        console.error('❌ 操作序列执行失败:', error);
        this.sendMessage({
          type: 'atomic_sequence_result',
          sequenceId: sequence.id,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
      });
  }

  /**
   * 处理原子操作回滚
   */
  handleAtomicRevert(message) {
    console.log('↩️ 回滚原子操作:', message.operationId);
    
    if (!this.atomicExecutor) {
      this.initializeAtomicExecutor();
    }
    
    const { operationId } = message;
    
    // 在历史记录中查找操作
    const operation = this.atomicExecutor.getHistory().find(op => op.id === operationId);
    
    if (!operation) {
      console.error('❌ 未找到要回滚的操作:', operationId);
      this.sendMessage({
        type: 'atomic_revert_result',
        operationId: operationId,
        success: false,
        error: '未找到指定的操作',
        timestamp: Date.now()
      });
      return;
    }
    
    this.atomicExecutor.revertOperation(operation)
      .then(result => {
        console.log('✅ 操作回滚成功:', result);
        this.sendMessage({
          type: 'atomic_revert_result',
          operationId: operationId,
          success: true,
          result: result,
          timestamp: Date.now()
        });
      })
      .catch(error => {
        console.error('❌ 操作回滚失败:', error);
        this.sendMessage({
          type: 'atomic_revert_result',
          operationId: operationId,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
      });
  }

  /**
   * 初始化原子操作执行器
   */
  initializeAtomicExecutor() {
    // 动态加载原子操作模块
    if (typeof window !== 'undefined' && window.AtomicOperations) {
      const { AtomicOperationExecutor } = window.AtomicOperations;
      this.atomicExecutor = new AtomicOperationExecutor(this);
      console.log('📦 原子操作执行器已初始化');
    } else {
      console.warn('⚠️ 原子操作模块未加载');
    }
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
          if (typeof val === 'object' && Object.keys(val).length > 100) {
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
   * 降低渲染质量
   */
  reduceQuality(level = 1) {
    console.log(`🎨 [reduceQuality] 降低渲染质量到级别: ${level}`);
    
    if (!window.scene) {
      console.error('❌ [reduceQuality] scene对象不存在');
      return { error: 'scene对象不存在' };
    }
    
    const results = [];
    
    try {
      // 降低分辨率
      if (window.scene.getEngine) {
        const engine = window.scene.getEngine();
        if (engine) {
          // 设置硬件缩放级别
          const scalingLevel = 1 + (level * 0.5); // level 1 = 1.5x scaling
          if (typeof engine.setHardwareScalingLevel === 'function') {
            engine.setHardwareScalingLevel(scalingLevel);
            results.push(`设置硬件缩放级别: ${scalingLevel}`);
          }
          
          // 降低纹理质量
          if (level >= 2) {
            scene.textures?.forEach(texture => {
              if (texture.updateSamplingMode) {
                texture.updateSamplingMode(1); // NEAREST sampling
                results.push(`降低纹理采样质量: ${texture.name}`);
              }
            });
          }
          
          // 关闭抗锯齿
          if (level >= 3) {
            scene.postProcessRenderPipelineManager?.pipelines?.forEach(pipeline => {
              if (pipeline.samples) {
                pipeline.samples = 1;
                results.push(`关闭抗锯齿: ${pipeline.name}`);
              }
            });
          }
        }
      }
      
      console.log('✅ [reduceQuality] 质量降低完成:', results);
      return { success: true, actions: results };
      
    } catch (error) {
      console.error('❌ [reduceQuality] 降低质量失败:', error);
      return { error: error.message, actions: results };
    }
  }

  /**
   * 优化材质
   */
  optimizeMaterials() {
    console.log('🎨 [optimizeMaterials] 开始优化材质');
    
    if (!window.scene) {
      console.error('❌ [optimizeMaterials] scene对象不存在');
      return { error: 'scene对象不存在' };
    }
    
    const results = [];
    
    try {
      // 获取所有材质
      const materials = window.scene.materials || [];
      
      materials.forEach(material => {
        try {
          // 简化材质
          if (material.specularColor) {
            material.specularColor.r *= 0.5;
            material.specularColor.g *= 0.5;
            material.specularColor.b *= 0.5;
            results.push(`降低镜面反射: ${material.name}`);
          }
          
          // 关闭不必要的功能
          if (material.bumpTexture && material.disableBumpMap) {
            material.disableBumpMap = true;
            results.push(`禁用凹凸贴图: ${material.name}`);
          }
          
          // 降低透明度计算
          if (material.transparencyMode !== undefined) {
            material.transparencyMode = 0; // OPAQUE
            results.push(`简化透明度: ${material.name}`);
          }
          
        } catch (error) {
          console.warn(`优化材质失败: ${material.name}`, error);
        }
      });
      
      console.log('✅ [optimizeMaterials] 材质优化完成:', results);
      return { success: true, actions: results };
      
    } catch (error) {
      console.error('❌ [optimizeMaterials] 优化材质失败:', error);
      return { error: error.message, actions: results };
    }
  }

  /**
   * 设置LOD (细节层次)
   */
  setLOD(distance = 100) {
    console.log(`🔧 [setLOD] 设置LOD距离: ${distance}`);
    
    if (!window.scene) {
      console.error('❌ [setLOD] scene对象不存在');
      return { error: 'scene对象不存在' };
    }
    
    const results = [];
    
    try {
      // 获取所有网格
      const meshes = window.scene.meshes || [];
      
      meshes.forEach(mesh => {
        try {
          // 设置简化的可见性距离
          if (mesh.visibility !== undefined) {
            const distanceFromCamera = this.getDistanceFromCamera(mesh);
            if (distanceFromCamera > distance) {
              mesh.visibility = 0.5; // 半透明
              results.push(`降低远距离网格可见性: ${mesh.name}`);
            }
          }
          
          // 如果支持LOD，添加LOD级别
          if (mesh.addLODLevel) {
            mesh.addLODLevel(distance * 2, null); // 距离2倍时隐藏
            results.push(`添加LOD级别: ${mesh.name}`);
          }
          
        } catch (error) {
          console.warn(`设置LOD失败: ${mesh.name}`, error);
        }
      });
      
      console.log('✅ [setLOD] LOD设置完成:', results);
      return { success: true, actions: results };
      
    } catch (error) {
      console.error('❌ [setLOD] 设置LOD失败:', error);
      return { error: error.message, actions: results };
    }
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
    // 创建一个安全的、不包含循环引用的摘要
    const safeSummary = {
      sceneId: analysis.sceneId,
      engine: 'kingfisher',
      timestamp: analysis.timestamp,
      performance: analysis.performance,
      hasErrors: !!analysis.error
    };
    
    this.sendMessage({
      type: 'scene_info',
      timestamp: Date.now(),
      data: {
        sceneId: analysis.sceneId,
        engine: 'kingfisher',
        summary: safeSummary,
        url: window.location.href
      }
    });
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
        console.error('❌ 发送消息失败:', error);
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
   * 停止自动分析
   */
  stopAutoAnalysis() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }
  
  /**
   * 监听场景变化
   */
  watchSceneChanges() {
    let lastSceneId = null;
    
    const checkScene = () => {
      if (window.scene) {
        const currentSceneId = window.scene.id || window.scene.name || 'kingfisher_scene';
        if (currentSceneId !== lastSceneId) {
          lastSceneId = currentSceneId;
          console.log('🔄 检测到翠鸟场景变化:', currentSceneId);
          setTimeout(() => this.analyzeAndReport(), 1000);
        }
      }
    };
    
    setInterval(checkScene, 2000);
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
          
          // 设备类型识别和分类
          meshInfo.deviceType = this.classifyDeviceType(mesh.name);
          meshInfo.deviceCategory = this.getDeviceCategory(meshInfo.deviceType);
          
          // 获取自定义属性（如果存在）
          if (mesh.metadata) {
            meshInfo.metadata = mesh.metadata;
          }
          
          // 获取翠鸟特定属性
          if (mesh.userData) {
            meshInfo.userData = mesh.userData;
          }
          
          // 设备描述
          meshInfo.deviceDescription = this.getDeviceDescription(mesh.name, meshInfo.deviceType);
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
   * 设备类型分类
   */
  classifyDeviceType(meshName) {
    if (!meshName) return 'unknown';
    
    const name = meshName.toLowerCase();
    
    // 工业设备
    if (name.includes('贴片机') || name.includes('smt') || name.includes('pick') || name.includes('place')) {
      return 'smt_machine';
    }
    if (name.includes('pipeline') || name.includes('管道')) {
      return 'pipeline';
    }
    if (name.includes('pump') || name.includes('泵')) {
      return 'pump';
    }
    if (name.includes('valve') || name.includes('阀门')) {
      return 'valve';
    }
    if (name.includes('tank') || name.includes('罐体') || name.includes('容器')) {
      return 'tank';
    }
    if (name.includes('conveyor') || name.includes('传送带') || name.includes('输送')) {
      return 'conveyor';
    }
    if (name.includes('robot') || name.includes('机器人') || name.includes('arm')) {
      return 'robot';
    }
    
    // 标识和标记
    if (name.includes('marker') || name.includes('标记')) {
      return 'marker';
    }
    if (name.includes('area') && name.includes('point')) {
      return 'area_marker';
    }
    if (name.includes('line') && (name.includes('final') || name.includes('连接'))) {
      return 'connection_line';
    }
    
    // 基础设施
    if (name.includes('ground') || name.includes('地面')) {
      return 'ground';
    }
    if (name.includes('grid') || name.includes('网格')) {
      return 'grid';
    }
    if (name.includes('wall') || name.includes('墙')) {
      return 'wall';
    }
    if (name.includes('building') || name.includes('建筑')) {
      return 'building';
    }
    
    // 界面元素
    if (name.includes('select') || name.includes('box')) {
      return 'ui_element';
    }
    if (name.includes('rect') || name.includes('mouse')) {
      return 'ui_element';
    }
    
    // 照明设备
    if (name.includes('light') || name.includes('灯') || name.includes('照明')) {
      return 'lighting';
    }
    
    return 'unknown';
  }
  
  /**
   * 获取设备类别
   */
  getDeviceCategory(deviceType) {
    const categories = {
      'smt_machine': 'production_equipment',
      'pipeline': 'piping_system', 
      'pump': 'fluid_equipment',
      'valve': 'fluid_equipment',
      'tank': 'storage_equipment',
      'conveyor': 'transport_equipment',
      'robot': 'automation_equipment',
      'marker': 'identification',
      'area_marker': 'identification',
      'connection_line': 'connection',
      'ground': 'infrastructure',
      'grid': 'infrastructure',
      'wall': 'infrastructure', 
      'building': 'infrastructure',
      'ui_element': 'interface',
      'lighting': 'lighting_system',
      'unknown': 'unclassified'
    };
    
    return categories[deviceType] || 'unclassified';
  }
  
  /**
   * 获取设备描述
   */
  getDeviceDescription(meshName, deviceType) {
    const descriptions = {
      'smt_machine': '贴片机 - 用于电子元件自动贴装的精密设备',
      'pipeline': '管道 - 流体输送系统的组成部分',
      'pump': '泵 - 用于流体输送的动力设备',
      'valve': '阀门 - 用于控制流体流量和方向',
      'tank': '储罐 - 用于存储液体或气体的容器',
      'conveyor': '传送带 - 用于物料输送的设备',
      'robot': '机器人 - 自动化操作设备',
      'marker': '标记 - 用于标识位置或区域',
      'area_marker': '区域标记 - 标识特定区域的标记点',
      'connection_line': '连接线 - 显示设备间连接关系',
      'ground': '地面 - 场景基础地面',
      'grid': '网格 - 辅助显示的网格系统',
      'wall': '墙体 - 建筑结构',
      'building': '建筑 - 建筑物结构',
      'ui_element': '界面元素 - 用户交互界面组件',
      'lighting': '照明设备 - 提供照明的设备',
      'unknown': '未分类对象'
    };
    
    return descriptions[deviceType] || `${meshName} - 未分类的场景对象`;
  }

  /**
   * 生成优化建议
   */
  generateOptimizationSuggestions(components) {
    const suggestions = [];
    
    try {
      // 性能相关建议
      if (components.performance) {
        if (components.performance.fps < 30) {
          suggestions.push({
            type: 'performance',
            severity: 'high',
            title: '帧率过低',
            description: `当前FPS为${components.performance.fps}，建议优化渲染性能`,
            action: 'reduce_quality'
          });
        }
        
        if (components.performance.drawCalls > 100) {
          suggestions.push({
            type: 'performance',
            severity: 'medium',
            title: '绘制调用过多',
            description: `当前绘制调用${components.performance.drawCalls}次，建议合并网格`,
            action: 'optimize_meshes'
          });
        }
      }
      
      // 网格相关建议
      if (components.meshes) {
        if (components.meshes.summary && components.meshes.summary.totalVertices > 1000000) {
          suggestions.push({
            type: 'geometry',
            severity: 'medium',
            title: '顶点数过多',
            description: `场景包含${components.meshes.summary.totalVertices.toLocaleString()}个顶点，建议使用LOD`,
            action: 'set_lod'
          });
        }
        
        const hiddenMeshes = components.meshes.total - components.meshes.visible;
        if (hiddenMeshes > 10) {
          suggestions.push({
            type: 'cleanup',
            severity: 'low',
            title: '存在隐藏网格',
            description: `发现${hiddenMeshes}个隐藏网格，建议清理`,
            action: 'remove_hidden_objects'
          });
        }
      }
      
      // 材质相关建议
      if (components.materials && components.materials.length > 50) {
        suggestions.push({
          type: 'materials',
          severity: 'low',
          title: '材质数量较多',
          description: `场景包含${components.materials.length}个材质，建议合并相似材质`,
          action: 'optimize_materials'
        });
      }
      
      // 灯光相关建议
      if (components.lights && components.lights.total > 8) {
        suggestions.push({
          type: 'lighting',
          severity: 'medium',
          title: '灯光数量过多',
          description: `场景包含${components.lights.total}个灯光，建议减少实时光照`,
          action: 'optimize_lighting'
        });
      }
      
    } catch (error) {
      console.warn('生成优化建议失败:', error);
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