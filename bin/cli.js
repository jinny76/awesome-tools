#!/usr/bin/env node

const { Command } = require('commander');
const { generateGitStats } = require('../lib/commands/git-stats');
const { cleanDeadCode } = require('../lib/commands/clean-code');
const { debugFileUsage } = require('../lib/commands/debug-file');
const CommandHistory = require('../lib/utils/command-history');

const program = new Command();
const commandHistory = new CommandHistory();

program
  .name('awesome-tools')
  .description('强大工具集合')
  .version('1.0.0');

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

// 将驼峰命名转换为连字符命名
function convertToKebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// 检查是否为否定选项
function isNegatedOption(commandName, optionKey) {
  const negatedOptions = {
    'clean-code': ['gitignore'], // --no-gitignore在选项中显示为gitignore
    'git-stats': [],
    'debug-file': []
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
      'debug-file': debugFileUsage
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
    const validCommands = ['git-stats', 'clean-code', 'debug-file'];
    
    if (validCommands.includes(commandName)) {
      // 显示命令历史
      const commandConfig = getCommandConfig(commandName);
      commandHistory.showCommandHelp(commandName, commandConfig.description, commandConfig.options);
      return true;
    }
  } else if (args.length === 2) {
    // 检查是否为数字（历史命令执行）
    const commandName = args[0];
    const possibleIndex = args[1];
    const validCommands = ['git-stats', 'clean-code', 'debug-file'];
    
    if (validCommands.includes(commandName) && /^\d+$/.test(possibleIndex)) {
      await executeHistoryCommand(commandName, parseInt(possibleIndex));
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