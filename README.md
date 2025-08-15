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
| **FFmpeg工具** | `ats ff --wizard` | 音视频处理、格式转换、流媒体 |
| **文件分享** | `ats ss --tunnel` | 一键分享本地文件到公网 |
| **端口映射** | `ats ss --port-map 3000` | 本地服务映射到公网访问 |
| **工作屏保** | `ats screen -w` | 专业的工作状态伪装工具 |

## 📚 详细文档

每个命令都有完整的使用文档：

- 📊 [Git Stats](docs/commands/git-stats.md) - Git仓库统计分析
- 🧹 [Clean Code](docs/commands/clean-code.md) - Vue项目死代码清理  
- 🎬 [FFmpeg](docs/commands/ffmpeg.md) - 完整音视频处理套件
- 🌐 [Share Server](docs/commands/share-server.md) - 本地分享与端口映射
- 💻 [Screensaver](docs/commands/screensaver.md) - 工作伪装屏保工具

## 🚀 典型使用场景

### 开发效率提升
```bash
# 查看本周代码统计
ats gs --since "1 week ago"

# 清理项目死代码
ats cc -d ./vue-project --dry-run

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

### 团队协作
```bash
# 分享项目文档
ats ss -d ./docs --tunnel

# 分析团队贡献
ats gs -a "team_member"

# 代码审查准备
ats cc -d . --runtime
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