/**
 * Dev Server 工具模块
 * 提供Claude Code Dev Server的工具函数
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 创建Dev Server工具集
 */
function createDevServerUtils() {
  return {
    /**
     * 检查Claude Code是否已安装
     */
    checkClaudeCodeInstallation() {
      try {
        execSync('claude-code --version', { stdio: 'pipe' });
        return true;
      } catch (error) {
        return false;
      }
    },

    /**
     * 获取Claude Code版本信息
     */
    getClaudeCodeVersion() {
      try {
        const version = execSync('claude-code --version', { 
          encoding: 'utf8', 
          stdio: 'pipe' 
        }).trim();
        return version;
      } catch (error) {
        return null;
      }
    },

    /**
     * 检查项目目录是否有效
     */
    validateProjectDirectory(dir) {
      if (!fs.existsSync(dir)) {
        return { valid: false, error: '目录不存在' };
      }

      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) {
        return { valid: false, error: '不是一个有效的目录' };
      }

      // 检查是否可读写
      try {
        fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        return { valid: false, error: '目录无法读写' };
      }

      return { valid: true };
    },

    /**
     * 获取项目信息
     */
    getProjectInfo(dir) {
      const info = {
        path: dir,
        name: path.basename(dir),
        hasPackageJson: false,
        hasGitRepo: false,
        projectType: 'unknown',
        files: [],
        size: 0
      };

      try {
        // 检查package.json
        const packageJsonPath = path.join(dir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          info.hasPackageJson = true;
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            info.name = packageJson.name || info.name;
            info.version = packageJson.version;
            info.description = packageJson.description;
            
            // 判断项目类型
            if (packageJson.dependencies || packageJson.devDependencies) {
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              if (deps.react) info.projectType = 'React';
              else if (deps.vue) info.projectType = 'Vue';
              else if (deps.express) info.projectType = 'Express';
              else if (deps['@nestjs/core']) info.projectType = 'NestJS';
              else if (deps.typescript) info.projectType = 'TypeScript';
              else info.projectType = 'Node.js';
            }
          } catch (parseError) {
            console.warn('解析package.json失败:', parseError.message);
          }
        }

        // 检查Git仓库
        const gitPath = path.join(dir, '.git');
        info.hasGitRepo = fs.existsSync(gitPath);

        // 获取文件列表（仅顶级）
        const files = fs.readdirSync(dir).filter(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          return stat.isFile();
        });
        info.files = files.slice(0, 10); // 限制显示前10个文件

        // 计算目录大小（仅估算）
        info.size = this.calculateDirectorySize(dir, 2); // 最多2层深度

      } catch (error) {
        console.warn('获取项目信息失败:', error.message);
      }

      return info;
    },

    /**
     * 计算目录大小（带深度限制）
     */
    calculateDirectorySize(dir, maxDepth = 3) {
      if (maxDepth <= 0) return 0;
      
      let totalSize = 0;
      
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          // 跳过常见的大型目录
          if (['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
            continue;
          }
          
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isFile()) {
            totalSize += stat.size;
          } else if (stat.isDirectory()) {
            totalSize += this.calculateDirectorySize(filePath, maxDepth - 1);
          }
        }
      } catch (error) {
        // 忽略权限错误等
      }
      
      return totalSize;
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * 创建项目配置模板
     */
    createProjectConfigTemplate(projectPath, options = {}) {
      return {
        name: options.name || path.basename(projectPath),
        path: projectPath,
        type: options.type || 'unknown',
        createdAt: new Date().toISOString(),
        settings: {
          autoStart: options.autoStart || false,
          startCommand: options.startCommand || 'npm start',
          buildCommand: options.buildCommand || 'npm run build',
          testCommand: options.testCommand || 'npm test'
        },
        environments: {
          development: {
            port: options.devPort || 3000,
            variables: options.devVariables || {}
          },
          production: {
            port: options.prodPort || 8080,
            variables: options.prodVariables || {}
          }
        }
      };
    },

    /**
     * 解析认证字符串
     */
    parseAuthString(authString) {
      if (!authString || typeof authString !== 'string') {
        return null;
      }

      const parts = authString.split(':');
      if (parts.length !== 2) {
        return null;
      }

      return {
        username: parts[0],
        password: parts[1]
      };
    },

    /**
     * 生成随机认证令牌
     */
    generateAuthToken(length = 32) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    },

    /**
     * 检查端口是否可用
     */
    async isPortAvailable(port) {
      return new Promise((resolve) => {
        const net = require('net');
        const server = net.createServer();
        
        server.listen(port, () => {
          server.once('close', () => resolve(true));
          server.close();
        });
        
        server.on('error', () => resolve(false));
      });
    },

    /**
     * 找到可用端口
     */
    async findAvailablePort(startPort = 1024, maxTries = 100) {
      for (let i = 0; i < maxTries; i++) {
        const port = startPort + i;
        if (await this.isPortAvailable(port)) {
          return port;
        }
      }
      throw new Error(`无法在 ${startPort}-${startPort + maxTries} 范围内找到可用端口`);
    },

    /**
     * 获取系统信息
     */
    getSystemInfo() {
      const os = require('os');
      
      return {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        totalMemory: this.formatFileSize(os.totalmem()),
        freeMemory: this.formatFileSize(os.freemem()),
        uptime: os.uptime(),
        hostname: os.hostname(),
        userInfo: os.userInfo()
      };
    },

    /**
     * 创建启动脚本
     */
    createStartupScript(projectPath, options = {}) {
      const scriptContent = `#!/bin/bash
# Auto-generated startup script for Dev Server
# Project: ${path.basename(projectPath)}
# Generated at: ${new Date().toISOString()}

echo "🚀 Starting Dev Server for ${path.basename(projectPath)}..."
echo "📁 Project path: ${projectPath}"

cd "${projectPath}"

# Start Claude Code Dev Server
awesome-tools dev-server --dir "${projectPath}" ${options.port ? `--port ${options.port}` : ''} ${options.auth ? `--auth "${options.auth}"` : ''}

echo "✅ Dev Server started successfully!"
`;

      const scriptPath = path.join(projectPath, 'start-dev-server.sh');
      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
      
      return scriptPath;
    },

    /**
     * 日志格式化
     */
    formatLogMessage(level, message, context = {}) {
      const timestamp = new Date().toISOString();
      const contextStr = Object.keys(context).length > 0 ? 
        ` [${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(', ')}]` : '';
      
      return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}`;
    },

    /**
     * 创建日志记录器
     */
    createLogger(logFile = null) {
      const writeLog = (level, message, context = {}) => {
        const logMessage = this.formatLogMessage(level, message, context);
        console.log(logMessage);
        
        if (logFile) {
          try {
            fs.appendFileSync(logFile, logMessage + '\n');
          } catch (error) {
            console.error('写入日志文件失败:', error.message);
          }
        }
      };

      return {
        info: (message, context) => writeLog('info', message, context),
        warn: (message, context) => writeLog('warn', message, context),
        error: (message, context) => writeLog('error', message, context),
        debug: (message, context) => writeLog('debug', message, context)
      };
    },

    /**
     * 清理临时文件
     */
    cleanupTempFiles(tempDir) {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          return true;
        }
      } catch (error) {
        console.warn('清理临时文件失败:', error.message);
      }
      return false;
    }
  };
}

module.exports = {
  createDevServerUtils
};