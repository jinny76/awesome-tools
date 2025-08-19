const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class BrowserToolsManager {
  constructor() {
    this.installDir = path.join(os.homedir(), '.browser-tools-mcp');
    this.configDir = path.join(os.homedir(), '.awesome-tools');
    this.pidFile = path.join(this.configDir, 'browser-tools.pid');
    this.logFile = path.join(this.configDir, 'browser-tools.log');
    
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }
  // 跨平台 spawn 辅助方法
  spawnCrossplatform(command, args, options = {}) {
    const isWindows = process.platform === 'win32';
    
    // Windows 平台处理
    if (isWindows) {
      // 如果是 npm/npx 命令，添加 .cmd 后缀
      if (command === 'npm' || command === 'npx') {
        command = `${command}.cmd`;
      }
      // Windows 需要 shell 选项
      options.shell = true;
    }
    
    return spawn(command, args, options);
  }

  async runWizard() {
    console.log('\n🌐 Browser Tools MCP 安装向导\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const question = (prompt) => new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
    
    try {
      const action = await question('选择操作:\n1) 全新安装\n2) 更新现有安装\n3) 启动服务器\n4) 生成配置范例\n5) Chrome扩展安装指南\n请输入选项 (1-5): ');
      
      switch (action.trim()) {
        case '1':
          rl.close();
          await this.fullInstall();
          break;
        case '2':
          rl.close();
          await this.updateInstall();
          break;
        case '3':
          rl.close();
          await this.startServer();
          break;
        case '4':
          rl.close();
          await this.generateConfig();
          break;
        case '5':
          rl.close();
          await this.downloadExtension();
          break;
        default:
          console.log('无效选项');
          rl.close();
      }
    } catch (error) {
      console.error('向导执行失败:', error.message);
      rl.close();
    }
  }

  async fullInstall() {
    console.log('\n📦 开始全新安装...\n');
    
    // 检查前置条件
    await this.checkPrerequisites();
    
    // 下载和安装
    await this.downloadAndInstall();
    
    // 提供扩展安装说明
    this.showExtensionInstructions();
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const question = (prompt) => new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
    
    try {
      // 询问是否下载扩展
      const downloadExt = await question('\n是否现在下载Chrome扩展? (y/n): ');
      if (downloadExt.toLowerCase() === 'y') {
        const extensionDir = path.join(this.configDir, 'chrome-extension');
        const tempDir = path.join(this.configDir, 'temp');
        await this.downloadExtensionFromGit(extensionDir, tempDir);
      }
      
      // 询问是否启动服务器
      const startNow = await question('\n是否现在启动服务器? (y/n): ');
      if (startNow.toLowerCase() === 'y') {
        await this.startServer();
      }
      
      // 询问是否生成配置
      const genConfig = await question('是否生成IDE配置文件? (y/n): ');
      if (genConfig.toLowerCase() === 'y') {
        await this.generateConfig();
      }
      
      rl.close();
    } catch (error) {
      rl.close();
      throw error;
    }
    
    console.log('\n✅ 安装完成!');
    this.showClaudeMcpExamples();
  }

  async downloadAndInstall() {
    console.log('🚀 开始安装Browser Tools MCP...');
    
    try {
      // 使用官方npm包安装MCP服务器
      console.log('安装MCP服务器包...');
      execSync('npm install -g @agentdeskai/browser-tools-mcp@latest', {
        stdio: 'inherit'
      });
      console.log('✅ MCP服务器安装完成');
      
      // 安装Node服务器包 
      console.log('安装Node服务器包...');
      execSync('npm install -g @agentdeskai/browser-tools-server@latest', {
        stdio: 'inherit'
      });
      console.log('✅ Node服务器安装完成');
      
      // 下载Chrome扩展包
      console.log('准备Chrome扩展文件...');
      console.log('💡 Chrome扩展需要手动下载和安装');
      console.log('   扩展将从Chrome Web Store或开发者模式加载');
      
      console.log('\n✅ Browser Tools MCP 安装完成!');
      console.log('\n📋 接下来的步骤:');
      console.log('1. 启动Node服务器: ats bt --start');
      console.log('2. 安装Chrome扩展 (见下方说明)');
      console.log('3. 配置IDE (Claude Desktop 或 Cursor)');
      console.log('4. 在AI客户端中使用浏览器工具');
      
    } catch (error) {
      console.log('❌ 安装失败');
      throw new Error(`安装过程出错: ${error.message}`);
    }
  }

  async updateInstall() {
    console.log('🔄 更新Browser Tools MCP...');
    
    try {
      // 更新MCP服务器包
      console.log('更新MCP服务器包...');
      execSync('npm install -g @agentdeskai/browser-tools-mcp@latest', {
        stdio: 'inherit'
      });
      console.log('✅ MCP服务器更新完成');
      
      // 更新Node服务器包
      console.log('更新Node服务器包...');
      execSync('npm install -g @agentdeskai/browser-tools-server@latest', {
        stdio: 'inherit'
      });
      console.log('✅ Node服务器更新完成');
      
      console.log('\n✅ 更新完成!');
      console.log('💡 请重新启动服务器以应用更新: ats bt --start');
      
    } catch (error) {
      console.log('❌ 更新失败');
      throw new Error(`更新失败: ${error.message}`);
    }
  }

  async startServer(options = {}) {
    const port = options.port || 3025;
    
    // 检查是否已运行
    if (this.isServerRunning()) {
      console.log('服务器已在运行中');
      this.showStatus();
      return;
    }
    
    console.log(`🚀 启动Browser Tools服务器...`);
    console.log(`端口: ${port}`);
    
    try {
      const isWindows = process.platform === 'win32';
      
      // 使用npx启动官方服务器包
      const serverProcess = this.spawnCrossplatform('npx', ['@agentdeskai/browser-tools-server@latest'], {
        detached: !isWindows,  // Windows不支持detached
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PORT: port,
          NODE_ENV: 'production'
        }
      });
      
      // 确保进程已启动
      if (!serverProcess.pid) {
        throw new Error('无法获取进程PID，服务器可能未成功启动');
      }
      
      // 保存PID
      fs.writeFileSync(this.pidFile, serverProcess.pid.toString());
      
      // 设置日志
      const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      if (serverProcess.stdout) serverProcess.stdout.pipe(logStream);
      if (serverProcess.stderr) serverProcess.stderr.pipe(logStream);
      
      // 监听进程退出
      serverProcess.on('exit', (code) => {
        console.log(`服务器进程退出，退出码: ${code}`);
        if (fs.existsSync(this.pidFile)) {
          fs.unlinkSync(this.pidFile);
        }
      });
      
      serverProcess.on('error', (error) => {
        console.error(`服务器进程错误: ${error.message}`);
        if (fs.existsSync(this.pidFile)) {
          fs.unlinkSync(this.pidFile);
        }
      });
      
      // 让进程在后台运行
      serverProcess.unref();
      
      // 等待启动
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (this.isServerRunning()) {
        console.log('✅ 服务器启动成功!');
        console.log(`📊 管理界面: http://localhost:${port}`);
        console.log(`📝 日志文件: ${this.logFile}`);
        this.showClaudeMcpExamples();
      } else {
        console.log('❌ 服务器启动失败，请检查日志');
      }
      
    } catch (error) {
      console.error('启动失败:', error.message);
      // 清理PID文件
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
      }
      throw error;
    }
  }

  async startServerForeground(options = {}) {
    const port = options.port || 3025;
    
    // 检查是否已运行
    if (this.isServerRunning()) {
      console.log('服务器已在运行中，请先停止');
      return;
    }
    
    console.log(`🚀 前台启动Browser Tools服务器...`);
    console.log(`端口: ${port}`);
    console.log('提示: 按 Ctrl+C 停止服务器\n');
    
    try {
      // 前台启动服务器进程
      const serverProcess = this.spawnCrossplatform('npx', ['@agentdeskai/browser-tools-server@latest'], {
        stdio: 'inherit', // 继承stdio，显示所有输出
        env: {
          ...process.env,
          PORT: port,
          NODE_ENV: 'production'
        }
      });
      
      // 监听进程退出
      serverProcess.on('exit', (code) => {
        console.log(`\n服务器已停止 (退出码: ${code})`);
      });
      
      serverProcess.on('error', (error) => {
        console.error(`服务器启动失败: ${error.message}`);
      });
      
      // 等待进程结束
      await new Promise((resolve) => {
        serverProcess.on('close', resolve);
      });
      
    } catch (error) {
      console.error('启动失败:', error.message);
      throw error;
    }
  }

  async stopServer() {
    if (!this.isServerRunning()) {
      console.log('服务器未运行');
      return;
    }
    
    try {
      const pid = fs.readFileSync(this.pidFile, 'utf8').trim();
      process.kill(parseInt(pid), 'SIGTERM');
      fs.unlinkSync(this.pidFile);
      console.log('✅ 服务器已停止');
    } catch (error) {
      console.error('停止服务器失败:', error.message);
    }
  }

  showStatus() {
    console.log('\n📊 Browser Tools MCP 状态\n');
    
    const isRunning = this.isServerRunning();
    
    // 检查全局npm包状态
    let mcpInstalled = false;
    let serverInstalled = false;
    
    try {
      execSync('npm list -g @agentdeskai/browser-tools-mcp', { stdio: 'ignore' });
      mcpInstalled = true;
    } catch (error) {
      // 包未安装
    }
    
    try {
      execSync('npm list -g @agentdeskai/browser-tools-server', { stdio: 'ignore' });
      serverInstalled = true;
    } catch (error) {
      // 包未安装
    }
    
    console.log(`MCP服务器包: ${mcpInstalled ? '✅ 已安装' : '❌ 未安装'} (@agentdeskai/browser-tools-mcp)`);
    console.log(`Node服务器包: ${serverInstalled ? '✅ 已安装' : '❌ 未安装'} (@agentdeskai/browser-tools-server)`);
    console.log(`运行状态: ${isRunning ? '✅ 运行中' : '❌ 未运行'}`);
    
    if (!mcpInstalled || !serverInstalled) {
      console.log('\n💡 安装缺失的包:');
      if (!mcpInstalled) console.log('  npm install -g @agentdeskai/browser-tools-mcp@latest');
      if (!serverInstalled) console.log('  npm install -g @agentdeskai/browser-tools-server@latest');
    }
    
    if (isRunning) {
      const pid = fs.readFileSync(this.pidFile, 'utf8').trim();
      console.log(`\n🔧 运行信息:`);
      console.log(`进程PID: ${pid}`);
      console.log(`日志文件: ${this.logFile}`);
      console.log(`管理界面: http://localhost:3025`);
    }
    
    console.log('\n📱 Chrome扩展:');
    console.log('请手动安装Chrome扩展以完成设置');
    console.log('运行 "ats bt --wizard" 查看详细说明');
    
    if (mcpInstalled && serverInstalled) {
      console.log('\n✅ 基础组件已安装完成');
      if (isRunning) {
        this.showClaudeMcpExamples();
      } else {
        console.log('💡 运行 "ats bt --start" 启动服务器');
      }
    }
  }

  async generateConfig(type = 'all') {
    console.log('\n⚙️  Browser Tools MCP 配置范例\n');
    
    if (type === 'all' || type === 'claude') {
      this.showClaudeConfig();
    }
    
    if (type === 'all' || type === 'cursor') {
      this.showCursorConfig();
    }
    
    if (type === 'all') {
      console.log('\n💡 使用提示:');
      console.log('1. 复制对应配置到相应的配置文件中');
      console.log('2. 重启 IDE 应用');
      console.log('3. 验证 MCP 连接是否成功');
    }
    
    console.log('\n✅ 配置范例已显示!');
    this.showClaudeMcpExamples();
  }

  showClaudeConfig() {
    const config = {
      mcpServers: {
        "browser-tools": {
          command: "npx",
          args: ["@agentdeskai/browser-tools-mcp@latest"],
          env: {
            NODE_ENV: "production"
          }
        }
      }
    };
    
    // 获取配置文件路径
    const configPaths = {
      win32: '%APPDATA%\\Claude\\claude_desktop_config.json',
      darwin: '~/Library/Application Support/Claude/claude_desktop_config.json', 
      linux: '~/.config/Claude/claude_desktop_config.json'
    };
    
    const configPath = configPaths[process.platform] || configPaths.linux;
    
    console.log('📋 Claude Desktop 配置范例');
    console.log('─'.repeat(50));
    console.log(`配置文件位置: ${configPath}`);
    console.log('\n配置内容:');
    console.log('```json');
    console.log(JSON.stringify(config, null, 2));
    console.log('```');
    
    console.log('\n🔧 验证命令:');
    console.log('claude mcp list');
    console.log('claude mcp test browser-tools');
  }

  showCursorConfig() {
    const config = {
      mcp: {
        servers: {
          "browser-tools": {
            command: "npx",
            args: ["@agentdeskai/browser-tools-mcp@latest"],
            env: {
              NODE_ENV: "production"
            }
          }
        }
      }
    };
    
    console.log('\n📋 Cursor IDE 配置范例');
    console.log('─'.repeat(50));
    console.log('配置文件位置: settings.json (在 Cursor IDE 中打开)');
    console.log('\n配置内容:');
    console.log('```json');
    console.log(JSON.stringify(config, null, 2));
    console.log('```');
    
    console.log('\n📖 操作步骤:');
    console.log('1. 在 Cursor 中按 Cmd/Ctrl + Shift + P');
    console.log('2. 搜索 "Open Settings (JSON)"');
    console.log('3. 将上述配置添加到 settings.json 中');
    console.log('4. 保存文件并重启 Cursor');
  }

  showExtensionInstructions() {
    console.log('\n📱 Chrome扩展安装说明:');
    console.log('\n🔗 方式一：从GitHub下载');
    console.log('1. 访问: https://github.com/AgentDeskAI/browser-tools-mcp');
    console.log('2. 点击 "Code" -> "Download ZIP"');
    console.log('3. 解压到本地目录');
    console.log('4. 打开 Chrome 浏览器，访问 chrome://extensions/');
    console.log('5. 开启右上角的 "开发者模式"');
    console.log('6. 点击 "加载已解压的扩展程序"');
    console.log('7. 选择解压后的 chrome-extension 目录');
    console.log('8. 确认扩展已启用');
    
    console.log('\n🏪 方式二：Chrome Web Store (推荐)');
    console.log('1. 搜索 "AgentDesk Browser Tools"');
    console.log('2. 点击 "添加至 Chrome"');
    console.log('3. 确认权限并安装');
    
    console.log('\n✅ 安装完成后，扩展图标会出现在Chrome工具栏中\n');
  }

  // 下载和安装浏览器扩展
  async downloadExtension() {
    console.log('\n📱 Browser Tools Chrome 扩展下载');
    console.log('═'.repeat(50));
    
    const extensionDir = path.join(this.configDir, 'chrome-extension');
    const tempDir = path.join(this.configDir, 'temp');
    
    try {
      // 创建扩展目录
      if (!fs.existsSync(extensionDir)) {
        fs.mkdirSync(extensionDir, { recursive: true });
      }
      
      console.log('\n🔗 扩展获取方式：');
      console.log('\n方式一：自动下载（推荐）');
      console.log('───────────────────────────');
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const question = (prompt) => new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
      
      const choice = await question('是否自动下载Chrome扩展到本地？(y/n): ');
      
      if (choice.toLowerCase() === 'y') {
        rl.close();
        await this.downloadExtensionFromGit(extensionDir, tempDir);
      } else {
        rl.close();
        console.log('\n方式二：Chrome Web Store');
        console.log('───────────────────────────');
        console.log('🌐 扩展商店地址：https://chrome.google.com/webstore/');
        console.log('🔍 搜索关键词："AgentDesk Browser Tools"');
        console.log('📥 一键安装，自动更新');
        
        console.log('\n方式三：手动下载');
        console.log('─────────────────────');
        console.log('📁 本地扩展目录：' + extensionDir);
        console.log('🛠️  适合开发者和测试用户');
        
        // 提供下载链接和指导
        console.log('\n📥 GitHub 下载地址：');
        console.log('https://github.com/AgentDeskAI/browser-tools-mcp');
        console.log('\n💡 手动下载说明：');
        console.log('1. 访问上述 GitHub 地址');
        console.log('2. 点击 "Code" -> "Download ZIP"');
        console.log('3. 解压 chrome-extension 目录到：' + extensionDir);
      }
      
      this.showExtensionInstallSteps();
      
    } catch (error) {
      console.error('❌ 扩展下载失败:', error.message);
    }
  }
  
  // 从Git仓库下载扩展
  async downloadExtensionFromGit(extensionDir, tempDir) {
    console.log('\n🚀 开始自动下载Chrome扩展...');
    
    const isWindows = process.platform === 'win32';
    
    try {
      // 检查Git是否可用
      execSync('git --version', { stdio: 'ignore' });
      
      // 清理临时目录
      if (fs.existsSync(tempDir)) {
        if (isWindows) {
          execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'inherit' });
        } else {
          execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });
        }
      }
      fs.mkdirSync(tempDir, { recursive: true });
      
      console.log('📥 正在克隆仓库...');
      
      // 克隆仓库
      execSync(`git clone https://github.com/AgentDeskAI/browser-tools-mcp.git "${tempDir}"`, {
        stdio: 'inherit'
      });
      
      // 检查扩展目录是否存在
      const sourceExtensionDir = path.join(tempDir, 'chrome-extension');
      if (!fs.existsSync(sourceExtensionDir)) {
        throw new Error('仓库中未找到 chrome-extension 目录');
      }
      
      // 清理目标目录
      if (fs.existsSync(extensionDir)) {
        if (isWindows) {
          execSync(`rmdir /s /q "${extensionDir}"`, { stdio: 'inherit' });
        } else {
          execSync(`rm -rf "${extensionDir}"`, { stdio: 'inherit' });
        }
      }
      
      console.log('📦 正在复制扩展文件...');
      
      // 复制扩展文件
      if (isWindows) {
        execSync(`xcopy /E /I /Y "${sourceExtensionDir}" "${extensionDir}"`, { stdio: 'inherit' });
      } else {
        execSync(`cp -r "${sourceExtensionDir}" "${extensionDir}"`, { stdio: 'inherit' });
      }
      
      // 清理临时目录
      console.log('🧹 清理临时文件...');
      if (isWindows) {
        execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'inherit' });
      } else {
        execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });
      }
      
      console.log('✅ Chrome扩展下载完成！');
      console.log(`📁 扩展位置：${extensionDir}`);
      
      // 检查扩展文件
      const manifestPath = path.join(extensionDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(`📄 扩展信息：${manifest.name} v${manifest.version}`);
      }
      
      console.log('\n🎉 下载成功！现在可以按照以下步骤安装扩展：');
      
    } catch (error) {
      console.error('❌ 自动下载失败:', error.message);
      console.log('\n💡 请尝试手动下载方式：');
      console.log('1. 访问：https://github.com/AgentDeskAI/browser-tools-mcp');
      console.log('2. 下载 ZIP 文件');
      console.log('3. 解压 chrome-extension 目录到本地');
      
      // 清理临时目录
      if (fs.existsSync(tempDir)) {
        try {
          if (isWindows) {
            execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'ignore' });
          } else {
            execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
          }
        } catch (cleanupError) {
          // 忽略清理错误
        }
      }
    }
  }
  
  // 扩展安装步骤说明
  showExtensionInstallSteps() {
    console.log('\n🔧 Chrome 扩展安装步骤：');
    console.log('═'.repeat(50));
    
    console.log('\n📋 开发者模式安装：');
    console.log('1. 打开 Chrome 浏览器');
    console.log('2. 访问 chrome://extensions/');
    console.log('3. 开启右上角的 "开发者模式" 开关');
    console.log('4. 点击 "加载已解压的扩展程序"');
    console.log('5. 选择扩展文件夹');
    console.log('6. 确认扩展已启用');
    
    console.log('\n📋 Web Store 安装：');
    console.log('1. 访问 Chrome Web Store');
    console.log('2. 搜索 "AgentDesk Browser Tools"');
    console.log('3. 点击 "添加至 Chrome"');
    console.log('4. 确认权限并安装');
    
    console.log('\n✅ 验证安装：');
    console.log('• 扩展图标出现在 Chrome 工具栏');
    console.log('• 点击扩展图标可以看到状态');
    console.log('• 控制台无报错信息');
    
    console.log('\n⚠️  注意事项：');
    console.log('• 确保 Chrome 版本 >= 88');
    console.log('• 扩展需要页面刷新后才能正常工作');
    console.log('• 某些企业环境可能限制扩展安装');
  }

  showClaudeMcpExamples() {
    console.log('\n🤖 Browser Tools MCP 使用指南:\n');
    
    console.log('📋 配置验证命令:');
    console.log('  claude mcp list                    # 列出所有MCP服务器');
    console.log('  claude mcp status browser-tools    # 检查服务器状态');
    console.log('  claude mcp test browser-tools      # 测试服务器连接\n');
    
    console.log('🌐 AI客户端中的使用示例:');
    console.log('  "监控浏览器控制台输出"');
    console.log('  "截取当前页面截图"');
    console.log('  "捕获网络请求并分析"');
    console.log('  "分析选定元素的属性"');
    console.log('  "运行可访问性审计"');
    console.log('  "执行性能分析"');
    console.log('  "进行SEO检查"');
    console.log('  "运行最佳实践审计"');
    console.log('  "NextJS专项审计"\n');
    
    console.log('🔧 核心特性:');
    console.log('  ✅ 浏览器状态实时监控');
    console.log('  ✅ 网络流量捕获分析');
    console.log('  ✅ DOM元素智能分析');
    console.log('  ✅ 综合审计报告');
    console.log('  ✅ 隐私保护 (本地存储)');
    console.log('  ✅ MCP标准协议支持\n');
    
    console.log('🔧 常用命令:');
    console.log('  ats bt --wizard                    # 安装向导');
    console.log('  ats bt --start                     # 启动服务器');
    console.log('  ats bt --status                    # 检查服务状态');
    console.log('  ats bt --config                    # 显示配置范例');
    console.log('  ats bt --extension                 # Chrome扩展安装指南\n');
  }

  async checkPrerequisites() {
    console.log('检查系统环境...');
    
    try {
      // 检查Git
      execSync('git --version', { stdio: 'ignore' });
      
      // 检查Node.js
      execSync('node --version', { stdio: 'ignore' });
      
      // 检查npm
      execSync('npm --version', { stdio: 'ignore' });
      
      console.log('✅ 环境检查通过');
    } catch (error) {
      console.log('❌ 环境检查失败');
      throw new Error('请确保已安装 Git, Node.js 和 npm');
    }
  }

  isServerRunning() {
    if (!fs.existsSync(this.pidFile)) {
      return false;
    }
    
    try {
      const pid = parseInt(fs.readFileSync(this.pidFile, 'utf8').trim());
      process.kill(pid, 0); // 检查进程是否存在
      return true;
    } catch (error) {
      // 清理无效的PID文件
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
      }
      return false;
    }
  }


  async testConnection(options = {}) {
    const port = options.port || 3025;
    
    console.log('🔍 测试连接...');
    
    try {
      // 测试HTTP服务器
      const http = require('http');
      const httpTest = new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('超时')));
      });
      
      const httpOk = await httpTest;
      console.log(`HTTP服务器 (${port}): ${httpOk ? '✅' : '❌'}`);
      
      if (httpOk) {
        this.showClaudeMcpExamples();
      }
      
    } catch (error) {
      console.log(`连接测试失败: ${error.message}`);
    }
  }

  inspectInstallation() {
    console.log('\n🔍 检查安装目录内容\n');
    
    if (!fs.existsSync(this.installDir)) {
      console.log('❌ 安装目录不存在');
      return;
    }
    
    console.log(`📁 安装目录: ${this.installDir}`);
    
    try {
      // 列出根目录内容
      const rootItems = fs.readdirSync(this.installDir);
      console.log('\n📂 根目录内容:');
      rootItems.forEach(item => {
        const itemPath = path.join(this.installDir, item);
        const stat = fs.statSync(itemPath);
        const type = stat.isDirectory() ? '📁' : '📄';
        console.log(`  ${type} ${item}`);
      });
      
      // 检查browser-tools-server目录
      const serverDir = path.join(this.installDir, 'browser-tools-server');
      if (fs.existsSync(serverDir)) {
        console.log('\n📁 browser-tools-server/ 内容:');
        const serverItems = fs.readdirSync(serverDir);
        serverItems.forEach(item => {
          const itemPath = path.join(serverDir, item);
          const stat = fs.statSync(itemPath);
          const type = stat.isDirectory() ? '📁' : '📄';
          console.log(`  ${type} ${item}`);
        });
        
        // 检查dist目录
        const distDir = path.join(serverDir, 'dist');
        if (fs.existsSync(distDir)) {
          console.log('\n📁 browser-tools-server/dist/ 内容:');
          const distItems = fs.readdirSync(distDir);
          distItems.forEach(item => {
            console.log(`  📄 ${item}`);
          });
        }
      }
      
      // 检查extension目录
      const extensionDir = path.join(this.installDir, 'extension');
      if (fs.existsSync(extensionDir)) {
        console.log('\n📁 extension/ 内容:');
        const extensionItems = fs.readdirSync(extensionDir);
        extensionItems.forEach(item => {
          console.log(`  📄 ${item}`);
        });
      }
      
    } catch (error) {
      console.error('检查目录时出错:', error.message);
    }
  }
}

module.exports = async function browserToolsCommand(options) {
  const manager = new BrowserToolsManager();
  
  try {
    if (options.wizard) {
      await manager.runWizard();
    } else if (options.extension) {
      await manager.downloadExtension();
    } else if (options.start) {
      await manager.startServer(options);
    } else if (options.stop) {
      await manager.stopServer();
    } else if (options.status) {
      manager.showStatus();
    } else if (options.config !== 'all' || process.argv.includes('--config')) {
      // 只有显式指定 --config 时才执行配置功能
      await manager.generateConfig(options.config);
    } else {
      // 默认显示状态
      manager.showStatus();
    }
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
};;