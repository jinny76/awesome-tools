# Awesome Tools (ats) 🚀

强大的命令行工具集合，让开发工作更高效。支持超简洁缩写命令 `ats`，节省75%输入量！

[![npm version](https://img.shields.io/npm/v/awesome_tools.svg)](https://www.npmjs.com/package/awesome_tools)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## ⚡ 快速开始

```bash
# 全局安装
npm install -g awesome_tools

# 查看帮助
ats --help
```

## 🎯 核心功能一览

| 功能 | 命令 | 说明 |
|------|------|------|
| **Git统计** | `ats gs` | 分析代码提交历史，生成可视化报告 |
| **死代码清理** | `ats cc -d .` | 智能清理Vue项目未使用代码 |
| **动画服务器** | `ats as --port 8081` | 翠鸟3D引擎WebSocket服务器，支持场景检查与MCP集成 |
| **API测试** | `ats at --wizard` | API自动化测试工具，支持Swagger解析和智能测试生成 |
| **FFmpeg工具** | `ats ff --wizard` | 音视频处理、格式转换、流媒体 |
| **文件分享** | `ats ss --tunnel` | 一键分享本地文件到公网 |
| **端口映射** | `ats ss --port-map 3000` | 本地服务映射到公网访问 |
| **工作屏保** | `ats screen -w` | 专业的工作状态伪装工具 |
| **消息推送** | `ats n -t "标题"` | Server酱推送通知到微信 |
| **数据库查询** | `ats db -w` | MySQL/PostgreSQL数据库连接查询 |
| **MCP集成** | `mcp/` | Claude Desktop原生集成 |

## 🤖 AI IDE 原生集成

Awesome Tools 提供两个专门的 MCP (Model Context Protocol) 服务器，可直接集成到 Claude Desktop 和 Cursor 中：

### 1. 通用工具MCP (`mcp/server.js`)
提供Git、Vue死代码清理、数据库、翠鸟3D场景等工具集成：

```bash
# 一键添加通用工具MCP服务器
claude mcp add awesome-tools -- node path/to/awesome-tools/mcp/server.js
```

### 2. API测试MCP (`mcp-test/server.js`) 
专门用于API自动化测试，与Claude协作进行智能测试：

```bash
# 一键添加API测试MCP服务器  
claude mcp add api-test -- node path/to/awesome-tools/mcp-test/server.js
```

**手动配置 Claude Desktop：**
```json
{
  "mcpServers": {
    "awesome-tools": {
      "command": "node", 
      "args": ["path/to/awesome-tools/mcp/server.js"],
      "env": {"NODE_ENV": "production"}
    },
    "api-test": {
      "command": "node",
      "args": ["path/to/awesome-tools/mcp-test/server.js"]
    }
  }
}
```

**配置 Cursor：**
在 Cursor 设置中添加 MCP 服务器：
```json
{
  "mcp": {
    "servers": {
      "awesome-tools": {
        "command": "node",
        "args": ["path/to/awesome-tools/mcp/server.js"]
      },
      "api-test": {
        "command": "node", 
        "args": ["path/to/awesome-tools/mcp-test/server.js"]
      }
    }
  }
}
```

**验证服务器状态：**
```bash
# 检查MCP服务器连接
claude mcp list

# 手动测试服务器通信
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node path/to/mcp/server.js
```

**在 Claude Desktop 中使用：**

**通用工具MCP：**
- 💬 "发送一条部署完成通知到微信"
- 📊 "分析当前项目最近一个月的Git提交统计" 
- 🧹 "检测Vue项目中的死代码并生成清理报告"
- 🗄️ "查询用户表中的活跃用户数量"
- 🎮 "检查翠鸟3D场景中的设备模型信息"
- 🔧 "隐藏场景中的贴片机设备"
- ⚡ "对场景执行性能优化策略"

**API测试MCP：**
- 🔍 "获取http://localhost:8080的Swagger文档摘要"
- 🛠️ "为用户管理API生成完整的测试用例"
- ⚙️ "创建测试环境配置，URL是http://localhost:8080"
- 🧪 "执行用户注册接口测试并保存结果"
- 📋 "生成最近一批API测试的详细报告"
- 🔄 "对比这次测试结果与上次的差异"

**通用工具MCP支持的工具：**
- `serverchan_send` - Server酱推送通知
- `git_stats_analyze` - Git统计分析  
- `clean_code_analyze` - Vue死代码清理
- `database_query` - 数据库连接查询
- `scene_inspect` - 翠鸟3D场景实时检查与设备分析
- `kingfisher_scene_control` - 翠鸟场景对象控制（隐藏/显示/变换）
- `scene_optimization_strategy` - 智能场景优化策略执行
- `query_atomic_capabilities` - 查询场景检查器原子操作能力
- `intelligent_task_decomposition` - 智能任务分解与执行
- `atomic_operation_history` - 原子操作历史管理与回滚

**API测试MCP支持的工具：**
- `test_env_*` - 测试环境管理（创建、列出、切换、删除）
- `api_fetch_swagger` - 智能分块获取Swagger文档
- `api_get_swagger_summary` - 获取API文档摘要统计
- `api_get_service_apis` - 获取服务的完整接口和参数说明
- `api_parse_controllers` - 解析Controller列表
- `auth_*` - 认证管理（登录、验证、获取token）
- `test_execute_request` - 执行HTTP请求测试
- `test_batch_execute` - 批量执行测试
- `test_context_*` - 测试上下文管理（存储动态数据）
- `test_suite_*` - 测试套件管理（保存、加载、删除）
- `test_result_*` - 测试结果管理（保存、查询、汇总）
- `db_snapshot_*` - 数据库快照管理（创建、恢复、列出）

**MCP服务器特点：**
- 🔧 **标准协议** - 使用官方MCP SDK，完全兼容Claude Desktop
- 📡 **Stdio通信** - 通过stdin/stdout进行JSON-RPC通信
- 🛠️ **CLI集成** - 调用现有CLI命令，保持功能一致性
- 🔍 **易于调试** - 支持手动测试和验证

👉 [完整MCP服务器配置指南](mcp/README.md)

## 📚 详细文档

每个命令都有完整的使用文档：

- 📊 [Git Stats](docs/commands/git-stats.md) - Git仓库统计分析
- 🧹 [Clean Code](docs/commands/clean-code.md) - Vue项目死代码清理
- 🎯 [Kingfisher Scene Inspector](docs/commands/kingfisher-scene-inspector.md) - 翠鸟3D引擎场景检查与设备分类
- 🎬 [FFmpeg](docs/commands/ffmpeg.md) - 完整音视频处理套件
- 🌐 [Share Server](docs/commands/share-server.md) - 本地分享与端口映射
- 💻 [Screensaver](docs/commands/screensaver.md) - 工作伪装屏保工具
- 📱 [Notify](docs/commands/notify.md) - Server酱消息推送服务
- 🗄️ [Database](docs/commands/database.md) - 数据库连接查询工具
- 🤖 [MCP集成](mcp/README.md) - Claude Desktop/Cursor原生集成

## 🚀 典型使用场景

### 开发效率提升
```bash
# 查看本周代码统计
ats gs --since "1 week ago"

# 清理项目死代码
ats cc -d ./vue-project --dry-run

# 连接数据库查询用户数据
ats db --config dev -q "SELECT COUNT(*) FROM users WHERE active = 1"

# 启动翠鸟场景检查服务器
ats as --port 8081

# 分享本地开发服务
ats ss --port-map 3000
```

### 媒体文件处理
```bash
# 视频格式转换
ats ff --convert video.avi --format mp4

# 图片转Base64
ats ff --imageToBase64 logo.png --clipboard

# 批量视频压缩
ats ff --batch --compress
```

### 团队协作与通知
```bash
# 分享项目文档
ats ss -d ./docs --tunnel

# 分析团队贡献
ats gs -a "team_member"

# 代码审查准备
ats cc -d . --runtime

# 部署完成通知
ats n -t "✅ 部署成功" -d "版本 v1.2.0 已上线"
```

### Claude Desktop集成
```bash
# 配置MCP集成
ats notify --wizard  # 配置SendKey

# 在Claude中直接使用：
# "请发送服务器告警通知，CPU使用率90%"
# "分析这个项目最近一个月的Git提交情况"
# "帮我清理Vue项目中的死代码，先预览一下"
# "发送项目部署完成的Markdown报告"
```

## 💎 为什么选择 Awesome Tools？

### 🎯 超简洁命令
- 所有命令支持缩写，平均节省**75%**输入量
- `ats gs` vs `awesome-tools git-stats`
- `ats cc` vs `awesome-tools clean-code`

### 🔧 功能强大
- **智能分析** - 自动识别项目类型和配置
- **可视化输出** - 图表、进度条、彩色输出
- **交互式向导** - 新手友好的操作界面
- **批量处理** - 支持目录级批量操作
- **AI IDE集成** - 原生支持Claude Desktop和Cursor

### 🛡️ 安全可靠
- **自动备份** - 操作前自动创建备份
- **预览模式** - 先预览后执行
- **测试验证** - 自动运行测试确保安全
- **优雅恢复** - 支持一键恢复

## 🔧 系统要求

- Node.js >= 18.0.0
- 支持 Windows / macOS / Linux
- 终端需支持 ANSI 转义序列（现代终端均支持）

## 📖 进阶使用

### 命令别名设置
```bash
# ~/.bashrc 或 ~/.zshrc
alias gs="ats gs"
alias cc="ats cc"
alias ff="ats ff"
alias share="ats ss --tunnel"
```

### 配置文件
在项目根目录创建 `.atsconfig.json`：
```json
{
  "git-stats": {
    "exclude": "*.lock,dist/*",
    "since": "1 month ago"
  },
  "clean-code": {
    "backup": true,
    "skipTest": false
  }
}
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

```bash
# 克隆项目
git clone https://github.com/yourusername/awesome-tools.git

# 安装依赖
npm install

# 本地开发
npm link

# 运行测试
npm test
```

## 📄 许可证

ISC License - 自由使用和修改

## 🙏 致谢

- FFmpeg - 强大的音视频处理引擎
- Commander.js - 优雅的命令行框架
- Chalk & Ora - 美化终端输出

---

**Made with ❤️ by developers, for developers**

*如有问题或建议，请提交 [Issue](https://github.com/yourusername/awesome-tools/issues)*