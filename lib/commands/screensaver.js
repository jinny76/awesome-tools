const path = require('path');

// 动态加载UI模块以避免ES模块兼容性问题
async function loadUIModules() {
  try {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;
    return { chalk, ora };
  } catch (error) {
    console.warn('⚠️  UI模块加载失败，使用基础输出');
    // 提供回退实现
    const fallbackChalk = {
      cyan: (text) => text,
      green: (text) => text,
      red: (text) => text,
      yellow: (text) => text,
      blue: (text) => text,
      magenta: (text) => text,
      gray: (text) => text,
      white: (text) => text,
      bold: (text) => text,
      dim: (text) => text
    };
    const fallbackOra = {
      start: () => ({ stop: () => {}, succeed: () => {}, fail: () => {} })
    };
    return { chalk: fallbackChalk, ora: fallbackOra };
  }
}

// Matrix数字雨屏保
class MatrixScreensaver {
  constructor() {
    this.chars = '日ア十二三四五六七八九零一二三四五六七八九ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    this.streams = [];
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    this.running = false;
    this.canvas = [];
    this.lastUpdateTime = 0;
  }

  async start(options = {}) {
    const { chalk } = await loadUIModules();
    
    this.running = true;
    console.clear();
    
    // 隐藏光标
    process.stdout.write('\x1B[?25l');
    
    // 初始化流
    this.initializeStreams();
    
    console.log(chalk.green.bold('🔋 黑客帝国数字雨屏保启动'));
    console.log(chalk.dim('按 Ctrl+C 退出'));
    
    // 设置按键监听
    this.setupKeyListener();
    
    // 开始动画循环
    const interval = setInterval(() => {
      if (!this.running) {
        clearInterval(interval);
        return;
      }
      this.update();
      this.draw();
    }, options.speed || 100);

    return new Promise((resolve) => {
      this.onExit = resolve;
    });
  }

  initializeStreams() {
    this.streams = [];
    // 确保全屏宽度覆盖
    for (let i = 0; i < this.width; i++) {
      if (Math.random() < 0.3) { // 30%的列有数字流
        this.streams.push({
          x: i,
          y: -Math.random() * this.height,
          speed: 0.3 + Math.random() * 1.5,
          chars: [],
          length: 8 + Math.random() * 20,
          intensity: Math.random()
        });
      }
    }
    
    // 初始化画布
    this.canvas = Array(this.height).fill().map(() => Array(this.width).fill(null));
  }

  update() {
    // 清空画布
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.canvas[y][x] && this.canvas[y][x].fade > 0) {
          this.canvas[y][x].fade -= 0.05; // 渐隐效果
          if (this.canvas[y][x].fade <= 0) {
            this.canvas[y][x] = null;
          }
        }
      }
    }
    
    this.streams.forEach(stream => {
      stream.y += stream.speed;
      
      // 重置到顶部
      if (stream.y > this.height + stream.length) {
        stream.y = -stream.length - Math.random() * 10;
        stream.speed = 0.3 + Math.random() * 1.5;
        stream.length = 8 + Math.random() * 20;
        stream.x = Math.floor(Math.random() * this.width); // 随机换列
      }
      
      // 在画布上绘制流
      for (let i = 0; i < stream.length; i++) {
        const y = Math.floor(stream.y - i);
        if (y >= 0 && y < this.height && stream.x < this.width) {
          const intensity = 1 - (i / stream.length);
          this.canvas[y][stream.x] = {
            char: this.chars[Math.floor(Math.random() * this.chars.length)],
            intensity: intensity,
            fade: 1.0,
            isHead: i === 0 // 标记为流头部
          };
        }
      }
    });
  }

  async draw() {
    const { chalk } = await loadUIModules();
    
    // 控制帧率，避免闪烁
    const now = Date.now();
    if (now - this.lastUpdateTime < 80) { // 12.5 FPS
      return;
    }
    this.lastUpdateTime = now;
    
    // 移到屏幕左上角，而不是清屏
    process.stdout.write('\x1B[H');
    
    // 逐行输出，减少闪烁
    for (let y = 0; y < this.height; y++) {
      let line = '';
      for (let x = 0; x < this.width; x++) {
        const cell = this.canvas[y][x];
        if (cell) {
          const intensity = cell.intensity * cell.fade;
          if (cell.isHead || intensity > 0.8) {
            line += chalk.white.bold(cell.char);
          } else if (intensity > 0.6) {
            line += chalk.green.bold(cell.char);
          } else if (intensity > 0.3) {
            line += chalk.green(cell.char);
          } else {
            line += chalk.green.dim(cell.char);
          }
        } else {
          line += ' ';
        }
      }
      // 清除行末并输出
      process.stdout.write('\x1B[K' + line + (y < this.height - 1 ? '\n' : ''));
    }
  }

  setupKeyListener() {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      // Ctrl+C or ESC or q
      if (key[0] === 3 || key[0] === 27 || key.toString() === 'q') {
        this.stop();
      }
    });
  }

  stop() {
    this.running = false;
    
    // 显示光标
    process.stdout.write('\x1B[?25h');
    
    // 恢复输入模式
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    
    console.clear();
    console.log('🔋 屏保已退出');
    
    if (this.onExit) {
      this.onExit();
    }
  }
}

