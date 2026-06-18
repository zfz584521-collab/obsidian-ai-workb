/**
 * Preset Prompts - Built-in useful prompt templates
 */

import { CustomPrompt } from '../types';

export interface PresetCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
}

export interface CategorizedPreset {
    category: PresetCategory;
    presets: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>[];
}

export const PRESET_CATEGORIES: PresetCategory[] = [
    { id: 'basic', name: '基础处理', icon: '📝', description: '润色、扩写、精简等基础操作' },
    { id: 'xiaohongshu', name: '小红书', icon: '📕', description: '种草笔记、爆款标题' },
    { id: 'video', name: '短视频', icon: '📱', description: '抖音、视频号脚本' },
    { id: 'wechat', name: '公众号', icon: '📰', description: '文章标题、金句、配图' },
    { id: 'translate', name: '翻译', icon: '🌍', description: '中英互译' },
    { id: 'code', name: '代码相关', icon: '💻', description: '代码注释、解释' },
    { id: 'other', name: '其他', icon: '🛠', description: 'SEO等其他功能' }
];

// Helper to create preset with category
const createPreset = (
    name: string,
    description: string,
    prompt: string,
    outputMode: 'append' | 'prepend' | 'newFile' | 'replace' | 'selection',
    category: string
): Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'> => ({
    name, description, prompt, outputMode, category
});

