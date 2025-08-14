const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');
const https = require('https');
const http = require('http');

/**
 * FFmpeg 管理器 - 负责FFmpeg的检测、下载、安装和版本管理
 */
class FFmpegManager {
    constructor() {
        this.ffmpegDir = path.join(os.homedir(), '.awesome-tools', 'ffmpeg');
        this.binDir = path.join(this.ffmpegDir, 'bin');
        this.tempDir = path.join(this.ffmpegDir, 'temp');
        
        // FFmpeg可执行文件路径
        this.ffmpegPath = this.getFFmpegExecutablePath();
        this.ffprobePath = this.getFFprobeExecutablePath();
        
        // 下载源配置
        this.downloadSources = this.getDownloadSources();
        
        this.ensureDirectories();
    }

    /**
     * 确保必要的目录存在
     */
    ensureDirectories() {
        [this.ffmpegDir, this.binDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * 获取FFmpeg可执行文件路径
     */
    getFFmpegExecutablePath() {
        const isWindows = process.platform === 'win32';
        const execName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
        
        // 优先级顺序：
        // 1. 环境变量指定路径
        if (process.env.AWESOME_TOOLS_FFMPEG_PATH) {
            return process.env.AWESOME_TOOLS_FFMPEG_PATH;
        }
        
        // 2. 本地安装路径
        const localPath = path.join(this.binDir, execName);
        if (fs.existsSync(localPath)) {
            return localPath;
        }
        
        // 3. 系统PATH中查找
        return execName;
    }

    /**
     * 获取FFprobe可执行文件路径
     */
    getFFprobeExecutablePath() {
        const isWindows = process.platform === 'win32';
        const execName = isWindows ? 'ffprobe.exe' : 'ffprobe';
        
        if (process.env.AWESOME_TOOLS_FFMPEG_PATH) {
            const dir = path.dirname(process.env.AWESOME_TOOLS_FFMPEG_PATH);
            return path.join(dir, execName);
        }
        
        const localPath = path.join(this.binDir, execName);
        if (fs.existsSync(localPath)) {
            return localPath;
        }
        
        return execName;
    }

    /**
     * 获取平台特定的下载源
     */
    getDownloadSources() {
        const platform = process.platform;
        const arch = process.arch;
        
        const sources = {
            'win32': {
                'x64': {
                    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
                    size: 89 * 1024 * 1024, // 约89MB
                    executable: 'ffmpeg.exe',
                    folder: 'ffmpeg-master-latest-win64-gpl'
                },
                'ia32': {
                    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win32-gpl.zip',
                    size: 82 * 1024 * 1024, // 约82MB
                    executable: 'ffmpeg.exe',
                    folder: 'ffmpeg-master-latest-win32-gpl'
                }
            },
            'darwin': {
                'x64': {
                    url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
                    size: 70 * 1024 * 1024, // 约70MB
                    executable: 'ffmpeg',
                    folder: ''
                },
                'arm64': {
                    url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
                    size: 68 * 1024 * 1024, // 约68MB
                    executable: 'ffmpeg',
                    folder: ''
                }
            },
            'linux': {
                'x64': {
                    url: 'https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz',
                    size: 75 * 1024 * 1024, // 约75MB
                    executable: 'ffmpeg',
                    folder: 'ffmpeg-git-*-amd64-static'
                }
            }
        };
        
        return sources[platform]?.[arch] || null;
    }

    /**
     * 检测FFmpeg是否可用
     */
    async checkFFmpegAvailability() {
        try {
            const version = await this.getFFmpegVersion();
            return {
                available: true,
                path: this.ffmpegPath,
                version: version,
                isLocal: this.ffmpegPath.includes('.awesome-tools')
            };
        } catch (error) {
            return {
                available: false,
                path: null,
                version: null,
                error: error.message
            };
        }
    }

    /**
     * 获取FFmpeg版本信息
     */
    async getFFmpegVersion() {
        return new Promise((resolve, reject) => {
            exec(`"${this.ffmpegPath}" -version`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`FFmpeg不可用: ${error.message}`));
                    return;
                }
                
                // 解析版本信息
                const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
                const builtMatch = stdout.match(/built with (.+)/);
                
                const versionInfo = {
                    version: versionMatch ? versionMatch[1] : 'unknown',
                    buildInfo: builtMatch ? builtMatch[1] : 'unknown',
                    fullOutput: stdout
                };
                
                resolve(versionInfo);
            });
        });
    }

    /**
     * 下载FFmpeg
     */
    async downloadFFmpeg(onProgress = null) {
        const downloadConfig = this.downloadSources;
        if (!downloadConfig) {
            throw new Error(`不支持的平台: ${process.platform} ${process.arch}`);
        }
        
        console.log('🌐 准备下载 FFmpeg...');
        console.log(`📍 下载源: ${downloadConfig.url}`);
        console.log(`💾 预计大小: ${Math.round(downloadConfig.size / 1024 / 1024)} MB`);
        console.log(`📁 安装位置: ${this.ffmpegDir}`);
        
        const fileName = path.basename(downloadConfig.url.split('?')[0]);
        const filePath = path.join(this.tempDir, fileName);
        
        try {
            // 下载文件
            await this.downloadFile(downloadConfig.url, filePath, onProgress);
            
            console.log('\n📁 正在安装 FFmpeg...');
            
            // 解压和安装
            await this.extractAndInstall(filePath, downloadConfig);
            
            // 清理临时文件
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            // 更新路径
            this.ffmpegPath = this.getFFmpegExecutablePath();
            this.ffprobePath = this.getFFprobeExecutablePath();
            
            // 验证安装
            const verification = await this.checkFFmpegAvailability();
            if (!verification.available) {
                throw new Error('FFmpeg安装失败：无法验证安装');
            }
            
            console.log('\n🎉 FFmpeg 安装成功！');
            console.log(`📍 安装路径: ${this.ffmpegPath}`);
            console.log(`📋 版本信息: ${verification.version.version}`);
            
            return verification;
            
        } catch (error) {
            // 清理失败的下载
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw error;
        }
    }

    /**
     * 下载文件并显示进度
     */
    async downloadFile(url, filePath, onProgress) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            
            const request = client.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // 处理重定向
                    return this.downloadFile(response.headers.location, filePath, onProgress)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`下载失败: HTTP ${response.statusCode}`));
                    return;
                }
                
                const totalSize = parseInt(response.headers['content-length'] || '0');
                let downloadedSize = 0;
                let startTime = Date.now();
                
                const file = fs.createWriteStream(filePath);
                
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    
                    if (onProgress) {
                        const progress = totalSize > 0 ? (downloadedSize / totalSize * 100) : 0;
                        const elapsed = (Date.now() - startTime) / 1000;
                        const speed = downloadedSize / elapsed;
                        const remaining = totalSize > 0 ? (totalSize - downloadedSize) / speed : 0;
                        
                        onProgress({
                            progress: progress,
                            downloaded: downloadedSize,
                            total: totalSize,
                            speed: speed,
                            remaining: remaining
                        });
                    }
                });
                
                response.on('end', () => {
                    file.end();
                    resolve();
                });
                
                response.pipe(file);
            });
            
            request.on('error', (error) => {
                reject(new Error(`下载失败: ${error.message}`));
            });
            
            request.setTimeout(60000, () => {
                request.destroy();
                reject(new Error('下载超时'));
            });
        });
    }

    /**
     * 解压并安装FFmpeg
     */
    async extractAndInstall(archivePath, config) {
        const isWindows = process.platform === 'win32';
        const isZip = archivePath.endsWith('.zip');
        const isTar = archivePath.endsWith('.tar.xz') || archivePath.endsWith('.tgz');
        
        return new Promise((resolve, reject) => {
            let extractCmd;
            
            if (isZip && isWindows) {
                // Windows ZIP解压 - 使用PowerShell
                extractCmd = `powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${this.tempDir}' -Force"`;
            } else if (isTar) {
                // Linux/Mac tar解压
                extractCmd = `tar -xf "${archivePath}" -C "${this.tempDir}"`;
            } else {
                reject(new Error('不支持的压缩格式'));
                return;
            }
            
            console.log('🗜️  正在解压...');
            
            exec(extractCmd, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`解压失败: ${error.message}`));
                    return;
                }
                
                try {
                    // 查找并移动可执行文件
                    this.findAndMoveExecutables(config);
                    resolve();
                } catch (moveError) {
                    reject(moveError);
                }
            });
        });
    }

    /**
     * 查找并移动可执行文件到bin目录
     */
    findAndMoveExecutables(config) {
        const tempContents = fs.readdirSync(this.tempDir);
        let sourceDir = this.tempDir;
        
        // 查找解压后的文件夹
        if (config.folder) {
            const folderPattern = config.folder.replace('*', '');
            const extractedFolder = tempContents.find(item => {
                return item.startsWith(folderPattern) && 
                       fs.statSync(path.join(this.tempDir, item)).isDirectory();
            });
            
            if (extractedFolder) {
                sourceDir = path.join(this.tempDir, extractedFolder);
                if (fs.existsSync(path.join(sourceDir, 'bin'))) {
                    sourceDir = path.join(sourceDir, 'bin');
                }
            }
        }
        
        // 查找并复制可执行文件
        const executables = ['ffmpeg', 'ffprobe', 'ffplay'];
        const isWindows = process.platform === 'win32';
        
        executables.forEach(exe => {
            const exeName = isWindows ? `${exe}.exe` : exe;
            const sourcePath = this.findExecutableInDir(sourceDir, exeName);
            
            if (sourcePath) {
                const destPath = path.join(this.binDir, exeName);
                fs.copyFileSync(sourcePath, destPath);
                
                // Linux/Mac需要设置执行权限
                if (!isWindows) {
                    fs.chmodSync(destPath, 0o755);
                }
                
                console.log(`✅ 安装 ${exe}`);
            }
        });
        
        // 清理临时解压文件
        this.cleanupTempExtraction();
    }

    /**
     * 在目录中递归查找可执行文件
     */
    findExecutableInDir(dir, fileName) {
        if (!fs.existsSync(dir)) {
            return null;
        }
        
        const items = fs.readdirSync(dir);
        
        // 首先在当前目录查找
        const directPath = path.join(dir, fileName);
        if (fs.existsSync(directPath)) {
            return directPath;
        }
        
        // 递归搜索子目录
        for (const item of items) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                const found = this.findExecutableInDir(itemPath, fileName);
                if (found) {
                    return found;
                }
            }
        }
        
        return null;
    }

    /**
     * 清理临时解压文件
     */
    cleanupTempExtraction() {
        const tempContents = fs.readdirSync(this.tempDir);
        tempContents.forEach(item => {
            const itemPath = path.join(this.tempDir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                fs.rmSync(itemPath, { recursive: true, force: true });
            }
        });
    }

    /**
     * 获取FFmpeg状态信息
     */
    async getFFmpegStatus() {
        const availability = await this.checkFFmpegAvailability();
        
        const status = {
            installed: availability.available,
            path: availability.path,
            version: availability.version,
            isLocal: availability.isLocal,
            platform: `${process.platform} ${process.arch}`,
            downloadSize: this.downloadSources?.size || 0
        };
        
        if (availability.available) {
            // 检测支持的编解码器
            status.codecs = await this.getSupportedCodecs();
        }
        
        return status;
    }

    /**
     * 获取支持的编解码器
     */
    async getSupportedCodecs() {
        return new Promise((resolve) => {
            exec(`"${this.ffmpegPath}" -codecs`, (error, stdout) => {
                if (error) {
                    resolve({ error: 'Unable to detect codecs' });
                    return;
                }
                
                const codecs = {
                    video: [],
                    audio: []
                };
                
                const lines = stdout.split('\n');
                lines.forEach(line => {
                    // 视频编解码器检测
                    if (line.includes('h264')) codecs.video.push('H.264');
                    if (line.includes('hevc')) codecs.video.push('H.265');
                    if (line.includes('vp8')) codecs.video.push('VP8');
                    if (line.includes('vp9')) codecs.video.push('VP9');
                    if (line.includes('av1')) codecs.video.push('AV1');
                    
                    // 音频编解码器检测
                    if (line.includes('aac')) codecs.audio.push('AAC');
                    if (line.includes('mp3')) codecs.audio.push('MP3');
                    if (line.includes('flac')) codecs.audio.push('FLAC');
                    if (line.includes('ogg')) codecs.audio.push('OGG');
                    if (line.includes('opus')) codecs.audio.push('Opus');
                });
                
                // 去重
                codecs.video = [...new Set(codecs.video)];
                codecs.audio = [...new Set(codecs.audio)];
                
                resolve(codecs);
            });
        });
    }

    /**
     * 卸载FFmpeg
     */
    async uninstallFFmpeg() {
        if (fs.existsSync(this.ffmpegDir)) {
            fs.rmSync(this.ffmpegDir, { recursive: true, force: true });
            console.log('🗑️  FFmpeg 已卸载');
            return true;
        }
        return false;
    }

    /**
     * 修复FFmpeg安装
     */
    async repairFFmpeg() {
        console.log('🔧 正在修复 FFmpeg 安装...');
        await this.uninstallFFmpeg();
        return await this.downloadFFmpeg();
    }
}

module.exports = FFmpegManager;