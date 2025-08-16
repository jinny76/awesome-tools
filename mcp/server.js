#!/usr/bin/env node

/**
 * Awesome Tools MCP Server
 * 标准的 Model Context Protocol 服务器实现
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建require函数来导入CommonJS模块
const require = createRequire(import.meta.url);

/**
 * Awesome Tools MCP Server
 */
class AwesomeToolsMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "awesome-tools",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  /**
   * 设置工具处理器
   */
  setupToolHandlers() {
    // 注册工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "serverchan_send",
            description: "使用Server酱发送通知消息到微信等平台",
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
                  description: "消息标签，用|分隔多个标签"
                }
              },
              required: ["title"]
            }
          },
          {
            name: "git_stats_analyze",
            description: "分析Git仓库的提交历史，生成详细的统计报告",
            inputSchema: {
              type: "object",
              properties: {
                dir: {
                  type: "string",
                  description: "Git仓库目录路径",
                  default: "."
                },
                since: {
                  type: "string",
                  description: "起始时间 (如: '1 month ago')"
                },
                until: {
                  type: "string",
                  description: "结束时间",
                  default: "now"
                },
                author: {
                  type: "string",
                  description: "过滤特定作者"
                },
                exclude: {
                  type: "string",
                  description: "排除文件模式 (用逗号分隔)"
                }
              },
              required: []
            }
          },
          {
            name: "clean_code_analyze",
            description: "分析Vue+Vite项目中的死代码，智能清理未使用的文件和导出",
            inputSchema: {
              type: "object",
              properties: {
                dir: {
                  type: "string",
                  description: "项目目录路径",
                  default: "."
                },
                dryRun: {
                  type: "boolean",
                  description: "预览模式，不实际删除文件",
                  default: true
                },
                backup: {
                  type: "boolean",
                  description: "是否创建备份",
                  default: true
                }
              },
              required: ["dir"]
            }
          }
        ]
      };
    });

    // 注册工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "serverchan_send":
            return await this.handleServerChanSend(args);
          
          case "git_stats_analyze":
            return await this.handleGitStatsAnalyze(args);
          
          case "clean_code_analyze":
            return await this.handleCleanCodeAnalyze(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ 工具执行失败：${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  /**
   * 处理Server酱发送
   */
  async handleServerChanSend(args) {
    const { title, description = '', tags = '' } = args;

    try {
      // 使用CLI命令执行
      let cmd = `ats notify -t "${title}"`;
      if (description) cmd += ` -d "${description}"`;
      if (tags) cmd += ` --tags "${tags}"`;
      
      const result = execSync(cmd, { 
        cwd: join(__dirname, '..'),
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      });

      return {
        content: [
          {
            type: "text",
            text: `📱 Server酱消息发送完成\\n\\n${result}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Server酱发送失败：${error.message}\\n\\n请先配置SendKey：\\n1. 运行 \`ats notify --wizard\`\\n2. 或添加SendKey：\`ats notify --add personal:SCTxxxxx\``
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 处理Git统计分析
   */
  async handleGitStatsAnalyze(args) {
    const { 
      dir = '.',
      since,
      until = 'now',
      author,
      exclude
    } = args;

    try {
      // 构建git stats命令
      let cmd = `ats gs -d "${dir}"`;
      if (since) cmd += ` --since "${since}"`;
      if (until && until !== 'now') cmd += ` --until "${until}"`;
      if (author) cmd += ` --author "${author}"`;
      if (exclude) cmd += ` --exclude "${exclude}"`;
      
      const result = execSync(cmd, { 
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      return {
        content: [
          {
            type: "text",
            text: `📊 Git统计分析完成\\n\\n\`\`\`\\n${result}\\n\`\`\``
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Git统计分析失败：${error.message}\\n\\n请确保：\\n1. 目录是有效的Git仓库\\n2. Git命令行工具已安装\\n3. 目录权限正确`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 处理死代码分析
   */
  async handleCleanCodeAnalyze(args) {
    const {
      dir,
      dryRun = true,
      backup = true
    } = args;

    try {
      // 构建clean-code命令
      let cmd = `ats cc -d "${dir}"`;
      if (dryRun) cmd += ' --dry-run';
      if (!backup) cmd += ' --no-backup';
      
      const result = execSync(cmd, { 
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      return {
        content: [
          {
            type: "text",
            text: `🧹 Vue死代码分析完成\\n\\n\`\`\`\\n${result}\\n\`\`\``
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ 死代码分析失败：${error.message}\\n\\n请确保：\\n1. 目录是Vue项目\\n2. 包含package.json文件\\n3. 项目依赖完整`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 启动服务器
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // 优雅关闭处理
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }
}

// 启动服务器
async function main() {
  try {
    const server = new AwesomeToolsMCPServer();
    await server.start();
  } catch (error) {
    console.error('MCP Server Error:', error);
    process.exit(1);
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 启动服务器
main();