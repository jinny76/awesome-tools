# Chatlog MCP 集成快速指南

⚠️ **重要提示**：微信 PC 版本必须 ≤ 4.0.3.36，否则无法获取解密密钥！

## 快速安装

### Windows
```bash
# 运行安装脚本
install-mcp.bat
```

### macOS/Linux
```bash
chmod +x install-mcp.sh
./install-mcp.sh
```

## 手动安装

1. 安装 mcp-proxy：
   ```bash
   uv tool install mcp-proxy
   # 或
   pip install mcp-proxy
   ```

2. 配置 Claude Desktop：
   ```bash
   iflow mcp add wechat "C:/path/to/mcp-proxy.exe" http://127.0.0.1:5030/sse
   ```

3. 启动 Chatlog：
   ```bash
   chatlog.exe
   # 选择"开启 HTTP 服务"
   ```

4. 重启 Claude Desktop

## 测试

在 Claude 中输入：
```
查询我最近的微信聊天记录
```

## 详细文档

查看 [完整集成指南](../docs/chatlog-mcp-setup.md)

## 注意事项

- 仅供个人合法使用
- 不要将服务暴露到公网
- 遵守相关法律法规