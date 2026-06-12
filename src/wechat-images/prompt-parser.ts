import { ArticleImageTask } from './types';

interface SourceLine {
    text: string;
    startOffset: number;
    endOffset: number;
}

const EMOJI_PREFIX = String.raw`(?:\p{Extended_Pictographic}\uFE0F?\s*)?`;
const EMPHASIS = String.raw`(?:[*_]{1,3}\s*)?`;
const PROMPT_LINE = new RegExp(
    String.raw`^\s*${EMOJI_PREFIX}${EMPHASIS}(AI(?:绘图|生图)?提示词)\s*${EMPHASIS}[:：]\s*(.*?)\s*$`,
    'u'
);
const DESCRIPTION_LINE = new RegExp(
    String.raw`^\s*${EMOJI_PREFIX}${EMPHASIS}图片描述\s*${EMPHASIS}[:：]\s*(.*?)\s*$`,
    'u'
);
const PLACEMENT_LINE = new RegExp(
    String.raw`^\s*${EMOJI_PREFIX}${EMPHASIS}(?:放置位置|配图位置|位置)\s*${EMPHASIS}[:：].*$`,
    'u'
);
const IMAGE_BLOCK_LINE = /^\s*(?:[*_]{1,3}\s*)?【\s*配图[^】]*】\s*(?:[*_]{1,3})?\s*$/u;
const HEADING_LINE = /^\s{0,3}#{1,6}(?:\s+|$)/;

function splitSourceLines(source: string): SourceLine[] {
    const lines: SourceLine[] = [];
    const linePattern = /([^\r\n]*)(?:\r\n|\n|\r|$)/g;
    let match: RegExpExecArray | null;

    while ((match = linePattern.exec(source)) !== null) {
        if (match[0].length === 0) {
            break;
        }

        lines.push({
            text: match[1],
            startOffset: match.index,
            endOffset: match.index + match[1].length
        });
    }

    return lines;
}

function extractValue(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.replace(/[*_\s]/g, '') ? trimmed : undefined;
}

function findBlockStart(lines: SourceLine[], promptIndex: number): number {
    let startIndex = promptIndex;

    for (let index = promptIndex - 1; index >= 0; index--) {
        const text = lines[index].text;
        if (!text.trim() || HEADING_LINE.test(text)) {
            break;
        }
        if (IMAGE_BLOCK_LINE.test(text)) {
            return index;
        }
        if (DESCRIPTION_LINE.test(text) || PLACEMENT_LINE.test(text)) {
            startIndex = index;
            continue;
        }
        break;
    }

    return startIndex;
}

function findBlockEnd(lines: SourceLine[], promptIndex: number): number {
    let endIndex = promptIndex;

    for (let index = promptIndex + 1; index < lines.length; index++) {
        const text = lines[index].text;
        if (!text.trim() || HEADING_LINE.test(text)) {
            break;
        }
        if (!DESCRIPTION_LINE.test(text) && !PLACEMENT_LINE.test(text)) {
            break;
        }
        endIndex = index;
    }

    return endIndex;
}

function findDescription(
    lines: SourceLine[],
    startIndex: number,
    endIndex: number
): string | undefined {
    for (let index = startIndex; index <= endIndex; index++) {
        const match = DESCRIPTION_LINE.exec(lines[index].text);
        if (match) {
            return extractValue(match[1]);
        }
    }

    return undefined;
}

export function parseExistingImageTasks(source: string): ArticleImageTask[] {
    const lines = splitSourceLines(source);
    const tasks: ArticleImageTask[] = [];

    for (let index = 0; index < lines.length; index++) {
        const match = PROMPT_LINE.exec(lines[index].text);
        const prompt = match ? extractValue(match[2]) : undefined;
        if (!prompt) {
            continue;
        }

        const startIndex = findBlockStart(lines, index);
        const endIndex = findBlockEnd(lines, index);
        tasks.push({
            id: `existing-${String(tasks.length + 1).padStart(2, '0')}`,
            prompt,
            description: findDescription(lines, startIndex, endIndex),
            sourceBlock: {
                startOffset: lines[startIndex].startOffset,
                endOffset: lines[endIndex].endOffset
            },
            anchor: { placement: 'after' }
        });
    }

    return tasks;
}
