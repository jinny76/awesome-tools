# Screensaver (screen) - 工作伪装屏保工具

专业的终端屏保工具，提供多种逼真的工作场景模拟，完美伪装工作状态。

## 快速开始

```bash
# 使用缩写命令 (推荐)
ats screen [选项]

# 完整命令
awesome-tools screensaver [选项]

# 交互式选择向导（最简单）
ats screen -w
```

## 命令选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-w, --wizard` | 启动交互式选择向导 | - |
| `-t, --type <type>` | 屏保类型 | - |
| `-s, --speed <ms>` | 动画速度（毫秒） | 各类型默认值 |

### 可用屏保类型

| 类型 | 说明 | 默认速度 |
|------|------|----------|
| `coding` | 代码编写模拟 | 150ms |
| `logs` | 服务器日志监控 | 800ms |
| `compiler` | C++编译过程 | 300ms |
| `analysis` | 数据分析仪表板 | 1200ms |
| `network` | 网络安全监控 | 600ms |

## 屏保场景详解

### 1. 代码编写模拟 (coding)
模拟真实的代码编写过程，支持多种编程语言和框架。

**特点：**
- 多语言支持：JavaScript、Python、Java、Go、Rust等
- 真实的代码片段和注释
- 模拟打字效果和代码补全
- 随机的重构和优化操作
- IDE风格的语法高亮

**适用场景：** 开发环境、编程工作

### 2. 服务器日志监控 (logs)
实时滚动的服务器日志，展示系统运行状态。

**特点：**
- 多服务混合日志：nginx、mysql、redis、api-server等
- 真实的时间戳（历史到实时）
- 不同级别日志：INFO、WARN、ERROR、DEBUG
- HTTP请求日志、系统状态、错误信息
- 动态滚动效果

**适用场景：** 运维监控、系统管理

### 3. C++编译过程 (compiler)
模拟大型C++项目的编译过程。

**特点：**
- CMake构建系统输出
- 编译进度百分比
- 编译警告和错误（自动恢复）
- 链接库依赖显示
- 多项目切换（自动切换不同项目）
- 真实的编译速率统计

**适用场景：** C++开发、系统编程

### 4. 数据分析仪表板 (analysis)
动态的数据处理和分析界面。

**特点：**
- 实时数据处理进度
- 多维度统计图表（ASCII）
- 机器学习模型训练
- 数据质量报告
- ETL流程监控
- 性能指标展示

**适用场景：** 数据分析、机器学习

### 5. 网络安全监控 (network)
网络流量和安全事件监控中心。

**特点：**
- 实时连接事件流
- 安全威胁检测告警
- 多协议支持：HTTP、HTTPS、SSH、DNS等
- 带宽使用率监控
- 防火墙规则更新
- 国家/地区标识

**适用场景：** 网络安全、系统管理

## 使用示例

### 基础用法

```bash
# 启动交互式向导（推荐）
ats screen -w

# 直接启动指定类型
ats screen -t coding        # 代码编写
ats screen -t logs          # 日志监控
ats screen -t compiler      # 编译过程
ats screen -t analysis      # 数据分析
ats screen -t network       # 网络监控

# 调整动画速度
ats screen -t logs -s 500   # 更快的日志滚动
ats screen -t coding -s 200 # 较慢的打字速度
```

### 高级技巧

```bash
# 组合使用 - 在不同终端窗口运行不同屏保
# 终端1: 代码编写
ats screen -t coding

# 终端2: 编译输出
ats screen -t compiler

# 终端3: 日志监控
ats screen -t logs
```

## 技术特性

### 智能屏幕适配
- **动态尺寸检测** - 自动适应终端窗口大小
- **最大化利用空间** - 40行终端可显示30+行内容
- **响应式布局** - 标题、内容、状态栏合理分配

### 真实感优化
- **历史数据预填充** - 避免从空白屏幕开始
- **渐进式时间戳** - 从历史时间逐渐过渡到实时
- **随机性算法** - 避免明显的循环模式
- **专业术语使用** - 真实的技术词汇和格式

### 性能优化
- **异步渲染** - 流畅的动画效果
- **内存优化** - 循环缓冲区避免内存泄漏
- **CPU友好** - 合理的刷新频率

## 退出方式

所有屏保都支持以下退出方式：
- **Ctrl+C** - 优雅退出
- **q** 或 **Q** - 快速退出
- **ESC** - 紧急退出

## 效果预览

### 代码编写效果
```javascript
// 🔧 重构: 优化性能关键路径
const optimizedProcess = async (data) => {
  // 使用 Web Workers 并行处理
  const chunks = splitIntoChunks(data, CHUNK_SIZE);
  const workers = await initializeWorkerPool();
  
  const results = await Promise.all(
    chunks.map(chunk => processInWorker(chunk, workers))
  );
  
  return mergeResults(results);
};
```

### 日志监控效果
```
2024-01-15 10:23:45 INFO  [nginx] 192.168.1.100 - - "GET /api/users HTTP/1.1" 200
2024-01-15 10:23:46 WARN  [redis] High memory usage detected: 87% of 16GB
2024-01-15 10:23:47 ERROR [mysql] Database connection timeout after 30s
2024-01-15 10:23:48 INFO  [api-server] Request processed in 45ms
```

### 网络监控效果
```
17:20:15 CONNECTION INFO HTTPS connection established 192.168.1.50:443 -> 8.8.8.8
17:20:15 THREAT     HIGH 🚨 DDoS attack detected from 203.45.67.89 (CN) - BLOCKED
17:20:16 BANDWIDTH  WARN eth0 utilization: 94%, 980.5Mbps
17:20:16 SYSTEM     INFO Firewall rules updated: 5,847 active rules
```

## 注意事项

1. **终端兼容性** - 需要支持ANSI转义序列的终端
2. **颜色支持** - 建议使用支持256色的终端
3. **窗口大小** - 建议终端窗口至少80列×24行
4. **字体选择** - 等宽字体效果最佳
5. **性能影响** - 屏保运行时会占用少量CPU

## 最佳实践

### 场景选择
- **日常开发**: 使用 `coding` 或 `compiler`
- **运维工作**: 使用 `logs` 或 `network`
- **数据岗位**: 使用 `analysis`
- **混合使用**: 多个终端运行不同类型

### 速度调节
- **正常工作**: 使用默认速度
- **紧急伪装**: 使用较快速度 (-s 100)
- **长时间运行**: 使用较慢速度 (-s 2000)

## 相关资源

- [主命令文档](../../README.md)
- [FFmpeg工具](./ffmpeg.md)
- [分享服务器](./share-server.md)