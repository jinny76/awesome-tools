const path = require('path');
const fs = require('fs/promises');
const axios = require('axios');

const DEFAULT_BASE_URL = 'http://127.0.0.1:5030';
const DEFAULT_DAYS = 365;
const DEFAULT_CHUNK_DAYS = 30;
const DEFAULT_MAX_GROUPS = 1000;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_DELAY_MS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

function resolveProjectDir(projectDirOption) {
  return projectDirOption ? path.resolve(projectDirOption) : process.cwd();
}

function resolveDataDir(projectDir) {
  return process.env.API_TEST_DATA_DIR || path.join(projectDir, '.api-test');
}

function ensureHttpBase(url) {
  if (!url) {
    return DEFAULT_BASE_URL;
  }
  return url.replace(/\/+$/, '');
}

function parseIntegerOption(value, fallback, { min, max } = {}) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  if (min !== undefined && numeric < min) {
    return min;
  }
  if (max !== undefined && numeric > max) {
    return max;
  }
  return numeric;
}

async function ensureDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function truncate(text, maxLength = 120) {
  if (!text) {
    return '';
  }
  const normalized = String(text).trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

async function sleep(ms) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(fn, { retries = 2, delayMs = 500 }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      const isNetworkError = error.code === 'ECONNRESET'
        || error.code === 'ECONNREFUSED'
        || error.code === 'ETIMEDOUT'
        || error.message?.includes('timeout');
      const wait = isNetworkError ? delayMs * (attempt + 1) : delayMs;
      await sleep(wait);
    }
  }
  throw lastError;
}

function normalizeGroupList(data) {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.items)) {
    return data.items;
  }
  if (Array.isArray(data.list)) {
    return data.list;
  }
  if (Array.isArray(data.groups)) {
    return data.groups;
  }
  if (typeof data === 'object') {
    return Object.values(data);
  }
  return [];
}

function filterGroupsByKeyword(groups, keyword) {
  if (!keyword) {
    return groups;
  }
  const lowered = keyword.toLowerCase();
  return groups.filter((group) => {
    const name = (group.nickName || group.displayName || group.nickname || group.name || '').toLowerCase();
    const remark = (group.remark || '').toLowerCase();
    return name.includes(lowered) || remark.includes(lowered);
  });
}

