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

    /**
     * 音频转换向导
     */
    async audioConversionWizard(mediaFiles) {
        console.log('\n🎵 音频格式转换');
        console.log('================================================================================');
        
        const audioFiles = mediaFiles.filter(f => this.isAudioFile(f.name));
        
        if (audioFiles.length > 0) {
            console.log('检测到的音频文件:');
            audioFiles.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.name} (${this.formatBytes(file.size)})`);
            });
            console.log(`  ${audioFiles.length + 1}. 输入自定义路径`);
        } else {
            console.log('当前目录没有检测到音频文件');
            console.log('  1. 输入自定义路径');
        }
        
        const fileChoice = await this.askQuestion(`请选择文件 (1-${Math.max(audioFiles.length + 1, 1)}): `);
        const fileIndex = parseInt(fileChoice) - 1;
        
        let inputFile;
        if (fileIndex >= 0 && fileIndex < audioFiles.length) {
            inputFile = audioFiles[fileIndex].name;
        } else {
            inputFile = await this.askQuestion('请输入音频文件路径: ');
        }
        
        if (!fs.existsSync(inputFile)) {
            console.log('❌ 文件不存在');
            return;
        }
        
        console.log('\n🎯 选择输出格式:');
        console.log('  1. MP3 (通用格式，兼容性最好)');
        console.log('  2. AAC (高音质，文件较小)');
        console.log('  3. WAV (无损音质，文件较大)');
        console.log('  4. FLAC (无损压缩)');
        console.log('  5. OGG (开源格式)');
        
        const formatChoice = await this.askQuestion('请选择格式 (1-5): ');
        const formats = ['mp3', 'aac', 'wav', 'flac', 'ogg'];
        const outputFormat = formats[parseInt(formatChoice) - 1] || 'mp3';
        
        console.log('\n🎚️ 音频质量设置:');
        console.log('  1. 🏆 高音质 (320kbps)');
        console.log('  2. ⚖️ 标准音质 (192kbps) - 推荐');
        console.log('  3. 📱 移动优化 (128kbps)');
        console.log('  4. 🗜️ 高压缩 (96kbps)');
        
        const qualityChoice = await this.askQuestion('请选择质量 (1-4): ');
        const bitrates = ['320k', '192k', '128k', '96k'];
        const audioBitrate = bitrates[parseInt(qualityChoice) - 1] || '192k';
        
        const inputPath = path.parse(inputFile);
        const outputFile = path.join(inputPath.dir, `${inputPath.name}_converted.${outputFormat}`);
        
        console.log(`\n🎵 开始转换: ${inputFile} → ${outputFile}`);
        
        const options = ['-vn', '-acodec'];
        if (outputFormat === 'mp3') {
            options.push('libmp3lame');
        } else if (outputFormat === 'aac') {
            options.push('aac');
        } else if (outputFormat === 'wav') {
            options.push('pcm_s16le');
        } else if (outputFormat === 'flac') {
            options.push('flac');
        } else if (outputFormat === 'ogg') {
            options.push('libvorbis');
        }
        
        if (outputFormat !== 'wav' && outputFormat !== 'flac') {
            options.push('-ab', audioBitrate);
        }
        
        await this.executeConversion(inputFile, outputFile, options);
    }

    /**
     * 音频提取向导
     */
    async audioExtractionWizard(mediaFiles) {
        console.log('\n🔊 从视频提取音频');
        console.log('================================================================================');
        
        const videoFiles = mediaFiles.filter(f => this.isVideoFile(f.name));
        
        if (videoFiles.length > 0) {
            console.log('检测到的视频文件:');
            videoFiles.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.name} (${this.formatBytes(file.size)})`);
            });
            console.log(`  ${videoFiles.length + 1}. 输入自定义路径`);
        } else {
            console.log('当前目录没有检测到视频文件');
            console.log('  1. 输入自定义路径');
        }
        
        const fileChoice = await this.askQuestion(`请选择文件 (1-${Math.max(videoFiles.length + 1, 1)}): `);
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
        
        console.log('\n🎯 选择音频格式:');
        console.log('  1. MP3 (推荐，通用格式)');
        console.log('  2. AAC (现代格式，高质量)');
        console.log('  3. WAV (无损音质)');
        console.log('  4. FLAC (无损压缩)');
        
        const formatChoice = await this.askQuestion('请选择格式 (1-4): ');
        const formats = ['mp3', 'aac', 'wav', 'flac'];
        const outputFormat = formats[parseInt(formatChoice) - 1] || 'mp3';
        
        const inputPath = path.parse(inputFile);
        const outputFile = path.join(inputPath.dir, `${inputPath.name}_audio.${outputFormat}`);
        
        console.log(`\n🔊 开始提取音频: ${inputFile} → ${outputFile}`);
        
        const options = ['-vn', '-acodec'];
        if (outputFormat === 'mp3') {
            options.push('libmp3lame', '-ab', '192k');
        } else if (outputFormat === 'aac') {
            options.push('aac', '-ab', '192k');
        } else if (outputFormat === 'wav') {
            options.push('pcm_s16le');
        } else if (outputFormat === 'flac') {
            options.push('flac');
        }
        
        await this.executeConversion(inputFile, outputFile, options);
    }

    /**
     * 批量转换向导
     */
    async batchConversionWizard() {
        console.log('\n📦 批量文件转换');
        console.log('================================================================================');
        
        const dir = await this.askQuestion('请输入要批量转换的目录路径 (默认: 当前目录): ') || '.';
        
        if (!fs.existsSync(dir)) {
            console.log('❌ 目录不存在');
            return;
        }
        
        const mediaFiles = this.scanMediaFiles(dir);
        
        if (mediaFiles.length === 0) {
            console.log('❌ 没有找到媒体文件');
            return;
        }
        
        console.log(`\n📁 找到 ${mediaFiles.length} 个媒体文件:`);
        const videoFiles = mediaFiles.filter(f => this.isVideoFile(f.name));
        const audioFiles = mediaFiles.filter(f => this.isAudioFile(f.name));
        
        console.log(`  📹 视频文件: ${videoFiles.length} 个`);
        console.log(`  🎵 音频文件: ${audioFiles.length} 个`);
        
        console.log('\n请选择批量转换类型:');
        console.log('  1. 转换所有视频文件');
        console.log('  2. 转换所有音频文件');
        console.log('  3. 转换所有媒体文件');
        console.log('  4. 自定义筛选');
        
        const typeChoice = await this.askQuestion('请选择 (1-4): ');
        
        let filesToConvert = [];
        switch (typeChoice) {
            case '1':
                filesToConvert = videoFiles;
                break;
            case '2':
                filesToConvert = audioFiles;
                break;
            case '3':
                filesToConvert = mediaFiles;
                break;
            case '4':
                const pattern = await this.askQuestion('输入文件匹配模式 (如: *.mp4): ');
                filesToConvert = mediaFiles.filter(f => {
                    const regex = new RegExp(pattern.replace('*', '.*'));
                    return regex.test(f.name);
                });
                break;
            default:
                filesToConvert = mediaFiles;
        }
        
        if (filesToConvert.length === 0) {
            console.log('❌ 没有匹配的文件');
            return;
        }
        
        console.log(`\n将转换 ${filesToConvert.length} 个文件`);
        
        const outputFormat = await this.askQuestion('输出格式 (mp4/avi/mkv/mp3/wav等): ') || 'mp4';
        const quality = await this.askQuestion('质量等级 (1-高 2-中 3-低 4-压缩, 默认: 2): ') || '2';
        
        console.log('\n🚀 开始批量转换...\n');
        
        const progressBar = createProgressBar();
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < filesToConvert.length; i++) {
            const file = filesToConvert[i];
            const inputPath = path.parse(file.path);
            const outputFile = path.join(inputPath.dir, `${inputPath.name}_converted.${outputFormat}`);
            
            progressBar.renderBatchProgress({
                currentFile: i + 1,
                totalFiles: filesToConvert.length,
                currentFileName: file.name,
                fileProgress: 0,
                overallProgress: (i / filesToConvert.length) * 100,
                completed: Array(successCount).fill(''),
                failed: Array(failCount).fill('')
            });
            
            try {
                const options = this.getConversionOptions(quality, outputFormat);
                await this.executeConversion(file.path, outputFile, options);
                successCount++;
            } catch (error) {
                console.error(`❌ 转换失败: ${file.name} - ${error.message}`);
                failCount++;
            }
        }
        
        progressBar.complete();
        console.log('\n📊 批量转换完成!');
        console.log(`✅ 成功: ${successCount} 个文件`);
        console.log(`❌ 失败: ${failCount} 个文件`);
        console.log(`🎯 成功率: ${((successCount / filesToConvert.length) * 100).toFixed(1)}%`);
    }

    /**
     * 视频压缩向导
     */
    async compressionWizard(mediaFiles) {
        console.log('\n🗜️ 视频压缩');
        console.log('================================================================================');
        
        const videoFiles = mediaFiles.filter(f => this.isVideoFile(f.name));
        
        if (videoFiles.length > 0) {
            console.log('检测到的视频文件:');
            videoFiles.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.name} (${this.formatBytes(file.size)})`);
            });
        }
        
        const inputFile = await this.askQuestion('请输入要压缩的视频文件路径: ');
        
        if (!fs.existsSync(inputFile)) {
            console.log('❌ 文件不存在');
            return;
        }
        
        const stats = fs.statSync(inputFile);
        console.log(`\n📁 原始文件大小: ${this.formatBytes(stats.size)}`);
        
        console.log('\n选择压缩等级:');
        console.log('  1. 轻度压缩 (质量损失小，约减少 20-30%)');
        console.log('  2. 中度压缩 (平衡质量，约减少 40-50%) - 推荐');
        console.log('  3. 高度压缩 (质量损失明显，约减少 60-70%)');
        console.log('  4. 极限压缩 (仅保留基本画质，约减少 80%+)');
        console.log('  5. 自定义目标大小');
        
        const compressChoice = await this.askQuestion('请选择 (1-5): ');
        
        const inputPath = path.parse(inputFile);
        const outputFile = path.join(inputPath.dir, `${inputPath.name}_compressed.mp4`);
        
        let options = [];
        
        switch (compressChoice) {
            case '1':
                options = ['-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-c:a', 'aac', '-b:a', '128k'];
                break;
            case '2':
                options = ['-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-c:a', 'aac', '-b:a', '96k'];
                break;
            case '3':
                options = ['-c:v', 'libx264', '-crf', '28', '-preset', 'fast', '-c:a', 'aac', '-b:a', '64k'];
                break;
            case '4':
                options = ['-c:v', 'libx264', '-crf', '32', '-preset', 'veryfast', '-vf', 'scale=-2:480', '-c:a', 'aac', '-b:a', '48k'];
                break;
            case '5':
                const targetSizeMB = await this.askQuestion('目标文件大小 (MB): ');
                const targetSizeKB = parseInt(targetSizeMB) * 1024;
                // 简单计算目标比特率
                const durationCmd = `"${this.ffmpegManager.ffprobePath}" -i "${inputFile}" -show_entries format=duration -v quiet -of csv="p=0"`;
                const duration = 60; // 默认60秒，实际应该从ffprobe获取
                const targetBitrate = Math.floor((targetSizeKB * 8) / duration);
                options = ['-c:v', 'libx264', '-b:v', `${targetBitrate}k`, '-preset', 'medium', '-c:a', 'aac', '-b:a', '96k'];
                break;
            default:
                options = ['-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-c:a', 'aac', '-b:a', '96k'];
        }
        
        console.log(`\n🗜️ 开始压缩: ${inputFile} → ${outputFile}`);
        await this.executeConversion(inputFile, outputFile, options);
        
        // 显示压缩结果
        if (fs.existsSync(outputFile)) {
            const newStats = fs.statSync(outputFile);
            const reduction = ((1 - newStats.size / stats.size) * 100).toFixed(1);
            console.log(`\n✅ 压缩完成!`);
            console.log(`📁 原始大小: ${this.formatBytes(stats.size)}`);
            console.log(`📁 压缩后: ${this.formatBytes(newStats.size)}`);
            console.log(`📉 减少了: ${reduction}%`);
        }
    }

    /**
     * 流媒体向导
     */
    async streamingWizard() {
        console.log('\n📡 本地流媒体服务器');
        console.log('================================================================================');
        console.log('选择流媒体服务类型:\n');
        console.log('  1. 🎥 RTMP 流服务器 - 创建本地RTMP服务器');
        console.log('  2. 🌐 HLS 流服务器 - HTTP Live Streaming (网页播放)');
        console.log('  3. 📺 HTTP-FLV 服务器 - 低延迟HTTP流');
        console.log('  4. 📹 文件推流 - 将本地文件作为直播流');
        console.log('  5. 📷 屏幕/摄像头推流 - 实时推流');
        console.log('  0. 返回\n');
        
        const choice = await this.askQuestion('请选择 (0-5): ');
        
        switch (choice) {
            case '1':
                return await this.startRTMPServer();
            case '2':
                return await this.startHLSServer();
            case '3':
                return await this.startHTTPFLVServer();
            case '4':
                return await this.startFileStreaming();
            case '5':
                return await this.startLiveStreaming();
            case '0':
                return;
            default:
                console.log('❌ 无效选择');
                return await this.streamingWizard();
        }
    }

    /**
     * 启动RTMP服务器
     */
    async startRTMPServer() {
        console.log('\n🎥 RTMP 流服务器设置');
        console.log('================================================================================');
        console.log('RTMP服务器可以接收推流或播放本地文件\n');
        
        console.log('选择RTMP服务器模式:');
        console.log('  1. 📥 接收模式 - 等待外部推流 (OBS、FFmpeg等)');
        console.log('  2. 📤 播放模式 - 播放本地文件作为RTMP流');
        console.log('  3. 🔄 中继模式 - 接收并转发到其他RTMP服务器');
        
        const mode = await this.askQuestion('\n选择模式 (1-3): ');
        
        const port = await this.askQuestion('RTMP端口 (默认: 1935): ') || '1935';
        const streamKey = await this.askQuestion('流密钥 (默认: live): ') || 'live';
        
        let inputSource = null;
        let outputTarget = null;
        let isLoop = false;
        
        if (mode === '2') {
            // 播放模式 - 选择本地文件
            const mediaFiles = this.scanMediaFiles('.');
            const videoFiles = mediaFiles.filter(f => this.isVideoFile(f.name));
            
            if (videoFiles.length > 0) {
                console.log('\n检测到的视频文件:');
                videoFiles.forEach((file, index) => {
                    console.log(`  ${index + 1}. ${file.name} (${this.formatBytes(file.size)})`);
                });
                
                const choice = await this.askQuestion(`选择文件 (1-${videoFiles.length}) 或输入自定义路径: `);
                const index = parseInt(choice) - 1;
                if (index >= 0 && index < videoFiles.length) {
                    inputSource = videoFiles[index].path;
                } else {
                    inputSource = choice;
                }
            } else {
                inputSource = await this.askQuestion('输入视频文件路径: ');
            }
            
            if (!fs.existsSync(inputSource)) {
                console.log('❌ 文件不存在');
                return;
            }
            
            const loop = await this.askQuestion('循环播放? (Y/n): ');
            isLoop = loop.toLowerCase() !== 'n';
            
            outputTarget = `rtmp://localhost:${port}/${streamKey}`;
            
            console.log('\n📡 RTMP播放服务器配置:');
            console.log(`输入文件: ${inputSource}`);
            console.log(`循环播放: ${isLoop ? '是' : '否'}`);
            console.log(`RTMP地址: ${outputTarget}`);
            console.log(`播放地址: rtmp://localhost:${port}/${streamKey}`);
            
        } else if (mode === '3') {
            // 中继模式
            const relayTarget = await this.askQuestion('转发到的RTMP地址: ');
            outputTarget = relayTarget;
            
            console.log('\n📡 RTMP中继服务器配置:');
            console.log(`接收地址: rtmp://localhost:${port}/${streamKey}`);
            console.log(`转发地址: ${outputTarget}`);
            
        } else {
            // 接收模式 (默认)
            console.log('\n📡 RTMP接收服务器配置:');
            console.log(`推流地址: rtmp://localhost:${port}/${streamKey}`);
            console.log(`播放地址: rtmp://localhost:${port}/${streamKey}`);
            
            console.log('\n💡 推流方式:');
            console.log(`OBS设置: 服务器: rtmp://localhost:${port}/${streamKey}`);
            console.log(`FFmpeg推流: ffmpeg -re -i input.mp4 -c copy -f flv rtmp://localhost:${port}/${streamKey}`);
        }
        
        const startServer = await this.askQuestion('\n启动RTMP服务器? (Y/n): ');
        if (startServer.toLowerCase() === 'n') return;
        
        console.log('\n🚀 启动RTMP服务器...');
        console.log('⏸️  按 Ctrl+C 停止服务器\n');
        
        let rtmpCmd = [];
        
        if (mode === '2') {
            // 播放模式
            rtmpCmd = [
                '-re',
                isLoop ? '-stream_loop' : '', isLoop ? '-1' : '',
                '-i', inputSource,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'ultrafast',
                '-f', 'flv',
                '-listen', '1',
                `rtmp://localhost:${port}/${streamKey}`
            ].filter(arg => arg !== '');
            
        } else if (mode === '3') {
            // 中继模式
            rtmpCmd = [
                '-listen', '1',
                '-i', `rtmp://localhost:${port}/${streamKey}`,
                '-c', 'copy',
                '-f', 'flv',
                outputTarget
            ];
            
        } else {
            // 接收模式
            rtmpCmd = [
                '-listen', '1',
                '-i', `rtmp://localhost:${port}/${streamKey}`,
                '-c', 'copy',
                '-f', 'flv',
                '-'
            ];
        }
        
        const progressBar = createProgressBar();
        
        return new Promise((resolve) => {
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, rtmpCmd);
            
            let isStreaming = false;
            let duration = 0;
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                
                if (output.includes('Listening') || output.includes('Server started')) {
                    if (mode === '2') {
                        console.log('✅ RTMP播放服务器已启动');
                        console.log(`📺 正在播放: ${path.basename(inputSource)}`);
                    } else if (mode === '3') {
                        console.log('✅ RTMP中继服务器已启动');
                        console.log('📡 等待推流并转发中...');
                    } else {
                        console.log('✅ RTMP接收服务器已启动，等待推流...');
                    }
                    console.log(`🌐 播放地址: rtmp://localhost:${port}/${streamKey}\n`);
                }
                
                // 解析时长和进度
                if (mode === '2') {
                    if (duration === 0) {
                        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
                        if (durationMatch) {
                            duration = parseInt(durationMatch[1]) * 3600 + 
                                     parseInt(durationMatch[2]) * 60 + 
                                     parseInt(durationMatch[3]);
                        }
                    }
                    
                    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
                    if (timeMatch) {
                        if (!isStreaming) {
                            isStreaming = true;
                            console.log('📡 开始推流...\n');
                        }
                        
                        const currentTime = parseInt(timeMatch[1]) * 3600 + 
                                          parseInt(timeMatch[2]) * 60 + 
                                          parseInt(timeMatch[3]);
                        
                        const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
                        
                        progressBar.renderConversionProgress({
                            percentage: percentage,
                            currentTime: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
                            totalDuration: this.formatTime(duration),
                            speed: 1.0
                        });
                        
                        if (percentage >= 99) {
                            console.log('\n🔄 循环播放中...');
                        }
                    }
                }
                
                // 客户端连接信息
                if (output.includes('client connected')) {
                    console.log('👥 客户端已连接');
                } else if (output.includes('client disconnected')) {
                    console.log('👤 客户端已断开');
                }
            });
            
            ffmpeg.on('close', (code) => {
                if (mode === '2') progressBar.complete();
                console.log(`\n✅ RTMP服务器停止 (退出码: ${code})`);
                resolve();
            });
            
            ffmpeg.on('error', (error) => {
                console.error(`❌ RTMP服务器错误: ${error.message}`);
                console.log('\n💡 提示: 确保端口未被占用，或尝试其他端口');
                resolve();
            });
            
            process.on('SIGINT', () => {
                console.log('\n⏹️  停止RTMP服务器...');
                ffmpeg.kill();
                resolve();
            });
        });
    }

    /**
     * 启动HLS服务器
     */
    async startHLSServer() {
        console.log('\n🌐 HLS 流服务器设置');
        console.log('================================================================================');
        console.log('HLS (HTTP Live Streaming) 适合网页和移动端播放\n');
        
        const inputFile = await this.askQuestion('输入文件或流地址: ');
        if (!inputFile) {
            console.log('❌ 需要指定输入源');
            return;
        }
        
        const outputDir = await this.askQuestion('输出目录 (默认: ./hls): ') || './hls';
        const segmentTime = await this.askQuestion('切片时长(秒) (默认: 10): ') || '10';
        const listSize = await this.askQuestion('播放列表大小 (默认: 5): ') || '5';
        
        // 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const playlistPath = path.join(outputDir, 'stream.m3u8');
        const segmentPath = path.join(outputDir, 'segment%03d.ts');
        
        console.log('\n📡 HLS配置:');
        console.log(`输入源: ${inputFile}`);
        console.log(`输出目录: ${outputDir}`);
        console.log(`播放地址: http://localhost:8080/stream.m3u8`);
        console.log(`切片时长: ${segmentTime}秒`);
        
        const startServer = await this.askQuestion('\n启动HLS转换? (Y/n): ');
        if (startServer.toLowerCase() === 'n') return;
        
        console.log('\n🚀 开始生成HLS流...');
        console.log('⏸️  按 Ctrl+C 停止\n');
        
        const hlsCmd = [
            '-re',
            '-i', inputFile,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-f', 'hls',
            '-hls_time', segmentTime,
            '-hls_list_size', listSize,
            '-hls_segment_filename', segmentPath,
            '-hls_flags', 'delete_segments+append_list',
            playlistPath
        ];
        
        return new Promise((resolve) => {
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, hlsCmd);
            let isGenerating = false;
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                if (!isGenerating && output.includes('Opening')) {
                    isGenerating = true;
                    console.log('✅ HLS流生成中...');
                    console.log(`📁 输出目录: ${outputDir}`);
                    console.log(`🌐 使用浏览器打开: http://localhost:8080/stream.m3u8`);
                    console.log('\n💡 提示: 需要配置Web服务器(如nginx)来提供HTTP访问');
                }
                
                // 显示进度
                const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2})/);
                if (timeMatch) {
                    process.stdout.write(`\r⏱️  已处理: ${timeMatch[1]}`);
                }
            });
            
            ffmpeg.on('close', (code) => {
                console.log(`\n✅ HLS流生成完成 (退出码: ${code})`);
                resolve();
            });
            
            ffmpeg.on('error', (error) => {
                console.error(`❌ HLS生成错误: ${error.message}`);
                resolve();
            });
            
            process.on('SIGINT', () => {
                console.log('\n⏹️  停止HLS生成...');
                ffmpeg.kill();
                resolve();
            });
        });
    }

    /**
     * 启动HTTP-FLV服务器
     */
    async startHTTPFLVServer() {
        console.log('\n📺 HTTP-FLV 流服务器设置');
        console.log('================================================================================');
        console.log('HTTP-FLV提供低延迟的HTTP流传输\n');
        
        const inputFile = await this.askQuestion('输入文件或RTMP流地址: ');
        if (!inputFile) {
            console.log('❌ 需要指定输入源');
            return;
        }
        
        const port = await this.askQuestion('HTTP端口 (默认: 8080): ') || '8080';
        
        console.log('\n📡 HTTP-FLV配置:');
        console.log(`输入源: ${inputFile}`);
        console.log(`播放地址: http://localhost:${port}/stream.flv`);
        
        console.log('\n💡 播放方式:');
        console.log('1. 使用支持FLV的播放器 (如VLC, PotPlayer)');
        console.log('2. 网页播放器 (flv.js)');
        
        const startServer = await this.askQuestion('\n启动HTTP-FLV服务? (Y/n): ');
        if (startServer.toLowerCase() === 'n') return;
        
        console.log('\n🚀 启动HTTP-FLV服务...');
        console.log('⏸️  按 Ctrl+C 停止\n');
        
        // 使用FFmpeg提供HTTP-FLV流
        const flvCmd = [
            '-re',
            '-i', inputFile,
            '-c', 'copy',
            '-f', 'flv',
            '-listen', '1',
            `http://localhost:${port}/stream.flv`
        ];
        
        return new Promise((resolve) => {
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, flvCmd);
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                if (output.includes('Listening')) {
                    console.log(`✅ HTTP-FLV服务器已启动`);
                    console.log(`🌐 播放地址: http://localhost:${port}/stream.flv`);
                }
                
                // 显示连接信息
                if (output.includes('client connected')) {
                    console.log('👥 客户端已连接');
                }
            });
            
            ffmpeg.on('close', (code) => {
                console.log(`\n✅ HTTP-FLV服务停止 (退出码: ${code})`);
                resolve();
            });
            
            ffmpeg.on('error', (error) => {
                console.error(`❌ HTTP-FLV错误: ${error.message}`);
                resolve();
            });
            
            process.on('SIGINT', () => {
                console.log('\n⏹️  停止HTTP-FLV服务...');
                ffmpeg.kill();
                resolve();
            });
        });
    }

    /**
     * 文件推流
     */
    async startFileStreaming() {
        console.log('\n📹 文件推流设置');
        console.log('================================================================================');
        console.log('将本地文件作为直播流推送\n');
        
        const mediaFiles = this.scanMediaFiles('.');
        const videoFiles = mediaFiles.filter(f => this.isVideoFile(f.name));
        
        let inputFile;
        if (videoFiles.length > 0) {
            console.log('检测到的视频文件:');
            videoFiles.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.name} (${this.formatBytes(file.size)})`);
            });
            
            const choice = await this.askQuestion(`选择文件 (1-${videoFiles.length}): `);
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < videoFiles.length) {
                inputFile = videoFiles[index].path;
            }
        }
        
        if (!inputFile) {
            inputFile = await this.askQuestion('输入视频文件路径: ');
        }
        
        if (!fs.existsSync(inputFile)) {
            console.log('❌ 文件不存在');
            return;
        }
        
        console.log('\n选择推流目标:');
        console.log('  1. RTMP服务器');
        console.log('  2. HLS (生成m3u8)');
        console.log('  3. HTTP-FLV');
        console.log('  4. UDP组播');
        
        const targetChoice = await this.askQuestion('选择目标 (1-4): ');
        
        let outputUrl;
        let outputCmd = [];
        
        switch (targetChoice) {
            case '1':
                const rtmpUrl = await this.askQuestion('RTMP地址 (默认: rtmp://localhost:1935/live): ') 
                    || 'rtmp://localhost:1935/live';
                outputUrl = rtmpUrl;
                outputCmd = ['-c', 'copy', '-f', 'flv'];
                break;
                
            case '2':
                const hlsDir = await this.askQuestion('HLS输出目录 (默认: ./hls): ') || './hls';
                if (!fs.existsSync(hlsDir)) {
                    fs.mkdirSync(hlsDir, { recursive: true });
                }
                outputUrl = path.join(hlsDir, 'stream.m3u8');
                outputCmd = [
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-f', 'hls',
                    '-hls_time', '10',
                    '-hls_list_size', '5'
                ];
                break;
                
            case '3':
                const httpPort = await this.askQuestion('HTTP端口 (默认: 8080): ') || '8080';
                outputUrl = `http://localhost:${httpPort}/stream.flv`;
                outputCmd = ['-c', 'copy', '-f', 'flv', '-listen', '1'];
                break;
                
            case '4':
                const udpAddr = await this.askQuestion('UDP地址 (默认: udp://239.0.0.1:1234): ') 
                    || 'udp://239.0.0.1:1234';
                outputUrl = udpAddr;
                outputCmd = ['-c', 'copy', '-f', 'mpegts'];
                break;
                
            default:
                console.log('❌ 无效选择');
                return;
        }
        
        const loop = await this.askQuestion('循环播放? (Y/n): ');
        const isLoop = loop.toLowerCase() !== 'n';
        
        console.log('\n📡 推流配置:');
        console.log(`输入文件: ${inputFile}`);
        console.log(`输出地址: ${outputUrl}`);
        console.log(`循环播放: ${isLoop ? '是' : '否'}`);
        
        const startStream = await this.askQuestion('\n开始推流? (Y/n): ');
        if (startStream.toLowerCase() === 'n') return;
        
        console.log('\n🚀 开始推流...');
        console.log('⏸️  按 Ctrl+C 停止\n');
        
        const streamCmd = [
            '-re', // 实时推流
            isLoop ? '-stream_loop' : '', isLoop ? '-1' : '',
            '-i', inputFile,
            ...outputCmd,
            outputUrl
        ].filter(arg => arg !== '');
        
        const progressBar = createProgressBar();
        
        return new Promise((resolve) => {
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, streamCmd);
            
            let duration = 0;
            let isStreaming = false;
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                
                // 解析时长
                if (duration === 0) {
                    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
                    if (durationMatch) {
                        duration = parseInt(durationMatch[1]) * 3600 + 
                                 parseInt(durationMatch[2]) * 60 + 
                                 parseInt(durationMatch[3]);
                    }
                }
                
                // 解析进度
                const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch) {
                    if (!isStreaming) {
                        isStreaming = true;
                        console.log('✅ 推流已开始');
                        console.log(`📡 输出: ${outputUrl}\n`);
                    }
                    
                    const currentTime = parseInt(timeMatch[1]) * 3600 + 
                                      parseInt(timeMatch[2]) * 60 + 
                                      parseInt(timeMatch[3]);
                    
                    const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
                    
                    progressBar.renderConversionProgress({
                        percentage: percentage,
                        currentTime: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
                        totalDuration: this.formatTime(duration),
                        speed: 1.0
                    });
                    
                    if (isLoop && percentage >= 99) {
                        console.log('\n🔄 循环播放中...');
                    }
                }
            });
            
            ffmpeg.on('close', (code) => {
                progressBar.complete();
                console.log(`\n✅ 推流结束 (退出码: ${code})`);
                resolve();
            });
            
            ffmpeg.on('error', (error) => {
                console.error(`❌ 推流错误: ${error.message}`);
                resolve();
            });
            
            process.on('SIGINT', () => {
                console.log('\n⏹️  停止推流...');
                ffmpeg.kill();
                resolve();
            });
        });
    }

    /**
     * 实时推流（屏幕/摄像头）
     */
    async startLiveStreaming() {
        console.log('\n📷 实时推流设置');
        console.log('================================================================================');
        console.log('捕获屏幕或摄像头进行实时推流\n');
        
        console.log('选择输入源:');
        console.log('  1. 🖥️ 屏幕录制');
        console.log('  2. 📷 摄像头');
        console.log('  3. 🎮 屏幕 + 摄像头 (画中画)');
        console.log('  4. 🎤 屏幕 + 音频');
        
        const sourceChoice = await this.askQuestion('选择输入源 (1-4): ');
        
        let inputOptions = [];
        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const isLinux = process.platform === 'linux';
        
        switch (sourceChoice) {
            case '1': // 屏幕录制
                if (isWindows) {
                    inputOptions = ['-f', 'gdigrab', '-i', 'desktop'];
                } else if (isMac) {
                    inputOptions = ['-f', 'avfoundation', '-i', '1'];
                } else if (isLinux) {
                    inputOptions = ['-f', 'x11grab', '-i', ':0.0'];
                }
                break;
                
            case '2': // 摄像头
                if (isWindows) {
                    inputOptions = ['-f', 'dshow', '-i', 'video="USB Camera"'];
                } else if (isMac) {
                    inputOptions = ['-f', 'avfoundation', '-i', '0'];
                } else if (isLinux) {
                    inputOptions = ['-f', 'v4l2', '-i', '/dev/video0'];
                }
                break;
                
            case '3': // 屏幕 + 摄像头
                console.log('📝 画中画功能需要更复杂的设置，暂时使用屏幕录制');
                if (isWindows) {
                    inputOptions = ['-f', 'gdigrab', '-i', 'desktop'];
                } else if (isMac) {
                    inputOptions = ['-f', 'avfoundation', '-i', '1:0'];
                } else if (isLinux) {
                    inputOptions = ['-f', 'x11grab', '-i', ':0.0'];
                }
                break;
                
            case '4': // 屏幕 + 音频
                if (isWindows) {
                    inputOptions = [
                        '-f', 'gdigrab', '-i', 'desktop',
                        '-f', 'dshow', '-i', 'audio="Stereo Mix"'
                    ];
                } else if (isMac) {
                    inputOptions = ['-f', 'avfoundation', '-i', '1:0'];
                } else if (isLinux) {
                    inputOptions = [
                        '-f', 'x11grab', '-i', ':0.0',
                        '-f', 'pulse', '-i', 'default'
                    ];
                }
                break;
                
            default:
                console.log('❌ 无效选择');
                return;
        }
        
        const outputUrl = await this.askQuestion('推流地址 (默认: rtmp://localhost:1935/live): ') 
            || 'rtmp://localhost:1935/live';
        
        const resolution = await this.askQuestion('分辨率 (默认: 1280x720): ') || '1280x720';
        const fps = await this.askQuestion('帧率 (默认: 30): ') || '30';
        const bitrate = await this.askQuestion('码率kbps (默认: 2500): ') || '2500';
        
        console.log('\n📡 实时推流配置:');
        console.log(`输入源: ${['屏幕', '摄像头', '屏幕+摄像头', '屏幕+音频'][parseInt(sourceChoice) - 1]}`);
        console.log(`输出地址: ${outputUrl}`);
        console.log(`分辨率: ${resolution}`);
        console.log(`帧率: ${fps} fps`);
        console.log(`码率: ${bitrate} kbps`);
        
        const startStream = await this.askQuestion('\n开始推流? (Y/n): ');
        if (startStream.toLowerCase() === 'n') return;
        
        console.log('\n🚀 开始实时推流...');
        console.log('⏸️  按 Ctrl+C 停止\n');
        
        const streamCmd = [
            ...inputOptions,
            '-vcodec', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-s', resolution,
            '-r', fps,
            '-b:v', `${bitrate}k`,
            '-pix_fmt', 'yuv420p',
            '-f', 'flv',
            outputUrl
        ];
        
        return new Promise((resolve) => {
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, streamCmd);
            
            let isStreaming = false;
            const startTime = Date.now();
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                
                if (!isStreaming && output.includes('Stream mapping')) {
                    isStreaming = true;
                    console.log('✅ 实时推流已开始');
                    console.log(`📡 推流地址: ${outputUrl}`);
                    console.log('📊 实时状态:\n');
                }
                
                // 显示实时状态
                const fpsMatch = output.match(/fps=\s*([\d.]+)/);
                const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits/);
                const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2})/);
                
                if (fpsMatch || bitrateMatch || timeMatch) {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const status = [
                        `⏱️ 已推流: ${this.formatTime(elapsed)}`,
                        fpsMatch ? `📹 FPS: ${fpsMatch[1]}` : '',
                        bitrateMatch ? `📊 码率: ${bitrateMatch[1]} kbps` : ''
                    ].filter(s => s).join(' | ');
                    
                    process.stdout.write(`\r${status}`);
                }
            });
            
            ffmpeg.on('close', (code) => {
                console.log(`\n\n✅ 实时推流结束 (退出码: ${code})`);
                resolve();
            });
            
            ffmpeg.on('error', (error) => {
                console.error(`❌ 推流错误: ${error.message}`);
                console.log('\n💡 提示:');
                console.log('1. Windows: 可能需要安装 Screen Capture Recorder');
                console.log('2. Mac: 需要授予屏幕录制权限');
                console.log('3. Linux: 需要 x11grab 支持');
                resolve();
            });
            
            process.on('SIGINT', () => {
                console.log('\n\n⏹️  停止推流...');
                ffmpeg.kill();
                resolve();
            });
        });
    }

    /**
     * 文件信息向导
     */
    async fileInfoWizard(mediaFiles) {
        console.log('\nℹ️ 查看文件信息');
        console.log('================================================================================');
        
        if (mediaFiles.length > 0) {
            console.log('检测到的媒体文件:');
            mediaFiles.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.name} (${this.formatBytes(file.size)})`);
            });
        }
        
        const inputFile = await this.askQuestion('请输入要查看的文件路径: ');
        
        if (!fs.existsSync(inputFile)) {
            console.log('❌ 文件不存在');
            return;
        }
        
        console.log('\n🔍 分析文件信息...\n');
        
        return new Promise((resolve, reject) => {
            exec(`"${this.ffmpegManager.ffprobePath}" -v quiet -print_format json -show_format -show_streams "${inputFile}"`, 
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(`❌ 无法获取文件信息: ${error.message}`);
                        reject(error);
                        return;
                    }
                    
                    try {
                        const info = JSON.parse(stdout);
                        
                        console.log('📄 文件信息:');
                        console.log('================================================================================');
                        console.log(`📁 文件名: ${path.basename(inputFile)}`);
                        console.log(`💾 文件大小: ${this.formatBytes(parseInt(info.format.size))}`);
                        console.log(`⏱️ 时长: ${this.formatTime(parseFloat(info.format.duration))}`);
                        console.log(`📊 比特率: ${Math.round(info.format.bit_rate / 1000)} kbps`);
                        
                        // 视频流信息
                        const videoStream = info.streams.find(s => s.codec_type === 'video');
                        if (videoStream) {
                            console.log('\n🎥 视频信息:');
                            console.log(`  编解码器: ${videoStream.codec_name}`);
                            console.log(`  分辨率: ${videoStream.width}×${videoStream.height}`);
                            console.log(`  帧率: ${eval(videoStream.r_frame_rate).toFixed(2)} fps`);
                            console.log(`  像素格式: ${videoStream.pix_fmt}`);
                        }
                        
                        // 音频流信息
                        const audioStream = info.streams.find(s => s.codec_type === 'audio');
                        if (audioStream) {
                            console.log('\n🎵 音频信息:');
                            console.log(`  编解码器: ${audioStream.codec_name}`);
                            console.log(`  采样率: ${audioStream.sample_rate} Hz`);
                            console.log(`  声道: ${audioStream.channels} (${audioStream.channel_layout})`);
                            console.log(`  比特率: ${Math.round(audioStream.bit_rate / 1000)} kbps`);
                        }
                        
                        resolve();
                    } catch (parseError) {
                        console.error('❌ 解析文件信息失败');
                        reject(parseError);
                    }
                }
            );
        });
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