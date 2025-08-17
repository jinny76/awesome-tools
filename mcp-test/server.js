#!/usr/bin/env node

/**
 * API Test MCP Server
 * 专门用于API自动化测试的MCP服务器
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import yaml from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据存储路径
const DATA_DIR = join(__dirname, 'test-data');
const ENVS_FILE = join(DATA_DIR, 'environments.json');
const SUITES_DIR = join(DATA_DIR, 'suites');
const RESULTS_DIR = join(DATA_DIR, 'results');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');

/**
 * API Test MCP Server
 */
class ApiTestMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "api-test",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.activeEnvironment = null;
    this.authToken = null;
    this.testContext = new Map(); // 存储测试上下文数据
    
    this.setupToolHandlers();
    this.initializeDataDirectories();
    this.loadActiveEnvironment();
  }

  /**
   * 初始化数据目录
   */
  async initializeDataDirectories() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.mkdir(SUITES_DIR, { recursive: true });
      await fs.mkdir(RESULTS_DIR, { recursive: true });
      await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
      
      // 初始化环境配置文件
      try {
        await fs.access(ENVS_FILE);
      } catch {
        await fs.writeFile(ENVS_FILE, JSON.stringify({ environments: [], active: null }, null, 2));
      }
    } catch (error) {
      console.error('Failed to initialize data directories:', error);
    }
  }

  /**
   * 加载活动环境
   */
  async loadActiveEnvironment() {
    try {
      const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
      
      if (data.environments.length === 1) {
        // 如果只有一个环境，自动设为活动环境
        this.activeEnvironment = data.environments[0];
        data.active = data.environments[0].name;
        await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
      } else if (data.active) {
        // 如果有多个环境且设置了活动环境
        const env = data.environments.find(e => e.name === data.active);
        if (env) {
          this.activeEnvironment = env;
        }
      }
    } catch (error) {
      // 文件不存在或读取失败，忽略错误
    }
  }

  /**
   * 设置工具处理器
   */
  setupToolHandlers() {
    // 注册工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // === 环境配置管理 ===
          {
            name: "test_env_create",
            description: "创建测试环境配置",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "环境名称"
                },
                baseUrl: {
                  type: "string",
                  description: "API基础URL"
                },
                swaggerUrl: {
                  type: "string",
                  description: "Swagger文档URL路径"
                },
                authConfig: {
                  type: "object",
                  description: "认证配置",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["jwt", "session", "basic"],
                      description: "认证类型"
                    },
                    loginEndpoint: {
                      type: "string",
                      description: "登录接口路径"
                    },
                    username: {
                      type: "string",
                      description: "用户名"
                    },
                    password: {
                      type: "string",
                      description: "密码"
                    },
                    tokenField: {
                      type: "string",
                      description: "响应中token字段名"
                    },
                    headerName: {
                      type: "string",
                      description: "请求头名称"
                    },
                    headerPrefix: {
                      type: "string",
                      description: "请求头前缀"
                    }
                  }
                },
                database: {
                  type: "object",
                  description: "数据库配置",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["mysql", "postgres"],
                      description: "数据库类型"
                    },
                    host: {
                      type: "string",
                      description: "数据库主机"
                    },
                    port: {
                      type: "number",
                      description: "数据库端口"
                    },
                    database: {
                      type: "string",
                      description: "数据库名"
                    },
                    user: {
                      type: "string",
                      description: "用户名"
                    },
                    password: {
                      type: "string",
                      description: "密码"
                    }
                  }
                }
              },
              required: ["name", "baseUrl"]
            }
          },
          {
            name: "test_env_list",
            description: "列出所有测试环境",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "test_env_get",
            description: "获取指定环境配置",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "环境名称"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "test_env_set_active",
            description: "设置当前活动环境",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "环境名称"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "test_env_delete",
            description: "删除测试环境",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "环境名称"
                }
              },
              required: ["name"]
            }
          },
          
          // === API信息获取 ===
          {
            name: "api_fetch_swagger",
            description: "获取Swagger/OpenAPI文档（智能分块返回）",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "Swagger文档URL（可选，默认使用当前环境配置）"
                },
                section: {
                  type: "string",
                  enum: ["info", "servers", "tags", "paths", "components", "all"],
                  description: "返回文档的特定部分（info=基本信息，paths=接口路径，components=组件定义，all=完整但简化版本）",
                  default: "all"
                }
              }
            }
          },
          {
            name: "api_get_swagger_summary",
            description: "获取Swagger文档摘要信息（基本信息、tag列表、接口数量统计）",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "Swagger文档URL（可选，默认使用当前环境配置）"
                }
              }
            }
          },
          {
            name: "api_get_service_apis",
            description: "获取指定服务的所有接口及完整参数说明（包含请求参数、响应格式等详细信息）",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "Swagger文档URL（可选，默认使用当前活动环境的配置）"
                },
                tag: {
                  type: "string",
                  description: "服务标签过滤器（可选，如: '用户管理' 只返回用户相关接口）"
                },
                includeExamples: {
                  type: "boolean",
                  description: "是否包含请求/响应示例",
                  default: true
                }
              }
            }
          },
          {
            name: "api_parse_controllers",
            description: "解析并返回所有Controller列表",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "Swagger文档URL（可选，默认使用当前环境配置）"
                },
                swaggerDoc: {
                  type: "object",
                  description: "Swagger文档对象（可选，不提供则自动获取）"
                }
              }
            }
          },
          {
            name: "api_get_endpoints",
            description: "获取指定Controller的所有端点信息",
            inputSchema: {
              type: "object",
              properties: {
                controller: {
                  type: "string",
                  description: "Controller名称或标签"
                },
                swaggerDoc: {
                  type: "object",
                  description: "Swagger文档对象（可选）"
                }
              },
              required: ["controller"]
            }
          },
          
          // === 认证管理 ===
          {
            name: "auth_login",
            description: "执行登录并获取认证token",
            inputSchema: {
              type: "object",
              properties: {
                username: {
                  type: "string",
                  description: "用户名（可选，默认使用环境配置）"
                },
                password: {
                  type: "string",
                  description: "密码（可选，默认使用环境配置）"
                }
              }
            }
          },
          {
            name: "auth_validate",
            description: "验证当前认证是否有效",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "auth_get_token",
            description: "获取当前认证token",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          
          // === 测试执行 ===
          {
            name: "test_execute_request",
            description: "执行单个HTTP请求并返回完整响应",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "请求URL（可以是相对路径）"
                },
                method: {
                  type: "string",
                  enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                  description: "HTTP方法"
                },
                headers: {
                  type: "object",
                  description: "请求头"
                },
                params: {
                  type: "object",
                  description: "查询参数"
                },
                body: {
                  type: "object",
                  description: "请求体"
                },
                useAuth: {
                  type: "boolean",
                  description: "是否使用认证token",
                  default: true
                },
                timeout: {
                  type: "number",
                  description: "超时时间（毫秒）",
                  default: 30000
                }
              },
              required: ["url", "method"]
            }
          },
          {
            name: "test_batch_execute",
            description: "批量执行多个测试请求",
            inputSchema: {
              type: "object",
              properties: {
                requests: {
                  type: "array",
                  description: "请求列表",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "请求ID"
                      },
                      url: {
                        type: "string",
                        description: "请求URL"
                      },
                      method: {
                        type: "string",
                        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"]
                      },
                      headers: {
                        type: "object"
                      },
                      params: {
                        type: "object"
                      },
                      body: {
                        type: "object"
                      }
                    }
                  }
                },
                batchId: {
                  type: "string",
                  description: "批次ID"
                },
                parallel: {
                  type: "boolean",
                  description: "是否并行执行",
                  default: false
                }
              },
              required: ["requests"]
            }
          },
          
          // === 测试上下文管理 ===
          {
            name: "test_context_set",
            description: "设置测试上下文数据（用于存储动态生成的ID等）",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "上下文键"
                },
                value: {
                  description: "上下文值"
                }
              },
              required: ["key", "value"]
            }
          },
          {
            name: "test_context_get",
            description: "获取测试上下文数据",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "上下文键"
                }
              },
              required: ["key"]
            }
          },
          {
            name: "test_context_clear",
            description: "清空测试上下文",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          
          // === 测试套件管理 ===
          {
            name: "test_suite_save",
            description: "保存测试套件",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "套件名称"
                },
                description: {
                  type: "string",
                  description: "套件描述"
                },
                testCases: {
                  type: "array",
                  description: "测试用例列表"
                },
                environment: {
                  type: "string",
                  description: "关联的环境"
                }
              },
              required: ["name", "testCases"]
            }
          },
          {
            name: "test_suite_list",
            description: "列出所有测试套件",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "test_suite_load",
            description: "加载指定测试套件",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "套件名称"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "test_suite_delete",
            description: "删除测试套件",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "套件名称"
                }
              },
              required: ["name"]
            }
          },
          
          // === 测试结果管理 ===
          {
            name: "test_result_save",
            description: "保存测试结果",
            inputSchema: {
              type: "object",
              properties: {
                batchId: {
                  type: "string",
                  description: "批次ID"
                },
                testCase: {
                  type: "object",
                  description: "测试用例信息"
                },
                result: {
                  type: "object",
                  description: "测试结果"
                },
                environment: {
                  type: "string",
                  description: "测试环境"
                }
              },
              required: ["batchId", "testCase", "result"]
            }
          },
          {
            name: "test_result_query",
            description: "查询测试结果",
            inputSchema: {
              type: "object",
              properties: {
                batchId: {
                  type: "string",
                  description: "批次ID"
                },
                dateFrom: {
                  type: "string",
                  description: "开始日期"
                },
                dateTo: {
                  type: "string",
                  description: "结束日期"
                },
                status: {
                  type: "string",
                  enum: ["passed", "failed", "error"],
                  description: "测试状态"
                }
              }
            }
          },
          {
            name: "test_result_summary",
            description: "获取测试结果汇总",
            inputSchema: {
              type: "object",
              properties: {
                batchId: {
                  type: "string",
                  description: "批次ID"
                }
              },
              required: ["batchId"]
            }
          },
          
          // === 数据库操作 ===
          {
            name: "db_snapshot_create",
            description: "创建数据库快照",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "快照名称"
                },
                tables: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "要备份的表列表（空则备份所有表）"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "db_snapshot_list",
            description: "列出所有数据库快照",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "db_snapshot_restore",
            description: "恢复数据库快照",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "快照名称"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "db_execute_query",
            description: "执行数据库查询（用于验证数据）",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "SQL查询语句"
                },
                params: {
                  type: "array",
                  description: "查询参数"
                }
              },
              required: ["query"]
            }
          },
          
          // === 工具函数 ===
          {
            name: "parse_application_yml",
            description: "解析Spring Boot的application.yml配置文件",
            inputSchema: {
              type: "object",
              properties: {
                filePath: {
                  type: "string",
                  description: "application.yml文件路径"
                }
              },
              required: ["filePath"]
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
          // 环境配置管理
          case "test_env_create":
            return await this.handleEnvCreate(args);
          case "test_env_list":
            return await this.handleEnvList(args);
          case "test_env_get":
            return await this.handleEnvGet(args);
          case "test_env_set_active":
            return await this.handleEnvSetActive(args);
          case "test_env_delete":
            return await this.handleEnvDelete(args);
          
          // API信息获取
          case "api_fetch_swagger":
            return await this.handleFetchSwagger(args);
          case "api_get_swagger_summary":
            return await this.handleGetSwaggerSummary(args);
          case "api_get_service_apis":
            return await this.handleGetServiceApis(args);
          case "api_parse_controllers":
            return await this.handleParseControllers(args);
          case "api_get_endpoints":
            return await this.handleGetEndpoints(args);
          
          // 认证管理
          case "auth_login":
            return await this.handleAuthLogin(args);
          case "auth_validate":
            return await this.handleAuthValidate(args);
          case "auth_get_token":
            return await this.handleAuthGetToken(args);
          
          // 测试执行
          case "test_execute_request":
            return await this.handleExecuteRequest(args);
          case "test_batch_execute":
            return await this.handleBatchExecute(args);
          
          // 测试上下文管理
          case "test_context_set":
            return await this.handleContextSet(args);
          case "test_context_get":
            return await this.handleContextGet(args);
          case "test_context_clear":
            return await this.handleContextClear(args);
          
          // 测试套件管理
          case "test_suite_save":
            return await this.handleSuiteSave(args);
          case "test_suite_list":
            return await this.handleSuiteList(args);
          case "test_suite_load":
            return await this.handleSuiteLoad(args);
          case "test_suite_delete":
            return await this.handleSuiteDelete(args);
          
          // 测试结果管理
          case "test_result_save":
            return await this.handleResultSave(args);
          case "test_result_query":
            return await this.handleResultQuery(args);
          case "test_result_summary":
            return await this.handleResultSummary(args);
          
          // 数据库操作
          case "db_snapshot_create":
            return await this.handleSnapshotCreate(args);
          case "db_snapshot_list":
            return await this.handleSnapshotList(args);
          case "db_snapshot_restore":
            return await this.handleSnapshotRestore(args);
          case "db_execute_query":
            return await this.handleExecuteQuery(args);
          
          // 工具函数
          case "parse_application_yml":
            return await this.handleParseApplicationYml(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  // === 环境配置管理实现 ===
  
  async handleEnvCreate(args) {
    const { name, baseUrl, swaggerUrl, authConfig, database } = args;
    
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    // 检查是否已存在
    if (data.environments.find(env => env.name === name)) {
      throw new Error(`Environment '${name}' already exists`);
    }
    
    const env = {
      id: uuidv4(),
      name,
      baseUrl,
      swaggerUrl: swaggerUrl || '/v3/api-docs',
      authConfig,
      database,
      createdAt: new Date().toISOString()
    };
    
    data.environments.push(env);
    
    // 如果是第一个环境，设为活动环境
    if (data.environments.length === 1) {
      data.active = name;
      this.activeEnvironment = env;
    }
    
    await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
    
    return {
      content: [{
        type: "text",
        text: `Environment '${name}' created successfully\n${JSON.stringify(env, null, 2)}`
      }]
    };
  }

  async handleEnvList(args) {
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          active: data.active,
          environments: data.environments.map(env => ({
            name: env.name,
            baseUrl: env.baseUrl,
            createdAt: env.createdAt
          }))
        }, null, 2)
      }]
    };
  }

  async handleEnvGet(args) {
    const { name } = args;
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    const env = data.environments.find(e => e.name === name);
    if (!env) {
      throw new Error(`Environment '${name}' not found`);
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(env, null, 2)
      }]
    };
  }

  async handleEnvSetActive(args) {
    const { name } = args;
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    const env = data.environments.find(e => e.name === name);
    if (!env) {
      throw new Error(`Environment '${name}' not found`);
    }
    
    data.active = name;
    this.activeEnvironment = env;
    this.authToken = null; // 清空认证token
    
    await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
    
    return {
      content: [{
        type: "text",
        text: `Active environment set to '${name}'\nBase URL: ${env.baseUrl}\nSwagger URL: ${env.baseUrl}${env.swaggerUrl}`
      }]
    };
  }

  async handleEnvDelete(args) {
    const { name } = args;
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    const index = data.environments.findIndex(e => e.name === name);
    if (index === -1) {
      throw new Error(`Environment '${name}' not found`);
    }
    
    data.environments.splice(index, 1);
    
    // 如果删除的是活动环境，清空活动环境
    if (data.active === name) {
      data.active = null;
      this.activeEnvironment = null;
      this.authToken = null;
    }
    
    await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
    
    return {
      content: [{
        type: "text",
        text: `Environment '${name}' deleted successfully`
      }]
    };
  }

  // === API信息获取实现 ===
  
  async handleFetchSwagger(args) {
    const { url, section = "all" } = args;
    
    let swaggerUrl = url;
    if (!swaggerUrl && this.activeEnvironment) {
      swaggerUrl = this.activeEnvironment.baseUrl + this.activeEnvironment.swaggerUrl;
    }
    
    if (!swaggerUrl) {
      throw new Error('No Swagger URL provided and no active environment');
    }
    
    try {
      const response = await axios.get(swaggerUrl, { timeout: 10000 });
      const doc = response.data;
      
      let result;
      
      switch (section) {
        case "info":
          result = {
            openapi: doc.openapi,
            info: doc.info,
            servers: doc.servers
          };
          break;
          
        case "servers":
          result = { servers: doc.servers };
          break;
          
        case "tags":
          result = { tags: doc.tags };
          break;
          
        case "paths":
          // 只返回路径和方法，不包含详细定义
          const simplifiedPaths = {};
          for (const [path, methods] of Object.entries(doc.paths || {})) {
            simplifiedPaths[path] = {};
            for (const [method, operation] of Object.entries(methods)) {
              simplifiedPaths[path][method] = {
                tags: operation.tags,
                summary: operation.summary,
                operationId: operation.operationId,
                description: operation.description
              };
            }
          }
          result = { paths: simplifiedPaths };
          break;
          
        case "components":
          result = { components: doc.components };
          break;
          
        case "all":
        default:
          // 返回简化版本：基本信息 + 简化的路径
          const allSimplified = {
            openapi: doc.openapi,
            info: doc.info,
            servers: doc.servers,
            tags: doc.tags,
            pathsCount: Object.keys(doc.paths || {}).length,
            paths: {}
          };
          
          // 只包含路径、方法和基本信息，不包含复杂的schema定义
          for (const [path, methods] of Object.entries(doc.paths || {})) {
            allSimplified.paths[path] = {};
            for (const [method, operation] of Object.entries(methods)) {
              allSimplified.paths[path][method] = {
                tags: operation.tags,
                summary: operation.summary,
                operationId: operation.operationId,
                description: operation.description,
                parameters: operation.parameters?.map(p => ({
                  name: p.name,
                  in: p.in,
                  required: p.required,
                  description: p.description,
                  type: p.schema?.type || p.type
                })) || []
              };
            }
          }
          
          result = allSimplified;
          break;
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to fetch Swagger: ${error.message}`);
    }
  }

  async handleGetSwaggerSummary(args) {
    const { url } = args;
    
    let swaggerUrl = url;
    if (!swaggerUrl && this.activeEnvironment) {
      swaggerUrl = this.activeEnvironment.baseUrl + this.activeEnvironment.swaggerUrl;
    }
    
    if (!swaggerUrl) {
      throw new Error('No Swagger URL provided and no active environment');
    }
    
    try {
      const response = await axios.get(swaggerUrl, { timeout: 10000 });
      const doc = response.data;
      
      // 统计接口数量
      const pathStats = {};
      let totalEndpoints = 0;
      
      for (const [path, methods] of Object.entries(doc.paths || {})) {
        for (const [method, operation] of Object.entries(methods)) {
          totalEndpoints++;
          const tag = operation.tags?.[0] || 'untagged';
          pathStats[tag] = (pathStats[tag] || 0) + 1;
        }
      }
      
      const summary = {
        openapi: doc.openapi,
        info: doc.info,
        servers: doc.servers,
        tags: doc.tags || [],
        statistics: {
          totalPaths: Object.keys(doc.paths || {}).length,
          totalEndpoints,
          endpointsByTag: pathStats
        },
        availableSections: ["info", "servers", "tags", "paths", "components"]
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(summary, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to fetch Swagger summary: ${error.message}`);
    }
  }

  async handleGetServiceApis(args) {
    const { url, tag, includeExamples = true } = args;
    
    // 确定要使用的URL
    let swaggerUrl = url;
    if (!swaggerUrl && this.activeEnvironment) {
      swaggerUrl = this.activeEnvironment.baseUrl + this.activeEnvironment.swaggerUrl;
    }
    
    if (!swaggerUrl) {
      throw new Error('No Swagger URL provided and no active environment configured');
    }
    
    try {
      // 获取完整的Swagger文档
      const response = await axios.get(swaggerUrl, { timeout: 10000 });
      const doc = response.data;
      
      if (!doc.paths) {
        throw new Error('Invalid Swagger document: no paths found');
      }
      
      const serviceApis = {
        serviceInfo: {
          title: doc.info?.title || 'Unknown Service',
          description: doc.info?.description || '',
          version: doc.info?.version || '',
          baseUrl: doc.servers?.[0]?.url || ''
        },
        apis: []
      };
      
      // 遍历所有路径和方法
      for (const [path, methods] of Object.entries(doc.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          // 如果指定了tag过滤器，只返回匹配的接口
          if (tag && (!operation.tags || !operation.tags.includes(tag))) {
            continue;
          }
          
          const apiInfo = {
            path: path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary || '',
            description: operation.description || '',
            tags: operation.tags || [],
            parameters: [],
            requestBody: null,
            responses: {}
          };
          
          // 解析参数
          if (operation.parameters) {
            for (const param of operation.parameters) {
              const paramInfo = {
                name: param.name,
                in: param.in, // query, path, header, cookie
                description: param.description || '',
                required: param.required || false,
                type: this.getParameterType(param),
                schema: param.schema
              };
              
              if (includeExamples && param.example) {
                paramInfo.example = param.example;
              }
              
              apiInfo.parameters.push(paramInfo);
            }
          }
          
          // 解析请求体
          if (operation.requestBody) {
            const requestBody = {
              description: operation.requestBody.description || '',
              required: operation.requestBody.required || false,
              contentTypes: {}
            };
            
            if (operation.requestBody.content) {
              for (const [contentType, content] of Object.entries(operation.requestBody.content)) {
                const contentInfo = {
                  type: contentType,
                  schema: content.schema
                };
                
                if (includeExamples && content.example) {
                  contentInfo.example = content.example;
                }
                
                // 解析schema为可读格式
                if (content.schema) {
                  contentInfo.structure = this.parseSchema(content.schema, doc.components?.schemas);
                }
                
                requestBody.contentTypes[contentType] = contentInfo;
              }
            }
            
            apiInfo.requestBody = requestBody;
          }
          
          // 解析响应
          if (operation.responses) {
            for (const [statusCode, response] of Object.entries(operation.responses)) {
              const responseInfo = {
                statusCode: statusCode,
                description: response.description || '',
                contentTypes: {}
              };
              
              if (response.content) {
                for (const [contentType, content] of Object.entries(response.content)) {
                  const contentInfo = {
                    type: contentType,
                    schema: content.schema
                  };
                  
                  if (includeExamples && content.example) {
                    contentInfo.example = content.example;
                  }
                  
                  // 解析schema为可读格式
                  if (content.schema) {
                    contentInfo.structure = this.parseSchema(content.schema, doc.components?.schemas);
                  }
                  
                  responseInfo.contentTypes[contentType] = contentInfo;
                }
              }
              
              apiInfo.responses[statusCode] = responseInfo;
            }
          }
          
          serviceApis.apis.push(apiInfo);
        }
      }
      
      // 添加统计信息
      serviceApis.statistics = {
        totalApis: serviceApis.apis.length,
        apisByMethod: {},
        apisByTag: {}
      };
      
      serviceApis.apis.forEach(api => {
        // 按方法统计
        serviceApis.statistics.apisByMethod[api.method] = 
          (serviceApis.statistics.apisByMethod[api.method] || 0) + 1;
        
        // 按标签统计
        api.tags.forEach(t => {
          serviceApis.statistics.apisByTag[t] = 
            (serviceApis.statistics.apisByTag[t] || 0) + 1;
        });
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(serviceApis, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get service APIs: ${error.message}`);
    }
  }
  
  // 辅助方法：获取参数类型
  getParameterType(param) {
    if (param.schema) {
      return param.schema.type || 'object';
    }
    return param.type || 'string';
  }
  
  // 辅助方法：解析Schema为可读结构
  parseSchema(schema, components = {}) {
    if (!schema) return null;
    
    // 处理引用
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      if (components[refPath]) {
        return this.parseSchema(components[refPath], components);
      }
      return { type: 'reference', ref: refPath };
    }
    
    const result = {
      type: schema.type || 'object'
    };
    
    if (schema.description) {
      result.description = schema.description;
    }
    
    // 处理对象类型
    if (schema.type === 'object' && schema.properties) {
      result.properties = {};
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        result.properties[propName] = this.parseSchema(propSchema, components);
      }
      if (schema.required) {
        result.required = schema.required;
      }
    }
    
    // 处理数组类型
    if (schema.type === 'array' && schema.items) {
      result.items = this.parseSchema(schema.items, components);
    }
    
    // 处理枚举
    if (schema.enum) {
      result.enum = schema.enum;
    }
    
    // 处理格式和约束
    if (schema.format) result.format = schema.format;
    if (schema.minimum !== undefined) result.minimum = schema.minimum;
    if (schema.maximum !== undefined) result.maximum = schema.maximum;
    if (schema.pattern) result.pattern = schema.pattern;
    
    return result;
  }

  async handleParseControllers(args) {
    const { swaggerDoc } = args;
    
    let doc = swaggerDoc;
    if (!doc) {
      // 只获取路径信息用于解析Controller
      const result = await this.handleFetchSwagger({ section: "paths" });
      const pathData = JSON.parse(result.content[0].text);
      
      // 还需要tags信息
      const tagsResult = await this.handleFetchSwagger({ section: "tags" });
      const tagsData = JSON.parse(tagsResult.content[0].text);
      
      doc = {
        paths: pathData.paths,
        tags: tagsData.tags
      };
    }
    
    const controllers = new Map();
    
    // 解析paths，按tag分组
    for (const [path, methods] of Object.entries(doc.paths || {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (operation.tags && operation.tags.length > 0) {
          const tag = operation.tags[0];
          if (!controllers.has(tag)) {
            controllers.set(tag, {
              name: tag,
              description: doc.tags?.find(t => t.name === tag)?.description || '',
              endpoints: []
            });
          }
          
          controllers.get(tag).endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: operation.summary || '',
            operationId: operation.operationId
          });
        }
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(Array.from(controllers.values()), null, 2)
      }]
    };
  }

  async handleGetEndpoints(args) {
    const { controller, swaggerDoc } = args;
    
    let doc = swaggerDoc;
    if (!doc) {
      // 获取完整的路径信息（包含详细的API定义）
      const result = await this.handleFetchSwagger({ section: "all" });
      doc = JSON.parse(result.content[0].text);
    }
    
    const endpoints = [];
    
    for (const [path, methods] of Object.entries(doc.paths || {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (operation.tags && operation.tags.includes(controller)) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: operation.summary || '',
            description: operation.description || '',
            operationId: operation.operationId,
            parameters: operation.parameters || [],
            requestBody: operation.requestBody,
            responses: operation.responses
          });
        }
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(endpoints, null, 2)
      }]
    };
  }

  // === 认证管理实现 ===
  
  async handleAuthLogin(args) {
    const { username, password } = args;
    
    if (!this.activeEnvironment) {
      throw new Error('No active environment set');
    }
    
    const authConfig = this.activeEnvironment.authConfig;
    if (!authConfig) {
      throw new Error('No auth configuration in active environment');
    }
    
    const loginUrl = this.activeEnvironment.baseUrl + authConfig.loginEndpoint;
    const loginData = {
      username: username || authConfig.username,
      password: password || authConfig.password
    };
    
    try {
      const response = await axios.post(loginUrl, loginData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // 提取token
      let token = response.data;
      if (authConfig.tokenField) {
        const fields = authConfig.tokenField.split('.');
        for (const field of fields) {
          token = token[field];
        }
      }
      
      this.authToken = token;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            token: token,
            tokenType: authConfig.type,
            message: 'Login successful'
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async handleAuthValidate(args) {
    if (!this.authToken) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            valid: false,
            message: 'No authentication token'
          }, null, 2)
        }]
      };
    }
    
    // TODO: 实际验证token有效性（调用验证接口）
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          valid: true,
          token: this.authToken,
          message: 'Token is valid'
        }, null, 2)
      }]
    };
  }

  async handleAuthGetToken(args) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          token: this.authToken,
          hasToken: !!this.authToken
        }, null, 2)
      }]
    };
  }

  // === 测试执行实现 ===
  
  async handleExecuteRequest(args) {
    const { url, method, headers = {}, params, body, useAuth = true, timeout = 30000 } = args;
    
    let fullUrl = url;
    if (!url.startsWith('http') && this.activeEnvironment) {
      fullUrl = this.activeEnvironment.baseUrl + url;
    }
    
    // 添加认证头
    const requestHeaders = { ...headers };
    if (useAuth && this.authToken && this.activeEnvironment?.authConfig) {
      const authConfig = this.activeEnvironment.authConfig;
      requestHeaders[authConfig.headerName || 'Authorization'] = 
        `${authConfig.headerPrefix || 'Bearer'} ${this.authToken}`;
    }
    
    const startTime = Date.now();
    
    try {
      const response = await axios({
        url: fullUrl,
        method,
        headers: requestHeaders,
        params,
        data: body,
        timeout,
        validateStatus: () => true // 不要抛出HTTP错误
      });
      
      const endTime = Date.now();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            request: {
              url: fullUrl,
              method,
              headers: requestHeaders,
              params,
              body
            },
            response: {
              statusCode: response.status,
              statusText: response.statusText,
              headers: response.headers,
              body: response.data,
              responseTime: endTime - startTime
            },
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            request: {
              url: fullUrl,
              method,
              headers: requestHeaders,
              params,
              body
            },
            error: {
              message: error.message,
              code: error.code
            },
            timestamp: new Date().toISOString()
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  async handleBatchExecute(args) {
    const { requests, batchId = uuidv4(), parallel = false } = args;
    
    const results = [];
    
    if (parallel) {
      // 并行执行
      const promises = requests.map(req => 
        this.handleExecuteRequest({
          ...req,
          useAuth: req.useAuth !== false
        })
      );
      
      const responses = await Promise.allSettled(promises);
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const request = requests[i];
        
        if (response.status === 'fulfilled') {
          results.push({
            id: request.id || `request_${i}`,
            ...JSON.parse(response.value.content[0].text)
          });
        } else {
          results.push({
            id: request.id || `request_${i}`,
            error: response.reason.message
          });
        }
      }
    } else {
      // 串行执行
      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        try {
          const response = await this.handleExecuteRequest({
            ...request,
            useAuth: request.useAuth !== false
          });
          
          results.push({
            id: request.id || `request_${i}`,
            ...JSON.parse(response.content[0].text)
          });
        } catch (error) {
          results.push({
            id: request.id || `request_${i}`,
            error: error.message
          });
        }
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          batchId,
          totalRequests: requests.length,
          executionMode: parallel ? 'parallel' : 'sequential',
          results
        }, null, 2)
      }]
    };
  }

  // === 测试上下文管理实现 ===
  
  async handleContextSet(args) {
    const { key, value } = args;
    
    this.testContext.set(key, value);
    
    return {
      content: [{
        type: "text",
        text: `Context '${key}' set successfully`
      }]
    };
  }

  async handleContextGet(args) {
    const { key } = args;
    
    const value = this.testContext.get(key);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          key,
          value,
          exists: this.testContext.has(key)
        }, null, 2)
      }]
    };
  }

  async handleContextClear(args) {
    const size = this.testContext.size;
    this.testContext.clear();
    
    return {
      content: [{
        type: "text",
        text: `Context cleared (${size} items removed)`
      }]
    };
  }

  // === 测试套件管理实现 ===
  
  async handleSuiteSave(args) {
    const { name, description, testCases, environment } = args;
    
    const suite = {
      id: uuidv4(),
      name,
      description,
      testCases,
      environment: environment || this.activeEnvironment?.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const filePath = join(SUITES_DIR, `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(suite, null, 2));
    
    return {
      content: [{
        type: "text",
        text: `Test suite '${name}' saved successfully`
      }]
    };
  }

  async handleSuiteList(args) {
    const files = await fs.readdir(SUITES_DIR);
    const suites = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(join(SUITES_DIR, file), 'utf8');
        const suite = JSON.parse(content);
        suites.push({
          name: suite.name,
          description: suite.description,
          testCaseCount: suite.testCases.length,
          environment: suite.environment,
          createdAt: suite.createdAt
        });
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(suites, null, 2)
      }]
    };
  }

  async handleSuiteLoad(args) {
    const { name } = args;
    
    const filePath = join(SUITES_DIR, `${name}.json`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    } catch (error) {
      throw new Error(`Test suite '${name}' not found`);
    }
  }

  async handleSuiteDelete(args) {
    const { name } = args;
    
    const filePath = join(SUITES_DIR, `${name}.json`);
    
    try {
      await fs.unlink(filePath);
      return {
        content: [{
          type: "text",
          text: `Test suite '${name}' deleted successfully`
        }]
      };
    } catch (error) {
      throw new Error(`Test suite '${name}' not found`);
    }
  }

  // === 测试结果管理实现 ===
  
  async handleResultSave(args) {
    const { batchId, testCase, result, environment } = args;
    
    const resultData = {
      id: uuidv4(),
      batchId,
      testCase,
      result,
      environment: environment || this.activeEnvironment?.name,
      timestamp: new Date().toISOString()
    };
    
    const fileName = `${batchId}_${Date.now()}.json`;
    const filePath = join(RESULTS_DIR, fileName);
    
    await fs.writeFile(filePath, JSON.stringify(resultData, null, 2));
    
    return {
      content: [{
        type: "text",
        text: `Test result saved: ${fileName}`
      }]
    };
  }

  async handleResultQuery(args) {
    const { batchId, dateFrom, dateTo, status } = args;
    
    const files = await fs.readdir(RESULTS_DIR);
    const results = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(join(RESULTS_DIR, file), 'utf8');
        const result = JSON.parse(content);
        
        // 过滤条件
        if (batchId && result.batchId !== batchId) continue;
        if (dateFrom && new Date(result.timestamp) < new Date(dateFrom)) continue;
        if (dateTo && new Date(result.timestamp) > new Date(dateTo)) continue;
        if (status && result.result.status !== status) continue;
        
        results.push(result);
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2)
      }]
    };
  }

  async handleResultSummary(args) {
    const { batchId } = args;
    
    const files = await fs.readdir(RESULTS_DIR);
    let total = 0, passed = 0, failed = 0, error = 0;
    let totalTime = 0;
    
    for (const file of files) {
      if (file.startsWith(batchId) && file.endsWith('.json')) {
        const content = await fs.readFile(join(RESULTS_DIR, file), 'utf8');
        const result = JSON.parse(content);
        
        total++;
        if (result.result.status === 'passed') passed++;
        else if (result.result.status === 'failed') failed++;
        else if (result.result.status === 'error') error++;
        
        if (result.result.responseTime) {
          totalTime += result.result.responseTime;
        }
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          batchId,
          summary: {
            total,
            passed,
            failed,
            error,
            passRate: total > 0 ? (passed / total * 100).toFixed(2) + '%' : '0%',
            averageResponseTime: total > 0 ? Math.round(totalTime / total) : 0
          }
        }, null, 2)
      }]
    };
  }

  // === 数据库操作实现 ===
  
  async handleSnapshotCreate(args) {
    const { name, tables = [] } = args;
    
    if (!this.activeEnvironment?.database) {
      throw new Error('No database configuration in active environment');
    }
    
    const db = this.activeEnvironment.database;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = join(SNAPSHOTS_DIR, `${name}_${timestamp}.sql`);
    
    // 构建mysqldump或pg_dump命令
    let dumpCmd;
    if (db.type === 'mysql') {
      dumpCmd = `mysqldump -h ${db.host} -P ${db.port} -u ${db.user} -p${db.password} ${db.database}`;
      if (tables.length > 0) {
        dumpCmd += ` ${tables.join(' ')}`;
      }
    } else if (db.type === 'postgres') {
      dumpCmd = `PGPASSWORD=${db.password} pg_dump -h ${db.host} -p ${db.port} -U ${db.user} ${db.database}`;
      if (tables.length > 0) {
        dumpCmd += tables.map(t => ` -t ${t}`).join('');
      }
    } else {
      throw new Error(`Unsupported database type: ${db.type}`);
    }
    
    try {
      const dump = execSync(dumpCmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
      await fs.writeFile(snapshotFile, dump);
      
      // 保存快照元数据
      const metaFile = join(SNAPSHOTS_DIR, `${name}_${timestamp}.meta.json`);
      await fs.writeFile(metaFile, JSON.stringify({
        name,
        timestamp,
        database: db.database,
        tables,
        size: dump.length,
        environment: this.activeEnvironment.name
      }, null, 2));
      
      return {
        content: [{
          type: "text",
          text: `Database snapshot '${name}' created successfully`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }
  }

  async handleSnapshotList(args) {
    const files = await fs.readdir(SNAPSHOTS_DIR);
    const snapshots = [];
    
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const content = await fs.readFile(join(SNAPSHOTS_DIR, file), 'utf8');
        snapshots.push(JSON.parse(content));
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(snapshots, null, 2)
      }]
    };
  }

  async handleSnapshotRestore(args) {
    const { name } = args;
    
    if (!this.activeEnvironment?.database) {
      throw new Error('No database configuration in active environment');
    }
    
    const db = this.activeEnvironment.database;
    
    // 查找快照文件
    const files = await fs.readdir(SNAPSHOTS_DIR);
    const snapshotFile = files.find(f => f.startsWith(`${name}_`) && f.endsWith('.sql'));
    
    if (!snapshotFile) {
      throw new Error(`Snapshot '${name}' not found`);
    }
    
    const snapshotPath = join(SNAPSHOTS_DIR, snapshotFile);
    
    // 构建恢复命令
    let restoreCmd;
    if (db.type === 'mysql') {
      restoreCmd = `mysql -h ${db.host} -P ${db.port} -u ${db.user} -p${db.password} ${db.database} < ${snapshotPath}`;
    } else if (db.type === 'postgres') {
      restoreCmd = `PGPASSWORD=${db.password} psql -h ${db.host} -p ${db.port} -U ${db.user} ${db.database} < ${snapshotPath}`;
    } else {
      throw new Error(`Unsupported database type: ${db.type}`);
    }
    
    try {
      execSync(restoreCmd, { encoding: 'utf8' });
      
      return {
        content: [{
          type: "text",
          text: `Database snapshot '${name}' restored successfully`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to restore snapshot: ${error.message}`);
    }
  }

  async handleExecuteQuery(args) {
    const { query, params = [] } = args;
    
    if (!this.activeEnvironment?.database) {
      throw new Error('No database configuration in active environment');
    }
    
    const db = this.activeEnvironment.database;
    
    // 构建查询命令
    let queryCmd;
    if (db.type === 'mysql') {
      queryCmd = `mysql -h ${db.host} -P ${db.port} -u ${db.user} -p${db.password} ${db.database} -e "${query}"`;
    } else if (db.type === 'postgres') {
      queryCmd = `PGPASSWORD=${db.password} psql -h ${db.host} -p ${db.port} -U ${db.user} ${db.database} -c "${query}"`;
    } else {
      throw new Error(`Unsupported database type: ${db.type}`);
    }
    
    try {
      const result = execSync(queryCmd, { encoding: 'utf8' });
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  // === 工具函数实现 ===
  
  async handleParseApplicationYml(args) {
    const { filePath } = args;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const config = yaml.parse(content);
      
      // 提取有用的配置信息
      const extracted = {
        server: {
          port: config.server?.port || 8080,
          contextPath: config.server?.servlet?.['context-path'] || ''
        },
        spring: {
          datasource: config.spring?.datasource,
          security: config.spring?.security
        },
        api: {
          swagger: config.springdoc?.['api-docs']?.path || '/v3/api-docs'
        }
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(extracted, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to parse application.yml: ${error.message}`);
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
    const server = new ApiTestMCPServer();
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