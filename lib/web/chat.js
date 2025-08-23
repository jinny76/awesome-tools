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
        
        this.initializeElements();
        this.bindEvents();
        this.connect();
    }

    /**
     * 初始化DOM元素
     */
    initializeElements() {
        this.elements = {
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
            ctrlVBtn: document.getElementById('ctrlVBtn')
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
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new ClaudeScreenViewer();
});