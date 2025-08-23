/**
 * Dev Server - 完整的多服务器Claude远程开发系统
 * 基于工作的Claude代理，使用文件IPC通信
 */

const DevServerConfig = require('../utils/dev-server-config');
const DevServerWizard = require('../utils/dev-server-wizard');
const ClaudeProxy = require('../utils/claude-proxy');
const WebServer = require('../utils/web-server');

/**
 * 多服务器Dev Server管理器
 */
class DevServerManager {
  constructor() {
    this.config = new DevServerConfig();
    this.runningServers = new Map(); // 存储正在运行的服务器实例
  }

  /**
   * 启动向导
   */
  async runWizard() {
    const wizard = new DevServerWizard();
    await wizard.start();
  }

  /**
   * 列出所有服务器配置
   */
  listServers() {
    console.log('📋 Dev Server 配置列表');
    console.log('═'.repeat(50));

    try {
      const servers = this.config.listServers();
      const defaultServer = this.config.getDefaultServer();

      if (servers.length === 0) {
        console.log('暂无服务器配置');
        console.log('💡 使用 ats ds --wizard 创建配置');
        return;
      }

      servers.forEach((server, index) => {
        const isDefault = server.name === defaultServer;
        const isRunning = this.runningServers.has(server.name);
        
        console.log(`\\n${index + 1}. ${server.name}${isDefault ? ' (默认)' : ''}${isRunning ? ' [运行中]' : ''}`);
        console.log(`   显示名称: ${server.displayName}`);
        console.log(`   目录: ${server.directory}`);
        console.log(`   端口: ${server.port}`);
        console.log(`   认证: ${server.authEnabled ? '启用' : '禁用'}`);
        
        if (isRunning) {
          const instance = this.runningServers.get(server.name);
          const claudeStatus = instance.claudeProxy.getStatus();
          console.log(`   Claude状态: ${claudeStatus.status}`);
          console.log(`   访问: http://localhost:${server.port}`);
        }
      });

      console.log(`\\n📊 总配置数: ${servers.length}`);
      console.log(`🏃 运行中: ${this.runningServers.size}`);

    } catch (error) {
      console.error(`❌ 获取服务器列表失败: ${error.message}`);
    }
  }

