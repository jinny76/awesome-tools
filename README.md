# Local Tools

一个基于 Node.js 的本地工具集合，提供各种实用的命令行工具。

## 功能特性

- 🎯 Git 提交历史统计分析
- 📊 多维度数据统计报告
- 🎨 可视化图表展示

## 安装使用

```bash
npm install
npm start <command> [options]
```

## 可用命令

### git-stats - Git 统计报告

分析 Git 仓库的提交历史，生成详细的统计报告。

```bash
npm start git-stats [options]
```

**选项：**
- `-d, --dir <path>` - Git目录路径 (默认当前目录)
- `-s, --since <date>` - 起始时间
- `-u, --until <date>` - 结束时间  
- `-a, --author <pattern>` - 过滤特定作者

**统计内容：**
- 📈 总体统计概览
- 👥 按作者贡献量统计
- 📁 按文件类型统计
- 📅 每日提交活跃度（横向柱状图）

## 技术栈

- Node.js 18+
- Commander.js
- Git 命令行工具

## 开发指南

项目使用 Commander.js 框架构建，采用模块化的命令设计。

## 许可证

ISC