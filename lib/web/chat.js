/**
 * Claude Remote Dev - 截屏显示前端
 */

class ClaudeScreenViewer {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.sessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // 文件管理相关状态
        this.currentMode = 'screenshot'; // 'screenshot' 或 'file'
        this.currentPath = '';
        this.currentFile = null;
        this.fileContent = '';
        this.isModified = false;
        
        // 任务管理相关状态
        this.tasks = new Map();
        this.currentTaskOutputId = null;
        
        this.initializeElements();
        this.bindEvents();
        this.connect();
    }

    /**
     * 初始化DOM元素
     */
    initializeElements() {
        this.elements = {
            // 截屏相关元素
            screenshotImage: document.getElementById('screenshotImage'),
            loadingText: document.getElementById('loadingText'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            statusIndicator: document.getElementById('statusIndicator'),
            serverName: document.getElementById('serverName'),
            // 快捷按钮
            upBtn: document.getElementById('upBtn'),
            downBtn: document.getElementById('downBtn'),
            enterBtn: document.getElementById('enterBtn'),
            altMBtn: document.getElementById('altMBtn'),
            ctrlCBtn: document.getElementById('ctrlCBtn'),
            ctrlVBtn: document.getElementById('ctrlVBtn'),
            // 文件管理相关元素
            modeSwitch: document.getElementById('modeSwitch'),
            fileManager: document.getElementById('fileManager'),
            fileBreadcrumb: document.getElementById('fileBreadcrumb'),
            fileList: document.getElementById('fileList'),
            // 文件编辑器相关元素
            fileEditor: document.getElementById('fileEditor'),
            editorCloseBtn: document.getElementById('editorCloseBtn'),
            editorTitle: document.getElementById('editorTitle'),
            editorSaveBtn: document.getElementById('editorSaveBtn'),
            editorTextarea: document.getElementById('editorTextarea'),
            // 任务管理相关元素
            screenshotModeBtn: document.getElementById('screenshotModeBtn'),
            fileModeBtn: document.getElementById('fileModeBtn'),
            taskModeBtn: document.getElementById('taskModeBtn'),
            taskManager: document.getElementById('taskManager'),
            newTaskBtn: document.getElementById('newTaskBtn'),
            taskList: document.getElementById('taskList'),
            taskDialog: document.getElementById('taskDialog'),
            taskDialogCloseBtn: document.getElementById('taskDialogCloseBtn'),
            taskDialogCancelBtn: document.getElementById('taskDialogCancelBtn'),
            taskDialogCreateBtn: document.getElementById('taskDialogCreateBtn'),
            taskNameInput: document.getElementById('taskNameInput'),
            taskCommandInput: document.getElementById('taskCommandInput'),
            taskWorkDirInput: document.getElementById('taskWorkDirInput'),
            taskOutput: document.getElementById('taskOutput'),
            taskOutputTitle: document.getElementById('taskOutputTitle'),
            taskOutputText: document.getElementById('taskOutputText'),
            taskOutputCopyBtn: document.getElementById('taskOutputCopyBtn'),
            taskOutputClearBtn: document.getElementById('taskOutputClearBtn'),
            taskOutputCloseBtn: document.getElementById('taskOutputCloseBtn')
        };
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 发送按钮点击
        this.elements.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // 输入框回车发送
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 快捷按钮事件
        this.elements.upBtn.addEventListener('click', () => this.sendKey('UP'));
        this.elements.downBtn.addEventListener('click', () => this.sendKey('DOWN'));
        this.elements.enterBtn.addEventListener('click', () => this.sendKey('ENTER'));
        this.elements.altMBtn.addEventListener('click', () => this.sendKey('ALT_M'));
        this.elements.ctrlCBtn.addEventListener('click', () => this.sendKey('CTRL_C'));
        this.elements.ctrlVBtn.addEventListener('click', () => this.sendKey('CTRL_V'));

        // 模式切换事件
        this.elements.screenshotModeBtn.addEventListener('click', () => this.switchMode('screenshot'));
        this.elements.fileModeBtn.addEventListener('click', () => this.switchMode('file'));
        this.elements.taskModeBtn.addEventListener('click', () => this.switchMode('task'));
        
        // 文件编辑器事件
        this.elements.editorCloseBtn.addEventListener('click', () => this.closeEditor());
        this.elements.editorSaveBtn.addEventListener('click', () => this.saveFile());
        
        // 监听编辑器内容变化
        this.elements.editorTextarea.addEventListener('input', () => {
            this.isModified = true;
            this.updateEditorTitle();
        });
        
        // 文件列表点击事件委托
        this.elements.fileList.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                this.handleFileItemClick(fileItem);
            }
        });

        // 任务管理相关事件
        this.elements.newTaskBtn.addEventListener('click', () => this.showTaskDialog());
        this.elements.taskDialogCloseBtn.addEventListener('click', () => this.hideTaskDialog());
        this.elements.taskDialogCancelBtn.addEventListener('click', () => this.hideTaskDialog());
        this.elements.taskDialogCreateBtn.addEventListener('click', () => this.createTask());
        this.elements.taskOutputCloseBtn.addEventListener('click', () => this.hideTaskOutput());
        this.elements.taskOutputClearBtn.addEventListener('click', () => this.clearTaskOutput());
        this.elements.taskOutputCopyBtn.addEventListener('click', () => this.copyTaskOutput());

        // 任务列表点击事件委托
        this.elements.taskList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button) {
                const taskId = parseInt(button.dataset.taskId);
                const action = button.dataset.action;
                
                if (action === 'view') {
                    this.showTaskOutput(taskId);
                } else if (action === 'stop') {
                    this.stopTask(taskId);
                } else if (action === 'restart') {
                    this.restartTask(taskId);
                } else if (action === 'delete') {
                    this.deleteTask(taskId);
                }
            }
        });

        // 页面卸载时关闭连接
        window.addEventListener('beforeunload', () => {
            if (this.ws) {
                this.ws.close();
            }
        });
    }

    /**
     * 连接WebSocket
     */
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.updateConnectionStatus('连接中...', false);
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.setupWebSocketEvents();
        } catch (error) {
            console.error('WebSocket连接失败:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * 设置WebSocket事件
     */
    setupWebSocketEvents() {
        this.ws.onopen = () => {
            console.log('WebSocket连接已建立');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('已连接', true);
            this.enableInput();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('消息解析错误:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket连接关闭:', event.code, event.reason);
            this.isConnected = false;
            this.disableInput();
            
            if (!event.wasClean) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
            this.updateConnectionStatus('连接错误', false);
        };
    }

    /**
     * 处理WebSocket消息
     */
    handleMessage(message) {
        switch (message.type) {
            case 'welcome':
                this.sessionId = message.sessionId;
                this.elements.serverName.textContent = message.serverName || 'Claude Dev Server';
                break;

            case 'screenshot':
                this.displayScreenshot(message.data);
                break;

            case 'error':
                console.error('服务器错误:', message.message);
                break;

            case 'task_update':
                this.handleTaskUpdate(message.task);
                break;

            case 'task_output':
                this.handleTaskOutput(message.taskId, message.outputType, message.text);
                break;

            case 'task_deleted':
                this.handleTaskDeleted(message.taskId);
                break;

            default:
                console.log('未知消息类型:', message.type);
                break;
        }
    }

    /**
     * 显示截屏
     */
    displayScreenshot(base64Data) {
        if (base64Data) {
            this.elements.screenshotImage.src = `data:image/jpeg;base64,${base64Data}`;
            this.elements.screenshotImage.style.display = 'block';
            this.elements.loadingText.style.display = 'none';
        }
    }

    /**
     * 发送消息到Claude
     */
    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message || !this.isConnected) return;

        this.send({
            type: 'chat',
            message: message,
            timestamp: Date.now()
        });

        this.elements.messageInput.value = '';
    }

    /**
     * 发送WebSocket消息
     */
    send(message) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * 发送按键消息
     */
    sendKey(keyType) {
        if (!this.isConnected) return;

        this.send({
            type: 'key',
            key: keyType,
            timestamp: Date.now()
        });
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(status, connected) {
        this.elements.serverName.textContent = status;
        this.elements.statusIndicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
    }

    /**
     * 启用输入
     */
    enableInput() {
        this.elements.messageInput.disabled = false;
        this.elements.sendButton.disabled = false;
        // 启用快捷按钮
        this.elements.upBtn.disabled = false;
        this.elements.downBtn.disabled = false;
        this.elements.enterBtn.disabled = false;
        this.elements.altMBtn.disabled = false;
        this.elements.ctrlCBtn.disabled = false;
        this.elements.ctrlVBtn.disabled = false;
    }

    /**
     * 禁用输入
     */
    disableInput() {
        this.elements.messageInput.disabled = true;
        this.elements.sendButton.disabled = true;
        // 禁用快捷按钮
        this.elements.upBtn.disabled = true;
        this.elements.downBtn.disabled = true;
        this.elements.enterBtn.disabled = true;
        this.elements.altMBtn.disabled = true;
        this.elements.ctrlCBtn.disabled = true;
        this.elements.ctrlVBtn.disabled = true;
    }

    /**
     * 计划重连
     */
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            this.updateConnectionStatus(`重连中 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, false);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            this.updateConnectionStatus('连接失败', false);
        }
    }

    // === 模式管理方法 ===

    /**
     * 切换模式（截屏/文件/任务）
     */
    switchMode(mode) {
        // 更新当前模式
        this.currentMode = mode;
        
        // 更新按钮状态
        this.elements.screenshotModeBtn.classList.remove('active');
        this.elements.fileModeBtn.classList.remove('active');
        this.elements.taskModeBtn.classList.remove('active');
        
        // 隐藏所有内容区域
        document.querySelector('.screenshot-container').style.display = 'none';
        this.elements.fileManager.classList.remove('active');
        this.elements.taskManager.classList.remove('active');
        
        // 根据模式显示对应内容
        switch (mode) {
            case 'screenshot':
                this.elements.screenshotModeBtn.classList.add('active');
                document.querySelector('.screenshot-container').style.display = 'flex';
                break;
            case 'file':
                this.elements.fileModeBtn.classList.add('active');
                this.elements.fileManager.classList.add('active');
                this.loadFileList();
                break;
            case 'task':
                this.elements.taskModeBtn.classList.add('active');
                this.elements.taskManager.classList.add('active');
                this.loadTaskList();
                break;
        }
    }

    // === 文件管理方法 ===

    /**
     * 加载文件列表
     */
    async loadFileList(path = '') {
        this.currentPath = path;
        this.updateBreadcrumb();
        
        this.elements.fileList.innerHTML = '<div class="loading">正在加载文件列表...</div>';
        
        try {
            const response = await fetch(`/api/files/list?dir=${encodeURIComponent(path)}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderFileList(data.items);
            } else {
                this.elements.fileList.innerHTML = `<div class="error-message">加载失败: ${data.error}</div>`;
            }
        } catch (error) {
            this.elements.fileList.innerHTML = `<div class="error-message">网络错误: ${error.message}</div>`;
        }
    }

    /**
     * 更新路径导航
     */
    updateBreadcrumb() {
        if (this.currentPath) {
            this.elements.fileBreadcrumb.textContent = `项目/${this.currentPath}`;
        } else {
            this.elements.fileBreadcrumb.textContent = '项目根目录';
        }
    }

    /**
     * 渲染文件列表
     */
    renderFileList(items) {
        const html = items.map(item => {
            const icon = item.isDirectory ? '📁' : (item.isTextFile ? '📝' : '📄');
            const itemClass = item.isDirectory ? 'directory-item' : (item.isTextFile ? 'text-file-item' : 'file-item');
            const sizeText = item.isDirectory ? '' : this.formatFileSize(item.size);
            
            return `
                <div class="file-item ${itemClass}" data-path="${item.path}" data-is-directory="${item.isDirectory}" data-is-text="${item.isTextFile}">
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${item.name}</span>
                    <span class="file-size">${sizeText}</span>
                </div>
            `;
        }).join('');

        // 如果不在根目录，添加返回上级目录选项
        let backButton = '';
        if (this.currentPath) {
            const parentPath = this.currentPath.split('/').slice(0, -1).join('/');
            backButton = `
                <div class="file-item directory-item" data-path="${parentPath}" data-is-directory="true" data-is-text="false">
                    <span class="file-icon">⬆️</span>
                    <span class="file-name">.. (返回上级)</span>
                    <span class="file-size"></span>
                </div>
            `;
        }

        this.elements.fileList.innerHTML = backButton + html;
        
        // 使用事件委托，不需要重复绑定
        // 在构造函数中已经绑定了文件列表的点击事件
    }

    /**
     * 处理文件项点击
     */
    handleFileItemClick(fileItem) {
        const path = fileItem.dataset.path;
        const isDirectory = fileItem.dataset.isDirectory === 'true';
        const isTextFile = fileItem.dataset.isText === 'true';
        
        if (isDirectory) {
            this.loadFileList(path);
        } else if (isTextFile) {
            this.openFile(path);
        }
    }

    /**
     * 打开文件进行编辑
     */
    async openFile(filePath) {
        this.elements.fileEditor.classList.add('active');
        // 防止移动端背景滚动
        document.body.style.overflow = 'hidden';
        
        this.currentFile = filePath;
        this.elements.editorTitle.textContent = `编辑: ${filePath.split('/').pop()}`;
        this.elements.editorTextarea.value = '正在加载文件内容...';
        this.elements.editorTextarea.disabled = true;
        
        try {
            const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
            const data = await response.json();
            
            if (data.success) {
                this.fileContent = data.content;
                this.elements.editorTextarea.value = data.content;
                this.elements.editorTextarea.disabled = false;
                this.isModified = false;
                this.updateEditorTitle();
            } else {
                this.elements.editorTextarea.value = `加载失败: ${data.error}`;
            }
        } catch (error) {
            this.elements.editorTextarea.value = `网络错误: ${error.message}`;
        }
    }

    /**
     * 保存文件
     */
    async saveFile() {
        if (!this.currentFile) return;
        
        const content = this.elements.editorTextarea.value;
        this.elements.editorSaveBtn.textContent = '保存中...';
        this.elements.editorSaveBtn.disabled = true;
        
        try {
            const response = await fetch('/api/files/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: this.currentFile,
                    content: content
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.fileContent = content;
                this.isModified = false;
                this.updateEditorTitle();
                
                // 显示保存成功提示
                this.elements.editorSaveBtn.textContent = '已保存';
                setTimeout(() => {
                    this.elements.editorSaveBtn.textContent = '保存';
                    this.elements.editorSaveBtn.disabled = false;
                }, 1000);
            } else {
                alert(`保存失败: ${data.error}`);
                this.elements.editorSaveBtn.textContent = '保存';
                this.elements.editorSaveBtn.disabled = false;
            }
        } catch (error) {
            alert(`网络错误: ${error.message}`);
            this.elements.editorSaveBtn.textContent = '保存';
            this.elements.editorSaveBtn.disabled = false;
        }
    }

    /**
     * 关闭编辑器
     */
    closeEditor() {
        if (this.isModified) {
            if (!confirm('文件已修改，确定要关闭吗？未保存的修改将丢失。')) {
                return;
            }
        }
        
        this.elements.fileEditor.classList.remove('active');
        // 恢复背景滚动
        document.body.style.overflow = '';
        
        this.currentFile = null;
        this.fileContent = '';
        this.isModified = false;
        this.elements.editorTextarea.value = '';
    }

    /**
     * 更新编辑器标题
     */
    updateEditorTitle() {
        if (this.currentFile) {
            const fileName = this.currentFile.split('/').pop();
            const modifiedMark = this.isModified ? ' *' : '';
            this.elements.editorTitle.textContent = `编辑: ${fileName}${modifiedMark}`;
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // === 任务管理方法 ===

    /**
     * 加载任务列表
     */
    async loadTaskList() {
        try {
            const response = await fetch('/api/tasks');
            const data = await response.json();
            
            if (data.success) {
                this.tasks.clear();
                data.tasks.forEach(task => {
                    this.tasks.set(task.id, task);
                });
                this.renderTaskList();
            } else {
                console.error('加载任务列表失败:', data.error);
            }
        } catch (error) {
            console.error('加载任务列表失败:', error.message);
        }
    }

    /**
     * 渲染任务列表
     */
    renderTaskList() {
        if (this.tasks.size === 0) {
            this.elements.taskList.innerHTML = '<div class="task-empty">暂无运行任务</div>';
            return;
        }

        const html = Array.from(this.tasks.values()).map(task => {
            const statusClass = task.status === 'running' ? 'running' : 
                              task.status === 'finished' ? 'finished' : 'stopped';
            
            const statusText = task.status === 'running' ? '运行中' :
                              task.status === 'finished' ? '已完成' : '已停止';
                              
            const createdTime = new Date(task.createdAt).toLocaleString();
            
            return `
                <div class="task-item ${statusClass}">
                    <div class="task-info">
                        <div class="task-name">${task.name}</div>
                        <div class="task-command">${task.command}</div>
                        <div class="task-status ${statusClass}">${statusText} - ${createdTime}</div>
                    </div>
                    <div class="task-controls">
                        <button class="task-control-btn" data-task-id="${task.id}" data-action="view">查看</button>
                        ${task.status === 'running' ? 
                            `<button class="task-control-btn" data-task-id="${task.id}" data-action="stop">停止</button>` :
                            `<button class="task-control-btn" data-task-id="${task.id}" data-action="restart">重启</button>`}
                        <button class="task-control-btn" data-task-id="${task.id}" data-action="delete">删除</button>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.taskList.innerHTML = html;
    }

    /**
     * 显示新任务对话框
     */
    showTaskDialog() {
        this.elements.taskNameInput.value = '';
        this.elements.taskCommandInput.value = '';
        this.elements.taskWorkDirInput.value = '';
        this.elements.taskDialog.classList.add('active');
        this.elements.taskNameInput.focus();
    }

    /**
     * 隐藏新任务对话框
     */
    hideTaskDialog() {
        this.elements.taskDialog.classList.remove('active');
    }

    /**
     * 创建新任务
     */
    async createTask() {
        const name = this.elements.taskNameInput.value.trim();
        const command = this.elements.taskCommandInput.value.trim();
        const workDir = this.elements.taskWorkDirInput.value.trim();

        if (!name || !command) {
            alert('请输入任务名称和执行命令');
            return;
        }

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    command: command,
                    workDir: workDir || undefined
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.hideTaskDialog();
                // 任务列表会通过WebSocket更新
            } else {
                alert(`创建任务失败: ${data.error}`);
            }
        } catch (error) {
            alert(`创建任务失败: ${error.message}`);
        }
    }

    /**
     * 停止任务
     */
    async stopTask(taskId) {
        if (!confirm('确定要停止这个任务吗？')) {
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}/stop`, {
                method: 'POST'
            });

            const data = await response.json();
            
            if (!data.success) {
                alert(`停止任务失败: ${data.error}`);
            }
        } catch (error) {
            alert(`停止任务失败: ${error.message}`);
        }
    }

    /**
     * 重启任务
     */
    async restartTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        if (!confirm(`确定要重启任务 "${task.name}" 吗？之前的输出将被清空。`)) {
            return;
        }

        try {
            console.log(`[任务管理] 发送重启请求: /api/tasks/${taskId}/restart`);
            
            const response = await fetch(`/api/tasks/${taskId}/restart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log(`[任务管理] 重启响应状态: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[任务管理] 重启请求失败: ${response.status} - ${errorText}`);
                alert(`重启任务失败: HTTP ${response.status} - ${response.statusText}`);
                return;
            }

            const data = await response.json();
            console.log(`[任务管理] 重启响应数据:`, data);
            
            if (data.success) {
                // 如果正在查看该任务的输出，清空显示
                if (this.currentTaskOutputId === taskId && this.elements.taskOutput.classList.contains('active')) {
                    this.elements.taskOutputText.textContent = '任务重启中，等待输出...\n';
                }
            } else {
                alert(`重启任务失败: ${data.error}`);
            }
        } catch (error) {
            console.error(`[任务管理] 重启请求异常:`, error);
            alert(`重启任务失败: ${error.message}`);
        }
    }

    /**
     * 删除任务
     */
    async deleteTask(taskId) {
        if (!confirm('确定要删除这个任务吗？运行中的任务会被强制停止。')) {
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (!data.success) {
                alert(`删除任务失败: ${data.error}`);
            }
        } catch (error) {
            alert(`删除任务失败: ${error.message}`);
        }
    }

    /**
     * 显示任务输出
     */
    async showTaskOutput(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        this.currentTaskOutputId = taskId;
        this.elements.taskOutputTitle.textContent = `任务输出: ${task.name}`;
        
        // 加载任务输出
        try {
            const response = await fetch(`/api/tasks/${taskId}/output`);
            const data = await response.json();
            
            if (data.success) {
                const outputText = data.output.map(item => {
                    const time = new Date(item.timestamp).toLocaleTimeString();
                    return `[${time}] ${item.text}`;
                }).join('');
                
                this.elements.taskOutputText.textContent = outputText;
            } else {
                this.elements.taskOutputText.textContent = `加载输出失败: ${data.error}`;
            }
        } catch (error) {
            this.elements.taskOutputText.textContent = `加载输出失败: ${error.message}`;
        }

        this.elements.taskOutput.classList.add('active');
        
        // 确保滚动到底部
        setTimeout(() => {
            this.elements.taskOutputText.scrollTop = this.elements.taskOutputText.scrollHeight;
        }, 100);
    }

    /**
     * 隐藏任务输出
     */
    hideTaskOutput() {
        this.elements.taskOutput.classList.remove('active');
        this.currentTaskOutputId = null;
    }

    /**
     * 清空任务输出
     */
    clearTaskOutput() {
        this.elements.taskOutputText.textContent = '';
    }

    /**
     * 复制任务输出到剪贴板
     */
    async copyTaskOutput() {
        const outputText = this.elements.taskOutputText.textContent;
        
        if (!outputText.trim()) {
            alert('暂无输出内容可复制');
            return;
        }

        try {
            // 优先使用现代剪贴板API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(outputText);
                this.showCopySuccess();
            } else {
                // 回退到传统方法
                this.fallbackCopyTextToClipboard(outputText);
            }
        } catch (error) {
            console.error('复制失败:', error);
            // 如果现代API失败，尝试传统方法
            this.fallbackCopyTextToClipboard(outputText);
        }
    }

    /**
     * 传统复制方法（兼容老旧浏览器）
     */
    fallbackCopyTextToClipboard(text) {
        try {
            // 创建临时textarea元素
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // 设置样式使其不可见
            textArea.style.position = 'fixed';
            textArea.style.top = '-999px';
            textArea.style.left = '-999px';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            // 执行复制命令
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                this.showCopySuccess();
            } else {
                alert('复制失败，请手动选择文本复制');
            }
        } catch (error) {
            console.error('传统复制方法失败:', error);
            alert('复制失败，请手动选择文本复制');
        }
    }

    /**
     * 显示复制成功提示
     */
    showCopySuccess() {
        // 临时改变按钮文字提示复制成功
        const originalText = this.elements.taskOutputCopyBtn.textContent;
        this.elements.taskOutputCopyBtn.textContent = '已复制';
        this.elements.taskOutputCopyBtn.style.backgroundColor = '#4caf50';
        
        setTimeout(() => {
            this.elements.taskOutputCopyBtn.textContent = originalText;
            this.elements.taskOutputCopyBtn.style.backgroundColor = '';
        }, 1500);
    }

    /**
     * 处理任务状态更新
     */
    handleTaskUpdate(task) {
        this.tasks.set(task.id, task);
        
        // 如果当前在任务管理页面，更新列表显示
        if (this.currentMode === 'task') {
            this.renderTaskList();
        }
    }

    /**
     * 处理任务输出更新
     */
    handleTaskOutput(taskId, outputType, text) {
        // 如果当前正在查看这个任务的输出，实时更新
        if (this.currentTaskOutputId === taskId && this.elements.taskOutput.classList.contains('active')) {
            const time = new Date().toLocaleTimeString();
            const outputLine = `[${time}] ${text}`;
            
            // 添加新内容
            this.elements.taskOutputText.textContent += outputLine;
            
            // 限制输出长度，避免性能问题
            const maxLines = 1000;
            const lines = this.elements.taskOutputText.textContent.split('\n');
            if (lines.length > maxLines) {
                const trimmedLines = lines.slice(-maxLines);
                this.elements.taskOutputText.textContent = trimmedLines.join('\n');
            }
            
            // 确保滚动到底部
            setTimeout(() => {
                this.elements.taskOutputText.scrollTop = this.elements.taskOutputText.scrollHeight;
            }, 0);
        }
    }

    /**
     * 处理任务删除
     */
    handleTaskDeleted(taskId) {
        this.tasks.delete(taskId);
        
        // 如果当前正在查看被删除任务的输出，关闭输出窗口
        if (this.currentTaskOutputId === taskId) {
            this.hideTaskOutput();
        }
        
        // 如果当前在任务管理页面，更新列表显示
        if (this.currentMode === 'task') {
            this.renderTaskList();
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new ClaudeScreenViewer();
});