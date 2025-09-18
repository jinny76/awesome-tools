#!/bin/bash

echo "📱 Chatlog MCP 快速安装脚本"
echo "================================"

# 检查 Python 环境
echo ""
echo "🔍 检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python，请先安装 Python 3.8+"
    echo "macOS: brew install python3"
    echo "Ubuntu: sudo apt install python3 python3-pip"
    exit 1
fi

# 安装 mcp-proxy
echo ""
if command -v uv &> /dev/null; then
    echo "📦 使用 uv 安装 mcp-proxy..."
    uv tool install mcp-proxy
else
    echo "📦 使用 pip 安装 mcp-proxy..."
    pip3 install mcp-proxy
fi

# 查找 mcp-proxy 位置
echo ""
echo "🔍 查找 mcp-proxy 位置..."
MCP_PROXY_PATH=$(which mcp-proxy)

if [ -z "$MCP_PROXY_PATH" ]; then
    echo "❌ 未找到 mcp-proxy，安装可能失败"
    exit 1
fi

echo "✅ 找到 mcp-proxy: $MCP_PROXY_PATH"

# 配置 Claude Desktop
echo ""
echo "🔧 配置 Claude Desktop..."

if command -v iflow &> /dev/null; then
    echo "📝 使用 iflow 自动配置..."
    iflow mcp add wechat "$MCP_PROXY_PATH" http://127.0.0.1:5030/sse
    if [ $? -eq 0 ]; then
        echo "✅ 配置完成！"
    else
        echo "❌ 配置失败"
        exit 1
    fi
else
    echo "📝 请手动配置 Claude Desktop:"
    echo ""
    echo "1. 打开配置文件:"
    echo "   ~/Library/Application Support/Claude/claude_desktop_config.json"
    echo ""
    echo "2. 添加以下配置:"
    cat << EOF
{
  "mcpServers": {
    "wechat": {
      "command": "$MCP_PROXY_PATH",
      "args": ["http://127.0.0.1:5030/sse"]
    }
  }
}
EOF
fi

echo ""
echo "✅ 安装完成！"
echo ""
echo "📋 后续步骤:"
echo "1. 启动 Chatlog 并开启 HTTP 服务"
echo "2. 重启 Claude Desktop"
echo "3. 在 Claude 中测试: \"查询我最近的微信聊天记录\""
echo ""