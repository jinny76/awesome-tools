# Awesome Tools 🚀

强大的命令行工具集合，提供Git统计分析、Vue项目死代码清理等实用功能。

[![npm version](https://img.shields.io/npm/v/awesome_tools.svg)](https://www.npmjs.com/package/awesome_tools)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## ✨ 主要特性

- 📊 **Git统计分析** - 详细的提交历史报告和可视化图表
- 🧹 **Vue项目死代码清理** - 智能识别并清理Vue+Vite项目中的未使用代码
- 🔍 **文件引用调试** - 分析文件依赖关系，调试死代码检测问题
- 📚 **命令历史记录** - 自动记录命令执行历史，支持快速重复执行
- 🛠️ **Vue运行时扫描** - 注入跟踪脚本，识别实际运行时使用的代码
- 🎯 **智能路径解析** - 支持Vue项目的别名和扩展名配置

## 🚀 快速开始

### 安装

```bash
# 全局安装
npm install -g awesome_tools

# 或使用本地链接（开发用）
git clone https://github.com/jinny76/awesome-tools.git
cd awesome-tools
npm link
```

### 基本使用

```bash
# 查看帮助
awesome-tools --help

# Git统计分析
awesome-tools git-stats -d . --since "1 month ago"

# Vue项目死代码清理（预览模式）
awesome-tools clean-code -d /path/to/vue/project --dry-run

# 调试文件引用关系
awesome-tools debug-file -d /path/to/project -f src/Component.vue -r src/App.vue
```

## 📖 命令详解

### Git Stats - Git统计分析

分析Git仓库的提交历史，生成详细的统计报告。

```bash
awesome-tools git-stats [选项]

选项:
  -d, --dir <path>          Git目录路径 (默认: .)
  -s, --since <date>        起始时间 (如: "1 month ago", "2024-01-01")
  -u, --until <date>        结束时间 (默认: now)
  -a, --author <pattern>    过滤特定作者
  -e, --exclude <patterns>  排除文件模式 (逗号分隔)
```

**功能特性:**
- 📈 按作者统计提交数、代码行数变化
- 📁 按文件类型统计代码分布
- 📅 每日活跃度分析和可视化图表
- 🚫 自动排除merge提交和指定文件类型

### Clean Code - Vue项目死代码清理

智能分析Vue+Vite项目，识别并清理未使用的文件和导出。

```bash
awesome-tools clean-code -d <项目目录> [选项]

必需选项:
  -d, --dir <path>          前端项目根目录路径

可选参数:
  -e, --entry <paths>       自定义入口文件 (逗号分隔)
  -b, --backup              执行清理前创建备份 (默认: true)
  --dry-run                 预览模式，只显示要删除的文件
  --skip-test               跳过npm run dev测试验证
  --include <patterns>      包含的文件模式 (默认: *.ts,*.tsx)
  --exclude <patterns>      排除的文件模式
  --no-gitignore           忽略.gitignore规则
  --debug                  显示详细调试信息
  --runtime                启用运行时扫描
  --analyze-runtime        分析运行时数据
```

**功能特性:**
- 🔍 **静态分析** - 解析import/export关系，识别未使用代码
- 🏃 **运行时扫描** - 注入跟踪脚本，监控实际代码使用情况
- 🛣️  **路由分析** - 检测Vue Router中未使用的路由
- 🎯 **智能识别** - 支持动态导入、require.context()等复杂模式
- 🔧 **配置解析** - 自动解析Vite/Vue CLI的别名和扩展名配置
- 💾 **安全备份** - 自动备份，支持一键恢复

### Debug File - 文件引用调试

深入分析特定文件的引用关系，帮助理解为什么文件被标记为死代码。

```bash
awesome-tools debug-file -d <项目目录> -f <目标文件> -r <引用文件>

必需选项:
  -d, --dir <path>     前端项目根目录路径
  -f, --file <path>    被质疑的文件路径
  -r, --ref <path>     声称引用它的文件路径
```

## 🎯 命令历史功能

Awesome Tools 提供强大的命令历史记录功能：

### 查看历史
```bash
# 只输入命令名显示帮助和历史记录
awesome-tools git-stats
awesome-tools clean-code
```

### 快速执行历史命令
```bash
# 执行第1条历史命令
awesome-tools git-stats 1
awesome-tools clean-code 3
```

**特性:**
- 📚 自动记录每次命令执行
- 💾 每个工具最多保存20条历史记录
- 🕐 显示命令执行时间
- 🔄 支持复杂参数的完整恢复
- 🏠 历史记录保存在 `~/.awesome-tools/`

## 🛠️ Vue运行时扫描

Clean Code 工具支持运行时扫描，识别静态分析无法检测的动态代码使用：

### 1. 注入跟踪脚本
```bash
awesome-tools clean-code -d /path/to/vue/project --runtime
```

### 2. 运行应用并正常使用
启动Vue应用，浏览各个页面和功能，跟踪脚本会自动收集使用数据。

### 3. 分析收集的数据
```bash
awesome-tools clean-code -d /path/to/vue/project --analyze-runtime
```

**支持的技术栈:**
- Vue 3.4+ with Composition API
- Vue Router 4.2+
- Pinia 2.1+
- Element Plus 2.5+

## 🔧 配置支持

工具自动识别和解析以下配置文件：

- **Vite Config**: `vite.config.js/ts/mjs`
- **Vue CLI Config**: `vue.config.js`
- **路径别名**: `@`, 自定义alias
- **文件扩展名**: 根据项目配置自动识别

## 📂 项目结构

```
awesome-tools/
├── bin/cli.js              # 主程序入口
├── lib/
│   ├── commands/           # 命令实现
│   │   ├── git-stats.js
│   │   ├── clean-code.js
│   │   └── debug-file.js
│   └── utils/              # 工具模块
│       ├── command-history.js
│       ├── dependency-analyzer.js
│       ├── file-analyzer.js
│       ├── gitignore-parser.js
│       ├── router-analyzer.js
│       └── runtime-scanner.js
├── test-*/                 # 测试项目
└── package.json
```

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 这个仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📝 更新日志

### v1.0.0
- 🎉 初始版本发布
- 📊 Git统计分析功能
- 🧹 Vue项目死代码清理功能
- 🔍 文件引用调试功能
- 📚 命令历史记录功能
- 🏃 Vue运行时扫描功能

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

- GitHub: [@jinny76](https://github.com/jinny76)

---

⭐ 如果这个项目对你有帮助，请给个星星支持一下！