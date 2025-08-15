#!/usr/bin/env node

/**
 * Server酱 MCP 集成示例
 * 展示如何在其他Node.js项目中使用Server酱推送功能
 */

const { ServerChan } = require('./lib/commands/server-chan');

class ServerChanMCP {
  constructor() {
    this.serverChan = new ServerChan();
  }

  /**
   * MCP工具定义
   */
  getTools() {
    return [
      {
        name: "serverchan-send",
        description: "使用Server酱发送通知消息，支持Markdown格式和标签",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "消息标题"
            },
            description: {
              type: "string", 
              description: "消息内容，支持Markdown格式"
            },
            tags: {
              type: "string",
              description: "消息标签，用|分隔多个标签，如：服务器报警|图片"
            }
          },
          required: ["title"]
        }
      }
    ];
  }

  /**
   * 处理MCP工具调用
   */
  async handleToolCall(name, args) {
    switch (name) {
      case "serverchan-send":
        return await this.sendNotification(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * 发送通知
   */
  async sendNotification({ title, description = '', tags = '' }) {
    try {
      const results = await this.serverChan.send(title, description, { tags });
      
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      return {
        success: successCount > 0,
        message: `消息发送完成：${successCount}/${totalCount} 个通道发送成功`,
        results: results
      };
    } catch (error) {
      return {
        success: false,
        message: `发送失败: ${error.message}`
      };
    }
  }

  /**
   * 配置SendKey
   */
  async configureSendKey(name, sendkey, isDefault = false) {
    try {
      this.serverChan.addSendKey(name, sendkey, isDefault);
      return {
        success: true,
        message: `SendKey配置成功: ${name}`
      };
    } catch (error) {
      return {
        success: false,
        message: `配置失败: ${error.message}`
      };
    }
  }
}

// MCP服务器示例
class MCPServer {
  constructor() {
    this.serverChan = new ServerChanMCP();
  }

  async handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'tools/list':
        return {
          tools: this.serverChan.getTools()
        };

      case 'tools/call':
        const { name, arguments: args } = params;
        const result = await this.serverChan.handleToolCall(name, args);
        return {
          content: [
            {
              type: "text",
              text: result.message
            }
          ]
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
}

// 命令行使用示例
async function main() {
  console.log('🚀 Server酱 MCP 集成示例');
  console.log('─'.repeat(50));

  const mcp = new ServerChanMCP();

  // 示例1: 发送简单通知
  console.log('\n📤 示例1: 发送简单通知');
  try {
    const result = await mcp.sendNotification({
      title: '测试通知',
      description: '这是一条来自MCP集成的测试消息'
    });
    console.log('结果:', result.message);
  } catch (error) {
    console.log('❌ 需要先配置SendKey');
  }

  // 示例2: 发送带标签的Markdown消息
  console.log('\n📝 示例2: Markdown格式消息');
  const markdownContent = `
## 服务器状态报告

### 系统信息
- **CPU使用率**: 45%
- **内存使用**: 68%
- **磁盘空间**: 78%

### 最近事件
1. ✅ 数据库备份完成
2. ⚠️ 发现3个警告日志
3. 🔄 服务重启成功

**生成时间**: ${new Date().toLocaleString('zh-CN')}
  `.trim();

  try {
    const result = await mcp.sendNotification({
      title: '📊 服务器状态报告',
      description: markdownContent,
      tags: '服务器监控|状态报告|自动化'
    });
    console.log('结果:', result.message);
  } catch (error) {
    console.log('❌ 需要先配置SendKey');
  }

  // 示例3: 显示可用工具
  console.log('\n🔧 示例3: MCP工具列表');
  const tools = mcp.getTools();
  tools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name}`);
    console.log(`   描述: ${tool.description}`);
    console.log(`   参数: ${Object.keys(tool.inputSchema.properties).join(', ')}`);
  });

  console.log('\n💡 配置说明:');
  console.log('1. 访问 https://sct.ftqq.com 获取SendKey');
  console.log('2. 运行: node bin/cli.js notify --add personal:SCTxxxxx');
  console.log('3. 或使用: node bin/cli.js notify --wizard');
}

// 导出供其他项目使用
module.exports = {
  ServerChanMCP,
  MCPServer
};

// 如果直接运行此文件，执行示例
if (require.main === module) {
  main().catch(console.error);
}