@echo off
echo 📱 Chatlog MCP 快速安装脚本
echo ================================

REM 检查 Python 环境
echo.
echo 🔍 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Python，请先安装 Python 3.8+
    echo 下载地址: https://www.python.org/downloads/
    goto :error
)

REM 检查 uv 工具
echo.
echo 🔍 检查 uv 工具...
uv --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  未找到 uv 工具，尝试使用 pip 安装...
    goto :pip_install
) else (
    goto :uv_install
)

:uv_install
echo.
echo 📦 使用 uv 安装 mcp-proxy...
uv tool install mcp-proxy
if errorlevel 1 goto :error
goto :configure

:pip_install
echo.
echo 📦 使用 pip 安装 mcp-proxy...
pip install mcp-proxy
if errorlevel 1 goto :error

:configure
echo.
echo 🔍 查找 mcp-proxy 位置...
for /f "delims=" %%i in ('where mcp-proxy 2^>nul') do set MCP_PROXY_PATH=%%i

if "%MCP_PROXY_PATH%"=="" (
    echo ❌ 未找到 mcp-proxy，安装可能失败
    goto :error
)

echo ✅ 找到 mcp-proxy: %MCP_PROXY_PATH%

REM 将反斜杠转换为正斜杠
set MCP_PROXY_PATH=%MCP_PROXY_PATH:\=/%

echo.
echo 🔧 配置 Claude Desktop...

REM 检查 iflow 是否存在
iflow --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  未找到 iflow 工具，将显示手动配置方法...
    goto :manual_config
) else (
    goto :auto_config
)

:auto_config
echo.
echo 📝 使用 iflow 自动配置...
iflow mcp add wechat "%MCP_PROXY_PATH%" http://127.0.0.1:5030/sse
if errorlevel 1 goto :error
echo ✅ 配置完成！
goto :success

:manual_config
echo.
echo 📝 请手动配置 Claude Desktop:
echo.
echo 1. 打开配置文件:
echo    %%APPDATA%%\Claude\claude_desktop_config.json
echo.
echo 2. 添加以下配置:
echo    {
echo      "mcpServers": {
echo        "wechat": {
echo          "command": "%MCP_PROXY_PATH%",
echo          "args": ["http://127.0.0.1:5030/sse"]
echo        }
echo      }
echo    }
echo.

:success
echo.
echo ✅ 安装完成！
echo.
echo 📋 后续步骤:
echo 1. 启动 Chatlog 并开启 HTTP 服务
echo 2. 重启 Claude Desktop
echo 3. 在 Claude 中测试: "查询我最近的微信聊天记录"
echo.
pause
exit /b 0

:error
echo.
echo ❌ 安装失败！
pause
exit /b 1