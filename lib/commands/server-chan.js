const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.awesome-tools');
const CONFIG_FILE = path.join(CONFIG_DIR, 'serverchan.json');

// Server酱 API 基础URL
const API_BASE_URL = 'sctapi.ftqq.com';

class ServerChan {
  constructor() {
    this.config = this.loadConfig();
  }

  // 加载配置
  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return config;
      }
    } catch (error) {
      console.error('⚠️  配置文件读取失败:', error.message);
    }
    return {
      sendkeys: [],
      defaultChannel: null,
      channels: {}
    };
  }

  // 保存配置
  saveConfig() {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('❌ 配置保存失败:', error.message);
      return false;
    }
  }

  // 添加SendKey
  addSendKey(name, sendkey, isDefault = false) {
    // 验证SendKey格式
    if (!sendkey || !sendkey.match(/^SCT[\w]+$/)) {
      throw new Error('SendKey格式无效，应以SCT开头');
    }

    // 检查是否已存在
    const existing = this.config.sendkeys.find(k => k.name === name || k.key === sendkey);
    if (existing) {
      throw new Error(`SendKey已存在: ${existing.name}`);
    }

    // 添加新的SendKey
    this.config.sendkeys.push({
      name: name,
      key: sendkey,
      addTime: new Date().toISOString()
    });

    // 设置为默认
    if (isDefault || this.config.sendkeys.length === 1) {
      this.config.defaultChannel = name;
    }

    this.saveConfig();
    console.log(`✅ SendKey添加成功: ${name}`);
    if (this.config.defaultChannel === name) {
      console.log(`   已设为默认通道`);
    }
  }

  // 删除SendKey
  removeSendKey(name) {
    const index = this.config.sendkeys.findIndex(k => k.name === name);
    if (index === -1) {
      throw new Error(`SendKey不存在: ${name}`);
    }

    this.config.sendkeys.splice(index, 1);
    
    // 如果删除的是默认通道，重置默认
    if (this.config.defaultChannel === name) {
      this.config.defaultChannel = this.config.sendkeys.length > 0 ? this.config.sendkeys[0].name : null;
    }

    this.saveConfig();
    console.log(`✅ SendKey删除成功: ${name}`);
  }

  // 列出所有SendKey
  listSendKeys() {
    if (this.config.sendkeys.length === 0) {
      console.log('⚠️  暂无配置的SendKey');
      console.log('💡 使用 ats notify --add <name> <sendkey> 添加');
      return;
    }

    console.log('\n📋 已配置的SendKey:');
    console.log('─'.repeat(60));
    
    this.config.sendkeys.forEach((key, index) => {
      const isDefault = key.name === this.config.defaultChannel;
      const maskedKey = key.key.substring(0, 10) + '****' + key.key.substring(key.key.length - 4);
      
      console.log(`${index + 1}. ${key.name} ${isDefault ? '(默认)' : ''}`);
      console.log(`   SendKey: ${maskedKey}`);
      console.log(`   添加时间: ${new Date(key.addTime).toLocaleString('zh-CN')}`);
      if (index < this.config.sendkeys.length - 1) {
        console.log('');
      }
    });
    console.log('─'.repeat(60));
  }

  // 设置默认通道
  setDefault(name) {
    const key = this.config.sendkeys.find(k => k.name === name);
    if (!key) {
      throw new Error(`SendKey不存在: ${name}`);
    }

    this.config.defaultChannel = name;
    this.saveConfig();
    console.log(`✅ 默认通道设置为: ${name}`);
  }

  // 发送消息
  async send(title, content = '', options = {}) {
    // 确定发送目标
    let targets = [];
    
    if (options.channel) {
      // 指定通道
      if (options.channel === '*') {
        // 群发到所有通道
        targets = this.config.sendkeys;
      } else {
        // 发送到指定通道（支持逗号分隔的多个通道）
        const channelNames = options.channel.split(',').map(c => c.trim());
        for (const name of channelNames) {
          const key = this.config.sendkeys.find(k => k.name === name);
          if (!key) {
            console.error(`⚠️  通道不存在: ${name}`);
            continue;
          }
          targets.push(key);
        }
      }
    } else {
      // 使用默认通道
      if (!this.config.defaultChannel) {
        throw new Error('未配置默认通道，请使用 --channel 指定或设置默认通道');
      }
      const defaultKey = this.config.sendkeys.find(k => k.name === this.config.defaultChannel);
      if (!defaultKey) {
        throw new Error('默认通道配置错误');
      }
      targets = [defaultKey];
    }

    if (targets.length === 0) {
      throw new Error('没有有效的发送目标');
    }

    // 发送到所有目标
    const results = [];
    for (const target of targets) {
      try {
        console.log(`📤 发送到 ${target.name}...`);
        const result = await this.sendToChannel(target.key, title, content, options);
        results.push({ channel: target.name, success: true, result });
        console.log(`   ✅ 发送成功`);
      } catch (error) {
        console.error(`   ❌ 发送失败: ${error.message}`);
        results.push({ channel: target.name, success: false, error: error.message });
      }
    }

    return results;
  }

  // 发送到单个通道
  sendToChannel(sendkey, title, desp = '', options = {}) {
    return new Promise((resolve, reject) => {
      // 构建请求数据
      const postData = new URLSearchParams();
      postData.append('title', title);
      
      if (desp) {
        // 支持Markdown格式
        postData.append('desp', desp);
      }

      // 添加标签
      if (options.tags) {
        postData.append('tags', options.tags);
      }

      // 短消息（可选）
      if (options.short) {
        postData.append('short', options.short);
      }

      const postDataString = postData.toString();

      // 请求选项
      const requestOptions = {
        hostname: API_BASE_URL,
        port: 443,
        path: `/${sendkey}.send`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postDataString)
        }
      };

      // 发送请求
      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.code === 0) {
              resolve(result);
            } else {
              reject(new Error(result.message || '发送失败'));
            }
          } catch (error) {
            reject(new Error('响应解析失败'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postDataString);
      req.end();
    });
  }

  // 测试SendKey
  async test(channel) {
    const title = '🎯 测试消息';
    const content = `这是一条来自 Awesome Tools 的测试消息\n\n发送时间: ${new Date().toLocaleString('zh-CN')}\n\n如果您收到这条消息，说明配置正确！`;
    
    try {
      await this.send(title, content, { channel });
      console.log('\n✅ 测试成功！请检查您的设备是否收到消息。');
    } catch (error) {
      console.error('\n❌ 测试失败:', error.message);
    }
  }

  // 交互式配置向导
  async wizard() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => rl.question(query, resolve));

    try {
      console.log('\n🔧 Server酱配置向导');
      console.log('─'.repeat(50));
      console.log('📱 Server酱是一款服务器消息推送工具');
      console.log('🔗 获取SendKey: https://sct.ftqq.com');
      console.log('─'.repeat(50));

      // 显示当前配置
      if (this.config.sendkeys.length > 0) {
        this.listSendKeys();
        console.log('');
      }

      // 选择操作
      console.log('请选择操作:');
      console.log('1. 添加新的SendKey');
      console.log('2. 删除SendKey');
      console.log('3. 设置默认通道');
      console.log('4. 测试发送');
      console.log('0. 退出');
      
      const choice = await question('\n请输入选项 (0-4): ');

      switch (choice) {
        case '1': {
          const name = await question('请输入通道名称 (如: personal): ');
          const sendkey = await question('请输入SendKey (SCT开头): ');
          const isDefault = await question('设为默认通道? (y/n): ');
          
          this.addSendKey(name.trim(), sendkey.trim(), isDefault.toLowerCase() === 'y');
          
          const testNow = await question('\n是否立即测试? (y/n): ');
          if (testNow.toLowerCase() === 'y') {
            await this.test(name.trim());
          }
          break;
        }

        case '2': {
          if (this.config.sendkeys.length === 0) {
            console.log('⚠️  暂无可删除的SendKey');
            break;
          }
          const name = await question('请输入要删除的通道名称: ');
          this.removeSendKey(name.trim());
          break;
        }

        case '3': {
          if (this.config.sendkeys.length === 0) {
            console.log('⚠️  请先添加SendKey');
            break;
          }
          const name = await question('请输入要设为默认的通道名称: ');
          this.setDefault(name.trim());
          break;
        }

        case '4': {
          if (this.config.sendkeys.length === 0) {
            console.log('⚠️  请先添加SendKey');
            break;
          }
          const channel = await question('请输入测试通道名称 (留空使用默认): ');
          await this.test(channel.trim() || undefined);
          break;
        }

        case '0':
          console.log('👋 再见！');
          break;

        default:
          console.log('⚠️  无效的选项');
      }

    } finally {
      rl.close();
    }
  }
}

