# Browser Tools MCP 使用指南

基于 [AgentDeskAI/browser-tools-mcp](https://github.com/AgentDeskAI/browser-tools-mcp) 的浏览器工具集成。

## 简介

Browser Tools MCP 是一个先进的浏览器监控和交互工具，通过 Anthropic 的 Model Context Protocol (MCP) 为 AI 应用提供浏览器控制能力。它由三个核心组件组成：

- **Chrome 扩展**: 捕获截图、控制台日志、网络活动和 DOM 元素
- **Node 服务器**: 作为 Chrome 扩展和 MCP 服务器之间的通信中间件
- **MCP 服务器**: 为 AI 客户端提供标准化的浏览器交互工具

## 核心特性

- 🖥️ **浏览器控制台监控** - 实时捕获 JavaScript 错误和日志
- 📸 **页面截图捕获** - 自动生成页面截图用于分析
- 🌐 **网络流量分析** - 监控和分析网络请求
- 🎯 **DOM 元素分析** - 检查和分析选定的页面元素
- 🔍 **综合审计工具** - 可访问性、性能、SEO、最佳实践审计
- 🚀 **NextJS 专项支持** - 针对 NextJS 应用的特殊审计
- 🔒 **隐私保护** - 所有数据本地存储，不发送到第三方服务

## 快速开始

### 1. 安装向导

```bash
# 启动安装向导（推荐方式）
awesome-tools browser-tools --wizard
ats bt -w

# 选择操作:
# 1) 全新安装
# 2) 更新现有安装  
# 3) 启动服务器
# 4) 生成配置
```

### 2. 组件安装

#### 自动安装全部组件
```bash
# 全新安装（包括 MCP 服务器和 Node 服务器）
ats bt --install

# 更新现有安装
ats bt --update
```

#### Chrome 扩展安装

**方式一：自动下载（推荐）**
```bash
# 自动下载Chrome扩展到本地
ats bt --extension
# 选择 y 进行自动下载，扩展将下载到 ~/.awesome-tools/chrome-extension
```

**方式二：Chrome Web Store**
1. 搜索 "AgentDesk Browser Tools"
2. 点击 "添加至 Chrome"
3. 确认权限并安装

**方式三：手动下载（开发者模式）**
1. 访问: https://github.com/AgentDeskAI/browser-tools-mcp
2. 点击 "Code" -> "Download ZIP"
3. 解压到本地目录
4. 打开 Chrome 浏览器，访问 `chrome://extensions/`
5. 开启右上角的 "开发者模式"
6. 点击 "加载已解压的扩展程序"
7. 选择解压后的 `chrome-extension` 目录

### 3. 启动服务器

```bash
# 后台启动服务器
ats bt --start

# 前台启动（适合调试）
ats bt --start-fg

# 指定端口
ats bt --start --port 8080

# 停止服务器
ats bt --stop
```

### 4. 生成 IDE 配置

```bash
# 生成所有 IDE 配置
ats bt --config

# 仅生成 Claude Desktop 配置
ats bt --config claude

# 仅生成 Cursor IDE 配置  
ats bt --config cursor
```

#### Claude Desktop 配置示例

将以下配置添加到 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "browser-tools": {
      "command": "npx",
      "args": ["@agentdeskai/browser-tools-mcp@latest"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### Cursor IDE 配置示例

将以下配置添加到 `settings.json`：

```json
{
  "mcp": {
    "servers": {
      "browser-tools": {
        "command": "npx",
        "args": ["@agentdeskai/browser-tools-mcp@latest"],
        "env": {
          "NODE_ENV": "production"
        }
      }
    }
  }
}
```

## 管理命令

### 状态检查

```bash
# 查看详细状态
ats bt --status

# 测试连接
ats bt --test

# 检查安装
ats bt --inspect
```

### 配置验证

```bash
# Claude MCP 命令行验证
claude mcp list                    # 列出所有 MCP 服务器
claude mcp status browser-tools    # 检查服务器状态
claude mcp test browser-tools      # 测试服务器连接
```

## AI 客户端使用示例

在 Claude Desktop 或其他 MCP 兼容的 AI 客户端中，你可以使用以下指令：

### 基础监控
- "监控浏览器控制台输出"
- "截取当前页面截图"
- "获取页面的所有网络请求"
- "分析页面加载性能"

### 元素分析
- "分析选定元素的属性"
- "提取页面 DOM 结构信息"
- "检查表单元素的验证状态"
- "分析页面的响应式设计"

### 综合审计
- "运行可访问性审计"
- "执行性能分析"
- "进行 SEO 检查"
- "运行最佳实践审计"
- "NextJS 专项审计"

### 故障诊断
- "获取 JavaScript 控制台错误"
- "分析网络请求失败原因"
- "检查页面加载问题"
- "诊断性能瓶颈"

## 工作流程

1. **准备阶段**: 启动 Node 服务器和安装 Chrome 扩展
2. **监控阶段**: Chrome 扩展实时收集浏览器数据
3. **交互阶段**: AI 客户端通过 MCP 请求分析和操作
4. **分析阶段**: 获取详细的分析报告和建议


## 故障排查

### 常见问题

**服务器启动失败**
```bash
# 检查端口占用
ats bt --status

# 重新安装
ats bt --update

# 手动安装
npm install -g @agentdeskai/browser-tools-server@latest
```

**Chrome 扩展不工作**
- 确保扩展已启用
- 检查扩展权限设置
- 重新加载扩展

**MCP 连接问题**
```bash
# 验证配置
claude mcp test browser-tools

# 检查日志
ats bt --status
```

### 调试命令

```bash
# 查看运行状态
ats bt --status

# 测试连接
ats bt --test

# 检查安装
ats bt --inspect

# 重启服务
ats bt --stop && ats bt --start
```

## 高级功能

### 自定义端口配置
```bash
# 使用自定义端口启动
ats bt --start --port 8080
```

### 多环境支持
- 开发环境：前台启动便于调试
- 生产环境：后台启动稳定运行

### 性能优化
- 自动检测端口冲突
- 智能资源管理
- 本地数据缓存

## 安全考虑

- ✅ 所有数据本地存储
- ✅ 不向第三方发送信息
- ✅ Chrome 扩展权限最小化
- ✅ 支持 HTTPS 站点分析

## 更新维护

```bash
# 检查更新
ats bt --update

# 重新生成配置
ats bt --config

# 验证更新结果
ats bt --status
```

Browser Tools MCP 让你的 AI 工具变得 10 倍更智能，具备与浏览器深度交互的能力！