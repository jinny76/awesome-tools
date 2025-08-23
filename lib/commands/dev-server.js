/**
 * Dev Server - Claude 进程代理
 * 启动Claude命令并代理其输入输出
 */

const { spawn } = require('child_process');

/**
 * Dev Server 类
 */
class DevServer {
  constructor(options = {}) {
    this.options = {
      projectDir: options.dir || process.cwd(),
      claudeCmd: options.claudeCmd || 'claude',
      ...options
    };
    
    this.claudeProcess = null;
    this.isRunning = false;
  }

  /**
   * 启动Claude代理
   */
  async start() {
    console.log('🚀 启动 Claude Dev Server...');
    console.log(`🤖 启动命令: ${this.options.claudeCmd}`);
    console.log(`📁 工作目录: ${this.options.projectDir}`);
    
    // 设置Claude Code需要的git-bash环境变量
    const env = { 
      ...process.env,
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\tools\\git\\bin\\bash.exe'
    };
    
    // 启动claude进程 - 使用inherit模式让Claude直接与终端交互
    this.claudeProcess = spawn(this.options.claudeCmd, [], {
      cwd: this.options.projectDir,
      stdio: 'inherit',
      shell: true,
      env: env
    });

    this.claudeProcess.on('spawn', () => {
      console.log('✅ Claude进程已启动');
      console.log('💡 现在你可以直接与Claude对话');
      console.log('💡 输入 Ctrl+C 退出\n');
      this.setupInputOutput();
      this.isRunning = true;
    });

    this.claudeProcess.on('error', (error) => {
      console.error('❌ 启动Claude失败:', error.message);
      if (error.code === 'ENOENT') {
        console.error('💡 请确保claude命令可用，或使用 --claude-cmd 指定正确的命令');
        console.error('💡 示例: ats ds --claude-cmd "python -m claude_api"');
      }
      process.exit(1);
    });

    this.claudeProcess.on('exit', (code, signal) => {
      console.log(`\n🔚 Claude进程退出 (代码: ${code}, 信号: ${signal})`);
      process.exit(code || 0);
    });
  }

  /**
   * 设置输入输出代理
   */
  setupInputOutput() {
    // 使用stdio inherit模式，Claude直接继承终端的输入输出
    // 不需要手动处理stdin/stdout管道
    
    console.log('📝 Claude已连接到终端，可以直接交互');
    console.log('💡 按 Ctrl+C 退出');
  }

  /**
   * 停止服务器
   */
  stop() {
    console.log('🛑 正在停止 Dev Server...');
    
    if (this.claudeProcess) {
      this.claudeProcess.kill('SIGTERM');
      this.claudeProcess = null;
    }
    
    this.isRunning = false;
    console.log('✅ Dev Server 已停止');
  }
}

/**
 * 启动Dev Server
 */
async function startDevServer(options) {
  const server = new DevServer(options);

  // 处理不同的命令选项
  if (options.status) {
    console.log('📊 Dev Server 状态: 未运行');
    return;
  }

  if (options.stop) {
    console.log('🛑 停止所有Dev Server实例...');
    return;
  }

  // 默认启动服务器
  await server.start();
}

module.exports = {
  DevServer,
  startDevServer
};