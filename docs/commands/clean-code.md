# Clean Code (cc) - Vue项目死代码清理工具

智能分析Vue+Vite项目，识别并清理未使用的文件、导出和路由。支持静态分析和运行时扫描双重检测。支持MCP服务器集成，可在Claude Desktop中通过`clean_code_analyze`工具直接使用。

## 快速开始

```bash
# 使用缩写命令 (推荐)
ats cc -d <项目目录> [选项]

# 完整命令
awesome-tools clean-code -d <项目目录> [选项]
```

## 命令选项

### 必需参数
| 选项 | 说明 |
|------|------|
| `-d, --dir <path>` | 前端项目根目录路径 |

### 可选参数
| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-e, --entry <paths>` | 自定义入口文件 (逗号分隔) | 自动检测 |
| `-b, --backup` | 执行清理前创建备份 | `true` |
| `--dry-run` | 预览模式，只显示要删除的文件 | `false` |
| `--skip-test` | 跳过npm run dev测试验证 | `false` |
| `--include <patterns>` | 额外包含的文件模式 | `*.ts,*.tsx` |
| `--exclude <patterns>` | 排除的文件模式 | `node_modules/**,dist/**` |
| `--no-gitignore` | 忽略.gitignore规则 | `false` |
| `--debug` | 显示详细调试信息 | `false` |
| `--debug-file <path>` | 调试特定文件 | - |
| `--runtime` | 启用运行时扫描 | `false` |
| `--analyze-runtime` | 分析运行时数据 | `false` |

## 功能特性

### 🔍 静态分析
- **全面的导入/导出分析** - 支持ES6、CommonJS、动态导入
- **Vue特性支持** - 组件、路由、Vuex/Pinia store
- **路径别名解析** - 自动识别 `@`、自定义别名
- **智能入口点检测** - main.js、App.vue、router、store等
- **精确的依赖追踪** - 文件级和导出级死代码检测

### 🏃 运行时扫描
- **自动注入跟踪脚本** - 无侵入式代码使用监控
- **Vue 3完整支持** - Composition API、setup语法糖
- **实时使用数据收集** - 组件挂载、方法调用、路由导航
- **框架集成** - Vue Router 4、Pinia、Element Plus
- **使用报告生成** - 详细的运行时使用统计

### 🛡️ 安全特性
- **自动备份** - 删除前创建完整备份
- **测试验证** - 自动运行npm run dev验证
- **预览模式** - 先查看再删除
- **一键恢复** - 支持从备份快速恢复

## 使用示例

### 基础用法

```bash
# 预览模式 - 查看将要删除的文件（推荐先执行）
ats cc -d ./vue-project --dry-run

# 执行清理（默认创建备份）
ats cc -d ./vue-project

# 跳过备份直接清理（谨慎使用）
ats cc -d ./vue-project --no-backup

# 跳过测试验证
ats cc -d ./vue-project --skip-test
```

### 高级用法

```bash
# 指定自定义入口文件
ats cc -d ./project -e "src/main.js,src/admin.js"

# 排除特定文件模式
ats cc -d ./project --exclude "*.test.js,*.spec.js,__tests__/**"

# 包含额外的文件类型
ats cc -d ./project --include "*.jsx,*.mjs"

# 调试模式 - 查看详细分析过程
ats cc -d ./project --debug

# 调试特定文件为什么被标记为死代码
ats cc -d ./project --debug-file "src/components/MyComponent.vue"
```

### 运行时扫描

```bash
# 步骤1: 注入运行时跟踪脚本
ats cc -d ./vue-project --runtime

# 步骤2: 正常使用你的Vue应用，跟踪脚本会自动收集使用数据

# 步骤3: 分析收集的运行时数据
ats cc -d ./vue-project --analyze-runtime
```

## 分析结果示例

```
🔧 解析项目配置...
📋 项目类型: Vite + Vue 3
🔗 发现 3 个路径别名: @, @components, @utils
🔍 开始分析项目: /path/to/vue-project
📁 找到 127 个源文件

================================================================================
📊 死代码分析结果
================================================================================

❌ 发现 8 个完全未使用的文件:
   1. src/components/OldModal.vue
   2. src/utils/deprecatedHelper.js
   3. src/views/UnusedPage.vue
   4. src/hooks/useOldFeature.js

⚠️ 发现 12 个未使用的导出:
   📄 src/utils/helpers.js:
      🔸 formatLegacyDate (named)
      🔸 validateOldFormat (named)
   📄 src/components/Button.vue:
      🔸 deprecatedProp (named)

🛣️ 发现 3 个未使用的路由:
   1. /admin/legacy (legacy-admin)
      📄 定义在: src/router/admin.js:45
   2. /test-page (test)
      📄 定义在: src/router/index.js:78

📈 统计信息:
   ✅ 使用的文件: 119 (93.7%)
   ❌ 死文件: 8 (6.3%)
   📁 总文件数: 127
   🔸 死导出: 12
   🛣️ 总路由数: 24
   🚫 未使用路由: 3 (12.5%)

💡 预计可清理代码: ~2,340 行 (减少 18.2% 的代码体积)
```

## 支持的项目类型

### ✅ 完全支持
- **Vite + Vue 3** - 最佳支持，包含所有高级特性
- **Vue CLI + Vue 2/3** - 完整的webpack配置解析
- **Nuxt 3** - SSR/SSG项目支持

### ⚠️ 部分支持
- **Webpack项目** - 需要标准的webpack配置
- **Rollup项目** - 基础导入/导出分析

## 配置解析

工具会自动解析以下配置文件：

### Vite配置
```javascript
// vite.config.js
export default {
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components'
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  }
}
```

### Vue CLI配置
```javascript
// vue.config.js
module.exports = {
  configureWebpack: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    }
  }
}
```

## 智能识别模式

### 入口文件检测
自动识别以下入口文件：
- `main.js`, `main.ts`, `app.js`, `app.ts`
- `App.vue`, `app.vue`
- `index.js`, `index.ts` (在src目录)
- `router/index.js`, `store/index.js`
- 配置文件: `vite.config.js`, `vue.config.js`

### 动态导入支持
```javascript
// 支持的动态导入模式
import('./components/LazyComponent.vue')
const module = await import(`./modules/${name}.js`)
component: () => import('./views/Home.vue')  // Vue Router懒加载
```

### require.context支持
```javascript
// 自动识别require.context
const modules = require.context('./modules', true, /\.js$/)
```

## 注意事项

1. **首次使用建议** - 始终先使用 `--dry-run` 预览模式
2. **备份重要性** - 默认开启备份，建议保留此选项
3. **测试验证** - 自动运行 `npm run dev` 确保项目正常
4. **运行时扫描** - 对于复杂项目，建议结合运行时扫描获得更准确结果
5. **自定义入口** - 如果有特殊入口文件，使用 `-e` 选项指定

## 最佳实践

### 渐进式清理
```bash
# 1. 先预览
ats cc -d ./project --dry-run

# 2. 调试可疑文件
ats cc -d ./project --debug-file "src/components/Important.vue"

# 3. 执行清理（保留备份）
ats cc -d ./project

# 4. 测试项目
npm run dev
npm run build
```

### 结合运行时扫描
```bash
# 1. 注入跟踪脚本
ats cc -d ./project --runtime

# 2. 充分使用应用的各个功能
# 3. 分析运行时数据
ats cc -d ./project --analyze-runtime

# 4. 基于两种分析结果进行清理
ats cc -d ./project
```

## 相关命令

- [debug-file](./debug-file.md) - 深入调试文件引用关系
- [git-stats](./git-stats.md) - 分析代码变化趋势