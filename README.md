# AI Workbench - Obsidian Plugin

AI 驱动的 Obsidian 笔记工作台，一键完成总结、翻译、思维导图等操作。

## 功能特性

- **快捷操作**：总结、大纲、翻译、格式化、思维导图
- **自定义 Prompt**：创建自己的 AI 处理动作
- **预设模板库**：25个常用模板（小红书、短视频、公众号等）
- **选中文本处理**：只处理选中的内容
- **Claudian 集成**：发送到 Claude Code 深度处理
- **右键菜单**：快速访问 AI 操作
- **备份管理**：自动备份，可随时恢复
- **预览对比**：处理前预览，确认后再应用

## 项目结构

```
ai-workbench/
├── manifest.json          # 插件元信息
├── package.json           # Node.js 依赖配置
├── tsconfig.json          # TypeScript 配置
├── esbuild.config.mjs     # 构建配置
├── main.ts                # 插件入口
├── styles.css             # 样式文件
├── src/
│   ├── types/             # 类型定义
│   │   └── index.ts
│   ├── services/          # 服务层
│   │   ├── ai.ts          # AI API 调用
│   │   ├── backup.ts      # 备份服务
│   │   ├── backup-manager.ts
│   │   ├── file.ts        # 文件操作
│   │   ├── claudian.ts    # Claudian 集成
│   │   ├── custom-prompts.ts
│   │   ├── shortcuts.ts   # 快捷键
│   │   ├── context-menu.ts
│   │   ├── status-bar.ts
│   │   ├── undo.ts        # 撤销服务
│   │   ├── preview.ts     # 预览对比
│   │   ├── statistics.ts  # 使用统计
│   │   ├── help.ts        # 帮助系统
│   │   └── presets.ts     # 预设模板
│   ├── actions/           # 动作处理
│   │   └── index.ts
│   └── settings.ts        # 设置面板
└── prompts/               # Prompt 模板
    ├── summarize.md
    ├── outline.md
    ├── translate.md
    └── format.md
```

## 开发指南

### 环境准备

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 生产构建
npm run build
```

### API 配置

插件支持自定义 API 端点，兼容 OpenAI 格式：

- OpenAI API
- Claude API
- 国内中转服务
- 本地 Ollama

### 添加新功能

1. **添加新动作**：
   - 在 `src/types/index.ts` 的 `BUILTIN_PROMPTS` 添加 Prompt
   - 在 `main.ts` 的 `addActionCommands()` 添加命令

2. **添加预设模板**：
   - 在 `src/services/presets.ts` 的 `PRESET_PROMPTS` 添加
   - 使用 `createPreset()` 函数

3. **添加新服务**：
   - 在 `src/services/` 创建新文件
   - 在 `main.ts` 导入并初始化

### 关键接口

```typescript
// 自定义 Prompt
interface CustomPrompt {
    id: string;
    name: string;
    description: string;
    prompt: string;
    outputMode: 'append' | 'prepend' | 'newFile' | 'replace' | 'selection';
    category?: string;
}

// 动作类型
type ActionType = 'summarize' | 'outline' | 'translate' | 'format' | 'mindmap' | 'mermaid' | 'custom';
```

## 预设模板分类

| 分类 | 模板数 | 说明 |
|------|-------|------|
| 📝 基础处理 | 5 | 润色/扩写/精简/提取/FAQ |
| 📕 小红书 | 3 | 笔记/标题/话题标签 |
| 📱 短视频 | 5 | 脚本/口播/标题/评论/直播 |
| 📰 公众号 | 5 | 排版/标题/开头/配图/金句 |
| 🌍 翻译 | 2 | 中英互译 |
| 💻 代码 | 2 | 注释/解释 |
| 🛠 其他 | 3 | SEO/第一人称/学习笔记 |

## 注意事项

- 修改 `main.ts` 后需要运行 `npm run build`
- 修改 `styles.css` 后需要重新加载插件
- 测试时建议开启「替换前确认」预览功能
