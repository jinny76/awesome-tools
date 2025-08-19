# Browser Tools 命令文档

基于 [AgentDeskAI/browser-tools-mcp](https://github.com/AgentDeskAI/browser-tools-mcp) 的浏览器自动化工具。

## 简介

Browser Tools 提供完整的浏览器 MCP (Model Context Protocol) 集成解决方案，让 AI 客户端能够深度控制和监控浏览器活动。

## 命令语法

```bash
awesome-tools browser-tools [options]
ats bt [options]  # 短命令别名
```

## 可用选项

### 核心功能
- `-w, --wizard` - 启动交互式安装向导（推荐）
- `--start` - 启动服务器
- `--stop` - 停止服务器
- `--status` - 显示服务状态（默认）
- `--config [type]` - 显示 IDE 配置范例
  - `all` - 显示所有配置范例（默认）
  - `claude` - 仅显示 Claude Desktop 配置
  - `cursor` - 仅显示 Cursor IDE 配置
- `--extension` - Chrome 扩展自动下载和安装指南
- `-p, --port <port>` - 指定服务器端口（默认3025）

## 使用示例

### 快速开始
```bash
# 启动安装向导（推荐）
ats bt -w

# 直接启动服务器
ats bt --start

# 查看状态
ats bt --status

# 显示配置范例
ats bt --config

# Chrome扩展自动下载和安装指南
ats bt --extension
```

### 服务器管理
```bash
# 检查状态
ats bt --status

# 启动服务器
ats bt --start

# 停止服务器
ats bt --stop

# 自定义端口启动
ats bt --start --port 8080
```

### 配置和扩展
```bash
# 显示所有 IDE 配置范例
ats bt --config

# 仅显示 Claude Desktop 配置
ats bt --config claude

# 仅显示 Cursor IDE 配置
ats bt --config cursor

# Chrome 扩展下载和安装指南
ats bt --extension
```

## 架构组件

### 1. Chrome 扩展
- 捕获页面截图
- 监控控制台日志
- 追踪网络活动
- 分析 DOM 元素

### 2. Node 服务器
- 中间件通信服务
- HTTP API 接口
- WebSocket 实时通信
- 扩展数据代理

### 3. MCP 服务器
- 标准化工具接口
- AI 客户端集成
- 命令执行引擎
- 结果格式化

## 安装流程

### 自动安装
1. 下载官方 npm 包
2. 安装依赖组件
3. 配置本地服务
4. 生成配置文件

### Chrome 扩展安装
1. **自动下载方式**（推荐）：使用 `ats bt --extension` 自动下载到本地
2. **Chrome Web Store**：搜索 "AgentDesk Browser Tools" 一键安装
3. **手动下载方式**：从 GitHub 下载开发者版本，在 chrome://extensions/ 加载
4. 确认权限设置

## AI 客户端集成

### Claude Desktop 配置
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

### Cursor IDE 配置
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

## 功能特性

### 浏览器监控
- 实时控制台日志捕获
- 网络请求流量分析
- JavaScript 错误追踪
- 性能指标监控

### 页面分析
- 自动截图生成
- DOM 结构解析
- 元素属性检查
- 响应式设计验证

### 综合审计
- 可访问性检查
- 性能评估报告
- SEO 优化建议
- 最佳实践验证
- NextJS 专项审计

### 数据安全
- 本地数据存储
- 无第三方传输
- 权限最小化
- HTTPS 支持

## AI 使用场景

### 开发调试
```
"监控这个页面的控制台错误"
"分析页面加载性能瓶颈"
"检查网络请求是否正常"
```

### 质量保证
```
"运行完整的可访问性审计"
"检查页面的 SEO 优化状态"
"验证响应式设计兼容性"
```

### 自动化测试
```
"测试表单提交功能"
"验证用户登录流程"
"检查购物车操作"
```

## 故障排查

### 常见问题
1. **服务器启动失败** - 检查端口占用和权限
2. **扩展无法连接** - 确认扩展已启用和权限设置
3. **MCP 连接异常** - 验证配置文件和服务状态

### 调试命令
```bash
# 详细状态检查
ats bt --status

# 重启服务器
ats bt --stop && ats bt --start
```

### 日志分析
- 服务器日志：`~/.awesome-tools/browser-tools.log`
- Chrome 扩展控制台
- MCP 通信日志

## 版本管理

### 更新流程
```bash
# 使用向导更新
ats bt --wizard

# 重新生成配置
ats bt --config

# 验证更新
ats bt --status
```

### 兼容性
- Node.js 18+
- Chrome/Chromium 浏览器
- MCP 兼容的 AI 客户端

## 最佳实践

1. **定期更新** - 保持组件最新版本
2. **权限管理** - 最小化扩展权限
3. **数据清理** - 定期清理本地缓存
4. **性能监控** - 关注服务器资源使用

Browser Tools 将你的 AI 助手变成强大的浏览器自动化专家！