// C++编译模拟屏保
class CompilerScreensaver {
  constructor(speed = 1500) {
    // 更真实的项目文件结构
    this.sourceFiles = [
      'src/main.cpp', 'src/core/engine.cpp', 'src/core/renderer.cpp', 'src/utils/math.cpp',
      'src/utils/string_utils.cpp', 'src/network/client.cpp', 'src/network/server.cpp',
      'src/database/connection.cpp', 'src/database/query_builder.cpp', 'src/ui/window.cpp',
      'src/ui/widgets/button.cpp', 'src/ui/widgets/textbox.cpp', 'src/config/settings.cpp',
      'src/logging/logger.cpp', 'src/parsing/json_parser.cpp', 'src/parsing/xml_parser.cpp',
      'src/validation/input_validator.cpp', 'src/cache/memory_cache.cpp', 'src/cache/file_cache.cpp',
      'src/threading/thread_pool.cpp', 'src/memory/allocator.cpp', 'src/crypto/hash.cpp',
      'src/filesystem/file_manager.cpp', 'src/graphics/texture.cpp', 'src/graphics/shader.cpp',
      'src/audio/sound_manager.cpp', 'src/physics/collision.cpp', 'src/ai/pathfinding.cpp',
      'test/unit_tests.cpp', 'test/integration_tests.cpp', 'examples/demo.cpp'
    ];
    
    this.headerFiles = [
      'include/engine.h', 'include/renderer.h', 'include/utils.h', 'include/network.h',
      'include/database.h', 'include/ui.h', 'include/config.h', 'include/logger.h',
      'include/parser.h', 'include/validator.h', 'include/cache.h', 'include/threading.h'
    ];
    
    // 更真实的编译步骤
    this.compileSteps = [
      'Scanning dependencies of target',
      'Building C++ object CMakeFiles/',
      'Linking C++ static library',
      'Linking C++ shared library', 
      'Building C++ executable',
      'Generating export header',
      'Running custom build step',
      'Processing resources',
      'Copying files to output directory'
    ];
    
    this.warnings = [
      'unused parameter \'argc\'',
      'implicit conversion from \'int\' to \'float\'',
      'deprecated function \'strcpy\' used',
      'potential memory leak in function \'allocateBuffer\'',
      'unreachable code after return statement',
      'missing return statement in non-void function',
      'uninitialized local variable \'ptr\' used',
      'signed/unsigned mismatch in comparison',
      'possible loss of data converting \'double\' to \'int\'',
      'unused variable \'result\'',
      'assignment within conditional expression',
      'format string is not a string literal'
    ];
    
    this.errors = [
      'undefined reference to `boost::filesystem::path::path()\'',
      'expected \';\' before \'}\' token',
      'no matching function for call to \'std::vector<int>::push_front()\'',
      '\'class std::string\' has no member named \'split\'',
      'conflicting declaration \'double PI\'',
      'redefinition of \'void processData()\'',
      'ISO C++ forbids declaration with no type',
      'invalid conversion from \'const char*\' to \'int\'',
      'template argument deduction failed',
      'multiple definition of `main\''
    ];
    
    this.libraries = [
      'pthread', 'boost_system', 'boost_filesystem', 'opencv_core', 'opencv_imgproc',
      'ssl', 'crypto', 'curl', 'sqlite3', 'mysql', 'redis', 'zmq', 'protobuf'
    ];
    
    this.running = false;
    this.currentProject = 'AwesomeEngine';
    this.totalTargets = Math.floor(Math.random() * 8) + 15; // 15-22个目标
    this.completedTargets = 0;
    this.currentFiles = [...this.sourceFiles, ...this.headerFiles];
    this.speed = Math.max(speed, 800); // 最小800ms保证真实感
    this.lastWarningTime = 0;
    this.buildStartTime = Date.now();
  }

  async start(options = {}) {
    const { chalk, ora } = await loadUIModules();
    
    this.running = true;
    console.clear();
    
    console.log(chalk.cyan.bold('🔧 C++ 项目编译模拟器'));
    console.log(chalk.dim('按 Ctrl+C 或 q 退出\n'));
    
    // 设置按键监听
    this.setupKeyListener();
    
    // 开始编译模拟
    await this.simulateCompilation();
    
    return new Promise((resolve) => {
      this.onExit = resolve;
    });
  }

