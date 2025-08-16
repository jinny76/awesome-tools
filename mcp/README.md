# MCP工具集成

Awesome Tools的MCP (Model Context Protocol) 集成，为Claude Desktop提供原生工具支持。

## 🎯 工具概览

| 工具 | 脚本 | 功能 |
|------|------|------|
| **Server酱推送** | `notify.js` | 发送通知到微信等平台 |
| **Git统计** | `git-stats.js` | 分析代码提交历史 |
| **死代码清理** | `clean-code.js` | Vue项目代码优化 |

## 🚀 快速配置

### Claude Desktop 集成

#### 1. 配置文件位置

编辑Claude Desktop配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### 2. 添加MCP服务器配置

```json
{
  "mcpServers": {
    "awesome-tools-notify": {
      "command": "node",
      "args": ["J:/projects/local_tools/mcp/notify.js"],
      "env": {}
    },
    "awesome-tools-git": {
      "command": "node", 
      "args": ["J:/projects/local_tools/mcp/git-stats.js"],
      "env": {}
    },
    "awesome-tools-clean": {
      "command": "node",
      "args": ["J:/projects/local_tools/mcp/clean-code.js"],
      "env": {}
    }
  }
}
```

#### 3. 路径配置说明

⚠️ **重要：请根据实际安装路径修改配置**

```bash
# 查找awesome-tools安装路径
npm list -g awesome_tools

# 或者使用which命令（macOS/Linux）
which ats

# Windows用户可使用where命令
where ats
```

**常见路径示例：**

- **全局npm安装**: `"node_modules/awesome_tools/mcp/notify.js"`
- **本地开发**: `"/path/to/awesome-tools/mcp/notify.js"`
- **Windows**: `"C:\\Users\\<用户名>\\AppData\\Roaming\\npm\\node_modules\\awesome_tools\\mcp\\notify.js"`
- **macOS**: `"/usr/local/lib/node_modules/awesome_tools/mcp/notify.js"`

#### 4. 重启Claude Desktop

配置完成后重启Claude Desktop，工具将自动可用。

### Cursor 集成

#### 1. 启用MCP功能

在Cursor中启用MCP支持：

1. 打开Cursor设置 (`Cmd/Ctrl + ,`)
2. 搜索 "MCP" 或 "Model Context Protocol"
3. 启用MCP功能

#### 2. 配置MCP服务器

创建或编辑 `.cursor/mcp_config.json`：

