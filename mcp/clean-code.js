#!/usr/bin/env node

/**
 * Vue死代码清理 MCP 脚本
 * 独立运行的本地 Node.js 脚本，用于 Claude Desktop MCP 集成
 */

const fs = require('fs');
const path = require('path');

/**
 * Vue死代码清理 MCP 工具
 */
class CleanCodeMCP {
  constructor() {
    this.name = "clean-code";
  }

  /**
   * 获取工具定义
   */
  getToolDefinition() {
    return {
      name: "clean-code-analyze",
      description: "分析Vue+Vite项目中的死代码，智能清理未使用的文件和导出",
      inputSchema: {
        type: "object",
        properties: {
          dir: {
            type: "string",
            description: "项目目录路径",
            default: "."
          },
          dryRun: {
            type: "boolean",
            description: "预览模式，不实际删除文件",
            default: true
          },
          runtime: {
            type: "boolean",
            description: "启用运行时分析",
            default: false
          },
          analyzeRuntime: {
            type: "boolean",
            description: "分析已收集的运行时数据",
            default: false
          },
          backup: {
            type: "boolean",
            description: "是否创建备份",
            default: true
          },
          skipTest: {
            type: "boolean",
            description: "跳过测试验证",
            default: false
          }
        },
        required: ["dir"]
      }
    };
  }

  /**
   * 执行死代码分析
   */
  async execute(args) {
    const {
      dir,
      dryRun = true,
      runtime = false,
      analyzeRuntime = false,
      backup = true,
      skipTest = false
    } = args;

    try {
      // 检查目录是否存在
      if (!fs.existsSync(dir)) {
        return {
          success: false,
          message: `❌ 错误：目录 "${dir}" 不存在\n\n请确保目录路径正确`,
          data: { directory: dir, exists: false }
        };
      }

      // 检查是否为Vue项目
      const packageJsonPath = path.join(dir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: `❌ 错误：目录 "${dir}" 不是一个Node.js项目\n\n请确保目录包含 package.json 文件`,
          data: { directory: dir, hasPackageJson: false }
        };
      }

      // 动态导入clean-code功能
      const { analyzeDeadCode } = require('../lib/commands/clean-code');

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

      let analysisResult;
      try {
        // 构建选项
        const options = {
          dir,
          dryRun,
          runtime,
          analyzeRuntime,
          backup,
          skipTest
        };

        // 执行死代码分析
        analysisResult = await analyzeDeadCode(options);
      } finally {
        // 恢复console
        console.log = originalLog;
        console.error = originalError;
      }

      // 格式化输出
      const formattedOutput = this.formatCleanCodeOutput(capturedOutput, analysisResult);

      return {
        success: true,
        message: formattedOutput,
        data: {
          directory: dir,
          options: { dryRun, runtime, analyzeRuntime, backup, skipTest },
          result: analysisResult,
          rawOutput: capturedOutput
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `❌ 死代码分析失败：${error.message}\n\n可能的原因：\n1. 目录不存在或无权限访问\n2. 不是有效的Vue项目\n3. 项目配置文件损坏\n4. 依赖项缺失`,
        error: error.message,
        data: { directory: dir }
      };
    }
  }

