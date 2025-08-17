# API Test MCP Server

专门用于API自动化测试的MCP（Model Context Protocol）服务器，为Claude提供全面的API测试能力。

## 功能特性

### 核心能力
- **环境管理**: 多测试环境配置和切换
- **Swagger支持**: 自动解析OpenAPI文档
- **智能认证**: JWT/Session/Basic Auth支持
- **测试执行**: 单个或批量HTTP请求执行
- **数据管理**: 测试套件和结果持久化
- **数据库快照**: 测试前后数据库备份恢复

### 与Claude协作
- Claude负责智能决策：测试策略、数据生成、结果分析
- MCP负责执行操作：HTTP请求、数据存储、环境管理

## 安装配置

### 1. 安装依赖

```bash
cd mcp-test
npm install
```

### 2. 配置Claude Desktop

在Claude Desktop的配置文件中添加：

```json
{
  "mcpServers": {
    "api-test": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-test/server.js"]
    }
  }
}
```

或使用命令行：

```bash
claude mcp add api-test -- node /absolute/path/to/mcp-test/server.js
```

### 3. 创建测试环境

使用CLI配置向导：

```bash
ats api-test --wizard
```

## MCP工具列表

### 环境配置管理

| 工具名称 | 功能描述 |
|---------|---------|
| `test_env_create` | 创建测试环境配置 |
| `test_env_list` | 列出所有测试环境 |
| `test_env_get` | 获取指定环境配置 |
| `test_env_set_active` | 设置当前活动环境 |
| `test_env_delete` | 删除测试环境 |

### API信息获取

| 工具名称 | 功能描述 |
|---------|---------|
| `api_fetch_swagger` | 获取Swagger/OpenAPI文档 |
| `api_parse_controllers` | 解析并返回所有Controller列表 |
| `api_get_endpoints` | 获取指定Controller的所有端点信息 |

### 认证管理

| 工具名称 | 功能描述 |
|---------|---------|
| `auth_login` | 执行登录并获取认证token |
| `auth_validate` | 验证当前认证是否有效 |
| `auth_get_token` | 获取当前认证token |

### 测试执行

| 工具名称 | 功能描述 |
|---------|---------|
| `test_execute_request` | 执行单个HTTP请求 |
| `test_batch_execute` | 批量执行多个测试请求 |

### 测试上下文管理

| 工具名称 | 功能描述 |
|---------|---------|
| `test_context_set` | 设置测试上下文数据 |
| `test_context_get` | 获取测试上下文数据 |
| `test_context_clear` | 清空测试上下文 |

### 测试套件管理

| 工具名称 | 功能描述 |
|---------|---------|
| `test_suite_save` | 保存测试套件 |
| `test_suite_list` | 列出所有测试套件 |
| `test_suite_load` | 加载指定测试套件 |
| `test_suite_delete` | 删除测试套件 |

### 测试结果管理

| 工具名称 | 功能描述 |
|---------|---------|
| `test_result_save` | 保存测试结果 |
| `test_result_query` | 查询测试结果 |
| `test_result_summary` | 获取测试结果汇总 |

### 数据库操作

| 工具名称 | 功能描述 |
|---------|---------|
| `db_snapshot_create` | 创建数据库快照 |
| `db_snapshot_list` | 列出所有数据库快照 |
| `db_snapshot_restore` | 恢复数据库快照 |
| `db_execute_query` | 执行数据库查询 |

### 工具函数

| 工具名称 | 功能描述 |
|---------|---------|
| `parse_application_yml` | 解析Spring Boot配置文件 |

## 使用示例

### Claude中的测试流程

1. **环境设置**
```
调用 test_env_set_active 设置活动环境为 "dev"
```

2. **获取API信息**
```
调用 api_fetch_swagger 获取Swagger文档
调用 api_parse_controllers 解析所有Controller
```

3. **执行登录**
```
调用 auth_login 获取认证token
```

4. **生成并执行测试**
```
Claude分析API结构，生成测试数据
调用 test_execute_request 执行单个测试
调用 test_context_set 保存生成的ID
```

5. **保存测试结果**
```
调用 test_result_save 保存结果
调用 test_suite_save 保存测试套件
```

6. **生成报告**
```
调用 test_result_summary 获取汇总
Claude生成详细测试报告
```

## 数据结构

### 环境配置
```json
{
  "id": "env_001",
  "name": "开发环境",
  "baseUrl": "http://localhost:8080",
  "swaggerUrl": "/v3/api-docs",
  "authConfig": {
    "type": "jwt",
    "loginEndpoint": "/api/auth/login",
    "username": "admin",
    "password": "******",
    "tokenField": "data.token",
    "headerName": "Authorization",
    "headerPrefix": "Bearer"
  },
  "database": {
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "test_db",
    "user": "root",
    "password": "******"
  }
}
```

### 测试请求
```json
{
  "url": "/api/users/1",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer xxx"
  },
  "params": {},
  "body": null
}
```

### 测试响应
```json
{
  "request": { ... },
  "response": {
    "statusCode": 200,
    "statusText": "OK",
    "headers": { ... },
    "body": { ... },
    "responseTime": 125
  },
  "timestamp": "2024-12-17T10:00:00Z"
}
```

## CLI命令

```bash
# 配置管理
ats api-test --wizard         # 配置向导
ats api-test --list-env       # 列出环境
ats api-test --env dev        # 切换环境

# 测试套件
ats api-test --list-suites    # 列出套件

# MCP服务器
ats api-test --mcp-server     # 启动MCP服务器
```

## 最佳实践

### 1. 环境隔离
- 为开发、测试、生产创建不同环境配置
- 使用数据库快照隔离测试数据

### 2. 测试组织
- 按Controller或功能模块组织测试套件
- 使用批次ID追踪相关测试

### 3. 数据管理
- 使用test_context管理动态数据
- 测试后清理或恢复数据

### 4. 与Claude协作
- 让Claude负责测试策略和数据生成
- MCP只负责执行和数据存储
- 利用Claude的智能分析能力验证结果

## 故障排除

### MCP服务器无法启动
- 检查Node.js版本 >= 18.0.0
- 确认依赖已安装：`npm install`
- 查看错误日志

### 无法连接到API服务器
- 检查baseUrl配置是否正确
- 确认目标服务器正在运行
- 验证网络连接

### 认证失败
- 检查用户名密码是否正确
- 确认登录接口路径
- 验证token字段路径配置

### 数据库操作失败
- 确认数据库配置正确
- 检查数据库服务运行状态
- 验证用户权限

## 开发计划

- [ ] 支持GraphQL API测试
- [ ] 添加WebSocket测试支持
- [ ] 实现性能测试功能
- [ ] 支持更多认证方式（OAuth2等）
- [ ] 添加测试报告导出功能
- [ ] 实现测试数据自动生成器
- [ ] 支持环境变量和配置文件
- [ ] 添加测试覆盖率分析

## 许可证

MIT