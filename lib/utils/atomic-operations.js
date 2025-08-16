/**
 * 翠鸟引擎原子操作系统
 * 将复杂的场景优化分解为可独立执行、回滚的原子操作
 */

/**
 * 原子操作类型定义
 */
const OPERATION_TYPES = {
  // 对象操作
  HIDE_OBJECT: 'hide_object',
  SHOW_OBJECT: 'show_object', 
  REMOVE_OBJECT: 'remove_object',
  CREATE_OBJECT: 'create_object',
  
  // 变换操作
  TRANSLATE_OBJECT: 'translate_object',
  ROTATE_OBJECT: 'rotate_object',
  SCALE_OBJECT: 'scale_object',
  
  // 摄像头操作
  SET_CAMERA: 'set_camera',
  FOCUS_CAMERA: 'focus_camera',
  
  // 材质操作
  SET_MATERIAL_COLOR: 'set_material_color',
  SET_MATERIAL_PROPERTY: 'set_material_property',
  SWAP_MATERIAL: 'swap_material',
  
  // 视觉效果操作
  SET_HIGHLIGHT: 'set_highlight',
  CLEAR_HIGHLIGHT: 'clear_highlight',
  SET_WIREFRAME: 'set_wireframe',
  SET_OPACITY: 'set_opacity',
  
  // 性能优化操作
  SET_LOD_DISTANCE: 'set_lod_distance',
  ENABLE_INSTANCING: 'enable_instancing',
  BATCH_GEOMETRY: 'batch_geometry',
  COMPRESS_TEXTURE: 'compress_texture',
  
  // 光照操作
  SET_LIGHT_INTENSITY: 'set_light_intensity',
  SET_LIGHT_COLOR: 'set_light_color',
  TOGGLE_SHADOWS: 'toggle_shadows',
  
  // 渲染操作
  SET_RENDER_QUALITY: 'set_render_quality',
  TOGGLE_WIREFRAME: 'toggle_wireframe',
  SET_BACKGROUND: 'set_background'
};

/**
 * 操作状态
 */
const OPERATION_STATUS = {
  PENDING: 'pending',      // 等待执行
  EXECUTING: 'executing',  // 正在执行
  COMPLETED: 'completed',  // 执行完成
  FAILED: 'failed',        // 执行失败
  REVERTED: 'reverted'     // 已回滚
};

/**
 * 原子操作类
 */
class AtomicOperation {
  constructor(type, params, metadata = {}) {
    this.id = this.generateId();
    this.type = type;
    this.params = params;
    this.metadata = {
      timestamp: Date.now(),
      description: metadata.description || '',
      category: metadata.category || 'general',
      priority: metadata.priority || 1,
      ...metadata
    };
    this.status = OPERATION_STATUS.PENDING;
    this.result = null;
    this.error = null;
    this.revertData = null; // 用于回滚的数据
  }

