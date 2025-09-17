#!/bin/bash
set -e

echo "🔧 安装 awesome-tools 依赖..."

# 安装主项目依赖
echo "📦 安装主项目依赖..."
npm install

# 安装 MCP 服务器依赖
echo "📦 安装 MCP 服务器依赖..."
cd mcp
npm install

# 安装 MCP 测试服务器依赖
echo "📦 安装 MCP 测试服务器依赖..."
cd ../mcp-test
npm install

echo 📦 安装 MCP 测试服务器依赖...
cd ../mcp_3d
call npm install
if errorlevel 1 goto :error

# 返回根目录并全局链接
echo "🔗 创建全局链接..."
cd ..
npm link

echo "✅ 安装完成！"
echo "现在可以使用: ats --help"
