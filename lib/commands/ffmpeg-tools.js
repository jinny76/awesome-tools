const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const readline = require('readline');
const FFmpegManager = require('../utils/ffmpeg-manager');
const { createProgressBar, createDownloadProgress, createConversionProgress } = require('../utils/progress-bar');

/**
 * FFmpeg工具主命令处理器
 */
class FFmpegTools {
    constructor() {
        this.ffmpegManager = new FFmpegManager();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * 主入口函数 - 处理FFmpeg相关命令
     */
    async handleFFmpegCommand(options = {}) {
        try {
            // 优先处理不需要FFmpeg的管理命令
            if (options.status) {
                return await this.showStatus();
            }
            
            if (options.uninstall) {
                return await this.uninstallFFmpeg();
            }
            
            // 检查FFmpeg可用性
            const status = await this.ffmpegManager.checkFFmpegAvailability();
            
            // 如果是更新/重装命令，直接执行
            if (options.update || options.reinstall) {
                return await this.updateFFmpeg();
            }
            
            // 如果是安装命令，直接安装
            if (options.install) {
                return await this.installFFmpeg();
            }
            
            // 如果FFmpeg不可用，自动进入安装流程
            if (!status.available) {
                console.log('\n🎬 FFmpeg 工具初始化');
                console.log('================================================================================');
                console.log('❌ 检测到 FFmpeg 未安装');
                console.log('🚀 FFmpeg是音视频处理的核心工具，需要先安装才能使用转换功能');
                console.log('📦 将自动为您下载和安装 FFmpeg...\n');
                
                // 显示下载信息
                const downloadInfo = this.ffmpegManager.downloadSources;
                if (downloadInfo) {
                    console.log(`💻 检测到系统: ${process.platform} ${process.arch}`);
                    console.log(`📦 下载大小: 约 ${Math.round(downloadInfo.size / 1024 / 1024)} MB`);
                    console.log(`📍 安装位置: ${this.ffmpegManager.ffmpegDir}`);
                }
                
                const shouldInstall = await this.askQuestion('\n是否现在自动安装 FFmpeg? (Y/n): ');
                
                if (shouldInstall.toLowerCase() === 'n' || shouldInstall.toLowerCase() === 'no') {
                    console.log('\n⏸️  安装已跳过。您可以稍后使用以下命令安装:');
                    console.log('   awesome-tools ffmpeg --install   # 直接安装');
                    console.log('   awesome-tools ffmpeg --wizard    # 向导安装');
                    console.log('   awesome-tools ffmpeg --status    # 检查状态');
                    return;
                }
                
                // 执行自动安装
                try {
                    await this.installFFmpeg(true); // 传入 true 表示自动安装模式
                    console.log('\n🎉 FFmpeg 安装完成！现在可以使用所有音视频功能了。');
                    
                    // 安装成功后，如果用户指定了其他操作，继续执行
                    if (options.wizard || options.w) {
                        console.log('\n继续启动转换向导...');
                        return await this.startWizard();
                    }
                    
                    if (options.convert) {
                        console.log('\n继续执行转换任务...');
                        return await this.handleConversion(options);
                    }
                    
                    // 默认显示可用功能提示
                    console.log('\n💡 FFmpeg 已就绪！尝试以下命令开始使用:');
                    console.log('   awesome-tools ffmpeg --wizard      # 启动交互式向导');
                    console.log('   awesome-tools ffmpeg --convert <文件>  # 直接转换文件');
                    console.log('   awesome-tools ffmpeg --help        # 查看所有选项');
                    return;
                    
                } catch (installError) {
                    console.error(`\n❌ 自动安装失败: ${installError.message}`);
                    console.log('\n🔧 解决方案:');
                    console.log('1. 检查网络连接是否正常');
                    console.log('2. 稍后重试: awesome-tools ffmpeg --install');
                    console.log('3. 使用代理或手动下载: https://ffmpeg.org/download.html');
                    console.log('4. 使用环境变量指定现有FFmpeg: AWESOME_TOOLS_FFMPEG_PATH');
                    return;
                }
            }
            
            // FFmpeg已可用，处理各种功能命令
            if (options.wizard || options.w) {
                return await this.startWizard();
            }
            
            if (options.convert) {
                return await this.handleConversion(options);
            }
            
            if (options.stream) {
                return await this.handleStreaming(options);
            }
            
            if (options.batch) {
                return await this.batchConversionWizard();
            }
            
            // 没有指定特定命令，显示状态和帮助
            await this.showQuickStatus();
            this.showHelp();
            
        } catch (error) {
            console.error(`❌ 错误: ${error.message}`);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    /**
     * 显示快速状态（简化版）
     */
    async showQuickStatus() {
        try {
            const status = await this.ffmpegManager.checkFFmpegAvailability();
            console.log('\n🎬 FFmpeg 状态');
            console.log('================================================================================');
            if (status.available) {
                console.log(`✅ FFmpeg 已就绪 (版本: ${status.version.version})`);
                console.log(`📍 路径: ${status.path}`);
                console.log('🎯 所有音视频功能可用');
            } else {
                console.log('❌ FFmpeg 未安装');
                console.log('💡 使用 --wizard 启动安装向导');
            }
        } catch (error) {
            console.log(`⚠️ 状态检查失败: ${error.message}`);
        }
    }

    /**
     * 显示FFmpeg状态
     */
    async showStatus() {
        console.log('\n🔍 FFmpeg 状态检查');
        console.log('================================================================================');
        
        const spinner = createProgressBar().createSpinner('检查FFmpeg状态');
        
        try {
            const status = await this.ffmpegManager.getFFmpegStatus();
            spinner.stop();
            
            if (status.installed) {
                console.log('✅ FFmpeg 已安装并可用');
                console.log(`📍 安装位置: ${status.path}`);
                console.log(`📋 版本信息: ${status.version.version}`);
                console.log(`🏗️  构建信息: ${status.version.buildInfo}`);
                console.log(`💻 系统平台: ${status.platform}`);
                console.log(`🏠 本地安装: ${status.isLocal ? '是' : '否'}`);
                
                if (status.codecs) {
                    console.log(`\n🎥 支持的视频编解码器: ${status.codecs.video.join(', ')}`);
                    console.log(`🎵 支持的音频编解码器: ${status.codecs.audio.join(', ')}`);
                }
                
                console.log('\n可用操作:');
                console.log('  awesome-tools ffmpeg --update      更新到最新版本');
                console.log('  awesome-tools ffmpeg --wizard      启动转换向导');
                console.log('  awesome-tools ffmpeg --uninstall   卸载FFmpeg');
                
            } else {
                console.log('❌ FFmpeg 未安装或不可用');
                console.log(`💻 系统平台: ${status.platform}`);
                console.log(`📦 预计下载大小: ${Math.round(status.downloadSize / 1024 / 1024)} MB`);
                
                console.log('\n可用操作:');
                console.log('  awesome-tools ffmpeg --wizard      启动安装向导');
                console.log('  awesome-tools ffmpeg --install     直接安装FFmpeg');
            }
            
        } catch (error) {
            spinner.stop(`❌ 状态检查失败: ${error.message}`);
        }
    }

    /**
     * 提示用户安装FFmpeg
     */
    async promptInstallation() {
        console.log('\n🎬 FFmpeg 转换工具初始化');
        console.log('================================================================================');
        console.log('❌ 未找到 FFmpeg');
        console.log('🔍 检查位置:');
        console.log('   - 系统 PATH: ❌ 未找到');
        console.log(`   - 用户目录: ❌ ${this.ffmpegManager.ffmpegDir}`);
        
        console.log('\n📦 需要下载 FFmpeg 才能继续使用转换功能\n');
        
        const answer = await this.askQuestion(
            '是否现在下载并安装 FFmpeg? (y/N): '
        );
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            return await this.installFFmpeg();
        } else {
            console.log('⏸️  安装已取消。您可以稍后使用以下命令安装:');
            console.log('   awesome-tools ffmpeg --wizard');
        }
    }

    /**
     * 安装FFmpeg
     */
    async installFFmpeg(autoStart = false) {
        console.log('\n📦 开始下载 FFmpeg...');
        
        try {
            const progressCallback = createDownloadProgress();
            
            const result = await this.ffmpegManager.downloadFFmpeg(progressCallback);
            
            console.log('\n✅ FFmpeg 安装完成!');
            console.log(`📍 安装路径: ${result.path}`);
            console.log(`📋 版本: ${result.version.version}`);
            
            // 如果不是自动安装模式，询问是否启动向导
            if (!autoStart) {
                const startWizard = await this.askQuestion('\n是否现在启动转换向导? (Y/n): ');
                if (startWizard.toLowerCase() !== 'n' && startWizard.toLowerCase() !== 'no') {
                    return await this.startWizard();
                }
            }
            
            return result;
            
        } catch (error) {
            console.error(`\n❌ 安装失败: ${error.message}`);
            console.log('\n解决方案:');
            console.log('1. 检查网络连接');
            console.log('2. 稍后重试: awesome-tools ffmpeg --install');
            console.log('3. 手动下载FFmpeg并使用环境变量 AWESOME_TOOLS_FFMPEG_PATH 指定路径');
            throw error; // 重新抛出错误供上层处理
        }
    }

    /**
     * 更新FFmpeg
     */
    async updateFFmpeg() {
        console.log('\n🔄 更新 FFmpeg');
        console.log('================================================================================');
        
        try {
            const progressCallback = createDownloadProgress();
            await this.ffmpegManager.repairFFmpeg(progressCallback);
            console.log('✅ FFmpeg 更新完成!');
        } catch (error) {
            console.error(`❌ 更新失败: ${error.message}`);
        }
    }

    /**
     * 卸载FFmpeg
     */
    async uninstallFFmpeg() {
        const confirm = await this.askQuestion('确认卸载 FFmpeg? 这将删除本地安装的文件 (y/N): ');
        
        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            const success = await this.ffmpegManager.uninstallFFmpeg();
            if (success) {
                console.log('✅ FFmpeg 已成功卸载');
            } else {
                console.log('ℹ️  未找到需要卸载的FFmpeg安装');
            }
        }
    }

    /**
     * 启动交互式向导
     */
    async startWizard() {
        // 首先检查FFmpeg可用性
        const status = await this.ffmpegManager.checkFFmpegAvailability();
        
        if (!status.available) {
            console.log('\n🎬 FFmpeg 格式转换向导');
            console.log('================================================================================');
            console.log('❌ FFmpeg 未安装或不可用');
            console.log('🚀 向导需要FFmpeg支持才能进行音视频转换\n');
            
            const shouldInstall = await this.askQuestion('是否现在安装 FFmpeg? (Y/n): ');
            if (shouldInstall.toLowerCase() === 'n' || shouldInstall.toLowerCase() === 'no') {
                console.log('⏸️  向导已退出。请先安装FFmpeg后重试。');
                return;
            }
            
            try {
                await this.installFFmpeg(true);
                console.log('✅ FFmpeg安装成功！继续启动向导...\n');
            } catch (error) {
                console.error('❌ FFmpeg安装失败，无法继续使用向导。');
                return;
            }
        }
        
        console.log('\n🎬 FFmpeg 格式转换向导');
        console.log('================================================================================');
        console.log('欢迎使用 Awesome Tools FFmpeg 转换器！');
        console.log('本向导将帮助您轻松完成音视频格式转换\n');
        
        // 检查当前目录的媒体文件
        const mediaFiles = this.scanMediaFiles('.');
        
        console.log('请选择您要执行的操作:');
        console.log('  1. 📹 视频格式转换');
        console.log('  2. 🎵 音频格式转换');
        console.log('  3. 🔊 从视频提取音频');
        console.log('  4. 📦 批量文件转换');
        console.log('  5. 🗜️ 压缩视频文件');
        console.log('  6. 📡 流媒体服务');
        console.log('  7. ℹ️ 查看文件信息');
        console.log('  0. 退出\n');
        
        const choice = await this.askQuestion('请输入选项 (0-7): ');
        
        switch (choice) {
            case '1':
                return await this.videoConversionWizard(mediaFiles);
            case '2':
                return await this.audioConversionWizard(mediaFiles);
            case '3':
                return await this.audioExtractionWizard(mediaFiles);
            case '4':
                return await this.batchConversionWizard();
            case '5':
                return await this.compressionWizard(mediaFiles);
            case '6':
                return await this.streamingWizard();
            case '7':
                return await this.fileInfoWizard(mediaFiles);
            case '0':
                console.log('👋 再见!');
                break;
            default:
                console.log('❌ 无效选择');
                return await this.startWizard();
        }
    }

    /**
     * 视频转换向导
     */
    async videoConversionWizard(mediaFiles) {
        console.log('\n📹 视频格式转换');
        console.log('================================================================================');
        
        // 显示可用的视频文件
        const videoFiles = mediaFiles.filter(f => this.isVideoFile(f.name));
        
        if (videoFiles.length > 0) {
            console.log('检测到的视频文件:');
            videoFiles.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.name} (${this.formatBytes(file.size)})`);
            });
            console.log(`  ${videoFiles.length + 1}. 输入自定义路径`);
        }
        
        const fileChoice = await this.askQuestion(`请选择文件 (1-${videoFiles.length + 1}): `);
        const fileIndex = parseInt(fileChoice) - 1;
        
        let inputFile;
        if (fileIndex >= 0 && fileIndex < videoFiles.length) {
            inputFile = videoFiles[fileIndex].name;
        } else {
            inputFile = await this.askQuestion('请输入视频文件路径: ');
        }
        
        if (!fs.existsSync(inputFile)) {
            console.log('❌ 文件不存在');
            return;
        }
        
        // 选择输出格式
        console.log('\n🎯 选择输出格式:');
        console.log('  1. MP4 (推荐) - 兼容性最好，适合网页和移动设备');
        console.log('  2. MKV - 支持更多音轨和字幕');
        console.log('  3. WEBM - 适合网页播放');
        console.log('  4. AVI - 传统格式');
        console.log('  5. MOV - Apple 设备优化');
        console.log('  6. FLV - Flash视频格式');
        
        const formatChoice = await this.askQuestion('请选择格式 (1-6): ');
        const formats = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv'];
        const outputFormat = formats[parseInt(formatChoice) - 1] || 'mp4';
        
        // 质量设置
        console.log('\n⚙️ 视频质量设置:');
        console.log('  1. 🏆 高质量 (接近原画质，文件较大)');
        console.log('  2. ⚖️ 平衡模式 (推荐，质量与大小平衡)');
        console.log('  3. 📱 移动优化 (适合手机，文件较小)');
        console.log('  4. 🗜️ 高压缩 (最小文件，质量一般)');
        console.log('  5. 🛠️ 自定义设置');
        
        const qualityChoice = await this.askQuestion('请选择质量 (1-5): ');
        
        // 构建输出文件名
        const inputPath = path.parse(inputFile);
        const outputFile = path.join(inputPath.dir, `${inputPath.name}_converted.${outputFormat}`);
        
        // 执行转换
        const conversionOptions = this.getConversionOptions(qualityChoice, outputFormat);
        console.log(`\n🎬 开始转换: ${inputFile} → ${outputFile}`);
        
        await this.executeConversion(inputFile, outputFile, conversionOptions);
    }

    /**
     * 执行视频转换
     */
    async executeConversion(inputFile, outputFile, options = []) {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', inputFile,
                ...options,
                '-y', // 覆盖输出文件
                outputFile
            ];
            
            console.log(`执行命令: ffmpeg ${args.join(' ')}`);
            
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, args);
            const progressBar = createProgressBar();
            
            let duration = 0;
            let currentTime = 0;
            
            // 监听stderr获取进度信息
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                
                // 解析总时长
                const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}.\d{2})/);
                if (durationMatch && duration === 0) {
                    const hours = parseInt(durationMatch[1]);
                    const minutes = parseInt(durationMatch[2]);
                    const seconds = parseFloat(durationMatch[3]);
                    duration = hours * 3600 + minutes * 60 + seconds;
                }
                
                // 解析当前进度
                const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}.\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    currentTime = hours * 3600 + minutes * 60 + seconds;
                }
                
                // 解析其他信息
                const frameMatch = output.match(/frame=\s*(\d+)/);
                const fpsMatch = output.match(/fps=\s*([\d.]+)/);
                const speedMatch = output.match(/speed=\s*([\d.]+)x/);
                const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits\/s/);
                const sizeMatch = output.match(/size=\s*(\d+)kB/);
                
                if (duration > 0 && currentTime > 0) {
                    const percentage = Math.min((currentTime / duration) * 100, 100);
                    const progressData = {
                        percentage: percentage,
                        currentFrame: frameMatch ? parseInt(frameMatch[1]) : 0,
                        fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
                        speed: speedMatch ? parseFloat(speedMatch[1]) : 0,
                        currentTime: this.formatTime(currentTime),
                        totalDuration: this.formatTime(duration),
                        outputSize: sizeMatch ? parseInt(sizeMatch[1]) * 1024 : 0,
                        bitrate: bitrateMatch ? parseFloat(bitrateMatch[1]) : 0
                    };
                    
                    progressBar.renderConversionProgress(progressData);
                }
            });
            
            ffmpeg.on('close', (code) => {
                progressBar.complete();
                
                if (code === 0) {
                    console.log('✅ 转换完成!');
                    
                    // 显示文件信息
                    if (fs.existsSync(outputFile)) {
                        const stats = fs.statSync(outputFile);
                        console.log(`📄 输出文件: ${outputFile}`);
                        console.log(`💾 文件大小: ${this.formatBytes(stats.size)}`);
                    }
                    
                    resolve();
                } else {
                    reject(new Error(`转换失败，退出码: ${code}`));
                }
            });
            
            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg错误: ${error.message}`));
            });
        });
    }

    /**
     * 获取转换选项
     */
    getConversionOptions(qualityChoice, format) {
        const options = [];
        
        switch (qualityChoice) {
            case '1': // 高质量
                options.push('-c:v', 'libx264', '-crf', '18', '-preset', 'slow');
                options.push('-c:a', 'aac', '-b:a', '192k');
                break;
            case '2': // 平衡模式
                options.push('-c:v', 'libx264', '-crf', '23', '-preset', 'medium');
                options.push('-c:a', 'aac', '-b:a', '128k');
                break;
            case '3': // 移动优化
                options.push('-c:v', 'libx264', '-crf', '26', '-preset', 'fast');
                options.push('-c:a', 'aac', '-b:a', '96k');
                options.push('-vf', 'scale=-2:720'); // 720p
                break;
            case '4': // 高压缩
                options.push('-c:v', 'libx265', '-crf', '28', '-preset', 'medium');
                options.push('-c:a', 'aac', '-b:a', '64k');
                break;
            default: // 默认平衡模式
                options.push('-c:v', 'libx264', '-crf', '23', '-preset', 'medium');
                options.push('-c:a', 'aac', '-b:a', '128k');
        }
        
        // 格式特定优化
        if (format === 'webm') {
            options[1] = 'libvpx-vp9'; // 使用VP9编码器
            options[5] = 'libopus'; // 使用Opus音频编码器
        } else if (format === 'flv') {
            options.push('-f', 'flv');
        }
        
        return options;
    }

    /**
     * 扫描目录中的媒体文件
     */
    scanMediaFiles(dir) {
        const mediaExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', 
                               '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
        
        try {
            const files = fs.readdirSync(dir);
            return files
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return mediaExtensions.includes(ext);
                })
                .map(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        path: filePath,
                        size: stats.size,
                        ext: path.extname(file).toLowerCase()
                    };
                })
                .sort((a, b) => b.size - a.size); // 按文件大小排序
        } catch (error) {
            return [];
        }
    }

    /**
     * 检查是否为视频文件
     */
    isVideoFile(filename) {
        const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
        return videoExtensions.includes(path.extname(filename).toLowerCase());
    }

    /**
     * 检查是否为音频文件
     */
    isAudioFile(filename) {
        const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'];
        return audioExtensions.includes(path.extname(filename).toLowerCase());
    }

    /**
     * 格式化字节大小
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * 格式化时间
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 询问用户输入
     */
    askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        console.log('\n🎬 FFmpeg 工具帮助');
        console.log('================================================================================');
        console.log('用法: awesome-tools ffmpeg [选项]');
        console.log('');
        console.log('选项:');
        console.log('  --wizard, -w      启动交互式转换向导');
        console.log('  --status          显示FFmpeg安装状态');
        console.log('  --update          更新FFmpeg到最新版本');
        console.log('  --reinstall       重新安装FFmpeg');
        console.log('  --uninstall       卸载本地安装的FFmpeg');
        console.log('');
        console.log('示例:');
        console.log('  awesome-tools ffmpeg --wizard        # 启动转换向导');
        console.log('  awesome-tools ffmpeg --status        # 检查FFmpeg状态');
        console.log('  awesome-tools ffmpeg --update        # 更新FFmpeg');
        console.log('');
        console.log('功能特性:');
        console.log('  📹 视频格式转换 (MP4, AVI, MKV, WEBM, FLV等)');
        console.log('  🎵 音频格式转换 (MP3, WAV, FLAC, AAC等)');
        console.log('  🔊 音频提取和分离');
        console.log('  📦 批量文件处理');
        console.log('  🗜️ 视频压缩优化');
        console.log('  📡 流媒体服务器 (RTMP, HLS, HTTP-FLV)');
        console.log('  📊 实时进度显示');
        console.log('  🚀 自动FFmpeg下载和管理');
    }

    /**
     * 处理文件转换命令
     */
    async handleConversion(options) {
        if (!options.convert) {
            console.log('❌ 需要指定输入文件: --convert <文件路径>');
            return;
        }
        
        const inputFile = options.convert;
        if (!fs.existsSync(inputFile)) {
            console.log(`❌ 输入文件不存在: ${inputFile}`);
            return;
        }
        
        // 构建输出文件名
        let outputFile = options.output;
        if (!outputFile) {
            const inputPath = path.parse(inputFile);
            const outputFormat = options.format || 'mp4';
            outputFile = path.join(inputPath.dir, `${inputPath.name}_converted.${outputFormat}`);
        }
        
        console.log(`\n🎬 开始转换: ${inputFile} → ${outputFile}`);
        
        // 构建转换选项
        const conversionOptions = this.getConversionOptions(options.quality || '2', options.format || 'mp4');
        
        // 添加用户指定的其他选项
        if (options.resolution) {
            const [width, height] = options.resolution.split('x');
            if (width && height) {
                conversionOptions.push('-vf', `scale=${width}:${height}`);
            }
        }
        
        if (options.bitrate) {
            conversionOptions.push('-b:v', options.bitrate);
        }
        
        if (options.audioBitrate) {
            conversionOptions.push('-b:a', options.audioBitrate);
        }
        
        if (options.fps) {
            conversionOptions.push('-r', options.fps.toString());
        }
        
        // 如果是提取音频
        if (options.extractAudio) {
            conversionOptions.length = 0; // 清空视频选项
            const audioFormat = options.format || 'mp3';
            conversionOptions.push('-vn', '-acodec', 'libmp3lame', '-ab', '192k');
            
            // 更新输出文件扩展名
            const inputPath = path.parse(inputFile);
            outputFile = options.output || path.join(inputPath.dir, `${inputPath.name}_audio.${audioFormat}`);
        }
        
        // 执行转换
        await this.executeConversion(inputFile, outputFile, conversionOptions);
    }

    // 占位方法 - 后续实现
    async audioConversionWizard(mediaFiles) {
        console.log('🎵 音频转换功能开发中...');
    }

    async audioExtractionWizard(mediaFiles) {
        console.log('🔊 音频提取功能开发中...');
    }

    async batchConversionWizard() {
        console.log('📦 批量转换功能开发中...');
    }

    async compressionWizard(mediaFiles) {
        console.log('🗜️ 视频压缩功能开发中...');
    }

    async streamingWizard() {
        console.log('📡 流媒体功能开发中...');
    }

    async fileInfoWizard(mediaFiles) {
        console.log('ℹ️ 文件信息功能开发中...');
    }
}

/**
 * 主要导出函数
 */
async function handleFFmpegCommand(options = {}) {
    const ffmpegTools = new FFmpegTools();
    await ffmpegTools.handleFFmpegCommand(options);
}

module.exports = {
    FFmpegTools,
    handleFFmpegCommand
};