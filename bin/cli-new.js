#!/usr/bin/env node

const { Command } = require('commander');
const { generateGitStats } = require('../lib/commands/git-stats');
const { cleanDeadCode } = require('../lib/commands/clean-code');
const { debugFileUsage } = require('../lib/commands/debug-file');

const program = new Command();

program
  .name('local-tools')
  .description('本地工具集合')
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
  .action(async (options) => {
    try {
      await generateGitStats(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  });

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
  .action(async (options) => {
    try {
      await cleanDeadCode(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  });

program
  .command('debug-file')
  .description('调试特定文件的引用情况，分析为什么被标记为死代码')
  .requiredOption('-d, --dir <path>', '前端项目根目录路径')
  .requiredOption('-f, --file <path>', '被质疑的文件路径 (相对于项目根目录)')
  .requiredOption('-r, --ref <path>', '声称引用它的文件路径 (相对于项目根目录)')
  .option('--include <patterns>', '额外包含的文件模式 (逗号分隔)', '*.ts,*.tsx')
  .option('--exclude <patterns>', '排除的文件模式 (逗号分隔)', 'node_modules/**,dist/**,build/**,*.test.*,*.spec.*')
  .action(async (options) => {
    try {
      await debugFileUsage(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);