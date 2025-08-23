/**
 * Claude 代理 - 直接管理Claude进程和消息处理
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const screenshot = require('screenshot-desktop');
const crypto = require('crypto');

class ClaudeProxy extends EventEmitter {
  constructor(serverConfig) {
    super();
    this.serverConfig = serverConfig;
    this.claudeProcess = null;
    this.isRunning = false;
    this.isShuttingDown = false;
    
    this.outputBuffer = '';
    this.messageId = 0;
    this.screenshotTimer = null;
    this.lastScreenshotHash = null;
    
    this.setupGracefulShutdown();
  }

  /**
   * 启动Claude进程
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Claude进程已在运行');
    }

    // 检查必需的环境变量
    if (!process.env.CLAUDE_CODE_GIT_BASH_PATH) {
      throw new Error('缺少必需的环境变量 CLAUDE_CODE_GIT_BASH_PATH');
    }

    try {
      // this.emit('log', 'info', '🚀 启动Claude进程...');
      
      // 启动Claude进程
      this.claudeProcess = spawn(this.serverConfig.claude.command, [], {
        cwd: this.serverConfig.claude.workingDir,
        stdio: 'inherit',  // 完全继承stdin/stdout/stderr
        shell: true,
        env: process.env
      });

      this.isRunning = true;

      // 启动截屏
      this.startScreenshots();

      // this.emit('log', 'info', `✅ Claude进程已启动 (PID: ${this.claudeProcess.pid})`);

      // 监听进程事件
      this.claudeProcess.on('exit', (code, signal) => {
        this.emit('log', 'info', `📴 Claude进程退出 (代码: ${code}, 信号: ${signal})`);
        this.stop();
      });

      this.claudeProcess.on('error', (error) => {
        this.emit('log', 'error', `❌ Claude进程错误: ${error.message}`);
        this.stop();
      });

    } catch (error) {
      this.emit('log', 'error', `❌ 启动Claude失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 停止Claude进程
   */
  async stop() {
    if (!this.isRunning) return;

    this.emit('log', 'info', '🛑 正在停止Claude进程...');
    this.isShuttingDown = true;

    // 停止截屏
    this.stopScreenshots();

    // 终止进程
    if (this.claudeProcess) {
      this.claudeProcess.kill('SIGTERM');
      
      // 等待进程退出
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.claudeProcess && !this.claudeProcess.killed) {
            this.claudeProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.claudeProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    this.isRunning = false;
    this.isShuttingDown = false;
    this.claudeProcess = null;
    
    this.emit('log', 'info', '✅ Claude进程已停止');
  }

  /**
   * 处理WebSocket消息
   */
  handleWebSocketMessage(message) {
    // console.log('[DEBUG] ClaudeProxy收到消息:', message.type);
    
    switch (message.type) {
      case 'chat':
        if (message.message) {
          // console.log('[DEBUG] 收到聊天消息，准备发送到Claude');
          this.simulateKeyboardInput(message.message);
        }
        break;
        
      case 'user_message':
        if (message.content) {
          // console.log('[DEBUG] 收到用户消息，准备发送到Claude');
          this.simulateKeyboardInput(message.content);
        }
        break;
        
      case 'key':
        if (message.key) {
          // console.log('[DEBUG] 收到按键消息:', message.key);
          this.simulateKeyPress(message.key);
        }
        break;
        
      default:
        // console.log('[DEBUG] 未处理的消息类型:', message.type);
    }
  }

  /**
   * 模拟键盘输入到Claude
   */
  simulateKeyboardInput(text) {
    const { exec } = require('child_process');
    
    // console.log(`[DEBUG] 开始处理消息: ${text.substring(0, 50)}...`);
    
    // 设置剪贴板 - 移除不支持的-WindowStyle参数
    const command = `powershell -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`;
    
    // console.log(`[DEBUG] 执行剪贴板命令`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ERROR] 剪贴板设置失败:`, error);
        return;
      }
      
      // console.log(`[DEBUG] 剪贴板设置成功`);
      
      // 发送Ctrl+V
      setTimeout(() => {
        // 先激活Claude窗口，然后发送Ctrl+V
        const activateCommand = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $processes = Get-Process | Where-Object {$_.ProcessName -like '*claude*'}; if ($processes) { $processes[0].MainWindowHandle | ForEach-Object { [System.Windows.Forms.SetForegroundWindow]::Invoke($_) } }"`;
        
        exec(activateCommand, (activateError) => {
          if (activateError) {
            console.error(`[ERROR] 激活窗口失败:`, activateError);
          } else {
            // console.log(`[DEBUG] 窗口激活成功`);
          }
          
          // 等待窗口激活后发送Ctrl+V
          setTimeout(() => {
            const keyCommand = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v{ENTER}')"`;
            
            // console.log(`[DEBUG] 执行Ctrl+V命令`);
            
            exec(keyCommand, (keyError, keyStdout, keyStderr) => {
              if (keyError) {
                console.error(`[ERROR] Ctrl+V发送失败:`, keyError);
              } else {
                // console.log(`[DEBUG] Ctrl+V发送成功`);
              }
            });
          }, 500); // 增加等待时间确保窗口激活
        });
      }, 300);
    });
  }

  /**
   * 模拟按键事件
   */
  simulateKeyPress(keyType) {
    const { exec } = require('child_process');
    
    //console.log(`[DEBUG] 模拟按键: ${keyType}`);
    
    // 先激活Claude窗口
    const activateCommand = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $processes = Get-Process | Where-Object {$_.ProcessName -like '*claude*'}; if ($processes) { $processes[0].MainWindowHandle | ForEach-Object { [System.Windows.Forms.SetForegroundWindow]::Invoke($_) } }"`;
    
    exec(activateCommand, (activateError) => {
      if (activateError) {
        console.error(`[ERROR] 激活窗口失败:`, activateError);
        return;
      }
      
      //console.log(`[DEBUG] 窗口激活成功`);
      
      // 等待窗口激活后发送按键
      setTimeout(() => {
        let sendKey = '';
        
        // 根据按键类型设置SendKeys参数
        switch (keyType) {
          case 'UP':
            sendKey = '{UP}';
            break;
          case 'DOWN':
            sendKey = '{DOWN}';
            break;
          case 'ENTER':
            sendKey = '{ENTER}';
            break;
          case 'ALT_M':
            sendKey = '%m';  // Alt+M
            break;
          case 'CTRL_C':
            sendKey = '^c';  // Ctrl+C
            break;
          case 'CTRL_V':
            sendKey = '^v';  // Ctrl+V
            break;
          default:
            console.error(`[ERROR] 未知的按键类型: ${keyType}`);
            return;
        }
        
        const sendKeysCommand = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')"`;
        
        //console.log(`[DEBUG] 执行SendKeys命令: ${sendKey}`);
        
        exec(sendKeysCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`[ERROR] 模拟按键失败:`, error);
          } else {
            //console.log(`[DEBUG] 模拟按键成功: ${keyType}`);
          }
        });
      }, 300); // 等待窗口激活
    });
  }

  /**
   * 开始截屏
   */
  startScreenshots() {
    if (this.screenshotTimer) return;
    
    // console.log('[DEBUG] 开始截屏');
    this.screenshotTimer = setInterval(async () => {
      try {
        const imgBuffer = await screenshot({ format: 'jpg' });
        
        // 计算图片哈希值
        const hash = crypto.createHash('md5').update(imgBuffer).digest('hex');
        
        // 检查是否与上次截屏相同
        if (hash === this.lastScreenshotHash) {
          // 图片没有变化，跳过传输
          return;
        }
        
        this.lastScreenshotHash = hash;
        const base64 = imgBuffer.toString('base64');
        
        // 发送截屏数据给WebSocket服务器
        this.emit('screenshot', {
          type: 'screenshot',
          data: base64,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('[ERROR] 截屏失败:', error);
      }
    }, 2000); // 每2秒截屏一次
  }

  /**
   * 停止截屏
   */
  stopScreenshots() {
    if (this.screenshotTimer) {
      clearInterval(this.screenshotTimer);
      this.screenshotTimer = null;
      // console.log('[DEBUG] 停止截屏');
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      status: this.isRunning ? 'running' : 'stopped',
      pid: this.claudeProcess ? this.claudeProcess.pid : null,
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * 设置优雅关闭
   */
  setupGracefulShutdown() {
    const cleanup = () => {
      if (!this.isShuttingDown) {
        this.stop();
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

module.exports = ClaudeProxy;