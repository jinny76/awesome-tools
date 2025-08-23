/**
 * Claude 代理 - 基于文件IPC的持续运行Claude系统
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const chokidar = require('chokidar');
const Convert = require('ansi-to-html');

class ClaudeProxy extends EventEmitter {
  constructor(serverConfig, ipcDir) {
    super();
    this.serverConfig = serverConfig;
    this.ipcDir = ipcDir;
    this.claudeProcess = null;
    this.isRunning = false;
    this.isShuttingDown = false;
    
    // 文件路径
    this.inputFile = path.join(ipcDir, 'input.txt');
    this.outputFile = path.join(ipcDir, 'output.txt');
    this.statusFile = path.join(ipcDir, 'status.json');
    this.lockFile = path.join(ipcDir, 'claude.lock');
    this.wrapperScript = path.join(ipcDir, 'claude-wrapper.js');
    
    this.inputWatcher = null;
    this.outputBuffer = '';
    this.messageId = 0;
    
    // 包装器会处理ANSI转换
    
    this.setupIpcFiles();
    this.setupGracefulShutdown();
  }

  /**
   * 设置IPC文件
   */
  setupIpcFiles() {
    // 确保目录存在
    if (!fs.existsSync(this.ipcDir)) {
      fs.mkdirSync(this.ipcDir, { recursive: true });
    }

    // 初始化文件
    this.writeStatus({ status: 'starting', pid: null, lastActivity: new Date().toISOString() });
    
    if (!fs.existsSync(this.inputFile)) {
      fs.writeFileSync(this.inputFile, '');
    }
    if (!fs.existsSync(this.outputFile)) {
      fs.writeFileSync(this.outputFile, '');
    }
  }

  /**
   * 创建Claude包装脚本
   */
  async createClaudeWrapper() {
    // 计算local_tools项目的绝对路径，用于require依赖包
    const localToolsPath = path.resolve(__dirname, '../..');
    
    const wrapperCode = `
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 使用绝对路径加载依赖包
const chokidar = require('${localToolsPath.replace(/\\/g, '\\\\')}/node_modules/chokidar');
const Convert = require('${localToolsPath.replace(/\\/g, '\\\\')}/node_modules/ansi-to-html');

const inputFile = '${this.inputFile.replace(/\\/g, '\\\\')}';
const outputFile = '${this.outputFile.replace(/\\/g, '\\\\')}';
const claudeCmd = '${this.serverConfig.claude.command}';
const workingDir = '${this.serverConfig.claude.workingDir.replace(/\\/g, '\\\\')}';

let messageId = 0;
let claudeProcess = null;

// 初始化ANSI转换器
const ansiConverter = new Convert({
  fg: '#e6e6e6',
  bg: '#1a1a1a',
  newline: false,
  escapeXML: true,
  stream: false
});

// 启动Claude
console.log('🚀 启动Claude包装器...');
console.log('📋 Claude启动参数:');
console.log('   命令:', claudeCmd);
console.log('   工作目录:', workingDir);
console.log('   系统环境变量 CLAUDE_CODE_GIT_BASH_PATH:', process.env.CLAUDE_CODE_GIT_BASH_PATH || '未设置');
console.log('   输入文件:', inputFile);
console.log('   输出文件:', outputFile);

// 检查必需的环境变量
if (!process.env.CLAUDE_CODE_GIT_BASH_PATH) {
  console.error('❌ 缺少必需的环境变量 CLAUDE_CODE_GIT_BASH_PATH');
  console.error('💡 请设置环境变量：');
  console.error('   Windows: set CLAUDE_CODE_GIT_BASH_PATH=C:\\\\tools\\\\git\\\\usr\\\\bin\\\\bash.exe');
  console.error('   或在系统环境变量中添加 CLAUDE_CODE_GIT_BASH_PATH');
  console.error('   然后重新启动终端');
  process.exit(1);
}

// 启动Claude - 完全继承stdio，显示Claude界面
claudeProcess = spawn(claudeCmd, [], {
  cwd: workingDir,
  stdio: 'inherit',  // 完全继承stdin/stdout/stderr
  shell: true,
  env: process.env
});

console.log('⏳ Claude进程启动中，PID:', claudeProcess.pid);
console.log('📺 Claude运行在inherit模式，输出将直接显示在终端');

// 监听输入文件
console.log('👁️ 开始监听输入文件:', inputFile);
const watcher = chokidar.watch(inputFile, {
  persistent: true,
  usePolling: true,
  interval: 100
});

watcher.on('ready', () => {
  console.log('✅ 输入文件监听器就绪');
});

watcher.on('change', () => {
  console.log('🔔 检测到输入文件变化');
  
  try {
    const content = fs.readFileSync(inputFile, 'utf8').trim();
    if (content) {
      console.log('📖 Web界面输入内容:', content);
      console.log('🎯 通过剪贴板+Ctrl+V发送到终端...');
      
      // 使用剪贴板+键盘模拟
      simulateKeyboardInput(content);
      
      // 清空输入文件
      fs.writeFileSync(inputFile, '');
      console.log('🧹 输入文件已清空');
    }
  } catch (error) {
    console.error('❌ 读取输入文件失败:', error.message);
  }
});

// 简单的剪贴板+Ctrl+V模拟
function simulateKeyboardInput(text) {
  const { exec } = require('child_process');
  
  console.log('🔧 设置剪贴板内容...');
  
  // 设置剪贴板
  const command = \`powershell -Command "Set-Clipboard -Value '\${text.replace(/'/g, "''")}'; Write-Host '剪贴板已设置'; Get-Clipboard"\`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ 剪贴板设置失败:', error.message);
      return;
    }
    
    console.log('📋 PowerShell输出:', stdout);
    console.log('✅ 剪贴板内容已设置');
    
    // 发送Ctrl+V
    setTimeout(() => {
      const keyCommand = \`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v{ENTER}'); Write-Host '已发送Ctrl+V和Enter'"\`;
      
      exec(keyCommand, (keyError, keyStdout, keyStderr) => {
        console.log('⌨️ 按键发送结果:', keyStdout || keyStderr);
        if (keyError) {
          console.error('❌ 按键发送失败:', keyError.message);
          console.log('💡 剪贴板已设置，请手动按 Ctrl+V 然后 Enter');
        } else {
          console.log('✅ Ctrl+V 和 Enter 已发送');
        }
      });
    }, 300);
  });
}

watcher.on('error', (error) => {
  console.error('❌ 文件监听器错误:', error.message);
});

// 监听Claude进程事件
claudeProcess.on('spawn', () => {
  console.log('🎯 Claude进程已成功启动 (PID: ' + claudeProcess.pid + ')');
});

claudeProcess.on('error', (error) => {
  console.error('❌ Claude进程启动失败:', error.message);
});

claudeProcess.on('exit', (code, signal) => {
  console.log('🔚 Claude进程退出 (代码:', code, ', 信号:', signal, ')');
  watcher.close();
  console.log('🛑 包装器即将退出');
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  console.log('\\n🛑 包装器收到中断信号');
  if (claudeProcess) {
    claudeProcess.kill('SIGINT');
  }
  watcher.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 包装器收到终止信号');
  if (claudeProcess) {
    claudeProcess.kill('SIGTERM');
  }
  watcher.close();
  process.exit(0);
});

console.log('✅ Claude包装器启动完成');
console.log('🔍 包装器状态检查:');
console.log('   Claude PID:', claudeProcess ? claudeProcess.pid : 'N/A');
console.log('   输入监听:', inputFile);
console.log('   输出文件:', outputFile);
console.log('   监听器状态: 就绪');
console.log('=================== 包装器准备就绪 ===================');
`;

    fs.writeFileSync(this.wrapperScript, wrapperCode);
  }

  /**
   * 启动Claude代理
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Claude代理已在运行');
    }

    // 检查必需的环境变量
    if (!process.env.CLAUDE_CODE_GIT_BASH_PATH) {
      this.emit('log', 'error', '❌ 缺少必需的环境变量 CLAUDE_CODE_GIT_BASH_PATH');
      this.emit('log', 'error', '💡 请设置环境变量：');
      this.emit('log', 'error', '   Windows: set CLAUDE_CODE_GIT_BASH_PATH=C:\\tools\\git\\usr\\bin\\bash.exe');
      this.emit('log', 'error', '   或在系统环境变量中添加 CLAUDE_CODE_GIT_BASH_PATH');
      this.emit('log', 'error', '   然后重新启动终端');
      throw new Error('缺少必需的环境变量 CLAUDE_CODE_GIT_BASH_PATH');
    }

    this.emit('log', 'info', `🚀 启动Claude代理: ${this.serverConfig.name}`);
    this.emit('log', 'info', `📁 工作目录: ${this.serverConfig.claude.workingDir}`);
    this.emit('log', 'info', `🔗 IPC目录: ${this.ipcDir}`);

    try {
      // 创建锁文件
      fs.writeFileSync(this.lockFile, JSON.stringify({
        pid: process.pid,
        startTime: new Date().toISOString(),
        serverName: this.serverConfig.name
      }));

      // 启动Claude进程 - 使用inherit模式保持TTY环境
      const env = {
        ...process.env,
        CLAUDE_CODE_GIT_BASH_PATH: 'C:\\tools\\git\\usr\\bin\\bash.exe'
      };

      // 创建Claude包装脚本
      await this.createClaudeWrapper();
      
      this.claudeProcess = spawn('node', [this.wrapperScript], {
        cwd: this.serverConfig.claude.workingDir,
        stdio: 'inherit',
        shell: true,
        env: env
      });

      this.setupProcessHandlers();
      this.setupOutputWatcher();
      
      // 等待进程启动
      await this.waitForStart();
      
      this.isRunning = true;
      this.writeStatus({ 
        status: 'running', 
        pid: this.claudeProcess.pid, 
        lastActivity: new Date().toISOString() 
      });
      
      this.emit('started');
      this.emit('log', 'info', '✅ Claude代理启动成功');

      return true;

    } catch (error) {
      this.emit('log', 'error', `❌ Claude代理启动失败: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }

  /**
   * 设置进程处理器
   */
  setupProcessHandlers() {
    if (!this.claudeProcess) return;

    // 监听进程退出
    this.claudeProcess.on('exit', (code, signal) => {
      this.isRunning = false;
      this.writeStatus({ 
        status: 'stopped', 
        pid: null, 
        exitCode: code, 
        signal: signal,
        lastActivity: new Date().toISOString() 
      });
      
      this.emit('log', 'info', `🔚 Claude包装器退出 (代码: ${code}, 信号: ${signal})`);
      this.emit('stopped', { code, signal });
      
      if (!this.isShuttingDown) {
        this.cleanup();
      }
    });

    // 监听进程错误
    this.claudeProcess.on('error', (error) => {
      this.emit('log', 'error', `⚠️ Claude包装器错误: ${error.message}`);
      this.emit('error', error);
    });

    // 监听spawn事件
    this.claudeProcess.on('spawn', () => {
      this.emit('log', 'info', '🎯 Claude包装器已启动');
    });
  }

  /**
   * 设置输出文件监听
   */
  setupOutputWatcher() {
    // 监听输出文件变化，当包装器写入新内容时通知Web界面
    this.outputWatcher = chokidar.watch(this.outputFile, {
      persistent: true,
      usePolling: true,
      interval: 100
    });

    this.outputWatcher.on('change', () => {
      this.checkForNewOutput();
    });

    this.emit('log', 'info', `👁️ 开始监听输出文件: ${this.outputFile}`);
  }

  /**
   * 检查新的输出内容
   */
  checkForNewOutput() {
    try {
      const messages = this.readOutput(this.messageId);
      messages.forEach(message => {
        if (message.id > this.messageId) {
          this.messageId = message.id;
          this.emit('output', message.content, message.htmlContent);
        }
      });
    } catch (error) {
      this.emit('log', 'error', `❌ 检查输出失败: ${error.message}`);
    }
  }

  /**
   * 写入状态文件
   */
  writeStatus(statusData) {
    try {
      const status = {
        serverName: this.serverConfig.name,
        ...statusData
      };
      fs.writeFileSync(this.statusFile, JSON.stringify(status, null, 2));
    } catch (error) {
      this.emit('log', 'error', `❌ 写入状态文件失败: ${error.message}`);
    }
  }

  /**
   * 读取输出文件内容
   */
  readOutput(fromId = 0) {
    try {
      if (!fs.existsSync(this.outputFile)) {
        return [];
      }

      const content = fs.readFileSync(this.outputFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const messages = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return null;
        }
      }).filter(msg => msg && msg.id > fromId);

      return messages;
    } catch (error) {
      this.emit('log', 'error', `❌ 读取输出文件失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 清理输出文件
   */
  clearOutput() {
    try {
      fs.writeFileSync(this.outputFile, '');
      this.messageId = 0;
      this.emit('log', 'info', '🗑️ 输出历史已清空');
    } catch (error) {
      this.emit('log', 'error', `❌ 清空输出文件失败: ${error.message}`);
    }
  }

  /**
   * 等待进程启动
   */
  async waitForStart(timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Claude进程启动超时'));
      }, timeout);

      if (this.claudeProcess?.pid) {
        clearTimeout(timer);
        resolve();
      } else {
        this.claudeProcess?.once('spawn', () => {
          clearTimeout(timer);
          resolve();
        });

        this.claudeProcess?.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      }
    });
  }

  /**
   * 获取状态
   */
  getStatus() {
    try {
      if (fs.existsSync(this.statusFile)) {
        const status = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
        return {
          ...status,
          isRunning: this.isRunning,
          hasLock: fs.existsSync(this.lockFile)
        };
      }
    } catch (error) {
      this.emit('log', 'error', `❌ 读取状态失败: ${error.message}`);
    }

    return {
      status: 'unknown',
      isRunning: this.isRunning,
      hasLock: fs.existsSync(this.lockFile),
      serverName: this.serverConfig.name
    };
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    if (!this.isRunning || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.emit('log', 'info', '🛑 开始关闭Claude代理...');

    try {
      // 停止文件监听
      if (this.outputWatcher) {
        this.outputWatcher.close();
        this.outputWatcher = null;
      }

      // 关闭Claude进程
      if (this.claudeProcess && this.claudeProcess.pid) {
        this.claudeProcess.kill('SIGTERM');
        
        // 等待进程退出
        await this.waitForExit(5000);
      }

      this.cleanup();
      this.emit('log', 'info', '✅ Claude代理已关闭');
      
    } catch (error) {
      this.emit('log', 'error', `❌ 关闭Claude代理失败: ${error.message}`);
      this.forceCleanup();
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * 等待进程退出
   */
  async waitForExit(timeout) {
    return new Promise((resolve) => {
      if (!this.claudeProcess || !this.claudeProcess.pid) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => resolve(false), timeout);

      this.claudeProcess.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.claudeProcess) {
      this.claudeProcess.removeAllListeners();
      this.claudeProcess = null;
    }

    if (this.outputWatcher) {
      this.outputWatcher.close();
      this.outputWatcher = null;
    }

    // 删除锁文件
    if (fs.existsSync(this.lockFile)) {
      try {
        fs.unlinkSync(this.lockFile);
      } catch (error) {
        // 忽略删除错误
      }
    }

    this.isRunning = false;
    this.writeStatus({ 
      status: 'stopped', 
      pid: null, 
      lastActivity: new Date().toISOString() 
    });
  }

  /**
   * 强制清理
   */
  forceCleanup() {
    if (this.claudeProcess && this.claudeProcess.pid) {
      try {
        process.kill(this.claudeProcess.pid, 'SIGKILL');
      } catch (error) {
        // 忽略进程不存在的错误
      }
    }
    this.cleanup();
  }

  /**
   * 设置优雅关闭信号处理
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async () => {
      if (!this.isShuttingDown) {
        await this.shutdown();
        process.exit(0);
      }
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('exit', () => {
      this.forceCleanup();
    });
  }
}

module.exports = ClaudeProxy;