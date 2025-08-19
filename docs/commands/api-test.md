# API 自动化测试工具

API自动化测试工具，支持Swagger解析、智能测试生成、数据库快照等功能。通过MCP集成可与Claude协作进行智能测试。

## 功能特性

- **环境管理** - 多测试环境配置、切换和管理
- **Swagger解析** - 自动获取和解析OpenAPI文档
- **智能认证** - JWT/Session/Basic Auth支持
- **测试执行** - 单个或批量HTTP请求执行
- **测试套件** - 测试用例保存、加载和管理
- **数据库快照** - 基于连接库的数据备份恢复
- **测试上下文** - 智能数据管理，自动更新日期信息
- **结果分析** - 测试结果存储和统计分析

## 快速开始

```bash
# 交互式配置向导
ats at --wizard
ats at -w

# 直接执行测试
ats at --env dev --suite user-tests
```

## 环境配置

### 配置文件位置
测试数据存储在被测试项目的 `.api-test/` 目录：

```
被测试项目/
├── src/
├── package.json
└── .api-test/              # 测试数据存储
    ├── environments.json   # 环境配置
    ├── suites/            # 测试套件
    ├── results/           # 测试结果
    └── snapshots/         # 数据库快照
```

### 环境配置示例
```json
{
  "dev": {
    "baseUrl": "http://localhost:3000",
    "auth": {
      "type": "jwt",
      "endpoint": "/api/auth/login",
      "credentials": {
        "username": "admin",
        "password": "******"
      }
    },
    "database": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "******",
      "database": "test_db"
    }
  }
}
```

## 命令参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--wizard` | `-w` | 交互式配置向导 |
| `--env <name>` | `-e` | 选择测试环境 |
| `--suite <name>` | `-s` | 执行测试套件 |
| `--swagger <url>` | | 指定Swagger文档URL |
| `--auth-type <type>` | | 认证类型 (jwt/session/basic) |
| `--list-envs` | | 列出所有环境 |
| `--list-suites` | | 列出所有测试套件 |
| `--mcp-server` | | 启动MCP服务器 |

## MCP集成

### 启动MCP服务器
```bash
# 在项目根目录运行
cd /your/project
ats api-test --mcp-server
```

### Claude Desktop配置
```json
{
  "mcpServers": {
    "api-test": {
      "command": "node",
      "args": ["path/to/awesome-tools/mcp-test/server.js", "--project-dir", "/your/project"]
    }
  }
}
```

### 与Claude协作测试

1. **设置环境**: "设置开发环境为活动环境"
2. **获取API文档**: "获取用户管理API的Swagger文档"
3. **生成测试**: "为UserController生成完整的测试用例"
4. **执行测试**: "执行用户注册接口测试"
5. **数据库快照**: "创建数据库快照"
6. **分析结果**: "生成测试报告"

## 测试套件

### 创建测试套件
```javascript
// .api-test/suites/user-tests.json
{
  "name": "用户管理测试",
  "tests": [
    {
      "name": "创建用户",
      "method": "POST",
      "path": "/api/users",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "username": "{{username}}",
        "email": "{{email}}"
      },
      "assertions": [
        { "type": "status", "value": 201 },
        { "type": "jsonPath", "path": "$.id", "exists": true }
      ]
    }
  ]
}
```

### 测试上下文变量

系统自动维护以下上下文变量：
- `{{today}}` - 今天日期 (YYYY-MM-DD)
- `{{tomorrow}}` - 明天日期
- `{{yesterday}}` - 昨天日期
- `{{currentMonth}}` - 当前月份
- `{{timestamp}}` - 当前时间戳
- `{{uuid}}` - 随机UUID

## 数据库快照

### 创建快照
```bash
ats at --create-snapshot before-test
```

### 恢复快照
```bash
ats at --restore-snapshot before-test
```

### 快照管理
- 支持MySQL和PostgreSQL
- 使用内置连接库，无需外部工具
- 快照存储在 `.api-test/snapshots/`

## 测试结果

### 结果格式
```json
{
  "suite": "user-tests",
  "environment": "dev",
  "timestamp": "2024-01-01T12:00:00Z",
  "summary": {
    "total": 10,
    "passed": 9,
    "failed": 1,
    "duration": 2345
  },
  "tests": [...]
}
```

### 结果分析
```bash
# 查看最近测试结果
ats at --show-results

# 对比两次测试
ats at --compare-results result1.json result2.json
```

## 最佳实践

1. **环境隔离**: 为每个环境创建独立配置
2. **数据准备**: 使用数据库快照管理测试数据
3. **上下文管理**: 利用上下文变量动态生成测试数据
4. **持续集成**: 结合CI/CD工具自动执行测试
5. **智能测试**: 通过MCP与Claude协作生成测试用例

## 故障排查

### 认证失败
- 检查环境配置中的认证信息
- 确认接口路径和参数正确
- 查看响应日志了解详细错误

### 数据库连接失败
- 验证数据库配置信息
- 确保数据库服务运行中
- 检查防火墙设置

### MCP服务器问题
- 确保在项目根目录运行
- 检查端口是否被占用
- 查看服务器日志输出