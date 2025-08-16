#!/usr/bin/env node

/**
 * Git统计分析 MCP 脚本
 * 独立运行的本地 Node.js 脚本，用于 Claude Desktop MCP 集成
 */

const fs = require('fs');
const path = require('path');

/**
 * Git统计分析 MCP 工具
 */
class GitStatsMCP {
  constructor() {
    this.name = "git-stats";
  }

  /**
   * 获取工具定义
   */
  getToolDefinition() {
    return {
      name: "git-stats-analyze",
      description: "分析Git仓库的提交历史，生成详细的统计报告",
      inputSchema: {
        type: "object",
        properties: {
          dir: {
            type: "string",
            description: "Git仓库目录路径",
            default: "."
          },
          since: {
            type: "string",
            description: "起始时间 (如: '1 month ago', '2024-01-01')"
          },
          until: {
            type: "string",
            description: "结束时间",
            default: "now"
          },
          author: {
            type: "string",
            description: "过滤特定作者"
          },
          exclude: {
            type: "string",
            description: "排除文件模式 (用逗号分隔)"
          }
        },
        required: []
      }
    };
  }

  /**
   * 执行Git统计分析
   */
  async execute(args) {
    const {
      dir = '.',
      since,
      until = 'now',
      author,
      exclude
    } = args;

    try {
      // 检查是否为Git仓库
      const gitDir = path.join(path.resolve(dir), '.git');
      if (!fs.existsSync(gitDir)) {
        return {
          success: false,
          message: `❌ 错误：目录 "${dir}" 不是一个Git仓库\n\n请确保：\n1. 目录路径正确\n2. 目录包含 .git 文件夹\n3. 已经初始化Git仓库`,
          data: { directory: dir, gitDirExists: false }
        };
      }

      // 动态导入git-stats功能
      const { generateGitStats } = require('../lib/commands/git-stats');

      // 捕获输出
      let capturedOutput = '';
      const originalLog = console.log;
      const originalError = console.error;
      
      console.log = (...args) => {
        capturedOutput += args.join(' ') + '\n';
      };
      
      console.error = (...args) => {
        capturedOutput += 'ERROR: ' + args.join(' ') + '\n';
      };

      try {
        // 执行Git统计分析
        await generateGitStats({
          dir,
          since,
          until,
          author,
          exclude
        });
      } finally {
        // 恢复console
        console.log = originalLog;
        console.error = originalError;
      }

      // 格式化输出
      const formattedOutput = this.formatGitStatsOutput(capturedOutput);

      return {
        success: true,
        message: formattedOutput,
        data: {
          directory: dir,
          since,
          until,
          author,
          exclude,
          rawOutput: capturedOutput
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `❌ Git统计分析失败：${error.message}\n\n可能的原因：\n1. 目录不存在或无权限访问\n2. Git仓库损坏\n3. 指定的时间范围无效\n4. 网络连接问题（如果使用远程仓库）`,
        error: error.message,
        data: { directory: dir }
      };
    }
  }

  /**
   * 格式化Git统计输出
   */
  formatGitStatsOutput(rawOutput) {
    // 移除ANSI颜色代码
    const cleanOutput = rawOutput.replace(/\x1b\[[0-9;]*m/g, '');
    
    // 提取关键信息
    const lines = cleanOutput.split('\n');
    let formattedOutput = '';
    let inStatsSection = false;
    let inTableSection = false;

    for (const line of lines) {
      if (line.includes('Git 提交历史统计报告')) {
        formattedOutput += '# 📊 Git 提交历史统计报告\n\n';
        inStatsSection = true;
        continue;
      }

      if (line.includes('总体统计:')) {
        formattedOutput += '## 📋 总体统计\n\n';
        continue;
      }

      if (line.includes('按作者统计')) {
        formattedOutput += '\n## 👥 按作者统计\n\n';
        inTableSection = true;
        continue;
      }

      if (line.includes('按文件类型统计')) {
        formattedOutput += '\n## 📁 按文件类型统计\n\n';
        inTableSection = true;
        continue;
      }

      if (line.includes('每日提交统计')) {
        formattedOutput += '\n## 📅 每日提交统计\n\n';
        inTableSection = true;
        continue;
      }

      // 处理统计数据行
      if (inStatsSection && line.trim() && !line.includes('=')) {
        if (line.includes('提交数量:') || line.includes('参与人数:') || 
            line.includes('新增行数:') || line.includes('删除行数:') || 
            line.includes('净增行数:')) {
          formattedOutput += `- **${line.trim()}**\n`;
        }
      }

      // 处理表格数据
      if (inTableSection && line.includes('│')) {
        formattedOutput += `${line}\n`;
      }

      // 处理分隔线
      if (line.includes('─') && line.length > 20) {
        if (inTableSection) {
          formattedOutput += '\n';
          inTableSection = false;
        }
      }
    }

    // 如果输出为空，使用原始输出
    if (!formattedOutput.trim()) {
      return `📊 Git统计分析完成\n\n\`\`\`\n${cleanOutput}\n\`\`\``;
    }

    return formattedOutput;
  }

  /**
   * 获取仓库信息
   */
  async getRepoInfo(dir = '.') {
    try {
      const gitDir = path.join(path.resolve(dir), '.git');
      if (!fs.existsSync(gitDir)) {
        return {
          success: false,
          message: `❌ 目录 "${dir}" 不是Git仓库`,
          data: { isGitRepo: false }
        };
      }

      const { execSync } = require('child_process');
      
      // 获取基本仓库信息
      const remoteName = execSync('git remote -v', { cwd: dir, encoding: 'utf8' }).trim();
      const currentBranch = execSync('git branch --show-current', { cwd: dir, encoding: 'utf8' }).trim();
      const lastCommit = execSync('git log -1 --format="%h %s %an %ad" --date=short', { cwd: dir, encoding: 'utf8' }).trim();
      
      return {
        success: true,
        message: `📁 Git仓库信息\n\n当前分支：${currentBranch}\n最新提交：${lastCommit}\n远程仓库：${remoteName ? remoteName.split('\n')[0] : '无'}`,
        data: {
          isGitRepo: true,
          currentBranch,
          lastCommit,
          remoteName: remoteName ? remoteName.split('\n')[0] : null
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ 获取仓库信息失败：${error.message}`,
        error: error.message
      };
    }
  }
}

// 命令行调用支持
async function main() {
  const gitStats = new GitStatsMCP();
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Git统计分析 MCP 脚本');
    console.log('用法: node git-stats.js [选项]');
    console.log('选项:');
    console.log('  --dir <path>        Git仓库路径 (默认: .)');
    console.log('  --since <time>      起始时间 (如: "1 month ago")');
    console.log('  --until <time>      结束时间 (默认: now)');
    console.log('  --author <name>     过滤特定作者');
    console.log('  --exclude <pattern> 排除文件模式');
    console.log('  --info              仅显示仓库信息');
    console.log('  --help, -h          显示帮助');
    return;
  }

  // 解析参数
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      options[key] = value;
    }
  }

  if (args.includes('--info')) {
    const result = await gitStats.getRepoInfo(options.dir);
    console.log(result.message);
    return;
  }

  const result = await gitStats.execute(options);
  
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = GitStatsMCP;