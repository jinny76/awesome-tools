# 翠鸟场景检查器 - 快速开始

## 一分钟上手

### 1. 启动动画服务器
```bash
ats animation-server --port 8080
```

### 2. 在网页中加载检查器
```html
<script src="lib/utils/kingfisher-scene-inspector.js"></script>
<script>
// 一行代码启动场景检查器
const inspector = new KingfisherSceneInspector();
</script>
```

### 3. 完成！

检查器会自动：
- ✅ 连接到动画服务器 (`ws://localhost:8080/animation`)
- ✅ 每5秒分析一次翠鸟场景
- ✅ 发送分析结果到服务器
- ✅ 处理服务器下发的优化命令

## 常用操作

### 手动分析场景
```javascript
const analysis = inspector.analyze();
console.log('场景信息:', analysis);
```

### 查询场景对象
```javascript
// 查询可见的网格
const meshes = inspector.query({
    meshes: { visible: true }
});

// 查询特定名称的节点
const nodes = inspector.query({
    nodes: { name: 'building' }
});
```

### 执行优化操作
```javascript
// 隐藏指定对象
inspector.optimize('hide_objects', {
    objects: ['building1', 'tree2']
});

// 聚焦摄像头到指定对象
inspector.optimize('focus_camera', {
    target: 'main_building',
    duration: 2
});
```

## 自定义配置

### 更改服务器地址
```javascript
const inspector = new KingfisherSceneInspector({
    serverUrl: 'ws://your-server.com:9090/animation'
});
```

### 禁用自动连接
```javascript
const inspector = new KingfisherSceneInspector({
    reportToServer: false  // 仅本地分析
});
```

### 调整分析频率
```javascript
const inspector = new KingfisherSceneInspector({
    analyzeInterval: 3000  // 每3秒分析一次
});
```

## 监控连接状态

```javascript
setTimeout(() => {
    if (inspector.isConnected) {
        console.log('✅ 服务器连接正常');
    } else {
        console.log('❌ 服务器未连接');
    }
}, 2000);
```

## 故障排除

### 无法连接服务器
1. 确认动画服务器已启动：`ats animation-server --port 8080`
2. 检查服务器地址是否正确
3. 查看浏览器控制台错误信息

### 场景分析失败  
1. 确认 `window.scene` 对象存在
2. 检查翠鸟引擎是否已加载完成
3. 查看控制台错误日志

### 优化命令不生效
1. 确认翠鸟SDK和UI组件已加载
2. 检查对象名称是否正确
3. 验证翠鸟引擎版本兼容性

---

更多详细信息请参考：[完整文档](docs/commands/kingfisher-scene-inspector.md)