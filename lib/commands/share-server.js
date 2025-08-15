const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec, spawn } = require('child_process');
const os = require('os');
const readline = require('readline');
const QRCode = require('qrcode');

class ShareServer {
  constructor(options) {
    this.options = {
      dir: options.dir,
      port: parseInt(options.port) || 33333,
      username: options.username || 'admin',
      password: options.password || 'password',
      maxUpload: this.parseSize(options.maxUpload || '10MB'),
      corsOrigin: options.corsOrigin || '*',
      tunnel: options.tunnel || false,
      customMimeTypes: this.parseCustomMimeTypes(options.customMime || ''),
      indexEnabled: options.index || false,
      authEnabled: options.auth !== false  // 默认启用认证，--no-auth时禁用
    };
    
    this.server = null;
    this.ngrokProcess = null;
    this.publicUrl = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // 默认MIME类型映射
    this.mimeTypes = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      ...this.options.customMimeTypes
    };
  }
  
  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
    if (!match) return 10 * 1024 * 1024; // 默认10MB
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    return Math.floor(value * units[unit]);
  }
  
  parseCustomMimeTypes(customMime) {
    const types = {};
    if (!customMime) return types;
    
    customMime.split(',').forEach(pair => {
      const [ext, type] = pair.split(':');
      if (ext && type) {
        types[ext.startsWith('.') ? ext : '.' + ext] = type.trim();
      }
    });
    
    return types;
  }
  
  // HTTP Basic Authentication
  authenticate(req, res) {
    // 如果禁用认证，直接通过
    if (!this.options.authEnabled) {
      return true;
    }
    
    const auth = req.headers.authorization;
    
    if (!auth || !auth.startsWith('Basic ')) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Share Server"',
        'Content-Type': 'text/html'
      });
      res.end(`
        <html>
          <head><title>认证required</title></head>
          <body>
            <h2>需要认证</h2>
            <p>请输入用户名和密码访问此服务器</p>
          </body>
        </html>
      `);
      return false;
    }
    
    const credentials = Buffer.from(auth.slice(6), 'base64').toString();
    const [username, password] = credentials.split(':');
    
    if (username !== this.options.username || password !== this.options.password) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Share Server"',
        'Content-Type': 'text/html'
      });
      res.end(`
        <html>
          <head><title>认证失败</title></head>
          <body>
            <h2>认证失败</h2>
            <p>用户名或密码错误</p>
          </body>
        </html>
      `);
      return false;
    }
    
    return true;
  }
  
  // 设置CORS头
  setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', this.options.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // 获取MIME类型
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.mimeTypes[ext] || 'application/octet-stream';
  }
  
  // 生成主页面HTML
  generateMainPage() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Share Server</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
            .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 15px; padding: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); margin-bottom: 30px; }
            h1 { text-align: center; color: #333; margin-bottom: 30px; font-size: 2.5em; }
            .upload-area { border: 3px dashed #007acc; border-radius: 10px; padding: 40px; text-align: center; background: #f8f9fa; transition: all 0.3s; }
            .upload-area:hover { border-color: #005c99; background: #e9ecef; }
            .upload-area.dragover { border-color: #28a745; background: #d4edda; }
            input[type="file"] { display: none; }
            .upload-button { background: #007acc; color: white; padding: 15px 30px; border: none; border-radius: 8px; cursor: pointer; font-size: 1.1em; transition: all 0.3s; }
            .upload-button:hover { background: #005c99; transform: translateY(-2px); }
            .progress-container { margin-top: 20px; display: none; }
            .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
            .progress-fill { height: 100%; background: linear-gradient(90deg, #007acc, #28a745); transition: width 0.3s; width: 0%; }
            .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 30px; }
            .info-item { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 10px; }
            .info-item h3 { margin: 0 0 10px 0; color: #007acc; }
            .file-list { margin-top: 20px; }
            .file-item { padding: 10px; border: 1px solid #dee2e6; border-radius: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
            .file-actions button { background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px; }
            ${this.options.indexEnabled ? '.browse-button { background: #28a745; color: white; padding: 15px 30px; border: none; border-radius: 8px; cursor: pointer; font-size: 1.1em; margin-left: 10px; text-decoration: none; display: inline-block; }' : ''}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <h1>📁 Share Server</h1>
              
              <div class="upload-area" id="uploadArea">
                <h3>📤 拖拽文件到此处或点击上传</h3>
                <p>最大文件大小: ${this.formatFileSize(this.options.maxUpload)}</p>
                <input type="file" id="fileInput" multiple>
                <button class="upload-button" onclick="document.getElementById('fileInput').click()">选择文件</button>
                ${this.options.indexEnabled ? '<a href="/browse" class="browse-button">📂 浏览文件</a>' : ''}
              </div>
              
              <div class="progress-container" id="progressContainer">
                <div class="progress-bar">
                  <div class="progress-fill" id="progressFill"></div>
                </div>
                <p id="progressText">上传中... 0%</p>
              </div>
              
              <div id="fileList" class="file-list"></div>
              
              <div class="info-grid">
                <div class="info-item">
                  <h3>🔒 安全</h3>
                  <p>HTTP Basic 认证保护</p>
                </div>
                <div class="info-item">
                  <h3>🌐 跨域</h3>
                  <p>CORS 支持</p>
                </div>
                <div class="info-item">
                  <h3>📊 状态</h3>
                  <p>服务运行正常</p>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');
            const progressContainer = document.getElementById('progressContainer');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const fileList = document.getElementById('fileList');
            
            // 文件大小格式化函数
            function formatFileSize(bytes) {
              const units = ['B', 'KB', 'MB', 'GB'];
              let size = bytes;
              let unitIndex = 0;
              
              while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
              }
              
              return size.toFixed(1) + ' ' + units[unitIndex];
            }
            
            // 拖拽上传
            uploadArea.addEventListener('dragover', (e) => {
              e.preventDefault();
              uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
              uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
              e.preventDefault();
              uploadArea.classList.remove('dragover');
              const files = e.dataTransfer.files;
              uploadFiles(files);
            });
            
            fileInput.addEventListener('change', (e) => {
              uploadFiles(e.target.files);
            });
            
            function uploadFiles(files) {
              const formData = new FormData();
              Array.from(files).forEach(file => {
                formData.append('files', file);
              });
              
              progressContainer.style.display = 'block';
              
              const xhr = new XMLHttpRequest();
              
              xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  const percent = Math.round((e.loaded / e.total) * 100);
                  progressFill.style.width = percent + '%';
                  progressText.textContent = \`上传中... \${percent}%\`;
                }
              });
              
              xhr.addEventListener('load', () => {
                try {
                  const response = JSON.parse(xhr.responseText);
                  
                  if (response.success) {
                    let message = '上传完成! ✅ (' + response.uploaded + '/' + response.totalFiles + ' 个文件)';
                    
                    if (response.skippedCount > 0) {
                      message += ' - ' + response.skippedCount + ' 个文件跳过';
                    }
                    
                    progressText.textContent = message;
                    
                    // 显示详细信息
                    let details = '';
                    response.files.forEach(file => {
                      details += '✅ ' + file.name + (file.renamed ? ' (重命名)' : '') + ' - ' + formatFileSize(file.size) + '\\n';
                    });
                    
                    if (response.skipped && response.skipped.length > 0) {
                      details += '\\n跳过的文件:\\n';
                      response.skipped.forEach(file => {
                        details += '⚠️ ' + file.name + ' - ' + file.reason + '\\n';
                      });
                    }
                    
                    if (details) {
                      console.log('上传详情:', details);
                    }
                    
                    setTimeout(() => {
                      progressContainer.style.display = 'none';
                      fileInput.value = '';
                    }, 3000);
                  } else {
                    progressText.textContent = '上传失败 ❌ - ' + response.error;
                    setTimeout(() => {
                      progressContainer.style.display = 'none';
                    }, 5000);
                  }
                } catch (e) {
                  if (xhr.status === 200) {
                    progressText.textContent = '上传完成! ✅';
                  } else {
                    progressText.textContent = '上传失败 ❌ (状态码: ' + xhr.status + ')';
                  }
                  setTimeout(() => {
                    progressContainer.style.display = 'none';
                  }, 3000);
                }
              });
              
              xhr.addEventListener('error', () => {
                progressText.textContent = '网络错误 ❌';
                setTimeout(() => {
                  progressContainer.style.display = 'none';
                }, 3000);
              });
              
              xhr.open('POST', '/upload');
              xhr.send(formData);
            }
          </script>
        </body>
      </html>
    `;
  }

  // 生成目录列表HTML
  generateDirectoryListing(dirPath, relativePath) {
    const files = fs.readdirSync(dirPath);
    const items = [];
    
    // 添加返回上级目录链接
    if (relativePath !== '/') {
      const parentPath = path.dirname(relativePath);
      items.push(`<li class="directory"><a href="${parentPath === '.' ? '/' : parentPath}">📁 ..</a></li>`);
    }
    
    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      const href = path.posix.join(relativePath, file);
      
      if (stat.isDirectory()) {
        items.push(`<li class="directory"><a href="${href}/">📁 ${file}/</a></li>`);
      } else {
        const size = this.formatFileSize(stat.size);
        const date = stat.mtime.toLocaleDateString('zh-CN');
        items.push(`<li class="file"><a href="${href}">📄 ${file}</a> <span class="meta">(${size}, ${date})</span></li>`);
      }
    });
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>目录: ${relativePath}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
            ul { list-style: none; padding: 0; }
            li { padding: 8px 0; border-bottom: 1px solid #eee; }
            li:last-child { border-bottom: none; }
            a { text-decoration: none; color: #007acc; font-weight: 500; }
            a:hover { text-decoration: underline; }
            .meta { color: #666; font-size: 0.9em; float: right; }
            .upload-section { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px; }
            .upload-button { background: #007acc; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            .upload-button:hover { background: #005c99; }
            .directory a { color: #e67e22; }
            .file a { color: #27ae60; }
            .nav-button { background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin-right: 10px; }
            .nav-button:hover { background: #5a6268; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="margin-bottom: 20px;">
              <a href="/" class="nav-button">🏠 主页</a>
            </div>
            <h1>📂 目录浏览: ${relativePath}</h1>
            <ul>
              ${items.join('')}
            </ul>
            
            <div class="upload-section">
              <h3>📤 上传文件</h3>
              <form action="/upload" method="post" enctype="multipart/form-data">
                <input type="hidden" name="path" value="${relativePath}">
                <input type="file" name="files" multiple required>
                <button type="submit" class="upload-button">上传</button>
              </form>
              <p style="color: #666; font-size: 0.9em;">最大文件大小: ${this.formatFileSize(this.options.maxUpload)}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
  
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  
  // 处理文件上传
  async handleUpload(req, res) {
    return new Promise((resolve) => {
      const contentType = req.headers['content-type'];
      
      if (!contentType || !contentType.includes('multipart/form-data')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '请求格式错误，需要multipart/form-data' }));
        return resolve();
      }
      
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '缺少boundary参数' }));
        return resolve();
      }
      
      let body = Buffer.alloc(0);
      let uploadAborted = false;
      
      req.on('data', chunk => {
        if (uploadAborted) return;
        
        body = Buffer.concat([body, chunk]);
        
        // 检查文件大小限制 - 给多文件上传更大的缓冲
        const maxTotalSize = Math.max(this.options.maxUpload * 5, 50 * 1024 * 1024); // 至少50MB
        if (body.length > maxTotalSize) {
          uploadAborted = true;
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: `总文件大小超过限制 (${this.formatFileSize(maxTotalSize)})` 
          }));
          resolve();
        }
      });
      
      req.on('end', () => {
        if (uploadAborted) return;
        
        try {
          const parts = this.parseMultipart(body, boundary);
          const pathField = parts.find(p => p.name === 'path');
          
          // 支持多种字段名：files（主页）、file（浏览页面）
          const fileFields = parts.filter(p => 
            (p.name === 'files' || p.name === 'file') && p.filename && p.filename.trim() !== ''
          );
          
          if (fileFields.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: '没有检测到有效的文件，请确认选择了文件' 
            }));
            return resolve();
          }
          
          const uploadPath = pathField ? pathField.data.toString() : '/';
          const targetDir = path.join(this.options.dir, uploadPath);
          
          // 确保目标目录存在
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          
          const uploadedFiles = [];
          const skippedFiles = [];
          const errors = [];
          
          // 处理所有文件
          for (const fileField of fileFields) {
            try {
              // 检查单个文件大小
              if (fileField.data.length > this.options.maxUpload) {
                skippedFiles.push({
                  name: fileField.filename,
                  reason: `文件大小 ${this.formatFileSize(fileField.data.length)} 超过限制 ${this.formatFileSize(this.options.maxUpload)}`
                });
                console.log(`⚠️  文件 ${fileField.filename} 超过大小限制，跳过`);
                continue;
              }
              
              // 检查文件名安全性
              const safeName = path.basename(fileField.filename);
              if (safeName !== fileField.filename || safeName.includes('..')) {
                skippedFiles.push({
                  name: fileField.filename,
                  reason: '文件名包含不安全字符'
                });
                continue;
              }
              
              const targetFile = path.join(targetDir, safeName);
              
              // 检查文件是否已存在
              if (fs.existsSync(targetFile)) {
                // 生成新文件名
                const ext = path.extname(safeName);
                const baseName = path.basename(safeName, ext);
                const timestamp = Date.now();
                const newName = `${baseName}_${timestamp}${ext}`;
                const newTargetFile = path.join(targetDir, newName);
                
                fs.writeFileSync(newTargetFile, fileField.data);
                uploadedFiles.push({
                  name: newName,
                  originalName: fileField.filename,
                  size: fileField.data.length,
                  renamed: true
                });
                
                console.log(`📤 上传文件: ${fileField.filename} → ${newName} (${this.formatFileSize(fileField.data.length)})`);
              } else {
                fs.writeFileSync(targetFile, fileField.data);
                uploadedFiles.push({
                  name: safeName,
                  size: fileField.data.length,
                  renamed: false
                });
                
                console.log(`📤 上传文件: ${safeName} (${this.formatFileSize(fileField.data.length)})`);
              }
              
            } catch (fileError) {
              errors.push({
                name: fileField.filename,
                error: fileError.message
              });
              console.error(`❌ 文件 ${fileField.filename} 上传失败:`, fileError);
            }
          }
          
          // 构建响应
          const response = {
            success: uploadedFiles.length > 0,
            uploaded: uploadedFiles.length,
            files: uploadedFiles,
            totalFiles: fileFields.length
          };
          
          if (skippedFiles.length > 0) {
            response.skipped = skippedFiles;
            response.skippedCount = skippedFiles.length;
          }
          
          if (errors.length > 0) {
            response.errors = errors;
            response.errorCount = errors.length;
          }
          
          // 如果有成功上传的文件，返回200，否则返回400
          const statusCode = uploadedFiles.length > 0 ? 200 : 400;
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          resolve();
          
        } catch (error) {
          console.error('上传解析错误:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: `文件处理失败: ${error.message}` 
          }));
          resolve();
        }
      });
      
      req.on('error', (error) => {
        console.error('上传请求错误:', error);
        if (!uploadAborted) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: `上传中断: ${error.message}` 
          }));
          resolve();
        }
      });
    });
  }
  
  // 解析multipart/form-data
  parseMultipart(body, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
    
    let start = 0;
    let end = 0;
    
    while ((end = body.indexOf(boundaryBuffer, start)) !== -1) {
      if (start > 0) {
        const partData = body.slice(start, end - 2); // -2 for \r\n
        const part = this.parsePart(partData);
        if (part) parts.push(part);
      }
      start = end + boundaryBuffer.length + 2; // +2 for \r\n
    }
    
    return parts;
  }
  
  parsePart(partData) {
    const headerEnd = partData.indexOf('\r\n\r\n');
    if (headerEnd === -1) return null;
    
    const headerSection = partData.slice(0, headerEnd).toString();
    const dataSection = partData.slice(headerEnd + 4);
    
    const dispositionMatch = headerSection.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
    if (!dispositionMatch) return null;
    
    return {
      name: dispositionMatch[1],
      filename: dispositionMatch[2],
      data: dataSection
    };
  }
  
  // 主请求处理器
  async handleRequest(req, res) {
    // 处理OPTIONS请求 (CORS preflight)
    if (req.method === 'OPTIONS') {
      this.setCorsHeaders(res);
      res.writeHead(200);
      res.end();
      return;
    }
    
    // 认证检查
    if (!this.authenticate(req, res)) {
      return;
    }
    
    // 设置CORS头
    this.setCorsHeaders(res);
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsedUrl.pathname);
    
    // 处理文件上传
    if (req.method === 'POST' && pathname === '/upload') {
      await this.handleUpload(req, res);
      return;
    }
    
    // 处理GET请求
    if (req.method === 'GET') {
      // 根路径显示主页
      if (pathname === '/') {
        const html = this.generateMainPage();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }
      
      // /browse路径显示目录浏览（如果启用）
      if (pathname === '/browse') {
        if (!this.options.indexEnabled) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Directory browsing disabled');
          return;
        }
        
        const html = this.generateDirectoryListing(this.options.dir, '/');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }
      
      // 处理目录浏览下的路径（如果启用）
      if (pathname.startsWith('/browse/')) {
        if (!this.options.indexEnabled) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Directory browsing disabled');
          return;
        }
        
        const realPath = pathname.substring(7); // 移除 '/browse' 前缀
        const targetPath = path.join(this.options.dir, realPath);
        
        // 安全检查：防止路径遍历攻击
        if (!targetPath.startsWith(this.options.dir)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }
        
        try {
          const stat = fs.statSync(targetPath);
          
          if (stat.isDirectory()) {
            // 显示目录列表
            const html = this.generateDirectoryListing(targetPath, '/browse' + realPath);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
          } else {
            // 服务文件
            const mimeType = this.getMimeType(targetPath);
            const fileSize = stat.size;
            
            res.writeHead(200, {
              'Content-Type': mimeType,
              'Content-Length': fileSize,
              'Content-Disposition': `inline; filename="${path.basename(targetPath)}"`
            });
            
            const readStream = fs.createReadStream(targetPath);
            readStream.pipe(res);
            
            console.log(`📥 下载文件: ${realPath} (${this.formatFileSize(fileSize)})`);
          }
        } catch (error) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
        }
        return;
      }
      
      // 直接文件访问
      const targetPath = path.join(this.options.dir, pathname);
      
      // 安全检查：防止路径遍历攻击
      if (!targetPath.startsWith(this.options.dir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      
      try {
        const stat = fs.statSync(targetPath);
        
        if (stat.isDirectory()) {
          // 目录访问：如果启用索引则显示，否则禁止
          if (!this.options.indexEnabled) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Directory browsing disabled');
            return;
          }
          
          const html = this.generateDirectoryListing(targetPath, pathname);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } else {
          // 服务文件
          const mimeType = this.getMimeType(targetPath);
          const fileSize = stat.size;
          
          res.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Length': fileSize,
            'Content-Disposition': `inline; filename="${path.basename(targetPath)}"`
          });
          
          const readStream = fs.createReadStream(targetPath);
          readStream.pipe(res);
          
          console.log(`📥 下载文件: ${pathname} (${this.formatFileSize(fileSize)})`);
        }
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      }
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }
  }
  
  // 下载ngrok
  async downloadNgrok() {
    const platform = os.platform();
    const arch = os.arch();
    
    let downloadUrl;
    let executable = 'ngrok';
    
    // 使用ngrok v3的新下载链接
    if (platform === 'win32') {
      downloadUrl = arch === 'x64' ? 
        'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' :
        'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-386.zip';
      executable = 'ngrok.exe';
    } else if (platform === 'darwin') {
      downloadUrl = arch === 'arm64' ?
        'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip' :
        'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip';
    } else {
      downloadUrl = arch === 'x64' ?
        'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip' :
        'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-386.zip';
    }
    
    const ngrokDir = path.join(__dirname, '../../.ngrok');
    const ngrokPath = path.join(ngrokDir, executable);
    
    // 检查是否已存在并验证版本
    if (fs.existsSync(ngrokPath)) {
      try {
        // 检查ngrok版本
        const { execSync } = require('child_process');
        const versionOutput = execSync(`"${ngrokPath}" version`, { encoding: 'utf8', timeout: 5000 });
        
        // 检查是否为v3版本
        if (versionOutput.includes('ngrok version 3.') || versionOutput.includes('ngrok version 4.')) {
          return ngrokPath;
        } else {
          console.log('🔄 检测到旧版本ngrok，正在更新到最新版本...');
          // 删除旧版本
          fs.unlinkSync(ngrokPath);
        }
      } catch (error) {
        console.log('🔄 ngrok版本检查失败，重新下载最新版本...');
        // 删除可能损坏的文件
        try {
          fs.unlinkSync(ngrokPath);
        } catch {}
      }
    }
    
    console.log('🔄 正在下载ngrok...');
    
    if (!fs.existsSync(ngrokDir)) {
      fs.mkdirSync(ngrokDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      const zipPath = path.join(ngrokDir, 'ngrok.zip');
      const file = fs.createWriteStream(zipPath);
      
      const request = https.get(downloadUrl, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          
          // 解压文件
          exec(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${ngrokDir}' -Force"`, (error) => {
            if (error) {
              console.error('解压ngrok失败:', error);
              reject(error);
              return;
            }
            
            // 删除zip文件
            fs.unlinkSync(zipPath);
            
            // 在Unix系统上设置执行权限
            if (platform !== 'win32') {
              fs.chmodSync(ngrokPath, 0o755);
            }
            
            console.log('✅ ngrok下载完成');
            resolve(ngrokPath);
          });
        });
      });
      
      request.on('error', (error) => {
        fs.unlinkSync(zipPath);
        reject(error);
      });
    });
  }
  
  // 启动ngrok隧道
  async startTunnel() {
    try {
      const ngrokPath = await this.downloadNgrok();
      
      console.log('🚇 启动公网隧道...');
      
      // 清除可能冲突的代理环境变量
      const env = { ...process.env };
      delete env.http_proxy;
      delete env.https_proxy;
      delete env.HTTP_PROXY;
      delete env.HTTPS_PROXY;
      
      this.ngrokProcess = spawn(ngrokPath, ['http', this.options.port.toString()], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env
      });
      
      return new Promise((resolve) => {
        let output = '';
        let errorOutput = '';
        
        this.ngrokProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        this.ngrokProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        this.ngrokProcess.on('error', (error) => {
          console.error('❌ ngrok进程启动失败:', error.message);
          resolve(null);
        });
        
        this.ngrokProcess.on('exit', (code) => {
          if (code !== 0) {
            console.error('❌ ngrok进程异常退出，代码:', code);
            if (errorOutput) {
              console.error('错误输出:', errorOutput);
            }
            console.log('\n💡 ngrok常见问题解决方案:');
            if (errorOutput.includes('ERR_NGROK_121') || errorOutput.includes('version') && errorOutput.includes('too old')) {
              console.log('   ⚠️  ngrok版本过旧错误:');
              console.log('      - 免费账户要求ngrok版本 >= 3.7.0');
              console.log('      - 已自动下载最新版本，请重试');
              console.log('      - 或者升级到付费账户以使用旧版本');
            }
            if (errorOutput.includes('ERR_NGROK_9009') || errorOutput.includes('proxy') && errorOutput.includes('enterprise')) {
              console.log('   ⚠️  代理设置错误 (ERR_NGROK_9009):');
              console.log('      - 检测到网络代理配置，但这是企业功能');
              console.log('      - 解决方案:');
              console.log('        1. 临时取消代理: set http_proxy= && set https_proxy=');
              console.log('        2. 检查ngrok配置文件中的proxy_url设置');
              console.log('        3. 使用直连网络（不通过代理）');
              console.log('        4. 或升级到企业版以支持代理');
            }
            if (errorOutput.includes('config upgrade') || errorOutput.includes('version') && errorOutput.includes('required')) {
              console.log('   ⚠️  配置文件需要升级:');
              console.log('      - 运行: ngrok config upgrade');
              console.log('      - 或删除旧配置文件重新设置');
            }
            console.log('   1. 首次使用需要注册并设置authtoken:');
            console.log('      - 访问 https://ngrok.com/ 注册账号');
            console.log('      - 获取authtoken并运行: ngrok authtoken <your-token>');
            console.log('   2. 检查网络连接是否正常');
            console.log('   3. 确认端口未被占用');
            console.log('   4. 尝试手动运行: ngrok http ' + this.options.port);
            resolve(null);
          }
        });
        
        // 等待ngrok启动并获取URL - 多次重试
        let attempts = 0;
        const maxAttempts = 20; // 增加到20次
        const retryInterval = 3000; // 增加到3秒
        
        const tryGetTunnels = async () => {
          attempts++;
          try {
            const response = await this.getNgrokTunnels();
            if (response && response.tunnels && response.tunnels.length > 0) {
              this.publicUrl = response.tunnels[0].public_url;
              console.log(`🌐 公网访问地址: ${this.publicUrl}`);
              
              // 生成二维码
              await this.displayQRCode(this.publicUrl, '公网');
              
              resolve(this.publicUrl);
              return;
            }
          } catch (error) {
            console.log(`⏳ 等待ngrok启动... (尝试 ${attempts}/${maxAttempts}) - ${error.message || 'API未就绪'}`);
          }
          
          if (attempts < maxAttempts) {
            setTimeout(tryGetTunnels, retryInterval);
          } else {
            console.log('⚠️  ngrok隧道连接超时，可能原因:');
            console.log('   1. ngrok进程已退出（需要authtoken配置）');
            console.log('   2. 网络连接问题');
            console.log('   3. ngrok API端点不可访问');
            console.log(`   4. 尝试手动访问: http://localhost:4040`);
            console.log('\n🔧 建议操作:');
            console.log('   - 先手动运行: ngrok http ' + this.options.port);
            console.log('   - 确认ngrok正常工作后再使用 --tunnel 选项');
            resolve(null);
          }
        };
        
        // 初始延迟3秒后开始尝试
        setTimeout(tryGetTunnels, 3000);
      });
    } catch (error) {
      console.error('❌ 启动隧道失败:', error);
      return null;
    }
  }
  
  // 获取ngrok隧道信息
  getNgrokTunnels() {
    return new Promise((resolve, reject) => {
      // 首先尝试IPv4
      const tryRequest = (host) => {
        // IPv6地址需要用方括号包围
        const url = host.includes(':') ? `http://[${host}]:4040/api/tunnels` : `http://${host}:4040/api/tunnels`;
        
        const req = http.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(error);
            }
          });
        });
        
        req.on('error', (error) => {
          if (host === '127.0.0.1') {
            // IPv4失败，尝试IPv6
            tryRequest('::1');
          } else {
            reject(error);
          }
        });
        
        req.setTimeout(3000, () => {
          req.destroy();
          if (host === '127.0.0.1') {
            // IPv4超时，尝试IPv6
            tryRequest('::1');
          } else {
            reject(new Error('Connection timeout'));
          }
        });
      };
      
      // 优先尝试IPv4
      tryRequest('127.0.0.1');
    });
  }
  
  // 启动服务器
  async start() {
    // 验证目录
    if (!fs.existsSync(this.options.dir)) {
      throw new Error(`目录不存在: ${this.options.dir}`);
    }
    
    const stat = fs.statSync(this.options.dir);
    if (!stat.isDirectory()) {
      throw new Error(`路径不是目录: ${this.options.dir}`);
    }
    
    // 创建HTTP服务器
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
    
    // 启动服务器
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, '0.0.0.0', async () => {
        const localIp = this.getLocalIpAddress();
        
        console.log('🚀 Share Server 启动成功!');
        console.log(`📁 分享目录: ${this.options.dir}`);
        if (this.options.authEnabled) {
          console.log(`👤 认证信息: ${this.options.username} / ${this.options.password}`);
        } else {
          console.log(`🔓 访问模式: 免密访问 (任何人可访问)`);
        }
        console.log(`📡 本地访问: http://localhost:${this.options.port}`);
        if (localIp) {
          const lanUrl = `http://${localIp}:${this.options.port}`;
          console.log(`🌐 局域网访问: ${lanUrl}`);
          
          // 为局域网地址生成二维码
          await this.displayQRCode(lanUrl, '局域网');
        }
        
        // 启动公网隧道
        if (this.options.tunnel) {
          await this.startTunnel();
        }
        
        console.log('\n按 Ctrl+C 停止服务器');
        
        // 设置优雅关闭处理
        const gracefulShutdown = () => {
          console.log('\n🛑 正在关闭服务器...');
          this.server.close(() => {
            console.log('✅ 服务器已安全关闭');
            process.exit(0);
          });
        };
        
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
        
        // 保持服务器运行，不要resolve Promise
        // resolve(); // 移除这行，让服务器持续运行
      });
      
      this.server.on('error', reject);
    });
  }
  
  getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    const preferredAddresses = [];
    const otherAddresses = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const ip = iface.address;
          
          // 优先使用10.x.x.x或192.168.x.x网段
          if (ip.startsWith('10.') || ip.startsWith('192.168.')) {
            preferredAddresses.push(ip);
          } else if (!ip.startsWith('172.')) {
            // 其他非172网段的地址作为备选
            otherAddresses.push(ip);
          }
          // 跳过172.x.x.x网段的地址
        }
      }
    }
    
    // 优先返回10或192.168网段的地址
    if (preferredAddresses.length > 0) {
      return preferredAddresses[0];
    }
    
    // 如果没有优选地址，返回其他非172网段的地址
    if (otherAddresses.length > 0) {
      return otherAddresses[0];
    }
    
    return null;
  }
  
  // 停止服务器
  stop() {
    if (this.server) {
      this.server.close();
      console.log('🛑 HTTP服务器已停止');
    }
    
    if (this.ngrokProcess) {
      this.ngrokProcess.kill();
      console.log('🛑 隧道已关闭');
    }
    
    if (this.rl) {
      this.rl.close();
    }
  }
  
  // 询问用户输入
  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
  
  // 启动配置向导
  async startWizard() {
    console.log('\n📁 Share Server 配置向导');
    console.log('================================================================================');
    console.log('🚀 欢迎使用本地目录分享服务器！');
    console.log('💡 此向导将帮助您快速配置分享服务器的各项设置');
    console.log('📝 您可以随时按 Ctrl+C 取消配置\n');
    
    try {
      // 步骤0: 选择工作模式
      const mode = await this.selectMode();
      
      if (mode === 'port-map') {
        // 端口映射模式
        const localPort = await this.configureLocalPort();
        await this.startPortMapping(localPort);
      } else {
        // 文件分享模式
        // 步骤1: 选择分享目录
        const shareDir = await this.selectDirectory();
        
        // 步骤2: 配置服务器端口
        const port = await this.configurePort();
        
        // 步骤3: 配置认证信息
        const auth = await this.configureAuthentication();
        
        // 步骤4: 选择功能选项
        const features = await this.configureFeatures();
        
        // 步骤5: 高级配置（可选）
        const advanced = await this.configureAdvanced();
        
        // 步骤6: 确认配置并启动
        await this.confirmAndStart({
          dir: shareDir,
          port: port,
          username: auth.username,
          password: auth.password,
          authEnabled: auth.authEnabled,
          ...features,
          ...advanced
        });
      }
      
    } catch (error) {
      if (error.message === 'USER_CANCELLED') {
        console.log('\n❌ 配置已取消');
        process.exit(0);
      }
      throw error;
    }
  }
  
  // 步骤0: 选择工作模式
  async selectMode() {
    console.log('⚙️ 步骤 0/6: 选择工作模式');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('💡 请选择您要使用的模式：\n');
    
    console.log('📂 模式选项:');
    console.log('  1. 文件分享模式 - 分享本地目录作为网站 (支持上传、下载、浏览)');
    console.log('  2. 端口映射模式 - 直接映射本地端口到外网 (无需分享目录)\n');
    
    while (true) {
      const choice = await this.askQuestion('请选择 (1-2): ');
      
      switch (choice) {
        case '1':
          return 'file-share';
        case '2':
          return 'port-map';
        default:
          console.log('❌ 无效选择，请输入 1 或 2');
      }
    }
  }
  
  // 配置本地端口（端口映射模式）
  async configureLocalPort() {
    console.log('\n🌐 配置本地端口映射');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('💡 请输入要映射到外网的本地端口号\n');
    
    while (true) {
      const portInput = await this.askQuestion('本地端口 (1024-65535): ');
      const port = parseInt(portInput);
      
      if (isNaN(port) || port < 1024 || port > 65535) {
        console.log('❌ 端口必须是 1024-65535 之间的数字');
        continue;
      }
      
      return port;
    }
  }
  
  // 启动端口映射
  async startPortMapping(localPort) {
    console.log('\n🚀 启动端口映射模式');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log(`📡 本地端口: ${localPort}`);
    console.log('🌐 正在启动外网隧道...\n');
    
    // 创建最小配置用于端口映射
    this.options = {
      port: localPort,
      tunnel: true,
      portMapMode: true
    };
    
    try {
      const tunnelUrl = await this.startTunnel();
      if (tunnelUrl) {
        console.log(`✅ 端口映射成功！`);
        console.log(`🔗 外网访问地址: ${tunnelUrl}`);
        console.log(`📱 二维码:`);
        await this.displayQRCode(tunnelUrl, '外网');
        console.log('\n💡 现在您可以通过外网地址访问本地端口服务');
        console.log('\n按 Ctrl+C 停止映射');
        
        // 设置优雅关闭处理
        const gracefulShutdown = () => {
          console.log('\n🛑 正在关闭端口映射...');
          if (this.ngrokProcess) {
            this.ngrokProcess.kill();
            console.log('✅ 端口映射已关闭');
          }
          process.exit(0);
        };
        
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
        
        // 保持运行
        await new Promise(() => {}); // 永远等待
      } else {
        console.log('❌ 端口映射启动失败');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 端口映射失败:', error.message);
      process.exit(1);
    }
  }
  
  // 步骤1: 选择分享目录
  async selectDirectory() {
    console.log('📂 步骤 1/6: 选择要分享的目录');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    
    const currentDir = process.cwd();
    console.log(`💡 当前目录: ${currentDir}`);
    
    // 列出当前目录下的文件夹
    const dirs = fs.readdirSync(currentDir).filter(item => {
      try {
        return fs.statSync(path.join(currentDir, item)).isDirectory();
      } catch {
        return false;
      }
    }).slice(0, 10); // 只显示前10个
    
    if (dirs.length > 0) {
      console.log('\n📁 当前目录下的文件夹:');
      dirs.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir}/`);
      });
      console.log(`  ${dirs.length + 1}. 使用当前目录 (${path.basename(currentDir)})`);
      console.log(`  ${dirs.length + 2}. 手动输入路径`);
      
      const choice = await this.askQuestion(`\n请选择 (1-${dirs.length + 2}): `);
      const choiceNum = parseInt(choice);
      
      if (choiceNum >= 1 && choiceNum <= dirs.length) {
        return path.join(currentDir, dirs[choiceNum - 1]);
      } else if (choiceNum === dirs.length + 1) {
        return currentDir;
      } else if (choiceNum === dirs.length + 2) {
        // 手动输入
        const customPath = await this.askQuestion('请输入目录路径: ');
        if (!customPath) throw new Error('USER_CANCELLED');
        
        if (!fs.existsSync(customPath)) {
          console.log(`❌ 目录不存在: ${customPath}`);
          return await this.selectDirectory();
        }
        
        if (!fs.statSync(customPath).isDirectory()) {
          console.log(`❌ 路径不是目录: ${customPath}`);
          return await this.selectDirectory();
        }
        
        return path.resolve(customPath);
      } else {
        console.log('❌ 无效选择，请重试');
        return await this.selectDirectory();
      }
    } else {
      console.log('\n💡 当前目录下没有子文件夹');
      console.log('1. 使用当前目录');
      console.log('2. 手动输入路径');
      
      const choice = await this.askQuestion('请选择 (1-2): ');
      
      if (choice === '1') {
        return currentDir;
      } else if (choice === '2') {
        const customPath = await this.askQuestion('请输入目录路径: ');
        if (!customPath) throw new Error('USER_CANCELLED');
        
        if (!fs.existsSync(customPath) || !fs.statSync(customPath).isDirectory()) {
          console.log('❌ 目录无效，请重试');
          return await this.selectDirectory();
        }
        
        return path.resolve(customPath);
      } else {
        console.log('❌ 无效选择，请重试');
        return await this.selectDirectory();
      }
    }
  }
  
  // 步骤2: 配置服务器端口
  async configurePort() {
    console.log('\n🌐 步骤 2/6: 配置服务器端口');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('💡 建议使用 1024-65535 范围内的端口');
    console.log('⚠️  请确保选择的端口未被其他程序占用\n');
    
    console.log('常用端口推荐:');
    console.log('  1. 33333 (默认)');
    console.log('  2. 8080 (HTTP备用)');
    console.log('  3. 3000 (开发常用)');
    console.log('  4. 8000 (简单HTTP)');
    console.log('  5. 自定义端口');
    
    const choice = await this.askQuestion('请选择 (1-5): ');
    
    switch (choice) {
      case '1':
        return 33333;
      case '2':
        return 8080;
      case '3':
        return 3000;
      case '4':
        return 8000;
      case '5':
        const customPort = await this.askQuestion('请输入端口号 (1024-65535): ');
        const port = parseInt(customPort);
        if (isNaN(port) || port < 1024 || port > 65535) {
          console.log('❌ 端口号无效，请输入 1024-65535 范围内的数字');
          return await this.configurePort();
        }
        return port;
      default:
        console.log('❌ 无效选择，请重试');
        return await this.configurePort();
    }
  }
  
  // 步骤3: 配置认证信息
  async configureAuthentication() {
    console.log('\n🔒 步骤 3/6: 配置访问认证');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('🛡️  认证可以保护您的文件不被未授权访问');
    console.log('💡 对于本地使用或信任环境，可以选择禁用认证\n');
    
    console.log('认证模式:');
    console.log('  1. 启用认证 (推荐)');
    console.log('  2. 禁用认证 (免密访问)');
    
    const authChoice = await this.askQuestion('请选择认证模式 (1-2): ');
    
    if (authChoice === '2') {
      console.log('⚠️  警告: 已选择免密访问模式，任何人都可以访问您的文件');
      return { authEnabled: false };
    }
    
    // 启用认证模式
    const username = await this.askQuestion('用户名 (默认: admin): ') || 'admin';
    
    console.log('\n密码选项:');
    console.log('  1. 使用默认密码 (password)');
    console.log('  2. 生成随机密码');
    console.log('  3. 自定义密码');
    
    const choice = await this.askQuestion('请选择 (1-3): ');
    let password;
    
    switch (choice) {
      case '1':
        password = 'password';
        break;
      case '2':
        password = this.generateRandomPassword();
        console.log(`🎲 生成的随机密码: ${password}`);
        break;
      case '3':
        password = await this.askQuestion('请输入密码: ');
        if (!password) {
          console.log('❌ 密码不能为空');
          return await this.configureAuthentication();
        }
        break;
      default:
        console.log('❌ 无效选择，请重试');
        return await this.configureAuthentication();
    }
    
    return { authEnabled: true, username, password };
  }
  
  // 步骤4: 配置功能选项
  async configureFeatures() {
    console.log('\n⚙️ 步骤 4/6: 选择功能特性');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    
    const features = {};
    
    // 目录浏览功能
    console.log('📂 目录浏览功能:');
    console.log('   启用后用户可以浏览目录结构，否则只能通过直接链接访问文件');
    const indexChoice = await this.askQuestion('是否启用目录浏览? (Y/n): ');
    features.index = indexChoice.toLowerCase() !== 'n';
    
    // 文件上传大小限制
    console.log('\n📤 文件上传配置:');
    console.log('   1. 10MB (适合文档)');
    console.log('   2. 50MB (适合图片)');
    console.log('   3. 100MB (适合小视频)');
    console.log('   4. 500MB (适合大文件)');
    console.log('   5. 自定义');
    
    const uploadChoice = await this.askQuestion('选择最大上传文件大小 (1-5): ');
    switch (uploadChoice) {
      case '1':
        features.maxUpload = '10MB';
        break;
      case '2':
        features.maxUpload = '50MB';
        break;
      case '3':
        features.maxUpload = '100MB';
        break;
      case '4':
        features.maxUpload = '500MB';
        break;
      case '5':
        const customSize = await this.askQuestion('请输入大小 (如: 200MB, 1GB): ');
        features.maxUpload = customSize || '10MB';
        break;
      default:
        features.maxUpload = '10MB';
    }
    
    // 公网访问
    console.log('\n🌐 公网访问功能:');
    console.log('   启用后会自动下载 ngrok 并创建公网隧道，任何人都可以通过公网URL访问');
    console.log('   ⚠️  请注意公网访问的安全风险');
    const tunnelChoice = await this.askQuestion('是否启用公网访问? (y/N): ');
    features.tunnel = tunnelChoice.toLowerCase() === 'y';
    
    return features;
  }
  
  // 步骤5: 高级配置
  async configureAdvanced() {
    console.log('\n🛠️ 步骤 5/6: 高级配置 (可选)');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    
    const skipAdvanced = await this.askQuestion('是否跳过高级配置? (Y/n): ');
    if (skipAdvanced.toLowerCase() !== 'n') {
      return { corsOrigin: '*' };
    }
    
    const advanced = {};
    
    // CORS配置
    console.log('\n🌐 CORS (跨域资源共享) 配置:');
    console.log('   1. 允许所有域名 (*)');
    console.log('   2. 只允许本地访问 (localhost)');
    console.log('   3. 自定义域名');
    
    const corsChoice = await this.askQuestion('请选择 (1-3): ');
    switch (corsChoice) {
      case '1':
        advanced.corsOrigin = '*';
        break;
      case '2':
        advanced.corsOrigin = 'localhost';
        break;
      case '3':
        const customOrigin = await this.askQuestion('请输入允许的域名 (如: https://example.com): ');
        advanced.corsOrigin = customOrigin || '*';
        break;
      default:
        advanced.corsOrigin = '*';
    }
    
    // 自定义MIME类型
    console.log('\n📄 自定义文件类型支持:');
    const customMimeChoice = await this.askQuestion('是否需要添加自定义文件类型? (y/N): ');
    if (customMimeChoice.toLowerCase() === 'y') {
      console.log('💡 格式: 扩展名:MIME类型,扩展名:MIME类型');
      console.log('📝 例如: log:text/plain,py:text/x-python');
      const customMime = await this.askQuestion('请输入自定义MIME类型映射: ');
      advanced.customMime = customMime;
    }
    
    return advanced;
  }
  
  // 步骤6: 确认配置并启动
  async confirmAndStart(config) {
    console.log('\n✅ 步骤 6/6: 配置确认');
    console.log('================================================================================');
    console.log('📋 请确认以下配置信息:\n');
    
    console.log(`📁 分享目录: ${config.dir}`);
    console.log(`🌐 服务端口: ${config.port}`);
    if (config.authEnabled) {
      console.log(`👤 认证信息: ${config.username} / ${config.password}`);
    } else {
      console.log(`🔓 访问认证: ❌ 禁用 (免密访问)`);
    }
    console.log(`📂 目录浏览: ${config.index ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`📤 最大上传: ${config.maxUpload}`);
    console.log(`🌍 公网访问: ${config.tunnel ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`🔗 CORS策略: ${config.corsOrigin}`);
    if (config.customMime) {
      console.log(`📄 自定义MIME: ${config.customMime}`);
    }
    
    const confirm = await this.askQuestion('\n是否确认启动服务器? (Y/n): ');
    if (confirm.toLowerCase() === 'n') {
      console.log('❌ 启动已取消');
      return;
    }
    
    console.log('\n🚀 正在启动服务器...\n');
    
    // 关闭readline，准备启动服务器
    this.rl.close();
    
    // 更新配置
    this.options = {
      dir: config.dir,
      port: parseInt(config.port),
      username: config.username || 'admin',
      password: config.password || 'password',
      maxUpload: this.parseSize(config.maxUpload),
      corsOrigin: config.corsOrigin,
      tunnel: config.tunnel,
      customMimeTypes: this.parseCustomMimeTypes(config.customMime || ''),
      indexEnabled: config.index,
      authEnabled: config.authEnabled === true  // 明确检查是否为true
    };
    
    // 启动服务器
    await this.start();
  }
  
  // 生成随机密码
  generateRandomPassword(length = 12) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
  
  // 显示二维码
  async displayQRCode(url, title = '公网') {
    try {
      console.log(`\n📱 ${title}访问二维码:`);
      
      // 生成ASCII二维码
      const qrCodeString = await QRCode.toString(url, {
        type: 'terminal',
        small: true,
        width: 40
      });
      
      console.log(qrCodeString);
      console.log(`🔗 访问地址: ${url}`);
      console.log('💡 使用手机扫描上方二维码即可访问\n');
      
    } catch (error) {
      console.log(`\n📱 ${title}访问地址: ${url}`);
      console.log('❌ 二维码生成失败，请手动输入地址访问\n');
    }
  }
}

// 主函数
async function startShareServer(options) {
  // 如果启用端口映射模式
  if (options.portMap) {
    const server = new ShareServer(options);
    const port = parseInt(options.portMap);
    
    if (isNaN(port) || port < 1024 || port > 65535) {
      console.error('❌ 端口必须是 1024-65535 之间的数字');
      process.exit(1);
    }
    
    console.log('🚀 启动端口映射模式');
    console.log(`📡 本地端口: ${port}`);
    console.log('🌐 正在启动外网隧道...\n');
    
    // 设置端口映射配置
    server.options = {
      port: port,
      tunnel: true,
      portMapMode: true
    };
    
    try {
      const tunnelUrl = await server.startTunnel();
      if (tunnelUrl) {
        console.log(`✅ 端口映射成功！`);
        console.log(`🔗 外网访问地址: ${tunnelUrl}`);
        console.log(`📱 二维码:`);
        await server.displayQRCode(tunnelUrl, '外网');
        console.log('\n💡 现在您可以通过外网地址访问本地端口服务');
        console.log('\n按 Ctrl+C 停止映射');
        
        // 设置优雅关闭处理
        const gracefulShutdown = () => {
          console.log('\n🛑 正在关闭端口映射...');
          if (server.ngrokProcess) {
            server.ngrokProcess.kill();
            console.log('✅ 端口映射已关闭');
          }
          process.exit(0);
        };
        
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
        
        // 保持运行
        await new Promise(() => {}); // 永远等待
      } else {
        console.log('❌ 端口映射启动失败');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 端口映射失败:', error.message);
      process.exit(1);
    }
    return;
  }
  
  // 如果启用向导模式或者没有提供必要参数，启动向导
  if (options.wizard || !options.dir) {
    const server = new ShareServer(options);
    
    // 处理退出信号
    process.on('SIGINT', () => {
      console.log('\n🛑 正在停止服务器...');
      server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      server.stop();
      process.exit(0);
    });
    
    try {
      await server.startWizard();
    } catch (error) {
      console.error('❌ 向导执行失败:', error.message);
      process.exit(1);
    }
  } else {
    // 直接启动模式
    const server = new ShareServer(options);
    
    // 处理退出信号
    process.on('SIGINT', () => {
      console.log('\n🛑 正在停止服务器...');
      server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      server.stop();
      process.exit(0);
    });
    
    try {
      await server.start();
    } catch (error) {
      console.error('❌ 启动服务器失败:', error.message);
      process.exit(1);
    }
  }
}

module.exports = { startShareServer };