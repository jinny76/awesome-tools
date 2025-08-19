# SSH端口转发工具

简化的SSH隧道管理工具，提供安全的端口转发功能，支持密码认证和加密存储。

## 功能特性

- **密码认证** - 简化的密码认证方式，无需管理SSH密钥
- **加密存储** - AES-256-CBC加密保存密码
- **交互式向导** - 引导式配置服务器和端口映射
- **端口冲突检测** - 自动分配可用端口
- **预设服务** - MySQL、Redis、PostgreSQL等常用服务预配置
- **多隧道管理** - 支持多个并发SSH隧道

## 快速开始

```bash
# 交互式配置向导
ats rs --wizard
ats rs -w

# 连接已保存的服务器
ats rs --connect myserver

# 查看所有配置
ats rs --list
```

## 命令参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--wizard` | `-w` | 交互式配置向导 |
| `--list` | `-l` | 列出所有服务器配置 |
| `--connect <name>` | `-c` | 连接到指定服务器 |
| `--status` | `-s` | 显示活动隧道状态 |
| `--stop` | | 停止所有隧道 |
| `--delete <name>` | | 删除服务器配置 |

## 预设服务

直接连接常用服务（需要输入服务器信息）：

```bash
ats rs mysql      # MySQL (3306 -> 3306)
ats rs redis      # Redis (6379 -> 6379)
ats rs postgres   # PostgreSQL (5432 -> 5432)
ats rs mongodb    # MongoDB (27017 -> 27017)
ats rs elastic    # Elasticsearch (9200 -> 9200)
```

## 配置示例

### 添加新服务器
```bash
ats rs -w
> 选择: 添加新服务器
> 服务器名称: production
> 主机地址: example.com
> SSH端口: 22
> 用户名: ubuntu
> 密码: ******
> 是否保存密码: 是
```

### 配置端口映射
```bash
> 添加端口映射
> 服务名称: mysql
> 远程端口: 3306
> 本地端口: 3306 (自动分配: 3307)
> 继续添加? 是
> 服务名称: redis
> 远程端口: 6379
> 本地端口: 6379
```

## 使用场景

### 开发环境数据库访问
```bash
# 配置生产数据库隧道
ats rs -w
> 添加映射: MySQL 3306 -> 3306
> 添加映射: Redis 6379 -> 6379

# 连接
ats rs -c production

# 本地访问
mysql -h 127.0.0.1 -P 3306 -u dbuser -p
redis-cli -h 127.0.0.1 -p 6379
```

### 多服务器管理
```bash
# 列出所有配置
ats rs --list
┌─────────────┬──────────────┬──────┬─────────┐
│ 名称        │ 主机         │ 端口 │ 映射数量│
├─────────────┼──────────────┼──────┼─────────┤
│ production  │ prod.example │ 22   │ 3       │
│ staging     │ stage.example│ 22   │ 2       │
│ development │ dev.example  │ 22   │ 4       │
└─────────────┴──────────────┴──────┴─────────┘

# 查看活动连接
ats rs --status
```

## 安全特性

### 密码加密
- 使用AES-256-CBC算法
- 用户特定的加密密钥
- 安全的密钥派生（scrypt）

### 配置文件位置
```
~/.awesome-tools/
├── remote-servers.json  # 服务器配置
└── .encryption-key      # 加密密钥（自动生成）
```

### 安全建议
1. 定期更新密码
2. 使用强密码
3. 限制SSH用户权限
4. 启用服务器防火墙
5. 监控异常连接

## 高级功能

### 自动重连
```bash
# 启用自动重连
ats rs -c myserver --auto-reconnect
```

### 端口转发链
```bash
# 通过跳板机连接
ats rs -c jumphost
ats rs -c production --via jumphost
```

### SOCKS代理
```bash
# 创建SOCKS5代理
ats rs -c myserver --socks 1080
```

## 故障排查

### 连接失败
- 检查服务器地址和端口
- 验证用户名密码
- 确认SSH服务运行中
- 检查防火墙规则

### 端口冲突
- 系统会自动分配可用端口
- 手动指定其他端口
- 停止占用端口的程序

### 密码问题
- 重新输入密码：`ats rs -c myserver --reauth`
- 删除并重建配置：`ats rs --delete myserver`

## 与其他工具集成

### 数据库工具
```bash
# 建立隧道
ats rs -c production

# 使用数据库工具
ats db -h 127.0.0.1 -p 3306 --query "SELECT * FROM users"
```

### API测试
```bash
# 转发API服务端口
ats rs -c staging
> 映射: 8080 -> 8080

# 测试远程API
ats at --base-url http://localhost:8080
```