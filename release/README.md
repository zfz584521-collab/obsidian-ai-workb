# AI Workbench - Obsidian Plugin

## 多平台草稿发布

AI 工作台支持把当前笔记准备为微信公众号、小红书、视频号、抖音、X 和 YouTube 草稿。

- 微信公众号：官方草稿箱或 Webhook。
- YouTube：官方 API 私密上传或 Webhook。
- 小红书、视频号、抖音、X：本版本使用 Webhook 草稿。

在“设置 → AI Workbench → 发布平台”中启用平台并配置连接。工作台可同时勾选多个平台，发布前可编辑统一标题、正文、封面、图片、视频和标签，也可为单个平台覆盖内容。

Webhook 支持 Bearer Token、自定义请求头和 HMAC-SHA256 签名。含本地媒体时还需配置媒体上传 URL。平台凭据仅保存在本地插件数据中，但默认并未加密。

多平台提交互不影响：部分平台失败时，成功草稿会保留，失败平台可使用原幂等键单独重试。插件不会自动公开发布，也不会在官方接口失败后静默改走 Webhook。

[![GitHub release](https://img.shields.io/github/v/release/zfz584521-collab/obsidian-ai-workb?include_prereleases)](https://github.com/zfz584521-collab/obsidian-ai-workb/releases)
[![GitHub license](https://img.shields.io/github/license/zfz584521-collab/obsidian-ai-workb)](LICENSE)
[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%483699&label=downloads&query=%24%5B%22ai-workbench%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=ai-workbench)

AI 驱动的 Obsidian 笔记工作台，一键完成总结、翻译、思维导图等操作。

[English](./README_EN.md) | 简体中文

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
- **公众号一键配图**：识别或自动生成生图提示词，批量生成图片并另存新文章

### 🎨 预设模板分类

| 分类 | 模板数 | 说明 |
|------|-------|------|
| 📝 基础处理 | 5 | 润色/扩写/精简/提取/FAQ |
| 📕 小红书 | 3 | 笔记/标题/话题标签 |
| 📱 短视频 | 5 | 脚本/口播/标题/评论/直播 |
| 📰 公众号 | 5 | 排版/标题/开头/配图/金句 |
| 🌍 翻译 | 2 | 中英互译 |
| 💻 代码 | 2 | 注释/解释 |
| 🛠 其他 | 3 | SEO/第一人称/学习笔记 |

## 📖 文档

- **[使用说明](./使用说明.md)** - 完整的使用教程和配置指南
- **[开发文档](./DEVELOPMENT.md)** - 开发者指南和贡献说明
- **[更新日志](./CHANGELOG.md)** - 版本更新记录

## 🚀 快速开始

### 方法 1：下载安装（推荐）

1. 前往 [Releases](https://github.com/zfz584521-collab/obsidian-ai-workb/releases) 页面
2. 下载最新版本的 `main.js`、`manifest.json`、`styles.css`
3. 在你的 Obsidian 库中创建目录：`.obsidian/plugins/ai-workbench/`
4. 将下载的文件复制到该目录
5. 重启 Obsidian，在设置中启用 AI Workbench 插件

### 方法 2：从源码编译

```bash
# 克隆仓库
git clone https://github.com/zfz584521-collab/obsidian-ai-workb.git

# 进入目录
cd obsidian-ai-workb

# 安装依赖
npm install

# 编译
npm run build
```

## ⚙️ 配置

### API 配置

插件支持 OpenAI 兼容的 API：

- **OpenAI API**: `https://api.openai.com/v1`
- **Claude API**: 需使用兼容层
- **国内中转服务**: 填入对应端点
- **本地 Ollama**: `http://localhost:11434/v1`

### 配置步骤

1. 打开 Obsidian 设置 → 社区插件 → AI Workbench
2. 填写配置：
   - **API 端点**: 你的 API 地址
   - **API Key**: 你的密钥
   - **模型**: gpt-4o-mini / gpt-4 / 其他模型
3. 保存设置

### 公众号一键插入图片

在设置页的“图片生成”区域单独配置图片 API 端点、API Key、模型和尺寸。
然后可通过以下入口执行：

- 命令面板：`公众号一键插入图片`
- AI Workbench 侧边栏的“公众号”分类
- 编辑器或 Markdown 文件右键菜单
- 自定义快捷键

插件优先识别文章中的 `AI提示词`、`AI绘图提示词`、`AI生图提示词`。
如果文章没有提示词，会先使用文本 AI 生成结构化配图任务。

原文章不会被修改。生成结果保存为 `原文章名-已配图.md`，图片保存到
`原文章名-已配图-assets/`；重名时自动追加数字编号。

### 快捷键

| 功能 | 默认快捷键 | 说明 |
|------|-----------|------|
| 总结 | `Ctrl/Cmd + Alt + S` | 总结当前笔记 |
| 大纲 | `Ctrl/Cmd + Alt + O` | 生成大纲 |
| 翻译 | `Ctrl/Cmd + Alt + T` | 翻译文本 |
| 格式化 | `Ctrl/Cmd + Alt + F` | 格式化笔记 |
| 思维导图 | `Ctrl/Cmd + Alt + M` | 生成思维导图 |

## 📁 项目结构

```
obsidian-ai-workb/
├── manifest.json          # 插件元信息
├── package.json           # Node.js 配置
├── main.ts                # 插件入口
├── styles.css             # 样式文件
├── src/                   # 源代码
│   ├── types/             # 类型定义
│   ├── services/          # 服务层
│   ├── actions/           # 动作处理
│   └── settings.ts        # 设置面板
├── prompts/               # 预设 Prompt
└── docs/                  # 文档
```

## 🔒 安全性

- ✅ **本地存储**: API Key 仅存储在本地，不会上传到任何服务器
- ✅ **加密传输**: 所有 API 请求使用 HTTPS 加密
- ✅ **无数据收集**: 不收集任何用户数据
- ✅ **开源透明**: 完全开源，代码可审查

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

### 如何贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

详见 [开发文档](./DEVELOPMENT.md)

## 📝 开发路线

- [ ] 支持更多 AI 模型（Claude、Gemini）
- [ ] 流式输出支持
- [ ] 多语言支持
- [ ] 模板市场
- [ ] 批量处理功能

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)

## 🙏 致谢

- [Obsidian](https://obsidian.md/) - 优秀的知识管理工具
- [OpenAI](https://openai.com/) - 强大的 AI 能力
- 所有贡献者和用户

## 📮 联系方式

- **问题反馈**: [GitHub Issues](https://github.com/zfz584521-collab/obsidian-ai-workb/issues)
- **功能建议**: [GitHub Discussions](https://github.com/zfz584521-collab/obsidian-ai-workb/discussions)

---

**如果这个项目对你有帮助，请给一个 ⭐ Star 支持一下！**


---

Packaged as ai-workbench-v0.1.1.zip (82525 bytes).
