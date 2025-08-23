/**
 * Dev Server 配置管理 - 多服务器配置系统
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class DevServerConfig {
  constructor() {
    this.configDir = path.join(os.homedir(), '.awesome-tools', 'dev-server');
    this.configFile = path.join(this.configDir, 'config.json');
    this.defaultConfig = {
      servers: {},
      defaultServer: null,
      version: '2.0'
    };
    
    this.ensureConfigDir();
  }

  /**
   * 确保配置目录存在
   */
  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * 读取配置文件
   */
  loadConfig() {
    if (!fs.existsSync(this.configFile)) {
      return this.defaultConfig;
    }

    try {
      const content = fs.readFileSync(this.configFile, 'utf8');
      const config = JSON.parse(content);
      return { ...this.defaultConfig, ...config };
    } catch (error) {
      console.warn(`⚠️ 配置文件读取失败，使用默认配置: ${error.message}`);
      return this.defaultConfig;
    }
  }

  /**
   * 保存配置文件
   */
  saveConfig(config) {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`❌ 配置文件保存失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 加密密码
   */
  encryptPassword(password) {
    if (!password) return null;
    
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('dev-server-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      algorithm,
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * 解密密码
   */
  decryptPassword(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const key = crypto.scryptSync('dev-server-key', 'salt', 32);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv(encryptedData.algorithm, key, iv);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error(`❌ 密码解密失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 添加或更新服务器配置
   */
  addServer(serverConfig) {
    const config = this.loadConfig();
    
    // 验证配置
    if (!serverConfig.name || !serverConfig.directory || !serverConfig.port) {
      throw new Error('服务器配置缺少必要字段: name, directory, port');
    }

    // 检查端口是否被其他服务器使用
    const existingServer = Object.values(config.servers).find(
      s => s.port === serverConfig.port && s.name !== serverConfig.name
    );
    if (existingServer) {
      throw new Error(`端口 ${serverConfig.port} 已被服务器 "${existingServer.name}" 使用`);
    }

    // 构建完整配置
    const fullConfig = {
      name: serverConfig.name,
      displayName: serverConfig.displayName || serverConfig.name,
      directory: path.resolve(serverConfig.directory),
      port: parseInt(serverConfig.port),
      auth: {
        enabled: serverConfig.authEnabled || false,
        username: serverConfig.username || '',
        password: serverConfig.password ? this.encryptPassword(serverConfig.password) : null
      },
      claude: {
        command: serverConfig.claudeCommand || 'claude',
        workingDir: path.resolve(serverConfig.directory)
      },
      createdAt: new Date().toISOString(),
      lastUsed: null
    };

    // 保存配置
    config.servers[serverConfig.name] = fullConfig;
    
    // 设置为默认服务器（如果是第一个）
    if (!config.defaultServer) {
      config.defaultServer = serverConfig.name;
    }

    if (this.saveConfig(config)) {
      console.log(`✅ 服务器配置 "${serverConfig.name}" 已保存`);
      return fullConfig;
    } else {
      throw new Error('配置保存失败');
    }
  }

  /**
   * 获取服务器配置
   */
  getServer(name) {
    const config = this.loadConfig();
    const serverConfig = config.servers[name];
    
    if (!serverConfig) {
      throw new Error(`服务器 "${name}" 不存在`);
    }

    // 解密密码
    if (serverConfig.auth.password) {
      serverConfig.auth.password = this.decryptPassword(serverConfig.auth.password);
    }

    return serverConfig;
  }

  /**
   * 列出所有服务器
   */
  listServers() {
    const config = this.loadConfig();
    return Object.values(config.servers).map(server => ({
      ...server,
      authEnabled: server.auth.enabled,
      // 不返回密码信息
      auth: {
        enabled: server.auth.enabled,
        username: server.auth.username
      }
    }));
  }

  /**
   * 删除服务器配置
   */
  removeServer(name) {
    const config = this.loadConfig();
    
    if (!config.servers[name]) {
      throw new Error(`服务器 "${name}" 不存在`);
    }

    delete config.servers[name];
    
    // 如果删除的是默认服务器，重新设置默认服务器
    if (config.defaultServer === name) {
      const remaining = Object.keys(config.servers);
      config.defaultServer = remaining.length > 0 ? remaining[0] : null;
    }

    if (this.saveConfig(config)) {
      console.log(`✅ 服务器配置 "${name}" 已删除`);
      return true;
    } else {
      throw new Error('配置保存失败');
    }
  }

  /**
   * 设置默认服务器
   */
  setDefaultServer(name) {
    const config = this.loadConfig();
    
    if (!config.servers[name]) {
      throw new Error(`服务器 "${name}" 不存在`);
    }

    config.defaultServer = name;
    
    if (this.saveConfig(config)) {
      console.log(`✅ 默认服务器已设置为 "${name}"`);
      return true;
    } else {
      throw new Error('配置保存失败');
    }
  }

  /**
   * 获取默认服务器名称
   */
  getDefaultServer() {
    const config = this.loadConfig();
    return config.defaultServer;
  }

  /**
   * 更新最后使用时间
   */
  updateLastUsed(name) {
    const config = this.loadConfig();
    
    if (config.servers[name]) {
      config.servers[name].lastUsed = new Date().toISOString();
      this.saveConfig(config);
    }
  }
}

module.exports = DevServerConfig;