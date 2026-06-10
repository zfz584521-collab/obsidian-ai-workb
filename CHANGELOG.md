# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 待添加的新功能

### Changed
- 待改进的功能

### Fixed
- 待修复的问题

---

## [0.1.0] - 2026-06-10

### Added

#### Core Features
- ✨ **快捷操作**：总结、大纲、翻译、格式化、思维导图、Mermaid 图表
- ✨ **自定义 Prompt**：创建和管理自定义 AI 处理动作
- ✨ **预设模板库**：25个常用模板，涵盖小红书、短视频、公众号等场景
- ✨ **选中文本处理**：只处理选中的内容，支持精准编辑
- ✨ **Claudian 集成**：发送到 Claude Code 进行深度处理
- ✨ **右键菜单**：快速访问 AI 操作
- ✨ **备份管理**：自动备份，可随时恢复
- ✨ **预览对比**：处理前预览，确认后再应用
- ✨ **统计追踪**：Token 使用量和成本统计

#### Services
- 🚀 AI Service - 支持 OpenAI 兼容 API
- 🚀 Backup Service - 自动备份和恢复
- 🚀 Statistics Service - 使用统计
- 🚀 Status Bar Service - 状态栏显示

#### Templates
- 📝 基础处理（5个）：润色、扩写、精简、提取、FAQ
- 📕 小红书（3个）：笔记、标题、话题标签
- 📱 短视频（5个）：脚本、口播、标题、评论、直播
- 📰 公众号（5个）：排版、标题、开头、配图、金句
- 🌍 翻译（2个）：中英互译
- 💻 代码（2个）：注释、解释
- 🛠 其他（3个）：SEO、第一人称、学习笔记

#### Documentation
- 📖 完整的使用说明文档
- 📖 开发者文档
- 📖 GitHub 设置指南
- 📖 后续任务清单

### Security

- 🔒 API Key 仅存储在本地，不会上传到任何服务器
- 🔒 所有 API 请求使用 HTTPS 加密
- 🔒 加强 .gitignore，防止敏感信息泄露
- 🔒 无数据收集和追踪

### Technical Improvements

- 🎨 TypeScript 类型系统完善
- 🎨 模块化架构设计
- 🎨 错误处理和边界情况处理
- 🎨 代码注释和文档完善

---

## Version History

- **0.1.0** (2026-06-10) - 首个正式版本
  - 核心功能实现
  - 预设模板库
  - 完整文档

---

## Upcoming Features

### v0.2.0 (Planned)

- [ ] 支持更多 AI 模型（Claude、Gemini）
- [ ] 流式输出支持
- [ ] 撤销功能增强
- [ ] 批量处理多个笔记

### v0.3.0 (Planned)

- [ ] 多语言支持（国际化）
- [ ] 主题支持
- [ ] 快捷键自定义
- [ ] 模板市场

---

## Migration Guides

暂无迁移指南，这是首个版本。

---

[Unreleased]: https://github.com/zfz584521-collab/obsidian-ai-workb/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zfz584521-collab/obsidian-ai-workb/releases/tag/v0.1.0
