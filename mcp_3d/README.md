# MCP 3D场景管理服务器

简化的3D场景管理MCP服务器，专注于场景管理核心功能。

## 功能特性

- **场景列表管理** - 获取所有3D场景列表和状态
- **心跳监控** - 维持场景活跃状态，自动清理超时场景
- **场景切换** - 支持多场景切换和当前场景管理
- **场景清理** - 手动或自动清理无效场景
- **场景分析** - 获取场景统计信息和性能指标
- **脚本执行** - 在场景中执行自定义JavaScript代码

## 安装

```bash
cd mcp_3d
npm install
```

## 配置Claude Desktop

将以下配置添加到Claude Desktop的MCP设置中：

```json
{
  "mcpServers": {
    "mcp-3d": {
      "command": "node",
      "args": ["/path/to/awesome-tools/mcp_3d/server.js"]
    }
  }
}
```

## 可用工具

### scene_list
获取所有3D场景列表

参数：
- `includeInactive` (boolean) - 是否包含非活动场景，默认false

### scene_heartbeat
更新场景心跳，保持场景活跃

参数：
- `sceneId` (string) - 场景ID [必需]
- `sceneName` (string) - 场景名称
- `metadata` (object) - 场景元数据

### scene_switch
切换当前活动场景

参数：
- `sceneId` (string) - 目标场景ID [必需]

### scene_cleanup
清理超时或指定场景

参数：
- `sceneId` (string) - 指定场景ID（不指定则清理所有超时场景）

### scene_analyze
分析场景详细信息

参数：
- `sceneId` (string) - 场景ID（默认当前场景）
- `includeNodes` (boolean) - 是否包含节点详情，默认false

### script_execute
执行自定义JavaScript脚本

参数：
- `script` (string) - JavaScript代码 [必需]
- `sceneId` (string) - 场景ID（默认当前场景）
- `timeout` (number) - 超时时间（毫秒），默认5000

## 使用示例

在Claude Desktop中使用：

```
"获取所有活跃的3D场景"
"更新场景scene001的心跳"
"切换到场景scene002"
"分析当前场景的性能指标"
"在场景中执行脚本：return scene.meshes.length"
"清理所有超时的场景"
```

## 技术说明

- 基于MCP SDK实现标准协议
- 使用Map存储场景数据
- 30秒心跳超时机制
- 每分钟自动清理超时场景
- 模拟场景分析数据（实际使用时需要连接真实3D引擎）

## 开发说明

本服务器提供了基础的场景管理框架。在实际使用中，需要：

1. 实现与3D引擎的WebSocket或其他通信机制
2. 将模拟数据替换为真实的场景数据
3. 实现真正的脚本执行引擎
4. 添加更多场景操作功能

## 注意事项

- 场景ID应该是唯一标识符
- 超时场景会被自动清理
- 脚本执行需要考虑安全性
- 建议添加权限控制机制