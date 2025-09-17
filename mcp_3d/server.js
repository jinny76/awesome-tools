#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// 默认动画服务器配置
const DEFAULT_SERVER_URL = 'ws://localhost:8080/animation';
const PORT_RANGE = { start: 8080, end: 8095 };

// 活动服务器端口缓存
let activeServerPort = null;
let lastPortCheckTime = 0;
const PORT_CHECK_INTERVAL = 30000; // 30秒重新检查端口

// 创建MCP服务器
const server = new Server(
  {
    name: "awesome-tools-mcp-3d",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 辅助函数：检测端口是否可用
async function checkPort(port) {
  try {
    const testUrl = `http://localhost:${port}/api/status`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 增加到2秒超时

    const response = await fetch(testUrl, {
      signal: controller.signal,
      method: 'GET'
    });
    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    return false;
  }
}

// 辅助函数：查找可用的服务器端口
async function findAvailablePort() {
  const now = Date.now();

  // 如果缓存的端口仍然有效且未超时，直接返回
  if (activeServerPort && (now - lastPortCheckTime) < PORT_CHECK_INTERVAL) {
    const isStillActive = await checkPort(activeServerPort);
    if (isStillActive) {
      return activeServerPort;
    }
  }

  // 扫描端口范围
  console.error(`正在扫描端口 ${PORT_RANGE.start}-${PORT_RANGE.end} 查找动画服务器...`);

  for (let port = PORT_RANGE.start; port <= PORT_RANGE.end; port++) {
    if (await checkPort(port)) {
      console.error(`✅ 找到活动的动画服务器在端口: ${port}`);
      activeServerPort = port;
      lastPortCheckTime = now;
      return port;
    }
  }

  return null;
}

// 辅助函数：获取HTTP API URL
async function getHttpApiUrl(serverUrl, endpoint) {
  // 如果用户指定了URL，从中提取端口
  if (serverUrl && serverUrl !== DEFAULT_SERVER_URL) {
    const match = serverUrl.match(/:(\d+)/);
    if (match) {
      const port = match[1];
      return `http://localhost:${port}/api${endpoint}`;
    }
  }

  // 否则自动查找可用端口
  const port = await findAvailablePort();
  if (!port) {
    throw new Error(`无法找到活动的动画服务器 (已尝试端口 ${PORT_RANGE.start}-${PORT_RANGE.end})`);
  }

  return `http://localhost:${port}/api${endpoint}`;
}

// 工具定义
const tools = [
  {
    name: "scene_list",
    description: "获取所有3D场景列表，包含场景ID、名称、状态和最后心跳时间",
    inputSchema: {
      type: "object",
      properties: {
        includeInactive: {
          type: "boolean",
          description: "是否包含非活动场景",
          default: false
        },
        serverUrl: {
          type: "string",
          description: "动画服务器URL（可选，自动检测）",
          default: DEFAULT_SERVER_URL
        }
      },
      required: []
    }
  },
  {
    name: "scene_switch",
    description: "切换当前活动的3D场景",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "要切换到的场景ID"
        },
        serverUrl: {
          type: "string",
          description: "动画服务器URL（可选，自动检测）",
          default: DEFAULT_SERVER_URL
        }
      },
      required: ["sceneId"]
    }
  },
  {
    name: "scene_cleanup",
    description: "清理超时或指定的3D场景",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "指定要清理的场景ID（可选，不指定则清理所有超时场景）"
        },
        maxAge: {
          type: "number",
          description: "最大非活跃时间（秒）",
          default: 300
        },
        serverUrl: {
          type: "string",
          description: "动画服务器URL（可选，自动检测）",
          default: DEFAULT_SERVER_URL
        }
      },
      required: []
    }
  },
  {
    name: "scene_analyze",
    description: "分析指定3D场景的详细信息，包括节点数量、性能指标等",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "要分析的场景ID（不指定则分析当前场景）"
        },
        components: {
          type: "array",
          description: "要分析的组件类型, 分别有item(基础), global(全局), meshes(网格), materials(材质), textures(贴图), lights(灯光), cameras(机位), animations(动画), performance(性能), suggestions(建议)",
          items: {
            type: "string",
            enum: ["basic",  "global", "meshes", "materials", "textures", "lights", "cameras", "animations", "performance", "suggestions"]
          },
          default: ["basic", "global", "meshes", "materials", "performance"]
        },
        detailed: {
          type: "boolean",
          description: "是否返回详细信息",
          default: false
        },
        serverUrl: {
          type: "string",
          description: "动画服务器URL（可选，自动检测）",
          default: DEFAULT_SERVER_URL
        }
      },
      required: []
    }
  },
  {
    name: "script_execute",
    description: "在指定3D场景中执行自定义JavaScript脚本",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "要执行的JavaScript代码"
        },
        sceneId: {
          type: "string",
          description: "场景ID（可选，默认为当前场景）"
        },
        timeout: {
          type: "number",
          description: "执行超时时间（毫秒）",
          default: 5000
        },
        serverUrl: {
          type: "string",
          description: "动画服务器URL（可选，自动检测）",
          default: DEFAULT_SERVER_URL
        }
      },
      required: ["script"]
    }
  }
];