  /**
   * 启动指定服务器
   */
  async startServer(serverName) {
    try {
      // 如果未指定服务器名，使用默认服务器
      if (!serverName) {
        serverName = this.config.getDefaultServer();
        if (!serverName) {
          console.log('❌ 没有找到默认服务器配置');
          console.log('💡 使用 ats ds --wizard 创建配置');
          return;
        }
      }

      // 检查服务器是否已在运行
      if (this.runningServers.has(serverName)) {
        console.log(`❌ 服务器 "${serverName}" 已在运行`);
        return;
      }

      // 获取服务器配置
      const serverConfig = this.config.getServer(serverName);
      console.log(`🚀 启动服务器: ${serverConfig.displayName}`);

      // 创建IPC目录
      const ipcDir = this.config.ensureServerIpcDir(serverName);

      // 创建Claude代理
      const claudeProxy = new ClaudeProxy(serverConfig, ipcDir);
      
      // 设置Claude代理日志监听
      claudeProxy.on('log', (level, message) => {
        console.log(`[Claude] ${message}`);
      });

      claudeProxy.on('started', () => {
        console.log('✅ Claude代理启动成功');
      });

      claudeProxy.on('error', (error) => {
        console.error(`❌ Claude代理错误: ${error.message}`);
      });

      claudeProxy.on('stopped', (data) => {
        console.log(`⚠️ Claude代理已停止: ${JSON.stringify(data)}`);
        // 如果Claude停止，也停止整个服务器
        this.stopServer(serverName);
      });

      // 启动Claude代理
      await claudeProxy.start();

      // 创建Web服务器
      const webServer = new WebServer(serverConfig, claudeProxy);
      
      // 设置Web服务器日志监听
      webServer.on('log', (level, message) => {
        console.log(`[Web] ${message}`);
      });

      // 启动Web服务器
      await webServer.start();

      // 记录服务器实例
      this.runningServers.set(serverName, {
        config: serverConfig,
        claudeProxy: claudeProxy,
        webServer: webServer,
        startedAt: new Date()
      });

      // 更新最后使用时间
      this.config.updateLastUsed(serverName);

      console.log('🎉 服务器启动完成！');
      console.log(`🌐 Web访问地址: http://localhost:${serverConfig.port}`);
      console.log(`📱 支持手机浏览器访问`);
      console.log(`🎨 深色主题，Claude风格输出`);
      console.log('💡 按 Ctrl+C 退出\\n');

      // 设置优雅关闭
      this.setupGracefulShutdown(serverName);

    } catch (error) {
      console.error(`❌ 启动服务器失败: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }

  /**
   * 停止指定服务器
   */
  async stopServer(serverName) {
    if (!serverName) {
      console.log('❌ 请指定要停止的服务器名称');
      return;
    }

    const instance = this.runningServers.get(serverName);
    if (!instance) {
      console.log(`❌ 服务器 "${serverName}" 未运行`);
      return;
    }

    console.log(`🛑 停止服务器: ${serverName}`);

    try {
      // 先停止Web服务器
      await instance.webServer.stop();
      
      // 再停止Claude代理
      await instance.claudeProxy.shutdown();

      // 从运行列表中移除
      this.runningServers.delete(serverName);

      console.log(`✅ 服务器 "${serverName}" 已停止`);

    } catch (error) {
      console.error(`❌ 停止服务器失败: ${error.message}`);
    }
  }

  /**
   * 停止所有服务器
   */
  async stopAllServers() {
    if (this.runningServers.size === 0) {
      console.log('没有运行中的服务器');
      return;
    }

    console.log('🛑 停止所有服务器...');

    const stopPromises = Array.from(this.runningServers.keys()).map(serverName => 
      this.stopServer(serverName)
    );

    await Promise.all(stopPromises);
    console.log('✅ 所有服务器已停止');
  }

  /**
   * 查看服务器状态
   */
  showStatus() {
    console.log('📊 Dev Server 状态');
    console.log('═'.repeat(50));

    if (this.runningServers.size === 0) {
      console.log('没有运行中的服务器');
      return;
    }

    this.runningServers.forEach((instance, serverName) => {
      const claudeStatus = instance.claudeProxy.getStatus();
      const webStatus = instance.webServer.getStatus();

      console.log(`\\n🖥️ 服务器: ${serverName}`);
      console.log(`   显示名称: ${instance.config.displayName}`);
      console.log(`   启动时间: ${instance.startedAt.toLocaleString()}`);
      console.log(`   工作目录: ${instance.config.directory}`);
      console.log(`   IPC目录: ${instance.claudeProxy.ipcDir}`);
      console.log(`   Web端口: ${instance.config.port}`);
      console.log(`   Web状态: ${webStatus.isRunning ? '运行中' : '已停止'}`);
      console.log(`   Claude状态: ${claudeStatus.status}`);
      console.log(`   Claude PID: ${claudeStatus.pid || 'N/A'}`);
      console.log(`   WebSocket连接: ${webStatus.sessionsCount}`);
      console.log(`   认证状态: ${webStatus.authEnabled ? '启用' : '禁用'}`);
      console.log(`   访问地址: http://localhost:${instance.config.port}`);
    });
  }

  /**
   * 重启服务器
   */
  async restartServer(serverName) {
    if (!serverName) {
      console.log('❌ 请指定要重启的服务器名称');
      return;
    }

    console.log(`🔄 重启服务器: ${serverName}`);
    
    if (this.runningServers.has(serverName)) {
      await this.stopServer(serverName);
      // 等待一下确保完全停止
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await this.startServer(serverName);
  }

  /**
   * 设置优雅关闭
   */
  setupGracefulShutdown(serverName) {
    const gracefulShutdown = async () => {
      console.log('\\n🛑 收到退出信号，开始优雅关闭...');
      
      if (serverName) {
        await this.stopServer(serverName);
      } else {
        await this.stopAllServers();
      }
      
      process.exit(0);
    };

    // 只设置一次信号处理器
    if (!this.signalHandlersSetup) {
      process.on('SIGINT', gracefulShutdown);
      process.on('SIGTERM', gracefulShutdown);
      this.signalHandlersSetup = true;
    }
  }
}

/**
 * 主入口函数
 */
async function startDevServer(options) {
  const manager = new DevServerManager();

  try {
    // 处理向导模式
    if (options.wizard) {
      await manager.runWizard();
      return;
    }

    // 处理列出服务器
    if (options.list) {
      manager.listServers();
      return;
    }

    // 处理查看状态
    if (options.status) {
      manager.showStatus();
      return;
    }

    // 处理停止服务器
    if (options.stop) {
      if (options.stop === true) {
        await manager.stopAllServers();
      } else {
        await manager.stopServer(options.stop);
      }
      return;
    }

    // 处理重启服务器
    if (options.restart) {
      await manager.restartServer(options.restart);
      return;
    }

    // 处理启动服务器
    if (options.start) {
      await manager.startServer(options.start);
      return;
    }

    // 默认行为：启动默认服务器
    await manager.startServer();

  } catch (error) {
    console.error(`❌ 操作失败: ${error.message}`);
    if (options.debug && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = {
  DevServerManager,
  startDevServer
};