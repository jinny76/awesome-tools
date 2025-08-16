#!/usr/bin/env node

/**
 * Server酱推送 MCP 脚本
 * 独立运行的本地 Node.js 脚本，用于 Claude Desktop MCP 集成
 */

const { ServerChan } = require('../lib/commands/server-chan');

/**
 * Server酱推送 MCP 工具
 */
class NotifyMCP {
  constructor() {
    this.serverChan = new ServerChan();
  }

  /**
   * 获取工具定义
   */
  getToolDefinition() {
    return {
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
    };
  }

  /**
   * 执行推送操作
   */
  async execute(args) {
    const { title, description = '', tags = '' } = args;

    try {
      const results = await this.serverChan.send(title, description, { tags });
      
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      if (successCount === 0) {
        return {
          success: false,
          message: "❌ 消息发送失败：所有通道都发送失败\n\n请检查SendKey配置：\n1. 运行 `ats notify --list` 查看配置\n2. 运行 `ats notify --wizard` 重新配置",
          data: { results }
        };
      }

      const resultDetails = results.map(r => 
        `  ${r.success ? '✅' : '❌'} ${r.channel}: ${r.success ? '发送成功' : r.error}`
      ).join('\n');

      return {
        success: true,
        message: `📱 消息发送完成：${successCount}/${totalCount} 个通道发送成功\n\n发送结果：\n${resultDetails}\n\n标题：${title}\n${description ? `内容：${description.substring(0, 100)}${description.length > 100 ? '...' : ''}` : ''}\n${tags ? `标签：${tags}` : ''}`,
        data: {
          successCount,
          totalCount,
          results,
          title,
          description,
          tags
        }
      };
    } catch (error) {
      if (error.message.includes('未配置默认通道')) {
        return {
          success: false,
          message: "❌ 发送失败：未配置SendKey\n\n请先配置Server酱：\n1. 访问 https://sct.ftqq.com 获取SendKey\n2. 运行 `ats notify --add personal:SCTxxxxx`\n3. 或使用 `ats notify --wizard` 配置向导",
          error: error.message
        };
      }

      return {
        success: false,
        message: `❌ 发送失败：${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 获取配置状态
   */
  async getStatus() {
    try {
      const config = await this.serverChan.loadConfig();
      return {
        success: true,
        message: `📊 Server酱配置状态\n\n已配置通道：${config.sendkeys.length} 个\n默认通道：${config.default || '未设置'}`,
        data: {
          channelCount: config.sendkeys.length,
          defaultChannel: config.default,
          channels: config.sendkeys.map(sk => sk.name)
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ 获取配置失败：${error.message}`,
        error: error.message
      };
    }
  }
}

// 命令行调用支持
async function main() {
  const notify = new NotifyMCP();
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Server酱推送 MCP 脚本');
    console.log('用法: node notify.js <title> [description] [tags]');
    console.log('或者: node notify.js --status');
    return;
  }

  if (args[0] === '--status') {
    const result = await notify.getStatus();
    console.log(result.message);
    return;
  }

  const [title, description, tags] = args;
  const result = await notify.execute({ title, description, tags });
  
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = NotifyMCP;