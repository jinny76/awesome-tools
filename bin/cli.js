#!/usr/bin/env node

const { Command } = require('commander');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
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
  .action(async (options) => {
    try {
      await generateGitStats(options);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  });

// 绘制横向柱状图
function drawHorizontalBarChart(value, maxValue, barWidth = 50) {
  if (maxValue === 0) return '';
  
  const filledLength = Math.round((value / maxValue) * barWidth);
  const emptyLength = barWidth - filledLength;
  
  const filledBar = '█'.repeat(filledLength);
  const emptyBar = '░'.repeat(emptyLength);
  
  return filledBar + emptyBar;
}

// 获取文件扩展名
function getFileExtension(fileName) {
  if (!fileName || fileName.startsWith('.')) {
    return fileName || '无扩展名';
  }
  
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) {
    return '无扩展名';
  }
  
  const extension = fileName.substring(lastDot);
  
  // 特殊文件名处理
  const specialFiles = {
    'package.json': '.json',
    'package-lock.json': '.json',
    'yarn.lock': 'lock文件',
    'Dockerfile': 'Dockerfile',
    'Makefile': 'Makefile',
    'README.md': '.md',
    '.gitignore': 'git配置',
    '.env': '环境配置'
  };
  
  return specialFiles[fileName] || extension || '无扩展名';
}