```json
{
  "mcpServers": {
    "awesome-tools": {
      "command": "node",
      "args": ["/path/to/awesome-tools/mcp/notify.js"],
      "cwd": "/path/to/your/project",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### 3. 工作区级别配置

在项目根目录创建 `.vscode/settings.json`（Cursor兼容VSCode配置）：

```json
{
  "mcp.servers": {
    "awesome-tools-notify": {
      "command": "node",
      "args": ["./node_modules/awesome_tools/mcp/notify.js"],
      "cwd": "${workspaceFolder}"
    },
    "awesome-tools-git": {
      "command": "node",
      "args": ["./node_modules/awesome_tools/mcp/git-stats.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

#### 4. 在Cursor中使用

配置完成后，在Cursor的AI助手中可以直接使用：

```
@mcp 发送一条部署完成通知

@mcp 分析当前Git仓库的提交统计

@mcp 清理Vue项目中的死代码
```

### 其他编辑器集成

#### VS Code

VS Code目前原生不支持MCP，但可以通过插件实现：

1. 安装 `MCP Client` 插件
2. 在设置中配置MCP服务器
3. 或使用终端集成调用MCP脚本

#### WebStorm / IntelliJ

通过终端工具窗口使用MCP脚本：

```bash
# 在WebStorm终端中
node ./mcp/notify.js "构建完成" "项目编译成功"
node ./mcp/git-stats.js --since "1 week ago"
```

#### Vim / Neovim

通过vim插件或命令行集成：

```vim
" 在.vimrc中添加快捷命令
command! NotifyBuild :!node ./mcp/notify.js "构建完成" "Vim构建完成"
command! GitStats :!node ./mcp/git-stats.js --info

" 使用快捷键
nnoremap <leader>nb :NotifyBuild<CR>
nnoremap <leader>gs :GitStats<CR>
```

## 📱 Server酱推送工具

### 功能特性

- 🚀 **多通道支持** - 支持配置多个SendKey
- 📝 **Markdown格式** - 支持富文本消息
- 🏷️ **标签系统** - 消息分类标记
- 📊 **发送统计** - 实时反馈发送状态

### 配置方法

```bash
# 配置SendKey
ats notify --add personal:SCTxxxxx
ats notify --add work:SCTyyyyy

# 或使用配置向导
ats notify --wizard
```

### 在Claude中使用

```
请发送一条测试通知，标题是"系统测试"，内容是"Claude Desktop集成测试成功"
```

```
发送服务器告警：CPU使用率达到90%，请及时处理
```

```
创建部署完成通知，包含版本信息和更新内容的Markdown报告
```

## 📊 Git统计工具

### 功能特性

- 📈 **多维度统计** - 作者、文件类型、时间分析
- 🎨 **可视化图表** - 横向柱状图展示
- 🔍 **灵活过滤** - 按时间、作者、文件类型筛选
- 📋 **详细报告** - 完整的项目活跃度分析

### 在Claude中使用

```
分析当前项目的Git提交历史，生成最近一个月的统计报告
```

```
查看项目中各个开发者的代码贡献情况
```

```
分析项目的文件类型分布和每日提交活跃度
```

## 🧹 死代码清理工具

### 功能特性

- 🎯 **智能检测** - Vue+Vite项目优化
- 🔍 **深度分析** - 静态+运行时双重检测
- 💾 **安全操作** - 自动备份和测试验证
- 📊 **详细报告** - 清理前后对比分析

### 在Claude中使用

```
分析Vue项目中的死代码，生成清理建议报告
```

```
执行死代码检测，但只预览不实际删除文件
```

```
清理项目中未使用的组件和导出，并创建备份
```

## 🛠️ 独立使用

所有MCP脚本都支持独立命令行使用：

```bash
# Server酱推送
cd mcp
node notify.js "测试标题" "测试内容" "测试标签"
node notify.js --status

# Git统计
node git-stats.js --dir /path/to/repo --since "1 month ago"
node git-stats.js --info

# 死代码清理
node clean-code.js --dir /path/to/vue-project --dry-run
node clean-code.js --info
```

## 🔧 高级配置

### 环境变量

```bash
# 设置默认工作目录
export AWESOME_TOOLS_DIR="/path/to/your/projects"

# 设置Server酱默认通道
export SERVERCHAN_DEFAULT_CHANNEL="personal"
```

### 自定义配置

创建 `~/.awesome-tools-mcp.json`：

```json
{
  "notify": {
    "defaultTags": "Claude|自动化",
    "enableMarkdown": true
  },
  "gitStats": {
    "defaultSince": "1 month ago",
    "excludePatterns": "*.lock,dist/*,node_modules/*"
  },
  "cleanCode": {
    "autoBackup": true,
    "skipTest": false
  }
}
```

## 🔍 配置验证

### 验证MCP配置

在配置完成后，可以通过以下方式验证：

#### Claude Desktop验证

1. 重启Claude Desktop
2. 在对话中输入：`你现在有哪些可用工具？`
3. 应该看到awesome-tools相关工具列表

#### 命令行验证

```bash
# 测试脚本是否正常运行
node ./mcp/notify.js --status
node ./mcp/git-stats.js --help
node ./mcp/clean-code.js --info

# 检查Node.js路径
which node  # macOS/Linux
where node  # Windows
```

#### 配置文件语法验证

```bash
# 验证JSON格式是否正确
python -m json.tool claude_desktop_config.json

# 或使用在线JSON验证器
```

## 📖 常见问题

### Q: 工具无法在Claude Desktop中显示？

**解决方法：**
1. 检查配置文件路径是否正确
2. 确保Node.js可执行文件在PATH中
3. 验证JSON格式是否正确
4. 检查MCP脚本路径是否存在
5. 查看Claude Desktop日志（通常在应用设置中）

```bash
# 检查路径是否存在
ls -la "/path/to/awesome-tools/mcp/notify.js"

# 检查权限
chmod +x "./mcp/notify.js"
```

### Q: Server酱发送失败？

**解决方法：**
1. 运行 `ats notify --wizard` 重新配置SendKey
2. 确保网络连接正常
3. 检查SendKey是否过期
4. 验证Server酱服务状态

```bash
# 测试连接
ping sctapi.ftqq.com

# 验证配置
ats notify --list
ats notify --test
```

### Q: Git统计显示空白？

**解决方法：**
1. 确保目录是有效的Git仓库
2. 检查 `.git` 文件夹是否存在
3. 验证Git命令行工具是否安装
4. 检查目录权限

```bash
# 验证Git仓库
git status
git log --oneline -5

# 检查Git安装
git --version
```

### Q: 死代码检测报错？

**解决方法：**
1. 确保是Vue项目且包含 `package.json` 文件
2. 检查项目依赖是否完整
3. 运行 `npm install` 安装依赖
4. 确保项目能正常编译

```bash
# 检查项目结构
ls -la package.json
ls -la src/

# 安装依赖
npm install

# 测试编译
npm run build
```

### Q: Cursor中MCP不生效？

**解决方法：**
1. 确认Cursor版本支持MCP
2. 检查MCP功能是否已启用
3. 验证配置文件路径和格式
4. 重启Cursor应用

### Q: 路径配置错误？

**解决方法：**
```bash
# 查找awesome-tools安装位置
npm list -g awesome_tools

# 查找具体文件路径
find /usr -name "notify.js" 2>/dev/null
find /usr/local -name "notify.js" 2>/dev/null

# Windows系统
dir /s notify.js
```

## 🤝 技术支持

- 📋 **Issues**: [GitHub Issues](https://github.com/yourusername/awesome-tools/issues)
- 📖 **文档**: [详细文档](../docs/commands/)
- 💬 **讨论**: [GitHub Discussions](https://github.com/yourusername/awesome-tools/discussions)

---

**通过MCP集成，让Claude Desktop成为你的开发助手！** 🚀