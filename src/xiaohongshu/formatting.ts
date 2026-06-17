export const DEFAULT_XIAOHONGSHU_FORMATTING_RULES = `吸睛标题

开头钩子：痛点 / 场景 / 反差 / 一句话钩子

✨ 核心点 1
短句、口语化、手机端好读

📌 核心点 2
把步骤、经验、结论视觉化

✅ 核心点 3
突出收藏价值

结尾互动：
收藏 / 评论 / 关注引导

#相关标签 #小红书标签 #垂直领域标签`;

export interface XiaohongshuFormattedDraft {
    title: string;
    titleOptions: string[];
    bodyMarkdown: string;
    tags: string[];
}

export function buildXiaohongshuFormattingPrompt(customRules?: string): string {
    const rules = customRules?.trim() || DEFAULT_XIAOHONGSHU_FORMATTING_RULES;
    return `请把以下文案改写并排版成适合小红书发布的草稿。

排版规则：
${rules}

输出要求：
1. 只返回排版后的文案，不要解释你的处理过程。
2. 开头必须保留 5 个标题候选，格式为：
标题选项：
1. 标题一
2. 标题二
3. 标题三
4. 标题四
5. 标题五
3. 标题每个不超过 20 个中文字符，默认使用第 1 个作为发布标题。
4. 标题选项之后输出“正文：”，再输出排版后的正文。
5. 正文适合手机阅读，段落短、留白清楚、重点视觉化。
6. 保留原文事实，不要编造具体数据、案例或承诺。
7. 末尾保留 5-12 个相关话题标签。`;
}

export function parseXiaohongshuFormattedDraft(markdown: string): XiaohongshuFormattedDraft {
    const normalized = markdown.trim();
    const lines = normalized.split(/\r?\n/);
    const titleOptions = extractTitleOptions(lines).slice(0, 5);
    const bodyStart = findBodyStart(lines);
    let bodyLines = bodyStart >= 0
        ? lines.slice(bodyStart + 1)
        : stripTitleOptionBlock(lines);
    const fallbackTitleIndex = bodyLines.findIndex(line => line.trim());
    const fallbackTitle = fallbackTitleIndex >= 0 ? cleanTitle(bodyLines[fallbackTitleIndex]) : '';
    const title = (titleOptions[0] || fallbackTitle || '小红书草稿').slice(0, 64);
    if (bodyLines.length > 0 && cleanTitle(bodyLines[0]) === title) {
        bodyLines = bodyLines.slice(1);
    }
    const bodyMarkdown = bodyLines.join('\n').trim();
    return {
        title,
        titleOptions: titleOptions.length > 0 ? titleOptions : [title],
        bodyMarkdown,
        tags: extractHashTags(normalized)
    };
}

function extractTitleOptions(lines: string[]): string[] {
    const markerIndex = lines.findIndex(line => /^标题(?:选项|候选)?\s*[:：]?\s*$/.test(line.trim()));
    if (markerIndex === -1) return [];
    const result: string[] = [];
    for (const line of lines.slice(markerIndex + 1)) {
        const trimmed = line.trim();
        if (!trimmed) {
            if (result.length > 0) continue;
            continue;
        }
        if (/^正文\s*[:：]?\s*$/.test(trimmed)) break;
        const match = trimmed.match(/^(?:[-*+]\s+|\d+[.、]\s*)(.+)$/);
        if (!match) {
            if (result.length > 0) break;
            continue;
        }
        const title = cleanTitle(match[1]).slice(0, 64);
        if (title) result.push(title);
    }
    return result;
}

function findBodyStart(lines: string[]): number {
    return lines.findIndex(line => /^正文\s*[:：]?\s*$/.test(line.trim()));
}

function stripTitleOptionBlock(lines: string[]): string[] {
    const markerIndex = lines.findIndex(line => /^标题(?:选项|候选)?\s*[:：]?\s*$/.test(line.trim()));
    if (markerIndex === -1) return lines;
    let end = markerIndex + 1;
    while (end < lines.length) {
        const trimmed = lines[end].trim();
        if (/^正文\s*[:：]?\s*$/.test(trimmed)) return lines.slice(end + 1);
        if (trimmed && !/^(?:[-*+]\s+|\d+[.、]\s*)/.test(trimmed)) break;
        end++;
    }
    return lines.slice(end);
}

function cleanTitle(value: string): string {
    return value
        .replace(/^#{1,6}\s*/, '')
        .replace(/^【标题】\s*/, '')
        .replace(/^标题\s*[:：]\s*/, '')
        .trim();
}

function extractHashTags(value: string): string[] {
    const tags = new Set<string>();
    for (const match of value.matchAll(/#([^\s#，,。；;]+)/g)) {
        const tag = match[1].trim();
        if (tag) tags.add(tag);
    }
    return [...tags];
}