function normalizeMessages(data) {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  const candidateArrays = ['messages', 'items', 'list', 'data', 'records'];
  for (const key of candidateArrays) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }
  if (typeof data === 'object') {
    return Object.values(data).filter((value) => typeof value === 'object');
  }
  return [];
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveMessageTime(msg) {
  if (!msg) {
    return { timestamp: null, iso: null, raw: null };
  }

  const isoFields = [
    msg.time,
    msg.msgTime,
    msg.createTimeStr,
    msg.msgTimeStr
  ];

  for (const iso of isoFields) {
    if (iso) {
      const parsed = Date.parse(iso);
      if (!Number.isNaN(parsed)) {
        return {
          timestamp: parsed,
          iso: new Date(parsed).toISOString(),
          raw: iso
        };
      }
    }
  }

  const numericFields = [
    'createtime',
    'createTime',
    'CreateTime',
    'msgCreateTime',
    'msgCreateTimeStamp',
    'timestamp',
    'msgTimeStamp',
    'msgSvrId'
  ];

  for (const field of numericFields) {
    const numeric = toNumber(msg[field]);
    if (numeric !== null) {
      const timestamp = numeric > 1e12 ? numeric : numeric * 1000;
      return {
        timestamp,
        iso: new Date(timestamp).toISOString(),
        raw: msg[field]
      };
    }
  }

  return { timestamp: null, iso: null, raw: null };
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function inferPreviewFromType(type) {
  if (type === undefined || type === null) {
    return '[非文本消息]';
  }
  switch (Number(type)) {
    case 3:
      return '[图片]';
    case 34:
      return '[语音]';
    case 43:
      return '[视频]';
    case 47:
      return '[表情]';
    case 49:
      return '[文件或链接]';
    default:
      return '[非文本消息]';
  }
}

function buildMessageSummary(msg) {
  if (!msg) {
    return null;
  }
  const summary = {
    sender: msg.sender || msg.from || msg.talker || null,
    senderName: msg.senderName || msg.fromNick || msg.nickname || null,
    type: msg.type || msg.msgType || null,
    preview: null
  };

  const textCandidates = [
    msg.content,
    msg.text,
    msg.plain,
    msg.message,
    msg.title
  ].filter(Boolean);

  if (textCandidates.length > 0) {
    summary.preview = truncate(textCandidates[0]);
    return summary;
  }

  if (msg.contents && typeof msg.contents === 'object') {
    if (msg.contents.title) {
      summary.preview = truncate(`[文件] ${msg.contents.title}`);
      return summary;
    }
    if (msg.contents.path) {
      const fileName = String(msg.contents.path).split(/[\\/]/).pop();
      summary.preview = truncate(`[附件] ${fileName}`);
      return summary;
    }
    if (msg.contents.refer && msg.contents.refer.content) {
      summary.preview = truncate(`[引用] ${msg.contents.refer.content}`);
      return summary;
    }
  }

  summary.preview = inferPreviewFromType(summary.type);
  return summary;
}

function buildTimeRanges(totalDays, chunkSize) {
  const ranges = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effectiveTotal = Math.max(totalDays, 1);
  const effectiveChunk = Math.max(chunkSize, 1);
  const earliest = new Date(today.getTime() - (effectiveTotal - 1) * DAY_MS);

  for (let offset = 0; offset < effectiveTotal; offset += effectiveChunk) {
    const endDate = new Date(today.getTime() - offset * DAY_MS);
    let startDate = new Date(endDate.getTime() - (effectiveChunk - 1) * DAY_MS);
    if (startDate < earliest) {
      startDate = earliest;
    }

    const label = effectiveChunk === 1
      ? formatDate(startDate)
      : `${formatDate(startDate)}~${formatDate(endDate)}`;

    ranges.push({
      label,
      param: label,
      start: startDate,
      end: endDate
    });

    if (startDate.getTime() <= earliest.getTime()) {
      break;
    }
  }

  return ranges;
}

async function fetchMessagesForRange(httpClient, talker, timeParam, requestOptions) {
  const { timeout, retries, retryDelay } = requestOptions;
  const baseUrl = httpClient.defaults?.baseURL || '';
  let fullUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/chatlog`;
  try {
    const url = new URL('/api/v1/chatlog', baseUrl || 'http://dummy.local');
    url.searchParams.set('talker', talker);
    url.searchParams.set('time', timeParam);
    url.searchParams.set('format', 'json');
    fullUrl = url.toString();
  } catch (_) {
    fullUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/chatlog?talker=${encodeURIComponent(talker)}&time=${encodeURIComponent(timeParam)}&format=json`;
  }
  console.log(`    .. HTTP GET ${fullUrl}`);
  const response = await requestWithRetry(
    () => httpClient.get('/api/v1/chatlog', {
      params: {
        talker,
        time: timeParam,
        format: 'json'
      },
      timeout,
      responseType: 'text',
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404
    }),
    { retries, delayMs: retryDelay }
  );

  console.log(`    .. HTTP <- ${response.status}`);

  if (response.status === 404) {
    return { status: 'not-found', messages: [] };
  }

  const raw = response.data;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { status: 'empty', messages: [] };
    }
    const parsed = safeJsonParse(trimmed);
    if (parsed === null) {
      throw new Error(`无法解析聊天记录响应（talker: ${talker}, time: ${timeParam}）`);
    }
    const messages = normalizeMessages(parsed);
    return { status: messages.length > 0 ? 'ok' : 'empty', messages };
  }

  const messages = normalizeMessages(raw);
  return { status: messages.length > 0 ? 'ok' : 'empty', messages };

}

async function scanGroup({
  httpClient,
  group,
  ranges,
  requestOptions,
  delayBetweenRequests
}) {
  const groupId = group.name || group.id || group.talker || '';
  const groupName = group.nickName || group.displayName || group.nickname || group.remark || group.name || groupId || '未命名群组';

  const result = {
    id: groupId,
    name: groupName,
    alias: group.remark || null,
    owner: group.owner || null,
    lastActive: null,
    lastMessage: null,
    lastMessageRawTime: null,
    rangesScanned: [],
    errors: []
  };

  for (const range of ranges) {
    if (delayBetweenRequests) {
      await sleep(delayBetweenRequests);
    }

    console.log(`    -> 时间段 ${range.param} 请求中...`);

    try {
      const { status, messages } = await fetchMessagesForRange(httpClient, groupId, range.param, requestOptions);
      const count = messages.length;

      result.rangesScanned.push({
        range: range.param,
        messageCount: count,
        success: true,
        status
      });

      console.log(`    <- 时间段 ${range.param} 状态: ${status}，返回 ${count} 条消息`);

      if (status === 'not-found') {
        console.log('       .. Chatlog 返回 404，可能未开启该群或无历史数据');
        continue;
      }

      if (count === 0) {
        console.log('       .. 本时间段没有记录，继续下一段');
        continue;
      }

      const latest = extractLatestMessage(messages);
      if (!latest) {
        console.log('       .. 无法解析最新消息，继续下一段');
        continue;
      }

      result.lastActive = latest.iso || formatTimestamp(latest.timestamp);
      result.lastMessageRawTime = latest.rawTime || null;
      result.lastMessage = buildMessageSummary(latest.message);

      const preview = result.lastMessage?.preview || '[无摘要]';
      const sender = result.lastMessage?.senderName || result.lastMessage?.sender || '未知发送者';
      console.log(`    OK 捕获最近消息 @ ${result.lastActive || '未知时间'} | ${sender}: ${preview}`);

      break;
    } catch (error) {
      console.error(`    !! 时间段 ${range.param} 请求失败: ${error.message}`);
      result.rangesScanned.push({
        range: range.param,
        messageCount: 0,
        success: false,
        status: 'error',
        error: error.message
      });
      result.errors.push(error.message);
    }
  }

  return result;
}

function extractLatestMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  let latest = null;
  for (const msg of messages) {
    const resolved = resolveMessageTime(msg);
    if (!resolved.timestamp) {
      continue;
    }
    if (!latest || resolved.timestamp > latest.timestamp) {
      latest = {
        timestamp: resolved.timestamp,
        iso: resolved.iso,
        rawTime: resolved.raw,
        message: msg
      };
    }
  }
  return latest;
}

async function writeJsonAtomic(targetPath, payload) {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
  const serialized = JSON.stringify(payload, null, 2);
  const tmpPath = `${targetPath}.tmp`;
  await fs.writeFile(tmpPath, serialized, 'utf8');
  try {
    await fs.rename(tmpPath, targetPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dir, { recursive: true });
      try {
        await fs.rename(tmpPath, targetPath);
      } catch (renameError) {
        if (renameError.code === 'ENOENT') {
          await fs.writeFile(targetPath, serialized, 'utf8');
          await fs.rm(tmpPath, { force: true });
        } else {
          throw renameError;
        }
      }
    } else if (error.code === 'EEXIST' || error.code === 'EPERM') {
      await fs.rm(targetPath, { force: true });
      await fs.rename(tmpPath, targetPath);
    } else {
      throw error;
    }
  }
}

function activityTimestamp(value) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const numeric = toNumber(value);
  if (numeric !== null) {
    return numeric > 1e12 ? numeric : numeric * 1000;
  }
  return 0;
}

function sortGroupsByActivity(groups) {
  return [...groups].sort((a, b) => activityTimestamp(b.lastActive) - activityTimestamp(a.lastActive));
}

