/**
 * Claude Remote Dev - 前端交互脚本
 * 深色主题，还原Claude输出效果
 */

class ClaudeRemoteChat {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.sessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.messageQueue = [];
        
        this.initializeElements();
        this.bindEvents();
        this.connect();
    }

    /**
     * 初始化DOM元素
     */
    initializeElements() {
        this.elements = {
            messagesContainer: document.getElementById('messagesContainer'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            sendIcon: document.getElementById('sendIcon'),
            sendLoading: document.getElementById('sendLoading'),
            typingIndicator: document.getElementById('typingIndicator'),
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            serverName: document.getElementById('serverName'),
            serverStatus: document.getElementById('serverStatus'),
            menuButton: document.getElementById('menuButton')
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

        // 输入框自动调整高度
        this.elements.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // 菜单按钮
        this.elements.menuButton.addEventListener('click', () => {
            this.showMenu();
        });

        // 页面可见性变化时重连
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isConnected) {
                this.connect();
            }
        });
    }

    /**
     * 连接WebSocket
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.updateConnectionStatus('connecting', '正在连接...');
        this.log('尝试连接WebSocket...', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);
            this.setupWebSocketHandlers();
        } catch (error) {
            this.log('WebSocket连接失败:', error);
            this.handleConnectionError();
        }
    }

    /**
     * 设置WebSocket处理器
     */
    setupWebSocketHandlers() {
        this.ws.onopen = () => {
            this.log('WebSocket连接成功');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected', '已连接');
            this.enableInput();
            
            // 处理排队的消息
            this.processMessageQueue();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                this.log('消息解析失败:', error);
            }
        };

        this.ws.onclose = (event) => {
            this.log('WebSocket连接关闭:', event.code, event.reason);
            this.isConnected = false;
            this.updateConnectionStatus('disconnected', '连接已断开');
            this.disableInput();
            
            if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            this.log('WebSocket错误:', error);
            this.handleConnectionError();
        };
    }

    /**
     * 处理WebSocket消息
     */
    handleMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.sessionId = data.sessionId;
                this.elements.serverName.textContent = data.serverName || 'Claude Remote Dev';
                if (data.authRequired) {
                    this.showAuthDialog();
                }
                break;

            case 'user_message':
                this.addMessage('user', data.content, data.timestamp);
                this.showTypingIndicator();
                break;

            case 'claude_message':
                this.hideTypingIndicator();
                this.addMessage('claude', data.content, data.timestamp, data.htmlContent);
                break;

            case 'history':
                this.loadHistory(data.messages);
                break;

            case 'history_cleared':
                this.clearMessages();
                break;

            case 'claude_status':
                this.handleClaudeStatus(data);
                break;

            case 'auth_success':
                this.hideAuthDialog();
                this.showSystemMessage('✅ 登录成功', 'success');
                break;

            case 'auth_failed':
                this.showSystemMessage('❌ 登录失败: ' + data.message, 'error');
                break;

            case 'error':
                this.showSystemMessage('❌ 错误: ' + data.message, 'error');
                break;

            case 'pong':
                // 心跳响应
                break;

            default:
                this.log('未知消息类型:', data.type);
        }
    }

    /**
     * 发送消息
     */
    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message) return;

        if (!this.isConnected) {
            this.showSystemMessage('❌ 连接已断开，消息已加入队列', 'warning');
            this.messageQueue.push(message);
            return;
        }

        // 显示发送状态
        this.setSendingState(true);
        
        // 发送消息
        const messageData = {
            type: 'chat',
            message: message,
            sessionId: this.sessionId
        };

        try {
            this.ws.send(JSON.stringify(messageData));
            this.elements.messageInput.value = '';
            this.autoResizeTextarea();
        } catch (error) {
            this.log('发送消息失败:', error);
            this.showSystemMessage('❌ 发送消息失败', 'error');
        } finally {
            this.setSendingState(false);
        }
    }

    /**
     * 添加消息到界面
     */
    addMessage(type, content, timestamp, htmlContent = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';

        if (type === 'claude') {
            // Claude消息需要特殊格式化
            const formattedContent = htmlContent ? 
                this.processHTMLContent(htmlContent) : 
                this.formatClaudeContent(content);
            
            bubbleDiv.innerHTML = `
                <div class="claude-content">${formattedContent}</div>
                <div class="message-time">${this.formatTime(timestamp)}</div>
            `;
        } else {
            // 用户消息
            bubbleDiv.innerHTML = `
                <div>${this.escapeHtml(content)}</div>
                <div class="message-time">${this.formatTime(timestamp)}</div>
            `;
        }

        messageDiv.appendChild(bubbleDiv);
        
        // 插入到打字指示器之前
        const typingIndicator = this.elements.typingIndicator;
        this.elements.messagesContainer.insertBefore(messageDiv, typingIndicator);
        
        this.scrollToBottom();
    }

    /**
     * 处理HTML内容 - 来自ansi-to-html的转换
     */
    processHTMLContent(htmlContent) {
        // 直接使用ansi-to-html的输出，但需要一些后处理
        let processed = htmlContent;
        
        // 确保换行符正确处理
        processed = processed.replace(/\n/g, '<br>');
        
        // 包装在段落中
        if (!processed.startsWith('<')) {
            processed = `<p>${processed}</p>`;
        }
        
        return processed;
    }

    /**
     * 格式化Claude内容 - 模仿Claude的Markdown渲染 (备用方案)
     */
    formatClaudeContent(content) {
        // 基本的HTML转义
        let formatted = this.escapeHtml(content);

        // 代码块处理 (```language ... ```)
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
            const language = lang || 'text';
            return `<pre><code class="language-${language}">${code}</code></pre>`;
        });

        // 行内代码处理 (`code`)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 粗体处理 (**text**)
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // 斜体处理 (*text*)
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 有序列表处理
        formatted = formatted.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

        // 无序列表处理
        formatted = formatted.replace(/^[-*]\s(.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        // 段落处理
        const paragraphs = formatted.split('\n\n');
        formatted = paragraphs.map(p => {
            p = p.trim();
            if (!p) return '';
            if (p.startsWith('<pre>') || p.startsWith('<ol>') || p.startsWith('<ul>') || p.startsWith('<li>')) {
                return p;
            }
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');

        return formatted;
    }

    /**
     * 显示打字指示器
     */
    showTypingIndicator() {
        this.elements.typingIndicator.classList.add('show');
        this.scrollToBottom();
    }

    /**
     * 隐藏打字指示器
     */
    hideTypingIndicator() {
        this.elements.typingIndicator.classList.remove('show');
    }

    /**
     * 加载历史消息
     */
    loadHistory(messages) {
        messages.forEach(msg => {
            if (msg.type === 'claude_response') {
                this.addMessage('claude', msg.content, msg.timestamp, msg.htmlContent);
            }
        });
    }

    /**
     * 清空消息
     */
    clearMessages() {
        const messages = this.elements.messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
        this.showSystemMessage('🗑️ 聊天记录已清空', 'info');
    }

    /**
     * 显示系统消息
     */
    showSystemMessage(content, type = 'info') {
        const systemMsg = document.createElement('div');
        systemMsg.className = 'system-message';
        systemMsg.textContent = content;
        
        if (type === 'success') systemMsg.style.borderColor = 'var(--success-color)';
        if (type === 'error') systemMsg.style.borderColor = 'var(--error-color)';
        if (type === 'warning') systemMsg.style.borderColor = 'var(--warning-color)';
        
        const typingIndicator = this.elements.typingIndicator;
        this.elements.messagesContainer.insertBefore(systemMsg, typingIndicator);
        
        this.scrollToBottom();

        // 3秒后自动移除
        setTimeout(() => {
            if (systemMsg.parentNode) {
                systemMsg.remove();
            }
        }, 3000);
    }

    /**
     * 处理Claude状态变化
     */
    handleClaudeStatus(data) {
        switch (data.status) {
            case 'started':
                this.elements.serverStatus.textContent = 'Claude已启动';
                this.showSystemMessage('✅ Claude已启动', 'success');
                break;
            case 'stopped':
                this.elements.serverStatus.textContent = 'Claude已停止';
                this.showSystemMessage('⚠️ Claude已停止', 'warning');
                break;
        }
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(status, message) {
        const indicator = this.elements.statusIndicator;
        const statusElement = this.elements.serverStatus;
        
        indicator.className = `status-indicator ${status}`;
        statusElement.textContent = message;

        if (status === 'connected') {
            this.hideConnectionBanner();
        } else {
            this.showConnectionBanner(message, status);
        }
    }

    /**
     * 显示连接横幅
     */
    showConnectionBanner(message, type) {
        const banner = this.elements.connectionStatus;
        banner.textContent = message;
        banner.className = `connection-status show ${type}`;
    }

    /**
     * 隐藏连接横幅
     */
    hideConnectionBanner() {
        const banner = this.elements.connectionStatus;
        banner.classList.remove('show');
    }

    /**
     * 启用输入
     */
    enableInput() {
        this.elements.messageInput.disabled = false;
        this.elements.sendButton.disabled = false;
        this.elements.messageInput.placeholder = '输入您的问题或命令...';
    }

    /**
     * 禁用输入
     */
    disableInput() {
        this.elements.messageInput.disabled = true;
        this.elements.sendButton.disabled = true;
        this.elements.messageInput.placeholder = '连接中...';
    }

    /**
     * 设置发送状态
     */
    setSendingState(isSending) {
        if (isSending) {
            this.elements.sendIcon.classList.add('hidden');
            this.elements.sendLoading.classList.remove('hidden');
            this.elements.sendButton.disabled = true;
        } else {
            this.elements.sendIcon.classList.remove('hidden');
            this.elements.sendLoading.classList.add('hidden');
            this.elements.sendButton.disabled = false;
        }
    }

    /**
     * 自动调整文本框高度
     */
    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        setTimeout(() => {
            const container = this.elements.messagesContainer;
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    /**
     * 处理连接错误
     */
    handleConnectionError() {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', '连接失败');
        this.disableInput();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else {
            this.showSystemMessage('❌ 连接失败，请刷新页面重试', 'error');
        }
    }

    /**
     * 安排重连
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        this.updateConnectionStatus('connecting', `正在重连... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, delay);
    }

    /**
     * 处理消息队列
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.elements.messageInput.value = message;
            this.sendMessage();
        }
    }

    /**
     * 显示菜单
     */
    showMenu() {
        // 简单的菜单实现
        const actions = [
            { text: '清空聊天记录', action: () => this.clearChatHistory() },
            { text: '断开连接', action: () => this.disconnect() },
            { text: '重新连接', action: () => this.reconnect() }
        ];

        // 这里可以实现一个更复杂的菜单
        const action = prompt('选择操作:\n1. 清空聊天记录\n2. 断开连接\n3. 重新连接\n\n输入数字:');
        
        if (action >= 1 && action <= 3) {
            actions[action - 1].action();
        }
    }

    /**
     * 清空聊天记录
     */
    clearChatHistory() {
        if (confirm('确定要清空所有聊天记录吗？')) {
            fetch('/api/history', { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.clearMessages();
                    }
                })
                .catch(error => {
                    this.log('清空历史失败:', error);
                });
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, '用户主动断开');
        }
    }

    /**
     * 重新连接
     */
    reconnect() {
        this.disconnect();
        setTimeout(() => this.connect(), 500);
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 日志输出
     */
    log(...args) {
        console.log('[ClaudeRemoteChat]', ...args);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.claudeChat = new ClaudeRemoteChat();
});

// 防止页面意外关闭
window.addEventListener('beforeunload', (e) => {
    if (window.claudeChat && window.claudeChat.isConnected) {
        e.preventDefault();
        e.returnValue = '确定要离开页面吗？与Claude的连接将会断开。';
    }
});