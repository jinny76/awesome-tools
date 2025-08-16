const fs = require('fs');
const path = require('path');
const os = require('os');
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const Table = require('cli-table3');

/**
 * 数据库配置管理器
 */
class DatabaseConfig {
  constructor() {
    this.configPath = path.join(os.homedir(), '.awesome-tools-db.json');
  }

  /**
   * 加载配置
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (error) {
      console.warn('⚠️ 警告: 配置文件读取失败，使用默认配置');
    }
    return { connections: {} };
  }

  /**
   * 保存配置
   */
  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('❌ 配置保存失败:', error.message);
      return false;
    }
  }

  /**
   * 添加连接配置
   */
  addConnection(name, connectionConfig) {
    const config = this.loadConfig();
    
    // 移除密码敏感信息，只保存连接参数
    const safeConfig = { ...connectionConfig };
    if (safeConfig.password) {
      safeConfig.hasPassword = true;
      delete safeConfig.password; // 不保存密码到文件
    }
    
    config.connections[name] = safeConfig;
    return this.saveConfig(config);
  }

  /**
   * 获取连接配置
   */
  getConnection(name) {
    const config = this.loadConfig();
    return config.connections[name] || null;
  }

  /**
   * 列出所有连接
   */
  listConnections() {
    const config = this.loadConfig();
    return Object.keys(config.connections);
  }
}

/**
 * 数据库连接器
 */
class DatabaseConnector {
  constructor() {
    this.config = new DatabaseConfig();
  }

  /**
   * 创建MySQL连接
   */
  async createMySQLConnection(options) {
    const config = {
      host: options.host || 'localhost',
      port: options.port || 3306,
      user: options.user,
      password: options.password,
      database: options.database,
      charset: 'utf8mb4',
      timezone: '+00:00'
    };

    return await mysql.createConnection(config);
  }

  /**
   * 创建PostgreSQL连接
   */
  async createPostgresConnection(options) {
    const config = {
      host: options.host || 'localhost',
      port: options.port || 5432,
      user: options.user,
      password: options.password,
      database: options.database
    };

    const client = new Client(config);
    await client.connect();
    return client;
  }

  /**
   * 测试数据库连接
   */
  async testConnection(options) {
    try {
      if (options.type === 'mysql') {
        const connection = await this.createMySQLConnection(options);
        await connection.execute('SELECT 1 as test');
        await connection.end();
        return { success: true, message: '✅ MySQL连接测试成功' };
      } else if (options.type === 'postgres') {
        const client = await this.createPostgresConnection(options);
        await client.query('SELECT 1 as test');
        await client.end();
        return { success: true, message: '✅ PostgreSQL连接测试成功' };
      }
    } catch (error) {
      return { success: false, message: `❌ 连接失败: ${error.message}` };
    }
  }

  /**
   * 执行SQL查询
   */
  async executeQuery(options, sql) {
    try {
      if (options.type === 'mysql') {
        const connection = await this.createMySQLConnection(options);
        const [rows, fields] = await connection.execute(sql);
        await connection.end();
        return { success: true, data: rows, fields };
      } else if (options.type === 'postgres') {
        const client = await this.createPostgresConnection(options);
        const result = await client.query(sql);
        await client.end();
        return { success: true, data: result.rows, fields: result.fields };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取表列表
   */
  async getTables(options) {
    const sql = options.type === 'mysql' 
      ? 'SHOW TABLES'
      : "SELECT tablename FROM pg_tables WHERE schemaname = 'public'";
    
    return await this.executeQuery(options, sql);
  }

  /**
   * 获取表结构
   */
  async describeTable(options, tableName) {
    const sql = options.type === 'mysql'
      ? `DESCRIBE \`${tableName}\``
      : `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = 'public'`;
    
    return await this.executeQuery(options, sql);
  }
}

/**
 * 结果格式化器
 */
class ResultFormatter {
  /**
   * 格式化为表格
   */
  static formatTable(data, fields) {
    if (!data || data.length === 0) {
      return '📝 查询结果为空';
    }

    // 创建表头
    const headers = fields ? fields.map(f => f.name || f.column_name || f) : Object.keys(data[0]);
    
    const table = new Table({
      head: headers,
      style: { 
        head: ['cyan'],
        border: ['gray'],
        compact: false 
      },
      colWidths: headers.map(() => null), // 自动调整列宽
      wordWrap: true
    });

    // 添加数据行
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null) return 'NULL';
        if (value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      });
      table.push(values);
    });

    return table.toString();
  }

  /**
   * 格式化为JSON
   */
  static formatJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * 格式化为CSV
   */
  static formatCSV(data, fields) {
    if (!data || data.length === 0) return '';

    const headers = fields ? fields.map(f => f.name || f.column_name || f) : Object.keys(data[0]);
    const csvData = [headers];

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null) return 'NULL';
        if (value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        const str = String(value);
        // 如果包含逗号或引号，需要用引号包围并转义
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvData.push(values);
    });

    return csvData.map(row => row.join(',')).join('\n');
  }
}

/**
 * 交互式向导
 */
