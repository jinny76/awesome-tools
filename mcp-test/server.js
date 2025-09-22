#!/usr/bin/env node

// UTF-8 support for Windows console
// Note: MCP uses stdio transport, encoding handled by MCP SDK

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
import mysql from 'mysql2/promise';
import pg from 'pg';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据存储路径 - 使用被测试项目的目录而不是工具目录
// 优先级：启动参数 > 环境变量 > 当前工作目录
let projectDir = process.cwd();
const projectDirArg = process.argv.find(arg => arg.startsWith('--project-dir='));
if (projectDirArg) {
  projectDir = projectDirArg.split('=')[1];
} else if (process.argv.includes('--project-dir') && process.argv[process.argv.indexOf('--project-dir') + 1]) {
  projectDir = process.argv[process.argv.indexOf('--project-dir') + 1];
}

const DATA_DIR = process.env.API_TEST_DATA_DIR || join(projectDir, '.api-test');
const ENVS_FILE = join(DATA_DIR, 'environments.json');
const SUITES_DIR = join(DATA_DIR, 'suites');
const RESULTS_DIR = join(DATA_DIR, 'results');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');
const CHAT_CACHE_DIR = join(DATA_DIR, 'chat-cache');
const CHAT_CACHE_FILE = join(CHAT_CACHE_DIR, 'groups.json');
const CHAT_CACHE_CHECK_INTERVAL = 30 * 1000; // 30 秒
const CHAT_SESSION_FETCH_INTERVAL = 60 * 1000; // 60 秒


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
    this.chatCachePath = CHAT_CACHE_FILE;
    this.chatCache = null;
    this.chatCacheIndex = new Map();
    this.chatCacheMtime = 0;
    this.chatCacheLastCheck = 0;
    this.chatCacheCheckInterval = CHAT_CACHE_CHECK_INTERVAL;
    this.chatSessionActivity = new Map();
    this.chatSessionLastFetch = 0;
    this.chatSessionFetchInterval = CHAT_SESSION_FETCH_INTERVAL;

    this.setupToolHandlers();
    this.initializeDataDirectories();
    this.loadActiveEnvironment();
  }


  /**
   * 初始化数据目录
   */
  async initializeDataDirectories() {
    try {
      // 输出数据存储路径信息
      console.error(`[API Test MCP] Project directory: ${projectDir}`);
      console.error(`[API Test MCP] Data directory: ${DATA_DIR}`);

      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.mkdir(SUITES_DIR, { recursive: true });
      await fs.mkdir(RESULTS_DIR, { recursive: true });
      await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
      await fs.mkdir(CHAT_CACHE_DIR, { recursive: true });

      await this.refreshChatCache(true, { includeSession: false }).catch(() => {});

      // 初始化环境配置文件
      try {
        await fs.access(ENVS_FILE);
      } catch {
        await fs.writeFile(ENVS_FILE, JSON.stringify({ environments: [], active: null }, null, 2));
      }

      console.error(`[API Test MCP] Initialized successfully`);
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
  /**
   * 刷新聊天缓存
   */
  async refreshChatCache(force = false, { includeSession = true } = {}) {
    const now = Date.now();

    if (!force && now - this.chatCacheLastCheck < this.chatCacheCheckInterval) {
      if (includeSession) {
        await this.refreshSessionActivity(false);
      }
      return this.chatCache;
    }

    this.chatCacheLastCheck = now;

    try {
      const stat = await fs.stat(this.chatCachePath);
      if (!this.chatCache || stat.mtimeMs !== this.chatCacheMtime) {
        const raw = await fs.readFile(this.chatCachePath, 'utf8');
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed.groups)) {
          this.chatCache = parsed;
          this.chatCacheMtime = stat.mtimeMs;
          this.chatCacheIndex = new Map();
          parsed.groups.forEach(group => {
            if (group && group.id) {
              this.chatCacheIndex.set(group.id, group);
            }
          });
          console.error(`[ChatCache] 已加载缓存，共 ${parsed.groups.length} 个群组`);
        } else {
          console.error('[ChatCache] 缓存文件缺少 groups 字段');
          this.chatCache = null;
          this.chatCacheIndex = new Map();
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.chatCache = null;
        this.chatCacheIndex = new Map();
        this.chatCacheMtime = 0;
      } else {
        console.error('[ChatCache] 读取缓存失败:', error.message);
      }
    }

    if (includeSession) {
      await this.refreshSessionActivity(force);
    }

    return this.chatCache;
  }

  /**
   * 通过 Chatlog session 接口刷新活跃度
   */
  async refreshSessionActivity(force = false) {
    const now = Date.now();

    if (!force && now - this.chatSessionLastFetch < this.chatSessionFetchInterval) {
      return this.chatSessionActivity;
    }

    const chatServerUrl = this.getChatServerBaseUrl();
    if (!chatServerUrl) {
      return this.chatSessionActivity;
    }

    try {
      const response = await axios.get(`${chatServerUrl}/api/v1/session`, {
        params: { format: 'json' },
        timeout: 10000
      });
      const sessions = this.normalizeSessionList(response.data);
      const activityMap = new Map();

      sessions.forEach(session => {
        const info = this.extractSessionActivity(session);
        if (info && info.timestamp) {
          activityMap.set(info.id, info);
        }
      });

      this.chatSessionActivity = activityMap;
      this.chatSessionLastFetch = now;

      if (activityMap.size > 0) {
        console.error(`[ChatCache] Session 活跃度已刷新 (${activityMap.size} 条记录)`);
      }
    } catch (error) {
      console.error('[ChatCache] 更新 session 活跃度失败:', error.message);
    }

    return this.chatSessionActivity;
  }

  normalizeSessionList(data) {
    if (!data) {
      return [];
    }
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data.sessions)) {
      return data.sessions;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.list)) {
      return data.list;
    }
    if (typeof data === 'object') {
      return Object.values(data);
    }
    return [];
  }

  extractSessionActivity(session) {
    if (!session) {
      return null;
    }
    const id = session.talker || session.id || session.name;
    if (!id) {
      return null;
    }
    const timestamp = this.resolveSessionTimestampValue(session);
    if (!timestamp) {
      return null;
    }
    const iso = new Date(timestamp).toISOString();
    const previewSource = session.lastMessage || session.preview || session.summary || '';
    return {
      id,
      name: session.displayName || session.nickname || session.talkerName || id,
      timestamp,
      iso,
      preview: this.truncateText(previewSource, 80),
      unread: session.unread || session.unreadCount || 0
    };
  }

  resolveSessionTimestampValue(session) {
    const isoFields = [
      session.lastMessageTime,
      session.lastTime,
      session.time,
      session.lastActive
    ];

    for (const iso of isoFields) {
      if (iso) {
        const parsed = Date.parse(iso);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    const numericFields = [
      'timestamp',
      'lastMessageUnix',
      'lastMsgTime',
      'lastMessageTimestamp'
    ];

    for (const field of numericFields) {
      const numeric = Number(session[field]);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric > 1e12 ? numeric : numeric * 1000;
      }
    }

    return 0;
  }

  truncateText(text, maxLength = 80) {
    if (!text) {
      return '';
    }
    const normalized = String(text).trim().replace(/\s+/g, ' ');
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 3)}...`;
  }

  getCachedGroupInfo(groupId) {
    if (!groupId) {
      return null;
    }
    return this.chatCacheIndex.get(groupId) || null;
  }

  getCacheTimestampFromEntry(entry) {
    if (!entry) {
      return 0;
    }
    if (entry.lastActive) {
      const parsed = Date.parse(entry.lastActive);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    if (entry.lastMessageRawTime) {
      const numeric = Number(entry.lastMessageRawTime);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric > 1e12 ? numeric : numeric * 1000;
      }
    }
    if (entry.lastMessage && entry.lastMessage.time) {
      const parsed = Date.parse(entry.lastMessage.time);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  getCacheTimestampForId(groupId) {
    const cacheEntry = this.getCachedGroupInfo(groupId);
    const cacheTs = this.getCacheTimestampFromEntry(cacheEntry);
    const sessionEntry = this.chatSessionActivity.get(groupId);
    const sessionTs = sessionEntry?.timestamp || 0;
    return Math.max(cacheTs, sessionTs);
  }

  prepareGroupCacheHints(groups = []) {
    const hints = [];

    groups.forEach(group => {
      const groupId = group?.name || group?.id || group?.talker;
      const cacheEntry = groupId ? this.getCachedGroupInfo(groupId) : null;
      const sessionEntry = groupId ? this.chatSessionActivity.get(groupId) : null;
      const activityTimestamp = groupId ? Math.max(
        this.getCacheTimestampFromEntry(cacheEntry),
        sessionEntry?.timestamp || 0
      ) : 0;

      hints.push({
        group,
        groupId,
        cacheEntry,
        sessionEntry,
        activityTimestamp,
        displayName: cacheEntry?.name || group?.displayName || group?.nickname || groupId || '未知群组'
      });
    });

    hints.sort((a, b) => b.activityTimestamp - a.activityTimestamp);

    const hintMap = new Map();
    hints.forEach(hint => {
      if (hint.groupId) {
        hintMap.set(hint.groupId, hint);
      }
    });

    return {
      orderedGroups: hints.map(hint => hint.group),
      hintMap,
      hints
    };
  }

  getTopCachedGroups(limit = 10) {
    const merged = new Map();

    this.chatCacheIndex.forEach((entry, id) => {
      const timestamp = this.getCacheTimestampFromEntry(entry);
      const iso = entry.lastActive || (timestamp ? new Date(timestamp).toISOString() : null);
      merged.set(id, {
        id,
        name: entry.name || entry.alias || id,
        timestamp,
        lastActive: iso,
        source: 'cache',
        preview: entry.lastMessage?.preview || null
      });
    });

    this.chatSessionActivity.forEach((sessionEntry, id) => {
      if (!sessionEntry || !sessionEntry.timestamp) {
        return;
      }
      const existing = merged.get(id);
      if (!existing || sessionEntry.timestamp > existing.timestamp) {
        merged.set(id, {
          id,
          name: sessionEntry.name || existing?.name || id,
          timestamp: sessionEntry.timestamp,
          lastActive: sessionEntry.iso,
          source: existing ? `${existing.source}+session` : 'session',
          preview: sessionEntry.preview || existing?.preview || null
        });
      }
    });

    const list = Array.from(merged.values()).filter(item => item.timestamp > 0);
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list.slice(0, limit);
  }

  formatCacheSummary(limit = 5) {
    const top = this.getTopCachedGroups(limit);
    if (top.length === 0) {
      return '缓存中没有可用的群组活跃信息。';
    }

    let text = `缓存中最近活跃的群组（前 ${top.length} 个）：`;
    top.forEach((item, index) => {
      text += `
