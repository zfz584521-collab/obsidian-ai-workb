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
    const configuredTitle = frontmatterTitle?.trim();
    if (configuredTitle) return configuredTitle;

    const heading = stripFrontmatter(markdown).match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
    return heading || basename;
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
