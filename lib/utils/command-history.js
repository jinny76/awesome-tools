const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 命令历史记录管理器
 */
class CommandHistory {
    constructor() {
        this.historyDir = path.join(os.homedir(), '.awesome-tools');
        this.historyFile = path.join(this.historyDir, 'command-history.json');
        this.maxHistoryCount = 20; // 每个命令最多保存20条记录
        this.ensureHistoryDir();
    }

    /**
     * 确保历史记录目录存在
     */
    ensureHistoryDir() {
        if (!fs.existsSync(this.historyDir)) {
            fs.mkdirSync(this.historyDir, { recursive: true });
        }
    }

    /**
     * 读取历史记录
     */
    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const content = fs.readFileSync(this.historyFile, 'utf8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.warn('读取命令历史记录失败:', error.message);
        }
        return {};
    }

    /**
     * 保存历史记录
     */
    saveHistory(history) {
        try {
            fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
        } catch (error) {
            console.warn('保存命令历史记录失败:', error.message);
        }
    }

    /**
     * 记录命令执行
     */
    recordCommand(commandName, args, options) {
        const history = this.loadHistory();
        
        if (!history[commandName]) {
            history[commandName] = [];
        }

        // 创建命令记录
        const record = {
            timestamp: new Date().toISOString(),
            args: args || [],
            options: options || {},
            command: this.buildCommandString(commandName, args, options)
        };

        // 添加到历史记录开头
        history[commandName].unshift(record);

        // 限制历史记录数量
        if (history[commandName].length > this.maxHistoryCount) {
            history[commandName] = history[commandName].slice(0, this.maxHistoryCount);
        }

        this.saveHistory(history);
    }

    /**
     * 获取指定命令的历史记录
     */
    getCommandHistory(commandName) {
        const history = this.loadHistory();
        return history[commandName] || [];
    }

    /**
     * 构建完整的命令字符串
     */
    buildCommandString(commandName, args, options) {
        let cmd = commandName;
        
        // 添加参数
        if (args && args.length > 0) {
            cmd += ' ' + args.join(' ');
        }

        // 添加选项
        if (options) {
            Object.entries(options).forEach(([key, value]) => {
                if (value === true) {
                    cmd += ` --${key}`;
                } else if (value !== false && value !== undefined) {
                    // 如果值包含空格，用引号包围
                    const valueStr = String(value);
                    if (valueStr.includes(' ')) {
                        cmd += ` --${key} "${valueStr}"`;
                    } else {
                        cmd += ` --${key} ${valueStr}`;
                    }
                }
            });
        }

        return cmd;
    }

    /**
     * 显示命令帮助和历史记录
     */
    showCommandHelp(commandName, commandDescription, commandOptions = []) {
        console.log(`\n📖 ${commandName} 命令帮助:`);
        console.log(`   ${commandDescription}\n`);

        // 显示可用选项
        if (commandOptions.length > 0) {
            console.log('可用选项:');
            commandOptions.forEach(option => {
                console.log(`   ${option.flags.padEnd(20)} ${option.description}`);
            });
            console.log();
        }

        // 显示历史命令
        const history = this.getCommandHistory(commandName);
        if (history.length > 0) {
            console.log('📚 最近使用的命令:');
            history.forEach((record, index) => {
                const date = new Date(record.timestamp).toLocaleString('zh-CN');
                console.log(`   ${(index + 1).toString().padStart(2)}: ${record.command}`);
                console.log(`       (${date})`);
            });
            console.log('\n💡 输入命令编号快速执行，例如: awesome-tools <command> <number>');
        } else {
            console.log('暂无历史命令记录');
        }
    }

    /**
     * 根据编号获取历史命令
     */
    getCommandByNumber(commandName, number) {
        const history = this.getCommandHistory(commandName);
        const index = parseInt(number) - 1;
        
        if (index >= 0 && index < history.length) {
            return history[index];
        }
        
        return null;
    }

    /**
     * 清理过期的历史记录 (可选功能)
     */
    cleanOldHistory(daysToKeep = 30) {
        const history = this.loadHistory();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        let cleaned = false;
        Object.keys(history).forEach(commandName => {
            const originalLength = history[commandName].length;
            history[commandName] = history[commandName].filter(record => {
                return new Date(record.timestamp) >= cutoffDate;
            });
            
            if (history[commandName].length !== originalLength) {
                cleaned = true;
            }
        });

        if (cleaned) {
            this.saveHistory(history);
        }

        return cleaned;
    }
}

module.exports = CommandHistory;