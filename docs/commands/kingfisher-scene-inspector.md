# 翠鸟引擎场景检查器文档

翠鸟引擎场景检查器是专门为翠鸟(Kingfisher)3D引擎设计的实时场景分析工具，通过分析 `window.scene` 对象，提供场景检索、分析和优化功能。

## 核心功能

### 1. 场景分析
- **节点分析**: 使用KPath查询系统分析变换节点和组件
- **网格分析**: 检测几何体、顶点数、三角形数和包围盒信息  
- **材质分析**: 分析材质属性、纹理使用和透明度设置
- **灯光分析**: 检测光源类型、强度和位置参数
- **摄像头分析**: 分析机位(CameraArgs)配置和活跃摄像头状态
- **动画分析**: 检测动画组和时间轴配置
- **组件分析**: 识别Diagram3d、Space3d等翠鸟组件
- **样条分析**: 分析样条曲线和路径数据

### 2. 实时查询
支持基于条件的对象查询:

```javascript
// 查询网格对象
inspector.query({
  meshes: {
    name: "building", 
    visible: true,
    minVertices: 1000
  }
});

// 查询节点 (翠鸟特有)
inspector.query({
  nodes: {
    path: "//Group[@name='Buildings']",
    type: "TransformNode"
  }
});

// 查询机位 (翠鸟特有)  
inspector.query({
  cameras: {
    isDefault: true,
    autoRotate: false
  }
});
```

### 3. 性能优化
提供翠鸟引擎特定的优化操作:

```javascript
// 隐藏对象
inspector.optimize('hide_objects', {
  objects: ['building1', 'building2']
});

// 聚焦摄像头
inspector.optimize('focus_camera', {
  target: 'landmark_building',
  duration: 2
});

// 优化材质
inspector.optimize('optimize_materials');
```

## 使用方法

### 自动连接机制

翠鸟场景检查器**默认会自动连接**到动画服务器，提供零配置的即插即用体验：

#### 默认行为
```javascript
const inspector = new KingfisherSceneInspector({
  autoAnalyze: true,        // 自动分析场景
  reportToServer: true,     // 自动连接并报告到服务器  
  serverUrl: 'ws://localhost:8080/animation', // 默认服务器地址
  analyzeInterval: 5000     // 每5秒自动分析一次
});
```

#### 连接时机
- **初始化时自动连接** - 如果 `reportToServer: true`（默认值）
- **自动重连** - 连接断开后5秒自动重连
- **场景变化时** - 检测到场景变化时自动发送分析结果

### 快速开始

#### 最简单的使用（全自动）
```html
<script src="lib/utils/kingfisher-scene-inspector.js"></script>
<script>
// 确保window.scene存在后，直接初始化
if (window.scene) {
    const inspector = new KingfisherSceneInspector();
    // ✅ 自动连接到 ws://localhost:8080/animation
    // ✅ 自动开始每5秒分析一次场景
    // ✅ 自动发送分析结果到服务器
}
</script>
```

#### 自定义服务器地址
```javascript
const inspector = new KingfisherSceneInspector({
    serverUrl: 'ws://your-server.com:9090/animation'
});
```

#### 禁用自动连接（仅本地分析）
```javascript
const inspector = new KingfisherSceneInspector({
    reportToServer: false,  // 不连接服务器
    autoAnalyze: true       // 但仍然自动分析
});

// 手动获取分析结果
const analysis = inspector.analyze();
console.log(analysis);
```

### 连接状态监控
```javascript
const inspector = new KingfisherSceneInspector();

// 监控连接状态
setTimeout(() => {
    if (inspector.isConnected) {
        console.log('✅ 已连接到动画服务器');
        console.log('客户端ID:', inspector.clientId);
    } else {
        console.log('❌ 未连接到服务器');
    }
}, 2000);
```