  generateId() {
    return 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 设置操作状态
   */
  setStatus(status, result = null, error = null) {
    this.status = status;
    this.result = result;
    this.error = error;
    this.metadata.lastUpdated = Date.now();
  }

  /**
   * 设置回滚数据
   */
  setRevertData(data) {
    this.revertData = data;
  }

  /**
   * 获取操作摘要
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      description: this.metadata.description,
      timestamp: this.metadata.timestamp
    };
  }
}

/**
 * 操作序列类 - 管理一组相关的原子操作
 */
class OperationSequence {
  constructor(name, description = '') {
    this.id = this.generateId();
    this.name = name;
    this.description = description;
    this.operations = [];
    this.status = OPERATION_STATUS.PENDING;
    this.createdAt = Date.now();
    this.executedAt = null;
    this.completedAt = null;
  }

  generateId() {
    return 'seq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 添加原子操作
   */
  addOperation(operation) {
    if (!(operation instanceof AtomicOperation)) {
      throw new Error('必须是AtomicOperation实例');
    }
    this.operations.push(operation);
  }

  /**
   * 获取序列状态统计
   */
  getStatusSummary() {
    const summary = {
      total: this.operations.length,
      pending: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      reverted: 0
    };

    this.operations.forEach(op => {
      summary[op.status]++;
    });

    return summary;
  }

  /**
   * 检查序列是否完成
   */
  isCompleted() {
    return this.operations.every(op => 
      op.status === OPERATION_STATUS.COMPLETED || 
      op.status === OPERATION_STATUS.REVERTED
    );
  }

  /**
   * 检查序列是否失败
   */
  hasFailed() {
    return this.operations.some(op => op.status === OPERATION_STATUS.FAILED);
  }
}

/**
 * 场景优化策略生成器
 */
class OptimizationStrategy {
  
  /**
   * 生成性能优化操作序列
   */
  static generatePerformanceOptimization(sceneData, targetFPS = 60) {
    const sequence = new OperationSequence(
      'performance_optimization', 
      `性能优化 - 目标FPS: ${targetFPS}`
    );

    const currentFPS = sceneData.performance?.fps || 60;
    
    if (currentFPS < targetFPS) {
      // 逐步优化策略
      
      // 1. 降低渲染质量
      if (currentFPS < 30) {
        sequence.addOperation(new AtomicOperation(
          OPERATION_TYPES.SET_RENDER_QUALITY,
          { quality: 0.5 },
          { description: '降低渲染质量到50%', priority: 1 }
        ));
      }

      // 2. 启用LOD
      if (sceneData.basic?.nodeCount > 50) {
        sequence.addOperation(new AtomicOperation(
          OPERATION_TYPES.SET_LOD_DISTANCE,
          { distance: 100, levels: 3 },
          { description: '启用LOD系统', priority: 2 }
        ));
      }

      // 3. 隐藏不必要的对象
      if (sceneData.nodes) {
        const candidateNodes = sceneData.nodes
          .filter(node => node.name.includes('debug') || node.name.includes('helper'))
          .slice(0, 5); // 限制数量避免过度优化

        candidateNodes.forEach(node => {
          sequence.addOperation(new AtomicOperation(
            OPERATION_TYPES.HIDE_OBJECT,
            { objectId: node.id },
            { description: `隐藏调试对象: ${node.name}`, priority: 3 }
          ));
        });
      }

      // 4. 优化材质
      sequence.addOperation(new AtomicOperation(
        OPERATION_TYPES.BATCH_GEOMETRY,
        { mergeDistance: 0.1 },
        { description: '批处理几何体', priority: 4 }
      ));
    }

    return sequence;
  }

  /**
   * 生成视觉质量优化操作序列
   */
  static generateQualityOptimization(sceneData) {
    const sequence = new OperationSequence(
      'quality_optimization',
      '视觉质量优化'
    );

    // 1. 增强光照
    sequence.addOperation(new AtomicOperation(
      OPERATION_TYPES.TOGGLE_SHADOWS,
      { enabled: true, quality: 'high' },
      { description: '启用高质量阴影', priority: 1 }
    ));

    // 2. 优化材质
    if (sceneData.materials) {
      sceneData.materials.forEach(material => {
        if (material.type === 'StandardMaterial') {
          sequence.addOperation(new AtomicOperation(
            OPERATION_TYPES.SET_MATERIAL_PROPERTY,
            { 
              materialId: material.id, 
              property: 'roughness', 
              value: 0.3 
            },
            { description: `优化材质粗糙度: ${material.name}`, priority: 2 }
          ));
        }
      });
    }

    return sequence;
  }

  /**
   * 生成场景清理操作序列
   */
  static generateSceneCleanup(sceneData) {
    const sequence = new OperationSequence(
      'scene_cleanup',
      '场景清理优化'
    );

    if (sceneData.nodes) {
      // 隐藏调试对象
      const debugObjects = sceneData.nodes.filter(node => 
        node.name.includes('debug') || 
        node.name.includes('helper') || 
        node.name.includes('marker') ||
        node.name.includes('selectBox') ||
        node.name.includes('Rect')
      );

      debugObjects.forEach(node => {
        sequence.addOperation(new AtomicOperation(
          OPERATION_TYPES.HIDE_OBJECT,
          { objectId: node.id },
          { description: `清理调试对象: ${node.name}`, priority: 1 }
        ));
      });

      // 优化网格对象
      const gridObjects = sceneData.nodes.filter(node => 
        node.name.includes('grid') || node.name.includes('Grid')
      );

      gridObjects.forEach(node => {
        sequence.addOperation(new AtomicOperation(
          OPERATION_TYPES.SET_OPACITY,
          { objectId: node.id, opacity: 0.3 },
          { description: `降低网格透明度: ${node.name}`, priority: 2 }
        ));
      });
    }

    return sequence;
  }

  /**
   * 生成专注模式操作序列 - 突出特定对象
   */
  static generateFocusMode(sceneData, targetObjectIds) {
    const sequence = new OperationSequence(
      'focus_mode',
      '专注模式 - 突出重要对象'
    );

    if (sceneData.nodes && targetObjectIds.length > 0) {
      // 1. 降低其他对象的透明度
      sceneData.nodes
        .filter(node => !targetObjectIds.includes(node.id))
        .forEach(node => {
          sequence.addOperation(new AtomicOperation(
            OPERATION_TYPES.SET_OPACITY,
            { objectId: node.id, opacity: 0.2 },
            { description: `降低背景对象透明度: ${node.name}`, priority: 1 }
          ));
        });

      // 2. 高亮目标对象
      targetObjectIds.forEach(objectId => {
        sequence.addOperation(new AtomicOperation(
          OPERATION_TYPES.SET_HIGHLIGHT,
          { objectId: objectId, color: '#00ff00', intensity: 0.5 },
          { description: `高亮目标对象: ${objectId}`, priority: 2 }
        ));
      });

      // 3. 聚焦摄像头到第一个目标对象
      if (targetObjectIds.length > 0) {
        sequence.addOperation(new AtomicOperation(
          OPERATION_TYPES.FOCUS_CAMERA,
          { objectId: targetObjectIds[0], duration: 2 },
          { description: '摄像头聚焦到目标对象', priority: 3 }
        ));
      }
    }

    return sequence;
  }
}

/**
 * 原子操作执行器
 */
class AtomicOperationExecutor {
  constructor(sceneInspector) {
    this.sceneInspector = sceneInspector;
    this.operationHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 执行单个原子操作
   */
  async executeOperation(operation) {
    if (!(operation instanceof AtomicOperation)) {
      throw new Error('必须是AtomicOperation实例');
    }

    operation.setStatus(OPERATION_STATUS.EXECUTING);

    try {
      let result;
      const { type, params } = operation;

      // 保存当前状态用于回滚
      const revertData = await this.captureRevertData(type, params);
      operation.setRevertData(revertData);

      // 根据操作类型执行相应的方法
      switch (type) {
        case OPERATION_TYPES.HIDE_OBJECT:
          result = this.sceneInspector.hideObjects([params.objectId]);
          break;

        case OPERATION_TYPES.SHOW_OBJECT:
          result = this.sceneInspector.showObjects([params.objectId]);
          break;

        case OPERATION_TYPES.REMOVE_OBJECT:
          result = this.sceneInspector.removeObjects([params.objectId]);
          break;

        case OPERATION_TYPES.SET_CAMERA:
          result = this.sceneInspector.setActiveCameraArg(params.cameraName, params.duration);
          break;

        case OPERATION_TYPES.FOCUS_CAMERA:
          result = this.sceneInspector.focusCameraOnObject(params.objectId, params.duration);
          break;

        case OPERATION_TYPES.SET_HIGHLIGHT:
          result = this.sceneInspector.setNodeHighlight([params.objectId], params.color);
          break;

        case OPERATION_TYPES.CLEAR_HIGHLIGHT:
          result = this.sceneInspector.clearHighlight();
          break;

        case OPERATION_TYPES.TRANSLATE_OBJECT:
          result = this.sceneInspector.translateObject(params.objectId, params.vector, params.space);
          break;

        case OPERATION_TYPES.ROTATE_OBJECT:
          result = this.sceneInspector.rotateObject(params.objectId, params.axis, params.angle, params.space);
          break;

        case OPERATION_TYPES.SCALE_OBJECT:
          result = this.sceneInspector.scaleObject(params.objectId, params.vector);
          break;

        case OPERATION_TYPES.SET_MATERIAL_COLOR:
          result = this.sceneInspector.setMaterialColor(params.materialName, params.color);
          break;

        // 其他操作类型...
        default:
          throw new Error(`不支持的操作类型: ${type}`);
      }

      operation.setStatus(OPERATION_STATUS.COMPLETED, result);
      this.addToHistory(operation);
      
      return result;

    } catch (error) {
      operation.setStatus(OPERATION_STATUS.FAILED, null, error.message);
      throw error;
    }
  }

  /**
   * 执行操作序列
   */
  async executeSequence(sequence, options = {}) {
    const { stopOnError = false, parallel = false } = options;
    
    sequence.executedAt = Date.now();
    const results = [];

    if (parallel) {
      // 并行执行
      const promises = sequence.operations.map(op => this.executeOperation(op));
      try {
        const parallelResults = await Promise.allSettled(promises);
        parallelResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            sequence.operations[index].setStatus(OPERATION_STATUS.FAILED, null, result.reason);
          }
        });
      } catch (error) {
        console.error('并行执行失败:', error);
      }
    } else {
      // 串行执行
      for (const operation of sequence.operations) {
        try {
          const result = await this.executeOperation(operation);
          results.push(result);
        } catch (error) {
          console.error(`操作执行失败: ${operation.id}`, error);
          if (stopOnError) {
            break;
          }
        }
      }
    }

    sequence.completedAt = Date.now();
    return results;
  }

  /**
   * 回滚操作
   */
  async revertOperation(operation) {
    if (!operation.revertData) {
      throw new Error('没有回滚数据');
    }

    // 根据操作类型执行回滚
    const revertOp = this.createRevertOperation(operation);
    const result = await this.executeOperation(revertOp);
    
    operation.setStatus(OPERATION_STATUS.REVERTED);
    return result;
  }

  /**
   * 创建回滚操作
   */
  createRevertOperation(originalOperation) {
    const { type, revertData } = originalOperation;
    
    let revertType, revertParams;

    switch (type) {
      case OPERATION_TYPES.HIDE_OBJECT:
        revertType = OPERATION_TYPES.SHOW_OBJECT;
        revertParams = { objectId: originalOperation.params.objectId };
        break;

      case OPERATION_TYPES.SHOW_OBJECT:
        revertType = OPERATION_TYPES.HIDE_OBJECT;
        revertParams = { objectId: originalOperation.params.objectId };
        break;

      case OPERATION_TYPES.SET_CAMERA:
        revertType = OPERATION_TYPES.SET_CAMERA;
        revertParams = { 
          cameraName: revertData.previousCamera,
          duration: 1
        };
        break;

      // 其他回滚逻辑...
      default:
        throw new Error(`不支持回滚的操作类型: ${type}`);
    }

    return new AtomicOperation(revertType, revertParams, {
      description: `回滚操作: ${originalOperation.metadata.description}`,
      isRevert: true
    });
  }

  /**
   * 捕获回滚数据
   */
  async captureRevertData(operationType, params) {
    // 根据操作类型捕获相应的状态
    switch (operationType) {
      case OPERATION_TYPES.SET_CAMERA:
        return {
          previousCamera: this.sceneInspector.getCurrentCamera?.()
        };
      
      case OPERATION_TYPES.HIDE_OBJECT:
      case OPERATION_TYPES.SHOW_OBJECT:
        const node = this.sceneInspector.getNodeByID(params.objectId);
        return {
          previousVisibility: node?.isVisible
        };

      default:
        return {};
    }
  }

  /**
   * 添加到历史记录
   */
  addToHistory(operation) {
    this.operationHistory.unshift(operation);
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.pop();
    }
  }

  /**
   * 获取操作历史
   */
  getHistory(limit = 20) {
    return this.operationHistory.slice(0, limit);
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OPERATION_TYPES,
    OPERATION_STATUS,
    AtomicOperation,
    OperationSequence,
    OptimizationStrategy,
    AtomicOperationExecutor
  };
}

// 浏览器环境
if (typeof window !== 'undefined') {
  window.AtomicOperations = {
    OPERATION_TYPES,
    OPERATION_STATUS,
    AtomicOperation,
    OperationSequence,
    OptimizationStrategy,
    AtomicOperationExecutor
  };
}