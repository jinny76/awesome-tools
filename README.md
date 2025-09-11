# @kingfishers/awesome_tools 🚀

强大的命令行工具集合，提供开发、运维、测试等多种实用工具。支持超简洁缩写命令 `ats`！

[![npm version](https://img.shields.io/npm/v/@kingfishers/awesome_tools.svg)](https://www.npmjs.com/package/@kingfishers/awesome_tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## ⚡ 快速开始

### 方式一：全局安装（推荐）
```bash
# 从npm安装
npm install -g @kingfishers/awesome_tools

# 验证安装
ats --version
awesome-tools --version
```

### 方式二：本地开发安装
```bash
# 1. 克隆项目到本地
git clone https://github.com/jinny76/awesome_tools.git
cd awesome_tools

# 2. 安装所有依赖（包括子项目）
npm install                    # 主项目依赖
cd mcp && npm install && cd .. # MCP服务器依赖  
cd mcp-test && npm install && cd .. # API测试MCP依赖

# 3. 全局链接（重要！）
npm link

# 4. 验证安装成功
ats --help
```

### 一键安装脚本
```bash
# Windows
install.bat

# Linux/Mac  
chmod +x install.sh && ./install.sh
```

### 🔥 快速体验
```bash
ats bt --wizard      # 浏览器工具一键安装
ats gs --since "1 month ago"  # Git统计分析
ats cc -d ./vue-project --dry-run  # Vue死代码检测
ats api-test --wizard # API测试环境配置
```

## 🎯 核心功能

### 开发工具
- **[Git统计分析](docs/commands/git-stats.md)** - 深度分析Git提交历史，生成可视化报告
- **[Vue死代码清理](docs/commands/clean-code.md)** - 智能检测和清理Vue项目中的未使用代码
- **[FFmpeg工具集](docs/commands/ffmpeg.md)** - 音视频处理、格式转换、流媒体推送

### 服务器工具
- **[开发服务器](docs/dev-server-working-implementation.md)** - Claude远程开发环境，支持文件管理、任务管理、外网隧道
- **[文件分享服务器](docs/commands/share-server.md)** - 快速搭建本地文件分享服务
- **[SSH端口转发](docs/commands/remote-server.md)** - 简化的SSH隧道管理工具
- **[动画WebSocket服务器](docs/commands/animation-server.md)** - 翠鸟3D引擎集成服务

### 测试工具
- **[API自动化测试](docs/commands/api-test.md)** - 智能API测试工具，支持Swagger和MCP集成
- **[数据库查询](docs/commands/database.md)** - MySQL/PostgreSQL快速连接查询工具
- **[浏览器工具MCP](docs/commands/browser-tools.md)** - 浏览器自动化监控，支持Chrome扩展和AI集成

### 实用工具
- **[工作屏保](docs/commands/screensaver.md)** - 专业的工作状态伪装工具
- **[消息推送](docs/commands/notify.md)** - Server酱微信通知推送
- **[翠鸟场景检查器](docs/commands/kingfisher-scene-inspector.md)** - 3D场景实时分析优化

## 📖 命令速查

| 命令 | 缩写 | 说明 |
|------|------|------|
| `dev-server` | `ds` | Claude远程开发服务器 |
| `git-stats` | `gs` | Git提交历史分析 |
| `clean-code` | `cc` | Vue死代码清理 |
| `debug-file` | `df` | 调试文件引用关系 |
| `ffmpeg` | `ff` | FFmpeg音视频处理 |
| `share-server` | `ss` | 文件分享服务器 |
| `remote-server` | `rs` | SSH端口转发 |
| `screensaver` | `screen` | 工作屏保 |
| `animation-server` | `as` | 动画WebSocket服务器 |
| `api-test` | `at` | API自动化测试 |
| `browser-tools` | `bt` | 浏览器工具MCP |

## 🤖 AI IDE 集成

### Claude Desktop 集成

提供两个专门的 MCP (Model Context Protocol) 服务器：

#### 1. 通用工具MCP
```bash
# 自动添加
claude mcp add awesome-tools -- node $(npm root -g)/@kingfishers/awesome_tools/mcp/server.js
```

#### 2. API测试MCP  
```bash
# 在项目根目录运行
cd /your/project
ats api-test --mcp-server
```

#### 3. 浏览器工具MCP
```bash
# 安装和配置浏览器工具
ats bt --wizard

# 自动下载Chrome扩展
ats bt --extension
```

详细配置请参考 [MCP集成文档](docs/mcp-integration.md)

## 📦 安装要求

- Node.js >= 18.0.0
- npm 或 yarn

## 🔧 本地开发

### 完整安装流程
```bash
# 1. 克隆仓库
git clone https://github.com/jinny76/awesome_tools.git
cd awesome_tools

# 2. 安装主项目依赖
npm install

# 3. 安装MCP服务器依赖
cd mcp
npm install
cd ..

# 4. 安装API测试MCP依赖
cd mcp-test
npm install
cd ..

# 5. 全局链接（让ats命令全局可用）
npm link

# 6. 验证安装成功
ats --help
```

### 常见问题解决

**1. 缺少依赖错误：**
```bash
# 如果遇到 "Cannot find module 'commander'" 错误
npm install

# 如果遇到 MCP 相关错误
cd mcp && npm install
cd mcp-test && npm install
```

**2. 权限问题（Windows）：**
```bash
# 以管理员身份运行 PowerShell 或 CMD
npm link
```

**3. 使用一键脚本：**
```bash
# Windows（推荐）
install.bat

# Linux/Mac
chmod +x install.sh
./install.sh
```

### 开发调试
```bash
# 直接运行（不需要全局安装）
node bin/cli.js --help

# 测试特定命令
node bin/cli.js gs --help
node bin/cli.js api-test --wizard
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

- GitHub: [@kingfishers](https://github.com/kingfishers)
- npm: [@kingfishers/awesome_tools](https://www.npmjs.com/package/@kingfishers/awesome_tools)