### 完整的集成示例
```html
<!DOCTYPE html>
<html>
<head>
    <title>翠鸟3D场景</title>
</head>
<body>
    <div id="canvas-container"></div>
    
    <!-- 翠鸟引擎相关脚本 -->
    <script src="kingfisher-engine.js"></script>
    
    <!-- 场景检查器 -->
    <script src="lib/utils/kingfisher-scene-inspector.js"></script>
    
    <script>
        // 等待翠鸟场景加载完成
        window.addEventListener('load', () => {
            // 假设翠鸟引擎已创建了window.scene
            if (window.scene) {
                console.log('🐠 翠鸟场景已加载，初始化检查器...');
                
                // 创建检查器（自动连接服务器）
                const inspector = new KingfisherSceneInspector({
                    serverUrl: 'ws://localhost:8080/animation',
                    autoAnalyze: true,
                    analyzeInterval: 3000  // 每3秒分析一次
                });
                
                // 手动触发一次分析
                setTimeout(() => {
                    const analysis = inspector.analyze();
                    console.log('📊 场景分析结果:', analysis);
                }, 1000);
                
                // 测试查询功能
                setTimeout(() => {
                    const meshes = inspector.query({
                        meshes: { visible: true }
                    });
                    console.log('🔍 可见网格:', meshes);
                }, 2000);
            }
        });
    </script>
</body>
</html>
```

### 基础API使用

```javascript
// 初始化检查器
const inspector = new KingfisherSceneInspector({
  autoAnalyze: true,
  reportToServer: true,
  serverUrl: 'ws://localhost:8080/animation',
  analyzeInterval: 5000
});

// 手动分析场景
const analysis = inspector.analyze();
console.log('场景分析结果:', analysis);

// 查询特定对象
const results = inspector.query({
  meshes: { name: 'building' },
  nodes: { type: 'TransformNode' }
});

// 执行优化
inspector.optimize('hide_objects', {
  objects: ['low_priority_mesh']
});
```

### 与动画服务器集成

```javascript
// 连接动画服务器
inspector.connectToServer();

// 监听服务器消息
inspector.ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'optimization_command') {
    // 自动执行服务器下发的优化命令
  }
};
```

## 翠鸟引擎特有功能

### 1. KPath节点查询
基于翠鸟引擎的KPath系统进行节点查询:

```javascript
// 按路径查询节点
const nodes = inspector.queryNodes({
  path: "//Group[@name='Buildings']/Mesh"
});

// 按名称查询节点
const node = inspector.queryNodes({
  name: "main_building"
});
```

### 2. 机位(CameraArgs)管理
分析和控制翠鸟引擎的机位系统:

```javascript
// 查询所有机位
const cameras = inspector.queryCameras({});

// 查询默认机位
const defaultCameras = inspector.queryCameras({
  isDefault: true
});

// 聚焦到特定机位
inspector.focusCamera('overview_camera', 1.5);
```

### 3. 翠鸟SDK集成
利用翠鸟云SDK的API功能:

```javascript
// 使用SDK隐藏对象
if (window.KingfisherUI) {
  const manager = window.KingfisherUI.getWeb3dManager();
  manager.hideObject(scene, objectId);
}

// 使用SDK查询节点
if (window.KingfisherSDK) {
  const nodes = window.KingfisherSDK.query("//node[@type='Mesh']");
}
```

## 分析结果结构

场景分析返回详细的翠鸟引擎特定数据:

```javascript
{
  timestamp: 1640995200000,
  engineType: "kingfisher",
  sceneId: "kingfisher_scene",
  
  basic: {
    id: "scene_001",
    name: "MainScene", 
    engineType: "kingfisher",
    mapTools: true,
    clearColor: { r: 0.5, g: 0.7, b: 1.0, a: 1.0 }
  },
  
  nodes: {
    transformNodes: {
      total: 150,
      details: [...]
    },
    allNodes: {
      total: 300,
      summary: {
        "TransformNode": 150,
        "Mesh": 80,
        "Light": 5,
        "Camera": 3
      }
    }
  },
  
  cameras: {
    activeCamera: {
      id: "main_camera",
      type: "ArcRotateCamera", 
      args: {...}
    },
    cameraArgs: {
      total: 8,
      details: [
        {
          id: "overview",
          name: "全景视角",
          isDefault: true,
          distance: 100,
          target: [0, 0, 0],
          autoRotate: false
        }
      ]
    }
  },
  
  performance: {
    fps: 58,
    drawCalls: 45,
    activeVertices: 125000,
    memoryUsage: 67108864
  },
  
  suggestions: [
    {
      type: "performance",
      severity: "medium", 
      title: "三角形数量过多",
      actions: ["hide_objects", "set_lod"],
      kingfisherActions: ["hideObject", "setObjectVisibility"]
    }
  ]
}
```

