# API测试MCP使用示例

本文档展示如何使用API测试MCP服务器进行自动化API测试。

## 重要说明：数据存储位置

从v1.1.0版本开始，测试数据存储在**被测试项目目录**下的 `.api-test` 文件夹中，而不是工具目录。这样可以：
- 实现项目级数据隔离
- 避免敏感信息泄露到工具仓库
- 便于管理项目相关的测试数据

请确保在项目的 `.gitignore` 中添加：
```
.api-test/
```

## 快速开始

### 1. 配置测试环境

使用CLI配置向导创建第一个测试环境：

```bash
ats api-test --wizard
```

按照提示输入：
- 环境名称：`dev`
- API基础URL：`http://localhost:8080`
- Swagger路径：`/v3/api-docs`
- 认证类型：选择JWT
- 登录接口：`/api/auth/login`
- 用户名/密码

### 2. 启动MCP服务器

```bash
ats api-test --mcp-server
```

### 3. 配置Claude Desktop

在Claude Desktop配置文件中添加：

```json
{
  "mcpServers": {
    "api-test": {
      "command": "node",
      "args": ["J:/projects/local_tools/mcp-test/server.js"]
    }
  }
}
```

## 使用流程示例

### 场景：测试用户管理API

#### 1. 环境准备
在Claude中说：
> "设置dev环境为当前活动环境"

Claude会调用：
```
test_env_set_active(name: "dev")
```

#### 2. 获取API文档
> "获取当前环境的Swagger文档"

Claude会调用：
```
api_fetch_swagger()
```

#### 3. 分析Controller
> "解析Swagger文档，列出所有Controller"

Claude会调用：
```
api_parse_controllers()
```

#### 4. 获取特定Controller的接口
> "获取UserController的所有接口详情"

Claude会调用：
```
api_get_endpoints(controller: "UserController")
```

#### 5. 执行登录
> "使用配置的用户名密码登录系统"

Claude会调用：
```
auth_login()
```

#### 6. 生成并执行测试
> "为用户注册接口生成测试用例并执行"

Claude会：
1. 分析接口定义
2. 生成合理的测试数据
3. 调用 `test_execute_request` 执行测试
4. 调用 `test_context_set` 保存生成的用户ID

#### 7. 依赖接口测试
> "使用刚创建的用户ID测试获取用户信息接口"

Claude会：
1. 调用 `test_context_get` 获取用户ID
2. 生成GET请求测试用例
3. 执行测试

#### 8. 保存测试套件
> "将这些测试用例保存为'用户管理测试套件'"

Claude会调用：
```
test_suite_save(
  name: "用户管理测试套件",
  description: "包含用户注册、查询等基础功能测试",
  testCases: [...]
)
```

## 高级功能示例

### 批量接口测试

> "为UserController的所有接口生成完整测试用例，按依赖顺序执行"

Claude会：
1. 分析接口依赖关系
2. 生成测试数据
3. 调用 `test_batch_execute` 批量执行
4. 分析结果并生成报告

### 数据库快照测试

> "创建数据库快照，然后测试删除用户接口，最后恢复数据"

Claude会：
1. 调用 `db_snapshot_create(name: "before_delete_test")`
2. 执行删除接口测试
3. 验证删除结果
4. 调用 `db_snapshot_restore(name: "before_delete_test")`

### 回归测试

> "加载'用户管理测试套件'并执行，对比与上次的结果差异"

Claude会：
1. 调用 `test_suite_load(name: "用户管理测试套件")`
2. 执行所有测试用例
3. 调用 `test_result_query` 获取历史结果
4. 生成对比报告

## 测试数据生成示例

Claude可以根据Swagger定义智能生成测试数据：

### 用户注册接口
```json
{
  "username": "test_user_20241217_001",
  "email": "test_user_001@example.com",
  "password": "Test123456!",
  "phone": "13800138001",
  "age": 25
}
```

### 边界值测试
Claude还会生成边界值和异常测试：
- 用户名过长/过短
- 邮箱格式错误
- 密码强度不够
- 手机号格式错误

## 错误处理示例

当接口返回错误时，Claude会：
1. 分析错误原因
2. 记录错误详情
3. 建议修复方案
4. 继续执行其他测试

### 认证过期处理
如果token过期，Claude会：
1. 检测401错误
2. 自动调用 `auth_login` 重新登录
3. 重试失败的请求

## 报告生成示例

Claude生成的测试报告包含：

### 执行摘要
- 总测试数：15
- 通过数：12
- 失败数：2
- 错误数：1
- 通过率：80%

### 性能统计
- 平均响应时间：156ms
- 最慢接口：POST /api/users (325ms)
- 最快接口：GET /api/users/count (23ms)

### 失败分析
- 用户名重复导致注册失败（预期行为）
- 获取不存在用户返回404（预期行为）
- 删除用户权限不足（需要检查）

## 最佳实践

### 1. 环境管理
- 为不同环境创建独立配置
- 定期更新认证信息
- 使用数据库快照隔离测试

### 2. 测试组织
- 按功能模块组织测试套件
- 使用有意义的批次ID
- 定期清理过期测试结果

### 3. 数据管理
- 使用test_context管理关联数据
- 测试完成后清理测试数据
- 备份重要的测试套件

### 4. 与Claude协作
- 提供清晰的测试目标
- 让Claude处理复杂的数据生成
- 利用Claude的分析能力优化测试策略

这个API测试MCP为Claude提供了强大的API测试能力，通过智能协作可以大大提高API测试的效率和质量。