// 处理列出工具请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

// 处理调用工具请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "scene_list":
        return await handleSceneList(args);
      case "scene_switch":
        return await handleSceneSwitch(args);
      case "scene_cleanup":
        return await handleSceneCleanup(args);
      case "scene_analyze":
        return await handleSceneAnalyze(args);
      case "script_execute":
        return await handleScriptExecute(args);
      default:
        throw new Error(`未知的工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ 错误: ${error.message}`
      }],
      isError: true
    };
  }
});

// 工具处理函数
async function handleSceneList({ includeInactive = false, serverUrl = DEFAULT_SERVER_URL }) {
  try {
    const apiUrl = await getHttpApiUrl(serverUrl, '/scenes');

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const scenes = await response.json();

    // 过滤场景
    const now = Date.now();
    const filteredScenes = scenes.filter(scene => {
      if (includeInactive) return true;
      return scene.isActive && scene.lastHeartbeat && (now - scene.lastHeartbeat) < 60000;
    });

    let text = `🎬 3D场景列表\n\n`;
    text += `**服务器端口:** ${activeServerPort || '自动检测'}\n`;
    text += `**总数:** ${filteredScenes.length} 个场景\n\n`;

    if (filteredScenes.length === 0) {
      text += "暂无活跃场景";
    } else {
      filteredScenes.forEach((scene, index) => {
        const isActive = scene.isActive && scene.lastHeartbeat && (now - scene.lastHeartbeat) < 60000;
        text += `**${index + 1}. ${scene.nickname || scene.uniqueId}**\n`;
        text += `- ID: ${scene.uniqueId}\n`;
        text += `- 状态: ${isActive ? '✅ 活跃' : '⏸️ 非活跃'}\n`;
        text += `- 最后心跳: ${scene.lastHeartbeat ? new Date(scene.lastHeartbeat).toLocaleString('zh-CN') : '无'}\n`;
        if (scene.metadata) {
          text += `- 元数据: ${JSON.stringify(scene.metadata)}\n`;
        }
        text += '\n';
      });
    }

    return {
      content: [{
        type: "text",
        text: text
      }]
    };
  } catch (error) {
    throw new Error(`获取场景列表失败: ${error.message}\n\n请确保动画服务器正在运行 (ats as --port 8080-8095)`);
  }
}

async function handleSceneSwitch({ sceneId, serverUrl = DEFAULT_SERVER_URL }) {
  try {
    const apiUrl = await getHttpApiUrl(serverUrl, '/scene/switch');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uniqueId: sceneId })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      content: [{
        type: "text",
        text: `🔄 场景切换完成\n\n**目标场景:** ${sceneId}\n**状态:** ${result.success ? '✅ 成功' : '❌ 失败'}\n${result.message ? `**消息:** ${result.message}` : ''}`
      }]
    };
  } catch (error) {
    throw new Error(`切换场景失败: ${error.message}`);
  }
}

async function handleSceneCleanup({ sceneId, maxAge = 300, serverUrl = DEFAULT_SERVER_URL }) {
  try {
    const apiUrl = await getHttpApiUrl(serverUrl, '/scene/cleanup');

    const body = sceneId ? { uniqueId: sceneId } : { maxAge };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    let text = `🧹 场景清理完成\n\n`;
    if (sceneId) {
      text += `**清理场景:** ${sceneId}\n`;
    } else {
      text += `**清理条件:** 超过 ${maxAge} 秒未活跃的场景\n`;
    }
    text += `**清理数量:** ${result.cleaned || 0} 个场景\n`;
    if (result.sceneIds && result.sceneIds.length > 0) {
      text += `**清理的场景ID:** ${result.sceneIds.join(', ')}`;
    }

    return {
      content: [{
        type: "text",
        text: text
      }]
    };
  } catch (error) {
    throw new Error(`清理场景失败: ${error.message}`);
  }
}

