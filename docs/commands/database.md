# Database (db) - 数据库连接查询工具

智能数据库连接和查询工具，支持MySQL和PostgreSQL数据库操作。支持MCP服务器集成，可在Claude Desktop中通过`database_query`工具直接使用。

## 🚀 快速开始

```bash
# 使用缩写命令 (推荐)
ats db [选项]

# 完整命令
awesome-tools database [选项]
```

## 🔧 基本配置

### 1. 启动配置向导

```bash
# 交互式配置向导（推荐新手）
ats db --wizard
ats db -w

# 向导会引导你完成：
# - 选择数据库类型 (MySQL/PostgreSQL)
# - 配置连接参数 (主机、端口、用户名、密码、数据库)
# - 测试连接
# - 保存配置
# - 执行示例查询
```

### 2. 命令行直接连接

```bash
# MySQL连接
ats db -t mysql -h localhost -P 3306 -u root -p password -d mydb --test

# PostgreSQL连接
ats db -t postgres -h localhost -P 5432 -u postgres -p password -d mydb --test
```

## 📊 主要功能

### 1. 连接配置管理

```bash
# 保存连接配置
ats db -t mysql -h localhost -u root -p password -d mydb --save production

# 使用保存的配置
ats db --config production --test

# 列出所有保存的配置
ats db --list

# 输出示例：
# 📋 已保存的数据库配置:
#   🔗 production: mysql://root@localhost:3306/mydb
#   🔗 development: postgres://dev@localhost:5432/devdb
```

### 2. 数据库连接测试

```bash
# 测试连接
ats db --config production --test
ats db -t mysql -h localhost -u root -p password -d mydb --test

# 成功输出：
# ✅ MySQL连接测试成功

# 失败输出：
# ❌ 连接失败: Access denied for user 'root'@'localhost'
```

### 3. 表管理操作

```bash
# 列出所有表
ats db --config production --tables

# 查看表结构
ats db --config production --describe users
ats db --config production --describe orders

# 输出示例（表结构）：
# ┌─────────────┬─────────────┬──────┬─────┬─────────┬────────┐
# │ Field       │ Type        │ Null │ Key │ Default │ Extra  │
# ├─────────────┼─────────────┼──────┼─────┼─────────┼────────┤
# │ id          │ int(11)     │ NO   │ PRI │ NULL    │ auto_i │
# │ username    │ varchar(50) │ NO   │ UNI │ NULL    │        │
# │ email       │ varchar(100)│ YES  │     │ NULL    │        │
# │ created_at  │ timestamp   │ YES  │     │ CURRENT │        │
# └─────────────┴─────────────┴──────┴─────┴─────────┴────────┘
```

### 4. SQL查询执行

```bash
# 基本查询
ats db --config production -q "SELECT * FROM users LIMIT 10"

# 复杂查询
ats db --config production -q "SELECT u.username, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id"

# 使用不同输出格式
ats db --config production -q "SELECT * FROM users" --export table   # 表格格式（默认）
ats db --config production -q "SELECT * FROM users" --export json    # JSON格式
ats db --config production -q "SELECT * FROM users" --export csv     # CSV格式
```

## 🛠️ 高级功能

### 1. 输出格式化

**表格格式（默认）：**
```bash
ats db --config production -q "SELECT id, username, email FROM users LIMIT 3"

# 输出：
# ┌────┬──────────┬───────────────────┐
# │ id │ username │ email             │
# ├────┼──────────┼───────────────────┤
# │ 1  │ admin    │ admin@example.com │
# │ 2  │ john     │ john@example.com  │
# │ 3  │ jane     │ jane@example.com  │
# └────┴──────────┴───────────────────┘
```

**JSON格式：**
```bash
ats db --config production -q "SELECT * FROM users LIMIT 2" --export json

# 输出：
# [
#   {
#     "id": 1,
#     "username": "admin",
#     "email": "admin@example.com",
#     "created_at": "2024-01-01T00:00:00.000Z"
#   },
#   {
#     "id": 2,
#     "username": "john",
#     "email": "john@example.com",
#     "created_at": "2024-01-02T00:00:00.000Z"
#   }
# ]
```

