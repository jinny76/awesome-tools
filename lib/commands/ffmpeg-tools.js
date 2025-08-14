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
        console.log('  1. 🎥 RTMP 流服务器 - 支持文件播放、接收推流、中继转发');
        console.log('  2. 🌐 HLS 流服务器 - 支持文件转换、实时流、网页播放');
        console.log('  3. 📺 HTTP-FLV 服务器 - 支持文件转换、低延迟流播放');
        console.log('  0. 返回\n');
        
        console.log('💡 提示: 每个服务都支持本地文件、实时流和屏幕录制');
        
        const choice = await this.askQuestion('请选择 (0-3): ');
        
        switch (choice) {
            case '1':
                return await this.startRTMPServer();
            case '2':
                return await this.startHLSServer();
            case '3':
                return await this.startHTTPFLVServer();
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
            // 播放模式 - 修复客户端断开时的错误
            rtmpCmd = [
                '-re',
                isLoop ? '-stream_loop' : '', isLoop ? '-1' : '',
                '-i', inputSource,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'ultrafast',
                '-f', 'flv',
                '-rtmp_live', 'live',
                '-listen', '1',
                '-timeout', '30000000', // 30秒超时
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
                
                // 忽略常见的客户端断开错误消息
                if (output.includes('Connection reset by peer') || 
                    output.includes('Broken pipe') ||
                    output.includes('I/O error')) {
                    console.log('\n📱 客户端断开连接');
                    if (mode === '2') {
                        console.log('💡 服务器继续运行，等待新的客户端连接...');
                    }
                    return;
                }
                
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
                
                // 解析时长和进度 (只在播放模式且有客户端连接时显示)
                if (mode === '2' && isStreaming) {
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
                if (output.includes('client connected') || output.includes('Publishing')) {
                    isStreaming = true;
                    console.log('👥 客户端已连接');
                } else if (output.includes('client disconnected') || output.includes('Disconnecting')) {
                    isStreaming = false;
                    console.log('👤 客户端已断开');
                }
            });
            
            ffmpeg.on('close', (code) => {
                if (mode === '2') progressBar.complete();
                
                // 优雅处理不同的退出情况
                if (code === 0) {
                    console.log(`\n✅ RTMP服务器正常停止`);
                } else if (code === 1) {
                    console.log(`\n📱 客户端断开连接`);
                    if (mode === '2') {
                        console.log(`💡 播放暂停，可重新启动RTMP服务器继续播放`);
                    } else {
                        console.log(`💡 等待新的推流连接...`);
                    }
                } else if (code === 255 || code > 1000000) {
                    // 处理大的退出码，通常是FFmpeg参数错误或致命错误
                    console.log(`\n❌ RTMP服务器配置错误或连接失败`);
                    console.log(`💡 可能的问题:`);
                    console.log(`   - 端口被占用 (尝试其他端口)`);
                    console.log(`   - FFmpeg参数错误`);
                    if (mode === '2') {
                        console.log(`   - 输入文件格式不支持或文件损坏`);
                    } else {
                        console.log(`   - RTMP协议配置问题`);
                    }
                } else {
                    console.log(`\n⚠️  RTMP服务器异常退出 (退出码: ${code})`);
                }
                resolve();
            });
            
            ffmpeg.on('error', (error) => {
                const errorMsg = error.message.toLowerCase();
                // 忽略客户端断开相关的"错误"
                if (errorMsg.includes('connection refused') || 
                    errorMsg.includes('broken pipe') ||
                    errorMsg.includes('epipe') ||
                    errorMsg.includes('connection reset')) {
                    // 这些不是真正的错误，只是客户端断开连接
                    return;
                } else {
                    console.error(`❌ RTMP服务器错误: ${error.message}`);
                    console.log('\n💡 提示: 确保端口未被占用，或尝试其他端口');
                    resolve();
                }
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
        
        // 选择输入源类型
        console.log('选择输入源类型:');
        console.log('  1. 📁 本地视频文件 (转换后持续提供服务)');
        console.log('  2. 📡 实时流地址 (RTMP/HTTP等)');
        console.log('  3. 📷 摄像头/屏幕录制');
        
        const sourceType = await this.askQuestion('选择输入源类型 (1-3): ');
        
        let inputFile;
        let isLiveSource = false;
        let shouldLoop = false;
        
        if (sourceType === '1') {
            // 本地视频文件
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
                    inputFile = videoFiles[index].path;
                } else {
                    inputFile = choice;
                }
            } else {
                inputFile = await this.askQuestion('输入视频文件路径: ');
            }
            
            if (!fs.existsSync(inputFile)) {
                console.log('❌ 文件不存在');
                return;
            }
            
            const loopChoice = await this.askQuestion('转换完成后循环播放? (Y/n): ');
            shouldLoop = loopChoice.toLowerCase() !== 'n';
            
        } else if (sourceType === '2') {
            // 实时流
            inputFile = await this.askQuestion('输入流地址 (如: rtmp://localhost:1935/live): ');
            isLiveSource = true;
            
        } else if (sourceType === '3') {
            // 摄像头/屏幕
            const isWindows = process.platform === 'win32';
            const isMac = process.platform === 'darwin';
            
            if (isWindows) {
                inputFile = 'desktop'; // gdigrab
            } else if (isMac) {
                inputFile = '1:0'; // avfoundation
            } else {
                inputFile = ':0.0'; // x11grab
            }
            isLiveSource = true;
        }
        
        if (!inputFile) {
            console.log('❌ 需要指定输入源');
            return;
        }
        
        const outputDir = await this.askQuestion('输出目录 (默认: ./hls): ') || './hls';
        const httpPort = await this.askQuestion('HTTP服务端口 (默认: 8080): ') || '8080';
        const segmentTime = await this.askQuestion('切片时长(秒) (默认: 10): ') || '10';
        const listSize = await this.askQuestion('播放列表大小 (默认: 5): ') || '5';
        
        // 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const playlistPath = path.join(outputDir, 'stream.m3u8');
        const segmentPath = path.join(outputDir, 'segment%03d.ts');
        
        console.log('\n📡 HLS服务器配置:');
        console.log(`输入源: ${inputFile}`);
        console.log(`源类型: ${isLiveSource ? '实时流' : '本地文件'}`);
        console.log(`输出目录: ${outputDir}`);
        console.log(`HTTP端口: ${httpPort}`);
        console.log(`播放地址: http://localhost:${httpPort}/stream.m3u8`);
        console.log(`切片时长: ${segmentTime}秒`);
        if (!isLiveSource) {
            console.log(`循环播放: ${shouldLoop ? '是' : '否'}`);
        }
        
        const startServer = await this.askQuestion('\n启动HLS服务器? (Y/n): ');
        if (startServer.toLowerCase() === 'n') return;
        
        console.log('\n🚀 启动HLS服务器...');
        console.log('⏸️  按 Ctrl+C 停止\n');
        
        // 创建HTML播放器
        this.createHLSPlayer(outputDir);
        
        // 启动HTTP服务器
        const httpServer = this.createHTTPServer(outputDir, parseInt(httpPort));
        
        // 根据源类型构建不同的FFmpeg命令
        let hlsCmd = [];
        
        if (sourceType === '3') {
            // 屏幕/摄像头录制
            const isWindows = process.platform === 'win32';
            const isMac = process.platform === 'darwin';
            
            if (isWindows) {
                hlsCmd = [
                    '-f', 'gdigrab',
                    '-i', 'desktop',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-f', 'hls'
                ];
            } else if (isMac) {
                hlsCmd = [
                    '-f', 'avfoundation',
                    '-i', inputFile,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-f', 'hls'
                ];
            } else {
                hlsCmd = [
                    '-f', 'x11grab',
                    '-i', inputFile,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-f', 'hls'
                ];
            }
        } else {
            // 文件或流
            hlsCmd = [
                isLiveSource ? '' : '-re', // 实时流不需要-re
                shouldLoop && !isLiveSource ? '-stream_loop' : '',
                shouldLoop && !isLiveSource ? '-1' : '',
                '-i', inputFile,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-f', 'hls'
            ].filter(arg => arg !== '');
        }
        
        // 添加HLS通用参数
        hlsCmd = hlsCmd.concat([
            '-hls_time', segmentTime,
            '-hls_list_size', listSize,
            '-hls_segment_filename', segmentPath,
            isLiveSource ? '-hls_flags' : '-hls_flags',
            isLiveSource ? 'delete_segments' : 'delete_segments+append_list',
            playlistPath
        ]);
        
        const progressBar = createProgressBar();
        
        return new Promise((resolve) => {
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, hlsCmd);
            let isGenerating = false;
            let duration = 0;
            let conversionComplete = false;
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                
                // 解析时长 (仅对本地文件)
                if (duration === 0 && !isLiveSource) {
                    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
                    if (durationMatch) {
                        duration = parseInt(durationMatch[1]) * 3600 + 
                                 parseInt(durationMatch[2]) * 60 + 
                                 parseInt(durationMatch[3]);
                    }
                }
                
                if (!isGenerating && (output.includes('Opening') || output.includes('segment'))) {
                    isGenerating = true;
                    console.log(`✅ HLS${isLiveSource ? '直播' : '转换'}服务启动`);
                    console.log(`📁 输出目录: ${outputDir}`);
                    console.log(`🌐 HTTP服务器: http://localhost:${httpPort}`);
                    console.log(`📺 播放地址: http://localhost:${httpPort}/stream.m3u8`);
                    console.log(`🎮 网页播放器: http://localhost:${httpPort}/player.html`);
                    console.log(`\n💡 ${isLiveSource ? '实时流正在进行中' : '文件转换中，完成后可直接播放'}\n`);
                }
                
                // 显示进度 (仅对本地文件)
                const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch && isGenerating && !isLiveSource) {
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
                    
                    // 检查是否接近完成
                    if (percentage >= 99.5 && !shouldLoop) {
                        conversionComplete = true;
                    }
                }
            });
            
            ffmpeg.on('close', (code) => {
                if (!isLiveSource) {
                    progressBar.complete();
                }
                
                if (code === 0) {
                    if (isLiveSource) {
                        console.log(`\n✅ 实时流结束`);
                        httpServer.close();
                        resolve();
                    } else {
                        console.log(`\n✅ 文件转换完成！`);
                        if (shouldLoop) {
                            console.log(`🔄 循环播放已启用，HLS服务继续运行`);
                        } else {
                            console.log(`📺 HLS切片已生成完成，HTTP服务器继续运行`);
                            console.log(`🌐 播放地址: http://localhost:${httpPort}/stream.m3u8`);
                            console.log(`🎮 网页播放器: http://localhost:${httpPort}/player.html`);
                        }
                        
                        // 文件转换完成后，HTTP服务器继续运行
                        console.log(`\n💡 服务器将持续运行，按 Ctrl+C 停止服务`);
                        
                        // 不调用resolve()，让HTTP服务器继续运行
                        // 只有手动停止时才会结束
                    }
                } else {
                    console.log(`\n❌ HLS处理异常结束 (退出码: ${code})`);
                    httpServer.close();
                    resolve();
                }
            });
            
            ffmpeg.on('error', (error) => {
                console.error(`❌ HLS处理错误: ${error.message}`);
                httpServer.close();
                resolve();
            });
            
            // 全局退出处理
            const cleanup = () => {
                console.log('\n⏹️  停止HLS服务器...');
                ffmpeg.kill();
                httpServer.close();
                resolve();
            };
            
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
        });
    }

    /**
     * 创建HLS播放器HTML页面
     */
    createHLSPlayer(outputDir) {
        const playerHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HLS 直播播放器</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        body { margin: 0; padding: 20px; background: #000; color: #fff; font-family: Arial, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { text-align: center; color: #4CAF50; }
        .player-container { 
            position: relative; 
            width: 100%; 
            max-width: 800px; 
            margin: 20px auto; 
            background: #111; 
            border-radius: 8px; 
            overflow: hidden;
        }
        video { width: 100%; height: auto; display: block; }
        .controls { padding: 15px; background: #222; }
        .status { margin-top: 10px; padding: 10px; background: #333; border-radius: 4px; }
        .info { margin-top: 20px; padding: 15px; background: #1a1a1a; border-radius: 4px; }
        .error { color: #ff4444; }
        .success { color: #44ff44; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 HLS 直播播放器</h1>
        <div class="player-container">
            <video id="hlsVideo" controls autoplay muted>
                您的浏览器不支持HTML5视频播放
            </video>
            <div class="controls">
                <button onclick="playVideo()">▶️ 播放</button>
                <button onclick="pauseVideo()">⏸️ 暂停</button>
                <button onclick="reloadStream()">🔄 重新加载</button>
                <span id="streamStatus" class="status">准备加载流...</span>
            </div>
        </div>
        
        <div class="info">
            <h3>📡 流信息</h3>
            <p><strong>播放地址:</strong> <span id="streamUrl">stream.m3u8</span></p>
            <p><strong>状态:</strong> <span id="hlsStatus">初始化中...</span></p>
            <p><strong>质量:</strong> <span id="hlsQuality">-</span></p>
            <p><strong>缓冲:</strong> <span id="hlsBuffer">-</span></p>
        </div>
    </div>

    <script>
        const video = document.getElementById('hlsVideo');
        const statusEl = document.getElementById('hlsStatus');
        const qualityEl = document.getElementById('hlsQuality');
        const bufferEl = document.getElementById('hlsBuffer');
        const streamStatusEl = document.getElementById('streamStatus');
        
        let hls;
        
        function initHLS() {
            if (Hls.isSupported()) {
                hls = new Hls({
                    debug: false,
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90
                });
                
                hls.loadSource('stream.m3u8');
                hls.attachMedia(video);
                
                hls.on(Hls.Events.MANIFEST_PARSED, function() {
                    statusEl.textContent = '✅ 流加载成功';
                    statusEl.className = 'status success';
                    streamStatusEl.textContent = '📡 流已连接，准备播放';
                    
                    // 显示可用质量
                    const levels = hls.levels;
                    if (levels.length > 0) {
                        qualityEl.textContent = levels[0].width + 'x' + levels[0].height + ' @ ' + levels[0].bitrate + ' bps';
                    }
                });
                
                hls.on(Hls.Events.ERROR, function(event, data) {
                    console.error('HLS Error:', data);
                    if (data.fatal) {
                        switch(data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                statusEl.textContent = '❌ 网络错误，尝试重连...';
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                statusEl.textContent = '❌ 媒体错误，尝试恢复...';
                                hls.recoverMediaError();
                                break;
                            default:
                                statusEl.textContent = '❌ 致命错误：' + data.details;
                                break;
                        }
                        statusEl.className = 'status error';
                    }
                });
                
                hls.on(Hls.Events.FRAG_LOADED, function(event, data) {
                    streamStatusEl.textContent = '📺 正在播放 - 片段 ' + data.frag.sn;
                });
                
                // 监听缓冲状态
                video.addEventListener('progress', function() {
                    if (video.buffered.length > 0) {
                        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                        const duration = video.duration;
                        if (duration > 0) {
                            const bufferPercent = (bufferedEnd / duration * 100).toFixed(1);
                            bufferEl.textContent = bufferPercent + '%';
                        }
                    }
                });
                
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // 原生HLS支持 (Safari)
                video.src = 'stream.m3u8';
                statusEl.textContent = '✅ 使用原生HLS支持';
                statusEl.className = 'status success';
            } else {
                statusEl.textContent = '❌ 浏览器不支持HLS播放';
                statusEl.className = 'status error';
            }
        }
        
        function playVideo() {
            video.play().catch(e => {
                console.error('播放失败:', e);
                statusEl.textContent = '❌ 播放失败: ' + e.message;
                statusEl.className = 'status error';
            });
        }
        
        function pauseVideo() {
            video.pause();
            streamStatusEl.textContent = '⏸️ 已暂停';
        }
        
        function reloadStream() {
            if (hls) {
                hls.destroy();
            }
            statusEl.textContent = '🔄 重新加载中...';
            statusEl.className = 'status';
            setTimeout(initHLS, 1000);
        }
        
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', initHLS);
    </script>
</body>
</html>`;
        
        const playerPath = path.join(outputDir, 'player.html');
        fs.writeFileSync(playerPath, playerHTML, 'utf8');
        console.log(`📄 创建播放器页面: ${playerPath}`);
    }

    /**
     * 创建简单的HTTP服务器
     */
    createHTTPServer(staticDir, port) {
        const http = require('http');
        const url = require('url');
        
        const server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url, true);
            let requestPath = parsedUrl.pathname;
            
            console.log(`🌐 HTTP请求: ${req.method} ${requestPath}`);
            
            // 默认文件
            if (requestPath === '/') {
                requestPath = '/stream.m3u8';
            }
            
            // 移除开头的斜杠并构建文件路径
            const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
            const filePath = path.resolve(staticDir, relativePath);
            const normalizedStaticDir = path.resolve(staticDir);
            
            console.log(`📁 请求路径: ${requestPath} -> ${filePath}`);
            console.log(`📂 静态目录: ${normalizedStaticDir}`);
            
            // 安全检查，防止目录遍历
            if (!filePath.startsWith(normalizedStaticDir + path.sep) && filePath !== normalizedStaticDir) {
                console.log(`❌ 安全检查失败: 路径不在静态目录内`);
                res.writeHead(403);
                res.end('Forbidden: Invalid path');
                return;
            }
            
            // 检查文件是否存在
            console.log(`🔍 检查文件: ${filePath} - ${fs.existsSync(filePath) ? '存在' : '不存在'}`);
            
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    console.log(`📂 请求的是目录，返回403`);
                    res.writeHead(403);
                    res.end('Forbidden: Directory access denied');
                    return;
                }
                
                const ext = path.extname(filePath).toLowerCase();
                let contentType = 'text/plain';
                
                // 设置正确的Content-Type
                switch (ext) {
                    case '.m3u8':
                        contentType = 'application/vnd.apple.mpegurl';
                        break;
                    case '.ts':
                        contentType = 'video/mp2t';
                        break;
                    case '.mp4':
                        contentType = 'video/mp4';
                        break;
                    case '.html':
                        contentType = 'text/html';
                        break;
                    case '.js':
                        contentType = 'application/javascript';
                        break;
                    case '.css':
                        contentType = 'text/css';
                        break;
                }
                
                console.log(`✅ 返回文件: ${path.basename(filePath)} (${contentType})`);
                
                // 设置CORS头
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                res.setHeader('Content-Type', contentType);
                
                // 读取并发送文件
                try {
                    const fileContent = fs.readFileSync(filePath);
                    res.writeHead(200);
                    res.end(fileContent);
                } catch (error) {
                    console.log(`❌ 读取文件错误: ${error.message}`);
                    res.writeHead(500);
                    res.end('Internal server error');
                }
            } else {
                console.log(`❌ 文件不存在: ${filePath}`);
                // 列出目录内容用于调试
                try {
                    const dirContents = fs.readdirSync(normalizedStaticDir);
                    console.log(`📂 目录内容: ${dirContents.join(', ')}`);
                } catch (e) {
                    console.log(`❌ 无法读取目录: ${e.message}`);
                }
                res.writeHead(404);
                res.end('File not found');
            }
        });
        
        server.listen(port, () => {
            console.log(`📡 HTTP服务器启动: http://localhost:${port}`);
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  端口 ${port} 已被占用，尝试其他端口`);
                server.listen(0); // 使用随机端口
            }
        });
        
        return server;
    }

    /**
     * 创建FLV播放器HTML页面
     */
    createFLVPlayer(outputDir) {
        const playerHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTTP-FLV 直播播放器</title>
    <script src="https://cdn.jsdelivr.net/npm/flv.js@1.6.2/dist/flv.min.js"></script>
    <style>
        body { margin: 0; padding: 20px; background: #000; color: #fff; font-family: Arial, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { text-align: center; color: #ff6b6b; }
        .player-container { 
            position: relative; 
            width: 100%; 
            max-width: 800px; 
            margin: 20px auto; 
            background: #111; 
            border-radius: 8px; 
            overflow: hidden;
        }
        video { width: 100%; height: auto; display: block; }
        .controls { padding: 15px; background: #222; }
        .status { margin-top: 10px; padding: 10px; background: #333; border-radius: 4px; }
        .info { margin-top: 20px; padding: 15px; background: #1a1a1a; border-radius: 4px; }
        .error { color: #ff4444; }
        .success { color: #44ff44; }
        .warning { color: #ffaa44; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📺 HTTP-FLV 直播播放器</h1>
        <div class="player-container">
            <video id="flvVideo" controls muted>
                您的浏览器不支持HTML5视频播放
            </video>
            <div class="controls">
                <button onclick="startPlay()">▶️ 开始播放</button>
                <button onclick="pausePlay()">⏸️ 暂停播放</button>
                <button onclick="stopPlay()">⏹️ 停止播放</button>
                <button onclick="reloadStream()">🔄 重新加载</button>
                <span id="streamStatus" class="status">准备加载流...</span>
            </div>
        </div>
        
        <div class="info">
            <h3>📡 流信息</h3>
            <p><strong>播放地址:</strong> <span id="streamUrl">stream.flv</span></p>
            <p><strong>状态:</strong> <span id="flvStatus">初始化中...</span></p>
            <p><strong>视频编码:</strong> <span id="videoCodec">-</span></p>
            <p><strong>音频编码:</strong> <span id="audioCodec">-</span></p>
            <p><strong>分辨率:</strong> <span id="resolution">-</span></p>
            <p><strong>帧率:</strong> <span id="framerate">-</span></p>
        </div>
        
        <div class="info">
            <h3>💡 使用说明</h3>
            <p>• HTTP-FLV 提供低延迟的视频流播放体验</p>
            <p>• 支持实时流和本地文件播放</p>
            <p>• 推荐在现代浏览器中使用，支持硬件加速</p>
            <p>• VLC播放器地址: <code>http://localhost:8081/stream.flv</code></p>
            <p>• 如果没有自动播放，请点击"开始播放"按钮</p>
        </div>
        
        <div class="info">
            <h3>🔧 调试信息</h3>
            <p><strong>FLV文件状态:</strong> <span id="fileStatus">检查中...</span></p>
            <p><strong>播放器支持:</strong> <span id="playerSupport">检查中...</span></p>
            <p><strong>浏览器:</strong> <span id="browserInfo">-</span></p>
        </div>
    </div>

    <script>
        const video = document.getElementById('flvVideo');
        const statusEl = document.getElementById('flvStatus');
        const streamStatusEl = document.getElementById('streamStatus');
        const videoCodecEl = document.getElementById('videoCodec');
        const audioCodecEl = document.getElementById('audioCodec');
        const resolutionEl = document.getElementById('resolution');
        const framerateEl = document.getElementById('framerate');
        const fileStatusEl = document.getElementById('fileStatus');
        const playerSupportEl = document.getElementById('playerSupport');
        const browserInfoEl = document.getElementById('browserInfo');
        
        let flvPlayer;
        
        function initFLV() {
            if (flvjs.isSupported()) {
                // 检测是否为实时流
                const isLiveStream = window.location.search.includes('live=true');
                
                flvPlayer = flvjs.createPlayer({
                    type: 'flv',
                    url: 'stream.flv',
                    isLive: isLiveStream, // 根据实际情况设置
                    hasAudio: true,
                    hasVideo: true,
                    enableWorker: false, // 禁用worker避免兼容性问题
                    enableStashBuffer: !isLiveStream, // 文件播放启用缓冲
                    stashInitialSize: isLiveStream ? 128 : 1024,
                    autoCleanupSourceBuffer: isLiveStream
                }, {
                    enableWorker: false,
                    lazyLoadMaxDuration: isLiveStream ? 30 : 3 * 60,
                    seekType: 'range',
                    enableStashBuffer: !isLiveStream,
                    reuseRedirectedURL: true
                });
                
                flvPlayer.attachMediaElement(video);
                
                flvPlayer.on(flvjs.Events.ERROR, function(errorType, errorDetail) {
                    console.error('FLV播放错误:', errorType, errorDetail);
                    statusEl.textContent = '❌ 播放错误: ' + errorDetail;
                    statusEl.className = 'status error';
                    streamStatusEl.textContent = '💥 播放出现错误';
                });
                
                flvPlayer.on(flvjs.Events.LOADING_COMPLETE, function() {
                    statusEl.textContent = '✅ 流加载完成';
                    statusEl.className = 'status success';
                    
                    // 尝试自动播放
                    setTimeout(() => {
                        video.play().catch(e => {
                            console.log('自动播放失败，需要用户手动点击播放:', e);
                            statusEl.textContent = '🎯 点击播放按钮开始播放';
                            statusEl.className = 'status warning';
                        });
                    }, 500);
                });
                
                flvPlayer.on(flvjs.Events.RECOVERED_EARLY_EOF, function() {
                    statusEl.textContent = '🔄 流连接恢复';
                    statusEl.className = 'status warning';
                });
                
                flvPlayer.on(flvjs.Events.METADATA_ARRIVED, function(metadata) {
                    console.log('FLV元数据:', metadata);
                    statusEl.textContent = '📊 元数据已加载';
                    statusEl.className = 'status success';
                });
                
                flvPlayer.on(flvjs.Events.SCRIPTDATA_ARRIVED, function(data) {
                    console.log('FLV脚本数据:', data);
                });
                
                flvPlayer.on(flvjs.Events.STATISTICS_INFO, function(info) {
                    console.log('播放统计:', info);
                });
                
                flvPlayer.on(flvjs.Events.MEDIA_INFO, function(mediaInfo) {
                    console.log('媒体信息:', mediaInfo);
                    if (mediaInfo.videoCodec) {
                        videoCodecEl.textContent = mediaInfo.videoCodec;
                    }
                    if (mediaInfo.audioCodec) {
                        audioCodecEl.textContent = mediaInfo.audioCodec;
                    }
                    if (mediaInfo.width && mediaInfo.height) {
                        resolutionEl.textContent = mediaInfo.width + 'x' + mediaInfo.height;
                    }
                    if (mediaInfo.framerate) {
                        framerateEl.textContent = mediaInfo.framerate + ' fps';
                    }
                });
                
                video.addEventListener('loadstart', function() {
                    streamStatusEl.textContent = '📡 开始加载流...';
                });
                
                video.addEventListener('canplay', function() {
                    statusEl.textContent = '✅ 可以开始播放';
                    statusEl.className = 'status success';
                    streamStatusEl.textContent = '📺 准备播放';
                });
                
                video.addEventListener('playing', function() {
                    streamStatusEl.textContent = '▶️ 正在播放';
                });
                
                video.addEventListener('pause', function() {
                    streamStatusEl.textContent = '⏸️ 已暂停';
                });
                
                video.addEventListener('error', function(e) {
                    statusEl.textContent = '❌ 视频播放错误';
                    statusEl.className = 'status error';
                    streamStatusEl.textContent = '💥 播放失败';
                });
                
            } else {
                statusEl.textContent = '❌ 浏览器不支持FLV播放';
                statusEl.className = 'status error';
                streamStatusEl.textContent = '💥 不支持FLV';
            }
        }
        
        function startPlay() {
            console.log('开始播放FLV流...');
            streamStatusEl.textContent = '🔄 准备播放...';
            
            if (!flvPlayer) {
                console.log('FLV播放器未初始化，重新初始化...');
                initFLV();
                return;
            }
            
            try {
                // 确保播放器已附加到视频元素
                if (!flvPlayer._mediaElement) {
                    flvPlayer.attachMediaElement(video);
                }
                
                // 加载流
                flvPlayer.load();
                statusEl.textContent = '📡 加载FLV流中...';
                statusEl.className = 'status';
                
                // 等待一下再尝试播放
                setTimeout(() => {
                    video.play().then(() => {
                        console.log('播放成功');
                        statusEl.textContent = '▶️ 正在播放';
                        statusEl.className = 'status success';
                        streamStatusEl.textContent = '▶️ 播放中';
                    }).catch(e => {
                        console.error('播放失败:', e);
                        statusEl.textContent = '❌ 播放失败: ' + e.message;
                        statusEl.className = 'status error';
                        
                        // 常见的播放失败处理
                        if (e.name === 'NotAllowedError') {
                            statusEl.textContent = '🔇 请点击页面任意位置后再播放 (浏览器自动播放限制)';
                        } else if (e.name === 'NotSupportedError') {
                            statusEl.textContent = '❌ 不支持的媒体格式';
                        }
                    });
                }, 1000);
                
            } catch (error) {
                console.error('启动播放时出错:', error);
                statusEl.textContent = '❌ 启动播放失败: ' + error.message;
                statusEl.className = 'status error';
            }
        }
        
        function pausePlay() {
            if (video) {
                video.pause();
            }
        }
        
        function stopPlay() {
            if (flvPlayer) {
                flvPlayer.pause();
                flvPlayer.unload();
                streamStatusEl.textContent = '⏹️ 已停止';
            }
        }
        
        function reloadStream() {
            if (flvPlayer) {
                flvPlayer.destroy();
            }
            statusEl.textContent = '🔄 重新加载中...';
            statusEl.className = 'status';
            setTimeout(() => {
                initFLV();
                startPlay();
            }, 1000);
        }
        
        // 检查FLV文件状态
        function checkFLVFile() {
            fetch('stream.flv', { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        fileStatusEl.textContent = '✅ 可用 (' + (response.headers.get('content-length') || '未知大小') + ' bytes)';
                        fileStatusEl.className = 'success';
                    } else {
                        fileStatusEl.textContent = '❌ 不可用 (' + response.status + ')';
                        fileStatusEl.className = 'error';
                    }
                })
                .catch(error => {
                    fileStatusEl.textContent = '❌ 检查失败: ' + error.message;
                    fileStatusEl.className = 'error';
                });
        }
        
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 显示浏览器信息
            browserInfoEl.textContent = navigator.userAgent.split(' ').slice(-2).join(' ');
            
            // 检查播放器支持
            if (flvjs && flvjs.isSupported()) {
                playerSupportEl.textContent = '✅ 支持flv.js播放';
                playerSupportEl.className = 'success';
            } else {
                playerSupportEl.textContent = '❌ 不支持flv.js播放';
                playerSupportEl.className = 'error';
            }
            
            // 检查FLV文件状态
            checkFLVFile();
            
            // 每5秒检查一次文件状态
            setInterval(checkFLVFile, 5000);
            
            initFLV();
            
            // 等待一下自动尝试播放
            setTimeout(() => {
                console.log('页面加载完成，尝试自动播放...');
                startPlay();
            }, 3000); // 增加等待时间让文件生成
            
            // 添加点击页面任意位置开始播放的功能
            document.addEventListener('click', function enableAutoplay() {
                video.muted = false; // 用户交互后可以取消静音
                document.removeEventListener('click', enableAutoplay);
            }, { once: true });
        });
    </script>
</body>
</html>`;
        
        const playerPath = path.join(outputDir, 'player.html');
        fs.writeFileSync(playerPath, playerHTML, 'utf8');
        console.log(`📄 创建FLV播放器页面: ${playerPath}`);
    }

    /**
     * 创建FLV专用HTTP服务器
     */
    createFLVHTTPServer(staticDir, port) {
        const http = require('http');
        const url = require('url');
        
        const server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url, true);
            let requestPath = parsedUrl.pathname;
            
            console.log(`🌐 FLV-HTTP请求: ${req.method} ${requestPath}`);
            
            // 默认文件
            if (requestPath === '/') {
                requestPath = '/player.html';
            }
            
            // 移除开头的斜杠并构建文件路径
            const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
            const filePath = path.resolve(staticDir, relativePath);
            const normalizedStaticDir = path.resolve(staticDir);
            
            console.log(`📁 FLV请求路径: ${requestPath} -> ${filePath}`);
            
            // 安全检查，防止目录遍历
            if (!filePath.startsWith(normalizedStaticDir + path.sep) && filePath !== normalizedStaticDir) {
                console.log(`❌ 安全检查失败: 路径不在静态目录内`);
                res.writeHead(403);
                res.end('Forbidden: Invalid path');
                return;
            }
            
            // 检查文件是否存在
            console.log(`🔍 检查FLV文件: ${filePath} - ${fs.existsSync(filePath) ? '存在' : '不存在'}`);
            
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    console.log(`📂 请求的是目录，返回403`);
                    res.writeHead(403);
                    res.end('Forbidden: Directory access denied');
                    return;
                }
                
                const ext = path.extname(filePath).toLowerCase();
                let contentType = 'application/octet-stream';
                
                // 设置正确的Content-Type
                switch (ext) {
                    case '.flv':
                        contentType = 'video/x-flv';
                        break;
                    case '.html':
                        contentType = 'text/html';
                        break;
                    case '.js':
                        contentType = 'application/javascript';
                        break;
                    case '.css':
                        contentType = 'text/css';
                        break;
                }
                
                console.log(`✅ 返回FLV文件: ${path.basename(filePath)} (${contentType})`);
                
                // 设置CORS头和特殊的FLV头
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
                res.setHeader('Content-Type', contentType);
                
                // 支持HTTP Range请求 (重要：FLV流播放需要)
                if (req.headers.range && ext === '.flv') {
                    const range = req.headers.range;
                    const positions = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(positions[0], 10);
                    const fileSize = stats.size;
                    const end = positions[1] ? parseInt(positions[1], 10) : fileSize - 1;
                    const chunksize = (end - start) + 1;
                    
                    res.writeHead(206, {
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize
                    });
                    
                    const stream = fs.createReadStream(filePath, { start, end });
                    stream.pipe(res);
                } else {
                    // 正常文件传输
                    try {
                        const fileContent = fs.readFileSync(filePath);
                        res.writeHead(200);
                        res.end(fileContent);
                    } catch (error) {
                        console.log(`❌ 读取FLV文件错误: ${error.message}`);
                        res.writeHead(500);
                        res.end('Internal server error');
                    }
                }
            } else {
                console.log(`❌ FLV文件不存在: ${filePath}`);
                // 列出目录内容用于调试
                try {
                    const dirContents = fs.readdirSync(normalizedStaticDir);
                    console.log(`📂 FLV目录内容: ${dirContents.join(', ')}`);
                } catch (e) {
                    console.log(`❌ 无法读取FLV目录: ${e.message}`);
                }
                res.writeHead(404);
                res.end('File not found');
            }
        });
        
        server.listen(port, () => {
            console.log(`📡 FLV-HTTP服务器启动: http://localhost:${port}`);
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  端口 ${port} 已被占用，尝试其他端口`);
                server.listen(0); // 使用随机端口
            }
        });
        
        return server;
    }

    /**
     * 启动HTTP-FLV服务器
     */
    async startHTTPFLVServer() {
        console.log('\n📺 HTTP-FLV 流服务器设置');
        console.log('================================================================================');
        console.log('HTTP-FLV提供低延迟的HTTP流传输\n');
        
        // 选择输入源类型
        console.log('选择输入源类型:');
        console.log('  1. 📁 本地视频文件');
        console.log('  2. 📡 RTMP流地址');
        console.log('  3. 📷 摄像头/屏幕录制');
        
        const sourceType = await this.askQuestion('选择输入源类型 (1-3): ');
        
        let inputFile;
        let inputOptions = [];
        let isLiveSource = false;
        let shouldLoop = false;
        
        if (sourceType === '1') {
            // 本地视频文件
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
                    inputFile = videoFiles[index].path;
                } else {
                    inputFile = choice;
                }
            } else {
                inputFile = await this.askQuestion('输入视频文件路径: ');
            }
            
            if (!fs.existsSync(inputFile)) {
                console.log('❌ 文件不存在');
                return;
            }
            
            const loopChoice = await this.askQuestion('循环播放? (Y/n): ');
            shouldLoop = loopChoice.toLowerCase() !== 'n';
            
        } else if (sourceType === '2') {
            // RTMP流
            inputFile = await this.askQuestion('输入RTMP流地址 (如: rtmp://localhost:1935/live): ');
            isLiveSource = true;
            
        } else if (sourceType === '3') {
            // 摄像头/屏幕
            const isWindows = process.platform === 'win32';
            const isMac = process.platform === 'darwin';
            
            if (isWindows) {
                inputOptions = ['-f', 'gdigrab'];
                inputFile = 'desktop';
            } else if (isMac) {
                inputOptions = ['-f', 'avfoundation'];
                inputFile = '1:0';
            } else {
                inputOptions = ['-f', 'x11grab'];
                inputFile = ':0.0';
            }
            isLiveSource = true;
        }
        
        if (!inputFile) {
            console.log('❌ 需要指定输入源');
            return;
        }
        
        const outputDir = await this.askQuestion('输出目录 (默认: ./flv): ') || './flv';
        const httpPort = await this.askQuestion('HTTP服务端口 (默认: 8081): ') || '8081';
        
        // 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        console.log('\n📡 HTTP-FLV服务器配置:');
        console.log(`输入源: ${inputFile}`);
        console.log(`源类型: ${isLiveSource ? '实时流' : '本地文件'}`);
        console.log(`HTTP端口: ${httpPort}`);
        console.log(`播放地址: http://localhost:${httpPort}/stream.flv`);
        console.log(`网页播放器: http://localhost:${httpPort}/player.html`);
        if (!isLiveSource) {
            console.log(`循环播放: ${shouldLoop ? '是' : '否'}`);
        }
        
        const startServer = await this.askQuestion('\n启动HTTP-FLV服务器? (Y/n): ');
        if (startServer.toLowerCase() === 'n') return;
        
        console.log('\n🚀 启动HTTP-FLV服务器...');
        console.log('⏸️  按 Ctrl+C 停止\n');
        
        // 创建FLV播放器
        this.createFLVPlayer(outputDir);
        
        // 启动HTTP服务器
        const httpServer = this.createFLVHTTPServer(outputDir, parseInt(httpPort));
        
        // 构建FFmpeg命令
        let flvCmd = [
            ...inputOptions,
            isLiveSource ? '' : '-re',
            shouldLoop && !isLiveSource ? '-stream_loop' : '',
            shouldLoop && !isLiveSource ? '-1' : '',
            '-i', inputFile,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'ultrafast',
            '-f', 'flv'
        ].filter(arg => arg !== '');
        
        // 输出到命名管道或直接流式传输
        const flvOutputPath = path.join(outputDir, 'stream.flv');
        flvCmd.push(flvOutputPath);
        
        const progressBar = createProgressBar();
        
        return new Promise((resolve) => {
            const ffmpeg = spawn(this.ffmpegManager.ffmpegPath, flvCmd);
            let isGenerating = false;
            let duration = 0;
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                
                // 解析时长 (仅对本地文件)
                if (duration === 0 && !isLiveSource) {
                    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
                    if (durationMatch) {
                        duration = parseInt(durationMatch[1]) * 3600 + 
                                 parseInt(durationMatch[2]) * 60 + 
                                 parseInt(durationMatch[3]);
                    }
                }
                
                if (!isGenerating && (output.includes('Opening') || output.includes('frame='))) {
                    isGenerating = true;
                    console.log(`✅ HTTP-FLV${isLiveSource ? '直播' : '转换'}服务启动`);
                    console.log(`📁 输出目录: ${outputDir}`);
                    console.log(`🌐 HTTP服务器: http://localhost:${httpPort}`);
                    console.log(`📺 播放地址: http://localhost:${httpPort}/stream.flv`);
                    console.log(`🎮 网页播放器: http://localhost:${httpPort}/player.html`);
                    console.log(`\n💡 推荐使用网页播放器，支持flv.js播放\n`);
                }
                
                // 显示进度 (仅对本地文件)
                const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch && isGenerating && !isLiveSource) {
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
                }
            });
            
            ffmpeg.on('close', (code) => {
                if (!isLiveSource) {
                    progressBar.complete();
                }
                
                if (code === 0) {
                    if (isLiveSource) {
                        console.log(`\n✅ 实时流结束`);
                        httpServer.close();
                        resolve();
                    } else {
                        console.log(`\n✅ 文件转换完成！`);
                        console.log(`📺 FLV文件已生成，HTTP服务器继续运行`);
                        console.log(`🌐 播放地址: http://localhost:${httpPort}/stream.flv`);
                        console.log(`🎮 网页播放器: http://localhost:${httpPort}/player.html`);
                        console.log(`\n💡 服务器将持续运行，按 Ctrl+C 停止服务`);
                    }
                } else {
                    console.log(`\n❌ HTTP-FLV处理异常结束 (退出码: ${code})`);
                    httpServer.close();
                    resolve();
                }
            });
            
            ffmpeg.on('error', (error) => {
                console.error(`❌ HTTP-FLV处理错误: ${error.message}`);
                httpServer.close();
                resolve();
            });
            
            // 全局退出处理
            const cleanup = () => {
                console.log('\n⏹️  停止HTTP-FLV服务器...');
                ffmpeg.kill();
                httpServer.close();
                resolve();
            };
            
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
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