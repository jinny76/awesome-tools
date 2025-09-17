@echo off
echo 🔧 安装 awesome-tools 依赖...

echo 📦 安装主项目依赖...
call npm install
if errorlevel 1 goto :error

echo 📦 安装 MCP 服务器依赖...
cd mcp
call npm install
if errorlevel 1 goto :error

echo 📦 安装 MCP 测试服务器依赖...
cd ..\mcp-test
call npm install
if errorlevel 1 goto :error

echo 📦 安装 MCP 3D服务器依赖...
cd ..\mcp_3d
call npm install
if errorlevel 1 goto :error

echo 🔗 创建全局链接...
cd ..
call npm link
if errorlevel 1 goto :error

echo ✅ 安装完成！
echo 现在可以使用: ats --help
goto :end

:error
echo ❌ 安装失败！
exit /b 1

:end
