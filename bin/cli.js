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
  .option('-b, --backup', '执行清理前创建备份', true)
  .option('--dry-run', '预览模式，只显示要删除的文件，不实际删除')
  .option('--skip-test', '跳过npm run dev测试验证')
  .option('--include <patterns>', '额外包含的文件模式 (逗号分隔)', '*.ts,*.tsx')
  .option('--exclude <patterns>', '排除的文件模式 (逗号分隔)', 'node_modules/**,dist/**,build/**,*.test.*,*.spec.*')
  .option('--debug', '显示详细的调试信息')
  .option('--debug-file <path>', '额外调试特定文件 (相对路径)')
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
  .requiredOption('-f, --file <path>', '要调试的文件路径 (相对于项目根目录)')
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

// 绘制横向柱状图
function drawHorizontalBarChart(value, maxValue, barWidth = 50) {
  if (maxValue === 0) return '';
  
  const filledLength = Math.round((value / maxValue) * barWidth);
  const emptyLength = barWidth - filledLength;
  
  const filledBar = '█'.repeat(filledLength);
  const emptyBar = '░'.repeat(emptyLength);
  
  return filledBar + emptyBar;
}

// 检查文件是否应该被排除
function shouldExcludeFile(fileName, excludePatterns) {
  if (!excludePatterns || !fileName) return false;
  
  const patterns = excludePatterns.split(',').map(p => p.trim());
  
  for (const pattern of patterns) {
    // 简单的通配符匹配
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(fileName)) {
        return true;
      }
    } else {
      // 精确匹配或包含匹配
      if (fileName === pattern || fileName.includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
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

// 调试文件使用情况
async function debugFileUsage(options) {
  const projectDir = path.resolve(options.dir);
  const targetFile = path.resolve(projectDir, options.file);
  
  // 验证目标文件
  if (!fs.existsSync(targetFile)) {
    throw new Error(`目标文件不存在: ${options.file}`);
  }
  
  console.log(`🔍 调试文件: ${options.file}`);
  console.log(`📁 项目目录: ${projectDir}`);
  console.log(`🎯 完整路径: ${targetFile}`);
  
  // 解析项目配置
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  const projectConfig = await parseProjectConfig(projectDir, packageJson);
  console.log(`📋 项目类型: ${projectConfig.type}`);
  
  // 扫描所有文件
  console.log('\n📂 扫描项目文件...');
  const files = await scanSourceFiles(projectDir, options);
  console.log(`📁 找到 ${files.length} 个源文件`);
  
  // 检查目标文件是否在扫描范围内
  const targetFileInfo = files.find(f => f.path === targetFile);
  if (!targetFileInfo) {
    console.log('❌ 目标文件不在扫描范围内，可能被排除模式过滤了');
    console.log('💡 尝试调整 --include 或 --exclude 选项');
    return;
  }
  
  // 分析依赖关系
  console.log('\n🔗 分析文件依赖关系...');
  const dependencyGraph = await analyzeDependencies(files, projectDir, projectConfig);
  
  // 详细分析目标文件
  console.log('\n' + '='.repeat(80));
  console.log(`📄 文件分析: ${targetFileInfo.relativePath}`);
  console.log('='.repeat(80));
  
  const fileInfo = dependencyGraph.files.get(targetFile);
  
  // 显示文件基本信息
  console.log(`\n📊 基本信息:`);
  console.log(`   文件名: ${targetFileInfo.name}`);
  console.log(`   扩展名: ${targetFileInfo.extension}`);
  console.log(`   是否入口文件: ${fileInfo.isEntry ? '是' : '否'}`);
  
  // 显示导出信息
  console.log(`\n📤 该文件的导出 (${fileInfo.exports.length} 个):`);
  if (fileInfo.exports.length === 0) {
    console.log('   🔸 无导出');
  } else {
    fileInfo.exports.forEach((exp, index) => {
      const typeIcon = exp.type === 'default' ? '🔹' : '🔸';
      console.log(`   ${typeIcon} ${exp.name} (${exp.type})`);
    });
  }
  
  // 显示导入信息
  console.log(`\n📥 该文件的导入 (${fileInfo.imports.length} 个):`);
  if (fileInfo.imports.length === 0) {
    console.log('   🔸 无导入');
  } else {
    fileInfo.imports.forEach((imp, index) => {
      console.log(`   ${index + 1}. ${imp.from} (${imp.type})`);
      if (imp.items && imp.items.length > 0) {
        imp.items.forEach(item => {
          console.log(`      - ${item.name} (${item.type})`);
        });
      }
    });
  }
  
  // 查找谁引用了这个文件
  console.log(`\n🔍 谁引用了这个文件:`);
  const referencedBy = [];
  
  for (const [filePath, file] of dependencyGraph.files) {
    for (const imp of file.imports) {
      const resolvedPaths = resolveImportPath(imp.from, filePath, projectDir, projectConfig);
      const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
      
      if (pathArray.includes(targetFile)) {
        referencedBy.push({
          file: file,
          import: imp,
          filePath: filePath
        });
      }
    }
  }
  
  if (referencedBy.length === 0) {
    console.log('   ❌ 没有找到任何文件引用此文件');
  } else {
    console.log(`   ✅ 找到 ${referencedBy.length} 个引用:`);
    referencedBy.forEach((ref, index) => {
      console.log(`   ${index + 1}. 📄 ${ref.file.relativePath}`);
      console.log(`      🔗 导入: ${ref.import.from} (${ref.import.type})`);
      if (ref.import.items) {
        ref.import.items.forEach(item => {
          console.log(`      📎 使用: ${item.name} (${item.type})`);
        });
      }
    });
  }
  
  // 运行死代码检测来看看为什么被标记
  console.log(`\n🧪 运行死代码检测...`);
  const deadCode = detectDeadCode(dependencyGraph, projectDir, projectConfig);
  
  const isDeadFile = deadCode.files.some(f => f.path === targetFile);
  const deadExportsForFile = deadCode.exports ? deadCode.exports.filter(e => e.filePath === targetFile) : [];
  
  console.log(`\n📋 检测结果:`);
  if (isDeadFile) {
    console.log('   ❌ 被标记为死文件 (完全未使用)');
  } else {
    console.log('   ✅ 文件被使用，未被标记为死文件');
  }
  
  if (deadExportsForFile.length > 0) {
    console.log(`   ⚠️  有 ${deadExportsForFile.length} 个未使用的导出:`);
    deadExportsForFile.forEach(exp => {
      console.log(`      🔸 ${exp.name} (${exp.type})`);
    });
  } else {
    console.log('   ✅ 所有导出都被使用');
  }
  
  // 追踪引用链
  if (referencedBy.length > 0) {
    console.log(`\n🔗 引用链分析:`);
    for (const ref of referencedBy) {
      console.log(`\n   📄 ${ref.file.relativePath}:`);
      
      // 检查引用文件是否是入口或被其他文件使用
      if (ref.file.isEntry) {
        console.log('      ✅ 这是入口文件');
      } else {
        // 检查这个引用文件是否被使用
        const refIsUsed = !deadCode.files.some(f => f.path === ref.filePath);
        if (refIsUsed) {
          console.log('      ✅ 引用文件被使用');
        } else {
          console.log('      ❌ 引用文件也被标记为死代码');
        }
      }
    }
  }
  
  // 提供建议
  console.log(`\n💡 分析建议:`);
  if (isDeadFile) {
    if (referencedBy.length === 0) {
      console.log('   🔸 确实没有找到引用，可能是真的未使用');
    } else {
      console.log('   🔸 找到了引用但仍被标记为死代码，可能的原因:');
      console.log('      - 引用文件本身也是死代码');
      console.log('      - 路径解析存在问题');
      console.log('      - 配置中的alias设置不正确');
    }
  } else {
    console.log('   🔸 文件正常使用中，不会被删除');
  }
  
  console.log('='.repeat(80));
}

// 调试特定文件 (简化版)
async function debugSpecificFile(filePath, dependencyGraph, projectDir, projectConfig, deadCode) {
  const targetFile = path.resolve(projectDir, filePath);
  const fileInfo = dependencyGraph.files.get(targetFile);
  
  if (!fileInfo) {
    console.log(`❌ 文件不在分析范围内: ${filePath}`);
    return;
  }
  
  const relativePath = path.relative(projectDir, targetFile);
  console.log(`📄 ${relativePath}:`);
  
  // 基本信息
  console.log(`   入口文件: ${fileInfo.isEntry ? '是' : '否'}`);
  console.log(`   导出数量: ${fileInfo.exports.length}`);
  console.log(`   导入数量: ${fileInfo.imports.length}`);
  
  // 检查引用
  const referencedBy = [];
  for (const [filePath, file] of dependencyGraph.files) {
    for (const imp of file.imports) {
      const resolvedPaths = resolveImportPath(imp.from, filePath, projectDir, projectConfig);
      const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
      
      if (pathArray.includes(targetFile)) {
        referencedBy.push({
          file: file.relativePath,
          import: imp.from
        });
      }
    }
  }
  
  console.log(`   被引用次数: ${referencedBy.length}`);
  if (referencedBy.length > 0) {
    referencedBy.forEach(ref => {
      console.log(`      📎 ${ref.file} -> ${ref.import}`);
    });
  }
  
  // 检测状态
  const isDeadFile = deadCode.files.some(f => f.path === targetFile);
  console.log(`   状态: ${isDeadFile ? '❌ 死代码' : '✅ 使用中'}`);
  
  if (isDeadFile && referencedBy.length > 0) {
    console.log(`   ⚠️ 警告: 发现引用但仍被标记为死代码!`);
  }
}

// 解析项目配置(Vue CLI/Vite)
async function parseProjectConfig(projectDir, packageJson) {
  const config = {
    type: 'unknown',
    alias: {},
    extensions: ['.vue', '.js', '.jsx', '.ts', '.tsx', '.json'],
    baseUrl: '.',
    srcDir: 'src'
  };
  
  // 检测项目类型
  const isVite = !!(packageJson.dependencies?.vite || packageJson.devDependencies?.vite);
  const isVueCLI = !!(packageJson.dependencies?.['@vue/cli-service'] || 
                     packageJson.devDependencies?.['@vue/cli-service']);
  
  if (isVite) {
    config.type = 'Vite';
    await parseViteConfig(projectDir, config);
  } else if (isVueCLI) {
    config.type = 'Vue CLI';
    await parseVueConfig(projectDir, config);
  } else {
    config.type = 'Generic Vue/JS';
    // 设置默认的alias
    config.alias['@'] = path.join(projectDir, 'src');
  }
  
  return config;
}

// 解析Vite配置
async function parseViteConfig(projectDir, config) {
  const configFiles = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];
  
  for (const configFile of configFiles) {
    const configPath = path.join(projectDir, configFile);
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // 解析alias配置
        const aliasRegex = /alias\s*:\s*{([^}]*)}/s;
        const aliasMatch = configContent.match(aliasRegex);
        if (aliasMatch) {
          const aliasContent = aliasMatch[1];
          
          // 匹配各种alias模式
          const aliasPatterns = [
            // '@': path.resolve(__dirname, 'src')
            /'([^']+)'\s*:\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g,
            // '@': './src'
            /'([^']+)'\s*:\s*['"']([^'"]+)['"']/g,
            // "@": path.resolve(__dirname, "src")  
            /"([^"]+)"\s*:\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g,
            // "@": "./src"
            /"([^"]+)"\s*:\s*['"']([^'"]+)['"']/g
          ];
          
          for (const pattern of aliasPatterns) {
            let match;
            while ((match = pattern.exec(aliasContent)) !== null) {
              const aliasKey = match[1];
              let aliasPath = match[2];
              
              // 处理相对路径
              if (aliasPath.startsWith('./') || aliasPath.startsWith('../')) {
                aliasPath = path.resolve(projectDir, aliasPath);
              } else if (!path.isAbsolute(aliasPath)) {
                aliasPath = path.resolve(projectDir, aliasPath);
              }
              
              config.alias[aliasKey] = aliasPath;
            }
          }
        }
        
        // 解析extensions
        const extensionsRegex = /extensions\s*:\s*\[([^\]]*)\]/;
        const extensionsMatch = configContent.match(extensionsRegex);
        if (extensionsMatch) {
          const extensionsContent = extensionsMatch[1];
          const extensions = extensionsContent.match(/['"']([^'"]+)['"']/g);
          if (extensions) {
            config.extensions = extensions.map(ext => ext.replace(/['"]/g, ''));
          }
        }
        
        break;
      } catch (error) {
        console.log(`⚠️  解析${configFile}失败: ${error.message}`);
      }
    }
  }
  
  // 如果没有找到@别名，设置默认值
  if (!config.alias['@']) {
    config.alias['@'] = path.join(projectDir, 'src');
  }
}

// 解析Vue CLI配置
async function parseVueConfig(projectDir, config) {
  const configPath = path.join(projectDir, 'vue.config.js');
  
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // 解析chainWebpack中的alias配置
      const chainWebpackRegex = /chainWebpack\s*:\s*config\s*=>\s*{([^}]*)}/s;
      const chainMatch = configContent.match(chainWebpackRegex);
      if (chainMatch) {
        const chainContent = chainMatch[1];
        
        // config.resolve.alias.set('@', path.resolve(__dirname, 'src'))
        const aliasSetRegex = /config\.resolve\.alias\.set\s*\(\s*['"']([^'"]+)['"']\s*,\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g;
        let match;
        while ((match = aliasSetRegex.exec(chainContent)) !== null) {
          const aliasKey = match[1];
          const aliasPath = path.resolve(projectDir, match[2]);
          config.alias[aliasKey] = aliasPath;
        }
      }
      
      // 解析configureWebpack中的alias
      const configureWebpackRegex = /configureWebpack\s*:\s*{([^}]*)}/s;
      const configureMatch = configContent.match(configureWebpackRegex);
      if (configureMatch) {
        const configureContent = configureMatch[1];
        
        const resolveRegex = /resolve\s*:\s*{([^}]*)}/s;
        const resolveMatch = configureContent.match(resolveRegex);
        if (resolveMatch) {
          const resolveContent = resolveMatch[1];
          
          const aliasRegex = /alias\s*:\s*{([^}]*)}/s;
          const aliasMatch = resolveContent.match(aliasRegex);
          if (aliasMatch) {
            const aliasContent = aliasMatch[1];
            
            // '@': path.resolve(__dirname, 'src')
            const aliasItemRegex = /['"']([^'"]+)['"']\s*:\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g;
            let match;
            while ((match = aliasItemRegex.exec(aliasContent)) !== null) {
              const aliasKey = match[1];
              const aliasPath = path.resolve(projectDir, match[2]);
              config.alias[aliasKey] = aliasPath;
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️  解析vue.config.js失败: ${error.message}`);
    }
  }
  
  // 如果没有找到@别名，设置默认值
  if (!config.alias['@']) {
    config.alias['@'] = path.join(projectDir, 'src');
  }
}

// 代码清理功能
async function cleanDeadCode(options) {
  const projectDir = path.resolve(options.dir);
  
  // 验证项目目录
  if (!fs.existsSync(projectDir)) {
    throw new Error(`项目目录不存在: ${projectDir}`);
  }
  
  if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
    throw new Error('目录中没有找到package.json文件，请确保这是一个Node.js项目');
  }
  
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  
  // 解析项目配置
  console.log('🔧 解析项目配置...');
  const projectConfig = await parseProjectConfig(projectDir, packageJson);
  console.log(`📋 项目类型: ${projectConfig.type}`);
  if (Object.keys(projectConfig.alias).length > 0) {
    console.log(`🔗 发现 ${Object.keys(projectConfig.alias).length} 个路径别名`);
  }
  
  console.log(`🔍 开始分析项目: ${projectDir}`);
  
  // 扫描所有相关文件
  const files = await scanSourceFiles(projectDir, options);
  console.log(`📁 找到 ${files.length} 个源文件`);
  
  // 分析依赖关系
  console.log('🔗 分析文件依赖关系...');
  const dependencyGraph = await analyzeDependencies(files, projectDir, projectConfig);
  
  // 检测死代码
  console.log('🔍 检测未使用的代码...');
  let deadCode;
  try {
    deadCode = detectDeadCode(dependencyGraph, projectDir, projectConfig);
  } catch (error) {
    console.error('❌ 死代码检测过程中出现错误:', error.message);
    console.log('💡 这可能是由于复杂的循环依赖导致的。请检查项目中是否存在循环引用。');
    throw error;
  }
  
  if (deadCode.files.length === 0 && deadCode.exports.length === 0) {
    console.log('✅ 没有发现死代码，项目代码很干净！');
    return;
  }
  
  // 显示分析结果
  displayAnalysisResults(deadCode);
  
  // 调试模式输出
  if (options.debug) {
    console.log('\n' + '='.repeat(80));
    console.log('🐛 调试信息');
    console.log('='.repeat(80));
    
    console.log(`\n📈 统计详情:`);
    console.log(`   扫描的文件总数: ${files.length}`);
    console.log(`   分析的依赖图节点: ${dependencyGraph.files.size}`);
    console.log(`   入口文件数量: ${Array.from(dependencyGraph.files.values()).filter(f => f.isEntry).length}`);
    
    console.log(`\n🔗 别名配置:`);
    if (Object.keys(projectConfig.alias).length === 0) {
      console.log('   无别名配置');
    } else {
      Object.entries(projectConfig.alias).forEach(([key, value]) => {
        console.log(`   ${key} -> ${path.relative(projectDir, value)}`);
      });
    }
    
    console.log(`\n📂 扩展名配置:`);
    console.log(`   ${projectConfig.extensions.join(', ')}`);
    
    if (deadCode.files.length > 0) {
      console.log(`\n❌ 死文件详情:`);
      deadCode.files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.relativePath}`);
        
        // 显示这个文件有没有被任何文件尝试导入过
        let attemptedImports = 0;
        for (const [filePath, fileInfo] of dependencyGraph.files) {
          for (const imp of fileInfo.imports) {
            if (imp.from.includes(file.relativePath.replace(/\\/g, '/')) || 
                imp.from.includes(path.basename(file.relativePath, path.extname(file.relativePath)))) {
              attemptedImports++;
            }
          }
        }
        
        if (attemptedImports > 0) {
          console.log(`      ⚠️ 发现 ${attemptedImports} 个可能的导入尝试`);
        }
      });
    }
  }
  
  // 调试特定文件
  if (options.debugFile) {
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 调试特定文件: ${options.debugFile}`);
    console.log('='.repeat(80));
    
    await debugSpecificFile(options.debugFile, dependencyGraph, projectDir, projectConfig, deadCode);
  }
  
  if (options.dryRun) {
    console.log('\n💡 这是预览模式，没有实际删除任何文件');
    return;
  }
  
  // 确认删除
  if (!await confirmDeletion(deadCode)) {
    console.log('❌ 用户取消操作');
    return;
  }
  
  // 创建备份
  let backupDir = null;
  if (options.backup) {
    backupDir = await createBackup(projectDir, deadCode);
    console.log(`💾 备份已创建: ${backupDir}`);
  }
  
  try {
    // 执行清理
    await performCleanup(deadCode, projectDir);
    
    // 测试验证
    if (!options.skipTest) {
      console.log('\n🧪 运行测试验证...');
      const testResult = await runDevTest(projectDir);
      
      if (!testResult.success) {
        console.log('❌ 测试失败，正在恢复文件...');
        if (backupDir) {
          await restoreFromBackup(backupDir, projectDir);
          console.log('✅ 文件已恢复');
        }
        throw new Error(`测试失败: ${testResult.error}`);
      }
      
      console.log('✅ 测试通过！');
    }
    
    console.log('\n🎉 代码清理完成！');
    if (backupDir) {
      console.log(`💾 备份文件保存在: ${backupDir}`);
      console.log('💡 如需恢复，请手动复制备份文件');
    }
    
  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error.message);
    if (backupDir) {
      console.log('正在从备份恢复...');
      await restoreFromBackup(backupDir, projectDir);
      console.log('✅ 文件已恢复');
    }
    throw error;
  }
}

// 扫描源文件
async function scanSourceFiles(projectDir, options) {
  const files = [];
  const includePatterns = ['*.vue', '*.js', '*.jsx'];
  
  if (options.include) {
    includePatterns.push(...options.include.split(',').map(p => p.trim()));
  }
  
  const excludePatterns = options.exclude ? options.exclude.split(',').map(p => p.trim()) : [];
  excludePatterns.push('node_modules/**', 'dist/**', 'build/**');
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(projectDir, fullPath);
      
      // 检查是否应该排除
      if (shouldExcludeFile(relativePath, excludePatterns.join(','))) {
        continue;
      }
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        // 检查是否匹配包含模式
        const ext = path.extname(item);
        const shouldInclude = includePatterns.some(pattern => {
          if (pattern.startsWith('*.')) {
            return ext === pattern.substring(1);
          }
          return item.includes(pattern);
        });
        
        if (shouldInclude) {
          files.push({
            path: fullPath,
            relativePath: relativePath,
            name: item,
            extension: ext
          });
        }
      }
    }
  }
  
  scanDirectory(projectDir);
  return files;
}

// 分析依赖关系
async function analyzeDependencies(files, projectDir, projectConfig) {
  const graph = {
    files: new Map(),
    imports: new Map(),
    exports: new Map()
  };
  
  for (const file of files) {
    const content = fs.readFileSync(file.path, 'utf8');
    const analysis = analyzeFileContent(content, file);
    
    graph.files.set(file.path, {
      ...file,
      imports: analysis.imports,
      exports: analysis.exports,
      isEntry: isEntryFile(file, projectDir)
    });
    
    // 记录导入关系，使用配置解析路径
    for (const imp of analysis.imports) {
      const resolvedPaths = resolveImportPath(imp.from, file.path, projectDir, projectConfig);
      
      // 处理单个路径或路径数组
      const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
      
      for (const resolvedPath of pathArray) {
        if (resolvedPath) {
          if (!graph.imports.has(resolvedPath)) {
            graph.imports.set(resolvedPath, new Set());
          }
          graph.imports.get(resolvedPath).add(file.path);
        }
      }
    }
    
    // 记录导出
    for (const exp of analysis.exports) {
      if (!graph.exports.has(file.path)) {
        graph.exports.set(file.path, new Set());
      }
      graph.exports.get(file.path).add(exp);
    }
  }
  
  return graph;
}

// 判断是否为Node模块
function isNodeModule(modulePath) {
  // 跳过npm包和node内置模块
  if (!modulePath) return true;
  
  // 相对路径和绝对路径不是node模块
  if (modulePath.startsWith('.') || modulePath.startsWith('/')) {
    return false;
  }
  
  // 以@开头的可能是alias或scoped package
  if (modulePath.startsWith('@')) {
    // 如果包含/并且第二个/之前没有更多的/，则可能是scoped package
    const parts = modulePath.split('/');
    if (parts.length >= 2 && !parts[1].includes('.')) {
      return true; // scoped package like @vue/cli
    }
    return false; // 可能是alias
  }
  
  // 常见的node模块模式
  const nodeModulePatterns = [
    /^[a-z]/,              // 以小写字母开头
    /^[A-Z]/,              // 以大写字母开头的模块
    /^\d/,                 // 以数字开头
    /^_/,                  // 以下划线开头
  ];
  
  // 如果包含点号，很可能是文件路径
  if (modulePath.includes('.') && modulePath.match(/\.(vue|js|jsx|ts|tsx)$/)) {
    return false;
  }
  
  // 检查是否匹配node模块模式
  const isNodeLike = nodeModulePatterns.some(pattern => pattern.test(modulePath));
  
  // 如果不包含路径分隔符且匹配node模块模式，则认为是node模块
  return isNodeLike && !modulePath.includes('/');
}

// 分析单个文件内容
function analyzeFileContent(content, file) {
  const imports = [];
  const exports = [];
  
  // Vue SFC处理
  if (file.extension === '.vue') {
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      content = scriptMatch[1];
    }
  }
  
  // 匹配ES6导入 - 改进版本以捕获更多细节
  const importPatterns = [
    // import defaultExport from 'module'
    /import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g,
    // import * as name from 'module'
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g,
    // import { export1, export2 } from 'module'
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"`]([^'"`]+)['"`]/g,
    // import defaultExport, { export1, export2 } from 'module'
    /import\s+(\w+)\s*,\s*\{\s*([^}]+)\s*\}\s+from\s+['"`]([^'"`]+)['"`]/g,
    // import 'module' (side effects only)
    /import\s+['"`]([^'"`]+)['"`]/g
  ];
  
  let match;
  for (const pattern of importPatterns) {
    while ((match = pattern.exec(content)) !== null) {
      let modulePath, importedItems = [];
      
      if (pattern === importPatterns[0]) {
        // default import
        modulePath = match[2];
        importedItems = [{ name: match[1], type: 'default' }];
      } else if (pattern === importPatterns[1]) {
        // namespace import
        modulePath = match[2];
        importedItems = [{ name: match[1], type: 'namespace' }];
      } else if (pattern === importPatterns[2]) {
        // named imports
        modulePath = match[2];
        const namedImports = match[1].split(',').map(item => {
          const parts = item.trim().split(/\s+as\s+/);
          return {
            name: parts[0].trim(),
            alias: parts[1] ? parts[1].trim() : undefined,
            type: 'named'
          };
        });
        importedItems = namedImports;
      } else if (pattern === importPatterns[3]) {
        // mixed import
        modulePath = match[3];
        importedItems = [
          { name: match[1], type: 'default' },
          ...match[2].split(',').map(item => ({
            name: item.trim(),
            type: 'named'
          }))
        ];
      } else if (pattern === importPatterns[4]) {
        // side effects only
        modulePath = match[1];
        importedItems = [{ name: '*', type: 'side-effect' }];
      }
      
      if (modulePath && !isNodeModule(modulePath)) {
        imports.push({
          from: modulePath,
          type: 'es6',
          items: importedItems
        });
      }
    }
  }
  
  // 匹配require
  const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const modulePath = match[1];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'commonjs',
        items: [{ name: '*', type: 'require' }]
      });
    }
  }
  
  // 匹配动态导入 import()
  const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const modulePath = match[1];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'dynamic',
        items: [{ name: '*', type: 'dynamic' }]
      });
    }
  }
  
  // 匹配模板字符串中的动态导入
  const templateImportRegex = /import\s*\(\s*`([^`]+)`\s*\)/g;
  while ((match = templateImportRegex.exec(content)) !== null) {
    const modulePath = match[1];
    // 处理模板字符串中的变量 ${var} -> *
    const cleanPath = modulePath.replace(/\$\{[^}]+\}/g, '*');
    if (!isNodeModule(cleanPath)) {
      imports.push({
        from: cleanPath,
        type: 'dynamic-template',
        items: [{ name: '*', type: 'dynamic-template' }]
      });
    }
  }
  
  // 匹配Vue Router的懒加载
  const vueRouterRegex = /component\s*:\s*(?:\(\)\s*=>\s*)?import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = vueRouterRegex.exec(content)) !== null) {
    const modulePath = match[1];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'vue-router',
        items: [{ name: 'default', type: 'vue-component' }]
      });
    }
  }
  
  // 匹配require.ensure (webpack代码分割)
  const requireEnsureRegex = /require\.ensure\s*\([^,]*,\s*(?:function\s*\([^)]*\)\s*{[^}]*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|.*?require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g;
  while ((match = requireEnsureRegex.exec(content)) !== null) {
    const modulePath = match[1] || match[2];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'require-ensure',
        items: [{ name: '*', type: 'ensure' }]
      });
    }
  }
  
  // 检测字符串中可能的文件路径(更保守的方法)
  const stringPathRegex = /['"`](\.[/\\][^'"`]*\.(?:vue|js|jsx|ts|tsx))['"`]/g;
  while ((match = stringPathRegex.exec(content)) !== null) {
    const potentialPath = match[1];
    // 确保这不是已经被其他规则捕获的导入
    const alreadyCaptured = imports.some(imp => imp.from === potentialPath);
    if (!alreadyCaptured) {
      imports.push({
        from: potentialPath,
        type: 'string-reference',
        items: [{ name: '*', type: 'string-ref' }]
      });
    }
  }
  
  // 改进的导出分析
  const exportPatterns = [
    // export default function/class/const/let/var name
    /export\s+default\s+(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g,
    // export default expression
    /export\s+default\s+(\w+)/g,
    // export function/class/const/let/var name
    /export\s+(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g,
    // export { name1, name2 as alias }
    /export\s*\{\s*([^}]+)\s*\}/g,
    // export { name } from 'module'
    /export\s*\{\s*([^}]+)\s*\}\s*from\s*['"`]([^'"`]+)['"`]/g,
    // export * from 'module'
    /export\s*\*\s*from\s*['"`]([^'"`]+)['"`]/g,
    // export * as name from 'module'
    /export\s*\*\s*as\s+(\w+)\s*from\s*['"`]([^'"`]+)['"`]/g
  ];
  
  for (const pattern of exportPatterns) {
    while ((match = pattern.exec(content)) !== null) {
      if (pattern === exportPatterns[0]) {
        // export default with declaration
        const name = match.slice(1).find(group => group !== undefined);
        if (name) {
          exports.push({ name, type: 'default', declared: true });
        }
      } else if (pattern === exportPatterns[1]) {
        // export default expression
        exports.push({ name: match[1], type: 'default', declared: false });
      } else if (pattern === exportPatterns[2]) {
        // export declaration
        const name = match.slice(1).find(group => group !== undefined);
        if (name) {
          exports.push({ name, type: 'named', declared: true });
        }
      } else if (pattern === exportPatterns[3]) {
        // export { ... }
        const exportList = match[1].split(',');
        for (const exp of exportList) {
          const parts = exp.trim().split(/\s+as\s+/);
          const originalName = parts[0].trim();
          const exportedName = parts[1] ? parts[1].trim() : originalName;
          
          if (originalName) {
            exports.push({
              name: exportedName,
              originalName: originalName !== exportedName ? originalName : undefined,
              type: 'named',
              declared: false
            });
          }
        }
      } else if (pattern === exportPatterns[4]) {
        // export { ... } from 'module'
        const modulePath = match[2];
        if (!isNodeModule(modulePath)) {
          const exportList = match[1].split(',');
          for (const exp of exportList) {
            const parts = exp.trim().split(/\s+as\s+/);
            const importedName = parts[0].trim();
            const exportedName = parts[1] ? parts[1].trim() : importedName;
            
            // 这是一个re-export，也要记录为导入
            imports.push({
              from: modulePath,
              type: 're-export',
              items: [{ name: importedName, type: 're-export', exportedAs: exportedName }]
            });
            
            exports.push({
              name: exportedName,
              type: 'named',
              reExportFrom: modulePath,
              declared: false
            });
          }
        }
      } else if (pattern === exportPatterns[5]) {
        // export * from 'module'
        const modulePath = match[1];
        if (!isNodeModule(modulePath)) {
          imports.push({
            from: modulePath,
            type: 're-export-all',
            items: [{ name: '*', type: 're-export-all' }]
          });
          
          exports.push({
            name: '*',
            type: 'namespace',
            reExportFrom: modulePath,
            declared: false
          });
        }
      } else if (pattern === exportPatterns[6]) {
        // export * as name from 'module'
        const name = match[1];
        const modulePath = match[2];
        if (!isNodeModule(modulePath)) {
          imports.push({
            from: modulePath,
            type: 're-export-namespace',
            items: [{ name: '*', type: 're-export-namespace', exportedAs: name }]
          });
          
          exports.push({
            name: name,
            type: 'namespace',
            reExportFrom: modulePath,
            declared: false
          });
        }
      }
    }
  }
  
  return { imports, exports };
}

// 检查是否为入口文件
function isEntryFile(file, projectDir) {
  const entryPatterns = [
    'main.js', 'main.ts', 'index.js', 'index.ts',
    'App.vue', 'app.vue',
    'vite.config.js', 'vite.config.ts', 'vue.config.js'
  ];
  
  // 直接的入口文件
  if (entryPatterns.includes(file.name)) {
    return true;
  }
  
  // 路径模式匹配
  const pathPatterns = [
    /src[/\\]main\./,          // src/main.js, src/main.ts
    /src[/\\]index\./,         // src/index.js, src/index.ts  
    /src[/\\]App\./,           // src/App.vue
    /src[/\\]app\./,           // src/app.vue
    /router[/\\]index\./,      // router/index.js - 路由配置
    /store[/\\]index\./,       // store/index.js - 状态管理
    /plugins[/\\]/,            // plugins/ - Vue插件目录
    /utils[/\\]request\./,     // utils/request.js - 网络请求
    /utils[/\\]auth\./,        // utils/auth.js - 认证相关
    /assets[/\\].*\.(css|scss|less|stylus)$/,  // 样式文件
    /public[/\\]/,             // public目录下的文件
    /tests?[/\\].*\.(test|spec)\./,  // 测试文件
  ];
  
  const relativePath = file.relativePath.replace(/\\/g, '/'); // 标准化路径分隔符
  
  // 检查路径模式
  if (pathPatterns.some(pattern => pattern.test(relativePath))) {
    return true;
  }
  
  // 检查特殊文件内容模式
  if (isSpecialConfigurationFile(file, projectDir)) {
    return true;
  }
  
  return false;
}

// 检查是否为特殊配置文件
function isSpecialConfigurationFile(file, projectDir) {
  // 根目录下的配置文件
  const configPatterns = [
    /^[^/\\]*\.config\.(js|ts|mjs)$/,  // 任何.config.js文件
    /^(babel|webpack|rollup|postcss)\./,  // 构建工具配置
    /^\.env/,                         // 环境变量文件
    /^tsconfig\./,                    // TypeScript配置
    /^jest\./,                        // Jest配置
    /^cypress\./,                     // Cypress配置
  ];
  
  const relativePath = file.relativePath.replace(/\\/g, '/');
  return configPatterns.some(pattern => pattern.test(relativePath));
}

// 检测死代码
function detectDeadCode(graph, projectDir, projectConfig) {
  const usedFiles = new Set();
  const usedExports = new Map(); // filePath -> Set of used export names
  const deadFiles = [];
  const deadExports = [];
  
  // 使用队列避免栈溢出的标记函数
  function markAsUsed(startPath, requiredExports = null) {
    const queue = [{ filePath: startPath, exports: requiredExports }];
    const visited = new Set(); // 防止循环依赖
    
    while (queue.length > 0) {
      const { filePath, exports: currentExports } = queue.shift();
      
      // 创建唯一的访问键，包含文件路径和导出信息
      const visitKey = `${filePath}:${Array.isArray(currentExports) ? currentExports.join(',') : currentExports || '*'}`;
      if (visited.has(visitKey)) {
        continue; // 已经处理过这个文件和导出组合
      }
      visited.add(visitKey);
      
      const fileInfo = graph.files.get(filePath);
      if (!fileInfo) continue;
      
      // 标记文件为已使用
      usedFiles.add(filePath);
      
      // 记录使用的导出
      if (currentExports) {
        if (!usedExports.has(filePath)) {
          usedExports.set(filePath, new Set());
        }
        const exportSet = usedExports.get(filePath);
        
        if (Array.isArray(currentExports)) {
          currentExports.forEach(exp => exportSet.add(exp));
        } else {
          exportSet.add(currentExports);
        }
      } else {
        // 如果没有指定具体导出，标记整个文件被使用
        if (!usedExports.has(filePath)) {
          usedExports.set(filePath, new Set(['*']));
        } else {
          usedExports.get(filePath).add('*');
        }
      }
      
      // 将这个文件导入的所有文件加入队列
      for (const imp of fileInfo.imports) {
        const resolvedPaths = resolveImportPath(imp.from, filePath, projectDir, projectConfig);
        
        // 处理单个路径或路径数组
        const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
        
        for (const resolvedPath of pathArray) {
          if (resolvedPath && graph.files.has(resolvedPath)) {
            // 确定需要哪些导出
            const neededExports = imp.items ? imp.items.map(item => {
              if (item.type === 'default') return 'default';
              if (item.type === 'namespace' || item.name === '*') return '*';
              return item.name;
            }) : ['*'];
            
            // 检查是否已经处理过这个组合
            const nextVisitKey = `${resolvedPath}:${neededExports.join(',')}`;
            if (!visited.has(nextVisitKey)) {
              queue.push({ filePath: resolvedPath, exports: neededExports });
            }
          }
        }
      }
    }
  }
  
  // 从所有入口文件开始
  for (const [filePath, fileInfo] of graph.files) {
    if (fileInfo.isEntry) {
      markAsUsed(filePath);
    }
  }
  
  // 找出未使用的文件
  for (const [filePath, fileInfo] of graph.files) {
    if (!usedFiles.has(filePath) && !fileInfo.isEntry) {
      deadFiles.push({
        path: filePath,
        relativePath: fileInfo.relativePath
      });
    }
  }
  
  // 找出未使用的导出（文件被使用但某些导出未使用）
  for (const [filePath, fileInfo] of graph.files) {
    if (usedFiles.has(filePath) && !fileInfo.isEntry) {
      const usedExportSet = usedExports.get(filePath) || new Set();
      
      // 如果整个文件被标记为使用（通过 * 或动态导入），跳过导出级别检查
      if (usedExportSet.has('*')) {
        continue;
      }
      
      // 检查每个导出是否被使用
      for (const exportInfo of fileInfo.exports) {
        const isUsed = usedExportSet.has(exportInfo.name) || 
                      usedExportSet.has('default') && exportInfo.type === 'default';
        
        if (!isUsed) {
          deadExports.push({
            name: exportInfo.name,
            type: exportInfo.type,
            file: fileInfo.relativePath,
            filePath: filePath
          });
        }
      }
    }
  }
  
  return {
    files: deadFiles,
    exports: deadExports,
    usedFiles: usedFiles.size,
    totalFiles: graph.files.size
  };
}

// 解析导入路径
function resolveImportPath(importPath, fromFile, projectDir, projectConfig) {
  // 跳过npm包
  if (isNodeModule(importPath) && !Object.keys(projectConfig.alias).some(alias => importPath.startsWith(alias))) {
    return null;
  }
  
  // 防止自引用
  if (importPath === '.' || importPath === './') {
    return null;
  }
  
  // 处理模板字符串和通配符路径
  if (importPath.includes('*')) {
    return resolveWildcardPath(importPath, fromFile, projectDir, projectConfig);
  }
  
  let resolved;
  
  // 处理alias路径
  const aliasKey = Object.keys(projectConfig.alias).find(alias => 
    importPath === alias || importPath.startsWith(alias + '/')
  );
  
  if (aliasKey) {
    const aliasPath = projectConfig.alias[aliasKey];
    const remainingPath = importPath.substring(aliasKey.length);
    resolved = path.join(aliasPath, remainingPath);
  } else if (importPath.startsWith('.') || importPath.startsWith('/')) {
    // 相对路径或绝对路径
    const fromDir = path.dirname(fromFile);
    resolved = path.resolve(fromDir, importPath);
  } else {
    return null;
  }
  
  // 尝试解析文件
  const extensions = projectConfig.extensions || ['.js', '.ts', '.vue', '.jsx', '.tsx', '.json'];
  
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      // 防止解析到自身
      if (resolved === fromFile) {
        return null;
      }
      return resolved;
    }
    if (stat.isDirectory()) {
      // 尝试查找index文件
      const indexPatterns = ['index', 'index.js', 'index.ts', 'index.vue'];
      for (const indexPattern of indexPatterns) {
        const indexPath = path.join(resolved, indexPattern);
        if (fs.existsSync(indexPath) && indexPath !== fromFile) {
          return indexPath;
        }
      }
      
      // 尝试添加扩展名到index
      const indexFile = path.join(resolved, 'index');
      for (const ext of extensions) {
        const indexPath = indexFile + ext;
        if (fs.existsSync(indexPath) && indexPath !== fromFile) {
          return indexPath;
        }
      }
    }
  }
  
  // 尝试添加扩展名到文件
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt) && withExt !== fromFile) {
      return withExt;
    }
  }
  
  return null;
}

// 解析通配符路径
function resolveWildcardPath(wildcardPath, fromFile, projectDir, projectConfig) {
  const resolvedPaths = [];
  
  // 处理alias
  let basePath = wildcardPath;
  const aliasKey = Object.keys(projectConfig.alias).find(alias => 
    wildcardPath.startsWith(alias + '/')
  );
  
  if (aliasKey) {
    const aliasPath = projectConfig.alias[aliasKey];
    const remainingPath = wildcardPath.substring(aliasKey.length);
    basePath = path.join(aliasPath, remainingPath);
  } else if (wildcardPath.startsWith('.') || wildcardPath.startsWith('/')) {
    const fromDir = path.dirname(fromFile);
    basePath = path.resolve(fromDir, wildcardPath);
  }
  
  // 将通配符路径转换为目录搜索
  const pathParts = basePath.split('*');
  if (pathParts.length !== 2) {
    return resolvedPaths; // 暂时只支持一个*的情况
  }
  
  const beforeStar = pathParts[0];
  const afterStar = pathParts[1];
  
  // 找到搜索的基础目录
  const searchDir = path.dirname(beforeStar);
  const filePrefix = path.basename(beforeStar);
  
  if (!fs.existsSync(searchDir)) {
    return resolvedPaths;
  }
  
  try {
    const files = fs.readdirSync(searchDir);
    for (const file of files) {
      if (file.startsWith(filePrefix)) {
        const potentialPath = path.join(searchDir, file + afterStar);
        if (fs.existsSync(potentialPath)) {
          resolvedPaths.push(potentialPath);
        }
        
        // 也尝试不同扩展名
        const extensions = projectConfig.extensions || ['.js', '.ts', '.vue', '.jsx', '.tsx'];
        for (const ext of extensions) {
          const withExt = path.join(searchDir, file + afterStar + ext);
          if (fs.existsSync(withExt)) {
            resolvedPaths.push(withExt);
          }
        }
      }
    }
  } catch (error) {
    // 忽略读取目录错误
  }
  
  return resolvedPaths;
}

// 显示分析结果
function displayAnalysisResults(deadCode) {
  console.log('\n📊 死代码分析结果:');
  console.log('='.repeat(70));
  
  // 总体统计
  const usedFiles = deadCode.usedFiles || 0;
  const totalFiles = deadCode.totalFiles || 0;
  const usageRate = totalFiles > 0 ? ((usedFiles / totalFiles) * 100).toFixed(1) : 0;
  
  console.log(`\n📈 分析统计:`);
  console.log(`   总文件数: ${totalFiles}`);
  console.log(`   使用文件数: ${usedFiles}`);
  console.log(`   文件使用率: ${usageRate}%`);
  
  if (deadCode.files.length > 0) {
    console.log(`\n🗑️  发现 ${deadCode.files.length} 个完全未使用的文件:`);
    deadCode.files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.relativePath}`);
    });
  } else {
    console.log('\n✅ 没有发现完全未使用的文件');
  }
  
  if (deadCode.exports && deadCode.exports.length > 0) {
    console.log(`\n📤 发现 ${deadCode.exports.length} 个未使用的导出:`);
    
    // 按文件分组显示
    const exportsByFile = new Map();
    deadCode.exports.forEach(exp => {
      if (!exportsByFile.has(exp.file)) {
        exportsByFile.set(exp.file, []);
      }
      exportsByFile.get(exp.file).push(exp);
    });
    
    let index = 1;
    for (const [fileName, exports] of exportsByFile) {
      console.log(`   ${index++}. 📄 ${fileName}:`);
      exports.forEach(exp => {
        const typeIcon = exp.type === 'default' ? '🔹' : '🔸';
        console.log(`      ${typeIcon} ${exp.name} (${exp.type})`);
      });
    }
    
    console.log(`\n💡 建议: 未使用的导出可以安全删除，但建议先确认是否为公共API`);
  } else {
    console.log('\n✅ 没有发现未使用的导出');
  }
  
  console.log('='.repeat(70));
  
  if (deadCode.files.length === 0 && (!deadCode.exports || deadCode.exports.length === 0)) {
    console.log('\n🎉 恭喜！你的项目代码很干净，没有发现死代码！');
  }
}

// 确认删除
async function confirmDeletion(deadCode) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\n⚠️  确定要删除这些文件吗？(y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// 创建备份
async function createBackup(projectDir, deadCode) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(projectDir, `.backup-${timestamp}`);
  
  fs.mkdirSync(backupDir, { recursive: true });
  
  for (const file of deadCode.files) {
    const relativePath = path.relative(projectDir, file.path);
    const backupPath = path.join(backupDir, relativePath);
    const backupDirPath = path.dirname(backupPath);
    
    fs.mkdirSync(backupDirPath, { recursive: true });
    fs.copyFileSync(file.path, backupPath);
  }
  
  // 创建恢复脚本
  const restoreScript = deadCode.files.map(file => {
    const relativePath = path.relative(projectDir, file.path);
    return `cp "${path.join('.', relativePath)}" "${relativePath}"`;
  }).join('\n');
  
  fs.writeFileSync(path.join(backupDir, 'restore.sh'), restoreScript);
  
  return backupDir;
}

// 执行清理
async function performCleanup(deadCode, projectDir) {
  console.log('\n🧹 开始清理文件...');
  
  for (const file of deadCode.files) {
    try {
      fs.unlinkSync(file.path);
      console.log(`   ✅ 已删除: ${file.relativePath}`);
    } catch (error) {
      console.log(`   ❌ 删除失败: ${file.relativePath} - ${error.message}`);
    }
  }
}

// 运行开发测试
async function runDevTest(projectDir) {
  try {
    console.log('正在启动开发服务器进行验证...');
    
    const testProcess = execSync('npm run dev', {
      cwd: projectDir,
      timeout: 30000,
      encoding: 'utf8'
    });
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.message || '开发服务器启动失败'
    };
  }
}

// 从备份恢复
async function restoreFromBackup(backupDir, projectDir) {
  const files = fs.readdirSync(backupDir);
  
  for (const file of files) {
    if (file === 'restore.sh') continue;
    
    const backupFilePath = path.join(backupDir, file);
    const originalPath = path.join(projectDir, file);
    
    if (fs.statSync(backupFilePath).isFile()) {
      const originalDir = path.dirname(originalPath);
      fs.mkdirSync(originalDir, { recursive: true });
      fs.copyFileSync(backupFilePath, originalPath);
    }
  }
}

program.parse(process.argv);