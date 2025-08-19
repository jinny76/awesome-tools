const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { shouldExcludeFile, getFileExtension, drawHorizontalBarChart } = require('../utils/common');

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
  
  let excludeInfo = '当前分支 (排除merge提交，只统计真实开发代码量)';
  if (options.exclude) {
    excludeInfo += `，排除文件: ${options.exclude}`;
  }
  console.log(`🔍 统计范围: ${excludeInfo}`);

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
          
          // 检查是否应该排除此文件
          if (shouldExcludeFile(fileName, options.exclude)) {
            continue; // 跳过被排除的文件
          }
          
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
          
          // 检查是否应该排除此文件
          if (shouldExcludeFile(fileName, options.exclude)) {
            continue; // 跳过被排除的文件
          }
          
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
        authorDetails: new Map()
      });
    }
    
    const dayStats = dailyStats.get(dateKey);
    dayStats.commits++;
    dayStats.insertions += totalInsertions;
    dayStats.deletions += totalDeletions;
    dayStats.netChanges += (totalInsertions - totalDeletions);
    
    // 记录每个作者的详细行数统计
    if (!dayStats.authorDetails.has(commit.author)) {
      dayStats.authorDetails.set(commit.author, {
        insertions: 0,
        deletions: 0,
        netChanges: 0
      });
    }
    
    const authorDayStats = dayStats.authorDetails.get(commit.author);
    authorDayStats.insertions += totalInsertions;
    authorDayStats.deletions += totalDeletions;
    authorDayStats.netChanges += (totalInsertions - totalDeletions);

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
    
    // 获取终端宽度，如果无法获取则使用默认值，只使用80%宽度
    const terminalWidth = Math.floor((process.stdout.columns || 120) * 0.8);
    
    // 计算各列的基础宽度
    const dateColWidth = 12;     // 日期列
    const commitsColWidth = 8;   // 提交数列
    const netColWidth = 8;       // 净增行列
    const fixedWidth = dateColWidth + commitsColWidth + netColWidth + 7; // 包括分隔符
    
    // 剩余宽度全部给代码分布图和作者信息列
    const chartAndAuthorColWidth = Math.max(40, terminalWidth - fixedWidth - 2); // 至少40字符
    
    // 动态生成表格边框
    const topBorder = '┌' + '─'.repeat(dateColWidth) + '┬' + '─'.repeat(commitsColWidth) + '┬' + '─'.repeat(netColWidth) + '┬' + '─'.repeat(chartAndAuthorColWidth) + '┐';
    const middleBorder = '├' + '─'.repeat(dateColWidth) + '┼' + '─'.repeat(commitsColWidth) + '┼' + '─'.repeat(netColWidth) + '┼' + '─'.repeat(chartAndAuthorColWidth) + '┤';
    const bottomBorder = '└' + '─'.repeat(dateColWidth) + '┴' + '─'.repeat(commitsColWidth) + '┴' + '─'.repeat(netColWidth) + '┴' + '─'.repeat(chartAndAuthorColWidth) + '┘';
    
    console.log(topBorder);
    console.log('│ 日期       │ 提交数 │ 净增行 │ ' + '代码行数分布图'.padEnd(chartAndAuthorColWidth) + ' │');
    console.log(middleBorder);
    
    for (const dayStats of sortedDailyStats) {
      const dateStr = dayStats.date;
      const commitsStr = dayStats.commits.toString();
      const netStr = dayStats.netChanges >= 0 ? `+${dayStats.netChanges}` : `${dayStats.netChanges}`;
      
      // 构建作者详细信息
      const authorCount = dayStats.authorDetails.size;
      let authorInfo;
      if (authorCount === 1) {
        const [authorName, authorStats] = Array.from(dayStats.authorDetails)[0];
        const authorNetStr = authorStats.netChanges >= 0 ? `+${authorStats.netChanges}` : `${authorStats.netChanges}`;
        authorInfo = ` (${authorName}: ${authorNetStr}行)`;
      } else {
        // 多人协作时显示每个人的行数
        const authorInfos = Array.from(dayStats.authorDetails.entries())
          .sort((a, b) => b[1].netChanges - a[1].netChanges) // 按净增行数排序
          .map(([name, stats]) => {
            const netStr = stats.netChanges >= 0 ? `+${stats.netChanges}` : `${stats.netChanges}`;
            return `${name}: ${netStr}行`;
          });
        authorInfo = ` (${authorInfos.join(', ')})`;
      }
      
      // 固定图表宽度，剩余空间全部给作者信息
      const chartWidth = Math.min(25, Math.floor(chartAndAuthorColWidth * 0.4)); // 图表占40%或最多25字符
      const barChart = drawHorizontalBarChart(Math.abs(dayStats.netChanges), maxNetChanges, chartWidth);
      
      // 组合图表和作者信息
      const chartAndAuthorContent = (barChart + authorInfo).padEnd(chartAndAuthorColWidth);
      
      console.log(
        '│ ' + dateStr.padEnd(dateColWidth - 2) + 
        ' │ ' + commitsStr.padStart(commitsColWidth - 2) + 
        ' │ ' + netStr.padStart(netColWidth - 2) + 
        ' │ ' + chartAndAuthorContent + ' │'
      );
    }
    
    console.log(bottomBorder);
    
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

module.exports = { generateGitStats };