async function runWithConcurrency(tasks, limit, onProgress) {
  if (tasks.length === 0) {
    return [];
  }

  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= tasks.length) {
        return;
      }
      const value = await tasks[current]();
      results[current] = value;
      if (onProgress) {
        await onProgress(current, value);
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function logScanOptions({
  projectDir,
  dataDir,
  outputFile,
  baseUrl,
  days,
  chunkDays,
  maxGroups,
  concurrency,
  delayBetweenRequests,
  retries,
  retryDelay,
  timeout,
  keyword,
  dryRun
}) {
  console.log('=== Chatlog 群组扫描 ===');
  console.log(`项目目录: ${projectDir}`);
  console.log(`数据目录: ${dataDir}`);
  console.log(`缓存文件: ${outputFile}`);
  console.log(`Chatlog 地址: ${baseUrl}`);
  console.log(`扫描范围: 最近 ${days} 天，分块 ${chunkDays} 天/批`);
  console.log(`最多处理群组: ${maxGroups}`);
  console.log(`并发: ${concurrency} | 请求间隔: ${delayBetweenRequests}ms`);
  console.log(`重试: ${retries} 次 | 重试间隔: ${retryDelay}ms | 超时: ${timeout}ms`);
  if (keyword) {
    console.log(`群组关键字过滤: ${keyword}`);
  }
  if (dryRun) {
    console.log('运行模式: 仅预览（Dry Run）');
  }
  console.log('');
}

async function runChatScan(userOptions = {}) {
  const projectDir = resolveProjectDir(userOptions.projectDir);
  const dataDir = resolveDataDir(projectDir);
  const cacheDir = path.join(dataDir, 'chat-cache');
  const outputFile = userOptions.output
    ? path.resolve(projectDir, userOptions.output)
    : path.join(cacheDir, 'groups.json');

  const baseUrl = ensureHttpBase(userOptions.baseUrl);
  const maxGroups = parseIntegerOption(userOptions.maxGroups, DEFAULT_MAX_GROUPS, { min: 1 });
  const days = parseIntegerOption(userOptions.days, DEFAULT_DAYS, { min: 1 });
  const chunkDays = parseIntegerOption(userOptions.chunkDays, DEFAULT_CHUNK_DAYS, { min: 1 });
  const concurrency = parseIntegerOption(userOptions.concurrency, DEFAULT_CONCURRENCY, { min: 1 });
  const delayBetweenRequests = parseIntegerOption(userOptions.delay, DEFAULT_DELAY_MS, { min: 0 });
  const timeout = parseIntegerOption(userOptions.timeout, 15000, { min: 1000 });
  const retries = parseIntegerOption(userOptions.retries, 2, { min: 0 });
  const retryDelay = parseIntegerOption(userOptions.retryDelay, 800, { min: 100 });
  const keyword = userOptions.keyword || null;
  const dryRun = Boolean(userOptions.dryRun);

  logScanOptions({
    projectDir,
    dataDir,
    outputFile,
    baseUrl,
    days,
    chunkDays,
    maxGroups,
    concurrency,
    delayBetweenRequests,
    retries,
    retryDelay,
    timeout,
    keyword,
    dryRun
  });

  const httpClient = axios.create({
    baseURL: baseUrl,
    headers: {
      'User-Agent': 'AwesomeTools-ChatScan/1.0'
    }
  });

  let groupList;
  try {
    const response = await requestWithRetry(
      () => httpClient.get('/api/v1/chatroom', {
        params: { format: 'json' },
        timeout,
        responseType: 'json',
        validateStatus: (status) => status >= 200 && status < 300
      }),
      { retries, delayMs: retryDelay }
    );
    groupList = normalizeGroupList(response.data);
  } catch (error) {
    console.error('获取群组列表失败:', error.message);
    throw error;
  }

  console.log(`共获取群组 ${groupList.length} 个`);

  groupList = filterGroupsByKeyword(groupList, keyword);
  if (groupList.length === 0) {
    console.log('关键字过滤后没有匹配的群组，任务结束。');
    return null;
  }

  if (groupList.length > maxGroups) {
    console.log(`仅处理前 ${maxGroups} 个群组（保持原始顺序）。`);
    groupList = groupList.slice(0, maxGroups);
  }

  if (dryRun) {
    console.log('即将扫描的群组列表:');
    groupList.forEach((group, index) => {
      const name = group.nickName || group.displayName || group.nickname || group.name || group.id || `群组-${index + 1}`;
      console.log(`${index + 1}. ${name} (${group.name || group.id || '未知ID'})`);
    });
    return null;
  }

  await ensureDirectory(cacheDir);
  await ensureDirectory(path.dirname(outputFile));

  const ranges = buildTimeRanges(days, chunkDays);
  const stats = {
    totalGroups: groupList.length,
    processed: 0,
    withActivity: 0,
    noActivity: 0,
    failed: 0
  };

  const groupResults = new Array(groupList.length);
  const requestOptions = { timeout, retries, retryDelay };

  const tasks = groupList.map((group, index) => async () => {
    const name = group.nickName || group.displayName || group.nickname || group.name || group.id || `群组-${index + 1}`;
    console.log(`[${index + 1}/${groupList.length}] 处理群组: ${name}`);

    const result = await scanGroup({
      httpClient,
      group,
      ranges,
      requestOptions,
      delayBetweenRequests
    });

    if (result.lastActive) {
      console.log(`  找到最近消息: ${result.lastActive} | ${result.lastMessage?.preview || ''}`);
    } else if (result.errors.length > 0) {
      console.log(`  扫描失败: ${result.errors.join('; ')}`);
    } else {
      console.log('  指定范围内未找到聊天记录');
    }

    return result;
  });

  await runWithConcurrency(tasks, concurrency, async (index, value) => {
    groupResults[index] = value;

    stats.processed += 1;
    if (value.lastActive) {
      stats.withActivity += 1;
    } else if (value.errors.length > 0) {
      stats.failed += 1;
    } else {
      stats.noActivity += 1;
    }

    const readyGroups = sortGroupsByActivity(groupResults.filter(Boolean));
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      baseUrl,
      days,
      chunkDays,
      maxGroups,
      keyword,
      stats: { ...stats },
      groups: readyGroups
    };

    await writeJsonAtomic(outputFile, payload);
  });

  const finalGroups = sortGroupsByActivity(groupResults.filter(Boolean));
  const finalPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    days,
    chunkDays,
    maxGroups,
    keyword,
    stats,
    groups: finalGroups
  };
  await writeJsonAtomic(outputFile, finalPayload);

  console.log('');
  console.log('扫描完成:');
  console.log(`- 总群组: ${stats.totalGroups}`);
  console.log(`- 已处理: ${stats.processed}`);
  console.log(`- 找到最近消息: ${stats.withActivity}`);
  console.log(`- 无消息: ${stats.noActivity}`);
  console.log(`- 失败: ${stats.failed}`);
  console.log('');
  console.log(`缓存文件已生成: ${outputFile}`);

  return finalPayload;
}

module.exports = {
  runChatScan
};
