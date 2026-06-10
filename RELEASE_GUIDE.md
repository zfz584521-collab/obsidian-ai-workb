# 创建 GitHub Release v0.1.0 指南

## 📦 Release 文件已准备

已创建以下文件：
- ✅ `ai-workbench-v0.1.0.zip` (34KB) - 包含所有必要文件
- ✅ `main.js` (139KB) - 插件主文件
- ✅ `manifest.json` (440B) - 插件元信息
- ✅ `styles.css` (15KB) - 样式文件
- ✅ `README.md` - 安装说明

---

## 🚀 创建 GitHub Release 步骤

### 步骤 1：访问 Releases 页面

1. 打开你的 GitHub 仓库：
   https://github.com/zfz584521-collab/obsidian-ai-workb

2. 点击右侧边栏的 **"Releases"**

3. 点击 **"Create a new release"** 或 **"Draft a new release"**

---

### 步骤 2：填写 Release 信息

**1. Choose a tag**
```
v0.1.0
```
- 点击 "Choose a tag"
- 输入 `v0.1.0`
- 点击 "Create new tag: v0.1.0 on publish"

**2. Release title**
```
AI Workbench v0.1.0 - 首个版本发布 🎉
```

**3. Describe this release**

复制以下内容：

```markdown
# AI Workbench v0.1.0 🎉

首个正式版本发布！感谢使用 AI Workbench。

## ✨ 功能特性

### 🎯 核心功能
- **快捷操作**：总结、大纲、翻译、格式化、思维导图、Mermaid 图表
- **自定义 Prompt**：创建自己的 AI 处理动作
- **预设模板库**：25个常用模板（小红书、短视频、公众号等）
- **选中文本处理**：只处理选中的内容
- **Claudian 集成**：发送到 Claude Code 深度处理
- **右键菜单**：快速访问 AI 操作
- **备份管理**：自动备份，可随时恢复
- **预览对比**：处理前预览，确认后再应用
- **统计追踪**：Token 使用量和成本统计

### 📦 预设模板库

| 分类 | 模板数 | 说明 |
|------|-------|------|
| 📝 基础处理 | 5 | 润色/扩写/精简/提取/FAQ |
| 📕 小红书 | 3 | 笔记/标题/话题标签 |
| 📱 短视频 | 5 | 脚本/口播/标题/评论/直播 |
| 📰 公众号 | 5 | 排版/标题/开头/配图/金句 |
| 🌍 翻译 | 2 | 中英互译 |
| 💻 代码 | 2 | 注释/解释 |
| 🛠 其他 | 3 | SEO/第一人称/学习笔记 |

### ⌨️ 快捷键

| 功能 | 快捷键 |
|------|--------|
| 总结 | `Ctrl/Cmd + Alt + S` |
| 大纲 | `Ctrl/Cmd + Alt + O` |
| 翻译 | `Ctrl/Cmd + Alt + T` |
| 格式化 | `Ctrl/Cmd + Alt + F` |
| 思维导图 | `Ctrl/Cmd + Alt + M` |

## 📥 安装方法

### 方法 1：下载安装（推荐）

1. 下载 `ai-workbench-v0.1.0.zip` 并解压
2. 在 Obsidian 库中创建目录：`.obsidian/plugins/ai-workbench/`
3. 将解压的文件（`main.js`、`manifest.json`、`styles.css`）复制到该目录
4. 重启 Obsidian
5. 在设置 → 社区插件中启用 AI Workbench

### 方法 2：单独下载

下载以下文件并放入 `.obsidian/plugins/ai-workbench/` 目录：
- `main.js`
- `manifest.json`
- `styles.css`

## ⚙️ 配置

1. 打开 Obsidian 设置 → 社区插件 → AI Workbench
2. 填写 API 配置：
   - **API 端点**：`https://api.openai.com/v1`
   - **API Key**：你的 OpenAI API 密钥
   - **模型**：`gpt-4o-mini`（推荐，性价比高）
3. 保存设置

## 🔒 安全性

- ✅ API Key 仅存储在本地，不会上传到任何服务器
- ✅ 所有 API 请求使用 HTTPS 加密
- ✅ 无数据收集和追踪
- ✅ 完全开源，代码可审查

## 📖 文档

- [完整使用说明](https://github.com/zfz584521-collab/obsidian-ai-workb/blob/main/使用说明.md)
- [开发者文档](https://github.com/zfz584521-collab/obsidian-ai-workb/blob/main/DEVELOPMENT.md)
- [更新日志](https://github.com/zfz584521-collab/obsidian-ai-workb/blob/main/CHANGELOG.md)

## 🐛 已知问题

暂无已知问题。如遇到问题，请在 [Issues](https://github.com/zfz584521-collab/obsidian-ai-workb/issues) 反馈。

## 🙏 致谢

- [Obsidian](https://obsidian.md/) - 优秀的知识管理工具
- [OpenAI](https://openai.com/) - 强大的 AI 能力
- 所有早期用户和贡献者

## 📮 反馈

- 问题反馈：[GitHub Issues](https://github.com/zfz584521-collab/obsidian-ai-workb/issues)
- 功能建议：[GitHub Discussions](https://github.com/zfz584521-collab/obsidian-ai-workb/discussions)

---

**如果这个插件对你有帮助，请给一个 ⭐ Star 支持一下！**
```

---

### 步骤 3：上传文件

**在 "Attach binaries" 部分：**

1. 点击 **"Attach binaries by dropping them here or selecting them"**

2. 上传以下文件：
   - `ai-workbench-v0.1.0.zip`（已准备好）
   - `main.js`（可选，让用户单独下载）
   - `manifest.json`（可选）
   - `styles.css`（可选）

3. 或者直接拖拽 `release/` 目录中的文件

---

### 步骤 4：发布设置

**选项设置：**

- ✅ **Set as the latest release** - 勾选（这是最新版本）
- ⬜ **Set as a pre-release** - 不勾选（这是正式版本）
- ⬜ **Save as draft** - 不勾选（直接发布）

---

### 步骤 5：发布

点击 **"Publish release"** 按钮

---

## ✅ 发布后检查

发布后，请检查：

1. **访问 Release 页面**
   - https://github.com/zfz584521-collab/obsidian-ai-workb/releases

2. **测试下载**
   - 确认 zip 文件可以正常下载
   - 确认所有文件都在

3. **验证安装**
   - 下载 zip 文件
   - 解压并安装到测试库
   - 确认插件可以正常加载和运行

---

## 📋 发布检查清单

- [ ] 创建 tag `v0.1.0`
- [ ] 填写 Release title
- [ ] 填写 Release description
- [ ] 上传 `ai-workbench-v0.1.0.zip`
- [ ] 上传 `main.js`（可选）
- [ ] 上传 `manifest.json`（可选）
- [ ] 上传 `styles.css`（可选）
- [ ] 勾选 "Set as the latest release"
- [ ] 点击 "Publish release"
- [ ] 测试下载和安装

---

## 🎊 发布成功后

发布成功后，你可以：

1. **分享链接**
   - 直接分享 Release 页面链接
   - 用户可以从这里下载安装

2. **更新 README**
   - 在 README 中添加下载徽章
   - 更新安装链接

3. **社交媒体分享**
   - 在 Obsidian 社区分享
   - 在 Reddit r/ObsidianMD 分享
   - 在 Twitter 分享

---

## 💡 提示

- 发布后，Release 页面会显示下载次数
- 用户可以直接从 Release 页面下载安装
- 每次发布新版本时，重复以上步骤

---

需要我帮你完成其他任务吗？
