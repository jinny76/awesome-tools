# Notify (n) - Server酱消息推送

基于Server酱的消息推送工具，支持发送通知到微信、企业微信等平台。支持多SendKey配置和群发功能。

## 🚀 快速开始

### 1. 获取SendKey
1. 访问 [Server酱官网](https://sct.ftqq.com)
2. 微信扫码登录
3. 获取你的SendKey（格式：SCTxxxxx）

### 2. 配置SendKey
```bash
# 使用向导配置（推荐）
ats notify --wizard
ats n -w

# 直接添加SendKey
ats n --add personal:SCT12345xxxxx
ats n --add work:SCT67890xxxxx --default
```

### 3. 发送消息
```bash
# 发送简单消息
ats n -t "服务器告警" -d "CPU使用率超过90%"

# 使用Markdown格式
ats n -t "部署完成" -d "## 项目已成功部署\n- 版本: v1.2.0\n- 时间: $(date)"
```

## 📝 命令选项

### 配置管理
| 选项 | 说明 | 示例 |
|------|------|------|
| `-w, --wizard` | 配置向导 | `ats n -w` |
| `--add <name:key>` | 添加SendKey | `ats n --add personal:SCT123xxx` |
| `--remove <name>` | 删除SendKey | `ats n --remove personal` |
| `--list` | 列出所有配置 | `ats n --list` |
| `--set-default <name>` | 设置默认通道 | `ats n --set-default work` |
| `--test [channel]` | 测试发送 | `ats n --test personal` |

### 消息发送
| 选项 | 说明 | 示例 |
|------|------|------|
| `-t, --title <title>` | 消息标题 | `ats n -t "告警"` |
| `-d, --desp <content>` | 消息内容 | `ats n -d "详细内容"` |
| `-c, --content <content>` | 内容别名 | `ats n -c "内容"` |
| `--channel <name>` | 指定通道 | `ats n --channel work` |
| `--tags <tags>` | 消息标签 | `ats n --tags "紧急\|服务器"` |
| `--short <text>` | 短消息 | `ats n --short "摘要"` |
| `--stdin` | 从stdin读取 | `echo "内容" \| ats n --stdin` |

## 💡 使用场景

### 1. 服务器监控告警
```bash
# CPU监控
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
if [ "$cpu_usage" -gt 80 ]; then
  ats n -t "⚠️ CPU告警" -d "当前CPU使用率: ${cpu_usage}%" --tags "告警|服务器"
fi

# 磁盘空间监控
disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 90 ]; then
  ats n -t "💾 磁盘告警" -d "根分区使用率: ${disk_usage}%"
fi
```

### 2. 部署通知
```bash
# 部署开始
ats n -t "🚀 开始部署" -d "项目: awesome-tools\n分支: master"

# 执行部署
npm run build

# 部署完成
if [ $? -eq 0 ]; then
  ats n -t "✅ 部署成功" -d "部署完成时间: $(date)"
else
  ats n -t "❌ 部署失败" -d "请检查构建日志" --tags "错误|紧急"
fi
```

### 3. 定时任务通知
```bash
# 备份完成通知
0 2 * * * /backup.sh && ats n -t "备份完成" -d "数据库备份成功: $(date)"

# 日报生成
0 9 * * * /generate_report.sh | ats n --stdin -t "📊 日报已生成"
```

### 4. CI/CD集成
```yaml
# GitHub Actions
- name: Notify Deploy Start
  run: |
    npm install -g awesome_tools
    ats n --add ci:${{ secrets.SERVERCHAN_KEY }}
    ats n -t "GitHub Actions" -d "开始部署 ${{ github.repository }}"

# Jenkins Pipeline
stage('Notify') {
  steps {
    sh 'ats n -t "构建完成" -d "Job: ${JOB_NAME}\nBuild: ${BUILD_NUMBER}"'
  }
}
```

### 5. 多通道群发
```bash
# 配置多个通道
ats n --add personal:SCT111xxx
ats n --add work:SCT222xxx
ats n --add team:SCT333xxx

# 发送到特定通道
ats n -t "工作通知" --channel work

# 发送到多个通道
ats n -t "重要通知" --channel "personal,work"

# 群发到所有通道
ats n -t "紧急通知" -d "服务器宕机" --channel "*"
```

## 🔧 高级功能

### Markdown支持
```bash
# 支持完整的Markdown语法
ats n -t "项目报告" -d "$(cat <<EOF
# 项目进度报告

## 完成情况
- [x] 需求分析
- [x] 系统设计
- [ ] 编码实现
- [ ] 测试部署

## 统计数据
| 模块 | 进度 | 负责人 |
|------|------|--------|
| 前端 | 60%  | 张三   |
| 后端 | 80%  | 李四   |

**预计完成时间**: 2024-03-01
EOF
)"
```

### 标签功能
```bash
# 使用标签分类消息
ats n -t "数据库告警" --tags "紧急|数据库|生产环境"

# 标签可以在Server酱后台过滤查看
```

### 管道支持
```bash
# 从其他命令输出发送
git log --oneline -5 | ats n --stdin -t "最近提交"

# 监控日志并发送
tail -f /var/log/app.log | grep ERROR | ats n --stdin -t "错误日志"
```

### 配置文件位置
配置文件保存在：
- Linux/Mac: `~/.awesome-tools/serverchan.json`
- Windows: `%USERPROFILE%\.awesome-tools\serverchan.json`

配置文件格式：
```json
{
  "sendkeys": [
    {
      "name": "personal",
      "key": "SCT12345xxxxx",
      "addTime": "2024-01-01T10:00:00.000Z"
    }
  ],
  "defaultChannel": "personal",
  "channels": {}
}
```

## 📦 NPX支持

可以作为独立包使用：
```javascript
const { createNPXWrapper } = require('awesome_tools/lib/commands/server-chan');
const notify = createNPXWrapper();

// 发送消息
await notify.send('标题', '内容', { channel: 'personal' });

// 配置管理
await notify.config('add', 'work', 'SCT67890xxx');
await notify.config('list');
```

## 🔄 与其他命令配合

### 配合clean-code
```bash
# 清理完成后通知
ats cc -d ./project --dry-run
if [ $? -eq 0 ]; then
  ats n -t "代码清理完成" -d "已清理死代码文件"
fi
```

### 配合git-stats
```bash
# 生成报告并发送摘要
ats gs --since "1 week ago" > report.txt
head -20 report.txt | ats n --stdin -t "周代码统计"
```

### 配合ffmpeg
```bash
# 视频转换完成通知
ats ff --convert video.mp4 --format webm
ats n -t "转换完成" -d "video.mp4 已转换为 webm 格式"
```

## ⚠️ 注意事项

1. **SendKey安全** - 不要将SendKey提交到代码仓库
2. **发送频率** - Server酱有调用频率限制，避免短时间大量发送
3. **消息长度** - 标题最长32字符，内容最长32KB
4. **网络要求** - 需要能访问 sctapi.ftqq.com

## 🐛 故障排除

### SendKey无效
```bash
# 检查SendKey格式（应以SCT开头）
ats n --list

# 重新添加
ats n --remove personal
ats n --add personal:SCT正确的key
```

### 发送失败
```bash
# 测试网络连接
ping sctapi.ftqq.com

# 使用代理（如需要）
export https_proxy=http://proxy:8080
ats n -t "测试"
```

### 配置丢失
```bash
# 查看配置文件
cat ~/.awesome-tools/serverchan.json

# 重新配置
ats n --wizard
```

## 相关链接

- [Server酱官网](https://sct.ftqq.com)
- [Server酱文档](https://sct.ftqq.com/doc)
- [主命令文档](../../README.md)