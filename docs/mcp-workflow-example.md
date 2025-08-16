# MCP 工作流程示例

## 架构说明

```
用户请求 → MCP工具 → 智能分解 → 原子操作 → 场景执行
```

## 核心 MCP 工具

### 1. query_atomic_capabilities
查询翠鸟场景检查器支持的所有原子操作能力

### 2. intelligent_task_decomposition  
将自然语言请求智能分解为原子操作序列

### 3. scene_optimization_strategy
执行预定义的优化策略

## 工作流程示例

### 示例1：优化场景性能
用户请求："我想优化场景性能"

MCP 调用：
```javascript
intelligent_task_decomposition({
  userRequest: "优化场景性能",
  context: {
    currentFPS: 45,
    targetFPS: 60
  }
})
```

自动生成的原子操作序列：
1. SET_RENDER_QUALITY - 降低渲染质量
2. SET_LOD_DISTANCE - 启用LOD系统
3. HIDE_OBJECT - 隐藏调试对象
4. BATCH_GEOMETRY - 批处理几何体

### 示例2：突出显示特定对象
用户请求："隐藏贴片机周围的其他设备，让贴片机更突出"

MCP 调用：
```javascript
intelligent_task_decomposition({
  userRequest: "隐藏贴片机周围的其他设备，让贴片机更突出",
  context: {
    targetObject: "贴片机"
  }
})
```

自动生成的原子操作序列：
1. QUERY_NODES - 查找贴片机节点
2. QUERY_NEARBY_NODES - 查找周围节点
3. HIDE_OBJECT - 隐藏周围对象 (多个)
4. SET_HIGHLIGHT - 高亮贴片机
5. FOCUS_CAMERA - 摄像头聚焦到贴片机

### 示例3：场景清理
用户请求："清理场景中的临时对象和调试信息"

MCP 调用：
```javascript
intelligent_task_decomposition({
  userRequest: "清理场景中的临时对象和调试信息"
})
```

自动生成的原子操作序列：
1. HIDE_OBJECT - 隐藏 selectBox
2. HIDE_OBJECT - 隐藏 mouseRect
3. HIDE_OBJECT - 隐藏 gridPlane
4. SET_OPACITY - 降低网格透明度
5. CLEAR_HIGHLIGHT - 清除所有高亮

## 优势

1. **统一接口** - 所有操作通过 MCP 工具
2. **智能化** - 自动理解用户意图
3. **原子化** - 操作可组合、可撤销
4. **可追踪** - 完整的操作历史
5. **易扩展** - 新增原子操作即可支持新功能

## 注意事项

1. 不要直接调用动画服务器 API
2. 使用 MCP 工具作为唯一入口
3. 利用智能分解功能处理复杂请求
4. 查看原子能力了解支持的操作