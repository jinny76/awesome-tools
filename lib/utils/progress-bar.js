const readline = require('readline');

/**
 * 进度条显示工具
 */
class ProgressBar {
    constructor(options = {}) {
        this.width = options.width || 40;
        this.completeChar = options.completeChar || '█';
        this.incompleteChar = options.incompleteChar || '▒';
        this.showPercentage = options.showPercentage !== false;
        this.showSpeed = options.showSpeed !== false;
        this.showTime = options.showTime !== false;
        this.showSize = options.showSize !== false;
        
        this.startTime = Date.now();
        this.lastUpdateTime = Date.now();
    }

    /**
     * 渲染下载进度条
     */
    renderDownloadProgress(data) {
        const { progress, downloaded, total, speed, remaining } = data;
        
        const percentage = Math.min(Math.max(progress || 0, 0), 100);
        const completed = Math.min(Math.max(0, Math.floor(percentage / 100 * this.width)), this.width);
        const incomplete = Math.max(0, this.width - completed);
        
        const progressBar = this.completeChar.repeat(completed) + this.incompleteChar.repeat(incomplete);
        
        let output = `📦 下载进度: ${progressBar}`;
        
        if (this.showPercentage) {
            output += ` ${percentage.toFixed(1)}%`;
        }
        
        if (this.showSize && total > 0) {
            output += ` (${this.formatBytes(downloaded)}/${this.formatBytes(total)})`;
        }
        
        if (this.showSpeed && speed > 0) {
            output += `\n速度: ${this.formatBytes(speed)}/s 🚀`;
        }
        
        if (this.showTime && remaining > 0) {
            output += ` | 剩余时间: ${this.formatTime(remaining)} ⏱️`;
        }
        
        const elapsed = (Date.now() - this.startTime) / 1000;
        if (this.showTime) {
            output += `\n已用时间: ${this.formatTime(elapsed)}`;
        }
        
        this.updateDisplay(output);
    }

    /**
     * 渲染转换进度条
     */
    renderConversionProgress(data) {
        const { 
            percentage = 0, 
            currentFrame = 0, 
            totalFrames = 0, 
            fps = 0, 
            speed = 0, 
            currentTime = '', 
            totalDuration = '', 
            outputSize = 0,
            bitrate = 0 
        } = data;
        
        // 确保percentage在0-100范围内
        const safePercentage = Math.min(Math.max(percentage || 0, 0), 100);
        const completed = Math.min(Math.max(0, Math.floor(safePercentage / 100 * this.width)), this.width);
        const incomplete = Math.max(0, this.width - completed);
        const progressBar = this.completeChar.repeat(completed) + this.incompleteChar.repeat(incomplete);
        
        let output = `🎬 转换进度: ${progressBar} ${safePercentage.toFixed(1)}%`;
        
        if (totalFrames > 0) {
            output += ` (${currentFrame}/${totalFrames}帧)`;
        }
        
        if (currentTime && totalDuration) {
            output += `\n时间: ${currentTime} / ${totalDuration}`;
        }
        
        if (speed > 0) {
            const remaining = totalDuration ? this.calculateRemainingTime(currentTime, totalDuration, speed) : 0;
            output += ` | 剩余: ${this.formatTime(remaining)}`;
        }
        
        if (fps > 0 || speed > 0) {
            output += `\n性能: `;
            if (fps > 0) output += `${fps.toFixed(1)} fps`;
            if (speed > 0) output += ` | ${speed.toFixed(1)}x 实时速度 🚀`;
        }
        
        if (outputSize > 0) {
            output += `\n文件: ${this.formatBytes(outputSize)} 💾`;
        }
        
        if (bitrate > 0) {
            output += ` | ${Math.round(bitrate)} kbps`;
        }
        
        this.updateDisplay(output);
    }

