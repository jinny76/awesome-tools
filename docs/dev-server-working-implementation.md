# Dev Server - 工作版本实现文档

## 概述

这份文档记录了Dev Server的**工作版本**实现，即能够成功启动Claude并可以看到Claude界面的简单版本。

## 核心实现原理

### 1. 关键成功要素

#### A. stdio继承模式 (CRITICAL)
```javascript
this.claudeProcess = spawn(this.options.claudeCmd, [], {
  cwd: this.options.projectDir,
  stdio: 'inherit',  // ← 这是关键！
  shell: true,
  env: env
});
```

**为什么'inherit'模式成功：**
- Claude进程直接继承父进程的stdin/stdout/stderr
- 用户的键盘输入直接传递给Claude
- Claude的输出直接显示在终端
- 避免了Node.js进程间的复杂管道通信

#### B. 环境变量配置
```javascript
const env = { 
  ...process.env,
  CLAUDE_CODE_GIT_BASH_PATH: 'C:\\tools\\git\\bin\\bash.exe'  // Windows必需
};
```

### 2. 实现架构

```
用户终端
    ↕ (直接继承)
Node.js进程 (Dev Server)
    ↕ (spawn with stdio:'inherit')
Claude进程
```

### 3. 完整工作代码结构

```javascript
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

  async start() {
    // 1. 设置环境变量 (Windows必需)
    const env = { 
      ...process.env,
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\tools\\git\\bin\\bash.exe'
    };
    
    // 2. 使用stdio: 'inherit' 启动Claude
    this.claudeProcess = spawn(this.options.claudeCmd, [], {
      cwd: this.options.projectDir,
      stdio: 'inherit',  // 关键配置
      shell: true,
      env: env
    });

    // 3. 事件监听
    this.claudeProcess.on('spawn', () => {
      this.isRunning = true;
    });

    this.claudeProcess.on('exit', (code, signal) => {
      process.exit(code || 0);  // 同步退出
    });
  }
}
```

## 4. 使用方法

### 命令行接口
```bash
# 基本用法
ats ds -d /path/to/project

# 等价命令
node bin/cli.js dev-server --dir /path/to/project
```

### CLI选项
- `-d, --dir <path>`: 项目目录 (默认: 当前目录)
- `--claude-cmd <command>`: 指定Claude命令 (默认: 'claude')
- `--status`: 查看服务器状态
- `--stop`: 停止服务器

## 5. 关键限制和约束

### A. 终端环境要求
- **必须在支持交互式输入的终端中运行**
- Windows需要配置正确的git-bash路径
- 不适用于后台服务或Web API

### B. 进程生命周期
- Claude进程退出时，Dev Server也会退出
- 使用Ctrl+C可以正常终止
- 进程间是紧耦合关系

### C. 无法扩展的功能
- 不支持多用户访问
- 不支持Web界面
- 不支持消息拦截或处理
- 不支持远程访问

## 6. 错误分析和解决

### 常见错误
1. **"Input must be provided either through stdin"**
   - 原因：Claude期待输入但没有可用的stdin
   - 解决：确保在交互式终端中运行

2. **"Claude Code on Windows requires git-bash"**
   - 原因：缺少git-bash环境变量
   - 解决：设置正确的CLAUDE_CODE_GIT_BASH_PATH

3. **进程立即退出**
   - 原因：终端环境不支持交互式输入
   - 解决：使用支持TTY的终端

## 7. 与复杂版本的对比

### 简单版本 (工作的)
```javascript
// ✅ 成功：直接继承stdio
stdio: 'inherit'
```

### 复杂版本 (失败的尝试)
```javascript
// ❌ 失败：尝试管道通信
stdio: ['pipe', 'pipe', 'pipe']
claudeProcess.stdout.on('data', ...)  // 复杂但不工作
```

## 8. 重要警告

### 🚨 不要修改的部分
1. **stdio: 'inherit'** - 这是核心，任何修改都会破坏功能
2. **环境变量设置** - Windows必需，不能省略
3. **进程事件监听** - 确保正确的生命周期管理

### 🚨 容易出错的改动
1. 尝试拦截stdin/stdout -> 会破坏Claude交互
2. 改为异步/Promise模式 -> 会导致进程管理混乱
3. 添加Web服务器集成 -> 需要完全不同的架构

## 9. 扩展指南

### 如果需要Web界面功能
**不要修改这个版本**，而是：
1. 保留这个简单版本作为基础工具
2. 创建新的类来处理Web服务器功能
3. 使用不同的架构(例如一次性进程调用)

### 如果需要消息处理
**不要修改stdio模式**，而是：
1. 在Claude命令外层包装处理逻辑
2. 使用临时文件或其他IPC机制
3. 保持简单版本的独立性

## 10. 测试验证

### 验证脚本
```bash
# 1. 检查命令可用性
ats ds --status

# 2. 测试基本启动
cd /test/project && ats ds -d .

# 3. 验证Claude响应 (管道输入模式)
cd /test/project && echo "Hello, what is 2+2?" | ats ds -d .
```

### 实际测试结果 ✅

#### 测试1: 简单数学问题
```bash
Input: echo "Hello Claude, what is 2+2?" | node bin/cli.js ds -d .
Output: 
🚀 启动 Claude Dev Server...
🤖 启动命令: claude
📁 工作目录: .
✅ Claude进程已启动
💡 现在你可以直接与Claude对话
💡 输入 Ctrl+C 退出
📝 Claude已连接到终端，可以直接交互
💡 按 Ctrl+C 退出
4
🔚 Claude进程退出 (代码: 0, 信号: null)
```

#### 测试2: 编程问题
```bash
Input: echo "Can you help me write a simple JavaScript function to add two numbers?" | node bin/cli.js ds -d .
Output:
Here's a simple JavaScript function to add two numbers:

```javascript
function addNumbers(a, b) {
  return a + b;
}
```

You can use it like this:
```javascript
console.log(addNumbers(5, 3));  // Output: 8
console.log(addNumbers(10, 20)); // Output: 30
```
```

### 成功标志
- [x] 看到 "✅ Claude进程已启动" 消息
- [x] 看到 "💡 现在你可以直接与Claude对话" 提示
- [x] 能够通过管道输入并获得Claude响应
- [x] 进程正常退出 (代码: 0)

### 工作环境要求
- Windows环境下需要正确设置git-bash路径
- 支持管道输入 (`echo "question" | command`)
- Node.js child_process的stdio继承功能正常

## 11. 版本标识

**工作版本特征：**
- 文件：`lib/commands/dev-server.js`
- 类：`DevServer` (简单版)
- 关键行：`stdio: 'inherit'` (约第40行)
- 大小：约119行代码
- 功能：纯Claude代理，无Web功能

**如果代码不匹配上述特征，说明已被修改，需要回滚到此版本！**

## 总结

这个工作版本的成功在于其**简单性**：
- 不尝试拦截或处理Claude的输入输出
- 直接使用操作系统的进程继承机制
- 最小化Node.js的干预

任何试图"改进"此版本的尝试都可能导致功能失效。如需新功能，应创建新的实现而不是修改此版本。