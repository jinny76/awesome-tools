# Server酱 MCP 集成指南

将Server酱推送功能集成到Claude Desktop和其他支持MCP的应用中。

## 🚀 快速配置

### 1. 前置准备

确保已经配置了SendKey：
```bash
# 使用向导配置
ats notify --wizard

# 或直接添加
ats notify --add personal:SCT12345xxxxx
```

### 2. Claude Desktop 配置

编辑 Claude Desktop 配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

添加以下配置：
```json
{
  "mcpServers": {
    "serverchan": {
      "command": "node",
      "args": [
        "/path/to/awesome-tools/mcp-example.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. 重启 Claude Desktop

配置完成后重启 Claude Desktop，即可在对话中使用Server酱功能。

## 💡 使用示例

在Claude对话中，你可以这样使用：

### 发送简单通知
```
请帮我发送一条通知：
标题：服务器告警
内容：CPU使用率超过90%，请及时处理
```

### 发送Markdown格式消息
```
请发送一个项目进度报告：
标题：📊 项目进度周报
内容：使用表格格式展示各模块完成情况
标签：项目管理|周报
```

### 系统监控集成
```
请发送系统状态通知，包含以下信息：
- 当前时间
- CPU和内存使用率  
- 磁盘空间
- 最近的系统事件
```

## 🔧 高级配置

### 自定义MCP服务器

创建自己的MCP服务器文件：

```javascript
const { ServerChanMCP } = require('/path/to/awesome-tools/mcp-example.js');

class CustomMCPServer {
  constructor() {
    this.serverChan = new ServerChanMCP();
  }

  async handleRequest(request) {
    // 自定义处理逻辑
    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      
      // 添加自定义前缀
      if (name === 'serverchan-send') {
        args.title = `[${process.env.NODE_ENV}] ${args.title}`;
      }
      
      return await this.serverChan.handleToolCall(name, args);
    }
    
    return await this.serverChan.handleRequest(request);
  }
}

module.exports = new CustomMCPServer();
```

### 环境变量配置

在MCP配置中添加环境变量：
```json
{
  "mcpServers": {
    "serverchan": {
      "command": "node",
      "args": ["/path/to/mcp-example.js"],
      "env": {
        "NODE_ENV": "production",
        "SERVER_NAME": "Web Server 01",
        "NOTIFICATION_PREFIX": "[PROD]"
      }
    }
  }
}
```

### 多通道配置

为不同环境配置不同的推送通道：
```bash
# 生产环境
ats notify --add production:SCT111xxx

# 测试环境  
ats notify --add staging:SCT222xxx

# 个人通知
ats notify --add personal:SCT333xxx --default
```

## 📱 应用场景

### 1. 开发环境监控
```
当代码构建失败时，自动发送通知：
标题：❌ 构建失败
内容：项目awesome-tools构建失败，错误信息：[具体错误]
标签：构建|错误|紧急
```

### 2. 服务器运维
```
系统资源告警：
标题：⚠️ 服务器资源告警
内容：
- CPU使用率：95%
- 内存使用率：87%
- 磁盘使用率：92%
请及时处理！
```

### 3. 业务流程通知
```
订单处理完成：
标题：✅ 订单处理完成
内容：订单 #12345 已完成处理，金额：¥999.00
标签：订单|完成|业务
```

### 4. 定时报告
```
每日数据汇总：
标题：📊 每日数据报告
内容：
## 今日统计 (${new Date().toLocaleDateString()})
- 新增用户：123人
- 订单数量：456笔
- 营收金额：¥78,900
- 系统稳定性：99.8%
```

## 🛠️ 故障排除

### MCP服务器无法启动
1. 检查Node.js版本（需要>=14.0.0）
2. 确认文件路径正确
3. 查看Claude Desktop日志

### SendKey未配置
```bash
# 检查当前配置
ats notify --list

# 重新配置
ats notify --wizard
```

### 网络连接问题
```bash
# 测试连接
ping sctapi.ftqq.com

# 测试发送
ats notify --test
```

## 📚 API参考

### ServerChanMCP 类

#### 方法

**sendNotification(options)**
- `title` (string): 消息标题
- `description` (string): 消息内容，支持Markdown
- `tags` (string): 消息标签，用|分隔

**configureSendKey(name, sendkey, isDefault)**
- `name` (string): 通道名称
- `sendkey` (string): Server酱SendKey
- `isDefault` (boolean): 是否设为默认

### MCP工具定义

**serverchan-send**
- 描述：发送Server酱通知
- 参数：title (必需), description, tags
- 返回：发送结果和状态

## 🔗 相关链接

- [Server酱官网](https://sct.ftqq.com)
- [MCP协议文档](https://github.com/modelcontextprotocol/protocol)
- [Claude Desktop文档](https://docs.anthropic.com/claude/docs)
- [Awesome Tools主文档](../README.md)