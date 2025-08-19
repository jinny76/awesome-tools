# MCP (Model Context Protocol) 集成指南

Awesome Tools 提供了完整的 MCP 服务器实现，可以与 Claude Desktop、Cursor 等 AI IDE 无缝集成。

## 什么是 MCP？

MCP (Model Context Protocol) 是 Anthropic 开发的标准协议，允许 AI 助手与外部工具进行交互。通过 MCP，Claude 可以：
- 直接调用本地工具
- 访问项目数据
- 执行自动化任务
- 生成测试和报告

## 快速开始

### 自动安装（推荐）

```bash
# 安装后自动配置
npm install -g @kingfishers/awesome_tools
ats mcp install
```

### 手动配置

#### Claude Desktop

配置文件位置：
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

添加配置：
```json
{
  "mcpServers": {
    "awesome-tools": {
      "command": "node",
      "args": ["C:/Users/YourName/AppData/Roaming/npm/node_modules/@kingfishers/awesome_tools/mcp/server.js"]
    },
    "api-test": {
      "command": "node",
      "args": ["C:/Users/YourName/AppData/Roaming/npm/node_modules/@kingfishers/awesome_tools/mcp-test/server.js", "--project-dir", "C:/your/project"]
    }
  }
}
```

#### Cursor

在 Cursor 设置中添加：
```json
{
  "mcp": {
    "servers": {
      "awesome-tools": {
        "command": "node",
        "args": ["/usr/local/lib/node_modules/@kingfishers/awesome_tools/mcp/server.js"]
      }
    }
  }
}
```

## 两个 MCP 服务器

### 1. 通用工具 MCP (`mcp/server.js`)

提供所有 Awesome Tools 的核心功能：

**可用工具：**
- `serverchan_send` - 发送微信通知
- `git_stats_analyze` - Git统计分析
- `clean_code_analyze` - Vue死代码检测
- `database_query` - 数据库查询
- `scene_inspect` - 翠鸟场景检查
- `kingfisher_scene_control` - 场景控制
- `scene_optimization_strategy` - 优化策略

**使用示例：**
```
对Claude说：
- "分析最近一个月的Git提交"
- "检查Vue项目中的死代码"
- "发送部署完成通知"
- "优化3D场景性能"
```

### 2. API测试 MCP (`mcp-test/server.js`)

专门的API自动化测试服务器：

**核心功能：**
- 环境管理和切换
- Swagger文档解析
- 智能测试生成
- 数据库快照
- 结果分析报告

**启动方式：**
```bash
# 必须在被测试项目根目录运行
cd /your/api/project
ats api-test --mcp-server
```

**使用示例：**
```
对Claude说：
- "为用户管理API生成测试用例"
- "执行登录接口测试"
- "创建数据库快照"
- "对比最近两次测试结果"
```

## 验证安装

### 检查服务器状态
```bash
# Claude Desktop
claude mcp list

# 手动测试
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node /path/to/mcp/server.js
```

### 测试工具调用
在 Claude 中输入：
```
使用 awesome-tools 发送一条测试通知
```

## 工作原理

### 通信流程
```
Claude <-> MCP Server <-> Awesome Tools CLI
   ^           ^                ^
   |           |                |
JSON-RPC   Stdio通信      命令执行
```

### 数据流
1. Claude 发送工具调用请求
2. MCP 服务器解析请求
3. 调用对应的 CLI 命令
4. 返回执行结果给 Claude
5. Claude 处理并展示结果

## 高级配置

### 环境变量
```json
{
  "mcpServers": {
    "awesome-tools": {
      "command": "node",
      "args": ["..."],
      "env": {
        "NODE_ENV": "production",
        "DEBUG": "true",
        "SERVERCHAN_KEY": "your-key"
      }
    }
  }
}
```

### 自定义工作目录
```json
{
  "mcpServers": {
    "api-test": {
      "command": "node",
      "args": ["...", "--project-dir", "/custom/path"],
      "cwd": "/your/workspace"
    }
  }
}
```

### 日志配置
```json
{
  "mcpServers": {
    "awesome-tools": {
      "command": "node",
      "args": ["...", "--log-level", "debug"],
      "env": {
        "LOG_FILE": "/path/to/log.txt"
      }
    }
  }
}
```

## 最佳实践

### 1. 项目级配置
为每个项目创建独立的 MCP 配置：
```bash
cd /your/project
ats mcp init
```

### 2. 安全考虑
- 不要在配置中硬编码密码
- 使用环境变量管理敏感信息
- 定期更新工具版本

### 3. 性能优化
- 避免频繁重启 MCP 服务器
- 合理设置缓存策略
- 监控资源使用

## 故障排查

### 服务器无法启动
1. 检查 Node.js 版本 (需要 >= 18.0.0)
2. 验证路径是否正确
3. 查看错误日志

### 工具调用失败
1. 确认 MCP 服务器运行中
2. 检查工具参数是否正确
3. 查看 Claude Desktop 日志

### 连接问题
1. 重启 Claude Desktop
2. 清除配置缓存
3. 重新安装 MCP 服务器

## 开发者指南

### 添加新工具
1. 在 `mcp/server.js` 中注册工具
2. 实现工具处理函数
3. 添加参数验证
4. 更新文档

### 调试 MCP 服务器
```bash
# 启用调试模式
NODE_DEBUG=mcp node mcp/server.js

# 查看详细日志
ats mcp debug --verbose
```

### 测试工具
```javascript
// test-mcp.js
const { spawn } = require('child_process');
const server = spawn('node', ['mcp/server.js']);

const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list'
};

server.stdin.write(JSON.stringify(request) + '\n');
server.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});
```

## 常见问题

**Q: MCP 服务器和 CLI 有什么区别？**
A: CLI 用于命令行交互，MCP 服务器用于 AI 集成。MCP 调用底层 CLI 功能。

**Q: 可以同时运行多个 MCP 服务器吗？**
A: 可以，每个服务器使用不同的标识符即可。

**Q: 如何更新 MCP 服务器？**
A: 更新 npm 包后，重启 Claude Desktop 即可。

**Q: 支持哪些 AI 工具？**
A: 目前支持 Claude Desktop、Cursor，计划支持更多。

## 获取帮助

- GitHub Issues: [提交问题](https://github.com/kingfishers/awesome_tools/issues)
- 文档: [在线文档](https://github.com/kingfishers/awesome_tools/wiki)
- 社区: [讨论区](https://github.com/kingfishers/awesome_tools/discussions)