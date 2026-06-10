# AI Workbench 开发文档

本文档面向开发者，介绍如何参与 AI Workbench 的开发和贡献。

## 📋 目录

- [开发环境搭建](#开发环境搭建)
- [项目结构](#项目结构)
- [核心架构](#核心架构)
- [开发指南](#开发指南)
- [API 参考](#api-参考)
- [测试](#测试)
- [发布流程](#发布流程)

---

## 开发环境搭建

### 系统要求

- **Node.js**: 16.x 或更高版本
- **npm**: 7.x 或更高版本
- **TypeScript**: 4.x 或更高版本
- **Obsidian**: 1.4.0 或更高版本

### 环境准备

```bash
# 1. 克隆仓库
git clone https://github.com/zfz584521-collab/obsidian-ai-workb.git
cd obsidian-ai-workb

# 2. 安装依赖
npm install

# 3. 开发模式（自动重载）
npm run dev

# 4. 生产构建
npm run build
```

### 开发模式设置

为了在开发时能够实时测试，建议将项目放在 Obsidian 的插件目录：

```bash
# macOS
cd /path/to/your/vault/.obsidian/plugins/
git clone https://github.com/zfz584521-collab/obsidian-ai-workb.git ai-workbench

# Windows
cd C:\Users\你的用户名\Documents\Obsidian\你的库\.obsidian\plugins\
git clone https://github.com/zfz584521-collab/obsidian-ai-workb.git ai-workbench

# Linux
cd ~/Documents/Obsidian/你的库/.obsidian/plugins/
git clone https://github.com/zfz584521-collab/obsidian-ai-workb.git ai-workbench

# 然后安装依赖并启动开发模式
cd ai-workbench
npm install
npm run dev
```

### IDE 推荐

**推荐 VS Code 插件：**
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Obsidian Plugin Development

---

## 项目结构

```
obsidian-ai-workb/
├── manifest.json              # 插件清单
├── package.json               # npm 配置
├── tsconfig.json              # TypeScript 配置
├── esbuild.config.mjs         # 构建配置
├── main.ts                    # 插件主入口
├── styles.css                 # 样式文件
├── src/                       # 源代码目录
│   ├── types/                 # TypeScript 类型定义
│   │   └── index.ts           # 所有类型和接口
│   ├── constants.ts           # 常量定义
│   ├── interfaces.ts          # 接口定义
│   ├── services/              # 服务层
│   │   ├── ai.ts              # AI 服务
│   │   ├── backup.ts          # 备份服务
│   │   ├── backup-manager.ts  # 备份管理
│   │   ├── claudian.ts        # Claudian 集成
│   │   ├── context-menu.ts    # 右键菜单
│   │   ├── presets.ts         # 预设模板
│   │   ├── statistics.ts      # 统计服务
│   │   └── status-bar.ts      # 状态栏
│   ├── actions/               # 动作处理
│   │   └── index.ts           # 动作注册和执行
│   └── settings.ts            # 设置面板
├── prompts/                   # 预设 Prompt 目录
│   ├── summarize.md
│   ├── outline.md
│   ├── translate.md
│   └── format.md
└── docs/                      # 文档目录
    └── superpowers/           # 开发计划
```

---

## 核心架构

### 架构设计

```
┌─────────────────────────────────────────┐
│           Obsidian Plugin               │
│  ┌────────────────────────────────────┐ │
│  │         Main Plugin Class          │ │
│  │  - Plugin Lifecycle                │ │
│  │  - Command Registration            │ │
│  │  - View Management                 │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │Services  │  │ Actions  │  │Settings││
│  ├──────────┤  ├──────────┤  ├────────┤│
│  │AI        │  │Summarize │  │API     ││
│  │Backup    │  │Translate │  │General ││
│  │Statistics│  │Outline   │  │UI      ││
│  │StatusBar │  │Custom    │  │Backup  ││
│  └──────────┘  └──────────┘  └────────┘│
└─────────────────────────────────────────┘
```

### 核心模块

#### 1. Main Plugin Class (`main.ts`)

主插件类负责：
- 插件初始化和卸载
- 命令注册
- 视图管理
- 服务协调

```typescript
export default class AIWorkbenchPlugin extends Plugin {
    // 服务实例
    settings: PluginSettings;
    aiService: AIService;
    backupService: BackupService;
    statisticsService: StatisticsService;
    statusBarService: StatusBarService;

    // 生命周期方法
    async onload() {
        // 加载设置
        // 初始化服务
        // 注册命令
        // 注册视图
    }

    onunload() {
        // 清理资源
    }
}
```

#### 2. Services Layer (`src/services/`)

服务层提供核心功能：

**AIService** - AI API 调用
```typescript
class AIService {
    async complete(prompt: string, content: string): Promise<AIResponse> {
        // 调用 AI API
        // 返回结果和 token 使用量
    }
}
```

**BackupService** - 备份管理
```typescript
class BackupService {
    async createBackup(filePath: string): Promise<void> {
        // 创建备份
    }

    async restoreBackup(backupPath: string): Promise<void> {
        // 恢复备份
    }
}
```

**StatisticsService** - 使用统计
```typescript
class StatisticsService {
    async recordSuccess(action: string, tokens?: TokenUsage): Promise<void> {
        // 记录成功的操作
    }

    getStats(): Statistics {
        // 获取统计数据
    }
}
```

#### 3. Actions Layer (`src/actions/`)

动作层处理用户操作：

```typescript
async function executeAction(
    plugin: AIWorkbenchPlugin,
    action: ActionType,
    content: string
): Promise<ActionResult> {
    // 获取对应的 prompt
    // 调用 AI 服务
    // 处理结果
    // 返回结果
}
```

---

## 开发指南

### 添加新的 AI 动作

#### 步骤 1: 定义动作类型

在 `src/types/index.ts` 中添加：

```typescript
export type ActionType =
    | 'summarize'
    | 'outline'
    | 'translate'
    | 'your-new-action';  // 添加新动作

export interface BuiltinPrompt {
    id: ActionType;
    name: string;
    description: string;
    prompt: string;
    defaultOutputMode: OutputMode;
}
```

#### 步骤 2: 添加 Prompt

在 `src/types/index.ts` 的 `BUILTIN_PROMPTS` 中添加：

```typescript
export const BUILTIN_PROMPTS: BuiltinPrompt[] = [
    // ... 现有的 prompts
    {
        id: 'your-new-action',
        name: '新动作名称',
        description: '动作描述',
        prompt: '你的 prompt 模板',
        defaultOutputMode: 'append'
    }
];
```

#### 步骤 3: 注册命令

在 `main.ts` 的 `addActionCommands()` 方法中添加：

```typescript
this.addCommand({
    id: 'your-new-action',
    name: '执行新动作',
    callback: () => this.handleAction('your-new-action'),
    hotkeys: [{ modifiers: ['Mod', 'Alt'], key: 'x' }]
});
```

### 添加新的服务

#### 步骤 1: 创建服务文件

在 `src/services/` 创建 `your-service.ts`：

```typescript
export class YourService {
    private plugin: AIWorkbenchPlugin;

    constructor(plugin: AIWorkbenchPlugin) {
        this.plugin = plugin;
    }

    async doSomething(): Promise<void> {
        // 实现功能
    }
}
```

#### 步骤 2: 在主类中初始化

在 `main.ts` 中：

```typescript
export default class AIWorkbenchPlugin extends Plugin {
    yourService: YourService;

    async onload() {
        // 初始化服务
        this.yourService = new YourService(this);
    }
}
```

### 添加预设模板

在 `src/services/presets.ts` 的 `PRESET_PROMPTS` 中添加：

```typescript
export const PRESET_PROMPTS: CustomPrompt[] = [
    createPreset(
        'preset-id',
        '预设名称',
        '预设描述',
        'Prompt 模板内容',
        'append', // 输出模式
        '分类名称'
    ),
    // ... 更多预设
];
```

---

## API 参考

### 插件设置

```typescript
interface PluginSettings {
    api: {
        endpoint: string;      // API 端点
        apiKey: string;        // API 密钥
        model: string;         // 模型名称
        timeout: number;       // 超时时间（秒）
    };
    backup: {
        enabled: boolean;      // 是否启用备份
        maxBackups: number;    // 最大备份数
    };
    ui: {
        showConfirmation: boolean;  // 显示确认对话框
        showTokenCount: boolean;    // 显示 token 计数
    };
    customPrompts: CustomPrompt[];  // 自定义 prompt
}
```

### AI 响应

```typescript
interface AIResponse {
    content: string;          // AI 返回的内容
    tokensUsed?: {
        prompt: number;       // Prompt token 数
        completion: number;   // Completion token 数
        total: number;        // 总 token 数
    };
}
```

### 动作结果

```typescript
interface ActionResult {
    success: boolean;         // 是否成功
    content?: string;         // 处理后的内容
    error?: string;           // 错误信息
    tokensUsed?: number;      // 使用的 token 数
}
```

---

## 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "AIService"

# 测试覆盖率
npm run test:coverage
```

### 测试结构

```
tests/
├── unit/               # 单元测试
│   ├── ai.test.ts
│   ├── backup.test.ts
│   └── statistics.test.ts
└── integration/        # 集成测试
    └── plugin.test.ts
```

### 编写测试

```typescript
import { describe, it, expect } from 'vitest';
import { AIService } from '../src/services/ai';

describe('AIService', () => {
    it('should complete prompt successfully', async () => {
        const service = new AIService(mockPlugin);
        const result = await service.complete('test prompt', 'test content');

        expect(result.content).toBeDefined();
        expect(result.tokensUsed).toBeDefined();
    });
});
```

---

## 发布流程

### 版本号规范

遵循语义化版本规范 (SemVer)：
- **MAJOR**: 不兼容的 API 更改
- **MINOR**: 向后兼容的功能新增
- **PATCH**: 向后兼容的问题修复

### 发布步骤

#### 1. 准备发布

```bash
# 更新版本号
npm version patch  # 或 minor / major

# 更新 CHANGELOG.md
# 记录本次更新的内容

# 构建生产版本
npm run build
```

#### 2. 测试

```bash
# 运行测试
npm test

# 手动测试
# 在 Obsidian 中测试所有功能
```

#### 3. 创建 Release

```bash
# 提交更改
git add .
git commit -m "chore: release v0.2.0"
git tag v0.2.0

# 推送到 GitHub
git push origin main --tags
```

#### 4. GitHub Release

1. 访问 GitHub 仓库的 Releases 页面
2. 点击 "Draft a new release"
3. 选择刚创建的 tag
4. 填写 Release Notes
5. 上传必要文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
6. 发布 Release

#### 5. 发布到社区插件市场（可选）

如果要发布到 Obsidian 社区插件市场：

1. Fork [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)
2. 编辑 `community-plugins.json`
3. 提交 PR
4. 等待审核

---

## 代码规范

### TypeScript 规范

- 使用严格的 TypeScript 配置
- 所有公共 API 必须有类型注解
- 避免使用 `any`，使用 `unknown` 或具体类型

### 命名规范

```typescript
// 类名：PascalCase
class AIService {}

// 接口名：PascalCase
interface PluginSettings {}

// 函数名：camelCase
function executeAction() {}

// 常量：UPPER_SNAKE_CASE
export const DEFAULT_MAX_TOKENS = 4096;

// 文件名：kebab-case
// your-service.ts
```

### 注释规范

```typescript
/**
 * 执行 AI 动作
 * @param action - 动作类型
 * @param content - 要处理的内容
 * @returns 处理结果
 */
async function executeAction(
    action: ActionType,
    content: string
): Promise<ActionResult> {
    // 实现
}
```

---

## 贡献指南

### 提交代码

1. Fork 项目
2. 创建特性分支
3. 编写代码和测试
4. 确保所有测试通过
5. 提交 Pull Request

### 代码审查

所有 PR 都需要经过代码审查：
- 代码质量
- 测试覆盖率
- 文档完整性
- 性能影响

### 问题反馈

在 GitHub Issues 中提交问题：
- 描述问题的详细步骤
- 提供错误日志
- 说明环境信息（OS、Obsidian 版本等）

---

## 常见问题

### 开发环境问题

**Q: npm install 很慢？**
```bash
# 使用国内镜像
npm config set registry https://registry.npmmirror.com
```

**Q: 热重载不工作？**
- 确保 `npm run dev` 正在运行
- 检查 Obsidian 是否启用了插件
- 尝试手动重新加载插件

### 构建问题

**Q: 构建失败？**
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 相关资源

- [Obsidian API 文档](https://docs.obsidian.md/Reference/TypeScript+API)
- [Obsidian 插件开发指南](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)

---

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。
