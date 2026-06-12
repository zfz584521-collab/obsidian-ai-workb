import { ArticleAnchor, TaskGenerationResult } from './types';

export interface RenderOptions {
    keepOriginalPrompts: boolean;
}

interface Edit {
    start: number;
    end: number;
    content: string;
    order: number;
}

function escapeMarkdown(value: string): string {
    return value.replace(/[\\*_`[\]]/g, '\\$&').replace(/\r?\n/g, ' ').trim();
}

function safeError(value: string | undefined): string {
    const firstLine = (value || '未知错误').split(/\r?\n/, 1)[0];
    return firstLine
        .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[REDACTED]')
        .slice(0, 160);
}

function imageBlock(result: TaskGenerationResult): string {
    const embed = `![[${result.assetPath}]]`;
    return result.task.description
        ? `${embed}\n\n*${escapeMarkdown(result.task.description)}*`
        : embed;
}

function failureBlock(result: TaskGenerationResult, includePrompt: boolean): string {
    const lines = [
        '> [!warning] 配图生成失败',
        `> 本位置的图片未生成成功：${safeError(result.error)}`
    ];
    if (includePrompt) {
        lines.push(`> 提示词：${escapeMarkdown(result.task.prompt)}`);
    }
    return lines.join('\n');
}

function findHeading(source: string, heading: string): { start: number; end: number } | undefined {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s{0,3}#{1,6}\\s+${escaped}\\s*$`, 'gm');
    const match = pattern.exec(source);
    if (!match) return undefined;
    return { start: match.index, end: match.index + match[0].length };
}

function findAnchorPosition(source: string, anchor: ArticleAnchor): number | undefined {
    let rangeStart = 0;
    let rangeEnd = source.length;
    let headingMatch: { start: number; end: number } | undefined;

    if (anchor.heading) {
        headingMatch = findHeading(source, anchor.heading);
        if (!headingMatch) return undefined;
        rangeStart = headingMatch.end;
        const nextHeading = /^(\s{0,3}#{1,6})(?:\s+|$)/gm;
        nextHeading.lastIndex = rangeStart;
        const next = nextHeading.exec(source);
        rangeEnd = next ? next.index : source.length;
    }

    if (anchor.nearbyText) {
        const excerptIndex = source.indexOf(anchor.nearbyText, rangeStart);
        if (excerptIndex === -1 || excerptIndex >= rangeEnd) return undefined;
        return anchor.placement === 'before'
            ? excerptIndex
            : excerptIndex + anchor.nearbyText.length;
    }

    if (!headingMatch) return undefined;
    return anchor.placement === 'before' ? headingMatch.start : headingMatch.end;
}

function withSpacing(content: string): string {
    return `\n\n${content}\n\n`;
}

export function renderIllustratedArticle(
    source: string,
    results: TaskGenerationResult[],
    options: RenderOptions
): string {
    const edits: Edit[] = [];
    const fallback: string[] = [];

    results.forEach((result, order) => {
        const success = !!result.assetPath;
        const rendered = success
            ? imageBlock(result)
            : failureBlock(result, !result.task.sourceBlock);
        const sourceBlock = result.task.sourceBlock;

        if (sourceBlock) {
            if (sourceBlock.startOffset < 0 ||
                sourceBlock.endOffset < sourceBlock.startOffset ||
                sourceBlock.endOffset > source.length) {
                fallback.push(rendered);
                return;
            }

            if (success && !options.keepOriginalPrompts) {
                edits.push({
                    start: sourceBlock.startOffset,
                    end: sourceBlock.endOffset,
                    content: rendered,
                    order
                });
            } else {
                edits.push({
                    start: sourceBlock.endOffset,
                    end: sourceBlock.endOffset,
                    content: withSpacing(rendered),
                    order
                });
            }
            return;
        }

        const position = findAnchorPosition(source, result.task.anchor);
        if (position === undefined) {
            fallback.push(rendered);
            return;
        }
        edits.push({
            start: position,
            end: position,
            content: withSpacing(rendered),
            order
        });
    });

    edits.sort((left, right) =>
        right.start - left.start || right.order - left.order
    );

    let output = source;
    for (const edit of edits) {
        output = output.slice(0, edit.start) + edit.content + output.slice(edit.end);
    }

    if (fallback.length > 0) {
        output = `${output.trimEnd()}\n\n## 配图\n\n${fallback.join('\n\n')}\n`;
    }
    return output;
}
