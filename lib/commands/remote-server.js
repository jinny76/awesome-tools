const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const Table = require('cli-table3');
const readline = require('readline');
const crypto = require('crypto');

/**
 * RemoteServer - SSH隧道管理工具
 * 通过SSH端口转发，将远程服务器端口映射到本地
 */
class RemoteServer {
    constructor() {
        this.configPath = path.join(os.homedir(), '.awesome-tools', 'remote-servers.json');
        this.config = this.loadConfig();
        this.connections = new Map(); // 存储活跃的SSH连接
        this.tunnels = new Map(); // 存储活跃的隧道
        this.rl = null;
        this.stats = new Map(); // 流量统计
        this.encryptionKey = this.getEncryptionKey();
    }

    /**
     * 获取加密密钥
     */
    getEncryptionKey() {
        const keyPath = path.join(os.homedir(), '.awesome-tools', '.key');
        
        if (fs.existsSync(keyPath)) {
            return fs.readFileSync(keyPath, 'utf8');
        } else {
            // 生成新的加密密钥
            const key = crypto.randomBytes(32).toString('hex');
            const dir = path.dirname(keyPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(keyPath, key, { mode: 0o600 });
            return key;
        }
    }

    /**
     * 加密密码
     */
    encryptPassword(password) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * 解密密码
     */
    decryptPassword(encryptedPassword) {
        try {
            const parts = encryptedPassword.split(':');
            if (parts.length !== 2) return encryptedPassword; // 可能是未加密的旧密码
            
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const iv = Buffer.from(parts[0], 'hex');
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(parts[1], 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (err) {
            return encryptedPassword; // 解密失败，可能是未加密的旧密码
        }
    }

    /**
     * 加载配置文件
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            }
        } catch (error) {
            console.error('❌ 加载配置文件失败:', error.message);
        }
        
        // 默认配置
        return {
            servers: {},
            presets: {
                mysql: { remote: 3306, local: 3306, name: 'MySQL数据库' },
                postgres: { remote: 5432, local: 5432, name: 'PostgreSQL数据库' },
                redis: { remote: 6379, local: 6379, name: 'Redis缓存' },
                mongodb: { remote: 27017, local: 27017, name: 'MongoDB数据库' },
                elasticsearch: { remote: 9200, local: 9200, name: 'ElasticSearch' },
                rabbitmq: { remote: 5672, local: 5672, name: 'RabbitMQ消息队列' },
                kafka: { remote: 9092, local: 9092, name: 'Kafka消息队列' },
                nginx: { remote: 80, local: 8080, name: 'Nginx Web服务器' },
                api: { remote: 8080, local: 8080, name: 'API服务' },
                admin: { remote: 8090, local: 8090, name: '管理后台' }
            }
        };
    }

    /**
     * 保存配置文件
     */
    saveConfig() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            console.log('✅ 配置已保存');
        } catch (error) {
            console.error('❌ 保存配置失败:', error.message);
        }
    }

    /**
     * 主入口函数
     */
    async handleCommand(options = {}) {
        try {
            // 显示状态
            if (options.status) {
                return this.showStatus();
            }

            // 列出配置
            if (options.list) {
                return this.listConfigs();
            }

            // 停止所有隧道
            if (options.stop) {
                return this.stopAll();
            }


            // 交互式向导
            if (options.wizard) {
                return await this.startWizard();
            }

            // 添加服务器配置
            if (options.add) {
                return await this.addServerConfig(options);
            }

            // 连接到服务器
            if (options.connect) {
                return await this.connectToServer(options.connect, options);
            }

            // 快速连接预设
            const args = process.argv.slice(3);
            if (args.length > 0 && !args[0].startsWith('-')) {
                const target = args[0];
                
                // 检查是否是预设服务
                if (this.config.presets[target]) {
                    return await this.connectPreset(target, options);
                }
                
                // 检查是否是服务器配置
                if (this.config.servers[target]) {
                    return await this.connectToServer(target, options);
                }
                
                // 支持 server:service 格式
                if (target.includes(':')) {
                    const [server, service] = target.split(':');
                    return await this.connectToServer(server, { ...options, only: service });
                }
                
                console.log(`❌ 未找到配置: ${target}`);
                console.log('💡 使用 --list 查看可用配置，或使用 --wizard 创建新配置');
                return;
            }

            // 默认显示帮助
            this.showHelp();
            
        } catch (error) {
            console.error('❌ 错误:', error.message);
            if (error.stack && options.debug) {
                console.error(error.stack);
            }
        }
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        console.log('\n🌐 Remote Server - SSH端口转发工具');
        console.log('================================================================================');
        console.log('\n基础命令:');
        console.log('  ats rs --wizard              启动交互式配置向导');
        console.log('  ats rs --list                列出所有服务器和预设配置');
        console.log('  ats rs --status              显示当前活跃的隧道状态');
        console.log('  ats rs --stop                停止所有隧道');
        console.log('\n快速连接:');
        console.log('  ats rs mysql                 连接预设的MySQL端口 (3306)');
        console.log('  ats rs redis                 连接预设的Redis端口 (6379)');
        console.log('  ats rs dev                   连接dev服务器的所有端口');
        console.log('  ats rs dev:mysql             连接dev服务器的MySQL端口');
        console.log('\n服务器管理:');
        console.log('  ats rs --add <name>          添加新的服务器配置');
        console.log('  ats rs --connect <name>      连接到指定服务器');
        console.log('\n高级选项:');
        console.log('  --only <services>            只映射指定服务 (逗号分隔)');
        console.log('  --host <host>                临时指定服务器地址');
        console.log('  --port <port>                临时指定SSH端口 (默认: 22)');
        console.log('  --user <user>                临时指定用户名');
        console.log('  --key <path>                 临时指定SSH密钥路径');
        console.log('  --jump <host>                通过跳板机连接');
        console.log('  --background                 后台运行模式');
        console.log('  --auto-reconnect             断线自动重连');
        console.log('\n预设服务:');
        const presets = Object.entries(this.config.presets).slice(0, 5);
        presets.forEach(([key, preset]) => {
            console.log(`  ${key.padEnd(15)} ${preset.name} (远程:${preset.remote} -> 本地:${preset.local})`);
        });
        console.log('  ...更多预设请使用 --list 查看');
    }

    /**
     * 列出所有配置
     */
    listConfigs() {
        console.log('\n📋 配置列表');
        console.log('================================================================================');
        
        // 列出服务器配置
        const servers = Object.entries(this.config.servers);
        if (servers.length > 0) {
            console.log('\n📡 服务器配置:');
            const serverTable = new Table({
                head: ['名称', '主机', 'SSH端口', '用户', '端口映射', '跳板机'],
                colWidths: [15, 25, 10, 15, 25, 20]
            });
            
            servers.forEach(([name, config]) => {
                const ports = config.ports ? Object.keys(config.ports).join(', ') : '无';
                serverTable.push([
                    name,
                    config.host || '-',
                    config.port || 22,
                    config.user || '-',
                    ports,
                    config.jumpHost || '无'
                ]);
            });
            
            console.log(serverTable.toString());
        } else {
            console.log('\n📡 服务器配置: 无');
            console.log('💡 使用 --wizard 或 --add 添加服务器配置');
        }
        
        // 列出预设配置
        console.log('\n🎯 预设端口映射:');
        const presetTable = new Table({
            head: ['服务名称', '描述', '远程端口', '本地端口'],
            colWidths: [15, 25, 12, 12]
        });
        
        Object.entries(this.config.presets).forEach(([key, preset]) => {
            presetTable.push([
                key,
                preset.name || '-',
                preset.remote,
                preset.local
            ]);
        });
        
        console.log(presetTable.toString());
    }

    /**
     * 显示隧道状态
     */
    showStatus() {
        console.log('\n📊 隧道状态');
        console.log('================================================================================');
        
        if (this.tunnels.size === 0) {
            console.log('❌ 当前没有活跃的隧道');
            console.log('💡 使用 ats rs <服务名> 建立隧道');
            return;
        }
        
        const table = new Table({
            head: ['服务名称', '服务器', '远程端口', '本地端口', '状态', '流量', '持续时间'],
            colWidths: [15, 20, 12, 12, 10, 12, 15]
        });
        
        this.tunnels.forEach((tunnel, id) => {
            const stats = this.stats.get(id) || { bytes: 0, startTime: Date.now() };
            const duration = this.formatDuration(Date.now() - stats.startTime);
            const traffic = this.formatBytes(stats.bytes);
            
            table.push([
                tunnel.name || id,
                tunnel.server || 'localhost',
                tunnel.remotePort,
                tunnel.localPort,
                tunnel.status === 'active' ? '✅ 活跃' : '⏸️ 空闲',
                traffic,
                duration
            ]);
        });
        
        console.log(table.toString());
        
        // 显示连接信息
        console.log('\n💡 使用提示:');
        this.tunnels.forEach((tunnel) => {
            if (tunnel.name === 'MySQL数据库') {
                console.log(`  MySQL: mysql -h localhost -P ${tunnel.localPort}`);
            } else if (tunnel.name === 'Redis缓存') {
                console.log(`  Redis: redis-cli -p ${tunnel.localPort}`);
            } else if (tunnel.name === 'PostgreSQL数据库') {
                console.log(`  PostgreSQL: psql -h localhost -p ${tunnel.localPort}`);
            } else if (tunnel.name === 'API服务' || tunnel.name === 'Nginx Web服务器') {
                console.log(`  Web服务: http://localhost:${tunnel.localPort}`);
            }
        });
    }

    /**
     * 连接到预设服务
     */
    async connectPreset(presetName, options = {}) {
        const preset = this.config.presets[presetName];
        if (!preset) {
            console.log(`❌ 未找到预设: ${presetName}`);
            return;
        }
        
        console.log(`\n🔗 连接预设服务: ${preset.name || presetName}`);
        console.log('================================================================================');
        
        // 获取服务器信息（优先使用命令行参数，否则询问）
        let host = options.host;
        let port = options.port;
        let user = options.user;
        
        if (!host) {
            host = await this.askQuestion('请输入服务器地址: ');
        }
        
        if (!port) {
            port = await this.askQuestion('SSH端口 (默认: 22): ') || '22';
        }
        
        if (!user) {
            user = await this.askQuestion(`请输入用户名 (默认: ${os.userInfo().username}): `) || os.userInfo().username;
        }
        
        const password = await this.askQuestion(`请输入 ${user}@${host} 的密码: `);
        
        // 建立连接
        await this.createTunnel({
            host,
            port: parseInt(port),
            user,
            password,
            tunnels: [{
                name: preset.name || presetName,
                remotePort: preset.remote,
                localPort: preset.local
            }]
        }, options);
    }

    /**
     * 连接到服务器配置
     */
    async connectToServer(serverName, options = {}) {
        const serverConfig = this.config.servers[serverName];
        if (!serverConfig) {
            console.log(`❌ 未找到服务器配置: ${serverName}`);
            console.log('💡 使用 --add 添加服务器配置');
            return;
        }
        
        console.log(`\n🔗 连接到服务器: ${serverName}`);
        console.log('================================================================================');
        console.log(`📡 主机: ${serverConfig.host}:${serverConfig.port || 22}`);
        console.log(`👤 用户: ${serverConfig.user}`);
        
        // 准备隧道配置
        let tunnels = [];
        
        if (options.only) {
            // 只连接指定的服务
            const services = options.only.split(',');
            services.forEach(service => {
                if (serverConfig.ports && serverConfig.ports[service]) {
                    const port = serverConfig.ports[service];
                    tunnels.push({
                        name: this.config.presets[service]?.name || service,
                        remotePort: port.remote,
                        localPort: port.local
                    });
                } else if (this.config.presets[service]) {
                    const preset = this.config.presets[service];
                    tunnels.push({
                        name: preset.name || service,
                        remotePort: preset.remote,
                        localPort: preset.local
                    });
                }
            });
        } else if (serverConfig.ports) {
            // 连接所有配置的端口
            Object.entries(serverConfig.ports).forEach(([service, port]) => {
                tunnels.push({
                    name: this.config.presets[service]?.name || service,
                    remotePort: port.remote,
                    localPort: port.local
                });
            });
        } else {
            console.log('❌ 该服务器没有配置端口映射');
            return;
        }
        
        if (tunnels.length === 0) {
            console.log('❌ 没有找到要映射的端口');
            return;
        }
        
        console.log(`\n📍 端口映射:`);
        tunnels.forEach(t => {
            console.log(`  ${t.name}: ${t.remotePort} -> localhost:${t.localPort}`);
        });
        
        // 建立连接
        // 解密保存的密码
        let password = serverConfig.password;
        if (password) {
            password = this.decryptPassword(password);
        } else {
            password = await this.askQuestion(`请输入 ${serverConfig.user}@${serverConfig.host} 的密码: `);
        }

        await this.createTunnel({
            host: serverConfig.host,
            port: serverConfig.port || 22,
            user: serverConfig.user,
            password: password,
            jumpHost: serverConfig.jumpHost || options.jump,
            serverName: serverName,  // 传递服务器名称用于保存配置
            tunnels
        }, options);
    }

    /**
     * 创建SSH隧道
     */
    async createTunnel(config, options = {}) {
        return new Promise(async (resolve, reject) => {
            const conn = new Client();
            const tunnelId = `${config.host}_${Date.now()}`;
            
            // 连接配置
            const connConfig = {
                host: config.host,
                port: config.port || 22,
                username: config.user,
                keepaliveInterval: 30000,
                readyTimeout: 30000
            };
            
            // 使用密码认证
            if (config.password) {
                connConfig.password = config.password;
                console.log('🔐 使用密码认证');
            } else {
                console.log('❌ 未提供密码');
                reject(new Error('密码是必需的'));
                return;
            }
            
            // 处理跳板机
            if (config.jumpHost) {
                console.log(`🚀 通过跳板机连接: ${config.jumpHost}`);
                // TODO: 实现跳板机连接逻辑
            }
            
            conn.on('ready', async () => {
                console.log('✅ SSH连接成功');
                this.connections.set(tunnelId, conn);
                
                // 建立所有端口转发
                let completed = 0;
                const total = config.tunnels.length;
                
                config.tunnels.forEach(tunnel => {
                    this.forwardPort(conn, tunnel, tunnelId, (err) => {
                        if (err) {
                            console.error(`❌ 端口转发失败 (${tunnel.name}):`, err.message);
                        } else {
                            console.log(`✅ 端口转发成功: ${tunnel.name} (localhost:${tunnel.localPort})`);
                        }
                        
                        completed++;
                        if (completed === total) {
                            console.log('\n✅ 所有隧道已建立');
                            this.showUsageTips();
                            
                            if (!options.background) {
                                console.log('\n按 Ctrl+C 关闭所有隧道');
                                this.setupExitHandlers();
                            }
                            
                            resolve();
                        }
                    });
                });
            });
            
            conn.on('error', (err) => {
                console.error('❌ SSH连接错误:', err.message);
                
                if (err.message.includes('authentication')) {
                    console.log('\n💡 认证失败，请检查:');
                    console.log('  1. 用户名是否正确');
                    console.log('  2. SSH密钥是否正确');
                    console.log('  3. 服务器是否允许密钥认证');
                } else if (err.message.includes('ECONNREFUSED')) {
                    console.log('\n💡 连接被拒绝，请检查:');
                    console.log('  1. 服务器地址是否正确');
                    console.log(`  2. SSH端口是否正确 (当前: ${config.port || 22})`);
                    console.log('  3. SSH服务是否运行');
                    console.log('  4. 防火墙是否阻止连接');
                }
                
                reject(err);
            });
            
            conn.on('close', () => {
                console.log('🔌 SSH连接已关闭');
                this.connections.delete(tunnelId);
                
                // 清理相关隧道
                this.tunnels.forEach((tunnel, id) => {
                    if (id.startsWith(tunnelId)) {
                        this.tunnels.delete(id);
                    }
                });
                
                if (options.autoReconnect) {
                    console.log('🔄 尝试重新连接...');
                    setTimeout(() => {
                        this.createTunnel(config, options);
                    }, 5000);
                }
            });
            
            console.log(`\n🔐 正在连接到 ${config.host}...`);
            conn.connect(connConfig);
        });
    }


    /**
     * 端口转发
     */
    forwardPort(conn, tunnel, tunnelId, callback) {
        const server = net.createServer((clientSocket) => {
            conn.forwardOut(
                '127.0.0.1',
                tunnel.localPort,
                '127.0.0.1',
                tunnel.remotePort,
                (err, stream) => {
                    if (err) {
                        console.error(`❌ 转发失败:`, err.message);
                        clientSocket.end();
                        return;
                    }
                    
                    // 更新隧道状态
                    const tid = `${tunnelId}_${tunnel.localPort}`;
                    if (this.tunnels.has(tid)) {
                        this.tunnels.get(tid).status = 'active';
                    }
                    
                    // 双向管道
                    clientSocket.pipe(stream).pipe(clientSocket);
                    
                    // 流量统计
                    stream.on('data', (chunk) => {
                        const stats = this.stats.get(tid) || { bytes: 0, startTime: Date.now() };
                        stats.bytes += chunk.length;
                        this.stats.set(tid, stats);
                    });
                }
            );
        });
        
        // 检查端口是否可用
        this.checkPort(tunnel.localPort, async (available) => {
            if (!available) {
                console.log(`⚠️ 端口 ${tunnel.localPort} 已被占用，尝试自动分配...`);
                tunnel.localPort = await this.findAvailablePort(tunnel.localPort + 1);
                console.log(`🔄 改用端口: ${tunnel.localPort}`);
            }
            
            server.listen(tunnel.localPort, '127.0.0.1', () => {
                const tid = `${tunnelId}_${tunnel.localPort}`;
                this.tunnels.set(tid, {
                    ...tunnel,
                    server: tunnel.name,
                    status: 'idle'
                });
                
                this.stats.set(tid, {
                    bytes: 0,
                    startTime: Date.now()
                });
                
                callback(null);
            });
            
            server.on('error', callback);
        });
    }

    /**
     * 检查端口是否可用
     */
    checkPort(port, callback) {
        const server = net.createServer();
        server.once('error', (err) => {
            callback(false);
        });
        server.once('listening', () => {
            server.close();
            callback(true);
        });
        server.listen(port, '127.0.0.1');
    }

    /**
     * 查找可用端口
     */
    findAvailablePort(startPort) {
        let port = startPort;
        while (port < startPort + 100) {
            // 简单的同步检查（实际应该异步）
            port++;
            // TODO: 实现真正的端口检查
        }
        return port;
    }

    /**
     * 显示使用提示
     */
    showUsageTips() {
        console.log('\n💡 使用提示:');
        
        this.tunnels.forEach((tunnel) => {
            if (tunnel.name && tunnel.name.includes('MySQL')) {
                console.log(`  MySQL: mysql -h localhost -P ${tunnel.localPort} -u <username> -p`);
            } else if (tunnel.name && tunnel.name.includes('Redis')) {
                console.log(`  Redis: redis-cli -p ${tunnel.localPort}`);
            } else if (tunnel.name && tunnel.name.includes('PostgreSQL')) {
                console.log(`  PostgreSQL: psql -h localhost -p ${tunnel.localPort} -U <username>`);
            } else if (tunnel.name && tunnel.name.includes('MongoDB')) {
                console.log(`  MongoDB: mongosh --port ${tunnel.localPort}`);
            } else if (tunnel.name && (tunnel.name.includes('API') || tunnel.name.includes('Web') || tunnel.name.includes('Nginx'))) {
                console.log(`  Web服务: http://localhost:${tunnel.localPort}`);
            } else {
                console.log(`  ${tunnel.name || '服务'}: localhost:${tunnel.localPort}`);
            }
        });
    }

    /**
     * 交互式向导
     */
    async startWizard() {
        console.log('\n🔧 Remote Server 配置向导');
        console.log('================================================================================');
        console.log('欢迎使用SSH端口转发工具！');
        console.log('本向导将帮助您配置服务器连接和端口映射\n');
        
        const choice = await this.askQuestion(
            '请选择操作:\n' +
            '  1. 快速连接预设服务 (MySQL/Redis等)\n' +
            '  2. 添加新的服务器配置\n' +
            '  3. 连接已有服务器\n' +
            '  4. 查看配置列表\n' +
            '  0. 退出\n' +
            '请选择 (0-4): '
        );
        
        switch (choice) {
            case '1':
                return await this.wizardQuickConnect();
            case '2':
                return await this.wizardAddServer();
            case '3':
                return await this.wizardConnectServer();
            case '4':
                this.listConfigs();
                return await this.startWizard();
            case '0':
                console.log('👋 再见!');
                break;
            default:
                console.log('❌ 无效选择');
                return await this.startWizard();
        }
    }

    /**
     * 向导：快速连接
     */
    async wizardQuickConnect() {
        console.log('\n🎯 快速连接预设服务');
        console.log('────────────────────────────────────────');
        
        const presets = Object.entries(this.config.presets);
        presets.forEach(([key, preset], index) => {
            console.log(`  ${index + 1}. ${preset.name} (${key}) - 端口 ${preset.remote}`);
        });
        console.log('  0. 返回');
        
        const choice = await this.askQuestion(`\n请选择服务 (0-${presets.length}): `);
        const index = parseInt(choice) - 1;
        
        if (choice === '0') {
            return await this.startWizard();
        }
        
        if (index >= 0 && index < presets.length) {
            const [key] = presets[index];
            await this.connectPreset(key, {});
        } else {
            console.log('❌ 无效选择');
            return await this.wizardQuickConnect();
        }
    }

    /**
     * 向导：添加服务器
     */
    async wizardAddServer() {
        console.log('\n➕ 添加服务器配置');
        console.log('────────────────────────────────────────');
        
        const name = await this.askQuestion('配置名称 (如: dev, prod): ');
        if (!name) {
            console.log('❌ 名称不能为空');
            return await this.startWizard();
        }
        
        const host = await this.askQuestion('服务器地址: ');
        const port = await this.askQuestion('SSH端口 (默认: 22): ') || '22';
        const user = await this.askQuestion(`用户名 (默认: ${os.userInfo().username}): `) || os.userInfo().username;
        
        // 获取密码
        const password = await this.askQuestion('密码: ');
        
        // 询问是否保存密码
        const savePassword = await this.askQuestion('是否保存密码到配置? (Y/n): ');
        let encryptedPassword = null;
        if (savePassword.toLowerCase() !== 'n') {
            encryptedPassword = this.encryptPassword(password);
            console.log('🔒 密码已加密保存');
        }
        
        const jumpHost = await this.askQuestion('跳板机地址 (可选，直接回车跳过): ');
        
        // 配置端口映射
        const ports = {};
        console.log('\n配置端口映射 (输入服务名称，如: mysql, redis, api，输入空行结束)');
        
        while (true) {
            const service = await this.askQuestion('服务名称: ');
            if (!service) break;
            
            const preset = this.config.presets[service];
            let remotePort, localPort;
            
            if (preset) {
                console.log(`  使用预设: ${preset.name} (远程:${preset.remote} 本地:${preset.local})`);
                const usePreset = await this.askQuestion('使用预设配置? (Y/n): ');
                if (usePreset.toLowerCase() !== 'n') {
                    remotePort = preset.remote;
                    localPort = preset.local;
                }
            }
            
            if (!remotePort) {
                remotePort = parseInt(await this.askQuestion('  远程端口: '));
                localPort = parseInt(await this.askQuestion(`  本地端口 (默认: ${remotePort}): `) || remotePort);
            }
            
            ports[service] = { remote: remotePort, local: localPort };
        }
        
        // 保存配置
        this.config.servers[name] = {
            host,
            port: parseInt(port),
            user,
            password: encryptedPassword,
            jumpHost: jumpHost || undefined,
            ports
        };
        
        this.saveConfig();
        console.log(`\n✅ 服务器配置 "${name}" 已保存`);
        
        const connect = await this.askQuestion('立即连接? (Y/n): ');
        if (connect.toLowerCase() !== 'n') {
            // 使用当前输入的密码进行连接
            const tunnels = Object.entries(ports).map(([serviceName, portConfig]) => ({
                name: this.config.presets[serviceName]?.name || serviceName,
                remotePort: portConfig.remote,
                localPort: portConfig.local
            }));

            await this.createTunnel({
                host,
                port: parseInt(port),
                user,
                password,
                jumpHost: jumpHost || undefined,
                tunnels
            }, {});
        }
        
        return await this.startWizard();
    }

    /**
     * 向导：连接服务器
     */
    async wizardConnectServer() {
        const servers = Object.keys(this.config.servers);
        
        if (servers.length === 0) {
            console.log('\n❌ 还没有服务器配置');
            const add = await this.askQuestion('是否添加服务器配置? (Y/n): ');
            if (add.toLowerCase() !== 'n') {
                return await this.wizardAddServer();
            }
            return await this.startWizard();
        }
        
        console.log('\n📡 选择服务器');
        console.log('────────────────────────────────────────');
        
        servers.forEach((name, index) => {
            const config = this.config.servers[name];
            const portCount = config.ports ? Object.keys(config.ports).length : 0;
            const sshPort = config.port || 22;
            console.log(`  ${index + 1}. ${name} (${config.host}:${sshPort}) - ${portCount} 个端口映射`);
        });
        console.log('  0. 返回');
        
        const choice = await this.askQuestion(`\n请选择 (0-${servers.length}): `);
        const index = parseInt(choice) - 1;
        
        if (choice === '0') {
            return await this.startWizard();
        }
        
        if (index >= 0 && index < servers.length) {
            await this.connectToServer(servers[index], {});
        } else {
            console.log('❌ 无效选择');
            return await this.wizardConnectServer();
        }
    }

    /**
     * 停止所有隧道
     */
    stopAll() {
        console.log('\n🛑 停止所有隧道...');
        
        // 关闭所有连接
        this.connections.forEach((conn, id) => {
            conn.end();
            console.log(`  关闭连接: ${id}`);
        });
        
        // 清理
        this.connections.clear();
        this.tunnels.clear();
        this.stats.clear();
        
        console.log('✅ 所有隧道已停止');
    }

    /**
     * 设置退出处理
     */
    setupExitHandlers() {
        process.on('SIGINT', () => {
            console.log('\n\n🛑 正在关闭隧道...');
            this.stopAll();
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            this.stopAll();
            process.exit(0);
        });
    }

    /**
     * 询问用户输入
     */
    async askQuestion(question, hidden = false) {
        // 简化密码输入，直接使用可见输入，支持复制粘贴
        if (!this.rl) {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }
        
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }


    /**
     * 查找可用端口
     */
    async findAvailablePort(startPort) {
        return new Promise((resolve) => {
            const testServer = net.createServer();
            
            const tryPort = (port) => {
                testServer.listen(port, 'localhost', () => {
                    testServer.close(() => {
                        resolve(port);
                    });
                });
                
                testServer.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        tryPort(port + 1);
                    } else {
                        resolve(port);
                    }
                });
            };
            
            tryPort(startPort);
        });
    }

    /**
     * 检查命令是否存在
     */
    commandExists(command) {
        const { execSync } = require('child_process');
        try {
            const checkCmd = process.platform === 'win32' 
                ? `where ${command} >nul 2>&1`
                : `which ${command} >/dev/null 2>&1`;
            execSync(checkCmd);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }

    /**
     * 格式化时长
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    }
}

/**
 * 导出函数
 */
async function handleRemoteServerCommand(options = {}) {
    const remoteServer = new RemoteServer();
    await remoteServer.handleCommand(options);
}

module.exports = {
    RemoteServer,
    handleRemoteServerCommand
};