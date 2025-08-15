# Share Server (ss) - 本地分享服务器

快速创建本地文件分享服务器，支持目录浏览、文件上传、认证保护和公网访问。特别支持端口映射模式，可将本地开发服务映射到公网。

## 快速开始

```bash
# 使用缩写命令 (推荐)
ats ss [选项]

# 完整命令
awesome-tools share-server [选项]

# 交互式向导（最简单）
ats ss --wizard
```

## 核心功能

### 🌐 两种工作模式

#### 1. 文件分享模式（默认）
分享本地目录，提供文件浏览和下载功能。

```bash
# 分享当前目录
ats ss

# 分享指定目录
ats ss -d ./public

# 启用公网访问
ats ss -d ./docs --tunnel
```

#### 2. 端口映射模式
将本地运行的服务（如开发服务器）映射到公网。

```bash
# 映射本地3000端口的服务到公网
ats ss --port-map 3000

# 映射其他端口
ats ss --port-map 8080  # 映射本地API服务
ats ss --port-map 5173  # 映射Vite开发服务器
```

## 命令选项

### 基础选项
| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-w, --wizard` | 启动交互式配置向导 | - |
| `-d, --dir <path>` | 要分享的目录路径 | 当前目录 |
| `-p, --port <number>` | 服务器端口 | 33333 |
| `--port-map <port>` | 端口映射模式 | - |

### 认证选项
| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-u, --username <string>` | 认证用户名 | admin |
| `--password <string>` | 认证密码 | password |
| `--no-auth` | 禁用认证 | false |

### 高级选项
| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--tunnel` | 启用ngrok公网隧道 | false |
| `--index` | 启用目录索引浏览 | false |
| `--max-upload <size>` | 最大上传文件大小 | 10MB |
| `--cors-origin <origin>` | CORS允许的源 | * |
| `--custom-mime <types>` | 自定义MIME类型 | - |

## 使用场景

### 📁 文件分享场景

#### 临时文件传输
```bash
# 快速分享文件给同事
ats ss -d ./documents --no-auth

# 带密码保护的分享
ats ss -d ./private --password "secret123"
```

#### 项目演示
```bash
# 分享构建后的前端项目
ats ss -d ./dist --tunnel --no-auth

# 分享文档网站
ats ss -d ./docs --index --tunnel
```

#### 团队协作
```bash
# 团队内部文件服务器
ats ss -d ./shared -u team --password "team2024" -p 8080

# 允许文件上传
ats ss -d ./uploads --max-upload 100MB
```

### 🔗 端口映射场景

#### 本地开发服务公网访问
```bash
# React开发服务器 (通常运行在3000端口)
npm start  # 在一个终端启动React
ats ss --port-map 3000  # 在另一个终端映射到公网

# Vue/Vite开发服务器 (通常运行在5173端口)
npm run dev  # 启动Vite
ats ss --port-map 5173  # 映射到公网

# 后端API服务
ats ss --port-map 8080  # 映射Express/Koa服务
```

#### 演示和测试
```bash
# 让客户预览本地运行的网站
ats ss --port-map 3000

# 移动端测试本地开发环境
ats ss --port-map 5000  # 获取公网URL后在手机上访问

# Webhook测试
ats ss --port-map 4000  # 将本地服务暴露给第三方Webhook
```

## 功能特性

### 🎯 文件分享特性
- **目录浏览** - 美观的文件列表界面
- **文件预览** - 支持图片、视频、音频预览
- **批量下载** - 支持文件夹打包下载
- **上传功能** - 支持拖拽上传多个文件
- **搜索过滤** - 快速查找文件
- **响应式设计** - 适配移动端访问

### 🌐 网络特性
- **局域网访问** - 自动显示所有可访问地址
- **二维码分享** - 扫码即可访问
- **公网隧道** - 通过ngrok实现外网访问
- **HTTPS支持** - 隧道模式自动启用HTTPS
- **带宽限制** - 可设置上传/下载速度限制

### 🔒 安全特性
- **HTTP基础认证** - 用户名密码保护
- **访问日志** - 记录所有访问请求
- **IP白名单** - 限制访问IP（可选）
- **文件权限** - 只读/读写模式切换
- **自动超时** - 可设置服务自动关闭时间

## 输出示例

### 文件分享模式
```
🚀 启动本地分享服务器...

