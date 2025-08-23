/**
 * Dev Server 配置向导 - 交互式配置多服务器
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const DevServerConfig = require('./dev-server-config');

class DevServerWizard {
  constructor() {
    this.config = new DevServerConfig();
    this.rl = null;
  }

  /**
   * 启动向导
   */
  async start() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('🧙‍♂️ 欢迎使用 Dev Server 配置向导');
      console.log('═'.repeat(50));

      await this.showMainMenu();
    } catch (error) {
      console.error(`❌ 向导执行失败: ${error.message}`);
    } finally {
      this.rl.close();
    }
  }

  /**
   * 显示主菜单
   */
  async showMainMenu() {
    while (true) {
      console.log('\\n📋 主菜单:');
      console.log('1. 添加新服务器配置');
      console.log('2. 查看现有配置');
      console.log('3. 修改服务器配置');
      console.log('4. 删除服务器配置');
      console.log('5. 设置默认服务器');
      console.log('6. 退出向导');

      const choice = await this.ask('请选择操作 (1-6): ');
      
      switch (choice.trim()) {
        case '1':
          await this.addServerWizard();
          break;
        case '2':
          await this.listServers();
          break;
        case '3':
          await this.editServerWizard();
          break;
        case '4':
          await this.deleteServerWizard();
          break;
        case '5':
          await this.setDefaultServerWizard();
          break;
        case '6':
          console.log('👋 再见！');
          return;
        default:
          console.log('❌ 无效选择，请重新输入');
      }
    }
  }

  /**
   * 添加服务器向导
   */
  async addServerWizard() {
    console.log('\\n➕ 添加新服务器配置');
    console.log('─'.repeat(30));

    try {
      const serverConfig = {};

      // 服务器名称
      serverConfig.name = await this.ask('服务器名称: ');
      if (!serverConfig.name.trim()) {
        console.log('❌ 服务器名称不能为空');
        return;
      }

      // 检查名称是否已存在
      try {
        this.config.getServer(serverConfig.name);
        console.log(`❌ 服务器 "${serverConfig.name}" 已存在`);
        return;
      } catch (error) {
        // 名称不存在，继续
      }

      // 显示名称
      const displayName = await this.ask(`显示名称 [${serverConfig.name}]: `);
      serverConfig.displayName = displayName.trim() || serverConfig.name;

      // 项目目录
      const defaultDir = process.cwd();
      const directory = await this.ask(`项目目录 [${defaultDir}]: `);
      serverConfig.directory = directory.trim() || defaultDir;

      // 验证目录是否存在
      if (!fs.existsSync(serverConfig.directory)) {
        const create = await this.ask(`目录不存在，是否创建? (y/n) [y]: `);
        if (create.toLowerCase() !== 'n') {
          fs.mkdirSync(serverConfig.directory, { recursive: true });
          console.log(`✅ 目录已创建: ${serverConfig.directory}`);
        } else {
          console.log('❌ 目录不存在，配置取消');
          return;
        }
      }

      // 端口
      const portInput = await this.ask('服务器端口 [3000]: ');
      serverConfig.port = parseInt(portInput.trim()) || 3000;

      // 认证设置
      const authEnabled = await this.ask('是否启用用户认证? (y/n) [n]: ');
      serverConfig.authEnabled = authEnabled.toLowerCase() === 'y';

      if (serverConfig.authEnabled) {
        serverConfig.username = await this.ask('用户名: ');
        if (!serverConfig.username.trim()) {
          console.log('❌ 用户名不能为空');
          return;
        }

        // 密码输入 - 使用普通的ask方法
        const password = await this.ask('密码: ');
        serverConfig.password = password.trim();
        if (!serverConfig.password) {
          console.log('❌ 密码不能为空');
          return;
        }
      }

      // Claude命令
      const claudeCmd = await this.ask('Claude命令 [claude]: ');
      serverConfig.claudeCommand = claudeCmd.trim() || 'claude';

      // 确认配置
      console.log('\\n📋 配置预览:');
      console.log(`名称: ${serverConfig.name}`);
      console.log(`显示名称: ${serverConfig.displayName}`);
      console.log(`目录: ${serverConfig.directory}`);
      console.log(`端口: ${serverConfig.port}`);
      console.log(`认证: ${serverConfig.authEnabled ? '启用' : '禁用'}`);
      if (serverConfig.authEnabled) {
        console.log(`用户名: ${serverConfig.username}`);
        console.log(`密码: ****`);
      }
      console.log(`Claude命令: ${serverConfig.claudeCommand}`);

      const confirm = await this.ask('\\n确认保存配置? (y/n) [y]: ');
      if (confirm.toLowerCase() !== 'n') {
        this.config.addServer(serverConfig);
        console.log('✅ 服务器配置已保存');
      } else {
        console.log('❌ 配置已取消');
      }

    } catch (error) {
      console.error(`❌ 配置失败: ${error.message}`);
    }
  }

  /**
   * 列出服务器
   */
  async listServers() {
    console.log('\\n📋 现有服务器配置');
    console.log('─'.repeat(30));

    try {
      const servers = this.config.listServers();
      const defaultServer = this.config.getDefaultServer();

      if (servers.length === 0) {
        console.log('暂无服务器配置');
        return;
      }

      servers.forEach((server, index) => {
        const isDefault = server.name === defaultServer;
        console.log(`\\n${index + 1}. ${server.name}${isDefault ? ' (默认)' : ''}`);
        console.log(`   显示名称: ${server.displayName}`);
        console.log(`   目录: ${server.directory}`);
        console.log(`   端口: ${server.port}`);
        console.log(`   认证: ${server.authEnabled ? '启用' : '禁用'}`);
        if (server.authEnabled) {
          console.log(`   用户名: ${server.auth.username}`);
        }
        console.log(`   创建时间: ${new Date(server.createdAt).toLocaleString()}`);
        if (server.lastUsed) {
          console.log(`   最后使用: ${new Date(server.lastUsed).toLocaleString()}`);
        }
      });

    } catch (error) {
      console.error(`❌ 获取配置失败: ${error.message}`);
    }

    await this.ask('\\n按回车键继续...');
  }

  /**
   * 编辑服务器向导
   */
  async editServerWizard() {
    console.log('\\n✏️ 修改服务器配置');
    console.log('─'.repeat(30));

    const servers = this.config.listServers();
    if (servers.length === 0) {
      console.log('暂无服务器配置');
      return;
    }

    // 显示服务器列表
    servers.forEach((server, index) => {
      console.log(`${index + 1}. ${server.name} - ${server.displayName}`);
    });

    const choice = await this.ask('请选择要修改的服务器 (输入编号): ');
    const index = parseInt(choice.trim()) - 1;

    if (index < 0 || index >= servers.length) {
      console.log('❌ 无效选择');
      return;
    }

    const serverName = servers[index].name;
    console.log(`\\n正在修改服务器: ${serverName}`);
    console.log('💡 直接按回车保持原值不变');

    try {
      const existingConfig = this.config.getServer(serverName);
      const newConfig = { name: serverName };

      // 显示名称
      const displayName = await this.ask(`显示名称 [${existingConfig.displayName}]: `);
      newConfig.displayName = displayName.trim() || existingConfig.displayName;

      // 项目目录
      const directory = await this.ask(`项目目录 [${existingConfig.directory}]: `);
      newConfig.directory = directory.trim() || existingConfig.directory;

      // 端口
      const portInput = await this.ask(`服务器端口 [${existingConfig.port}]: `);
      newConfig.port = portInput.trim() ? parseInt(portInput.trim()) : existingConfig.port;

      // 认证设置
      const currentAuth = existingConfig.auth.enabled ? 'y' : 'n';
      const authEnabled = await this.ask(`是否启用用户认证? (y/n) [${currentAuth}]: `);
      newConfig.authEnabled = authEnabled.trim() ? authEnabled.toLowerCase() === 'y' : existingConfig.auth.enabled;

      if (newConfig.authEnabled) {
        const username = await this.ask(`用户名 [${existingConfig.auth.username}]: `);
        newConfig.username = username.trim() || existingConfig.auth.username;

        const changePassword = await this.ask('是否修改密码? (y/n) [n]: ');
        if (changePassword.toLowerCase() === 'y') {
          const newPassword = await this.ask('新密码: ');
          newConfig.password = newPassword.trim();
        }
      }

      // Claude命令
      const claudeCmd = await this.ask(`Claude命令 [${existingConfig.claude.command}]: `);
      newConfig.claudeCommand = claudeCmd.trim() || existingConfig.claude.command;

      // 保存修改
      this.config.addServer(newConfig);
      console.log('✅ 服务器配置已更新');

    } catch (error) {
      console.error(`❌ 修改失败: ${error.message}`);
    }
  }

  /**
   * 删除服务器向导
   */
  async deleteServerWizard() {
    console.log('\\n🗑️ 删除服务器配置');
    console.log('─'.repeat(30));

    const servers = this.config.listServers();
    if (servers.length === 0) {
      console.log('暂无服务器配置');
      return;
    }

    // 显示服务器列表
    servers.forEach((server, index) => {
      console.log(`${index + 1}. ${server.name} - ${server.displayName}`);
    });

    const choice = await this.ask('请选择要删除的服务器 (输入编号): ');
    const index = parseInt(choice.trim()) - 1;

    if (index < 0 || index >= servers.length) {
      console.log('❌ 无效选择');
      return;
    }

    const serverName = servers[index].name;
    const confirm = await this.ask(`确认删除服务器 "${serverName}"? (y/n) [n]: `);
    
    if (confirm.toLowerCase() === 'y') {
      try {
        this.config.removeServer(serverName);
        console.log('✅ 服务器配置已删除');
      } catch (error) {
        console.error(`❌ 删除失败: ${error.message}`);
      }
    } else {
      console.log('❌ 删除已取消');
    }
  }

  /**
   * 设置默认服务器向导
   */
  async setDefaultServerWizard() {
    console.log('\\n🎯 设置默认服务器');
    console.log('─'.repeat(30));

    const servers = this.config.listServers();
    const currentDefault = this.config.getDefaultServer();

    if (servers.length === 0) {
      console.log('暂无服务器配置');
      return;
    }

    // 显示服务器列表
    servers.forEach((server, index) => {
      const isDefault = server.name === currentDefault;
      console.log(`${index + 1}. ${server.name} - ${server.displayName}${isDefault ? ' (当前默认)' : ''}`);
    });

    const choice = await this.ask('请选择默认服务器 (输入编号): ');
    const index = parseInt(choice.trim()) - 1;

    if (index < 0 || index >= servers.length) {
      console.log('❌ 无效选择');
      return;
    }

    const serverName = servers[index].name;
    
    try {
      this.config.setDefaultServer(serverName);
      console.log(`✅ 默认服务器已设置为 "${serverName}"`);
    } catch (error) {
      console.error(`❌ 设置失败: ${error.message}`);
    }
  }

  /**
   * 询问用户输入
   */
  ask(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  /**
   * 询问密码输入 (无回显)
   */
  askPassword(question) {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;

      stdout.write(question);
      stdin.resume();
      stdin.setRawMode(true);
      stdin.setEncoding('utf8');

      let password = '';
      const onData = (char) => {
        // 检查回车键 - Windows上可能是 \r\n
        if (char === '\r' || char === '\n' || char === '\r\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(password);
          return;
        } else if (char === '\u0003') {
          // Ctrl+C
          stdin.setRawMode(false);
          stdin.pause();
          process.exit();
        } else if (char === '\u007f' || char === '\b') {
          // Backspace - 不同系统可能使用不同的字符
          if (password.length > 0) {
            password = password.slice(0, -1);
            // 不显示退格效果
          }
        } else if (char.charCodeAt(0) < 32) {
          // 忽略其他控制字符
          return;
        } else {
          password += char;
          // 不回显任何字符
        }
      };

      stdin.on('data', onData);
    });
  }
}

module.exports = DevServerWizard;