class DatabaseWizard {
  static async runWizard() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    try {
      console.log('🛠️ 数据库连接配置向导\n');

      const type = await question('选择数据库类型 (mysql/postgres): ');
      if (!['mysql', 'postgres'].includes(type)) {
        throw new Error('不支持的数据库类型');
      }

      const host = await question('数据库主机 (默认: localhost): ') || 'localhost';
      const defaultPort = type === 'mysql' ? '3306' : '5432';
      const port = await question(`端口 (默认: ${defaultPort}): `) || defaultPort;
      const user = await question('用户名: ');
      const password = await question('密码: ');
      const database = await question('数据库名: ');
      const configName = await question('保存配置名称 (可选): ');

      const options = {
        type,
        host,
        port: parseInt(port),
        user,
        password,
        database
      };

      // 测试连接
      console.log('\n🔍 测试数据库连接...');
      const connector = new DatabaseConnector();
      const testResult = await connector.testConnection(options);
      
      if (testResult.success) {
        console.log(testResult.message);
        
        if (configName) {
          connector.config.addConnection(configName, options);
          console.log(`💾 配置已保存为: ${configName}`);
        }
        
        // 询问是否执行查询
        const shouldQuery = await question('\n是否执行查询? (y/n): ');
        if (shouldQuery.toLowerCase() === 'y') {
          const sql = await question('输入SQL查询: ');
          if (sql.trim()) {
            console.log('\n📊 执行查询...');
            const result = await connector.executeQuery(options, sql);
            if (result.success) {
              console.log(ResultFormatter.formatTable(result.data, result.fields));
            } else {
              console.error('❌ 查询失败:', result.error);
            }
          }
        }
      } else {
        console.error(testResult.message);
      }
    } catch (error) {
      console.error('❌ 向导执行失败:', error.message);
    } finally {
      rl.close();
    }
  }
}

/**
 * 主要入口函数
 */
async function startDatabase(options) {
  const connector = new DatabaseConnector();

  try {
    // 启动向导
    if (options.wizard) {
      return await DatabaseWizard.runWizard();
    }

    // 列出配置
    if (options.list) {
      const connections = connector.config.listConnections();
      if (connections.length === 0) {
        console.log('📝 未找到保存的数据库配置');
        console.log('💡 使用 --wizard 创建新配置');
        return;
      }
      
      console.log('📋 已保存的数据库配置:');
      connections.forEach(name => {
        const config = connector.config.getConnection(name);
        console.log(`  🔗 ${name}: ${config.type}://${config.user}@${config.host}:${config.port}/${config.database}`);
      });
      return;
    }

    // 构建连接选项
    let connectionOptions = {};
    
    if (options.config) {
      // 使用保存的配置
      const savedConfig = connector.config.getConnection(options.config);
      if (!savedConfig) {
        throw new Error(`未找到配置: ${options.config}`);
      }
      connectionOptions = { ...savedConfig };
      
      // 如果配置中没有密码，提示输入
      if (savedConfig.hasPassword && !options.password) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const password = await new Promise(resolve => {
          rl.question(`请输入 ${options.config} 的密码: `, (answer) => {
            rl.close();
            resolve(answer);
          });
        });
        connectionOptions.password = password;
      }
    } else {
      // 使用命令行参数
      connectionOptions = {
        type: options.type || 'mysql',
        host: options.host || 'localhost',
        port: options.port || (options.type === 'postgres' ? 5432 : 3306),
        user: options.user,
        password: options.password,
        database: options.database
      };
    }

    // 验证必需参数
    if (!connectionOptions.user || !connectionOptions.database) {
      throw new Error('缺少必需的连接参数: user, database');
    }
    if (!connectionOptions.password && !options.test) {
      throw new Error('缺少密码参数');
    }

    // 保存配置
    if (options.save) {
      connector.config.addConnection(options.save, connectionOptions);
      console.log(`💾 配置已保存为: ${options.save}`);
    }

    // 测试连接
    if (options.test) {
      const result = await connector.testConnection(connectionOptions);
      console.log(result.message);
      return;
    }

    // 列出表
    if (options.tables) {
      console.log('📊 获取表列表...');
      const result = await connector.getTables(connectionOptions);
      if (result.success) {
        const tableNames = result.data.map(row => Object.values(row)[0]);
        console.log('📋 数据库表:');
        tableNames.forEach(name => console.log(`  📄 ${name}`));
      } else {
        throw new Error(result.error);
      }
      return;
    }

    // 查看表结构
    if (options.describe) {
      console.log(`📊 获取表结构: ${options.describe}...`);
      const result = await connector.describeTable(connectionOptions, options.describe);
      if (result.success) {
        console.log(ResultFormatter.formatTable(result.data, result.fields));
      } else {
        throw new Error(result.error);
      }
      return;
    }

    // 执行查询
    if (options.query) {
      console.log('📊 执行查询...');
      const result = await connector.executeQuery(connectionOptions, options.query);
      
      if (result.success) {
        const exportFormat = options.export || 'table';
        
        switch (exportFormat.toLowerCase()) {
          case 'json':
            console.log(ResultFormatter.formatJSON(result.data));
            break;
          case 'csv':
            console.log(ResultFormatter.formatCSV(result.data, result.fields));
            break;
          case 'table':
          default:
            console.log(ResultFormatter.formatTable(result.data, result.fields));
            break;
        }
        
        console.log(`\n📊 查询完成，返回 ${result.data.length} 行数据`);
      } else {
        throw new Error(result.error);
      }
      return;
    }

    // 如果没有指定操作，显示帮助
    console.log('🔧 数据库工具使用帮助:');
    console.log('  --wizard      启动配置向导');
    console.log('  --list        列出保存的配置');
    console.log('  --test        测试数据库连接');
    console.log('  --tables      列出所有表');
    console.log('  --describe    查看表结构');
    console.log('  --query       执行SQL查询');
    console.log('\n💡 使用 ats db --wizard 开始配置数据库连接');

  } catch (error) {
    throw error;
  }
}

module.exports = {
  startDatabase,
  DatabaseConnector,
  DatabaseConfig,
  ResultFormatter
};