📁 分享目录: /Users/demo/documents
🔐 认证信息: 
   用户名: admin
   密码: ********

✅ 服务器启动成功！

📱 扫描二维码快速访问:
[QR Code]

🌐 访问地址:
   本地: http://localhost:33333
   局域网: http://192.168.1.100:33333
   局域网: http://10.0.0.5:33333

📊 服务器状态:
   运行时间: 00:00:15
   总请求数: 0
   活跃连接: 0

按 Ctrl+C 停止服务器
```

### 端口映射模式
```
🔗 端口映射模式: 映射本地端口 3000 到公网

正在建立隧道连接...
✅ 隧道连接成功！

🌍 公网访问地址:
   HTTP: http://abc123.ngrok.io
   HTTPS: https://abc123.ngrok.io

📱 扫描二维码快速访问:
[QR Code]

📊 隧道状态:
   状态: 在线
   区域: 美国
   延迟: 45ms

⚡ 实时流量:
   上传: 0 B/s
   下载: 0 B/s
   总流量: 0 B

按 Ctrl+C 停止映射
```

## 高级配置

### 自定义MIME类型
```bash
# 为特定文件类型设置MIME
ats ss --custom-mime "md:text/markdown,vue:text/plain"
```

### CORS配置
```bash
# 允许特定域名跨域访问
ats ss --cors-origin "https://example.com"

# 允许多个域名
ats ss --cors-origin "https://example.com,https://app.example.com"
```

### 带宽限制
```bash
# 限制上传速度
ats ss --upload-limit 1M  # 1MB/s

# 限制下载速度
ats ss --download-limit 5M  # 5MB/s
```

## 安全建议

### 公网访问注意事项
1. **始终启用认证** - 公网访问时不要使用 `--no-auth`
2. **使用强密码** - 避免使用默认密码
3. **限制访问时间** - 用完即关闭服务
4. **监控访问日志** - 定期检查异常访问

### 最佳实践
```bash
# 安全的公网分享
ats ss -d ./public \
  --tunnel \
  --username "user_$(date +%s)" \
  --password "$(openssl rand -base64 12)" \
  --max-upload 0  # 禁止上传

# 临时分享（自动关闭）
timeout 1h ats ss -d ./temp --tunnel  # 1小时后自动关闭
```

## 故障排除

### 端口被占用
```bash
# 更换端口
ats ss -p 8888

# 查找占用端口的进程
lsof -i :33333  # macOS/Linux
netstat -ano | findstr :33333  # Windows
```

### ngrok隧道连接失败
```bash
# 检查网络连接
ping ngrok.com

# 使用备用区域
ats ss --tunnel --region eu  # 使用欧洲节点

# 配置代理
export HTTP_PROXY=http://proxy:8080
ats ss --tunnel
```

### 上传失败
```bash
# 增加上传限制
ats ss --max-upload 500MB

# 检查磁盘空间
df -h  # macOS/Linux
```

## 使用技巧

### 快速分享小技巧
```bash
# 创建别名加快使用
alias share="ats ss --tunnel --no-auth"
alias share-private="ats ss --tunnel"

# 分享剪贴板内容
pbpaste > temp.txt && ats ss  # macOS
```

### 配合其他工具
```bash
# 分享FFmpeg转换结果
ats ff --convert video.mp4 --output ./converted
ats ss -d ./converted --tunnel

# 分享Git仓库（只读）
ats ss -d ./.git --no-auth  # 小心：包含敏感信息
```

## 相关命令

- [ffmpeg](./ffmpeg.md) - 处理要分享的媒体文件
- [screensaver](./screensaver.md) - 服务器运行时的屏保