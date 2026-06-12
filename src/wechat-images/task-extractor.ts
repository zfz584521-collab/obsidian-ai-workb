import { ArticleAnchor, ArticleImageTask } from './types';
import { parseExistingImageTasks } from './prompt-parser';

export interface JsonTextClient {
    completeJson(prompt: string, content: string): Promise<string>;
}

interface GeneratedTaskValue {
    prompt?: unknown;
    description?: unknown;
    anchor?: {
        heading?: unknown;
        nearbyText?: unknown;
        placement?: unknown;
    };
}

const TASK_PROMPT = `请为以下公众号文章规划 3-5 张配图。
只返回 JSON，不要添加解释或 Markdown 代码围栏。格式必须为：
{"tasks":[{"prompt":"English image generation prompt","description":"中文图片描述","anchor":{"heading":"文章中完全一致的标题文本，不含 #","nearbyText":"从文章中复制的简短原文","placement":"before 或 after"}}]}
要求：
1. heading 和 nearbyText 必须逐字复制文章原文。
2. 每个任务至少提供 heading 或 nearbyText。
3. prompt 必须具体，包含主体、构图、风格、色调和横版比例。
4. 不要生成重复任务。`;

function stripCodeFence(value: string): string {
    const trimmed = value.trim();
    const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    return match ? match[1].trim() : trimmed;
}

function nonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}

function parseAnchor(value: GeneratedTaskValue['anchor']): ArticleAnchor | undefined {
    if (!value || (value.placement !== 'before' && value.placement !== 'after')) {
        return undefined;
    }

    const heading = nonEmptyString(value.heading);
    const nearbyText = nonEmptyString(value.nearbyText);
    if (!heading && !nearbyText) return undefined;

    return {
        ...(heading ? { heading } : {}),
        ...(nearbyText ? { nearbyText } : {}),
        placement: value.placement
    };
}

export class ImageTaskExtractor {
    constructor(
        private textClient: JsonTextClient,
        private maxImages: number
    ) {}

    async extract(source: string): Promise<ArticleImageTask[]> {
        const existing = parseExistingImageTasks(source);
        if (existing.length > 0) return existing;

        const raw = await this.textClient.completeJson(TASK_PROMPT, source);
        let parsed: { tasks?: unknown };
        try {
            parsed = JSON.parse(stripCodeFence(raw));
        } catch {
            throw new Error('文本 AI 返回的配图任务不是有效 JSON');
        }

        if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
            throw new Error('文本 AI 未返回有效配图任务');
        }
        if (parsed.tasks.length > this.maxImages) {
            throw new Error(`单篇文章最多生成 ${this.maxImages} 张图片`);
        }

        const tasks: ArticleImageTask[] = [];
        const seen = new Set<string>();
        for (const [index, value] of parsed.tasks.entries()) {
            if (!value || typeof value !== 'object') {
                throw new Error('文本 AI 返回了无效配图任务');
            }

            const taskValue = value as GeneratedTaskValue;
            const prompt = nonEmptyString(taskValue.prompt);
            const description = nonEmptyString(taskValue.description);
            const anchor = parseAnchor(taskValue.anchor);
            if (!prompt || !anchor) {
                throw new Error('文本 AI 返回了无效配图任务');
            }

            const duplicateKey = JSON.stringify([prompt, anchor]);
            if (seen.has(duplicateKey)) {
                throw new Error('文本 AI 返回了重复配图任务');
            }
            seen.add(duplicateKey);

            tasks.push({
                id: `generated-${String(index + 1).padStart(2, '0')}`,
                prompt,
                ...(description ? { description } : {}),
                anchor
            });
        }

        return tasks;
    }
}
