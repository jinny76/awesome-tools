/**
 * 动画服务器连接管理器
 * 处理WebSocket连接、消息协议、重连机制等
 */

class AnimationServerManager {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'ws://localhost:8080/animation',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      timeout: 10000,
      enableCompression: true,
      enableBinaryMessages: false,
      ...options
    };
    
    this.websocket = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.isDestroyed = false;
    this.heartbeatTimer = null;
    this.connectionTimer = null;
    
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.requestId = 0;
    
    this.callbacks = new Map();
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
    
    this.init();
  }

  /**
   * 初始化连接管理器
   */
  init() {
    console.log('[AnimationServer] 初始化动画服务器管理器');
    
    // 注册默认的消息处理器
    this.registerDefaultHandlers();
    
    // 如果提供了URL，立即尝试连接
    if (this.options.url) {
      this.connect();
    }
  }

  /**
   * 注册默认消息处理器
   */
  registerDefaultHandlers() {
    this.on('scene_optimize', (data) => {
      console.log('[AnimationServer] 收到场景优化指令:', data);
    });
    
    this.on('animation_update', (data) => {
      console.log('[AnimationServer] 收到动画更新:', data);
    });
    
    this.on('performance_target', (data) => {
      console.log('[AnimationServer] 收到性能目标:', data);
    });
  }

  /**
   * 连接到动画服务器
   */
  connect(url = null) {
    if (url) {
      this.options.url = url;
    }
    
    if (!this.options.url) {
      console.error('[AnimationServer] 缺少服务器URL');
      return Promise.reject(new Error('缺少服务器URL'));
    }
    
    if (this.isConnecting || this.connectionState === 'connected') {
      console.warn('[AnimationServer] 连接已存在或正在连接中');
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      console.log(`[AnimationServer] 连接到服务器: ${this.options.url}`);
      
      this.isConnecting = true;
      this.connectionState = 'connecting';
      this.emit('connection', { state: 'connecting', url: this.options.url });
      
      try {
        this.websocket = new WebSocket(this.options.url);
        
        // 连接超时处理
        this.connectionTimer = setTimeout(() => {
          if (this.websocket.readyState === WebSocket.CONNECTING) {
            this.websocket.close();
            reject(new Error('连接超时'));
          }
        }, this.options.timeout);
        
        this.websocket.onopen = () => {
          console.log('[AnimationServer] 连接成功');
          
          clearTimeout(this.connectionTimer);
          this.isConnecting = false;
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          
          // 启动心跳
          this.startHeartbeat();
          
          // 发送排队的消息
          this.sendQueuedMessages();
          
          // 发送连接信息
          this.sendMessage({
            type: 'client_info',
            data: {
              userAgent: navigator.userAgent,
              timestamp: Date.now(),
              clientType: '3d-scene-analyzer',
              version: '1.0.0'
            }
          });
          
          this.emit('connection', { state: 'connected', url: this.options.url });
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          this.handleMessage(event);
        };
        
        this.websocket.onerror = (error) => {
          console.error('[AnimationServer] WebSocket错误:', error);
          clearTimeout(this.connectionTimer);
          this.isConnecting = false;
          this.connectionState = 'error';
          this.emit('connection', { state: 'error', error });
          reject(error);
        };
        
        this.websocket.onclose = (event) => {
          console.log('[AnimationServer] 连接关闭:', event.code, event.reason);
          
          clearTimeout(this.connectionTimer);
          this.isConnecting = false;
          this.connectionState = 'disconnected';
          this.stopHeartbeat();
          
          this.emit('connection', { 
            state: 'disconnected', 
            code: event.code, 
            reason: event.reason 
          });
          
          // 自动重连
          if (!this.isDestroyed && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        console.error('[AnimationServer] 创建WebSocket失败:', error);
        this.isConnecting = false;
        this.connectionState = 'error';
        reject(error);
      }
    });
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(event) {
    try {
      let data;
      
      if (typeof event.data === 'string') {
        data = JSON.parse(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        // 处理二进制消息
        data = this.parseBinaryMessage(event.data);
      } else {
        console.warn('[AnimationServer] 未知消息格式:', typeof event.data);
        return;
      }
      
      console.log('[AnimationServer] 收到消息:', data);
      
      // 处理响应消息
      if (data.requestId && this.pendingRequests.has(data.requestId)) {
        const { resolve, reject } = this.pendingRequests.get(data.requestId);
        this.pendingRequests.delete(data.requestId);
        
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data);
        }
        return;
      }
      
      // 处理心跳响应
      if (data.type === 'pong') {
        return;
      }
      
      // 触发对应的事件处理器
      if (data.type) {
        this.emit(data.type, data.data || data);
      }
      
      // 触发通用消息事件
      this.emit('message', data);
      
    } catch (error) {
      console.error('[AnimationServer] 消息处理失败:', error);
      this.emit('error', { type: 'message_parse_error', error });
    }
  }

  /**
   * 解析二进制消息
   */
  parseBinaryMessage(buffer) {
    // 简单的二进制协议：前4字节为类型，后续为数据
    const view = new DataView(buffer);
    const type = view.getUint32(0, true);
    const data = buffer.slice(4);
    
    return {
      type: this.getBinaryMessageType(type),
      data: this.parseBinaryData(data, type)
    };
  }

  /**
   * 获取二进制消息类型
   */
  getBinaryMessageType(typeCode) {
    const types = {
      1: 'performance_data',
      2: 'scene_geometry',
      3: 'animation_keyframes',
      4: 'optimization_command'
    };
    return types[typeCode] || 'unknown';
  }

  /**
   * 解析二进制数据
   */
  parseBinaryData(buffer, type) {
    // 根据类型解析不同的二进制数据格式
    switch (type) {
      case 1: // performance_data
        return this.parsePerformanceData(buffer);
      case 2: // scene_geometry
        return this.parseSceneGeometry(buffer);
      default:
        return new Uint8Array(buffer);
    }
  }

  /**
   * 解析性能数据
   */
  parsePerformanceData(buffer) {
    const view = new DataView(buffer);
    let offset = 0;
    
    return {
      fps: view.getFloat32(offset, true), offset += 4,
      frameTime: view.getFloat32(offset, true), offset += 4,
      triangles: view.getUint32(offset, true), offset += 4,
      vertices: view.getUint32(offset, true), offset += 4,
      drawCalls: view.getUint32(offset, true), offset += 4,
      memoryUsage: view.getFloat64(offset, true)
    };
  }

  /**
   * 发送消息
   */
  sendMessage(message, options = {}) {
    if (!message) {
      console.warn('[AnimationServer] 尝试发送空消息');
      return Promise.reject(new Error('消息不能为空'));
    }
    
    // 如果连接未建立，加入队列
    if (this.connectionState !== 'connected') {
      if (options.queue !== false) {
        this.messageQueue.push({ message, options });
        console.log('[AnimationServer] 消息已加入队列:', message.type || 'unknown');
      }
      return Promise.reject(new Error('连接未建立'));
    }
    
    return new Promise((resolve, reject) => {
      try {
        // 生成请求ID（如果需要响应）
        if (options.expectResponse) {
          message.requestId = ++this.requestId;
          this.pendingRequests.set(message.requestId, { resolve, reject });
          
          // 设置请求超时
          setTimeout(() => {
            if (this.pendingRequests.has(message.requestId)) {
              this.pendingRequests.delete(message.requestId);
              reject(new Error('请求超时'));
            }
          }, options.timeout || this.options.timeout);
        }
        
        // 序列化消息
        let data;
        if (options.binary && this.options.enableBinaryMessages) {
          data = this.serializeBinaryMessage(message);
        } else {
          data = JSON.stringify(message);
        }
        
        // 发送消息
        this.websocket.send(data);
        console.log('[AnimationServer] 消息已发送:', message.type || 'unknown');
        
        if (!options.expectResponse) {
          resolve();
        }
        
      } catch (error) {
        console.error('[AnimationServer] 发送消息失败:', error);
        if (message.requestId) {
          this.pendingRequests.delete(message.requestId);
        }
        reject(error);
      }
    });
  }

  /**
   * 序列化二进制消息
   */
  serializeBinaryMessage(message) {
    // 简单的二进制序列化示例
    const jsonStr = JSON.stringify(message);
    const buffer = new ArrayBuffer(4 + jsonStr.length);
    const view = new DataView(buffer);
    
    // 写入长度
    view.setUint32(0, jsonStr.length, true);
    
    // 写入JSON数据
    const encoder = new TextEncoder();
    const jsonBytes = encoder.encode(jsonStr);
    new Uint8Array(buffer, 4).set(jsonBytes);
    
    return buffer;
  }

  /**
   * 发送排队的消息
   */
  sendQueuedMessages() {
    console.log(`[AnimationServer] 发送${this.messageQueue.length}条排队消息`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(({ message, options }) => {
      this.sendMessage(message, { ...options, queue: false }).catch(error => {
        console.error('[AnimationServer] 排队消息发送失败:', error);
      });
    });
  }

  /**
   * 安排重连
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );
    
    console.log(`[AnimationServer] ${delay}ms后尝试第${this.reconnectAttempts}次重连`);
    
    setTimeout(() => {
      if (!this.isDestroyed && this.connectionState !== 'connected') {
        this.connect().catch(error => {
          console.error('[AnimationServer] 重连失败:', error);
        });
      }
    }, delay);
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.sendMessage({ type: 'ping', timestamp: Date.now() }, { queue: false })
          .catch(error => {
            console.warn('[AnimationServer] 心跳发送失败:', error);
          });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 发送场景性能数据
   */
  sendPerformanceData(data) {
    return this.sendMessage({
      type: 'performance_update',
      timestamp: Date.now(),
      data
    });
  }

  /**
   * 发送场景分析结果
   */
  sendSceneAnalysis(analysis) {
    return this.sendMessage({
      type: 'scene_analysis',
      timestamp: Date.now(),
      data: analysis
    });
  }

  /**
   * 请求优化建议
   */
  requestOptimization(sceneData) {
    return this.sendMessage({
      type: 'optimization_request',
      timestamp: Date.now(),
      data: sceneData
    }, { expectResponse: true });
  }

  /**
   * 发送动画状态
   */
  sendAnimationState(animationData) {
    return this.sendMessage({
      type: 'animation_state',
      timestamp: Date.now(),
      data: animationData
    });
  }

  /**
   * 注册事件监听器
   */
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[AnimationServer] 事件回调执行失败 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionState() {
    return {
      state: this.connectionState,
      url: this.options.url,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * 断开连接
   */
  disconnect() {
    console.log('[AnimationServer] 主动断开连接');
    
    this.stopHeartbeat();
    
    if (this.websocket) {
      this.websocket.close(1000, '主动断开');
      this.websocket = null;
    }
    
    this.connectionState = 'disconnected';
    this.isConnecting = false;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    console.log('[AnimationServer] 销毁动画服务器管理器');
    
    this.isDestroyed = true;
    this.disconnect();
    
    // 清理定时器
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
    }
    
    // 清理待处理的请求
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('连接已销毁'));
    });
    this.pendingRequests.clear();
    
    // 清理事件监听器
    this.callbacks.clear();
    
    // 清理消息队列
    this.messageQueue = [];
  }
}

// 导出管理器类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimationServerManager;
} else if (typeof window !== 'undefined') {
  window.AnimationServerManager = AnimationServerManager;
}