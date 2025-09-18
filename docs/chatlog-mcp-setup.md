# Chatlog MCP (微信聊天记录) 集成指南

本文档介绍如何在 Claude Code 中集成 Chatlog，使 AI 助手能够访问和分析微信聊天记录。

## 前置要求

1. **微信 PC 客户端版本要求** ⚠️ **重要**
   - Windows: 版本必须 ≤ 4.0.3.36
   - macOS: 版本必须 ≤ 4.0.3.80
   - **请勿升级到更新版本，否则无法获取解密密钥**

2. **Chatlog 已安装并运行**
   - 下载地址：https://github.com/sjzar/chatlog/releases
   - 确保已完成微信数据解密
   - HTTP 服务已启动（默认端口 5030）

3. **Python 环境**
   - 需要 Python 3.8+ 或安装了 `uv` 工具

## 安装步骤

### 1. 安装 mcp-proxy

Chatlog 使用 Streamable HTTP 协议，需要通过 mcp-proxy 转换为标准 MCP 协议。

使用 uv 安装（推荐）：
```bash
uv tool install mcp-proxy
```

或使用 pip 安装：
```bash
pip install mcp-proxy
```

### 2. 确认 mcp-proxy 安装位置

```bash
# Windows
where mcp-proxy
# 输出示例: C:\Users\Kingfisher\.local\bin\mcp-proxy.exe

# macOS/Linux
which mcp-proxy
# 输出示例: /usr/local/bin/mcp-proxy
```

### 3. 配置 Claude Desktop

#### 方法一：使用 iflow 工具（推荐）

```bash
# Windows 示例
iflow mcp add wechat "C:/Users/Kingfisher/.local/bin/mcp-proxy.exe" http://127.0.0.1:5030/sse

# macOS/Linux 示例
iflow mcp add wechat /usr/local/bin/mcp-proxy http://127.0.0.1:5030/sse
```

#### 方法二：手动配置

编辑 Claude Desktop 配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

添加以下配置：

```json
{
  "mcpServers": {
    "wechat": {
      "command": "C:/Users/Kingfisher/.local/bin/mcp-proxy.exe",
      "args": ["http://127.0.0.1:5030/sse"]
    }
  }
}
```

### 4. 启动 Chatlog 服务

使用 Terminal UI 模式：
```bash
chatlog
# 选择"开启 HTTP 服务"
```

或使用命令行模式：
```bash
chatlog server
```

确认服务已启动：
- HTTP API: http://127.0.0.1:5030
- MCP Endpoint: http://127.0.0.1:5030/mcp
- SSE Endpoint: http://127.0.0.1:5030/sse

### 5. 重启 Claude Desktop

配置完成后需要重启 Claude Desktop 使配置生效。

## 验证安装

在 Claude 中输入以下内容测试：

```
查询我最近7天的微信聊天记录
```

如果配置成功，Claude 应该能够访问 Chatlog 提供的工具。

## 可用功能

Chatlog MCP 提供以下工具：

1. **查询聊天记录**
   - 按时间范围查询
   - 按联系人查询
   - 支持关键词搜索

2. **获取联系人列表**
   - 查看所有联系人
   - 查看群聊列表

3. **获取会话列表**
   - 查看最近会话
   - 获取会话统计

4. **多媒体内容访问**
   - 图片、视频、文件查看
   - 语音消息播放（自动转码为 MP3）

## 使用示例

### 基础查询
```
帮我查看昨天和"张三"的聊天记录
```

### 时间范围查询
```
查看2024年12月1日到12月15日的所有聊天记录
```

### 群聊查询
```
查看"工作群"最近一个月的聊天内容
```

### 统计分析
```
统计我最近30天和谁聊天最多
```

### 关键词搜索
```
搜索所有包含"项目进度"的聊天记录
```

## 微信版本管理

### 检查当前微信版本

在微信 PC 客户端中：
- 点击左下角菜单按钮（三条横线）
- 选择"设置" → "关于微信"
- 查看版本号

### 如何防止自动升级

1. **Windows 系统**：
   - 找到微信安装目录（通常在 `C:\Program Files (x86)\Tencent\WeChat`）
   - 删除或重命名 `WeChatUpdate.exe` 文件
   - 在系统防火墙中阻止微信更新程序联网

2. **关闭自动更新**：
   - 在微信设置中关闭"有更新时自动升级微信"选项
   - 但注意：即使关闭，微信可能仍会提示更新

### 获取旧版本微信

如果已经升级到新版本：
1. 卸载当前版本微信（注意备份聊天记录）
2. 下载旧版本：
   - Windows 4.0.3.36：搜索 "微信 4.0.3.36 下载"
   - macOS 4.0.3.80：搜索 "微信 Mac 4.0.3.80 下载"
3. 安装后立即禁用自动更新

## 故障排除

### 1. Claude 提示找不到 MCP 服务器

检查配置文件路径是否正确：
- Windows 路径使用正斜杠 `/` 或双反斜杠 `\\`
- 确保 mcp-proxy.exe 路径正确

### 2. 连接失败

检查 Chatlog 服务是否运行：
```bash
curl http://127.0.0.1:5030/api/v1/contact
```

### 3. 权限问题

确保 Chatlog 有权限访问微信数据文件夹。

### 4. 数据不完整

如果聊天记录不全，可以从手机迁移数据：
1. 手机微信：我 → 设置 → 通用 → 聊天记录迁移与备份
2. 选择"迁移到电脑"
3. 重新运行 Chatlog 解密数据

## 安全注意事项

1. **隐私保护**
   - Chatlog 仅在本地处理数据
   - 请勿将服务暴露到公网
   - 仅查询自己的聊天记录

2. **数据安全**
   - 定期备份微信数据
   - 使用强密码保护服务
   - 限制服务访问权限

3. **合规使用**
   - 遵守当地法律法规
   - 不要用于非法目的
   - 尊重他人隐私

## 高级配置

### 自定义端口

如果需要修改默认端口：

```bash
# 启动时指定端口
chatlog server -p 8080

# 更新 MCP 配置
iflow mcp update wechat --args "http://127.0.0.1:8080/sse"
```

### Docker 部署

对于 NAS 或服务器部署：

```bash
# 拉取镜像
docker pull sjzar/chatlog:latest

# 运行容器
docker run -d \
  --name chatlog \
  -p 5030:5030 \
  -v /path/to/wechat/data:/app/data \
  sjzar/chatlog:latest

# 配置 MCP 连接到 Docker 服务
iflow mcp add wechat /path/to/mcp-proxy http://nas-ip:5030/sse
```

### 多账号支持

Chatlog 支持管理多个微信账号，在 Terminal UI 中可以切换账号。

## 相关资源

- Chatlog 项目：https://github.com/sjzar/chatlog
- MCP 协议：https://github.com/modelcontextprotocol
- mcp-proxy：https://github.com/sparfenyuk/mcp-proxy
- 问题反馈：https://github.com/sjzar/chatlog/issues

## 更新日志

- 2024-12-18：初始版本，支持基础查询功能
- 待完善：Webhook 集成、实时消息推送

---

**注意**：本工具仅供个人合法使用，请遵守相关法律法规和微信服务条款。