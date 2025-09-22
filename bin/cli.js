#!/usr/bin/env node

const { Command } = require('commander');
const { generateGitStats } = require('../lib/commands/git-stats');
const { cleanDeadCode } = require('../lib/commands/clean-code');
const { debugFileUsage } = require('../lib/commands/debug-file');
const { handleFFmpegCommand } = require('../lib/commands/ffmpeg-tools');
const { startShareServer } = require('../lib/commands/share-server');
const { startScreensaver } = require('../lib/commands/screensaver');
const { startNotify } = require('../lib/commands/server-chan');
const { startDatabase } = require('../lib/commands/database');
const { startAnimationServer } = require('../lib/commands/animation-server');
const browserToolsCommand = require('../lib/commands/browser-tools');
const { startDevServer } = require('../lib/commands/dev-server');
const { runChatScan } = require('../lib/commands/chat-scan');
const CommandHistory = require('../lib/utils/command-history');

const program = new Command();
const commandHistory = new CommandHistory();

program
  .name('awesome-tools')
  .description('强大工具集合 (可使用 ats 作为缩写)')
  .version('1.1.0');

program
  .command('hello')
  .description('打招呼命令')
  .option('-n, --name <name>', '指定名字', 'World')
  .action((options) => {
    console.log(`Hello, ${options.name}!`);
  });

program
  .command('date')
  .description('显示当前日期时间')
  .action(() => {
    const now = new Date();
    console.log(`当前时间: ${now.toLocaleString('zh-CN')}`);
  });

program
  .command('info')
  .description('显示系统信息')
  .action(() => {
    console.log('系统信息:');
    console.log(`- Node.js 版本: ${process.version}`);
    console.log(`- 操作系统: ${process.platform}`);
    console.log(`- 架构: ${process.arch}`);
    console.log(`- 当前目录: ${process.cwd()}`);
  });

