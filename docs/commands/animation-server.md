# 动画WebSocket服务器

专为翠鸟(Kingfisher)3D引擎设计的WebSocket服务器，提供场景控制、实时分析和优化功能。

## 功能特性

- **WebSocket通信** - 实时双向通信支持
- **场景控制** - 对象显示/隐藏、相机切换、材质修改
- **性能监控** - FPS监控、内存使用、渲染统计
- **智能优化** - 自动LOD调整、纹理压缩、批处理优化
- **MCP集成** - 通过Claude进行智能场景分析和优化

## 快速开始

```bash
# 启动服务器（默认端口8081）
ats as

# 指定端口
ats as --port 8080

# 调试模式
ats as --debug
```

## 命令参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--port` | `-p` | WebSocket服务端口 | 8081 |
| `--host` | | 绑定主机地址 | 0.0.0.0 |
| `--debug` | `-d` | 调试模式 | false |
| `--cors` | | 允许跨域 | true |
| `--auth` | | 启用认证 | false |

## WebSocket协议

### 连接地址
```javascript
const ws = new WebSocket('ws://localhost:8081/animation');
```

### 消息格式
```javascript
// 请求
{
  "type": "command",
  "action": "hide_objects",
  "params": {
    "objects": ["obj1", "obj2"]
  }
}

// 响应
{
  "type": "response",
  "success": true,
  "data": {
    "hidden": ["obj1", "obj2"]
  }
}
```

## 支持的命令

### 对象操作
```javascript
// 隐藏对象
{ action: "hide_objects", params: { objects: ["id1", "id2"] } }

// 显示对象
{ action: "show_objects", params: { objects: ["id1", "id2"] } }

// 删除对象
{ action: "remove_objects", params: { objects: ["id1", "id2"] } }

// 高亮对象
{ action: "highlight_objects", params: { 
  objects: ["id1"], 
  color: "#ff0000" 
}}
```

### 相机控制
```javascript
// 切换相机
{ action: "set_camera", params: { cameraName: "Camera01" } }

// 聚焦对象
{ action: "focus_camera", params: { 
  target: "building1",
  duration: 2 
}}
```

### 变换操作
```javascript
// 移动对象
{ action: "translate_object", params: {
  object: "obj1",
  vector: { x: 10, y: 0, z: 5 },
  space: "WORLD"
}}

// 旋转对象
{ action: "rotate_object", params: {
  object: "obj1",
  axis: { x: 0, y: 1, z: 0 },
  angle: 90
}}

// 缩放对象
{ action: "scale_object", params: {
  object: "obj1",
  vector: { x: 2, y: 2, z: 2 }
}}
```

## 场景分析

### 获取场景信息
```javascript
// 请求场景分析
{ action: "analyze_scene", params: {
  components: ["meshes", "materials", "performance"]
}}

// 响应示例
{
  "meshes": {
    "total": 150,
    "visible": 120,
    "triangles": 1500000
  },
  "materials": {
    "total": 45,
    "unique": 30,
    "textured": 25
  },
  "performance": {
    "fps": 60,
    "memory": "256MB",
    "drawCalls": 120
  }
}
```

## 优化策略

### 性能优化
```javascript
{ action: "optimize", params: {
  strategy: "performance",
  targetFPS: 60
}}
```

### 质量优化
```javascript
{ action: "optimize", params: {
  strategy: "quality",
  settings: {
    shadows: "high",
    antialiasing: "4x"
  }
}}
```

### 场景清理
```javascript
{ action: "optimize", params: {
  strategy: "cleanup",
  removeInvisible: true,
  mergeStaticMeshes: true
}}
```

## 客户端集成

### JavaScript示例
```javascript
class AnimationClient {
  constructor(url = 'ws://localhost:8081/animation') {
    this.ws = new WebSocket(url);
    this.setupHandlers();
  }

  setupHandlers() {
    this.ws.onopen = () => console.log('Connected');
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
    this.ws.onerror = (e) => console.error('Error:', e);
  }

  sendCommand(action, params) {
    this.ws.send(JSON.stringify({
      type: 'command',
      action,
      params
    }));
  }

  handleMessage(msg) {
    if (msg.type === 'response') {
      console.log('Response:', msg);
    } else if (msg.type === 'event') {
      console.log('Event:', msg);
    }
  }
}

// 使用
const client = new AnimationClient();
client.sendCommand('hide_objects', { objects: ['debug_cube'] });
```

### 翠鸟引擎集成
```javascript
// 在翠鸟场景中自动连接
import { KingfisherSceneInspector } from './kingfisher-scene-inspector.js';

const inspector = new KingfisherSceneInspector({
  autoConnect: true,
  serverUrl: 'ws://localhost:8081/animation'
});

// 场景会自动被分析和优化
```

## MCP集成使用

通过Claude使用场景控制功能：

1. **场景检查**: "分析当前3D场景的性能"
2. **对象控制**: "隐藏所有调试对象"
3. **相机操作**: "切换到主相机视角"
4. **性能优化**: "优化场景以达到60FPS"
5. **智能任务**: "清理场景中的无用对象并聚焦到主模型"

## 监控面板

服务器提供Web监控面板：
```
http://localhost:8081/monitor
```

显示内容：
- 连接客户端列表
- 实时消息流
- 性能统计
- 错误日志

## 安全配置

### 启用认证
```bash
ats as --auth --auth-token "your-secret-token"
```

### 客户端认证
```javascript
const ws = new WebSocket('ws://localhost:8081/animation');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-secret-token'
  }));
};
```

## 故障排查

### 连接失败
- 检查端口是否被占用
- 验证防火墙设置
- 确认CORS配置

### 命令无响应
- 检查场景对象是否存在
- 验证参数格式
- 查看服务器日志

### 性能问题
- 减少同时连接数
- 优化消息发送频率
- 启用消息压缩