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
          },
          {
            name: "database_query",
            description: "执行数据库查询，支持MySQL和PostgreSQL",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: "数据库类型",
                  enum: ["mysql", "postgres"],
                  default: "mysql"
                },
                host: {
                  type: "string",
                  description: "数据库主机",
                  default: "localhost"
                },
                port: {
                  type: "number",
                  description: "数据库端口"
                },
                user: {
                  type: "string",
                  description: "用户名"
                },
                password: {
                  type: "string",
                  description: "密码"
                },
                database: {
                  type: "string",
                  description: "数据库名"
                },
                query: {
                  type: "string",
                  description: "SQL查询语句"
                },
                config: {
                  type: "string",
                  description: "使用保存的配置名称"
                },
                action: {
                  type: "string",
                  description: "操作类型",
                  enum: ["query", "tables", "describe", "test"],
                  default: "query"
                },
                tableName: {
                  type: "string",
                  description: "表名（用于describe操作）"
                },
                format: {
                  type: "string",
                  description: "输出格式",
                  enum: ["table", "json", "csv"],
                  default: "table"
                }
              },
              required: []
            }
          },
          {
            name: "scene_inspect",
            description: "实时检查网页中的window.scene对象，获取详细的场景分析报告",
            inputSchema: {
              type: "object",
              properties: {
                components: {
                  type: "array",
                  description: "要分析的组件类型",
                  items: {
                    type: "string",
                    enum: ["basic", "meshes", "materials", "textures", "lights", "cameras", "animations", "performance", "suggestions"]
                  },
                  default: ["basic", "meshes", "materials", "performance", "suggestions"]
                },
                serverUrl: {
                  type: "string",
                  description: "动画服务器URL",
                  default: "ws://localhost:8081/animation"
                },
                detailed: {
                  type: "boolean",
                  description: "是否返回详细信息",
                  default: false
                }
              },
              required: []
            }
          },
          {
            name: "kingfisher_scene_control",
            description: "翠鸟引擎场景控制，支持隐藏/删除对象、切换机位、高亮等操作",
            inputSchema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  description: "控制操作",
                  enum: ["hide_objects", "remove_objects", "show_objects", "set_camera", "focus_camera", "highlight_objects", "clear_highlight", "translate_object", "rotate_object", "scale_object"],
                  default: "hide_objects"
                },
                objects: {
                  type: "array",
                  description: "目标对象ID或名称列表",
                  items: {
                    type: "string"
                  }
                },
                cameraName: {
                  type: "string",
                  description: "机位名称 (用于set_camera操作)"
                },
                duration: {
                  type: "number",
                  description: "动画时长 (秒)",
                  default: 1
                },
                color: {
                  type: "string",
                  description: "高亮颜色 (如: #ff0000)",
                  default: "#ff0000"
                },
                vector: {
                  type: "object",
                  description: "变换向量 {x, y, z}",
                  properties: {
                    x: { type: "number", default: 0 },
                    y: { type: "number", default: 0 },
                    z: { type: "number", default: 0 }
                  }
                },
                axis: {
                  type: "object",
                  description: "旋转轴 {x, y, z}",
                  properties: {
                    x: { type: "number", default: 0 },
                    y: { type: "number", default: 1 },
                    z: { type: "number", default: 0 }
                  }
                },
                angle: {
                  type: "number",
                  description: "旋转角度 (度)",
                  default: 90
                },
                space: {
                  type: "string",
                  description: "坐标空间",
                  enum: ["LOCAL", "WORLD"],
                  default: "LOCAL"
                },
                serverUrl: {
                  type: "string",
                  description: "动画服务器URL",
                  default: "ws://localhost:8081/animation"
                }
              },
              required: ["action"]
            }
          },
          {
            name: "scene_optimization_strategy",
            description: "生成并执行智能场景优化策略，支持性能优化、质量提升、场景清理、专注模式等",
            inputSchema: {
              type: "object",
              properties: {
                strategy: {
                  type: "string",
                  description: "优化策略类型",
                  enum: ["performance", "quality", "cleanup", "focus", "custom"],
                  default: "performance"
                },
                targetFPS: {
                  type: "number",
                  description: "目标帧率 (用于性能优化)",
                  default: 60
                },
                targetObjects: {
                  type: "array",
                  description: "目标对象ID列表 (用于专注模式)",
                  items: {
                    type: "string"
                  }
                },
                customOperations: {
                  type: "array",
                  description: "自定义操作序列",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      params: { type: "object" },
                      description: { type: "string" }
                    }
                  }
                },
                options: {
                  type: "object",
                  description: "执行选项",
                  properties: {
                    dryRun: {
                      type: "boolean",
                      description: "预览模式，不实际执行",
                      default: false
                    },
                    parallel: {
                      type: "boolean", 
                      description: "并行执行操作",
                      default: false
                    },
                    stopOnError: {
                      type: "boolean",
                      description: "遇到错误时停止",
                      default: false
                    }
                  }
                },
                serverUrl: {
                  type: "string",
                  description: "动画服务器URL",
                  default: "ws://localhost:8081/animation"
                }
              },
              required: ["strategy"]
            }
          },
          {
            name: "query_atomic_capabilities",
            description: "查询翠鸟场景检查器的原子操作能力清单，了解支持的操作类型和参数",
            inputSchema: {
              type: "object",
              properties: {
                serverUrl: {
                  type: "string",
                  description: "动画服务器URL",
                  default: "ws://localhost:8081/animation"
                },
                category: {
                  type: "string",
                  description: "能力类别过滤",
                  enum: ["all", "objectOperations", "transformOperations", "cameraOperations", "visualEffectOperations", "materialOperations", "queryCapabilities", "engineSpecificCapabilities"],
                  default: "all"
                }
              },
              required: []
            }
          },
          {
            name: "intelligent_task_decomposition",
            description: "智能任务分解：根据翠鸟场景检查器的原子能力，将复杂的用户请求分解为原子操作队列",
            inputSchema: {
              type: "object",
              properties: {
                userRequest: {
                  type: "string",
                  description: "用户的自然语言请求，如：'隐藏所有调试对象并聚焦到设备A'"
                },
                context: {
                  type: "object",
                  description: "任务上下文信息",
                  properties: {
                    sceneType: {
                      type: "string",
                      description: "场景类型",
                      enum: ["industrial", "architectural", "general"],
                      default: "general"
                    },
                    priority: {
                      type: "string",
                      description: "任务优先级",
                      enum: ["low", "normal", "high"],
                      default: "normal"
                    }
                  }
                },
                options: {
                  type: "object",
                  description: "执行选项",
                  properties: {
                    dryRun: {
                      type: "boolean",
                      description: "预览模式，仅分解任务不执行",
                      default: true
                    },
                    autoExecute: {
                      type: "boolean", 
                      description: "自动执行分解后的操作队列",
                      default: false
                    },
                    parallel: {
                      type: "boolean",
                      description: "并行执行操作",
                      default: false
                    }
                  }
                },
                serverUrl: {
                  type: "string",
                  description: "动画服务器URL",
                  default: "ws://localhost:8081/animation"
                }
              },
              required: ["userRequest"]
            }
          },
          {
            name: "atomic_operation_history",
            description: "查看和管理原子操作历史，支持回滚操作",
            inputSchema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  description: "历史操作",
                  enum: ["list", "revert", "clear"],
                  default: "list"
                },
                operationId: {
                  type: "string",
                  description: "要回滚的操作ID (用于revert操作)"
                },
                limit: {
                  type: "number",
                  description: "历史记录数量限制",
                  default: 20
                },
                serverUrl: {
                  type: "string",
                  description: "动画服务器URL", 
                  default: "ws://localhost:8081/animation"
                }
              },
              required: ["action"]
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
          
          case "database_query":
            return await this.handleDatabaseQuery(args);
          
          case "scene_inspect":
            return await this.handleSceneInspect(args);
          
          case "kingfisher_scene_control":
            return await this.handleKingfisherSceneControl(args);
          
          case "scene_optimization_strategy":
            return await this.handleSceneOptimizationStrategy(args);
          
          case "query_atomic_capabilities":
            return await this.handleQueryAtomicCapabilities(args);
          
          case "intelligent_task_decomposition":
            return await this.handleIntelligentTaskDecomposition(args);
          
          case "atomic_operation_history":
            return await this.handleAtomicOperationHistory(args);
          
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
   * 处理数据库查询
   */
  async handleDatabaseQuery(args) {
    const {
      type = 'mysql',
      host = 'localhost',
      port,
      user,
      password,
      database,
      query,
      config,
      action = 'query',
      tableName,
      format = 'table'
    } = args;

    try {
      // 构建数据库命令
      let cmd = `ats db`;
      
      if (config) {
        cmd += ` --config "${config}"`;
      } else {
        cmd += ` --type "${type}"`;
        cmd += ` --host "${host}"`;
        if (port) cmd += ` --port ${port}`;
        if (user) cmd += ` --user "${user}"`;
        if (password) cmd += ` --password "${password}"`;
        if (database) cmd += ` --database "${database}"`;
      }

      // 根据操作类型添加参数
      switch (action) {
        case 'query':
          if (!query) {
            throw new Error('查询操作需要提供SQL语句');
          }
          cmd += ` --query "${query}"`;
          if (format !== 'table') {
            cmd += ` --export "${format}"`;
          }
          break;
        case 'tables':
          cmd += ' --tables';
          break;
        case 'describe':
          if (!tableName) {
            throw new Error('describe操作需要提供表名');
          }
          cmd += ` --describe "${tableName}"`;
          break;
        case 'test':
          cmd += ' --test';
          break;
        default:
          throw new Error(`不支持的操作类型: ${action}`);
      }
      
      const result = execSync(cmd, { 
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      return {
        content: [
          {
            type: "text",
            text: `🗄️ 数据库${action}操作完成\\n\\n\`\`\`\\n${result}\\n\`\`\``
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ 数据库操作失败：${error.message}\\n\\n可能的原因：\\n1. 数据库连接参数错误\\n2. 数据库服务未启动\\n3. 权限不足\\n4. SQL语法错误`
          }
        ],
        isError: true
      };
    }
  }






  /**
   * 处理场景检查
   */
  async handleSceneInspect(args) {
    const {
      components = ['basic', 'meshes', 'materials', 'performance', 'suggestions'],
      serverUrl = 'ws://localhost:8081/animation',
      detailed = false
    } = args;

    try {
      // 通过HTTP API请求动画服务器获取场景信息
      const serverPort = serverUrl.includes(':8081') ? '8081' : '8080';
      const apiUrl = `http://localhost:${serverPort}/api/scene/inspect`;
      
      // 使用execSync调用curl作为更可靠的HTTP请求方式
      const curlCmd = `curl -s -X GET "${apiUrl}" -H "Content-Type: application/json"`;
      const curlResult = execSync(curlCmd, { 
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });

      const result = JSON.parse(curlResult);

      // 直接返回动画服务器的完整响应数据
      return {
        content: [
          {
            type: "text",
            text: "```json\\n" + JSON.stringify(result, null, 2) + "\\n```"
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: "❌ 场景检查失败：" + error.message + "\\n\\n**可能的原因：**\\n1. 动画服务器未运行 (确保运行: ats as)\\n2. 网页中没有window.scene对象\\n3. 网页未连接到动画服务器\\n4. 服务器API不可用"
          }
        ],
        isError: true
      };
    }
  }


  /**
   * 处理翠鸟场景控制
   */
  async handleKingfisherSceneControl(args) {
    const {
      action,
      objects = [],
      cameraName,
      duration = 1,
      color = '#ff0000',
      vector = { x: 0, y: 0, z: 0 },
      axis = { x: 0, y: 1, z: 0 },
      angle = 90,
      space = 'LOCAL',
      serverUrl = 'ws://localhost:8081/animation'
    } = args;

    try {
      // 解析服务器URL获取端口
      const serverPort = serverUrl.includes(':8081') ? '8081' : '8080';
      const apiUrl = `http://localhost:${serverPort}/api/scene/optimize`;
      
      let requestBody = { action };
      
      // 根据操作类型构建请求体
      switch (action) {
        case 'hide_objects':
        case 'remove_objects':
        case 'show_objects':
          if (objects.length === 0) {
            throw new Error('需要指定要操作的对象ID或名称');
          }
          requestBody.objects = objects;
          break;
          
        case 'set_camera':
          if (!cameraName) {
            throw new Error('需要指定机位名称');
          }
          requestBody.cameraName = cameraName;
          requestBody.duration = duration;
          break;
          
        case 'focus_camera':
          if (objects.length === 0) {
            throw new Error('需要指定要聚焦的对象ID');
          }
          requestBody.objectId = objects[0];
          requestBody.duration = duration;
          break;
          
        case 'highlight_objects':
          if (objects.length === 0) {
            throw new Error('需要指定要高亮的对象ID');
          }
          requestBody.objects = objects;
          requestBody.color = color;
          break;
          
        case 'translate_object':
        case 'scale_object':
          if (objects.length === 0) {
            throw new Error('需要指定要变换的对象ID');
          }
          requestBody.objectId = objects[0];
          requestBody.vector = vector;
          if (action === 'translate_object') {
            requestBody.space = space;
          }
          break;
          
        case 'rotate_object':
          if (objects.length === 0) {
            throw new Error('需要指定要旋转的对象ID');
          }
          requestBody.objectId = objects[0];
          requestBody.axis = axis;
          requestBody.angle = angle;
          requestBody.space = space;
          break;
          
        case 'clear_highlight':
          // 清空高亮不需要额外参数
          break;
          
        default:
          throw new Error(`不支持的操作: ${action}`);
      }

      // 发送HTTP请求到动画服务器
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      let text = `🎮 翠鸟场景控制操作完成\n\n`;
      text += `**操作类型:** ${action}\n`;
      
      if (objects.length > 0) {
        text += `**目标对象:** ${objects.join(', ')}\n`;
      }
      
      if (cameraName) {
        text += `**机位名称:** ${cameraName}\n`;
      }
      
      text += `**执行状态:** ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
      text += `**服务器响应:** ${result.message}\n`;
      
      if (result.clients) {
        text += `**影响客户端:** ${result.clients} 个\n`;
      }

      // 根据操作类型添加特定说明
      switch (action) {
        case 'hide_objects':
          text += `\n💡 **说明:** 对象已在3D场景中隐藏，但仍存在于场景图中`;
          break;
        case 'remove_objects':
          text += `\n💡 **说明:** 对象已从场景中完全删除，无法恢复`;
          break;
        case 'set_camera':
          text += `\n💡 **说明:** 摄像头已切换到指定机位，动画时长 ${duration} 秒`;
          break;
        case 'highlight_objects':
          text += `\n💡 **说明:** 对象已使用 ${color} 颜色高亮显示`;
          break;
      }

      return {
        content: [
          {
            type: "text",
            text: text
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ 翠鸟场景控制失败：${error.message}\n\n**可能的原因：**\n1. 动画服务器未运行 (确保运行: ats as --port 8081)\n2. 网页中没有翠鸟场景检查器连接\n3. 指定的对象不存在\n4. 操作参数格式错误\n\n**调试建议：**\n- 检查服务器状态: http://localhost:8081/status\n- 查看场景对象: scene_inspect 工具\n- 确认对象ID正确`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 处理场景优化策略
   */
  async handleSceneOptimizationStrategy(args) {
    const {
      strategy = 'performance',
      targetFPS = 60,
      targetObjects = [],
      customOperations = [],
      options = {},
      serverUrl = 'ws://localhost:8081/animation'
    } = args;

    try {
      // 解析服务器URL获取端口
      const serverPort = serverUrl.includes(':8081') ? '8081' : '8080';
      
      // 首先获取当前场景数据
      const sceneApiUrl = `http://localhost:${serverPort}/api/scene/inspect`;
      const sceneResponse = await fetch(sceneApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components: ['all'], detailed: true })
      });

      if (!sceneResponse.ok) {
        throw new Error(`获取场景数据失败: ${sceneResponse.statusText}`);
      }

      const sceneResult = await sceneResponse.json();
      if (!sceneResult.success) {
        throw new Error('场景数据获取失败');
      }

      const sceneData = sceneResult.result;

      // 生成优化策略
      const strategyApiUrl = `http://localhost:${serverPort}/api/optimization/generate`;
      const strategyResponse = await fetch(strategyApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: strategy,
          sceneData: sceneData,
          targetFPS: targetFPS,
          targetObjects: targetObjects
        })
      });

      if (!strategyResponse.ok) {
        throw new Error(`策略生成失败: ${strategyResponse.statusText}`);
      }

      const strategyResult = await strategyResponse.json();

      let text = `🚀 场景优化策略执行\n\n`;
      text += `**策略类型:** ${strategy}\n`;
      text += `**策略名称:** ${strategyResult.strategy.name}\n`;
      text += `**策略描述:** ${strategyResult.strategy.description}\n\n`;

      // 如果是预览模式，只显示策略信息
      if (options.dryRun) {
        text += `**预览模式 - 不实际执行**\n\n`;
        text += `**预计操作数量:** ${strategyResult.strategy.estimatedOperations.length}\n`;
        text += `**操作类型:** ${strategyResult.strategy.estimatedOperations.join(', ')}\n\n`;
        
        text += `**场景统计:**\n`;
        text += `- 节点数: ${strategyResult.parameters.sceneStats.nodeCount}\n`;
        text += `- 网格数: ${strategyResult.parameters.sceneStats.meshCount}\n`;
        text += `- 当前FPS: ${strategyResult.parameters.sceneStats.currentFPS}\n`;
        
        if (strategy === 'performance') {
          text += `- 目标FPS: ${targetFPS}\n`;
        }
        
        return {
          content: [{ type: "text", text: text }]
        };
      }

      // 实际执行策略 - 这里需要根据策略类型生成具体的操作序列
      // 由于MCP中无法直接执行JavaScript，我们发送策略执行命令到动画服务器
      const executeApiUrl = `http://localhost:${serverPort}/api/atomic/sequence`;
      
      // 构造一个简化的操作序列用于演示
      const sequence = {
        id: `seq_${Date.now()}`,
        name: strategyResult.strategy.name,
        description: strategyResult.strategy.description,
        operations: this.generateOperationsFromStrategy(strategy, sceneData, { targetFPS, targetObjects })
      };

      const executeResponse = await fetch(executeApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence, options })
      });

      if (!executeResponse.ok) {
        throw new Error(`策略执行失败: ${executeResponse.statusText}`);
      }

      const executeResult = await executeResponse.json();

      text += `**执行状态:** ${executeResult.success ? '✅ 成功' : '❌ 失败'}\n`;
      text += `**服务器响应:** ${executeResult.message}\n`;
      text += `**操作数量:** ${sequence.operations.length}\n`;
      text += `**影响客户端:** ${executeResult.clients} 个\n\n`;

      text += `**执行选项:**\n`;
      text += `- 并行执行: ${options.parallel ? '是' : '否'}\n`;
      text += `- 遇错停止: ${options.stopOnError ? '是' : '否'}\n\n`;

      text += `💡 **说明:** 优化策略已发送到翠鸟场景检查器执行，请在浏览器中查看效果。`;

      return {
        content: [{ type: "text", text: text }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ 场景优化策略执行失败：${error.message}\n\n**可能的原因：**\n1. 动画服务器未运行\n2. 场景数据获取失败\n3. 策略类型不支持\n4. 网络连接问题`
        }],
        isError: true
      };
    }
  }

  /**
   * 根据策略类型生成操作序列
   */
  generateOperationsFromStrategy(strategy, sceneData, params) {
    const operations = [];
    const { targetFPS = 60, targetObjects = [] } = params;

    switch (strategy) {
      case 'performance':
        if (sceneData.components.performance?.fps < targetFPS) {
          operations.push({
            id: `op_${Date.now()}_1`,
            type: 'hide_objects',
            params: { 
              objects: sceneData.components.nodes
                ?.filter(node => node.name.includes('debug') || node.name.includes('marker'))
                ?.map(node => node.id)
                ?.slice(0, 5) || []
            },
            metadata: { description: '隐藏调试对象以提高性能' }
          });
        }
        break;

      case 'cleanup':
        const debugObjects = sceneData.components.nodes
          ?.filter(node => 
            node.name.includes('debug') || 
            node.name.includes('selectBox') ||
            node.name.includes('Rect')
          )
          ?.map(node => node.id) || [];
        
        if (debugObjects.length > 0) {
          operations.push({
            id: `op_${Date.now()}_1`,
            type: 'hide_objects',
            params: { objects: debugObjects },
            metadata: { description: '清理调试和辅助对象' }
          });
        }
        break;

      case 'focus':
        if (targetObjects.length > 0) {
          // 聚焦到目标对象
          operations.push({
            id: `op_${Date.now()}_1`,
            type: 'focus_camera',
            params: { objectId: targetObjects[0], duration: 2 },
            metadata: { description: '聚焦摄像头到目标对象' }
          });
          
          // 高亮目标对象
          operations.push({
            id: `op_${Date.now()}_2`,
            type: 'highlight_objects',
            params: { objects: targetObjects, color: '#00ff00' },
            metadata: { description: '高亮目标对象' }
          });
        }
        break;

      case 'quality':
        operations.push({
          id: `op_${Date.now()}_1`,
          type: 'toggle_shadows',
          params: { enabled: true, quality: 'high' },
          metadata: { description: '启用高质量阴影' }
        });
        break;
    }

    return operations;
  }

  /**
   * 处理查询原子能力
   */
  async handleQueryAtomicCapabilities(args) {
    const {
      serverUrl = 'ws://localhost:8081/animation',
      category = 'all'
    } = args;

    try {
      const serverPort = serverUrl.includes(':8081') ? '8081' : '8080';
      
      // 获取客户端信息，其中包含原子能力
      const clientsResponse = await fetch(`http://localhost:${serverPort}/api/clients`);
      if (!clientsResponse.ok) {
        throw new Error(`获取客户端信息失败: ${clientsResponse.statusText}`);
      }

      const clientsData = await clientsResponse.json();
      
      // 查找翠鸟场景检查器客户端
      const kingfisherClient = clientsData.clients?.find(client => 
        client.clientType === 'kingfisher_scene_inspector'
      );

      if (!kingfisherClient) {
        throw new Error('未找到连接的翠鸟场景检查器');
      }

      const capabilities = kingfisherClient.atomicCapabilities;
      if (!capabilities) {
        throw new Error('该客户端未提供原子能力信息');
      }

      let text = `🔍 翠鸟场景检查器原子能力清单\n\n`;
      text += `**客户端ID:** ${kingfisherClient.clientId}\n`;
      text += `**引擎类型:** ${kingfisherClient.engineType}\n`;
      text += `**连接时间:** ${new Date(kingfisherClient.connectedAt).toLocaleString()}\n\n`;

      // 根据类别过滤显示能力
      if (category === 'all' || category === 'objectOperations') {
        text += `## 📦 对象操作能力\n`;
        Object.entries(capabilities.objectOperations || {}).forEach(([key, op]) => {
          text += `### ${key}\n`;
          text += `- **描述:** ${op.description}\n`;
          text += `- **参数:** ${op.parameters?.join(', ') || '无'}\n`;
          text += `- **支持目标:** ${op.supportedTargets?.join(', ') || '全部'}\n`;
          if (op.supportsKPath) text += `- **KPath支持:** ✅\n`;
          if (op.destructive) text += `- **破坏性操作:** ⚠️\n`;
          text += `\n`;
        });
      }

      if (category === 'all' || category === 'transformOperations') {
        text += `## 🔄 变换操作能力\n`;
        Object.entries(capabilities.transformOperations || {}).forEach(([key, op]) => {
          text += `### ${key}\n`;
          text += `- **描述:** ${op.description}\n`;
          text += `- **参数:** ${op.parameters?.join(', ') || '无'}\n`;
          if (op.supportedSpaces) text += `- **坐标空间:** ${op.supportedSpaces.join(', ')}\n`;
          if (op.angleUnit) text += `- **角度单位:** ${op.angleUnit}\n`;
          text += `\n`;
        });
      }

      if (category === 'all' || category === 'cameraOperations') {
        text += `## 📹 摄像头操作能力\n`;
        Object.entries(capabilities.cameraOperations || {}).forEach(([key, op]) => {
          text += `### ${key}\n`;
          text += `- **描述:** ${op.description}\n`;
          text += `- **参数:** ${op.parameters?.join(', ') || '无'}\n`;
          if (op.supportsAnimation) text += `- **动画支持:** ✅\n`;
          text += `\n`;
        });
      }

      if (category === 'all' || category === 'visualEffectOperations') {
        text += `## ✨ 视觉效果操作能力\n`;
        Object.entries(capabilities.visualEffectOperations || {}).forEach(([key, op]) => {
          text += `### ${key}\n`;
          text += `- **描述:** ${op.description}\n`;
          text += `- **参数:** ${op.parameters?.join(', ') || '无'}\n`;
          if (op.supportedColors) text += `- **颜色格式:** ${op.supportedColors.join(', ')}\n`;
          text += `\n`;
        });
      }

      if (category === 'all' || category === 'queryCapabilities') {
        text += `## 🔎 查询能力\n`;
        Object.entries(capabilities.queryCapabilities || {}).forEach(([key, op]) => {
          text += `### ${key}\n`;
          text += `- **描述:** ${op.description}\n`;
          if (op.supportedSyntax) {
            text += `- **支持语法:**\n`;
            op.supportedSyntax.forEach(syntax => {
              text += `  - ${syntax}\n`;
            });
          }
          text += `\n`;
        });
      }

      if (category === 'all' || category === 'engineSpecificCapabilities') {
        text += `## 🚀 引擎特定能力\n`;
        const engineCaps = capabilities.engineSpecificCapabilities?.kingfisher_sdk;
        if (engineCaps) {
          text += `### Kingfisher SDK\n`;
          text += `- **描述:** ${engineCaps.description}\n`;
          text += `- **Puzzle支持:** ${engineCaps.puzzleSupport ? '✅' : '❌'}\n`;
          text += `- **Babylon支持:** ${engineCaps.babylonSupport ? '✅' : '❌'}\n`;
          text += `- **Scene支持:** ${engineCaps.sceneSupport ? '✅' : '❌'}\n`;
          text += `- **可用API数量:** ${Object.keys(engineCaps.availableAPIs || {}).length}\n\n`;
        }
      }

      if (category === 'all') {
        text += `## ⚡ 性能限制\n`;
        const perf = capabilities.performance;
        if (perf) {
          text += `- **最大并发操作:** ${perf.maxConcurrentOperations}\n`;
          text += `- **最大批处理大小:** ${perf.maxBatchSize}\n`;
          text += `- **撤销支持:** ${perf.supportsUndo ? '✅' : '❌'}\n`;
          text += `- **历史记录支持:** ${perf.supportsHistory ? '✅' : '❌'}\n`;
          text += `- **原子执行保证:** ${perf.atomicExecution ? '✅' : '❌'}\n\n`;
        }
      }

      text += `💡 **使用说明:** 这些能力可以通过 \`intelligent_task_decomposition\` 工具进行智能组合，将复杂任务自动分解为原子操作队列。`;

      return {
        content: [{ type: "text", text: text }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ 查询原子能力失败：${error.message}\n\n**可能的原因：**\n1. 动画服务器未运行\n2. 翠鸟场景检查器未连接\n3. 客户端未提供能力信息\n\n**解决方案：**\n1. 启动动画服务器: \`ats as --port 8081\`\n2. 在网页中加载翠鸟场景并确保场景检查器已连接\n3. 检查服务器状态: http://localhost:8081/status`
        }],
        isError: true
      };
    }
  }

  /**
   * 处理智能任务分解
   */
  async handleIntelligentTaskDecomposition(args) {
    const {
      userRequest,
      context = {},
      options = {},
      serverUrl = 'ws://localhost:8081/animation'
    } = args;

    try {
      const serverPort = serverUrl.includes(':8081') ? '8081' : '8080';
      
      // 首先获取原子能力
      const capabilitiesResult = await this.handleQueryAtomicCapabilities({ serverUrl, category: 'all' });
      if (capabilitiesResult.isError) {
        throw new Error('无法获取原子能力信息');
      }

      // 获取当前场景数据
      const sceneResponse = await fetch(`http://localhost:${serverPort}/api/scene/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components: ['all'], detailed: true })
      });

      if (!sceneResponse.ok) {
        throw new Error(`获取场景数据失败: ${sceneResponse.statusText}`);
      }

      const sceneResult = await sceneResponse.json();
      if (!sceneResult.success) {
        throw new Error('场景数据获取失败');
      }

      // 智能任务分解
      const decomposedTasks = this.decomposeUserRequest(userRequest, sceneResult.result, context);

      let text = `🧠 智能任务分解结果\n\n`;
      text += `**用户请求:** ${userRequest}\n`;
      text += `**场景类型:** ${context.sceneType || 'general'}\n`;
      text += `**任务优先级:** ${context.priority || 'normal'}\n`;
      text += `**预览模式:** ${options.dryRun !== false ? '是' : '否'}\n\n`;

      if (decomposedTasks.length === 0) {
        text += `❓ **无法解析请求**\n\n`;
        text += `当前支持的操作类型包括：\n`;
        text += `- 隐藏/显示对象：'隐藏贴片机'、'显示所有设备'\n`;
        text += `- 删除对象：'删除调试对象'、'移除标记'\n`;
        text += `- 摄像头控制：'切换到顶视图'、'聚焦到设备A'\n`;
        text += `- 高亮效果：'高亮重要设备'、'标记异常区域'\n`;
        text += `- 场景清理：'清理调试对象'、'隐藏辅助元素'\n\n`;
        text += `请尝试使用更具体的描述，例如：\n`;
        text += `- "隐藏所有包含debug的对象并聚焦到贴片机"\n`;
        text += `- "删除调试标记然后切换到俯视角度"\n`;
        text += `- "高亮所有设备并隐藏网格线"`;

        return {
          content: [{ type: "text", text: text }]
        };
      }

      text += `## 📋 分解的操作序列 (${decomposedTasks.length}个步骤)\n\n`;
      
      decomposedTasks.forEach((task, index) => {
        text += `### 步骤 ${index + 1}: ${task.description}\n`;
        text += `- **操作类型:** ${task.type}\n`;
        text += `- **优先级:** ${task.priority}\n`;
        
        if (task.params.objects && task.params.objects.length > 0) {
          text += `- **目标对象:** ${task.params.objects.slice(0, 3).join(', ')}`;
          if (task.params.objects.length > 3) {
            text += ` 等${task.params.objects.length}个对象`;
          }
          text += `\n`;
        }
        
        if (task.params.cameraName) {
          text += `- **机位名称:** ${task.params.cameraName}\n`;
        }
        
        if (task.params.color) {
          text += `- **颜色:** ${task.params.color}\n`;
        }
        
        if (task.estimatedDuration) {
          text += `- **预计耗时:** ${task.estimatedDuration}秒\n`;
        }
        
        text += `\n`;
      });

      // 总览统计
      const totalDuration = decomposedTasks.reduce((sum, task) => sum + (task.estimatedDuration || 1), 0);
      const operationTypes = [...new Set(decomposedTasks.map(task => task.type))];
      
      text += `## 📊 执行统计\n`;
      text += `- **总操作数:** ${decomposedTasks.length}\n`;
      text += `- **操作类型:** ${operationTypes.join(', ')}\n`;
      text += `- **预计总耗时:** ${totalDuration}秒\n`;
      text += `- **并行执行:** ${options.parallel ? '是' : '否'}\n\n`;

      // 如果不是预览模式且设置了自动执行
      if (!options.dryRun && options.autoExecute) {
        text += `## 🚀 自动执行中...\n\n`;
        
        // 构造操作序列
        const sequence = {
          id: `seq_decomp_${Date.now()}`,
          name: '智能任务分解序列',
          description: `基于用户请求"${userRequest}"生成的操作序列`,
          operations: decomposedTasks.map((task, index) => ({
            id: `op_decomp_${Date.now()}_${index}`,
            type: task.type,
            params: task.params,
            metadata: {
              description: task.description,
              priority: task.priority,
              userRequestStep: index + 1
            }
          }))
        };

        // 执行操作序列
        const executeResponse = await fetch(`http://localhost:${serverPort}/api/atomic/sequence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sequence, options })
        });

        if (executeResponse.ok) {
          const executeResult = await executeResponse.json();
          text += `**执行状态:** ${executeResult.success ? '✅ 成功' : '❌ 失败'}\n`;
          text += `**服务器响应:** ${executeResult.message}\n`;
          text += `**影响客户端:** ${executeResult.clients} 个\n\n`;
          text += `💡 操作已发送到翠鸟场景检查器，请在浏览器中查看效果。`;
        } else {
          text += `❌ **执行失败:** ${executeResponse.statusText}\n\n`;
          text += `可以通过 \`scene_optimization_strategy\` 工具手动执行这些操作。`;
        }
      } else {
        text += `💡 **下一步操作:**\n`;
        text += `- 设置 \`autoExecute: true\` 和 \`dryRun: false\` 自动执行这些操作\n`;
        text += `- 或使用 \`scene_optimization_strategy\` 工具手动执行\n`;
        text += `- 使用 \`kingfisher_scene_control\` 工具逐步执行单个操作`;
      }

      return {
        content: [{ type: "text", text: text }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ 智能任务分解失败：${error.message}\n\n**可能的原因：**\n1. 动画服务器未运行\n2. 翠鸟场景检查器未连接\n3. 场景数据获取失败\n4. 用户请求无法解析\n\n**建议操作：**\n1. 确保动画服务器运行正常\n2. 使用 \`query_atomic_capabilities\` 查看可用能力\n3. 使用 \`scene_inspect\` 检查场景状态\n4. 使用更具体的操作描述`
        }],
        isError: true
      };
    }
  }

  /**
   * 智能分解用户请求为原子操作
   */
  decomposeUserRequest(userRequest, sceneData, context) {
    const operations = [];
    const request = userRequest.toLowerCase();

    // 场景清理相关
    if (request.includes('清理') || request.includes('删除调试') || request.includes('隐藏调试')) {
      const debugObjects = this.findDebugObjects(sceneData);
      if (debugObjects.length > 0) {
        operations.push({
          type: 'hide_objects',
          params: { objects: debugObjects },
          description: '清理调试和辅助对象',
          priority: 1,
          estimatedDuration: 2
        });
      }
    }

    // 对象隐藏相关
    if (request.includes('隐藏')) {
      const targetObjects = this.extractTargetObjects(request, sceneData);
      if (targetObjects.length > 0) {
        operations.push({
          type: 'hide_objects',
          params: { objects: targetObjects },
          description: `隐藏指定对象: ${targetObjects.slice(0,2).join(', ')}${targetObjects.length > 2 ? '等' : ''}`,
          priority: 2,
          estimatedDuration: 1
        });
      }
    }

    // 对象显示相关
    if (request.includes('显示') || request.includes('展示')) {
      const targetObjects = this.extractTargetObjects(request, sceneData);
      if (targetObjects.length > 0) {
        operations.push({
          type: 'show_objects',
          params: { objects: targetObjects },
          description: `显示指定对象: ${targetObjects.slice(0,2).join(', ')}${targetObjects.length > 2 ? '等' : ''}`,
          priority: 2,
          estimatedDuration: 1
        });
      }
    }

    // 删除对象相关
    if (request.includes('删除') || request.includes('移除')) {
      const targetObjects = this.extractTargetObjects(request, sceneData);
      if (targetObjects.length > 0) {
        operations.push({
          type: 'remove_objects',
          params: { objects: targetObjects },
          description: `删除指定对象: ${targetObjects.slice(0,2).join(', ')}${targetObjects.length > 2 ? '等' : ''}`,
          priority: 2,
          estimatedDuration: 1
        });
      }
    }

    // 摄像头控制相关
    if (request.includes('聚焦') || request.includes('定位') || request.includes('查看')) {
      const focusTargets = this.extractTargetObjects(request, sceneData);
      if (focusTargets.length > 0) {
        operations.push({
          type: 'focus_camera',
          params: { objectId: focusTargets[0], duration: 2 },
          description: `聚焦摄像头到: ${focusTargets[0]}`,
          priority: 3,
          estimatedDuration: 3
        });
      }
    }

    // 机位切换相关
    if (request.includes('切换') || request.includes('视角') || request.includes('机位')) {
      let cameraName = '默认';
      if (request.includes('顶视') || request.includes('俯视')) cameraName = '顶视角';
      if (request.includes('侧视') || request.includes('侧面')) cameraName = '侧视角';
      if (request.includes('正视') || request.includes('正面')) cameraName = '正视角';
      
      operations.push({
        type: 'set_camera',
        params: { cameraName: cameraName, duration: 2 },
        description: `切换到${cameraName}机位`,
        priority: 3,
        estimatedDuration: 3
      });
    }

    // 高亮效果相关
    if (request.includes('高亮') || request.includes('标记') || request.includes('突出')) {
      const targetObjects = this.extractTargetObjects(request, sceneData);
      const color = this.extractColor(request) || '#ff0000';
      
      if (targetObjects.length > 0) {
        operations.push({
          type: 'highlight_objects',
          params: { objects: targetObjects, color: color },
          description: `高亮标记对象: ${targetObjects.slice(0,2).join(', ')}${targetObjects.length > 2 ? '等' : ''}`,
          priority: 4,
          estimatedDuration: 1
        });
      }
    }

    // 清空高亮相关
    if (request.includes('清空高亮') || request.includes('取消高亮') || request.includes('清除标记')) {
      operations.push({
        type: 'clear_highlight',
        params: {},
        description: '清空所有高亮效果',
        priority: 4,
        estimatedDuration: 1
      });
    }

    return operations;
  }

  /**
   * 查找调试对象
   */
  findDebugObjects(sceneData) {
    const debugObjects = [];
    
    if (sceneData.components?.nodes) {
      sceneData.components.nodes.forEach(node => {
        if (node.name && (
          node.name.includes('debug') ||
          node.name.includes('Debug') ||
          node.name.includes('marker') ||
          node.name.includes('Marker') ||
          node.name.includes('selectBox') ||
          node.name.includes('Rect') ||
          node.name.includes('helper') ||
          node.name.includes('Helper')
        )) {
          debugObjects.push(node.id || node.name);
        }
      });
    }
    
    return debugObjects;
  }

  /**
   * 从请求中提取目标对象
   */
  extractTargetObjects(request, sceneData) {
    const targetObjects = [];
    
    // 特定设备名称匹配
    const deviceKeywords = ['贴片机', '设备', '机器', '传感器', '摄像头', '灯光', '管道', 'equipment', 'device', 'sensor', 'camera', 'light', 'pipe'];
    
    if (sceneData.components?.nodes) {
      sceneData.components.nodes.forEach(node => {
        if (node.name) {
          // 检查是否包含特定关键词
          for (const keyword of deviceKeywords) {
            if (request.includes(keyword) && node.name.toLowerCase().includes(keyword.toLowerCase())) {
              targetObjects.push(node.id || node.name);
              break;
            }
          }
          
          // 特殊处理：如果请求中包含具体的设备名称
          if (request.includes('贴片机') && node.name.includes('贴片机')) {
            targetObjects.push(node.id || node.name);
          }
        }
      });
    }
    
    // 如果没有找到特定对象，尝试查找通用对象
    if (targetObjects.length === 0 && sceneData.components?.nodes) {
      const visibleMeshes = sceneData.components.nodes
        .filter(node => node.type === 'Mesh' && node.isVisible)
        .slice(0, 3); // 限制数量
      
      targetObjects.push(...visibleMeshes.map(mesh => mesh.id || mesh.name));
    }
    
    return targetObjects;
  }

  /**
   * 从请求中提取颜色
   */
  extractColor(request) {
    const colorMap = {
      '红色': '#ff0000',
      '绿色': '#00ff00', 
      '蓝色': '#0000ff',
      '黄色': '#ffff00',
      '橙色': '#ff8800',
      '紫色': '#8800ff',
      '红': '#ff0000',
      '绿': '#00ff00',
      '蓝': '#0000ff',
      '黄': '#ffff00'
    };
    
    for (const [keyword, color] of Object.entries(colorMap)) {
      if (request.includes(keyword)) {
        return color;
      }
    }
    
    return null;
  }

  /**
   * 处理原子操作历史
   */
  async handleAtomicOperationHistory(args) {
    const {
      action = 'list',
      operationId,
      limit = 20,
      serverUrl = 'ws://localhost:8081/animation'
    } = args;

    try {
      const serverPort = serverUrl.includes(':8081') ? '8081' : '8080';
      
      switch (action) {
        case 'list':
          // 获取服务器状态，间接了解操作历史
          const statusResponse = await fetch(`http://localhost:${serverPort}/api/status`);
          if (!statusResponse.ok) {
            throw new Error('无法获取服务器状态');
          }
          
          const statusData = await statusResponse.json();
          
          let text = `📋 原子操作历史记录\n\n`;
          text += `**服务器状态:**\n`;
          text += `- 运行状态: ${statusData.isRunning ? '✅ 运行中' : '❌ 已停止'}\n`;
          text += `- 连接客户端: ${statusData.connectedClients}\n`;
          text += `- 活跃场景: ${statusData.totalScenes}\n`;
          text += `- 运行时间: ${Math.floor(statusData.uptime / 3600)}小时${Math.floor((statusData.uptime % 3600) / 60)}分钟\n\n`;
          
          text += `💡 **说明:** 原子操作历史存储在客户端，需要通过翠鸟场景检查器查看详细记录。\n\n`;
          text += `**可用操作:**\n`;
          text += `- 使用 \`atomic_operation_history\` 工具的 \`revert\` 操作回滚指定操作\n`;
          text += `- 使用 \`scene_inspect\` 工具查看当前场景状态\n`;
          text += `- 查看浏览器控制台了解详细的操作日志`;
          
          return {
            content: [{ type: "text", text: text }]
          };

        case 'revert':
          if (!operationId) {
            throw new Error('回滚操作需要提供operationId');
          }
          
          const revertResponse = await fetch(`http://localhost:${serverPort}/api/atomic/revert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationId })
          });

          if (!revertResponse.ok) {
            throw new Error(`回滚请求失败: ${revertResponse.statusText}`);
          }

          const revertResult = await revertResponse.json();
          
          let revertText = `↩️ 原子操作回滚\n\n`;
          revertText += `**操作ID:** ${operationId}\n`;
          revertText += `**回滚状态:** ${revertResult.success ? '✅ 成功' : '❌ 失败'}\n`;
          revertText += `**服务器响应:** ${revertResult.message}\n`;
          revertText += `**影响客户端:** ${revertResult.clients} 个\n\n`;
          revertText += `💡 **说明:** 回滚命令已发送到翠鸟场景检查器，请在浏览器中查看效果。`;
          
          return {
            content: [{ type: "text", text: revertText }]
          };

        case 'clear':
          let clearText = `🗑️ 清空操作历史\n\n`;
          clearText += `**状态:** 功能开发中\n`;
          clearText += `**说明:** 操作历史存储在客户端，可通过刷新页面重置历史记录。`;
          
          return {
            content: [{ type: "text", text: clearText }]
          };

        default:
          throw new Error(`不支持的历史操作: ${action}`);
      }

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ 操作历史管理失败：${error.message}\n\n**可能的原因：**\n1. 动画服务器未运行\n2. 操作ID不存在\n3. 网络连接问题`
        }],
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