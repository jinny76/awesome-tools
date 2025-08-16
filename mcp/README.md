# MCP服务器集成

Awesome Tools的MCP (Model Context Protocol) 服务器，为Claude Desktop和Cursor提供原生工具支持。

## 🎯 MCP服务器概览

使用官方MCP SDK构建的标准服务器，支持三大核心工具：

| 工具名称 | MCP工具ID | 功能描述 |
|----------|-----------|----------|
| **Server酱推送** | `serverchan_send` | 发送通知到微信等平台，支持Markdown和标签 |
| **Git统计分析** | `git_stats_analyze` | 深度分析Git提交历史，生成可视化报告 |
| **Vue死代码清理** | `clean_code_analyze` | 智能检测Vue项目死代码，安全清理优化 |

## 🚀 快速配置

### 标准配置方式

#### 1. 使用Claude CLI配置（推荐）

```bash
# 添加MCP服务器
claude mcp add awesome-tools -- node J:/projects/local_tools/mcp/server.js

# 检查服务器状态
claude mcp list

# 移除服务器（如需要）
claude mcp remove awesome-tools
```

#### 2. 手动配置Claude Desktop

编辑Claude Desktop配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "awesome-tools": {
      "command": "node",
      "args": ["J:/projects/local_tools/mcp/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### 3. 路径配置说明

⚠️ **重要：请根据实际安装路径修改配置**

```bash
# 查找awesome-tools安装路径
npm list -g awesome_tools

# 获取完整路径
which ats  # macOS/Linux
where ats  # Windows
```

**常见路径示例：**
- **全局npm安装**: `"node_modules/awesome_tools/mcp/server.js"`
- **本地开发**: `"/path/to/awesome-tools/mcp/server.js"`
- **Windows**: `"C:\\Users\\<用户名>\\AppData\\Roaming\\npm\\node_modules\\awesome_tools\\mcp\\server.js"`
- **macOS**: `"/usr/local/lib/node_modules/awesome_tools/mcp/server.js"`

### Cursor集成

在Cursor工作区创建 `.vscode/settings.json`：

```json
{
  "mcp.servers": {
    "awesome-tools": {
      "command": "node",
      "args": ["./node_modules/awesome_tools/mcp/server.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

## 🛠️ 工具详细说明

### 1. Server酱推送 (`serverchan_send`)

**功能特性：**
- 🚀 多通道支持，配置多个SendKey
- 📝 完整Markdown格式支持
- 🏷️ 灵活的标签分类系统
- 📊 详细的发送状态反馈

**参数说明：**
```typescript
{
  title: string,        // 必需：消息标题
  description?: string, // 可选：消息内容，支持Markdown
  tags?: string        // 可选：标签，用|分隔，如"告警|服务器"
}
```

**在Claude中使用：**
```
发送一条服务器告警通知，标题是"CPU使用率过高"，内容包含当前时间和使用率详情
```

```
创建一个部署完成的Markdown格式通知，包含版本信息和更新内容
```

### 2. Git统计分析 (`git_stats_analyze`)

**功能特性：**
- 📈 多维度统计分析（作者、文件类型、时间）
- 🎨 可视化横向柱状图
- 🔍 灵活的时间和作者过滤
- 📋 详细的项目活跃度报告

**参数说明：**
```typescript
{
  dir?: string,     // 可选：Git仓库路径，默认当前目录
  since?: string,   // 可选：起始时间，如"1 month ago"
  until?: string,   // 可选：结束时间，默认"now"
  author?: string,  // 可选：过滤特定作者
  exclude?: string  // 可选：排除文件模式，逗号分隔
}
```

**在Claude中使用：**
```
分析当前项目最近一个月的Git提交情况，生成详细报告
```

```
查看项目中所有开发者的代码贡献分布和活跃度
```

### 3. Vue死代码清理 (`clean_code_analyze`)

**功能特性：**
- 🎯 智能检测Vue+Vite项目结构
- 🔍 深度静态分析和依赖追踪
- 💾 安全操作，自动备份重要文件
- 📊 详细的清理前后对比报告

**参数说明：**
```typescript
{
  dir: string,      // 必需：项目目录路径
  dryRun?: boolean, // 可选：预览模式，默认true
  backup?: boolean  // 可选：是否创建备份，默认true
}
```

**在Claude中使用：**
```
分析Vue项目中的死代码，只预览不删除文件
```

```
清理项目中未使用的组件和导出，并生成详细报告
```

## 🔧 高级功能

### 环境变量配置

```bash
# 设置默认工作目录
export AWESOME_TOOLS_DIR="/path/to/your/projects"

# 设置Server酱默认通道
export SERVERCHAN_DEFAULT_CHANNEL="personal"

# 设置Git统计默认参数
export GIT_STATS_DEFAULT_SINCE="1 month ago"
```

### 自定义配置文件

创建 `~/.awesome-tools-config.json`：

```json
{
  "mcp": {
    "timeout": 30000,
    "maxOutputLength": 50000
  },
  "serverchan": {
    "defaultTags": "Claude|自动化",
    "enableMarkdown": true,
    "retryAttempts": 3
  },
  "gitStats": {
    "defaultSince": "1 month ago",
    "excludePatterns": ["*.lock", "dist/*", "node_modules/*"],
    "maxCommits": 1000
  },
  "cleanCode": {
    "autoBackup": true,
    "skipTest": false,
    "safeMode": true
  }
}
```

## 🔍 验证和测试

### 验证MCP服务器状态

```bash
# 使用Claude CLI检查
claude mcp list

# 手动测试服务器通信
cd J:/projects/local_tools/mcp
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node server.js

# 检查服务器依赖
npm list
```

### 常见验证步骤

1. **检查Node.js版本**：`node --version` (需要 >=18.0.0)
2. **验证MCP SDK**：`npm list @modelcontextprotocol/sdk`
3. **测试工具依赖**：`ats notify --list` 确认配置
4. **验证Git仓库**：在项目目录运行 `git status`

## 📖 故障排除

### Q: MCP服务器连接失败？

**解决方法：**
1. 检查Node.js版本是否>=18.0.0
2. 确认MCP服务器路径正确
3. 验证依赖是否完整安装
4. 查看Claude Desktop日志

```bash
# 检查服务器状态
claude mcp list

# 重新安装依赖
cd mcp && npm install

# 测试服务器通信
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node server.js
```

### Q: 工具调用失败？

**解决方法：**
1. 确认工具前置条件（如Server酱配置）
2. 检查项目路径和权限
3. 验证参数格式正确性

```bash
# 检查Server酱配置
ats notify --list

# 验证Git仓库
git status

# 检查Vue项目结构
ls -la package.json src/
```

### Q: 输出内容被截断？

**解决方法：**
1. 增加maxOutputLength配置
2. 使用更具体的过滤条件
3. 分批次处理大型项目

```json
{
  "mcp": {
    "maxOutputLength": 100000
  }
}
```

## 🧪 开发和调试

### 本地开发

```bash
# 克隆项目
git clone <repository>
cd awesome-tools

# 安装依赖
npm install
cd mcp && npm install

# 启动开发模式
npm run dev

# 运行测试
node test-server.js
```

### 调试MCP通信

```bash
# 启用调试模式
DEBUG=mcp* node server.js

# 查看详细日志
node --inspect server.js

# 测试JSON-RPC通信
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node server.js
```

## 🛠️ 独立CLI使用

MCP服务器中的所有功能也可以通过Awesome Tools CLI独立使用：

```bash
# Server酱推送
ats notify -t "测试标题" -d "测试内容" --tags "测试|标签"
ats notify --status

# Git统计分析
ats git-stats --dir /path/to/repo --since "1 month ago"
ats git-stats --help

# Vue死代码清理
ats clean-code --dir /path/to/vue-project --dry-run
ats clean-code --help
```

## 🚀 部署和分发

### 全局安装

```bash
# 安装Awesome Tools CLI（包含MCP服务器）
npm install -g awesome_tools

# 查找安装路径
npm list -g awesome_tools

# 配置Claude Desktop使用全局安装的MCP服务器
claude mcp add awesome-tools -- node "$(npm root -g)/awesome_tools/mcp/server.js"
```

### 本地开发部署

```bash
# 克隆项目
git clone <repository>
cd awesome-tools

# 安装依赖
npm install
cd mcp && npm install

# 配置本地MCP服务器
claude mcp add awesome-tools-dev -- node "$(pwd)/mcp/server.js"
```

## 🤝 技术支持

- 📋 **GitHub Issues**: [提交问题](https://github.com/yourusername/awesome-tools/issues)
- 📖 **详细文档**: [命令文档](../docs/commands/)
- 💬 **社区讨论**: [GitHub Discussions](https://github.com/yourusername/awesome-tools/discussions)
- 🔧 **MCP官方文档**: [Model Context Protocol](https://modelcontextprotocol.io/)

---

**通过标准MCP服务器，让Claude Desktop成为您的专业开发助手！** 🚀