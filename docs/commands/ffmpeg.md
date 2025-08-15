# FFmpeg (ff) - 完整音视频处理工具套件

强大的FFmpeg封装工具，提供音视频格式转换、图片处理、流媒体服务等完整功能。支持自动安装管理和交互式向导。

## 快速开始

```bash
# 使用缩写命令 (推荐)
ats ff [选项]

# 完整命令
awesome-tools ffmpeg [选项]

# 交互式向导（最简单）
ats ff --wizard
```

## 核心功能

### 🎯 媒体处理功能

| 功能 | 命令选项 | 说明 |
|------|----------|------|
| 交互向导 | `--wizard` | 启动交互式功能选择向导 |
| 格式转换 | `--convert <file>` | 转换视频/音频格式 |
| 图片转换 | `--convertImage <file>` | 转换图片格式 |
| 图片转Base64 | `--imageToBase64 <file>` | 图片编码为Base64 |
| Base64转图片 | `--base64ToImage <data>` | Base64解码为图片 |
| 视频抽帧 | `--extractFrames <file>` | 从视频提取帧画面 |
| 生成缩略图 | `--thumbnail <file>` | 生成视频缩略图 |
| 提取字幕 | `--extractSubtitles <file>` | 抽取内嵌字幕 |
| 提取音频 | `--extractAudio <file>` | 从视频提取音频 |
| 视频压缩 | `--compress <file>` | 智能压缩视频 |
| 媒体信息 | `--info <file>` | 查看详细信息 |
| 批量处理 | `--batch` | 批量转换向导 |
| 流媒体服务 | `--stream` | 启动流服务器 |

### 🛠️ 系统管理功能

| 功能 | 命令选项 | 说明 |
|------|----------|------|
| 检查状态 | `--status` | 显示FFmpeg安装状态 |
| 更新版本 | `--update` | 更新到最新版本 |
| 安装FFmpeg | `--install` | 手动安装FFmpeg |
| 重新安装 | `--reinstall` | 重新安装FFmpeg |
| 卸载 | `--uninstall` | 卸载本地FFmpeg |

### ⚙️ 参数选项

| 参数 | 说明 | 示例 |
|------|------|------|
| `--output <dir>` | 输出目录 | `--output ./converted` |
| `--format <fmt>` | 输出格式 | `--format mp4` |
| `--clipboard` | 复制到剪贴板 | 用于Base64结果 |
| `--name <name>` | 输出文件名 | `--name result.png` |
| `--interval <sec>` | 抽帧间隔 | `--interval 5` |
| `--time <time>` | 时间位置 | `--time 00:01:30` |
| `--resolution <size>` | 分辨率 | `--resolution 1920x1080` |
| `--quality <val>` | 质量设置 | `--quality 23` |
| `--crf <value>` | 视频质量 | `--crf 18` |
| `--preset <preset>` | 编码预设 | `--preset medium` |

## 使用示例

### 🖼️ 图片处理（新功能）

```bash
# 图片格式转换
ats ff --convertImage photo.png --format jpg
ats ff --convertImage image.jpg --format webp --quality 90

# 图片转Base64（自动复制到剪贴板）
ats ff --imageToBase64 logo.png --clipboard

# Base64转回图片
ats ff --base64ToImage "iVBORw0KGgoAAAA..." --name decoded.png

# 批量图片转换
ats ff --batch  # 然后选择图片转换选项
```

### 🎬 视频处理

```bash
# 格式转换
ats ff --convert video.avi --format mp4
ats ff --convert movie.mkv --format mp4 --quality 2  # 高质量

# 视频压缩
ats ff --compress large_video.mp4 --crf 28  # 更高压缩
ats ff --compress video.mp4 --resolution 1280x720  # 降低分辨率

# 提取音频
ats ff --extractAudio video.mp4 --format mp3
ats ff --extractAudio movie.mkv --format aac --quality 192k
```

### 🎞️ 视频抽帧

```bash
# 按时间间隔抽帧
ats ff --extractFrames video.mp4 --interval 10  # 每10秒一帧
ats ff --extractFrames movie.mp4 --interval 5 --format jpg

# 指定时间点抽帧
ats ff --extractFrames video.mp4 --time 00:01:30,00:05:45,00:10:20

# 抽取指定数量的帧
ats ff --extractFrames video.mp4 --count 20  # 均匀抽取20帧
```

### 🎬 缩略图生成

