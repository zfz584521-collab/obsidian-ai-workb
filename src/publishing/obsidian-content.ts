import { App, TFile } from 'obsidian';
import { extractTitle, findMediaReferences, stripFrontmatter } from './content';
import { PublishContent, PublishMedia } from './types';

const MIME_TYPES: Record<string, string> = {
    avif: 'image/avif',
    bmp: 'image/bmp',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    avi: 'video/x-msvideo',
    m4v: 'video/x-m4v',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    mp4: 'video/mp4',
    webm: 'video/webm'
};

export class ObsidianContentExtractor {
    constructor(private app: App) {}

    async extract(file: TFile): Promise<PublishContent> {
        const markdown = await this.app.vault.read(file);
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const media = findMediaReferences(markdown)
            .map(reference => this.resolveMedia(reference, file))
            .filter((item): item is PublishMedia => item !== null);
        const images = media.filter(item => item.kind === 'image');
        const video = media.find(item => item.kind === 'video');

        return {
            sourcePath: file.path,
            title: extractTitle(markdown, file.basename, stringValue(frontmatter?.title)),
            bodyMarkdown: stripFrontmatter(markdown).trim(),
            summary: stringValue(frontmatter?.summary) || stringValue(frontmatter?.description),
            cover: images[0],
            images,
            video,
            tags: normalizeTags(frontmatter?.tags)
        };
    }

    async loadMedia(media: PublishMedia): Promise<PublishMedia> {
        if (media.source === 'remote' || media.data) return media;

        const file = this.app.vault.getAbstractFileByPath(media.path);
        if (!(file instanceof TFile)) {
            throw new Error(`找不到媒体文件: ${media.path}`);
        }

        return {
            ...media,
            mimeType: media.mimeType || MIME_TYPES[file.extension.toLowerCase()],
            data: await this.app.vault.readBinary(file)
        };
    }

    private resolveMedia(
        reference: ReturnType<typeof findMediaReferences>[number],
        sourceFile: TFile
    ): PublishMedia | null {
        if (reference.source === 'remote') {
            return {
                kind: reference.kind,
                source: 'remote',
                path: reference.path,
                name: remoteName(reference.path),
                mimeType: MIME_TYPES[fileExtension(reference.path)],
                remoteUrl: reference.path
            };
        }

        const file = this.app.metadataCache.getFirstLinkpathDest(reference.path, sourceFile.path);
        if (!file) return null;

        return {
            kind: reference.kind,
            source: 'vault',
            path: file.path,
            name: file.name,
            mimeType: MIME_TYPES[file.extension.toLowerCase()]
        };
    }
}

function normalizeTags(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.replace(/^#/, '').trim())
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(/[,\s]+/)
            .map(item => item.replace(/^#/, '').trim())
            .filter(Boolean);
    }
    return [];
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function remoteName(value: string): string {
    try {
        const pathname = new URL(value).pathname;
        return decodeURIComponent(pathname.substring(pathname.lastIndexOf('/') + 1)) || 'remote-media';
    } catch {
        return 'remote-media';
    }
}

function fileExtension(value: string): string {
    const match = value.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || '';
}