    /**
     * 渲染批量处理进度
     */
    renderBatchProgress(data) {
        const { 
            currentFile = 0, 
            totalFiles = 0, 
            currentFileName = '', 
            fileProgress = 0,
            overallProgress = 0,
            completed = [],
            failed = []
        } = data;
        
        const completed_overall = Math.min(Math.max(0, Math.floor(overallProgress / 100 * this.width)), this.width);
        const incomplete_overall = Math.max(0, this.width - completed_overall);
        const overallBar = this.completeChar.repeat(completed_overall) + this.incompleteChar.repeat(incomplete_overall);
        
        const completed_file = Math.min(Math.max(0, Math.floor(fileProgress / 100 * this.width)), this.width);
        const incomplete_file = Math.max(0, this.width - completed_file);
        const fileBar = this.completeChar.repeat(completed_file) + this.incompleteChar.repeat(incomplete_file);
        
        let output = `📦 批量转换进度 (${currentFile}/${totalFiles} 个文件)\n`;
        output += `总体: ${overallBar} ${overallProgress.toFixed(1)}%\n`;
        
        if (currentFileName) {
            output += `当前: ${currentFileName}\n`;
            output += `文件: ${fileBar} ${fileProgress.toFixed(1)}%`;
        }
        
        if (completed.length > 0 || failed.length > 0) {
            output += `\n\n状态: ✅ 完成 ${completed.length} | ❌ 失败 ${failed.length}`;
            if (failed.length > 0) {
                output += ` | 🎯 成功率 ${((completed.length / (completed.length + failed.length)) * 100).toFixed(1)}%`;
            }
        }
        
        this.updateDisplay(output);
    }

    /**
     * 渲染流服务器状态
     */
    renderStreamStatus(data) {
        const { 
            activeStreams = 0, 
            totalViewers = 0, 
            uptime = 0,
            bandwidth = { upload: 0, download: 0 },
            streams = []
        } = data;
        
        let output = `📡 流服务器状态\n`;
        output += `════════════════════════════════════════\n`;
        output += `🟢 运行时长: ${this.formatTime(uptime)} | 🎥 活跃流: ${activeStreams} | 👥 观众: ${totalViewers}\n`;
        output += `⬆️ 上传: ${this.formatBytes(bandwidth.upload)}/s | ⬇️ 下载: ${this.formatBytes(bandwidth.download)}/s\n`;
        
        if (streams.length > 0) {
            output += `\n热门流:\n`;
            streams.slice(0, 3).forEach((stream, index) => {
                output += `  ${index + 1}. ${stream.name} (${stream.viewers} 观众, ${this.formatBytes(stream.bitrate * 1000)}/s)\n`;
            });
        }
        
        this.updateDisplay(output, false); // 流状态不清除屏幕
    }

    /**
     * 更新显示
     */
    updateDisplay(text, clearScreen = true) {
        if (clearScreen) {
            // 清除之前的输出
            process.stdout.write('\x1B[2K'); // 清除当前行
            const lines = text.split('\n').length;
            for (let i = 0; i < lines - 1; i++) {
                process.stdout.write('\x1B[1A\x1B[2K'); // 上移一行并清除
            }
        }
        
        process.stdout.write(`\r${text}`);
        this.lastUpdateTime = Date.now();
    }

    /**
     * 完成进度显示
     */
    complete(message) {
        process.stdout.write('\n');
        if (message) {
            console.log(message);
        }
    }

    /**
     * 格式化字节大小
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * 格式化时间
     */
    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.floor(seconds)}秒`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 计算剩余时间
     */
    calculateRemainingTime(currentTime, totalDuration, speed) {
        // 简单的时间字符串解析 (HH:MM:SS 或 MM:SS)
        const parseDuration = (timeStr) => {
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            }
            return 0;
        };
        
        const current = parseDuration(currentTime);
        const total = parseDuration(totalDuration);
        
        if (current > 0 && total > 0 && speed > 0) {
            const remaining = (total - current) / speed;
            return Math.max(0, remaining);
        }
        
        return 0;
    }

    /**
     * 创建动态进度指示器 (用于不确定进度的任务)
     */
    createSpinner(message = '处理中') {
        const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let index = 0;
        
        const spinner = setInterval(() => {
            process.stdout.write(`\r${spinnerChars[index]} ${message}...`);
            index = (index + 1) % spinnerChars.length;
        }, 100);
        
        return {
            stop: (finalMessage) => {
                clearInterval(spinner);
                process.stdout.write('\r');
                if (finalMessage) {
                    console.log(finalMessage);
                }
            },
            updateMessage: (newMessage) => {
                message = newMessage;
            }
        };
    }
}

/**
 * 简化的进度条创建函数
 */
function createProgressBar(type = 'default', options = {}) {
    return new ProgressBar(options);
}

/**
 * 创建下载进度条
 */
function createDownloadProgress(onProgress) {
    const progressBar = new ProgressBar();
    
    return (data) => {
        progressBar.renderDownloadProgress(data);
        if (onProgress) onProgress(data);
    };
}

/**
 * 创建转换进度条
 */
function createConversionProgress(onProgress) {
    const progressBar = new ProgressBar();
    
    return (data) => {
        progressBar.renderConversionProgress(data);
        if (onProgress) onProgress(data);
    };
}

module.exports = {
    ProgressBar,
    createProgressBar,
    createDownloadProgress,
    createConversionProgress
};