**CSV格式：**
```bash
ats db --config production -q "SELECT * FROM users LIMIT 2" --export csv

# 输出：
# id,username,email,created_at
# 1,admin,admin@example.com,2024-01-01T00:00:00.000Z
# 2,john,john@example.com,2024-01-02T00:00:00.000Z
```

### 2. 数据库类型特定功能

**MySQL特定：**
```bash
# 查看MySQL版本和状态
ats db --config mysql_prod -q "SELECT VERSION() as mysql_version"
ats db --config mysql_prod -q "SHOW STATUS LIKE 'Uptime'"

# 查看数据库大小
ats db --config mysql_prod -q "SELECT table_schema 'Database', ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) 'Size (MB)' FROM information_schema.tables GROUP BY table_schema"
```

**PostgreSQL特定：**
```bash
# 查看PostgreSQL版本
ats db --config pg_prod -q "SELECT version()"

# 查看数据库大小
ats db --config pg_prod -q "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) AS size FROM pg_database"

# 查看活跃连接
ats db --config pg_prod -q "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'"
```

## 🔐 安全和配置

### 1. 配置文件位置

```bash
# 配置文件自动保存到用户目录
~/.awesome-tools-db.json  # Linux/macOS
%USERPROFILE%\.awesome-tools-db.json  # Windows
```

### 2. 密码安全

```bash
# 配置文件不保存密码，只保存连接参数
{
  "connections": {
    "production": {
      "type": "mysql",
      "host": "localhost", 
      "port": 3306,
      "user": "root",
      "database": "mydb",
      "hasPassword": true  // 标记需要密码，但不存储实际密码
    }
  }
}

# 使用时会提示输入密码
ats db --config production -q "SELECT COUNT(*) FROM users"
# 请输入 production 的密码: ****
```

### 3. 环境变量支持

```bash
# 可以通过环境变量传递敏感信息
export DB_PASSWORD="your_password"
ats db -t mysql -h localhost -u root -p $DB_PASSWORD -d mydb --test
```

## 🎯 实用查询示例

### 1. 数据库分析

```bash
# 查看表大小（MySQL）
ats db --config production -q "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length + index_length) DESC"

# 查看表行数
ats db --config production -q "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC"

# 查看索引使用情况
ats db --config production -q "SELECT table_name, index_name, cardinality FROM information_schema.statistics WHERE table_schema = DATABASE() ORDER BY cardinality DESC"
```

### 2. 性能监控

```bash
# 查看慢查询（MySQL）
ats db --config production -q "SELECT query_time, lock_time, rows_sent, rows_examined, sql_text FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10"

# 查看连接数
ats db --config production -q "SHOW STATUS LIKE 'Threads_connected'"

# 查看缓存命中率
ats db --config production -q "SHOW STATUS LIKE 'Query_cache_hits'"
```

### 3. 数据探索

```bash
# 快速数据概览
ats db --config production -q "SELECT COUNT(*) as total_users FROM users"
ats db --config production -q "SELECT DATE(created_at) as date, COUNT(*) as daily_signups FROM users GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 7"

# 查找重复数据
ats db --config production -q "SELECT email, COUNT(*) as count FROM users GROUP BY email HAVING count > 1"
```

## 🤖 MCP服务器集成

### 配置MCP服务器

```bash
# 添加awesome-tools MCP服务器到Claude Desktop
claude mcp add awesome-tools -- node path/to/awesome-tools/mcp/server.js
```

### 在Claude Desktop中使用

**连接测试：**
```
测试MySQL数据库连接，主机localhost，用户root，数据库myapp
```

**查询数据：**
```
查询用户表中的前10条记录，包含用户名和邮箱字段
```

**表结构分析：**
```
查看orders表的结构，了解字段类型和约束
```

