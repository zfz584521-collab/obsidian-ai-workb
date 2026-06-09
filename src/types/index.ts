/**
 * AI Workbench - Type Definitions
 */

// ============ Settings ============

export interface ApiSettings {
    endpoint: string;
    apiKey: string;
    model: string;
    timeout: number;
    headers: Record<string, string>;
}

export interface OutputSettings {
    summaryPosition: 'append' | 'prepend' | 'newFile';
    language: 'auto' | 'zh' | 'en';
    includeTimestamp: boolean;
    defaultMindmapFormat: 'markdown' | 'mermaid';
}

export interface BackupSettings {
    enabled: boolean;
    maxCount: number;
    useGit: boolean;
}

export interface ClaudianSettings {
    showButton: boolean;
}

// Custom Prompt Template
export interface CustomPrompt {
    id: string;
    name: string;
    description: string;
    prompt: string;
    outputMode: 'append' | 'prepend' | 'newFile' | 'replace' | 'selection';
    category?: string; // Category ID: basic, xiaohongshu, video, wechat, translate, code, other
    variables?: PromptVariable[];
    createdAt: number;
    updatedAt: number;
}

// Template Variables
export interface PromptVariable {
    name: string;
    label: string;
    defaultValue?: string;
    type: 'text' | 'select';
    options?: string[];
}

export interface CustomPromptSettings {
    prompts: CustomPrompt[];
}

// Keyboard Shortcuts
export interface ShortcutBinding {
    actionId: string;
    customPromptId?: string;
    key: string;
    modifiers: ('Ctrl' | 'Alt' | 'Shift' | 'Meta')[];
}

export interface ShortcutSettings {
    enabled: boolean;
    bindings: ShortcutBinding[];
}

// Context Menu
export interface ContextMenuSettings {
    enabled: boolean;
    showBuiltInActions: boolean;
    showCustomPrompts: boolean;
}

// UI Settings
export interface UISettings {
    showStatusBar: boolean;
    confirmBeforeReplace: boolean;
    showTokenCount: boolean;
}

export interface WorkbenchSettings {
    api: ApiSettings;
    output: OutputSettings;
    backup: BackupSettings;
    claudian: ClaudianSettings;
    customPrompts: CustomPromptSettings;
    shortcuts: ShortcutSettings;
    contextMenu: ContextMenuSettings;
    ui: UISettings;
}

// ============ AI Response ============

export interface AIResponse {
    success: boolean;
    content?: string;
    error?: string;
    tokensUsed?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

// ============ Action Types ============

export type ActionType = 'summarize' | 'outline' | 'translate' | 'format' | 'mindmap' | 'mermaid' | 'custom';

export interface ActionContext {
    notePath: string;
    noteContent: string;
    noteTitle: string;
    selectedText?: string;
    customPromptId?: string;
    isSelection: boolean;
    variables?: Record<string, string>;
}

export interface ActionResult {
    success: boolean;
    output?: string;
    outputPath?: string;
    error?: string;
    timestamp: number;
    tokensUsed?: number;
}

// ============ History ============

export interface HistoryEntry {
    id: string;
    action: ActionType;
    actionName: string;
    notePath: string;
    noteTitle: string;
    timestamp: number;
    success: boolean;
    outputPath?: string;
    isSelection: boolean;
    tokensUsed?: number;
    backupPath?: string;
}

// ============ Batch Processing ============

export interface BatchJob {
    id: string;
    actionType: ActionType;
    customPromptId?: string;
    files: string[];
    completed: string[];
    failed: { path: string; error: string }[];
    status: 'pending' | 'running' | 'completed' | 'cancelled';
    startedAt?: number;
    completedAt?: number;
}

// ============ Default Settings ============

export const DEFAULT_SETTINGS: WorkbenchSettings = {
    api: {
        endpoint: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
        timeout: 60,
        headers: {}
    },
    output: {
        summaryPosition: 'append',
        language: 'auto',
        includeTimestamp: true,
        defaultMindmapFormat: 'markdown'
    },
    backup: {
        enabled: true,
        maxCount: 10,
        useGit: false
    },
    claudian: {
        showButton: true
    },
    customPrompts: {
        prompts: []
    },
    shortcuts: {
        enabled: true,
        bindings: [
            { actionId: 'summarize', key: 'S', modifiers: ['Ctrl', 'Alt'] },
            { actionId: 'translate', key: 'T', modifiers: ['Ctrl', 'Alt'] },
            { actionId: 'mindmap', key: 'M', modifiers: ['Ctrl', 'Alt'] }
        ]
    },
    contextMenu: {
        enabled: true,
        showBuiltInActions: true,
        showCustomPrompts: true
    },
    ui: {
        showStatusBar: true,
        confirmBeforeReplace: true,
        showTokenCount: false
    }
};

// ============ Built-in Prompts ============

export const BUILTIN_PROMPTS: Record<string, string> = {
    summarize: `请为以下笔记内容生成一个简洁的总结。

要求：
1. 使用无序列表格式，每个要点一行
2. 提取最重要的 3-7 个关键点
3. 保持原文的核心信息和观点
4. 语言简洁，每个要点不超过 50 字

只返回总结内容，不要添加额外说明。`,

    outline: `请为以下笔记内容生成一个层级大纲。

要求：
1. 使用 Markdown 标题格式（##, ###, ####）
2. 层级不超过 4 级
3. 提取主要章节和子章节
4. 每个标题简洁明了

只返回大纲内容，不要添加额外说明。`,

    translate: `请将以下笔记内容翻译。

要求：
1. 保持原文的格式和结构
2. 专有名词保持原文或使用通用译法
3. 保持 Markdown 语法不变
4. 翻译要流畅自然

只返回翻译后的内容，不要添加额外说明。`,

    format: `请对以下笔记内容进行格式优化。

要求：
1. 统一标题层级（避免跳级）
2. 规范列表格式（统一使用 - 或 1.）
3. 优化段落间距
4. 修复明显的格式问题
5. 保持原文内容不变

只返回格式化后的内容，不要添加额外说明。`,

    mindmap: `请基于以下笔记内容生成一个 Markdown 格式的思维导图。

要求：
1. 使用 Markdown 无序列表格式表示层级
2. 根节点是笔记标题或主题
3. 提取主要概念作为一级节点
4. 提取子概念作为二级、三级节点
5. 每个节点文字简洁，不超过 15 字
6. 层级不超过 4 级

示例格式：
- 主题
  - 分支1
    - 子节点1
    - 子节点2
  - 分支2
    - 子节点1

只返回思维导图内容，不要添加额外说明。`,

    mermaid: `请基于以下笔记内容生成一个 Mermaid 格式的思维导图代码。

要求：
1. 使用 Mermaid mindmap 语法
2. 根节点是笔记标题或主题
3. 提取主要概念作为一级节点
4. 提取子概念作为二级、三级节点
5. 每个节点文字简洁，不超过 15 字
6. 使用中文节点名

示例格式：
\`\`\`mermaid
mindmap
  root((主题))
    分支1
      子节点1
      子节点2
    分支2
      子节点1
\`\`\`

只返回 mermaid 代码块，不要添加额外说明。`,

    selection: `请处理以下选中的文本内容。

根据用户的需求进行处理，保持格式和结构。`
};