program
  .command('git-stats')
  .alias('gs')
  .description('Git提交历史统计报告')
  .option('-d, --dir <path>', 'Git目录路径', '.')
  .option('-s, --since <date>', '起始时间 (如: 2024-01-01, "1 month ago")')
  .option('-u, --until <date>', '结束时间', 'now')
  .option('-a, --author <pattern>', '过滤特定作者')
  .option('-e, --exclude <patterns>', '排除文件模式 (用逗号分隔，如: "*.lock,node_modules/*,dist/*")')
  .action(wrapAction('git-stats', async (options) => {
    try {
      await generateGitStats(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }));

program
  .command('clean-code')
  .alias('cc')
  .description('清理Vue+Vite项目中的死代码')
  .requiredOption('-d, --dir <path>', '前端项目根目录路径')
  .option('-e, --entry <paths>', '自定义入口文件 (逗号分隔，相对于项目根目录)')
  .option('-b, --backup', '执行清理前创建备份', true)
  .option('--dry-run', '预览模式，只显示要删除的文件，不实际删除')
  .option('--skip-test', '跳过npm run dev测试验证')
  .option('--include <patterns>', '额外包含的文件模式 (逗号分隔)', '*.ts,*.tsx')
  .option('--exclude <patterns>', '排除的文件模式 (逗号分隔)', 'node_modules/**,dist/**,build/**,*.test.*,*.spec.*')
  .option('--no-gitignore', '忽略.gitignore文件中的排除规则')
  .option('--debug', '显示详细的调试信息')
  .option('--debug-file <path>', '额外调试特定文件 (相对路径)')
  .option('--runtime', '启用运行时扫描，注入跟踪脚本到HTML文件')
  .option('--analyze-runtime', '分析之前收集的运行时使用数据')
  .action(wrapAction('clean-code', async (options) => {
    try {
      await cleanDeadCode(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }));

program
  .command('debug-file')
  .alias('df')
  .description('调试特定文件的引用情况，分析为什么被标记为死代码')
  .requiredOption('-d, --dir <path>', '前端项目根目录路径')
  .requiredOption('-f, --file <path>', '被质疑的文件路径 (相对于项目根目录)')
  .requiredOption('-r, --ref <path>', '声称引用它的文件路径 (相对于项目根目录)')
  .option('--include <patterns>', '额外包含的文件模式 (逗号分隔)', '*.ts,*.tsx')
  .option('--exclude <patterns>', '排除的文件模式 (逗号分隔)', 'node_modules/**,dist/**,build/**,*.test.*,*.spec.*')
  .action(wrapAction('debug-file', async (options) => {
    try {
      await debugFileUsage(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }));

program
  .command('ffmpeg')
  .alias('ff')
  .description('FFmpeg音视频格式转换和流媒体工具')
  .option('-w, --wizard', '启动交互式转换向导')
  .option('--status', '显示FFmpeg安装状态和版本信息')
  .option('--update', '更新FFmpeg到最新版本')
  .option('--reinstall', '重新安装FFmpeg')
  .option('--uninstall', '卸载本地安装的FFmpeg')
  .option('--install', '直接安装FFmpeg（跳过向导）')
  .option('--convert <input>', '转换指定的视频/音频文件')
  .option('-o, --output <output>', '指定输出文件路径')
  .option('--format <format>', '指定输出格式 (mp4,avi,mkv,webm,flv,mp3,wav等)')
  .option('--quality <level>', '质量等级 (1-高质量 2-平衡 3-移动 4-高压缩)')
  .option('--preset <preset>', 'FFmpeg预设 (ultrafast,fast,medium,slow,veryslow)')
  .option('--bitrate <rate>', '指定视频码率 (如: 4000k)')
  .option('--audio-bitrate <rate>', '指定音频码率 (如: 128k)')
  .option('--resolution <size>', '指定分辨率 (如: 1920x1080, 1280x720)')
  .option('--fps <rate>', '指定帧率 (如: 30, 60)')
  .option('--stream', '启动流媒体服务器模式')
  .option('--stream-type <type>', '流媒体类型 (rtmp,hls,flv,dash)')
  .option('--batch <dir>', '批量转换指定目录下的文件')
  .option('--extract-audio', '从视频中提取音频')
  .option('--compress', '启用压缩模式，减小文件大小')
  .option('--convertImage <file>', '转换图片格式')
  .option('--imageToBase64 <file>', '将图片转换为Base64编码')
  .option('--base64ToImage <data>', '将Base64编码转换为图片')
  .option('--name <name>', '指定输出文件名（用于Base64转图片）')
  .option('--clipboard', '将Base64结果复制到剪贴板')
  .action(wrapAction('ffmpeg', async (options) => {
    try {
      await handleFFmpegCommand(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }));

program
  .command('remote-server')
  .alias('rs')
  .description('SSH端口转发工具，映射远程服务器端口到本地')
  .option('-w, --wizard', '启动交互式配置向导')
  .option('--list', '列出所有服务器和预设配置')
  .option('--status', '显示当前活跃的隧道状态')
  .option('--stop', '停止所有隧道')
  .option('--add <name>', '添加新的服务器配置')
  .option('--connect <name>', '连接到指定服务器')
  .option('--only <services>', '只映射指定服务 (逗号分隔)')
  .option('--host <host>', '临时指定服务器地址')
  .option('--port <port>', '临时指定SSH端口 (默认: 22)')
  .option('--user <user>', '临时指定用户名')
  .option('--jump <host>', '通过跳板机连接')
  .option('--background', '后台运行模式')
  .option('--auto-reconnect', '断线自动重连')
  .option('--debug', '显示详细调试信息')
  .action(wrapAction('remote-server', async (options) => {
    try {
      const { handleRemoteServerCommand } = require('../lib/commands/remote-server');
      await handleRemoteServerCommand(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      if (error.stack && options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }));

program
  .command('share-server')
  .alias('ss')
  .description('本地目录分享服务器，支持认证和公网访问')
  .option('-w, --wizard', '启动交互式配置向导')
  .option('-d, --dir <path>', '要分享的本地目录路径')
  .option('-p, --port <number>', '服务器端口', '33333')
  .option('-u, --username <string>', '认证用户名', 'admin')
  .option('--password <string>', '认证密码', 'password')
  .option('--max-upload <size>', '最大上传文件大小', '10MB')
  .option('--cors-origin <origin>', 'CORS允许的源', '*')
  .option('--tunnel', '启用公网访问隧道(ngrok)')
  .option('--custom-mime <types>', '自定义MIME类型映射 (格式: ext:type,ext:type)')
  .option('--index', '启用目录索引浏览功能')
  .option('--no-auth', '禁用认证，允许匿名访问')
  .option('--port-map <port>', '端口映射模式：直接映射指定本地端口到外网（忽略网站相关参数）')
  .action(wrapAction('share-server', async (options) => {
    try {
      await startShareServer(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }));

program
  .command('screensaver')
  .alias('screen')
  .description('屏保工具：完美伪装工作状态，支持代码编写、日志监控、编译等场景')
  .option('-w, --wizard', '启动交互式选择向导')
  .option('-t, --type <type>', '屏保类型 (coding/logs/compiler/analysis/network)')
  .option('-s, --speed <ms>', '动画速度 (毫秒)', '100')
  .action(wrapAction('screensaver', async (options) => {
    try {
      await startScreensaver(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }));

program
  .command('chat-scan')
  .description('扫描 Chatlog 群聊活跃度并生成缓存')
  .option('--project-dir <path>', '项目根目录（默认：当前目录）')
  .option('--base-url <url>', 'Chatlog 服务地址 (默认: http://127.0.0.1:5030)')
  .option('--days <number>', '扫描最近的天数 (默认: 365)')
  .option('--chunk-days <number>', '每次请求覆盖的天数 (默认: 30)')
  .option('--max-groups <number>', '最多处理的群组数量 (默认: 1000)')
  .option('--concurrency <number>', '并发请求数量 (默认: 2)')
  .option('--delay <ms>', '请求间隔，单位毫秒 (默认: 300)')
  .option('--timeout <ms>', '单次请求超时时间，单位毫秒 (默认: 15000)')
  .option('--retries <number>', '请求失败后的重试次数 (默认: 2)')
  .option('--retry-delay <ms>', '重试间隔，单位毫秒 (默认: 800)')
  .option('--keyword <text>', '按群组名称关键字过滤')
  .option('--output <path>', '缓存文件输出路径（默认写入 .api-test/chat-cache/groups.json）')
  .option('--dry-run', '仅预览将要处理的群组，不实际扫描')
  .action(wrapAction('chat-scan', async (options) => {
    try {
      await runChatScan(options);
    } catch (error) {
      console.error('执行 Chatlog 群组扫描失败:', error.message);
      process.exit(1);
    }
  }));
program
  .command('notify')
  .alias('n')
  .description('Server酱消息推送：发送通知到微信等平台')
  .option('-w, --wizard', '启动配置向导')
  .option('--add <name:sendkey>', '添加SendKey (格式: name:SCTxxxxx)')
  .option('--remove <name>', '删除SendKey')
  .option('--list', '列出所有SendKey')
  .option('--set-default <name>', '设置默认通道')
  .option('--test [channel]', '测试发送')
  .option('-t, --title <title>', '消息标题')
  .option('-d, --desp <content>', '消息内容 (支持Markdown)')
  .option('-c, --content <content>', '消息内容 (--desp的别名)')
  .option('--channel <name>', '发送通道 (留空使用默认，*表示群发)')
  .option('--tags <tags>', '消息标签 (用|分隔)')
  .option('--short <text>', '短消息内容')
  .option('--stdin', '从标准输入读取消息')
  .option('--default', '添加SendKey时设为默认')
  .action(wrapAction('notify', async (options) => {
    try {
      await startNotify(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }));

program
  .command('database')
  .alias('db')
  .description('数据库连接查询：支持MySQL和PostgreSQL数据库操作')
  .option('-t, --type <type>', '数据库类型 (mysql/postgres)', 'mysql')
  .option('-h, --host <host>', '数据库主机', 'localhost')
  .option('-P, --port <port>', '数据库端口')
  .option('-u, --user <user>', '用户名')
  .option('-p, --password <password>', '密码')
  .option('-d, --database <database>', '数据库名')
  .option('-q, --query <sql>', 'SQL查询语句')
  .option('--config <name>', '使用保存的配置')
  .option('--save <name>', '保存当前配置')
  .option('--list', '列出保存的配置')
  .option('--test', '测试数据库连接')
  .option('-w, --wizard', '启动配置向导')
  .option('--tables', '列出所有表')
  .option('--describe <table>', '查看表结构')
  .option('--export <format>', '导出查询结果 (json/csv/table)')
  .action(wrapAction('database', async (options) => {
    try {
      await startDatabase(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      if (error.stack && options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }));


program
  .command('animation-server')
  .alias('as')
  .description('3D动画服务器：WebSocket服务器，连接网页和MCP，提供场景分析和优化服务')
  .option('-p, --port <port>', '服务器端口', '8080')
  .option('-h, --host <host>', '服务器主机', 'localhost')
  .option('--auth', '启用认证')
  .option('--token <token>', '认证令牌')
  .option('--cors', '启用CORS', true)
  .option('--max-connections <num>', '最大连接数', '100')
  .option('--data-dir <path>', '数据存储目录')
  .option('--mcp-bridge', '启用MCP桥接', true)
  .option('--background', '后台运行')
  .option('--verbose', '详细输出')
  .action(wrapAction('animation-server', async (options) => {
    try {
      await startAnimationServer(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      if (error.stack && options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }));

// === API Test 命令 ===
program
  .command('api-test')
  .alias('at')
  .description('API自动化测试工具：配置测试环境、管理测试套件、与MCP协作进行智能测试')
  .option('-w, --wizard', '启动配置向导')
  .option('--env <name>', '切换到指定环境')
  .option('--list-env', '列出所有测试环境')
  .option('--list-suites', '列出所有测试套件')
  .option('--create-env <name>', '创建新测试环境')
  .option('--delete-env <name>', '删除测试环境')
  .option('--mcp-server', '启动测试MCP服务器')
  .action(wrapAction('api-test', async (options) => {
    try {
      const { startApiTest } = require('../lib/commands/api-test');
      await startApiTest(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      if (error.stack && options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }));


// === Dev Server 命令 ===
program
  .command('dev-server')
  .alias('ds')
  .description('多服务器Claude远程开发系统：支持Web界面、用户认证、WebSocket实时通信、深色主题')
  .option('-w, --wizard', '启动配置向导')
  .option('--list', '列出所有服务器配置')
  .option('--status', '查看运行状态')
  .option('--start <name>', '启动指定服务器')
  .option('--stop [name]', '停止服务器 (不指定名称则停止所有)')
  .option('--restart <name>', '重启指定服务器')
  .option('--debug', '显示调试信息')
  .action(wrapAction('dev-server', async (options) => {
    try {
      await startDevServer(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      if (error.stack && options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }));

// === Browser Tools 命令 ===
program
  .command('browser-tools')
  .alias('bt')
  .description('浏览器工具MCP：自动安装、配置和管理browser-tools-mcp，支持Chrome扩展和AI集成')
  .option('-w, --wizard', '启动安装向导')
  .option('--start', '启动服务器')
  .option('--stop', '停止服务器')
  .option('--status', '查看服务器状态')
  .option('--config [type]', '显示配置范例 (claude/cursor/all)', 'all')
  .option('--extension', '下载和安装Chrome扩展指南')
  .option('-p, --port <port>', '服务器端口', '3025')
  .action(wrapAction('browser-tools', async (options) => {
    try {
      await browserToolsCommand(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      if (error.stack && options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }));

// 将驼峰命名转换为连字符命名
function convertToKebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// 命令别名映射
function getCommandAlias() {
  return {
    'gs': 'git-stats',
    'cc': 'clean-code',
    'df': 'debug-file',
    'ff': 'ffmpeg',
    'ss': 'share-server',
    'rs': 'remote-server',
    'screen': 'screensaver',
    'n': 'notify',
    'db': 'database',
    'as': 'animation-server',
    'at': 'api-test',
    'ds': 'dev-server',
    'bt': 'browser-tools'
  };
}

// 获取命令的全名（支持别名）
function getFullCommandName(commandName) {
  const aliases = getCommandAlias();
  return aliases[commandName] || commandName;
}

// 获取所有有效命令（包括别名）
function getAllValidCommands() {
  const fullCommands = ['git-stats', 'clean-code', 'debug-file', 'ffmpeg', 'share-server', 'remote-server', 'screensaver', 'notify', 'database', 'animation-server', 'api-test', 'dev-server', 'browser-tools'];
  const aliases = Object.keys(getCommandAlias());
  return [...fullCommands, ...aliases];
}

// 检查是否为否定选项
function isNegatedOption(commandName, optionKey) {
  const negatedOptions = {
    'clean-code': ['gitignore'], // --no-gitignore在选项中显示为gitignore
    'git-stats': [],
    'debug-file': [],
    'ffmpeg': []
  };

  return negatedOptions[commandName] && negatedOptions[commandName].includes(optionKey);
}

// 检查是否为历史命令执行
async function executeHistoryCommand(commandName, historyIndex) {
  const record = commandHistory.getCommandByNumber(commandName, historyIndex);
  if (!record) {
    console.error(`❌ 未找到命令编号 ${historyIndex} 的历史记录`);
    process.exit(1);
  }

  console.log(`📚 执行历史命令: ${record.command}`);
  console.log(`🕐 执行时间: ${new Date(record.timestamp).toLocaleString('zh-CN')}\n`);

  // 直接调用对应的命令函数，而不是重新解析
  try {
    const commandMap = {
      'git-stats': generateGitStats,
      'clean-code': cleanDeadCode,
      'debug-file': debugFileUsage,
      'ffmpeg': handleFFmpegCommand,
      'share-server': startShareServer,
      'screensaver': startScreensaver,
      'notify': startNotify,
      'database': startDatabase,
      'animation-server': startAnimationServer
    };

    const commandFunction = commandMap[commandName];
    if (commandFunction) {
      await commandFunction(record.options);
    } else {
      console.error(`❌ 未找到命令处理函数: ${commandName}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 执行历史命令时出现错误:', error.message);
    process.exit(1);
  }
}

// 检查是否只有命令名称
async function checkForHistoryMode() {
  const args = process.argv.slice(2);
  if (args.length === 1) {
    const commandName = args[0];
    const validCommands = getAllValidCommands();

    if (validCommands.includes(commandName)) {
      // 获取命令全名
      const fullCommandName = getFullCommandName(commandName);
      // 显示命令历史
      const commandConfig = getCommandConfig(fullCommandName);
      commandHistory.showCommandHelp(fullCommandName, commandConfig.description, commandConfig.options);
      return true;
    }
  } else if (args.length === 2) {
    // 检查是否为数字（历史命令执行）
    const commandName = args[0];
    const possibleIndex = args[1];
    const validCommands = getAllValidCommands();

    if (validCommands.includes(commandName) && /^\d+$/.test(possibleIndex)) {
      const fullCommandName = getFullCommandName(commandName);
      await executeHistoryCommand(fullCommandName, parseInt(possibleIndex));
      return true;
    }
  }
  return false;
}

// 获取命令配置信息
function getCommandConfig(commandName) {
  const configs = {
    'git-stats': {
      description: 'Git提交历史统计报告',
      options: [
        { flags: '-d, --dir <path>', description: 'Git目录路径' },
        { flags: '-s, --since <date>', description: '起始时间' },
        { flags: '-u, --until <date>', description: '结束时间' },
        { flags: '-a, --author <pattern>', description: '过滤特定作者' },
        { flags: '-e, --exclude <patterns>', description: '排除文件模式' }
      ]
    },
    'clean-code': {
      description: '清理Vue+Vite项目中的死代码',
      options: [
        { flags: '-d, --dir <path>', description: '前端项目根目录路径 (必需)' },
        { flags: '-e, --entry <paths>', description: '自定义入口文件' },
        { flags: '-b, --backup', description: '执行清理前创建备份' },
        { flags: '--dry-run', description: '预览模式' },
        { flags: '--skip-test', description: '跳过测试验证' },
        { flags: '--include <patterns>', description: '包含的文件模式' },
        { flags: '--exclude <patterns>', description: '排除的文件模式' },
        { flags: '--no-gitignore', description: '忽略.gitignore规则' },
        { flags: '--debug', description: '显示调试信息' },
        { flags: '--runtime', description: '启用运行时扫描' },
        { flags: '--analyze-runtime', description: '分析运行时数据' }
      ]
    },
    'debug-file': {
      description: '调试特定文件的引用情况',
      options: [
        { flags: '-d, --dir <path>', description: '前端项目根目录路径 (必需)' },
        { flags: '-f, --file <path>', description: '被质疑的文件路径 (必需)' },
        { flags: '-r, --ref <path>', description: '声称引用它的文件路径 (必需)' },
        { flags: '--include <patterns>', description: '包含的文件模式' },
        { flags: '--exclude <patterns>', description: '排除的文件模式' }
      ]
    },
    'ffmpeg': {
      description: 'FFmpeg音视频格式转换和流媒体工具',
      options: [
        { flags: '-w, --wizard', description: '启动交互式转换向导' },
        { flags: '--status', description: '显示FFmpeg安装状态' },
        { flags: '--update', description: '更新FFmpeg到最新版本' },
        { flags: '--convert <input>', description: '转换指定文件' },
        { flags: '-o, --output <output>', description: '指定输出文件路径' },
        { flags: '--format <format>', description: '指定输出格式' },
        { flags: '--quality <level>', description: '质量等级 (1-4)' },
        { flags: '--stream', description: '启动流媒体服务器' },
        { flags: '--batch <dir>', description: '批量转换目录文件' },
        { flags: '--extract-audio', description: '提取音频' },
        { flags: '--convertImage <file>', description: '转换图片格式' },
        { flags: '--imageToBase64 <file>', description: '图片转Base64编码' },
        { flags: '--base64ToImage <data>', description: 'Base64转图片' },
        { flags: '--name <name>', description: '指定输出文件名' },
        { flags: '--clipboard', description: '复制Base64到剪贴板' }
      ]
    },
    'share-server': {
      description: '本地目录分享服务器，支持认证和公网访问',
      options: [
        { flags: '-w, --wizard', description: '启动交互式配置向导' },
        { flags: '-d, --dir <path>', description: '要分享的本地目录路径' },
        { flags: '-p, --port <number>', description: '服务器端口' },
        { flags: '-u, --username <string>', description: '认证用户名' },
        { flags: '--password <string>', description: '认证密码' },
        { flags: '--max-upload <size>', description: '最大上传文件大小' },
        { flags: '--cors-origin <origin>', description: 'CORS允许的源' },
        { flags: '--tunnel', description: '启用公网访问隧道' },
        { flags: '--custom-mime <types>', description: '自定义MIME类型映射' },
        { flags: '--index', description: '启用目录索引浏览功能' },
        { flags: '--no-auth', description: '禁用认证，允许匿名访问' },
        { flags: '--port-map <port>', description: '端口映射模式：直接映射指定本地端口到外网' }
      ]
    },
    'remote-server': {
      description: 'SSH端口转发工具，映射远程服务器端口到本地',
      options: [
        { flags: '-w, --wizard', description: '启动交互式配置向导' },
        { flags: '--list', description: '列出所有服务器和预设配置' },
        { flags: '--status', description: '显示当前活跃的隧道状态' },
        { flags: '--stop', description: '停止所有隧道' },
        { flags: '--connect <name>', description: '连接到指定服务器' },
        { flags: '--only <services>', description: '只映射指定服务' },
        { flags: '--host <host>', description: '临时指定服务器地址' },
        { flags: '--user <user>', description: '临时指定用户名' },
        { flags: '--key <path>', description: '临时指定SSH密钥路径' }
      ]
    },
    'screensaver': {
      description: '屏保工具：完美伪装工作状态，支持代码编写、日志监控、编译等场景',
      options: [
        { flags: '-w, --wizard', description: '启动交互式选择向导' },
        { flags: '-t, --type <type>', description: '屏保类型 (coding/logs/compiler/analysis/network)' },
        { flags: '-s, --speed <ms>', description: '动画速度 (毫秒)' }
      ]
    },
    'notify': {
      description: 'Server酱消息推送：发送通知到微信等平台',
      options: [
        { flags: '-w, --wizard', description: '启动配置向导' },
        { flags: '--add <name:key>', description: '添加SendKey' },
        { flags: '--list', description: '列出所有SendKey' },
        { flags: '-t, --title <title>', description: '消息标题' },
        { flags: '-d, --desp <content>', description: '消息内容' },
        { flags: '--channel <name>', description: '发送通道' },
        { flags: '--test [channel]', description: '测试发送' }
      ]
    }
  };

  return configs[commandName] || { description: '未知命令', options: [] };
}

// 包装action函数以记录历史
function wrapAction(commandName, originalAction) {
  return async (options, command) => {
    // 记录命令执行
    const args = command.args || [];
    commandHistory.recordCommand(commandName, args, options);

    // 执行原始action
    return await originalAction(options, command);
  };
}

// 检查历史模式
async function main() {
  if (await checkForHistoryMode()) {
    process.exit(0);
  }

  program.parse(process.argv);
}

main().catch(error => {
  console.error('❌ 程序执行错误:', error.message);
  process.exit(1);
});