## 优化建议系统

检查器会根据翠鸟引擎特性生成优化建议:

### 性能优化建议
- **帧率优化**: 当FPS低于30时，建议隐藏远程对象或降低质量
- **几何体优化**: 三角形数量过多时，建议使用LOD或隐藏对象
- **材质优化**: 材质数量过多时，建议合并相似材质
- **可见性优化**: 对象数量过多时，建议使用翠鸟的对象隐藏功能

### 翠鸟特定优化
每个建议都包含翠鸟引擎专用的操作方法:

```javascript
{
  actions: ["hide_objects", "set_lod"], 
  kingfisherActions: ["hideObject", "setObjectVisibility", "disposeMesh"]
}
```

## 与MCP工具集成

翠鸟场景检查器与MCP工具无缝集成:

```bash
# 通过MCP分析翠鸟场景
ats scene-inspector -f kingfisher_scene.k3ds --engine kingfisher

# 通过MCP查询场景对象
# 在Claude Desktop中: "查询翠鸟场景中名称包含'building'的网格对象"
```

## 错误处理

检查器包含完善的错误处理机制:

```javascript
try {
  const analysis = inspector.analyze();
  if (analysis.error) {
    console.error('分析失败:', analysis.error);
  }
} catch (error) {
  console.error('检查器异常:', error);
}
```

## 最佳实践

1. **引擎检测**: 使用自动引擎检测确保使用正确的检查器
2. **API可用性**: 检查翠鸟SDK和UI组件的可用性
3. **性能监控**: 定期分析场景性能并应用优化建议
4. **错误处理**: 妥善处理API调用失败的情况
5. **资源管理**: 在页面卸载时正确销毁检查器实例

### 服务器消息处理

翠鸟检查器会自动处理以下服务器消息：

1. **优化命令** - 服务器可远程执行优化操作
2. **查询命令** - 服务器可远程查询场景对象  
3. **MCP响应** - 接收MCP工具的处理结果

```javascript
// 服务器可以发送这样的命令到检查器
{
  "type": "optimization_command",
  "command": {
    "action": "hide_objects", 
    "objects": ["building1", "building2"]
  }
}

{
  "type": "query_command",
  "command": {
    "action": "get_meshes",
    "criteria": { "name": "building" }
  }
}
```

## 启动动画服务器

确保动画服务器正在运行：

```bash
# 启动动画服务器
ats animation-server --port 8080 --verbose

# 或者使用缩写
ats as -p 8080 -v
```

服务器启动后会显示：
```
🚀 动画服务器启动成功
📡 WebSocket服务器: ws://localhost:8080/animation
🌐 HTTP服务器: http://localhost:8080
```

## 零配置使用总结

- ✅ **默认自动连接** - 无需手动调用 `connectToServer()`
- ✅ **自动重连** - 网络中断后自动恢复
- ✅ **自动分析** - 定期分析场景并发送结果
- ✅ **零配置** - 使用默认配置即可工作
- ✅ **翠鸟专用** - 专门优化翠鸟引擎API

只要确保：
1. 动画服务器运行在 `localhost:8080`
2. 网页中有 `window.scene` 对象
3. 加载了 `kingfisher-scene-inspector.js`

检查器就会自动工作，无需额外配置！

## 技术要求

- 翠鸟3D引擎 (Kingfisher Engine)
- 翠鸟云SDK (KingfisherSDK) - 可选
- 翠鸟UI组件 (KingfisherUI) - 可选  
- WebSocket支持 (动画服务器通信)
- 现代浏览器 (ES6+支持)

## 结语

翠鸟引擎场景检查器为翠鸟3D应用提供了专业级的场景分析和优化工具，通过自动连接机制实现了真正的即插即用体验。开发者只需一行代码即可获得完整的场景监控和优化能力，是提升应用性能和用户体验的重要工具。