  async simulateCompilation() {
    const { chalk, ora } = await loadUIModules();
    
    // 显示项目信息
    console.log(chalk.cyan(`Building project: ${this.currentProject}`));
    console.log(chalk.gray(`Targets to build: ${this.totalTargets}`));
    console.log('');
    
    // 打乱文件顺序，模拟真实编译
    const shuffledFiles = [...this.currentFiles].sort(() => Math.random() - 0.5);
    let fileIndex = 0;
    
    while (this.running && this.completedTargets < this.totalTargets) {
      // 选择当前编译的文件
      const currentFile = shuffledFiles[fileIndex % shuffledFiles.length];
      const compileStep = this.compileSteps[Math.floor(Math.random() * this.compileSteps.length)];
      const targetName = currentFile.replace(/^src\/|^include\//, '').replace(/\.(cpp|h)$/, '');
      
      // 显示编译步骤
      const stepMessage = `${compileStep} ${targetName}.dir/${currentFile.replace(/^.*\//, '')}.o`;
      console.log(chalk.blue(`[${this.completedTargets + 1}/${this.totalTargets}] ${stepMessage}`));
      
      // 模拟编译器输出
      if (Math.random() < 0.4) {
        console.log(chalk.gray(`  c++ -I/usr/include -std=c++17 -O2 -Wall -c ${currentFile} -o build/${targetName}.o`));
      }
      
      // 随机警告（更真实的频率）
      const now = Date.now();
      if (Math.random() < 0.25 && (now - this.lastWarningTime) > 3000) {
        const warning = this.warnings[Math.floor(Math.random() * this.warnings.length)];
        const lineNum = Math.floor(Math.random() * 500) + 1;
        const colNum = Math.floor(Math.random() * 80) + 1;
        console.log(chalk.yellow(`${currentFile}:${lineNum}:${colNum}: warning: ${warning} [-Wunused-variable]`));
        this.lastWarningTime = now;
      }
      
      // 罕见的链接错误（5%概率）
      if (Math.random() < 0.05) {
        const error = this.errors[Math.floor(Math.random() * this.errors.length)];
        const lineNum = Math.floor(Math.random() * 200) + 1;
        console.log(chalk.red(`${currentFile}:${lineNum}: error: ${error}`));
        console.log(chalk.yellow('make[2]: *** [CMakeFiles/target.dir/build.make:76] Error 1'));
        console.log(chalk.yellow('Retrying with different flags...'));
        await this.sleep(Math.random() * 2000 + 1500);
        console.log(chalk.green('Build recovered, continuing...'));
      }
      
      // 链接库时显示库依赖
      if (currentFile.includes('.cpp') && Math.random() < 0.2) {
        const lib = this.libraries[Math.floor(Math.random() * this.libraries.length)];
        console.log(chalk.gray(`  Linking with -l${lib}`));
      }
      
      // 显示构建进度（不是简单的百分比）
      const percentage = Math.floor((this.completedTargets / this.totalTargets) * 100);
      const elapsed = Math.floor((Date.now() - this.buildStartTime) / 1000);
      const rate = this.completedTargets > 0 ? (this.completedTargets / elapsed).toFixed(1) : '0.0';
      
      console.log(chalk.gray(`  Progress: ${percentage}% (${this.completedTargets}/${this.totalTargets}) [${rate} targets/sec]`));
      console.log('');
      
      this.completedTargets++;
      fileIndex++;
      
      // 变化的等待时间，模拟不同文件的编译复杂度
      const complexity = Math.random();
      let waitTime = this.speed;
      if (currentFile.includes('test/') || currentFile.includes('examples/')) {
        waitTime *= 0.6; // 测试文件编译快
      } else if (currentFile.includes('graphics/') || currentFile.includes('ai/')) {
        waitTime *= 1.8; // 图形和AI代码编译慢
      } else if (complexity > 0.8) {
        waitTime *= 2.2; // 20%的文件编译很慢（模板、复杂逻辑）
      }
      
      await this.sleep(waitTime * (0.8 + Math.random() * 0.4)); // ±20%变化
    }
    
    if (this.running) {
      const totalTime = Math.floor((Date.now() - this.buildStartTime) / 1000);
      const minutes = Math.floor(totalTime / 60);
      const seconds = totalTime % 60;
      
      console.log(chalk.green.bold('✅ Build completed successfully!'));
      console.log(chalk.cyan(`Generated executable: ./build/${this.currentProject.toLowerCase()}`));
      console.log(chalk.cyan(`Generated static library: ./build/lib${this.currentProject.toLowerCase()}.a`));
      console.log(chalk.gray(`Build time: ${minutes}m ${seconds}s`));
      console.log('');
      
      // 长暂停，然后开始新项目
      await this.sleep(5000 + Math.random() * 5000);
      
      if (this.running) {
        // 生成新的项目设置
        const projectNames = ['GameEngine', 'WebServer', 'ImageProcessor', 'DatabaseDriver', 'MathLibrary', 'NetworkTool'];
        this.currentProject = projectNames[Math.floor(Math.random() * projectNames.length)];
        this.totalTargets = Math.floor(Math.random() * 12) + 18;
        this.completedTargets = 0;
        this.buildStartTime = Date.now();
        
        console.log(chalk.yellow(`🔄 Starting new build: ${this.currentProject}...\n`));
        await this.simulateCompilation();
      }
    }
  }

  setupKeyListener() {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      // Ctrl+C or ESC or q
      if (key[0] === 3 || key[0] === 27 || key.toString() === 'q') {
        this.stop();
      }
    });
  }

  stop() {
    this.running = false;
    
    // 恢复输入模式
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    
    console.log('\n🔧 编译模拟器已退出');
    
    if (this.onExit) {
      this.onExit();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 代码编写模拟屏保
class CodingScreensaver {
  constructor(speed = 1000) {
    this.speed = speed;
    this.running = false;
    this.currentFile = 'src/components/UserProfile.jsx';
    this.codeLines = [];
    this.currentLine = 0;
    this.cursorCol = 0;
    this.typing = false;
    
    this.codeTemplates = [
      // React组件
      {
        file: 'src/components/UserProfile.jsx',
        code: [
          'import React, { useState, useEffect } from \'react\';',
          'import { fetchUserData } from \'../api/users\';',
          'import { Avatar, Card, Button } from \'../ui/components\';',
          '',
          'const UserProfile = ({ userId }) => {',
          '  const [user, setUser] = useState(null);',
          '  const [loading, setLoading] = useState(true);',
          '  const [error, setError] = useState(null);',
          '',
          '  useEffect(() => {',
          '    const loadUser = async () => {',
          '      try {',
          '        setLoading(true);',
          '        const userData = await fetchUserData(userId);',
          '        setUser(userData);',
          '      } catch (err) {',
          '        setError(err.message);',
          '      } finally {',
          '        setLoading(false);',
          '      }',
          '    };',
          '',
          '    if (userId) {',
          '      loadUser();',
          '    }',
          '  }, [userId]);',
          '',
          '  if (loading) return <div>Loading...</div>;',
          '  if (error) return <div>Error: {error}</div>;',
          '  if (!user) return <div>User not found</div>;',
          '',
          '  return (',
          '    <Card className="user-profile">',
          '      <Avatar src={user.avatar} alt={user.name} />',
          '      <h2>{user.name}</h2>',
          '      <p>{user.email}</p>',
          '      <Button onClick={() => window.location.href = `/chat/${user.id}`}>',
          '        Send Message',
          '      </Button>',
          '    </Card>',
          '  );',
          '};',
          '',
          'export default UserProfile;'
        ]
      },
      // API服务
      {
        file: 'src/api/userService.js',
        code: [
          'import axios from \'axios\';',
          'import { config } from \'../config/environment\';',
          '',
          'class UserService {',
          '  constructor() {',
          '    this.baseURL = config.API_BASE_URL;',
          '    this.client = axios.create({',
          '      baseURL: this.baseURL,',
          '      timeout: 10000,',
          '      headers: {',
          '        \'Content-Type\': \'application/json\',',
          '      }',
          '    });',
          '',
          '    // Request interceptor',
          '    this.client.interceptors.request.use(',
          '      (config) => {',
          '        const token = localStorage.getItem(\'authToken\');',
          '        if (token) {',
          '          config.headers.Authorization = `Bearer ${token}`;',
          '        }',
          '        return config;',
          '      },',
          '      (error) => Promise.reject(error)',
          '    );',
          '',
          '    // Response interceptor',
          '    this.client.interceptors.response.use(',
          '      (response) => response.data,',
          '      (error) => {',
          '        if (error.response?.status === 401) {',
          '          localStorage.removeItem(\'authToken\');',
          '          window.location.href = \'/login\';',
          '        }',
          '        return Promise.reject(error);',
          '      }',
          '    );',
          '  }',
          '',
          '  async getUsers(page = 1, limit = 10) {',
          '    const response = await this.client.get(\'/users\', {',
          '      params: { page, limit }',
          '    });',
          '    return response;',
          '  }',
          '',
          '  async getUserById(id) {',
          '    return await this.client.get(`/users/${id}`);',
          '  }',
          '',
          '  async updateUser(id, userData) {',
          '    return await this.client.put(`/users/${id}`, userData);',
          '  }',
          '}',
          '',
          'export default new UserService();'
        ]
      }
    ];
    
    this.currentTemplate = this.codeTemplates[0];
    this.setupCode();
  }

  setupCode() {
    this.codeLines = [...this.currentTemplate.code];
    this.currentLine = 0;
    this.cursorCol = 0;
    this.currentFile = this.currentTemplate.file;
  }

  async start() {
    const { chalk } = await loadUIModules();
    
    this.running = true;
    console.clear();
    
    console.log(chalk.blue.bold('💻 代码编写模拟器'));
    console.log(chalk.dim('按 Ctrl+C 退出\n'));
    
    this.setupKeyListener();
    
    // 显示文件名
    console.log(chalk.cyan(`📁 ${this.currentFile}`));
    console.log('─'.repeat(80));
    
    // 开始"写代码"
    await this.simulateCoding();
    
    return new Promise((resolve) => {
      this.onExit = resolve;
    });
  }

  async simulateCoding() {
    const { chalk } = await loadUIModules();
    
    for (let lineIndex = 0; lineIndex < this.codeLines.length && this.running; lineIndex++) {
      const line = this.codeLines[lineIndex];
      
      // 模拟思考时间
      if (line.trim() === '') {
        console.log('');
        await this.sleep(200);
        continue;
      }
      
      // 如果是注释或重要行，停顿久一点
      if (line.includes('//') || line.includes('useState') || line.includes('useEffect')) {
        await this.sleep(this.speed * 2);
      } else {
        await this.sleep(this.speed * 0.3);
      }
      
      // 逐字符"输入"
      let currentLine = '';
      for (let i = 0; i < line.length && this.running; i++) {
        currentLine += line[i];
        
        // 清除当前行并重新输出
        process.stdout.write(`\r${' '.repeat(100)}\r`);
        
        // 直接输出，不做语法高亮避免ANSI问题
        process.stdout.write(`${String(lineIndex + 1).padStart(3)} │ ${currentLine}`);
        
        // 打字速度变化
        const typingSpeed = 50 + Math.random() * 100;
        await this.sleep(typingSpeed);
        
        // 偶尔停顿（思考）
        if (Math.random() < 0.1) {
          await this.sleep(300 + Math.random() * 500);
        }
      }
      
      console.log(); // 换行
      
      // 偶尔删除重写（修改代码）
      if (Math.random() < 0.15) {
        await this.sleep(500);
        process.stdout.write('\r' + ' '.repeat(100) + '\r');
        process.stdout.write(`${String(lineIndex + 1).padStart(3)} │ `);
        await this.sleep(200);
        
        // 重新输出修改后的行
        process.stdout.write(line);
        console.log();
      }
    }
    
    if (this.running) {
      console.log(chalk.green('\n✅ 文件保存完成'));
      await this.sleep(2000);
      
      // 切换到下一个文件
      const nextTemplate = this.codeTemplates[Math.floor(Math.random() * this.codeTemplates.length)];
      this.currentTemplate = nextTemplate;
      this.setupCode();
      
      console.clear();
      console.log(chalk.blue.bold('💻 代码编写模拟器'));
      console.log(chalk.dim('按 Ctrl+C 退出\n'));
      console.log(chalk.cyan(`📁 ${this.currentFile}`));
      console.log('─'.repeat(80));
      
      await this.simulateCoding();
    }
  }

  highlightSyntax(code, chalk) {
    // 检查是否应用颜色，如果chalk回退模式则不处理
    if (!chalk.level || chalk.level === 0) {
      return code; // 无颜色支持时直接返回原文
    }
    
    try {
      let result = code;
      
      // 关键字高亮（蓝色）
      result = result.replace(/\b(import|export|const|let|var|function|class|if|else|for|while|return|async|await)\b/g, 
        (match) => chalk.blue(match));
      
      // React相关（品红色）
      result = result.replace(/\b(useState|useEffect|React)\b/g, 
        (match) => chalk.magenta(match));
      
      // 字符串（绿色）
      result = result.replace(/(['"])([^'"]*)\1/g, 
        (match) => chalk.green(match));
      
      // 数字（黄色）
      result = result.replace(/\b\d+\b/g, 
        (match) => chalk.yellow(match));
      
      // 注释（灰色）
      result = result.replace(/(\/\/.*$)/gm, 
        (match) => chalk.gray(match));
      
      return result;
    } catch (error) {
      // 如果着色出错，返回原始代码
      return code;
    }
  }

  setupKeyListener() {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key[0] === 3 || key[0] === 27 || key.toString() === 'q') {
        this.stop();
      }
    });
  }

  stop() {
    this.running = false;
    
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    
    console.log('\n💻 代码编写模拟器已退出');
    
    if (this.onExit) {
      this.onExit();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 服务器日志监控屏保
class LogMonitorScreensaver {
  constructor(speed = 800) {
    this.speed = speed;
    this.running = false;
    this.logBuffer = [];
    // 动态计算可用行数，减去标题和状态行
    this.maxLines = Math.max(10, (process.stdout.rows || 25) - 5);
    
    this.services = ['nginx', 'mysql', 'redis', 'api-server', 'worker', 'scheduler'];
    this.logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE'];
    this.ips = ['192.168.1.100', '192.168.1.101', '10.0.0.15', '172.16.0.50'];
    
    this.logTemplates = [
      // 正常请求
      {
        level: 'INFO',
        template: '[{service}] {ip} - - [{timestamp}] "GET {path} HTTP/1.1" {status} {size} "{referer}" "{agent}"',
        paths: ['/api/users', '/api/orders', '/api/products', '/health', '/metrics', '/api/auth/login'],
        statuses: [200, 201, 304],
        weight: 70
      },
      // 错误日志
      {
        level: 'ERROR',
        template: '[{service}] Database connection failed: {error}',
        errors: ['Connection timeout', 'Authentication failed', 'Too many connections', 'Host unreachable'],
        weight: 5
      },
      // 警告
      {
        level: 'WARN',
        template: '[{service}] High memory usage detected: {percentage}% of {total}GB',
        weight: 10
      },
      // 系统监控
      {
        level: 'INFO',
        template: '[{service}] System stats - CPU: {cpu}%, Memory: {mem}%, Disk: {disk}%',
        weight: 15
      }
    ];
  }

  async start() {
    const { chalk } = await loadUIModules();
    
    this.running = true;
    console.clear();
    
    console.log(chalk.green.bold('📊 服务器日志监控中心'));
    console.log(chalk.dim('按 Ctrl+C 退出'));
    console.log('═'.repeat(100));
    console.log(chalk.cyan('实时日志流 | 服务状态: ') + chalk.green('● 运行中'));
    console.log('─'.repeat(100));
    
    this.setupKeyListener();
    
    // 开始日志流
    await this.simulateLogs();
    
    return new Promise((resolve) => {
      this.onExit = resolve;
    });
  }

  async simulateLogs() {
    const { chalk } = await loadUIModules();
    
    // 先填充初始日志，让屏幕看起来已经在运行了
    console.log(chalk.gray('加载历史日志...'));
    await this.sleep(1000);
    
    // 生成一些历史日志填满屏幕
    for (let i = 0; i < this.maxLines - 2; i++) {
      const logEntry = this.generateHistoryLogEntry(i);
      const coloredLog = this.colorizeLog(logEntry, chalk);
      this.logBuffer.push(coloredLog);
    }
    
    // 首次渲染
    this.renderLogs();
    
    while (this.running) {
      const logEntry = this.generateLogEntry();
      const coloredLog = this.colorizeLog(logEntry, chalk);
      
      // 添加到缓冲区（现在开始滚动）
      this.logBuffer.push(coloredLog);
      if (this.logBuffer.length > this.maxLines) {
        this.logBuffer.shift();
      }
      
      // 重新渲染屏幕
      this.renderLogs();
      
      // 调整速度（错误日志慢一点，正常日志快一点）
      const delay = logEntry.level === 'ERROR' ? this.speed * 2 : this.speed;
      await this.sleep(delay + Math.random() * 200);
    }
  }

  generateHistoryLogEntry(index) {
    const template = this.selectTemplate();
    // 生成历史时间戳，从30分钟前到现在，按索引递增
    const minutesAgo = 30 - Math.floor(index / this.maxLines * 30);
    const historyTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    const timestamp = historyTime.toISOString().replace('T', ' ').substring(0, 19);
    const service = this.services[Math.floor(Math.random() * this.services.length)];
    const ip = this.ips[Math.floor(Math.random() * this.ips.length)];
    
    let message = template.template;
    
    // 替换通用变量
    message = message.replace('{timestamp}', timestamp);
    message = message.replace('{service}', service);
    message = message.replace('{ip}', ip);
    
    // 根据模板类型替换特定变量
    if (template.paths) {
      const path = template.paths[Math.floor(Math.random() * template.paths.length)];
      const status = template.statuses[Math.floor(Math.random() * template.statuses.length)];
      const size = Math.floor(Math.random() * 50000) + 1000;
      message = message.replace('{path}', path);
      message = message.replace('{status}', status);
      message = message.replace('{size}', size);
      message = message.replace('{referer}', 'https://app.company.com/dashboard');
      message = message.replace('{agent}', 'Mozilla/5.0 (compatible; monitoring)');
    }
    
    if (template.errors) {
      const error = template.errors[Math.floor(Math.random() * template.errors.length)];
      message = message.replace('{error}', error);
    }
    
    if (template.template.includes('{percentage}')) {
      message = message.replace('{percentage}', Math.floor(Math.random() * 40) + 60);
      message = message.replace('{total}', Math.floor(Math.random() * 16) + 8);
    }
    
    if (template.template.includes('{cpu}')) {
      message = message.replace('{cpu}', Math.floor(Math.random() * 30) + 20);
      message = message.replace('{mem}', Math.floor(Math.random() * 40) + 30);
      message = message.replace('{disk}', Math.floor(Math.random() * 20) + 15);
    }
    
    return {
      level: template.level,
      message: message,
      timestamp: timestamp
    };
  }

  generateLogEntry() {
    const template = this.selectTemplate();
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const service = this.services[Math.floor(Math.random() * this.services.length)];
    const ip = this.ips[Math.floor(Math.random() * this.ips.length)];
    
    let message = template.template;
    
    // 替换通用变量
    message = message.replace('{timestamp}', timestamp);
    message = message.replace('{service}', service);
    message = message.replace('{ip}', ip);
    
    // 根据模板类型替换特定变量
    if (template.paths) {
      const path = template.paths[Math.floor(Math.random() * template.paths.length)];
      const status = template.statuses[Math.floor(Math.random() * template.statuses.length)];
      const size = Math.floor(Math.random() * 50000) + 1000;
      message = message.replace('{path}', path);
      message = message.replace('{status}', status);
      message = message.replace('{size}', size);
      message = message.replace('{referer}', 'https://app.company.com/dashboard');
      message = message.replace('{agent}', 'Mozilla/5.0 (compatible; monitoring)');
    }
    
    if (template.errors) {
      const error = template.errors[Math.floor(Math.random() * template.errors.length)];
      message = message.replace('{error}', error);
    }
    
    if (template.template.includes('{percentage}')) {
      message = message.replace('{percentage}', Math.floor(Math.random() * 40) + 60);
      message = message.replace('{total}', Math.floor(Math.random() * 16) + 8);
    }
    
    if (template.template.includes('{cpu}')) {
      message = message.replace('{cpu}', Math.floor(Math.random() * 30) + 20);
      message = message.replace('{mem}', Math.floor(Math.random() * 40) + 30);
      message = message.replace('{disk}', Math.floor(Math.random() * 20) + 15);
    }
    
    return {
      level: template.level,
      message: message,
      timestamp: timestamp
    };
  }

  selectTemplate() {
    const totalWeight = this.logTemplates.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const template of this.logTemplates) {
      random -= template.weight;
      if (random <= 0) {
        return template;
      }
    }
    
    return this.logTemplates[0];
  }

  colorizeLog(logEntry, chalk) {
    const { level, message, timestamp } = logEntry;
    let colorizedMessage = message;
    
    // 根据日志级别着色
    switch (level) {
      case 'ERROR':
        colorizedMessage = chalk.red(colorizedMessage);
        break;
      case 'WARN':
        colorizedMessage = chalk.yellow(colorizedMessage);
        break;
      case 'INFO':
        colorizedMessage = chalk.white(colorizedMessage);
        break;
      case 'DEBUG':
        colorizedMessage = chalk.gray(colorizedMessage);
        break;
    }
    
    // 高亮关键信息
    colorizedMessage = colorizedMessage
      .replace(/(\d{3})\s/g, (match, code) => {
        if (code.startsWith('2')) return chalk.green(match);
        if (code.startsWith('4')) return chalk.yellow(match);
        if (code.startsWith('5')) return chalk.red(match);
        return match;
      })
      .replace(/(\d+\.\d+\.\d+\.\d+)/g, chalk.cyan('$1'))
      .replace(/([A-Z]{4,})/g, chalk.bold('$1'));
    
    return `${chalk.gray(timestamp)} ${chalk.white.bold(level.padEnd(5))} ${colorizedMessage}`;
  }

  renderLogs() {
    // 回到顶部并清除日志区域
    process.stdout.write('\x1B[5;1H'); // 移到第5行第1列
    
    for (let i = 0; i < this.maxLines; i++) {
      process.stdout.write('\x1B[K'); // 清除当前行
      if (this.logBuffer[i]) {
        process.stdout.write(this.logBuffer[i]);
      }
      if (i < this.maxLines - 1) process.stdout.write('\n');
    }
  }

  setupKeyListener() {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key[0] === 3 || key[0] === 27 || key.toString() === 'q') {
        this.stop();
      }
    });
  }

  stop() {
    this.running = false;
    
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    
    console.log('\n📊 日志监控已退出');
    
    if (this.onExit) {
      this.onExit();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 数据分析处理屏保
class DataAnalysisScreensaver {
  constructor(speed = 1200) {
    this.speed = speed;
    this.running = false;
    this.currentDataset = 'user_behavior_2024.csv';
    this.progress = 0;
    this.totalSteps = 0;
    this.currentStep = '';
    
    this.datasets = [
      'user_behavior_2024.csv', 'sales_data_q4.xlsx', 'customer_segments.json',
      'web_analytics_dec.csv', 'product_performance.csv', 'market_trends.xlsx',
      'financial_metrics.csv', 'survey_responses.csv', 'transaction_logs.csv'
    ];
    
    this.analysisSteps = [
      { name: '数据加载与预处理', weight: 15 },
      { name: '缺失值检测与处理', weight: 12 },
      { name: '异常值识别与清洗', weight: 18 },
      { name: '特征工程与转换', weight: 20 },
      { name: '探索性数据分析', weight: 25 },
      { name: '相关性分析', weight: 10 },
      { name: '统计建模', weight: 30 },
      { name: '模型验证与评估', weight: 15 },
      { name: '结果可视化', weight: 8 },
      { name: '报告生成', weight: 5 }
    ];
    
    this.messages = [
      'Loading dataset: {dataset} ({size} MB)',
      'Scanning {rows} rows, {cols} columns',
      'Detecting missing values... {missing}% found',
      'Applying StandardScaler transformation',
      'Computing correlation matrix... {progress}%',
      'Running principal component analysis',
      'Training Random Forest model... accuracy: {acc}%',
      'Cross-validation score: {score}',
      'Generating feature importance plot',
      'Exporting analysis results to CSV'
    ];
    
    this.libraries = ['pandas', 'numpy', 'scikit-learn', 'matplotlib', 'seaborn', 'scipy'];
  }

  async start() {
    const { chalk } = await loadUIModules();
    
    this.running = true;
    console.clear();
    
    console.log(chalk.magenta.bold('🔬 数据科学分析平台'));
    console.log(chalk.dim('按 Ctrl+C 退出'));
    console.log('═'.repeat(90));
    console.log(chalk.cyan('Python 3.9.7 | Jupyter Lab | Anaconda Environment'));
    console.log('─'.repeat(90));
    
    this.setupKeyListener();
    
    // 开始分析过程
    await this.simulateAnalysis();
    
    return new Promise((resolve) => {
      this.onExit = resolve;
    });
  }

  async simulateAnalysis() {
    const { chalk } = await loadUIModules();
    
    while (this.running) {
      // 选择数据集
      this.currentDataset = this.datasets[Math.floor(Math.random() * this.datasets.length)];
      this.totalSteps = this.analysisSteps.length;
      this.progress = 0;
      
      console.log(chalk.yellow(`\n📊 开始新的数据分析任务: ${this.currentDataset}`));
      console.log(chalk.gray(`数据集大小: ${Math.floor(Math.random() * 500 + 50)}MB, ${Math.floor(Math.random() * 900000 + 100000)}行数据`));
      console.log('');
      
      for (let i = 0; i < this.analysisSteps.length && this.running; i++) {
        const step = this.analysisSteps[i];
        this.currentStep = step.name;
        this.progress = i + 1;
        
        // 显示当前步骤
        console.log(chalk.blue(`[${i + 1}/${this.totalSteps}] ${step.name}...`));
        
        // 模拟处理过程
        await this.simulateProcessingStep(step, chalk);
        
        // 等待时间基于步骤复杂度
        const waitTime = this.speed * (step.weight / 20);
        await this.sleep(waitTime + Math.random() * 800);
      }
      
      // 分析完成
      console.log(chalk.green.bold('\n✅ 数据分析完成！'));
      console.log(chalk.cyan('📈 生成报告: analysis_report_' + new Date().toISOString().slice(0,10) + '.html'));
      console.log(chalk.cyan('💾 模型保存: model_' + Math.floor(Math.random() * 1000) + '.pkl'));
      
      await this.sleep(3000);
      
      if (this.running) {
        console.log(chalk.yellow('\n🔄 准备下一个数据分析任务...\n'));
        await this.sleep(2000);
      }
    }
  }

  async simulateProcessingStep(step, chalk) {
    const stepMessages = this.getStepMessages(step.name);
    
    for (let j = 0; j < stepMessages.length && this.running; j++) {
      let message = stepMessages[j];
      
      // 替换占位符
      message = message.replace('{dataset}', this.currentDataset);
      message = message.replace('{size}', Math.floor(Math.random() * 200 + 50));
      message = message.replace('{rows}', (Math.floor(Math.random() * 900000 + 100000)).toLocaleString());
      message = message.replace('{cols}', Math.floor(Math.random() * 50 + 10));
      message = message.replace('{missing}', (Math.random() * 15).toFixed(1));
      message = message.replace('{progress}', Math.floor(Math.random() * 100));
      message = message.replace('{acc}', (85 + Math.random() * 12).toFixed(1));
      message = message.replace('{score}', (0.8 + Math.random() * 0.15).toFixed(3));
      
      console.log(chalk.gray(`  → ${message}`));
      
      // 随机显示Python代码片段
      if (Math.random() < 0.3) {
        const code = this.generateCodeSnippet(step.name);
        console.log(chalk.dim(`    ${code}`));
      }
      
      // 模拟进度条
      if (j === stepMessages.length - 1 && step.weight > 15) {
        await this.showProgressBar(step.name, chalk);
      }
      
      await this.sleep(300 + Math.random() * 500);
    }
  }

  getStepMessages(stepName) {
    const messageMap = {
      '数据加载与预处理': [
        'Loading {dataset}...',
        'Dataset loaded: {rows} rows, {cols} columns',
        'Memory usage: {size}MB'
      ],
      '缺失值检测与处理': [
        'Scanning for missing values...',
        'Found {missing}% missing data',
        'Applying forward fill strategy'
      ],
      '异常值识别与清洗': [
        'Computing Z-scores for outlier detection',
        'Identified 127 potential outliers',
        'Applying IQR-based filtering'
      ],
      '特征工程与转换': [
        'Creating polynomial features',
        'Applying StandardScaler normalization',
        'Encoding categorical variables'
      ],
      '探索性数据分析': [
        'Generating distribution plots',
        'Computing summary statistics',
        'Analyzing feature correlations'
      ],
      '相关性分析': [
        'Computing Pearson correlation matrix',
        'Identifying significant relationships',
        'Correlation matrix: {progress}% complete'
      ],
      '统计建模': [
        'Splitting data: 80% train, 20% test',
        'Training Random Forest classifier',
        'Model accuracy: {acc}%'
      ],
      '模型验证与评估': [
        'Running 5-fold cross-validation',
        'Cross-validation score: {score}',
        'Computing confusion matrix'
      ],
      '结果可视化': [
        'Generating matplotlib figures',
        'Creating interactive plots with plotly',
        'Exporting visualizations'
      ],
      '报告生成': [
        'Compiling analysis report',
        'Generating executive summary',
        'Saving results to HTML format'
      ]
    };
    
    return messageMap[stepName] || ['Processing ' + stepName + '...'];
  }

  generateCodeSnippet(stepName) {
    const codeMap = {
      '数据加载与预处理': [
        'df = pd.read_csv("user_behavior_2024.csv")',
        'df.info()',
        'df.head()'
      ],
      '缺失值检测与处理': [
        'missing_pct = df.isnull().sum() / len(df) * 100',
        'df.fillna(method="ffill", inplace=True)',
        'df.dropna(thresh=0.7, inplace=True)'
      ],
      '特征工程与转换': [
        'from sklearn.preprocessing import StandardScaler',
        'scaler = StandardScaler()',
        'X_scaled = scaler.fit_transform(X)'
      ],
      '统计建模': [
        'from sklearn.ensemble import RandomForestClassifier',
        'rf = RandomForestClassifier(n_estimators=100)',
        'rf.fit(X_train, y_train)'
      ]
    };
    
    const snippets = codeMap[stepName] || ['# Processing...'];
    return snippets[Math.floor(Math.random() * snippets.length)];
  }

  async showProgressBar(stepName, chalk) {
    const barLength = 40;
    
    for (let progress = 0; progress <= 100 && this.running; progress += Math.floor(Math.random() * 8) + 2) {
      const filled = Math.floor((progress / 100) * barLength);
      const empty = barLength - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      
      process.stdout.write(`\r  ${chalk.cyan('Processing:')} [${chalk.green(bar)}] ${progress}%`);
      
      await this.sleep(80 + Math.random() * 120);
    }
    
    process.stdout.write(`\r  ${chalk.cyan('Processing:')} [${chalk.green('█'.repeat(barLength))}] 100% ✓\n`);
  }

  setupKeyListener() {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key[0] === 3 || key[0] === 27 || key.toString() === 'q') {
        this.stop();
      }
    });
  }

  stop() {
    this.running = false;
    
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    
    console.log('\n🔬 数据分析已退出');
    
    if (this.onExit) {
      this.onExit();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 网络流量监控屏保
class NetworkMonitorScreensaver {
  constructor(speed = 600) {
    this.speed = speed;
    this.running = false;
    this.networkData = {
      interfaces: ['eth0', 'wlan0', 'vpn0'],
      totalPackets: 0,
      totalBytes: 0
    };
    
    this.protocols = ['HTTP', 'HTTPS', 'SSH', 'FTP', 'DNS', 'ICMP', 'TCP', 'UDP'];
    this.countries = ['US', 'CN', 'JP', 'DE', 'GB', 'KR', 'FR', 'CA', 'AU', 'BR'];
    this.threatTypes = ['Port Scan', 'DDoS', 'Brute Force', 'Malware', 'Phishing'];
  }

  async start() {
    const { chalk } = await loadUIModules();
    
    this.running = true;
    console.clear();
    
    console.log(chalk.cyan.bold('🌐 网络安全监控中心 - NetGuard Pro'));
    console.log(chalk.dim('按 Ctrl+C 退出'));
    console.log('═'.repeat(100));
    console.log(chalk.green('🟢 系统状态: 正常运行') + '  ' + 
               chalk.blue('🔵 防火墙: 启用') + '  ' + 
               chalk.yellow('🟡 入侵检测: 活跃'));
    console.log('─'.repeat(100));
    
    this.setupKeyListener();
    
    // 开始网络监控
    await this.simulateNetworkMonitoring();
    
    return new Promise((resolve) => {
      this.onExit = resolve;
    });
  }

  async simulateNetworkMonitoring() {
    const { chalk } = await loadUIModules();
    
    let displayBuffer = [];
    // 动态计算可用行数，减去标题、状态行和汇总信息
    const maxLines = Math.max(10, (process.stdout.rows || 30) - 8);
    let cycleCount = 0;
    
    // 先填充历史网络事件，让屏幕看起来已经在监控中
    console.log(chalk.gray('正在连接网络监控系统...'));
    await this.sleep(800);
    console.log(chalk.gray('加载近期网络活动记录...'));
    await this.sleep(1200);
    
    // 生成历史事件填满屏幕
    for (let i = 0; i < maxLines - 1; i++) {
      const eventType = this.selectEventType();
      const event = this.generateNetworkEvent(eventType);
      const colorizedEvent = this.colorizeNetworkEvent(event, chalk);
      displayBuffer.push(colorizedEvent);
      this.updateStats(event);
    }
    
    // 首次渲染完整界面
    this.renderNetworkInterface(displayBuffer, chalk, maxLines);
    await this.showNetworkSummary(chalk);
    
    while (this.running) {
      const eventType = this.selectEventType();
      const event = this.generateNetworkEvent(eventType);
      const colorizedEvent = this.colorizeNetworkEvent(event, chalk);
      
      // 添加到显示缓冲区（现在开始滚动）
      displayBuffer.push(colorizedEvent);
      if (displayBuffer.length > maxLines) {
        displayBuffer.shift();
      }
      
      // 更新统计信息
      this.updateStats(event);
      
      // 重新渲染界面
      this.renderNetworkInterface(displayBuffer, chalk, maxLines);
      
      // 每30个事件显示一次汇总
      cycleCount++;
      if (cycleCount % 30 === 0) {
        await this.showNetworkSummary(chalk);
      }
      
      // 调整速度
      const delay = event.severity === 'HIGH' ? this.speed * 2 : this.speed;
      await this.sleep(delay + Math.random() * 300);
    }
  }

  selectEventType() {
    const events = [
      { type: 'connection', weight: 60 },
      { type: 'bandwidth', weight: 20 },
      { type: 'threat', weight: 8 },
      { type: 'system', weight: 12 }
    ];
    
    const totalWeight = events.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const event of events) {
      random -= event.weight;
      if (random <= 0) {
        return event.type;
      }
    }
    
    return 'connection';
  }

  generateNetworkEvent(type) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const sourceIP = this.generateRandomIP();
    const destIP = this.generateRandomIP();
    const port = Math.floor(Math.random() * 65535) + 1;
    const protocol = this.protocols[Math.floor(Math.random() * this.protocols.length)];
    
    switch (type) {
      case 'connection':
        return {
          timestamp,
          type: 'CONNECTION',
          severity: 'INFO',
          source: sourceIP,
          destination: destIP,
          port,
          protocol,
          message: `${protocol} connection established ${sourceIP}:${port} -> ${destIP}`,
          bytes: Math.floor(Math.random() * 50000) + 1000
        };
        
      case 'bandwidth':
        const interfaceName = this.networkData.interfaces[Math.floor(Math.random() * this.networkData.interfaces.length)];
        const usage = Math.floor(Math.random() * 100);
        return {
          timestamp,
          type: 'BANDWIDTH',
          severity: usage > 80 ? 'WARN' : 'INFO',
          interface: interfaceName,
          message: `${interfaceName} utilization: ${usage}%, ${(Math.random() * 100).toFixed(1)}Mbps`,
          usage
        };
        
      case 'threat':
        const threat = this.threatTypes[Math.floor(Math.random() * this.threatTypes.length)];
        const country = this.countries[Math.floor(Math.random() * this.countries.length)];
        return {
          timestamp,
          type: 'THREAT',
          severity: 'HIGH',
          source: sourceIP,
          threat,
          country,
          message: `🚨 ${threat} detected from ${sourceIP} (${country}) - BLOCKED`,
          blocked: true
        };
        
      case 'system':
        return {
          timestamp,
          type: 'SYSTEM',
          severity: 'INFO',
          message: `Firewall rules updated: ${Math.floor(Math.random() * 1000) + 5000} active rules`,
          rules: Math.floor(Math.random() * 1000) + 5000
        };
    }
  }

  generateRandomIP() {
    // 生成随机IP，但倾向于常见网段
    const commonRanges = [
      '192.168.', '10.0.', '172.16.', '203.', '120.', '8.8.', '1.1.'
    ];
    
    if (Math.random() < 0.7) {
      const range = commonRanges[Math.floor(Math.random() * commonRanges.length)];
      return range + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255);
    } else {
      return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }
  }

  colorizeNetworkEvent(event, chalk) {
    const { timestamp, type, severity, message } = event;
    
    let severityColor = chalk.white;
    switch (severity) {
      case 'HIGH':
        severityColor = chalk.red.bold;
        break;
      case 'WARN':
        severityColor = chalk.yellow;
        break;
      case 'INFO':
        severityColor = chalk.white;
        break;
    }
    
    let typeColor = chalk.cyan;
    switch (type) {
      case 'THREAT':
        typeColor = chalk.red;
        break;
      case 'BANDWIDTH':
        typeColor = chalk.blue;
        break;
      case 'SYSTEM':
        typeColor = chalk.green;
        break;
    }
    
    let colorizedMessage = message
      .replace(/(\d+\.\d+\.\d+\.\d+)/g, chalk.cyan('$1'))
      .replace(/(\d+Mbps|\d+%)/g, chalk.yellow('$1'))
      .replace(/(BLOCKED|🚨)/g, chalk.red.bold('$1'));
    
    return `${chalk.gray(timestamp)} ${typeColor(type.padEnd(10))} ${severityColor(severity.padEnd(4))} ${colorizedMessage}`;
  }

  updateStats(event) {
    this.networkData.totalPackets++;
    if (event.bytes) {
      this.networkData.totalBytes += event.bytes;
    }
  }

  renderNetworkInterface(displayBuffer, chalk, maxLines = null) {
    // 移到监控区域开始位置
    process.stdout.write('\x1B[7;1H');
    
    // 使用动态行数或默认值
    const linesToRender = maxLines || Math.max(10, (process.stdout.rows || 30) - 8);
    
    // 清除并显示所有事件
    for (let i = 0; i < linesToRender; i++) {
      process.stdout.write('\x1B[K');
      if (displayBuffer[i]) {
        process.stdout.write(displayBuffer[i]);
      }
      if (i < linesToRender - 1) process.stdout.write('\n');
    }
  }

  async showNetworkSummary(chalk) {
    const throughput = (this.networkData.totalBytes / 1024 / 1024).toFixed(2);
    const pps = Math.floor(this.networkData.totalPackets / 30);
    
    // 移到状态栏位置
    process.stdout.write('\x1B[4;1H');
    process.stdout.write('\x1B[K');
    
    const statusLine = 
      chalk.green('🟢 状态: 正常') + '  ' +
      chalk.blue(`📊 吞吐量: ${throughput}MB`) + '  ' +
      chalk.yellow(`📈 数据包: ${this.networkData.totalPackets.toLocaleString()}`) + '  ' +
      chalk.cyan(`⚡ PPS: ${pps}`);
    
    process.stdout.write(statusLine);
  }

  setupKeyListener() {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key[0] === 3 || key[0] === 27 || key.toString() === 'q') {
        this.stop();
      }
    });
  }

  stop() {
    this.running = false;
    
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    
    console.log('\n🌐 网络监控已退出');
    
    if (this.onExit) {
      this.onExit();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 主屏保功能
async function startScreensaver(options) {
  const { chalk } = await loadUIModules();
  
  let screensaver;
  
  if (options.type === 'compiler') {
    console.log(chalk.cyan('🔧 启动C++编译模拟屏保...'));
    screensaver = new CompilerScreensaver(parseInt(options.speed) || 1500);
  } else if (options.type === 'coding') {
    console.log(chalk.blue('💻 启动代码编写模拟屏保...'));
    screensaver = new CodingScreensaver(parseInt(options.speed) || 1000);
  } else if (options.type === 'logs') {
    console.log(chalk.green('📊 启动服务器日志监控屏保...'));
    screensaver = new LogMonitorScreensaver(parseInt(options.speed) || 800);
  } else if (options.type === 'analysis') {
    console.log(chalk.magenta('🔬 启动数据分析屏保...'));
    screensaver = new DataAnalysisScreensaver(parseInt(options.speed) || 1200);
  } else if (options.type === 'network') {
    console.log(chalk.cyan('🌐 启动网络监控屏保...'));
    screensaver = new NetworkMonitorScreensaver(parseInt(options.speed) || 600);
  } else if (options.wizard) {
    // 交互式选择
    screensaver = await selectScreensaverType(options);
  } else {
    // 默认显示帮助
    console.log(chalk.yellow.bold('🖥️  屏保工具 - 完美伪装工作状态'));
    console.log(chalk.cyan('\n可用的屏保类型:'));
    console.log(chalk.magenta('  coding     - 实时代码编写模拟 (🔥最佳伪装效果)'));
    console.log(chalk.cyan('  logs       - 服务器日志监控 (运维必备)'));
    console.log(chalk.blue('  compiler   - C++编译过程模拟 (程序员专用)'));
    console.log(chalk.yellow('  analysis   - 数据分析处理 (数据科学家)'));
    console.log(chalk.white('  network    - 网络流量监控 (网络工程师)'));
    console.log(chalk.gray('\n使用示例:'));
    console.log(chalk.white('  ats screensaver --type coding    # 🔥 最推荐，逐行写代码'));
    console.log(chalk.white('  ats screensaver --type analysis  # 🔬 数据科学分析'));
    console.log(chalk.white('  ats screensaver --type network   # 🌐 网络安全监控'));
    console.log(chalk.white('  ats screensaver --wizard         # 交互式选择'));
    return;
  }
  
  try {
    await screensaver.start(options);
  } catch (error) {
    console.error(chalk.red('❌ 屏保运行出错:'), error.message);
  }
}

async function selectScreensaverType(options = {}) {
  const { chalk } = await loadUIModules();
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log(chalk.yellow.bold('🖥️  请选择最适合你的"工作"屏保:'));
    console.log(chalk.magenta('1. 实时代码编写 (coding)     - 🔥 最佳伪装，逐行写代码'));
    console.log(chalk.cyan('2. 服务器日志监控 (logs)      - 📊 运维风格，实时日志流'));
    console.log(chalk.blue('3. C++编译模拟 (compiler)     - 🔧 编译输出，程序员专用'));
    console.log(chalk.yellow('4. 数据分析处理 (analysis)    - 🔬 Python数据科学'));
    console.log(chalk.white('5. 网络流量监控 (network)     - 🌐 网络安全监控'));
    
    readline.question(chalk.cyan('\n请输入选项 (1-5): '), (answer) => {
      readline.close();
      
      const speed = parseInt(options.speed);
      
      switch (answer) {
        case '1':
        case 'coding':
          resolve(new CodingScreensaver(speed || 1000));
          break;
        case '2':
        case 'logs':
          resolve(new LogMonitorScreensaver(speed || 800));
          break;
        case '3':
        case 'compiler':
          resolve(new CompilerScreensaver(speed || 1500));
          break;
        case '4':
        case 'analysis':
          resolve(new DataAnalysisScreensaver(speed || 1200));
          break;
        case '5':
        case 'network':
          resolve(new NetworkMonitorScreensaver(speed || 600));
          break;
        default:
          console.log(chalk.yellow('💡 使用推荐选项：代码编写模拟'));
          resolve(new CodingScreensaver(speed || 1000));
      }
    });
  });
}

module.exports = {
  startScreensaver,
  CompilerScreensaver,
  CodingScreensaver,
  LogMonitorScreensaver,
  DataAnalysisScreensaver,
  NetworkMonitorScreensaver
};