**数据分析：**
```
分析用户注册趋势，按月统计最近6个月的新用户数量
查询2017年北京地区的销售金额统计
```

**实际使用示例（基于demo表）：**
```
# 查询2017年北京的销售数据
SELECT COUNT(*) as 订单数量, SUM(amount) as 总销售金额, AVG(amount) as 平均订单金额, SUM(profit) as 总利润 
FROM demo WHERE city = '北京' AND order_date LIKE '2017%'

# 查看销售TOP 5大单
SELECT order_date, customer_name, pruduct_name, amount, profit 
FROM demo WHERE city = '北京' AND order_date LIKE '2017%' 
ORDER BY amount DESC LIMIT 5
```

**性能监控：**
```
检查数据库性能，查看当前连接数和缓存命中率
```

### MCP工具参数

- **工具名称**: `database_query`
- **type** (可选): 数据库类型 (mysql/postgres)，默认mysql
- **host** (可选): 数据库主机，默认localhost
- **port** (可选): 数据库端口
- **user** (可选): 用户名
- **password** (可选): 密码
- **database** (可选): 数据库名
- **query** (可选): SQL查询语句
- **config** (可选): 使用保存的配置名称
- **action** (可选): 操作类型 (query/tables/describe/test)，默认query
- **tableName** (可选): 表名（用于describe操作）
- **format** (可选): 输出格式 (table/json/csv)，默认table

## 🔧 故障排除

### 常见错误

**1. 连接被拒绝**
```bash
❌ 连接失败: connect ECONNREFUSED 127.0.0.1:3306

解决方法：
- 检查数据库服务是否启动
- 确认主机和端口是否正确
- 检查防火墙设置
```

**2. 认证失败**
```bash
❌ 连接失败: Access denied for user 'root'@'localhost'

解决方法：
- 检查用户名和密码是否正确
- 确认用户是否有访问数据库的权限
- MySQL用户可能需要指定具体主机
```

**3. 数据库不存在**
```bash
❌ 连接失败: Unknown database 'mydb'

解决方法：
- 确认数据库名称是否正确
- 检查用户是否有访问该数据库的权限
- 使用 SHOW DATABASES; 查看可用数据库
```

**4. 依赖包缺失**
```bash
❌ 错误: Cannot find module 'mysql2'

解决方法：
- 重新安装awesome-tools: npm install -g awesome_tools
- 或手动安装依赖: npm install mysql2 pg cli-table3
```

### 调试技巧

```bash
# 启用详细输出
ats db --config production -q "SELECT 1" --debug

# 检查配置文件
cat ~/.awesome-tools-db.json

# 测试基本连接
ats db -h localhost -u root -p password --test
```

## 💡 最佳实践

### 1. 安全建议

- 不要在命令行中直接输入密码，使用配置文件或环境变量
- 定期轮换数据库密码
- 使用只读用户进行数据查询
- 避免在生产环境执行DELETE/UPDATE等危险操作

### 2. 性能优化

- 大结果集查询时使用LIMIT限制返回行数
- 复杂查询考虑添加适当的索引
- 监控慢查询日志
- 定期分析表统计信息

### 3. 开发工作流

```bash
# 1. 配置开发和生产环境
ats db --wizard  # 配置dev环境
ats db --wizard  # 配置prod环境

# 2. 日常查询工作
ats db --config dev --tables                    # 查看表结构
ats db --config dev -q "SELECT * FROM users"    # 数据探索
ats db --config dev --export json -q "..."      # 导出数据供其他工具使用

# 3. 生产环境监控
ats db --config prod -q "SHOW PROCESSLIST"      # 查看活跃查询
ats db --config prod -q "SHOW STATUS"           # 查看数据库状态
```

## 🤝 技术支持

- 📋 **命令帮助**: `ats db --help`
- 📖 **详细文档**: [Awesome Tools文档](../README.md)
- 🔧 **MCP集成**: [MCP服务器文档](../../mcp/README.md)

---

**通过数据库工具，让开发和数据分析更加高效！** 🚀