${index + 1}. ${item.name} (${item.id})`;
      text += `
   最近活跃: ${item.lastActive || '未知'}`;
      text += `
   来源: ${item.source}`;
      if (item.preview) {
        text += `
   摘要: ${this.truncateText(item.preview, 60)}`;
      }
    });

    return text;
  }

  async handleChatCacheRefresh(args = {}) {
    const force = Boolean(args.force);
    const includeSession = args.includeSession !== false;

    if (includeSession) {
      this.chatSessionLastFetch = 0;
    }

    const cache = await this.refreshChatCache(force, { includeSession });
    const cacheCount = cache?.groups?.length || 0;
    const sessionCount = this.chatSessionActivity?.size || 0;
    const summary = this.formatCacheSummary(5);

    return {
      content: [{
        type: 'text',
        text: `缓存文件: ${this.chatCachePath}
缓存群组: ${cacheCount}
session 活跃记录: ${sessionCount}

${summary}`
      }]
    };
  }

  async handleChatCacheTop(args = {}) {
    const limit = Number.isFinite(Number(args.limit)) && Number(args.limit) > 0
      ? Number(args.limit)
      : 10;

    await this.refreshChatCache(false, { includeSession: true });
    const summary = this.formatCacheSummary(limit);

    return {
      content: [{
        type: 'text',
        text: summary
      }]
    };
  }

  setupToolHandlers() {
    // 注册工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // === 环境状态查询 ===
          {
            name: "test_env_get_active",
            description: "获取当前活动环境信息（只读）",
            inputSchema: {
              type: "object",
              properties: {}
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
          {
            name: "auth_set_token",
            description: "手动设置认证token（用于已知token的情况）",
            inputSchema: {
              type: "object",
              properties: {
                token: {
                  type: "string",
                  description: "认证token"
                },
                tokenType: {
                  type: "string",
                  enum: ["jwt", "session", "basic", "bearer"],
                  description: "Token类型（可选，默认根据环境配置）"
                }
              },
              required: ["token"]
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
          {
            name: "test_context_keys",
            description: "获取测试上下文所有键名",
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
                },
                dropExisting: {
                  type: "boolean",
                  description: "是否删除现有表后恢复（默认false，只清空数据）",
                  default: false
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

          // === 聊天缓存工具 ===
          {
            name: "chat_cache_refresh",
            description: "重新加载 Chatlog 群组缓存，可选刷新 session 活跃度",
            inputSchema: {
              type: "object",
              properties: {
                force: {
                  type: "boolean",
                  description: "是否强制重新读取缓存文件"
                },
                includeSession: {
                  type: "boolean",
                  description: "是否同时刷新 session 活跃度（默认 true）",
                  default: true
                }
              }
            }
          },
          {
            name: "chat_cache_top",
            description: "查看缓存中最近活跃的群组列表",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "integer",
                  description: "返回的群组数量",
                  default: 10
                }
              }
            }
          },

          // === 聊天群组查询 ===
          {
            name: "chat_active_groups",
            description: "查询微信群组，支持关键字过滤和数量限制",
            inputSchema: {
              type: "object",
              properties: {
                keyword: {
                  type: "string",
                  description: "群名关键词过滤（可选，如：'翠鸟' 将匹配所有包含'翠鸟'的群）"
                },
                limit: {
                  type: "integer",
                  description: "返回群组数量限制（默认10，最大50）",
                  default: 10,
                  minimum: 1,
                  maximum: 50
                }
              }
            }
          },

          // === 日志查询 ===
          {
            name: "log_list",
            description: "获取系统中所有可用的日志文件信息",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "log_query",
            description: "根据条件搜索日志内容，支持分页、关键词搜索、日志级别过滤、时间范围过滤等",
            inputSchema: {
              type: "object",
              properties: {
                fileName: {
                  type: "string",
                  description: "要查询的日志文件名",
                  default: "app.log"
                },
                keyword: {
                  type: "string",
                  description: "搜索关键词"
                },
                level: {
                  type: "string",
                  description: "日志级别（如：ERROR, WARN, INFO, DEBUG）"
                },
                startTime: {
                  type: "string",
                  description: "开始时间（ISO格式：2024-01-18T10:00:00）"
                },
                endTime: {
                  type: "string",
                  description: "结束时间（ISO格式：2024-01-18T12:00:00）"
                },
                page: {
                  type: "integer",
                  description: "页码",
                  default: 1
                },
                size: {
                  type: "integer",
                  description: "每页大小",
                  default: 100
                },
                regex: {
                  type: "boolean",
                  description: "是否使用正则表达式搜索",
                  default: false
                }
              }
            }
          },
          {
            name: "log_tail",
            description: "获取日志文件的最后N行，类似于Linux的tail命令",
            inputSchema: {
              type: "object",
              properties: {
                fileName: {
                  type: "string",
                  description: "日志文件名",
                  default: "app.log"
                },
                lines: {
                  type: "integer",
                  description: "获取的行数",
                  default: 100
                }
              }
            }
          },
          {
            name: "log_download",
            description: "下载指定的日志文件",
            inputSchema: {
              type: "object",
              properties: {
                fileName: {
                  type: "string",
                  description: "要下载的日志文件名"
                },
                saveToFile: {
                  type: "string",
                  description: "保存到本地文件路径（可选，如果指定则保存到文件，否则返回内容）"
                }
              },
              required: ["fileName"]
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
      console.error(`[DEBUG] 收到工具调用请求: ${name}`);
      console.error(`[DEBUG] 工具参数:`, JSON.stringify(args));

      try {
        switch (name) {
          // 环境状态查询
          case "test_env_get_active":
            return await this.handleEnvGetActive(args);

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
          case "auth_validate":
            return await this.handleAuthValidate(args);
          case "auth_get_token":
            return await this.handleAuthGetToken(args);
          case "auth_set_token":
            return await this.handleAuthSetToken(args);

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
          case "test_context_keys":
            return await this.handleContextKeys(args);

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

          // 聊天记录查询
          case "chat_cache_refresh":
            return await this.handleChatCacheRefresh(args);
          case "chat_cache_top":
            return await this.handleChatCacheTop(args);
          case "chat_active_groups":
            return await this.handleChatActiveGroups(args);

          // 日志查询
          case "log_list":
            return await this.handleLogList(args);
          case "log_query":
            return await this.handleLogQuery(args);
          case "log_tail":
            return await this.handleLogTail(args);
          case "log_download":
            return await this.handleLogDownload(args);

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

  // === 环境状态查询实现 ===

  async handleEnvGetActive(args) {
    if (!this.activeEnvironment) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            active: null,
            message: "No active environment set. Please use 'ats api-test --wizard' to configure environments."
          }, null, 2)
        }]
      };
    }

    // 构建环境信息，包含测试用户信息供Claude使用
    const envInfo = {
      active: this.activeEnvironment.name,
      baseUrl: this.activeEnvironment.baseUrl,
      swaggerUrl: this.activeEnvironment.swaggerUrl,
      logServerUrl: this.getLogServerBaseUrl(),
      chatServerUrl: this.getChatServerBaseUrl(),
      hasAuth: !!this.activeEnvironment.authConfig,
      hasDatabase: !!this.activeEnvironment.database,
      hasLogServer: !!this.activeEnvironment.logServerUrl,
      authType: this.activeEnvironment.authConfig?.type,
      authenticated: !!this.authToken
    };

    // 添加认证配置信息供Claude自动登录使用
    if (this.activeEnvironment.authConfig) {
      envInfo.authConfig = {
        type: this.activeEnvironment.authConfig.type,
        loginEndpoint: this.activeEnvironment.authConfig.loginEndpoint,
        username: this.activeEnvironment.authConfig.username,
        password: this.activeEnvironment.authConfig.password, // 包含密码供测试使用
        tokenField: this.activeEnvironment.authConfig.tokenField,
        headerName: this.activeEnvironment.authConfig.headerName,
        headerPrefix: this.activeEnvironment.authConfig.headerPrefix
      };
    }

    // 添加数据库配置信息供数据操作使用
    if (this.activeEnvironment.database) {
      envInfo.database = {
        type: this.activeEnvironment.database.type,
        host: this.activeEnvironment.database.host,
        port: this.activeEnvironment.database.port,
        database: this.activeEnvironment.database.database,
        user: this.activeEnvironment.database.user,
        password: this.activeEnvironment.database.password // 包含密码供测试使用
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(envInfo, null, 2)
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
          hasToken: !!this.authToken,
          tokenType: this.activeEnvironment?.authConfig?.type || 'unknown'
        }, null, 2)
      }]
    };
  }

  async handleAuthSetToken(args) {
    const { token, tokenType } = args;

    if (!token) {
      throw new Error('Token is required');
    }

    // 验证token格式（基本验证）
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('Token must be a non-empty string');
    }

    // 如果提供了tokenType，验证是否与环境配置匹配
    if (tokenType && this.activeEnvironment?.authConfig?.type) {
      const envTokenType = this.activeEnvironment.authConfig.type;
      if (tokenType !== envTokenType && tokenType !== 'bearer') {
        console.warn(`Warning: Provided token type '${tokenType}' doesn't match environment config '${envTokenType}'`);
      }
    }

    this.authToken = token.trim();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: 'Authentication token set successfully',
          tokenType: tokenType || this.activeEnvironment?.authConfig?.type || 'bearer',
          tokenLength: this.authToken.length,
          tokenPreview: this.authToken.substring(0, 20) + '...'
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

    // 设置用户指定的键值对
    this.testContext.set(key, value);

    // 自动设置当前日期相关信息
    const now = new Date();
    this.testContext.set('current_date', now.toISOString().split('T')[0]); // YYYY-MM-DD
    this.testContext.set('current_datetime', now.toISOString()); // ISO格式完整时间
    this.testContext.set('current_timestamp', now.getTime()); // Unix时间戳
    this.testContext.set('current_date_cn', now.toLocaleDateString('zh-CN')); // 中文日期格式

    return {
      content: [{
        type: "text",
        text: `Context '${key}' set successfully. Auto-updated date context: ${now.toISOString().split('T')[0]}`
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

  async handleContextKeys(args) {
    const keys = Array.from(this.testContext.keys());

    // 将键按类型分组
    const autoKeys = keys.filter(key => key.startsWith('current_'));
    const userKeys = keys.filter(key => !key.startsWith('current_'));

    let output = `测试上下文键列表 (共 ${keys.length} 个):\n\n`;

    if (autoKeys.length > 0) {
      output += '📅 自动日期键:\n';
      autoKeys.forEach(key => {
        const value = this.testContext.get(key);
        output += `  - ${key}: ${value}\n`;
      });
      output += '\n';
    }

    if (userKeys.length > 0) {
      output += '👤 用户自定义键:\n';
      userKeys.forEach(key => {
        const value = this.testContext.get(key);
        const displayValue = typeof value === 'string' && value.length > 50
          ? value.substring(0, 50) + '...'
          : value;
        output += `  - ${key}: ${displayValue}\n`;
      });
    }

    if (keys.length === 0) {
      output = '上下文为空，没有存储任何数据';
    }

    return {
      content: [{
        type: "text",
        text: output
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

  // === 数据库连接辅助函数 ===

  async createDatabaseConnection(dbConfig) {
    if (dbConfig.type === 'mysql') {
      return await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
      });
    } else if (dbConfig.type === 'postgres') {
      const client = new pg.Client({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
      });
      await client.connect();
      return client;
    } else {
      throw new Error(`Unsupported database type: ${dbConfig.type}`);
    }
  }

  async closeDatabaseConnection(connection, dbType) {
    if (dbType === 'mysql') {
      await connection.end();
    } else if (dbType === 'postgres') {
      await connection.end();
    }
  }

  // === 数据库操作实现 ===

  async handleSnapshotCreate(args) {
    const { name, tables = [] } = args;

    if (!this.activeEnvironment?.database) {
      throw new Error('No database configuration in active environment');
    }

    const db = this.activeEnvironment.database;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = join(SNAPSHOTS_DIR, `${name}_${timestamp}.json`);

    let connection;
    try {
      connection = await this.createDatabaseConnection(db);

      // 获取要备份的表列表
      let targetTables = tables;
      if (targetTables.length === 0) {
        // 如果没有指定表，获取所有表
        if (db.type === 'mysql') {
          const [rows] = await connection.execute('SHOW TABLES');
          targetTables = rows.map(row => Object.values(row)[0]);
        } else if (db.type === 'postgres') {
          const result = await connection.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
          targetTables = result.rows.map(row => row.tablename);
        }
      }

      // 备份数据
      const backupData = {
        metadata: {
          name,
          timestamp,
          database: db.database,
          tables: targetTables,
          environment: this.activeEnvironment.name,
          dbType: db.type
        },
        tables: {}
      };

      for (const tableName of targetTables) {
        console.error(`[DB Backup] Backing up table: ${tableName}`);

        // 获取表结构
        let createTableSQL = '';
        if (db.type === 'mysql') {
          const [rows] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
          createTableSQL = rows[0]['Create Table'];
        } else if (db.type === 'postgres') {
          // PostgreSQL 表结构获取比较复杂，这里简化处理
          const result = await connection.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public'
            ORDER BY ordinal_position
          `, [tableName]);

          const columns = result.rows.map(col =>
            `${col.column_name} ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`
          ).join(', ');
          createTableSQL = `CREATE TABLE ${tableName} (${columns})`;
        }

        // 获取表数据
        let tableData = [];
        if (db.type === 'mysql') {
          const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
          tableData = rows;
        } else if (db.type === 'postgres') {
          const result = await connection.query(`SELECT * FROM "${tableName}"`);
          tableData = result.rows;
        }

        backupData.tables[tableName] = {
          structure: createTableSQL,
          data: tableData,
          rowCount: tableData.length
        };
      }

      // 保存备份文件
      await fs.writeFile(snapshotFile, JSON.stringify(backupData, null, 2));

      // 保存快照元数据
      const metaFile = join(SNAPSHOTS_DIR, `${name}_${timestamp}.meta.json`);
      await fs.writeFile(metaFile, JSON.stringify(backupData.metadata, null, 2));

      const totalRows = Object.values(backupData.tables).reduce((sum, table) => sum + table.rowCount, 0);

      return {
        content: [{
          type: "text",
          text: `Database snapshot '${name}' created successfully\nTables: ${targetTables.length}\nTotal rows: ${totalRows}\nFile: ${snapshotFile}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    } finally {
      if (connection) {
        await this.closeDatabaseConnection(connection, db.type);
      }
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
    const { name, dropExisting = false } = args;

    if (!this.activeEnvironment?.database) {
      throw new Error('No database configuration in active environment');
    }

    const db = this.activeEnvironment.database;

    // 查找快照文件
    const files = await fs.readdir(SNAPSHOTS_DIR);
    const snapshotFile = files.find(f => f.startsWith(`${name}_`) && f.endsWith('.json'));

    if (!snapshotFile) {
      throw new Error(`Snapshot '${name}' not found`);
    }

    const snapshotPath = join(SNAPSHOTS_DIR, snapshotFile);

    let connection;
    try {
      // 读取备份数据
      const backupData = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));

      if (backupData.metadata.dbType !== db.type) {
        throw new Error(`Snapshot database type (${backupData.metadata.dbType}) doesn't match current environment (${db.type})`);
      }

      connection = await this.createDatabaseConnection(db);

      let restoredTables = 0;
      let restoredRows = 0;

      for (const [tableName, tableData] of Object.entries(backupData.tables)) {
        console.error(`[DB Restore] Restoring table: ${tableName}`);

        if (dropExisting) {
          // 删除现有表
          try {
            if (db.type === 'mysql') {
              await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
            } else if (db.type === 'postgres') {
              await connection.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
            }
          } catch (error) {
            console.error(`[DB Restore] Warning: Failed to drop table ${tableName}: ${error.message}`);
          }
        }

        // 清空表数据（如果表存在）
        try {
          if (db.type === 'mysql') {
            await connection.execute(`TRUNCATE TABLE \`${tableName}\``);
          } else if (db.type === 'postgres') {
            await connection.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
          }
        } catch (error) {
          // 表可能不存在，尝试创建
          if (dropExisting) {
            try {
              if (db.type === 'mysql') {
                await connection.execute(tableData.structure);
              } else if (db.type === 'postgres') {
                await connection.query(tableData.structure);
              }
            } catch (createError) {
              console.error(`[DB Restore] Warning: Failed to create table ${tableName}: ${createError.message}`);
            }
          }
        }

        // 恢复数据
        if (tableData.data && tableData.data.length > 0) {
          // 获取列名
          const columns = Object.keys(tableData.data[0]);

          if (db.type === 'mysql') {
            const placeholders = columns.map(() => '?').join(', ');
            const columnList = columns.map(col => `\`${col}\``).join(', ');
            const insertSQL = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;

            for (const row of tableData.data) {
              const values = columns.map(col => row[col]);
              await connection.execute(insertSQL, values);
            }
          } else if (db.type === 'postgres') {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const columnList = columns.map(col => `"${col}"`).join(', ');
            const insertSQL = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

            for (const row of tableData.data) {
              const values = columns.map(col => row[col]);
              await connection.query(insertSQL, values);
            }
          }

          restoredRows += tableData.data.length;
        }

        restoredTables++;
      }

      return {
        content: [{
          type: "text",
          text: `Database snapshot '${name}' restored successfully\nTables restored: ${restoredTables}\nRows restored: ${restoredRows}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to restore snapshot: ${error.message}`);
    } finally {
      if (connection) {
        await this.closeDatabaseConnection(connection, db.type);
      }
    }
  }

  async handleExecuteQuery(args) {
    const { query, params = [] } = args;

    if (!this.activeEnvironment?.database) {
      throw new Error('No database configuration in active environment');
    }

    const db = this.activeEnvironment.database;

    let connection;
    try {
      connection = await this.createDatabaseConnection(db);

      let result;
      let affectedRows = 0;

      if (db.type === 'mysql') {
        const [rows, fields] = await connection.execute(query, params);

        // 检查是否是SELECT查询
        if (Array.isArray(rows)) {
          result = {
            rows: rows,
            fields: fields ? fields.map(f => ({
              name: f.name,
              type: f.type,
              length: f.length
            })) : [],
            rowCount: rows.length
          };
        } else {
          // INSERT, UPDATE, DELETE 等操作
          affectedRows = rows.affectedRows || 0;
          result = {
            affectedRows,
            insertId: rows.insertId || null,
            message: `Query executed successfully. ${affectedRows} row(s) affected.`
          };
        }
      } else if (db.type === 'postgres') {
        const queryResult = await connection.query(query, params);

        if (queryResult.rows) {
          result = {
            rows: queryResult.rows,
            fields: queryResult.fields ? queryResult.fields.map(f => ({
              name: f.name,
              type: f.dataTypeID,
              length: f.dataTypeSize
            })) : [],
            rowCount: queryResult.rows.length
          };
        } else {
          affectedRows = queryResult.rowCount || 0;
          result = {
            affectedRows,
            message: `Query executed successfully. ${affectedRows} row(s) affected.`
          };
        }
      }

      // 格式化输出
      let output = '';
      if (result.rows) {
        // SELECT 查询结果
        if (result.rows.length === 0) {
          output = 'No rows returned.';
        } else {
          // 创建表格输出
          const headers = Object.keys(result.rows[0]);
          const maxWidths = headers.map(header =>
            Math.max(header.length, ...result.rows.map(row =>
              String(row[header] || '').length
            ))
          );

          // 表头
          output += '|' + headers.map((header, i) =>
            ` ${header.padEnd(maxWidths[i])} `
          ).join('|') + '|\n';

          // 分隔线
          output += '|' + maxWidths.map(width =>
            '-'.repeat(width + 2)
          ).join('|') + '|\n';

          // 数据行
          result.rows.forEach(row => {
            output += '|' + headers.map((header, i) =>
              ` ${String(row[header] || '').padEnd(maxWidths[i])} `
            ).join('|') + '|\n';
          });

          output += `\n${result.rowCount} row(s) returned.`;
        }
      } else {
        // INSERT/UPDATE/DELETE 结果
        output = result.message;
      }

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    } finally {
      if (connection) {
        await this.closeDatabaseConnection(connection, db.type);
      }
    }
  }

  // === 聊天记录查询实现 ===

  /**
   * 获取聊天服务器的基础URL
   */
  getChatServerBaseUrl() {
    return 'http://127.0.0.1:5030';
  }

  /**
   * 延迟函数
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 带重试机制的HTTP请求
   */
  async fetchWithRetry(url, config, maxRetries = 3, context = '') {
    console.error(`[DEBUG] fetchWithRetry 开始: ${context} - ${url}`);
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.error(`[DEBUG] ${context} 尝试请求 ${attempt}/${maxRetries}`);

        const response = await axios.get(url, config);
        console.error(`[DEBUG] ${context} 请求成功，状态: ${response.status}`);

        if (attempt > 1) {
        }

        return response;
      } catch (error) {
        lastError = error;
        const isNetworkError = error.code === 'ECONNRESET' ||
                              error.code === 'ECONNREFUSED' ||
                              error.code === 'ETIMEDOUT' ||
                              error.message.includes('timeout');

        if (attempt < maxRetries && isNetworkError) {
          // 指数退避：第一次重试等待1秒，第二次等待2秒
          const delayMs = attempt * 1000;
          await this.delay(delayMs);
        } else if (attempt < maxRetries) {
          // 非网络错误，短暂延迟后重试
          await this.delay(500);
        }
      }
    }

    // 所有重试都失败了
    throw lastError;
  }

  // === 日志查询实现 ===

  /**
   * 获取日志服务器的基础URL
   */
  getLogServerBaseUrl() {
    // 从环境配置中获取日志服务器URL
    if (this.activeEnvironment?.logServerUrl) {
      return this.activeEnvironment.logServerUrl;
    }

    // 如果环境配置中没有，使用baseUrl + 默认日志路径
    if (this.activeEnvironment?.baseUrl) {
      return this.activeEnvironment.baseUrl.replace(/\/api\/?$/, '');
    }

    // 最后的默认值
    return 'http://localhost:38181';
  }

  /**
   * 处理查询最近活动的微信群组 - 基于缓存数据
   */
  async handleChatActiveGroups(args) {
    console.error('[DEBUG] 开始处理活动群组查询请求');
    console.error('[DEBUG] 接收到的参数:', JSON.stringify(args));

    const {
      keyword = '',
      limit = 10
    } = args;
    
    // 验证limit参数
    const actualLimit = Math.max(1, Math.min(50, limit));
    console.error(`[DEBUG] 使用limit: ${actualLimit}`);

    // 刷新缓存（包括session数据）
    await this.refreshChatCache(false, { includeSession: true });

    console.error('[DEBUG] 开始从缓存获取群组数据');
    
    // 从缓存中获取所有群组数据
    let allGroups = [];
    if (this.chatCache && this.chatCache.groups && Array.isArray(this.chatCache.groups)) {
      allGroups = this.chatCache.groups.map(room => ({
        id: room.name || room.id,
        name: room.nickName || room.displayName || room.nickname || `群组(${(room.name || room.id).split('@')[0]})`,
        owner: room.owner || '未知',
        userCount: room.users ? room.users.length : 0,
        remark: room.remark || '',
        lastMessageTime: room.lastActive || room.lastMessageRawTime || room.lastMessage?.time || null,
        lastMessagePreview: room.lastMessage?.preview || null,
        senderName: room.lastMessage?.senderName || null
      }));
    }

    console.error(`[DEBUG] 从缓存获取到 ${allGroups.length} 个群聊`);

    // 关键词过滤
    let filteredGroups = allGroups;
    if (keyword && keyword.trim()) {
      const searchKeyword = keyword.trim().toLowerCase();
      filteredGroups = allGroups.filter(group => 
        group.name.toLowerCase().includes(searchKeyword) ||
        group.id.toLowerCase().includes(searchKeyword) ||
        (group.remark && group.remark.toLowerCase().includes(searchKeyword))
      );
      console.error(`[DEBUG] 关键词"${keyword}"过滤后找到 ${filteredGroups.length} 个群聊`);
    }

    // 按最后消息时间排序（有聊天记录的在前面）
    let sortedGroups = [...filteredGroups].sort((a, b) => {
      const aTime = a.lastMessageTime;
      const bTime = b.lastMessageTime;
      
      // 如果一个有时间，另一个没有，有时间的排在前面
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;
      
      // 如果都没有时间，保持原顺序
      if (!aTime && !bTime) return 0;
      
      // 如果都有时间，按时间倒序排列（最新的在前）
      return new Date(bTime) - new Date(aTime);
    });

    console.error(`[DEBUG] 排序后共有 ${sortedGroups.length} 个群聊`);

    // 限制返回数量
    const resultGroups = sortedGroups.slice(0, actualLimit);

    // 格式化输出
    let output = `微信群组列表\n`;
    if (keyword) {
      output += `关键词过滤: ${keyword}\n`;
    }
    output += `返回数量: ${resultGroups.length}/${sortedGroups.length}\n`;
    output += `${'='.repeat(60)}\n\n`;

    if (resultGroups.length === 0) {
      output += '没有找到符合条件的群组。\n';
    } else {
      resultGroups.forEach((group, index) => {
        output += `${index + 1}. ${group.name}\n`;
        output += `   群组ID: ${group.id}\n`;
        output += `   成员数: ${group.userCount}\n`;
        output += `   群主: ${group.owner || '未知'}\n`;
        
        if (group.remark) {
          output += `   备注: ${group.remark}\n`;
        }
        
        if (group.lastMessageTime) {
          const lastTime = new Date(group.lastMessageTime);
          output += `   最后消息时间: ${lastTime.toLocaleString('zh-CN')}\n`;
          
          if (group.senderName) {
            output += `   最后发言人: ${group.senderName}\n`;
          }
          
          if (group.lastMessagePreview) {
            output += `   最后消息: ${group.lastMessagePreview}\n`;
          }
        }
        
        output += '\n';
      });
    }

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  }

  /**
   * 处理获取日志文件列表
   */
  async handleLogList(args) {
    const logServerUrl = this.getLogServerBaseUrl();

    try {
      const response = await axios.get(`${logServerUrl}/api/logs/list`, {
        timeout: 10000
      });

      // 格式化输出日志文件列表
      let output = `日志文件列表 (服务器: ${logServerUrl}):\n`;
      output += '='.repeat(60) + '\n';

      if (Array.isArray(response.data) && response.data.length > 0) {
        response.data.forEach((file, index) => {
          output += `${index + 1}. ${file.fileName}\n`;
          output += `   大小: ${(file.size / 1024).toFixed(1)} KB\n`;
          output += `   修改时间: ${file.lastModified}\n`;
          output += `   路径: ${file.path}\n`;
          output += `   压缩: ${file.compressed ? '是' : '否'}\n\n`;
        });
      } else {
        output += '未找到任何日志文件。\n';
      }

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.status === 404
        ? `日志服务器不可用 (${logServerUrl}). 请检查服务器是否启动或环境配置中的logServerUrl是否正确。`
        : `获取日志文件列表失败: ${error.message}`;
      throw new Error(errorMsg);
    }
  }

  /**
   * 处理日志查询
   */
  async handleLogQuery(args) {
    const {
      fileName = 'app.log',
      keyword,
      level,
      startTime,
      endTime,
      page = 1,
      size = 100,
      regex = false
    } = args;

    const logServerUrl = this.getLogServerBaseUrl();

    // 构建查询参数
    const queryParams = {
      fileName,
      page,
      size,
      regex
    };

    if (keyword) queryParams.keyword = keyword;
    if (level) queryParams.level = level;
    if (startTime) queryParams.startTime = startTime;
    if (endTime) queryParams.endTime = endTime;

    try {
      const response = await axios.post(`${logServerUrl}/api/logs/query`, queryParams, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // 格式化输出，提供更好的可读性
      const data = response.data;
      let output = `日志查询结果：\n`;
      output += `文件: ${fileName}\n`;
      output += `总计: ${data.total} 条日志\n`;
      output += `页码: ${data.page}/${Math.ceil(data.total / data.size)}\n`;
      output += `每页: ${data.size} 条\n`;
      output += `更多: ${data.hasMore ? '是' : '否'}\n\n`;

      if (data.logs && data.logs.length > 0) {
        output += '--- 日志内容 ---\n';
        data.logs.forEach((log, index) => {
          output += `${index + 1}. [${log.timestamp}] [${log.level}] ${log.message}\n`;
          if (log.thread) output += `   线程: ${log.thread}\n`;
          if (log.logger) output += `   记录器: ${log.logger}\n`;
          if (log.lineNumber) output += `   行号: ${log.lineNumber}\n`;
          output += '\n';
        });
      } else {
        output += '未找到匹配的日志记录。\n';
      }

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.status === 404
        ? `日志服务器不可用 (${logServerUrl}). 请检查服务器是否启动或环境配置是否正确。`
        : `日志查询失败: ${error.message}`;
      throw new Error(errorMsg);
    }
  }

  /**
   * 处理日志tail操作
   */
  async handleLogTail(args) {
    const { fileName = 'app.log', lines = 100 } = args;
    const logServerUrl = this.getLogServerBaseUrl();

    try {
      const response = await axios.get(`${logServerUrl}/api/logs/tail`, {
        params: {
          fileName,
          lines
        },
        timeout: 10000
      });

      let output = `最新 ${lines} 行日志 - ${fileName}:\n`;
      output += '='.repeat(60) + '\n';

      if (Array.isArray(response.data) && response.data.length > 0) {
        response.data.forEach((line, index) => {
          output += `${(index + 1).toString().padStart(4, ' ')} | ${line}\n`;
        });
      } else {
        output += '日志文件为空或不存在。\n';
      }

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.status === 404
        ? `日志服务器不可用或日志文件不存在 (${logServerUrl}/${fileName}). 请检查服务器状态和文件名。`
        : `获取日志尾部失败: ${error.message}`;
      throw new Error(errorMsg);
    }
  }

  /**
   * 处理日志下载
   */
  async handleLogDownload(args) {
    const { fileName, saveToFile } = args;
    const logServerUrl = this.getLogServerBaseUrl();

    try {
      const response = await axios.get(`${logServerUrl}/api/logs/download/${fileName}`, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      if (saveToFile) {
        // 保存到文件
        await fs.writeFile(saveToFile, response.data);

        return {
          content: [{
            type: "text",
            text: `日志文件 '${fileName}' 已下载到: ${saveToFile}\n文件大小: ${response.data.length} 字节`
          }]
        };
      } else {
        // 返回内容（注意：二进制文件可能不适合直接显示）
        const isTextFile = fileName.endsWith('.log') || fileName.endsWith('.txt');

        if (isTextFile && response.data.length < 50000) {
          // 如果是文本日志文件且不太大，直接返回内容
          const content = Buffer.from(response.data).toString('utf8');

          return {
            content: [{
              type: "text",
              text: `日志文件内容 - ${fileName}:\n${'='.repeat(60)}\n${content}`
            }]
          };
        } else {
          // 文件太大或是二进制文件，只返回基本信息
          return {
            content: [{
              type: "text",
              text: `日志文件 '${fileName}' 下载完成\n文件大小: ${response.data.length} 字节\n类型: ${isTextFile ? '文本文件' : '二进制文件'}\n\n提示: 文件较大，建议使用 saveToFile 参数保存到本地文件。`
            }]
          };
        }
      }
    } catch (error) {
      const errorMsg = error.response?.status === 404
        ? `日志文件不存在 (${fileName}) 或服务器不可用 (${logServerUrl}). 请检查文件名和服务器状态。`
        : `下载日志文件失败: ${error.message}`;
      throw new Error(errorMsg);
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
    console.error('[DEBUG] MCP服务器开始启动...');
    const transport = new StdioServerTransport();
    console.error('[DEBUG] 正在连接StdioServerTransport...');
    await this.server.connect(transport);
    console.error('[DEBUG] MCP服务器连接完成');

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
