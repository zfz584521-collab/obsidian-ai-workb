import {
    PlatformContentOverride,
    PublishContent,
    PublishingPlatform
} from './types';

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const VIDEO_EXTENSIONS = new Set(['avi', 'm4v', 'mkv', 'mov', 'mp4', 'webm']);

export interface MediaReference {
    kind: 'image' | 'video';
    path: string;
    source: 'vault' | 'remote';
}

export function stripFrontmatter(markdown: string): string {
    return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
}

export function extractTitle(
    markdown: string,
    basename: string,
    frontmatterTitle?: string
): string {
    return extractTitleOptions(markdown, basename, frontmatterTitle)[0] || basename;
}

export function extractTitleOptions(
    markdown: string,
    basename: string,
    frontmatterTitle?: string
): string[] {
    const options: string[] = [];
    const configuredTitle = frontmatterTitle?.trim();
    if (configuredTitle) options.push(configuredTitle);

    const body = stripFrontmatter(markdown);
    const planningText = textBeforeBodyMarker(body);

    const titleSection = planningText.split(/\r?\n/);
    let inTitleArea = false;
    for (const line of titleSection) {
        const trimmed = line.trim();
        if (!trimmed) {
            if (inTitleArea) continue;
            continue;
        }
        if (isTitleOptionsMarker(trimmed)) {
            inTitleArea = true;
            continue;
        }

        const labeled = trimmed.match(/^(?:#{1,6}\s*)?(?:标题|题目|选题|标题\s*\d+|标题[一二三四五六七八九十]+)\s*[:：]\s*(.+)$/);
        if (labeled) {
            options.push(cleanTitleCandidate(labeled[1]));
            inTitleArea = true;
            continue;
        }

        const listed = trimmed.match(/^(?:[-*+]\s+|\d+[.、]\s*|[一二三四五六七八九十]+[、.]\s*)(.+)$/);
        if (listed && inTitleArea) {
            options.push(cleanTitleCandidate(listed[1]));
        }
    }

    const heading = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
    if (heading) options.push(cleanTitleCandidate(heading));

    if (options.length === 0) options.push(basename);
    return dedupe(options.map(cleanTitleCandidate).filter(Boolean));
}

export function preparePublishBody(markdown: string): string {
    const body = stripFrontmatter(markdown).trim();
    const lines = body.split(/\r?\n/);
    const markerIndex = lines.findIndex(line => isBodyMarker(line.trim()));
    const contentLines = markerIndex === -1 ? lines : lines.slice(markerIndex + 1);
    return contentLines
        .filter(line => !isStructuralMarker(line.trim()))
        .join('\n')
        .trim();
}

export function findMediaReferences(markdown: string): MediaReference[] {
    const references: Array<MediaReference & { index: number }> = [];
    const wikiPattern = /!\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/g;
    const markdownPattern = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g;

    for (const match of markdown.matchAll(wikiPattern)) {
        addReference(references, match[1], match.index ?? 0);
    }

    for (const match of markdown.matchAll(markdownPattern)) {
        addReference(references, match[1] || match[2], match.index ?? 0);
    }

    return references
        .sort((left, right) => left.index - right.index)
        .map(({ index: _index, ...reference }) => reference);
}

export function applyPlatformOverride(
    content: PublishContent,
    override?: PlatformContentOverride
): PublishContent {
    const resolved: PublishContent = {
        ...content,
        images: [...content.images],
        tags: [...content.tags]
    };

    if (!override) return resolved;
    if (override.title !== undefined) resolved.title = override.title;
    if (override.bodyMarkdown !== undefined) resolved.bodyMarkdown = override.bodyMarkdown;
    if (override.summary !== undefined) resolved.summary = override.summary;
    if (override.cover !== undefined) resolved.cover = override.cover ?? undefined;
    if (override.images !== undefined) resolved.images = [...override.images];
    if (override.video !== undefined) resolved.video = override.video ?? undefined;
    if (override.tags !== undefined) resolved.tags = [...override.tags];
    return resolved;
}

export async function createIdempotencyKey(
    taskId: string,
    platform: PublishingPlatform,
    content: PublishContent
): Promise<string> {
    const serializable = {
        sourcePath: content.sourcePath,
        title: content.title,
        bodyMarkdown: content.bodyMarkdown,
        summary: content.summary,
        cover: mediaIdentity(content.cover),
        images: content.images.map(mediaIdentity),
        video: mediaIdentity(content.video),
        tags: content.tags
    };
    const input = `${taskId}\n${platform}\n${JSON.stringify(serializable)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    const hash = Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    return `${taskId}-${platform}-${hash}`;
}

function addReference(
    references: Array<MediaReference & { index: number }>,
    rawPath: string,
    index: number
): void {
    const trimmedPath = rawPath.trim();
    let path = trimmedPath;
    try {
        path = decodeURIComponent(trimmedPath);
    } catch {
        path = trimmedPath;
    }
    const extension = getExtension(path);
    const kind = IMAGE_EXTENSIONS.has(extension)
        ? 'image'
        : VIDEO_EXTENSIONS.has(extension)
            ? 'video'
            : null;
    if (!kind) return;

    references.push({
        kind,
        path,
        source: /^https?:\/\//i.test(path) ? 'remote' : 'vault',
        index
    });
}

function getExtension(path: string): string {
    const cleanPath = path.split(/[?#]/, 1)[0];
    const match = cleanPath.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || '';
}

function textBeforeBodyMarker(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    const markerIndex = lines.findIndex(line => isBodyMarker(line.trim()));
    return (markerIndex === -1 ? lines : lines.slice(0, markerIndex)).join('\n');
}

function isBodyMarker(value: string): boolean {
    return /^(?:#{1,6}\s*)?(?:【\s*(?:正文|开头)\s*】|(?:正文|开头)|-{2,}\s*正文\s*-{2,}|━+\s*正文\s*━+)\s*$/.test(value);
}

function isTitleOptionsMarker(value: string): boolean {
    const normalized = value
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[\s\-—–━─]+/, '')
        .replace(/[\s\-—–━─]+$/, '')
        .trim();
    return /^(?:标题|题目|选题|标题选项|候选标题|标题候选|标题方案)\s*[:：]?$/.test(normalized);
}

function isStructuralMarker(value: string): boolean {
    return /^【\s*(?:开头|结尾|正文)\s*】$/.test(value);
}

function cleanTitleCandidate(value: string): string {
    return value
        .replace(/^["'“”‘’《「『【\s]+/, '')
        .replace(/["'“”‘’》」』】\s]+$/, '')
        .replace(/^标题\s*[:：]\s*/, '')
        .trim();
}

function dedupe(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        if (seen.has(value)) continue;
        seen.add(value);
        result.push(value);
    }
    return result;
}

function mediaIdentity(media: PublishContent['cover']): object | undefined {
    if (!media) return undefined;
    return {
        kind: media.kind,
        source: media.source,
        path: media.path,
        name: media.name,
        mimeType: media.mimeType,
        remoteUrl: media.remoteUrl
    };
}