export const PRESET_PROMPTS: CategorizedPreset[] = [
    // ========== 基础处理 ==========
    {
        category: PRESET_CATEGORIES[0],
        presets: [
            createPreset('润色文章', '让文字更加流畅专业',
                `请帮我润色以下文字，使其更加流畅、专业、易读。

要求：
1. 保持原文的核心意思不变
2. 优化句式，使表达更加简洁有力
3. 修正语法错误和不通顺的地方
4. 保持原文的语言风格

只返回润色后的内容。`, 'selection', 'basic'),
            createPreset('扩写内容', '将简短内容扩展为详细文章',
                `请帮我将以下内容扩写成一篇详细的文章。

要求：
1. 保持原文的核心观点
2. 添加具体的例子和细节
3. 结构清晰，逻辑连贯
4. 语言流畅自然

只返回扩写后的内容。`, 'newFile', 'basic'),
            createPreset('精简内容', '删除冗余，保留精华',
                `请帮我精简以下内容，删除冗余信息，保留核心要点。

要求：
1. 保留最重要的信息
2. 删除重复、啰嗦的内容
3. 保持逻辑完整
4. 语言简洁有力

只返回精简后的内容。`, 'selection', 'basic'),
            createPreset('提取关键信息', '提取文中的关键数据和要点',
                `请从以下内容中提取关键信息和重要数据。

要求：
1. 使用列表格式
2. 按重要性排序
3. 保留具体数据和数字

格式：
- 📌 关键点：xxx
- 📊 数据：xxx
- 💡 洞察：xxx

只返回提取的内容。`, 'append', 'basic'),
            createPreset('生成 FAQ', '基于内容生成常见问答',
                `请基于以下内容生成 FAQ（常见问答）。

要求：
1. 提取 5-10 个可能的疑问
2. 给出清晰简洁的回答
3. 回答基于原文内容

格式：
## Q1: 问题？
A: 回答

只返回 FAQ 内容。`, 'append', 'basic')
        ]
    },
    // ========== 小红书 ==========
    {
        category: PRESET_CATEGORIES[1],
        presets: [
            createPreset('小红书笔记', '生成小红书风格的种草笔记',
                `请将以下内容改写成小红书风格的种草笔记。

要求：
1. 标题吸睛，带emoji，15字以内
2. 开头用痛点或场景引入
3. 正文分点叙述，每点带emoji
4. 语气亲切自然，像朋友推荐
5. 结尾加互动引导
6. 添加10-15个相关话题标签

格式：
【标题】✨ 标题内容

开头引入...

📌 要点一
内容...

💬 你的看法？评论区聊聊～

#话题1 #话题2

只返回小红书笔记内容。`, 'newFile', 'xiaohongshu'),
            createPreset('小红书标题', '生成爆款小红书标题',
                `请为以下内容生成 5 个小红书爆款标题。

要求：
1. 吸睛、引发好奇或共鸣
2. 带emoji增加视觉吸引力
3. 长度控制在15字以内
4. 使用数字、对比、疑问等技巧

格式：
1. ✨ 标题1
2. 💡 标题2

只返回标题列表。`, 'append', 'xiaohongshu'),
            createPreset('小红书话题标签', '生成相关话题标签',
                `请为以下内容生成 15-20 个小红书话题标签。

要求：
1. 包含大流量标签和精准标签
2. 与内容高度相关
3. 混合使用热门和长尾标签

格式：
#标签1 #标签2 #标签3

只返回标签。`, 'append', 'xiaohongshu'),
            {
                name: '小红书自动排版',
                description: '按小红书风格生成标题候选、正文和话题标签',
                prompt: '使用“小红书自动排版”内置流程。可在小红书排版规则设置里调整输出风格。',
                outputMode: 'newFile',
                category: 'xiaohongshu',
                enabled: true,
                automationAction: 'xiaohongshu-format'
            },
            {
                name: '排版并发布草稿',
                description: '先自动排版，再保存到小红书草稿箱',
                prompt: '使用“小红书排版并发布草稿”内置流程。可在小红书排版规则设置里调整输出风格。',
                outputMode: 'newFile',
                category: 'xiaohongshu',
                enabled: true,
                automationAction: 'xiaohongshu-format-publish'
            }
        ]
    },
    // ========== 短视频 ==========
    {
        category: PRESET_CATEGORIES[2],
        presets: [
            createPreset('短视频脚本', '生成抖音/视频号脚本',
                `请将以下内容改写成短视频脚本（30-60秒）。

要求：
1. 开头3秒黄金钩子，吸引停留
2. 中间讲清楚1个核心点
3. 结尾引导点赞关注
4. 口语化、短句为主
5. 标注画面建议

格式：
【画面】xxx
【文案】xxx

只返回脚本内容。`, 'newFile', 'video'),
            createPreset('短视频口播文案', '生成口播稿',
                `请将以下内容改写成短视频口播文案（30-60秒）。

要求：
1. 开头3秒抓住注意力
2. 语言口语化、接地气
3. 句子简短有力
4. 有节奏感，适合朗读
5. 结尾有互动引导

字数：150-300字

只返回口播文案。`, 'newFile', 'video'),
            createPreset('短视频标题', '生成吸睛短视频标题',
                `请为以下内容生成 5 个短视频标题。

要求：
1. 引发好奇或情感共鸣
2. 使用数字、疑问、对比等技巧
3. 适合抖音/视频号风格
4. 控制在20字以内

格式：
1. 标题1
2. 标题2

只返回标题列表。`, 'append', 'video'),
            createPreset('短视频评论区互动', '生成评论区神评',
                `请为以下短视频内容生成 10 条评论区互动文案。

要求：
1. 包含：神评、玩梗、追问、共鸣等类型
2. 语气幽默、接地气
3. 能引发二次互动
4. 每条20字以内

格式：
💬 神评类：xxx
❓ 追问类：xxx
😊 共鸣类：xxx

只返回评论内容。`, 'append', 'video'),
            createPreset('直播话术', '生成直播带货话术',
                `请为以下产品/内容生成直播带货话术。

要求：
1. 开场热场话术（吸引停留）
2. 产品介绍话术（卖点+痛点）
3. 促单话术（限时优惠）
4. 互动话术（引导评论）
5. 语气热情、有感染力

格式：
【开场】xxx
【介绍】xxx
【促单】xxx
【互动】xxx

只返回话术内容。`, 'newFile', 'video')
        ]
    },
    // ========== 公众号 ==========
    {
        category: PRESET_CATEGORIES[3],
        presets: [
            createPreset('公众号完整排版', '生成标题+正文+配图提示',
                `请将以下内容改写成公众号文章，包含配图建议。

要求：
1. 生成 3-5 个爆款标题选项
2. 文章开头吸睛（100字内）
3. 正文分段清晰，每段200字左右
4. 标注 3-5 处配图位置和图片描述
5. 每张配图提供 AI 绘图提示词
6. 结尾引导关注

格式：
━━━━ 标题选项 ━━━━
1. 标题1
2. 标题2

━━━━ 正文 ━━━━

【开头】
内容...

【配图1 - 位置：开头下方】
📷 图片描述：xxx
🎨 AI绘图提示词：xxx, high quality, detailed

第一部分标题
内容...

【结尾】
引导关注内容...

只返回文章内容。`, 'newFile', 'wechat'),
            createPreset('公众号标题', '生成公众号爆款标题',
                `请为以下内容生成 5 个公众号标题。

要求：
1. 引发点击欲望
2. 使用：数字、疑问、对比、情绪、利益点
3. 长度15-25字
4. 符合公众号调性

格式：
1. 标题1
2. 标题2

只返回标题列表。`, 'append', 'wechat'),
            createPreset('公众号开头', '生成吸引人的文章开头',
                `请为以下内容生成一个吸引人的公众号文章开头。

要求：
1. 100-200字
2. 用痛点、数据或故事引入
3. 引发读者继续阅读的欲望
4. 语气亲切有温度

只返回开头内容。`, 'selection', 'wechat'),
            createPreset('公众号配图建议', '标注配图位置和提示词',
                `请为以下公众号文章内容标注配图位置和建议。

要求：
1. 标注 3-5 处配图位置
2. 说明每张图的内容描述
3. 提供 AI 绘图提示词（英文）
4. 提示词要具体，包含风格、色调、元素

格式：

【配图1 - 位置：文章开头】
📍 放置位置：标题下方，正文前
📷 图片描述：xxx
🎨 AI提示词：A detailed illustration of xxx, modern style, warm colors, professional, high quality, 16:9 ratio

【配图2 - 位置：第一小节后】
📍 放置位置：第一部分结尾处
📷 图片描述：xxx
🎨 AI提示词：xxx

只返回配图建议。`, 'append', 'wechat'),
            createPreset('公众号金句', '提炼文章金句',
                `请从以下内容中提炼 5-8 个金句。

要求：
1. 每句15-25字
2. 有传播性、可引用
3. 观点鲜明、表达有力
4. 适合发朋友圈或微博

格式：
• 金句1
• 金句2

只返回金句列表。`, 'append', 'wechat')
        ]
    },
    // ========== 翻译 ==========
    {
        category: PRESET_CATEGORIES[4],
        presets: [
            createPreset('中译英', '将中文翻译为英文',
                `请将以下中文内容翻译为英文。

要求：
1. 翻译准确，符合英文表达习惯
2. 专有名词保持原样或提供标准译法
3. 保持 Markdown 格式
4. 语气与原文一致

只返回英文翻译。`, 'newFile', 'translate'),
            createPreset('英译中', '将英文翻译为中文',
                `请将以下英文内容翻译为中文。

要求：
1. 翻译准确，符合中文表达习惯
2. 专有名词保留英文或提供通用译法
3. 保持 Markdown 格式
4. 语气与原文一致

只返回中文翻译。`, 'newFile', 'translate')
        ]
    },
    // ========== 代码相关 ==========
    {
        category: PRESET_CATEGORIES[5],
        presets: [
            createPreset('生成代码注释', '为代码添加详细注释',
                `请为以下代码添加详细的中文注释。

要求：
1. 解释每个函数的作用
2. 说明关键变量的用途
3. 标注复杂逻辑的思路
4. 使用标准注释格式

只返回带注释的代码。`, 'selection', 'code'),
            createPreset('解释代码', '用通俗易懂的语言解释代码',
                `请用通俗易懂的中文解释以下代码的功能和实现思路。

要求：
1. 先概述整体功能
2. 分段解释关键代码
3. 说明输入输出
4. 指出可能的改进点

只返回解释内容。`, 'append', 'code')
        ]
    },
    // ========== 其他 ==========
    {
        category: PRESET_CATEGORIES[6],
        presets: [
            createPreset('SEO 优化标题', '生成适合搜索引擎的标题',
                `请为以下内容生成 5 个 SEO 优化的标题。

要求：
1. 包含核心关键词
2. 长度 15-30 字
3. 吸引点击
4. 适合搜索引擎排名

格式：
1. 标题1
2. 标题2

只返回标题列表。`, 'append', 'other'),
            createPreset('改为第一人称', '将内容改为第一人称叙述',
                `请将以下内容改为第一人称叙述。

要求：
1. 保持原文的内容和结构
2. 使用"我"、"我们"等第一人称
3. 语气自然亲切
4. 保持专业度

只返回修改后的内容。`, 'selection', 'other'),
            createPreset('生成学习笔记', '将内容整理为学习笔记格式',
                `请将以下内容整理为学习笔记格式。

要求：
1. 结构清晰，层级分明
2. 突出重点概念
3. 添加记忆要点
4. 适合复习使用

格式：
# 主题
## 核心概念
- 要点1
- 要点2
## 重要公式/方法
## 记忆技巧

只返回笔记内容。`, 'newFile', 'other')
        ]
    }
];

/**
 * Get all presets flattened
 */
export function getAllPresets(): Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>[] {
    return PRESET_PROMPTS.flatMap(cat => cat.presets);
}

/**
 * Get categorized presets
 */
export function getCategorizedPresets(): CategorizedPreset[] {
    return PRESET_PROMPTS;
}

/**
 * Get categories
 */
export function getCategories(): PresetCategory[] {
    return PRESET_CATEGORIES;
}

/**
 * Get category by id
 */
export function getCategoryById(id: string): PresetCategory | undefined {
    return PRESET_CATEGORIES.find(c => c.id === id);
}