  /**
   * 格式化死代码分析输出
   */
  formatCleanCodeOutput(rawOutput, result) {
    // 移除ANSI颜色代码
    const cleanOutput = rawOutput.replace(/\x1b\[[0-9;]*m/g, '');
    
    let formattedOutput = '# 🧹 Vue项目死代码分析报告\n\n';

    // 分析结果概要
    if (result) {
      formattedOutput += '## 📊 分析概要\n\n';
      
      if (result.deadFiles && result.deadFiles.length > 0) {
        formattedOutput += `- **死代码文件数**: ${result.deadFiles.length}\n`;
      }
      
      if (result.unusedExports && result.unusedExports.length > 0) {
        formattedOutput += `- **未使用导出数**: ${result.unusedExports.length}\n`;
      }
      
      if (result.totalFiles) {
        formattedOutput += `- **总文件数**: ${result.totalFiles}\n`;
      }
      
      if (result.cleanupSize) {
        formattedOutput += `- **可清理空间**: ${result.cleanupSize}\n`;
      }
      
      formattedOutput += '\n';
    }

    // 处理输出内容
    const lines = cleanOutput.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      if (line.includes('死代码检测完成')) {
        formattedOutput += '## ✅ 检测结果\n\n';
        continue;
      }
      
      if (line.includes('找到的死代码文件:')) {
        formattedOutput += '## 🗑️ 死代码文件列表\n\n';
        currentSection = 'deadFiles';
        continue;
      }
      
      if (line.includes('未使用的导出:')) {
        formattedOutput += '## 📤 未使用的导出\n\n';
        currentSection = 'unusedExports';
        continue;
      }
      
      if (line.includes('备份已创建')) {
        formattedOutput += '## 💾 备份信息\n\n';
        formattedOutput += `${line.trim()}\n\n`;
        continue;
      }
      
      if (line.includes('清理完成')) {
        formattedOutput += '## 🎉 清理完成\n\n';
        formattedOutput += `${line.trim()}\n\n`;
        continue;
      }
      
      // 处理文件列表
      if (currentSection === 'deadFiles' && line.trim() && line.includes('.')) {
        formattedOutput += `- \`${line.trim()}\`\n`;
      }
      
      if (currentSection === 'unusedExports' && line.trim() && line.includes(':')) {
        formattedOutput += `- ${line.trim()}\n`;
      }
      
      // 处理统计信息
      if (line.includes('总共删除') || line.includes('节省空间') || line.includes('处理文件')) {
        formattedOutput += `**${line.trim()}**\n\n`;
      }
    }

    // 如果输出为空，使用原始输出
    if (formattedOutput.length < 100) {
      return `🧹 Vue死代码分析完成\n\n\`\`\`\n${cleanOutput}\n\`\`\``;
    }

    return formattedOutput;
  }

  /**
   * 获取项目信息
   */
  async getProjectInfo(dir = '.') {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: `❌ 目录 "${dir}" 不是Node.js项目`,
          data: { isNodeProject: false }
        };
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 检测项目类型
      const isVueProject = packageJson.dependencies?.vue || packageJson.devDependencies?.vue;
      const isViteProject = packageJson.dependencies?.vite || packageJson.devDependencies?.vite;
      
      const projectInfo = {
        name: packageJson.name || '未命名项目',
        version: packageJson.version || '未知版本',
        isVueProject: !!isVueProject,
        isViteProject: !!isViteProject,
        hasScripts: !!packageJson.scripts,
        scripts: packageJson.scripts || {}
      };

      let message = `📁 项目信息\n\n`;
      message += `项目名称：${projectInfo.name}\n`;
      message += `版本：${projectInfo.version}\n`;
      message += `Vue项目：${projectInfo.isVueProject ? '是' : '否'}\n`;
      message += `Vite项目：${projectInfo.isViteProject ? '是' : '否'}\n`;
      message += `可用脚本：${Object.keys(projectInfo.scripts).join(', ') || '无'}`;

      return {
        success: true,
        message,
        data: projectInfo
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ 获取项目信息失败：${error.message}`,
        error: error.message
      };
    }
  }
}

// 命令行调用支持
async function main() {
  const cleanCode = new CleanCodeMCP();
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Vue死代码清理 MCP 脚本');
    console.log('用法: node clean-code.js [选项]');
    console.log('选项:');
    console.log('  --dir <path>        项目目录路径 (默认: .)');
    console.log('  --dry-run          预览模式，不实际删除 (默认: true)');
    console.log('  --runtime          启用运行时分析');
    console.log('  --analyze-runtime  分析运行时数据');
    console.log('  --no-backup        不创建备份');
    console.log('  --skip-test        跳过测试验证');
    console.log('  --info             仅显示项目信息');
    console.log('  --help, -h         显示帮助');
    return;
  }

  // 解析参数
  const options = { dir: '.' };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--dir' && args[i + 1]) {
      options.dir = args[i + 1];
      i++;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--runtime') {
      options.runtime = true;
    } else if (arg === '--analyze-runtime') {
      options.analyzeRuntime = true;
    } else if (arg === '--no-backup') {
      options.backup = false;
    } else if (arg === '--skip-test') {
      options.skipTest = true;
    }
  }

  if (args.includes('--info')) {
    const result = await cleanCode.getProjectInfo(options.dir);
    console.log(result.message);
    return;
  }

  const result = await cleanCode.execute(options);
  
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = CleanCodeMCP;