```bash
# 生成单张缩略图
ats ff --thumbnail video.mp4 --time 00:02:30
ats ff --thumbnail movie.mp4 --time middle  # 视频中间位置

# 生成多张缩略图
ats ff --thumbnail video.mp4 --count 6  # 生成6张缩略图
ats ff --thumbnail video.mp4 --grid 3x3  # 3x3宫格缩略图
```

### 📝 字幕处理

```bash
# 提取所有字幕轨道
ats ff --extractSubtitles movie.mkv

# 提取指定字幕轨道
ats ff --extractSubtitles video.mp4 --track 0  # 第一个字幕轨道
ats ff --extractSubtitles movie.mkv --format srt  # 指定SRT格式
```

### 📡 流媒体服务

```bash
# 启动RTMP流服务器
ats ff --stream --type rtmp --input video.mp4

# HLS流媒体服务
ats ff --stream --type hls --input video.mp4 --port 8080

# 摄像头直播
ats ff --stream --type rtmp --input camera
```

### 📦 批量处理

```bash
# 批量转换目录下所有视频
ats ff --batch --input ./videos --format mp4

# 批量压缩
ats ff --batch --input ./videos --compress --crf 25

# 批量提取音频
ats ff --batch --input ./videos --extractAudio --format mp3
```

## 支持的格式

### 视频格式
- **输入**: mp4, avi, mkv, mov, wmv, flv, webm, m4v, mpg, mpeg, 3gp, ogv
- **输出**: mp4, avi, mkv, webm, mov, flv

### 音频格式
- **输入**: mp3, wav, flac, aac, ogg, wma, m4a, opus, ac3
- **输出**: mp3, aac, wav, flac, ogg, opus

### 图片格式
- **输入**: jpg, jpeg, png, gif, bmp, webp, tiff, ico
- **输出**: jpg, png, webp, gif, bmp

### 字幕格式
- **输出**: srt, ass, vtt, sub

## 质量预设说明

### 视频质量等级
1. **高质量** (1) - CRF 18, 最高画质，文件较大
2. **平衡** (2) - CRF 23, 默认设置，平衡质量和大小
3. **移动设备** (3) - CRF 28, 适合手机观看
4. **高压缩** (4) - CRF 35, 最小文件，质量降低

### 编码速度预设
- `ultrafast` - 最快编码，质量较低
- `fast` - 快速编码
- `medium` - 平衡（默认）
- `slow` - 慢速编码，质量较好
- `veryslow` - 最慢编码，最佳质量

## 高级功能

### 自动FFmpeg管理
工具会自动处理FFmpeg的安装和更新：

```bash
# 首次使用时自动下载安装
ats ff --convert video.mp4  # 自动检测并安装FFmpeg

# 手动管理
ats ff --status    # 检查安装状态
ats ff --update    # 更新到最新版本
ats ff --reinstall # 重新安装
```

### 硬件加速
支持GPU硬件加速（如果可用）：

```bash
# NVIDIA GPU加速
ats ff --convert video.mp4 --hw cuda

# Intel Quick Sync
ats ff --convert video.mp4 --hw qsv

# AMD GPU
ats ff --convert video.mp4 --hw amf
```

### 自定义FFmpeg参数
高级用户可以直接传递FFmpeg参数：

```bash
# 自定义编码参数
ats ff --convert video.mp4 --custom "-c:v libx265 -preset slow"

# 添加滤镜
ats ff --convert video.mp4 --filter "scale=1280:720,fps=30"
```

## 性能优化建议

### 大文件处理
- 使用 `--preset fast` 加快处理速度
- 考虑分段处理超大文件
- 使用硬件加速如果可用

### 批量处理优化
- 使用 `--parallel` 并行处理多个文件
- 合理设置输出质量避免过度处理
- 定期清理临时文件

### 内存使用
- 处理4K视频建议至少8GB内存
- 使用 `--buffer-size` 调整缓冲区大小
- 关闭其他大型应用释放内存

## 常见问题

### FFmpeg安装失败
```bash
# 手动指定下载源
ats ff --install --source china

# 使用代理
ats ff --install --proxy http://proxy.example.com:8080
```

### 编码错误
```bash
# 检查编解码器支持
ats ff --status --codecs

# 使用兼容性更好的编码
ats ff --convert video.mp4 --codec h264
```

### 性能问题
```bash
# 降低质量加快速度
ats ff --convert video.mp4 --preset ultrafast --crf 28

# 限制线程数
ats ff --convert video.mp4 --threads 2
```

## 相关命令

- [share-server](./share-server.md) - 分享转换后的文件
- [screensaver](./screensaver.md) - 处理视频时的屏保