// 命令行入口
async function startNotify(options) {
  const serverChan = new ServerChan();

  try {
    // 配置向导
    if (options.wizard) {
      await serverChan.wizard();
      return;
    }

    // 添加SendKey
    if (options.add) {
      const [name, sendkey] = options.add.split(':');
      if (!name || !sendkey) {
        throw new Error('格式错误，应为: --add name:SCTxxxxx');
      }
      serverChan.addSendKey(name, sendkey, options.default);
      return;
    }

    // 删除SendKey
    if (options.remove) {
      serverChan.removeSendKey(options.remove);
      return;
    }

    // 列出SendKey
    if (options.list) {
      serverChan.listSendKeys();
      return;
    }

    // 设置默认通道
    if (options.setDefault) {
      serverChan.setDefault(options.setDefault);
      return;
    }

    // 测试发送
    if (options.test) {
      const channel = typeof options.test === 'string' ? options.test : undefined;
      await serverChan.test(channel);
      return;
    }

    // 发送消息
    if (options.title) {
      await serverChan.send(
        options.title,
        options.desp || options.content || '',
        {
          channel: options.channel,
          tags: options.tags,
          short: options.short
        }
      );
      return;
    }

    // 从标准输入读取
    if (options.stdin) {
      const chunks = [];
      process.stdin.on('data', chunk => chunks.push(chunk));
      process.stdin.on('end', async () => {
        const input = Buffer.concat(chunks).toString();
        const lines = input.trim().split('\n');
        const title = lines[0] || '通知';
        const content = lines.slice(1).join('\n');
        
        await serverChan.send(title, content, {
          channel: options.channel,
          tags: options.tags
        });
      });
      return;
    }

    // 默认显示帮助
    console.log('💡 使用 ats notify --wizard 开始配置');
    console.log('📖 使用 ats notify --help 查看帮助');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 导出供NPX使用
function createNPXWrapper() {
  return {
    send: async (title, content, options = {}) => {
      const serverChan = new ServerChan();
      return await serverChan.send(title, content, options);
    },
    config: async (action, ...args) => {
      const serverChan = new ServerChan();
      
      switch (action) {
        case 'add':
          return serverChan.addSendKey(...args);
        case 'remove':
          return serverChan.removeSendKey(...args);
        case 'list':
          return serverChan.listSendKeys();
        case 'setDefault':
          return serverChan.setDefault(...args);
        default:
          throw new Error(`未知操作: ${action}`);
      }
    }
  };
}

module.exports = {
  startNotify,
  ServerChan,
  createNPXWrapper
};