async function handleSceneAnalyze({ sceneId, components = ["basic", "meshes", "materials", "performance"], detailed = false, serverUrl = DEFAULT_SERVER_URL }) {
  try {
    const apiUrl = await getHttpApiUrl(serverUrl, '/scene/inspect');

    // 确保sceneId是字符串格式
    const uniqueId = sceneId ? String(sceneId) : undefined;

    console.error(`[MCP-3D] 开始场景分析请求: ${apiUrl}`);
    console.error(`[MCP-3D] 请求参数:`, { uniqueId, components, detailed });

    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[MCP-3D] 场景分析请求超时 (10秒)`);
      controller.abort();
    }, 10000); // 10秒超时

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uniqueId,
        components,
        detailed
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.error(`[MCP-3D] 收到响应: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MCP-3D] 错误响应内容:`, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.error(`[MCP-3D] 响应结果:`, { success: result.success, hasData: !!result.data });

    if (!result.success) {
      throw new Error(result.error || result.message || '场景分析失败');
    }

    // 返回格式化的分析结果
    return {
      content: [{
        type: "text",
        text: `📊 场景分析结果\n\n**服务器端口:** ${activeServerPort}\n**场景ID:** ${uniqueId || '当前场景'}\n\n\`\`\`json\n${JSON.stringify(result.data || result.result || result, null, 2)}\n\`\`\``
      }]
    };
  } catch (error) {
    console.error(`[MCP-3D] 场景分析失败:`, error);

    if (error.name === 'AbortError') {
      throw new Error(`场景分析超时: 请求超过10秒未响应\n\n可能原因:\n1. 场景数据过大，需要更长处理时间\n2. 动画服务器负载过高\n3. 网络连接不稳定\n4. 请求ID匹配问题\n\n建议:\n- 减少分析组件数量 (当前: ${components.join(', ')})\n- 重试请求\n- 检查服务器日志`);
    }

    throw new Error(`场景分析失败: ${error.message}\n\n请确保:\n1. 动画服务器正在运行 (端口: ${activeServerPort})\n2. 场景已连接到服务器\n3. 场景ID格式正确 (${sceneId ? `传入: ${sceneId}, 转换为: ${String(sceneId)}` : '未指定'})\n\n调试信息:\n- API URL: ${await getHttpApiUrl(serverUrl, '/scene/inspect')}\n- 组件: ${components.join(', ')}`);
  }
}

async function handleScriptExecute({ script, sceneId, timeout = 5000, serverUrl = DEFAULT_SERVER_URL }) {
  try {
    const apiUrl = await getHttpApiUrl(serverUrl, '/script/execute');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        script,
        uniqueId: sceneId,
        options: { timeout }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '脚本执行失败');
    }

    let text = `🎯 脚本执行完成\n\n`;
    text += `**服务器端口:** ${activeServerPort}\n`;
    text += `**脚本内容:**\n\`\`\`javascript\n${script}\n\`\`\`\n\n`;
    text += `**执行结果:**\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n`;
    if (result.executionTime !== undefined) {
      text += `\n**执行时间:** ${result.executionTime}ms`;
    }

    return {
      content: [{
        type: "text",
        text: text
      }]
    };
  } catch (error) {
    throw new Error(`脚本执行失败: ${error.message}\n\n请确保:\n1. 脚本语法正确\n2. 不包含危险操作\n3. 场景已连接`);
  }
}

// 启动服务器
async function runServer() {
  console.error("MCP 3D场景管理服务器启动中...");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("MCP 3D服务器已启动");
  console.error(`将自动扫描端口 ${PORT_RANGE.start}-${PORT_RANGE.end} 查找动画服务器`);

  // 启动时进行第一次端口扫描
  const port = await findAvailablePort();
  if (port) {
    console.error(`✅ 默认连接到端口 ${port} 的动画服务器`);
  } else {
    console.error(`⚠️  未找到活动的动画服务器，将在首次请求时重试`);
  }
}

// 运行服务器
runServer().catch((error) => {
  console.error("服务器错误:", error);
  process.exit(1);
});