async function generateGitStats(options) {
  const gitDir = path.resolve(options.dir);
  
  // 检查是否为Git仓库
  if (!fs.existsSync(path.join(gitDir, '.git'))) {
    throw new Error(`目录 "${gitDir}" 不是一个Git仓库`);
  }

  console.log(`📊 正在分析Git仓库: ${gitDir}`);
  console.log(`⏰ 时间范围: ${options.since || '开始'} ~ ${options.until}`);
  
  // 构建git log命令参数 - 只统计当前分支，排除merge提交
  let gitLogArgs = [
    'log', 
    '--no-merges',                               // 排除merge提交，只统计真实代码开发
    '--pretty=format:"%H|%an|%ae|%ad|%s"', 
    '--date=iso'
  ];
  
  if (options.since) {
    gitLogArgs.push(`--since="${options.since}"`);
  }
  if (options.until && options.until !== 'now') {
    gitLogArgs.push(`--until="${options.until}"`);
  }
  if (options.author) {
    gitLogArgs.push(`--author="${options.author}"`);
  }
  
  console.log(`🔍 统计范围: 当前分支 (排除merge提交，只统计真实开发代码量)`);

  // 获取提交日志
  const gitLogCmd = `git ${gitLogArgs.join(' ')}`;
  const commitLog = execSync(gitLogCmd, { 
    cwd: gitDir, 
    encoding: 'utf8',
    shell: true
  }).trim();

  if (!commitLog) {
    console.log('📝 指定时间范围内没有找到提交记录');
    return;
  }

  // 解析提交数据
  const commits = commitLog.split('\n').map(line => {
    const [hash, author, email, date, subject] = line.split('|');
    return { hash, author, email, date: new Date(date), subject };
  });

  // 获取详细统计数据
  const authorStats = new Map();
  const fileTypeStats = new Map(); // 文件类型统计
  const dailyStats = new Map(); // 每日提交统计
  
  for (const commit of commits) {
    // 获取具体的行数变更
    const numstatCmd = `git show --numstat --format= ${commit.hash}`;
    const numstatOutput = execSync(numstatCmd, { 
      cwd: gitDir, 
      encoding: 'utf8' 
    }).trim();

    let totalInsertions = 0, totalDeletions = 0;
    
    if (numstatOutput) {
      const lines = numstatOutput.split('\n');
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const insertions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
          const fileName = parts[2];
          
          totalInsertions += insertions;
          totalDeletions += deletions;
          
          // 统计文件类型
          const fileExtension = getFileExtension(fileName);
          if (!fileTypeStats.has(fileExtension)) {
            fileTypeStats.set(fileExtension, {
              extension: fileExtension,
              files: new Set(),
              insertions: 0,
              deletions: 0,
              netChanges: 0,
              commits: 0
            });
          }
          
          const fileStats = fileTypeStats.get(fileExtension);
          fileStats.files.add(fileName);
          fileStats.insertions += insertions;
          fileStats.deletions += deletions;
          fileStats.netChanges += (insertions - deletions);
        }
      }
    }
    
    // 统计本次提交涉及的文件类型
    const commitFileTypes = new Set();
    if (numstatOutput) {
      const lines = numstatOutput.split('\n');
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const fileName = parts[2];
          const fileExtension = getFileExtension(fileName);
          commitFileTypes.add(fileExtension);
        }
      }
    }
    
    // 为本次提交涉及的文件类型增加提交计数
    for (const fileType of commitFileTypes) {
      if (fileTypeStats.has(fileType)) {
        fileTypeStats.get(fileType).commits++;
      }
    }

    // 统计每日提交数据
    const dateKey = commit.date.toLocaleDateString('zh-CN');
    if (!dailyStats.has(dateKey)) {
      dailyStats.set(dateKey, {
        date: dateKey,
        commits: 0,
        insertions: 0,
        deletions: 0,
        netChanges: 0,
        authors: new Set()
      });
    }
    
    const dayStats = dailyStats.get(dateKey);
    dayStats.commits++;
    dayStats.insertions += totalInsertions;
    dayStats.deletions += totalDeletions;
    dayStats.netChanges += (totalInsertions - totalDeletions);
    dayStats.authors.add(commit.author);

    // 更新作者统计
    const authorKey = `${commit.author} <${commit.email}>`;
    if (!authorStats.has(authorKey)) {
      authorStats.set(authorKey, {
        name: commit.author,
        email: commit.email,
        commits: 0,
        insertions: 0,
        deletions: 0,
        netChanges: 0,
        firstCommit: commit.date,
        lastCommit: commit.date
      });
    }

    const stats = authorStats.get(authorKey);
    stats.commits++;
    stats.insertions += totalInsertions;
    stats.deletions += totalDeletions;
    stats.netChanges += (totalInsertions - totalDeletions);
    
    if (commit.date < stats.firstCommit) stats.firstCommit = commit.date;
    if (commit.date > stats.lastCommit) stats.lastCommit = commit.date;
  }

  // 输出统计报告
  console.log('\n' + '='.repeat(80));
  console.log('📈 Git 提交历史统计报告');
  console.log('='.repeat(80));

  // 总体统计
  const totalCommits = commits.length;
  const totalAuthors = authorStats.size;
  const totalInsertions = Array.from(authorStats.values()).reduce((sum, s) => sum + s.insertions, 0);
  const totalDeletions = Array.from(authorStats.values()).reduce((sum, s) => sum + s.deletions, 0);
  const totalNetChanges = totalInsertions - totalDeletions;

  console.log(`\n📋 总体统计:`);
  console.log(`   提交数量: ${totalCommits}`);
  console.log(`   参与人数: ${totalAuthors}`);
  console.log(`   新增行数: +${totalInsertions}`);
  console.log(`   删除行数: -${totalDeletions}`);
  console.log(`   净增行数: ${totalNetChanges >= 0 ? '+' : ''}${totalNetChanges}`);

  // 按作者统计
  console.log(`\n👥 按作者统计 (按净增行数排序):`);
  console.log('┌─────────────────────────┬────────┬──────────┬──────────┬──────────┬─────────────────────┐');
  console.log('│ 作者                    │ 提交数 │ 新增行数 │ 删除行数 │ 净增行数 │ 活跃期间            │');
  console.log('├─────────────────────────┼────────┼──────────┼──────────┼──────────┼─────────────────────┤');

  const sortedAuthors = Array.from(authorStats.values())
    .sort((a, b) => b.netChanges - a.netChanges);

  for (const author of sortedAuthors) {
    const nameDisplay = author.name.length > 20 ? author.name.substring(0, 20) + '...' : author.name;
    const period = author.firstCommit.toLocaleDateString('zh-CN') + 
                  (author.firstCommit.getTime() !== author.lastCommit.getTime() ? 
                   ' ~ ' + author.lastCommit.toLocaleDateString('zh-CN') : '');
    
    const commitsStr = author.commits.toString();
    const insertionsStr = `+${author.insertions}`;
    const deletionsStr = `-${author.deletions}`;
    const netStr = `${author.netChanges >= 0 ? '+' : ''}${author.netChanges}`;
    
    console.log(
      '│ ' + nameDisplay.padEnd(23) + 
      ' │ ' + commitsStr.padStart(6) + 
      ' │ ' + insertionsStr.padStart(8) + 
      ' │ ' + deletionsStr.padStart(8) + 
      ' │ ' + netStr.padStart(8) + 
      ' │ ' + period.padEnd(19) + ' │'
    );
  }
  
  console.log('└─────────────────────────┴────────┴──────────┴──────────┴──────────┴─────────────────────┘');

  // 文件类型统计
  if (fileTypeStats.size > 0) {
    console.log(`\n📁 按文件类型统计 (按净增行数排序):`);
    console.log('┌─────────────────┬────────┬────────┬──────────┬──────────┬──────────┐');
    console.log('│ 文件类型        │ 文件数 │ 提交数 │ 新增行数 │ 删除行数 │ 净增行数 │');
    console.log('├─────────────────┼────────┼────────┼──────────┼──────────┼──────────┤');

    const sortedFileTypes = Array.from(fileTypeStats.values())
      .sort((a, b) => b.netChanges - a.netChanges);

    for (const fileType of sortedFileTypes) {
      const extensionDisplay = fileType.extension.length > 14 ? 
        fileType.extension.substring(0, 14) + '...' : fileType.extension;
      const fileCount = fileType.files.size;
      const commitsStr = fileType.commits.toString();
      const insertionsStr = `+${fileType.insertions}`;
      const deletionsStr = `-${fileType.deletions}`;
      const netStr = `${fileType.netChanges >= 0 ? '+' : ''}${fileType.netChanges}`;

      console.log(
        '│ ' + extensionDisplay.padEnd(15) + 
        ' │ ' + fileCount.toString().padStart(6) + 
        ' │ ' + commitsStr.padStart(6) + 
        ' │ ' + insertionsStr.padStart(8) + 
        ' │ ' + deletionsStr.padStart(8) + 
        ' │ ' + netStr.padStart(8) + ' │'
      );
    }
    
    console.log('└─────────────────┴────────┴────────┴──────────┴──────────┴──────────┘');
  }

  // 每日提交统计
  if (dailyStats.size > 0) {
    console.log(`\n📅 每日提交统计 (按日期排序):`);
    
    const sortedDailyStats = Array.from(dailyStats.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const maxNetChanges = Math.max(...sortedDailyStats.map(d => Math.abs(d.netChanges)));
    
    console.log('┌────────────┬────────┬────────┬─────────────────────────────────────────────────────┐');
    console.log('│ 日期       │ 提交数 │ 净增行 │ 代码行数分布图                                      │');
    console.log('├────────────┼────────┼────────┼─────────────────────────────────────────────────────┤');
    
    for (const dayStats of sortedDailyStats) {
      const dateStr = dayStats.date;
      const commitsStr = dayStats.commits.toString();
      const netStr = dayStats.netChanges >= 0 ? `+${dayStats.netChanges}` : `${dayStats.netChanges}`;
      const barChart = drawHorizontalBarChart(Math.abs(dayStats.netChanges), maxNetChanges, 35);
      const authorCount = dayStats.authors.size;
      const suffix = authorCount > 1 ? ` (${authorCount}人)` : ` (${Array.from(dayStats.authors)[0]})`;
      
      console.log(
        '│ ' + dateStr.padEnd(10) + 
        ' │ ' + commitsStr.padStart(6) + 
        ' │ ' + netStr.padStart(6) + 
        ' │ ' + (barChart + ' ' + suffix).padEnd(51) + ' │'
      );
    }
    
    console.log('└────────────┴────────┴────────┴─────────────────────────────────────────────────────┘');
    
    // 统计汇总
    const totalDays = dailyStats.size;
    const avgCommitsPerDay = (totalCommits / totalDays).toFixed(1);
    const avgLinesPerDay = (totalNetChanges / totalDays).toFixed(0);
    
    const mostActiveByCommits = sortedDailyStats.reduce((max, day) => 
      day.commits > max.commits ? day : max
    );
    const mostActiveByLines = sortedDailyStats.reduce((max, day) => 
      Math.abs(day.netChanges) > Math.abs(max.netChanges) ? day : max
    );
    
    console.log(`\n📊 活跃度分析:`);
    console.log(`   • 活跃天数: ${totalDays} 天`);
    console.log(`   • 平均每日提交: ${avgCommitsPerDay} 次`);
    console.log(`   • 平均每日代码量: ${avgLinesPerDay} 行`);
    console.log(`   • 提交最频繁日期: ${mostActiveByCommits.date} (${mostActiveByCommits.commits} 次提交)`);
    console.log(`   • 代码量最多日期: ${mostActiveByLines.date} (${mostActiveByLines.netChanges >= 0 ? '+' : ''}${mostActiveByLines.netChanges} 行)`);
  }

  console.log(`\n✅ 统计完成! 共分析了 ${totalCommits} 个提交记录 (当前分支，纯开发提交)`);
}

program.parse(process.argv);