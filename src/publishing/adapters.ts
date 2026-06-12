import {
    ConnectionTestResult,
    PlatformAdapter,
    PlatformCapabilities,
    PlatformPublishRequest,
    PlatformPublishResult,
    PlatformSettings,
    PublishError,
    PublishingPlatform,
    ValidationIssue
} from './types';
import { validatePlatformConfiguration } from './validation';
import { FetchLike, WebhookClient } from './webhook';

const PLATFORM_NAMES: Record<PublishingPlatform, string> = {
    wechat: '微信公众号',
    xiaohongshu: '小红书',
    wechatChannels: '视频号',
    douyin: '抖音',
    x: 'X',
    youtube: 'YouTube'
};

export class PublishingAdapterFactory {
    constructor(
        private webhookClient: WebhookClient,
        private fetchFn: FetchLike = fetch
    ) {}

    create(platform: PublishingPlatform, settings: PlatformSettings): PlatformAdapter {
        if (settings.connectionType === 'webhook') {
            return new WebhookPlatformAdapter(platform, settings, this.webhookClient);
        }
        if (platform === 'wechat') return new WeChatOfficialAdapter(this.fetchFn, settings);
        if (platform === 'youtube') return new YouTubeOfficialAdapter(this.fetchFn, settings);
        return new UnavailableOfficialAdapter(platform);
    }
}

export class WebhookPlatformAdapter implements PlatformAdapter {
    constructor(
        public platform: PublishingPlatform,
        private settings: PlatformSettings,
        private client: WebhookClient
    ) {}

    getCapabilities(): PlatformCapabilities {
        return {
            targetKind: 'webhook-draft',
            supportsImages: true,
            supportsVideo: true
        };
    }

    async validate(request: PlatformPublishRequest): Promise<ValidationIssue[]> {
        return validatePlatformConfiguration(this.platform, request.settings, request.content);
    }

    testConnection(): Promise<ConnectionTestResult> {
        return this.client.testConnection(this.platform, this.settings);
    }

    createDraft(request: PlatformPublishRequest): Promise<PlatformPublishResult> {
        return this.client.createDraft(request);
    }
}

export class UnavailableOfficialAdapter implements PlatformAdapter {
    constructor(public platform: PublishingPlatform) {}

    getCapabilities(): PlatformCapabilities {
        return {
            targetKind: 'webhook-draft',
            supportsImages: false,
            supportsVideo: false
        };
    }

    async validate(): Promise<ValidationIssue[]> {
        return [{
            code: 'OFFICIAL_API_UNAVAILABLE',
            field: 'connectionType',
            message: `${PLATFORM_NAMES[this.platform]} 当前不提供本插件可用的草稿接口，请改用 Webhook`
        }];
    }

    async testConnection(): Promise<ConnectionTestResult> {
        return {
            success: false,
            message: `${PLATFORM_NAMES[this.platform]} 当前请使用 Webhook 接入`
        };
    }

    async createDraft(): Promise<PlatformPublishResult> {
        return failure(
            this.platform,
            'OFFICIAL_API_UNAVAILABLE',
            `${PLATFORM_NAMES[this.platform]} 当前请使用 Webhook 接入`,
            false
        );
    }
}

export class WeChatOfficialAdapter implements PlatformAdapter {
    readonly platform = 'wechat' as const;

    constructor(
        private fetchFn: FetchLike = fetch,
        private configuredSettings?: PlatformSettings
    ) {}

    getCapabilities(): PlatformCapabilities {
        return {
            targetKind: 'native-draft',
            supportsImages: true,
            supportsVideo: false
        };
    }

    async validate(request: PlatformPublishRequest): Promise<ValidationIssue[]> {
        const issues = validatePlatformConfiguration('wechat', request.settings, request.content);
        if (!request.content.cover) {
            issues.push({
                code: 'WECHAT_COVER_REQUIRED',
                field: 'cover',
                message: '微信公众号草稿必须选择封面'
            });
        } else if (request.content.cover.source === 'vault' && !request.content.cover.data) {
            issues.push({
                code: 'LOCAL_MEDIA_NOT_LOADED',
                field: 'cover',
                message: '微信公众号封面尚未载入'
            });
        }
        return issues;
    }

    async testConnection(): Promise<ConnectionTestResult> {
        if (!this.configuredSettings) {
            return { success: false, message: '微信公众号配置不可用' };
        }
        const token = await this.fetchAccessToken(this.configuredSettings);
        return token.error
            ? { success: false, message: token.error.message }
            : { success: true, message: '连接正常' };
    }

    async createDraft(request: PlatformPublishRequest): Promise<PlatformPublishResult> {
        try {
            const tokenResult = await this.fetchAccessToken(request.settings);
            if (tokenResult.error) return { platform: 'wechat', success: false, error: tokenResult.error };
            const accessToken = tokenResult.token!;
            const coverResult = await this.uploadPermanentImage(
                request.content.cover!,
                accessToken
            );
            if (coverResult.error) return { platform: 'wechat', success: false, error: coverResult.error };

            const imageUrls = new Map<string, string>();
            for (const image of request.content.images) {
                if (image.source === 'remote') {
                    imageUrls.set(image.path, image.remoteUrl || image.path);
                    continue;
                }
                const upload = await this.uploadInlineImage(image, accessToken);
                if (upload.error) return { platform: 'wechat', success: false, error: upload.error };
                imageUrls.set(image.path, upload.url!);
            }

            const body = {
                articles: [{
                    title: request.content.title,
                    author: request.settings.official.author || '',
                    digest: request.content.summary || '',
                    content: markdownToHtml(request.content.bodyMarkdown, imageUrls),
                    content_source_url: typeof request.settings.defaults.contentSourceUrl === 'string'
                        ? request.settings.defaults.contentSourceUrl
                        : '',
                    thumb_media_id: coverResult.mediaId,
                    need_open_comment: request.settings.defaults.openComments ? 1 : 0,
                    only_fans_can_comment: request.settings.defaults.onlyFansCanComment ? 1 : 0
                }]
            };
            const response = await this.fetchFn(
                `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(accessToken)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            );
            const data = await readJson(response);
            if (!response.ok || !data || typeof data.media_id !== 'string') {
                return failure(
                    'wechat',
                    'WECHAT_DRAFT_FAILED',
                    '微信公众号草稿创建失败',
                    response.status >= 500
                );
            }
            return {
                platform: 'wechat',
                success: true,
                targetKind: 'native-draft',
                draftId: data.media_id
            };
        } catch {
            return failure('wechat', 'WECHAT_NETWORK_ERROR', '无法连接微信公众号接口', true);
        }
    }

    private async fetchAccessToken(
        settings: PlatformSettings
    ): Promise<{ token?: string; error?: PublishError }> {
        try {
            const appId = encodeURIComponent(settings.official.appId || '');
            const appSecret = encodeURIComponent(settings.official.appSecret || '');
            const response = await this.fetchFn(
                `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
            );
            const data = await readJson(response);
            if (!response.ok || !data || typeof data.access_token !== 'string') {
                return {
                    error: {
                        code: 'WECHAT_AUTH_FAILED',
                        message: '微信公众号认证失败，请检查 AppID 和 AppSecret',
                        retryable: response.status >= 500
                    }
                };
            }
            return { token: data.access_token };
        } catch {
            return {
                error: {
                    code: 'WECHAT_NETWORK_ERROR',
                    message: '无法连接微信公众号接口',
                    retryable: true
                }
            };
        }
    }

    private async uploadPermanentImage(
        media: NonNullable<PlatformPublishRequest['content']['cover']>,
        accessToken: string
    ): Promise<{ mediaId?: string; error?: PublishError }> {
        if (!media.data) {
            return {
                error: {
                    code: 'LOCAL_MEDIA_NOT_LOADED',
                    message: `封面尚未载入: ${media.name}`,
                    retryable: false
                }
            };
        }
        const form = new FormData();
        form.append('media', new Blob([media.data], {
            type: media.mimeType || 'application/octet-stream'
        }), media.name);
        const response = await this.fetchFn(
            `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=thumb`,
            { method: 'POST', body: form }
        );
        const data = await readJson(response);
        if (!response.ok || !data || typeof data.media_id !== 'string') {
            return {
                error: {
                    code: 'WECHAT_COVER_UPLOAD_FAILED',
                    message: '微信公众号封面上传失败',
                    retryable: response.status >= 500
                }
            };
        }
        return { mediaId: data.media_id };
    }

    private async uploadInlineImage(
        media: PlatformPublishRequest['content']['images'][number],
        accessToken: string
    ): Promise<{ url?: string; error?: PublishError }> {
        if (!media.data) {
            return {
                error: {
                    code: 'LOCAL_MEDIA_NOT_LOADED',
                    message: `正文图片尚未载入: ${media.name}`,
                    retryable: false
                }
            };
        }
        const form = new FormData();
        form.append('media', new Blob([media.data], {
            type: media.mimeType || 'application/octet-stream'
        }), media.name);
        const response = await this.fetchFn(
            `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(accessToken)}`,
            { method: 'POST', body: form }
        );
        const data = await readJson(response);
        if (!response.ok || !data || typeof data.url !== 'string') {
            return {
                error: {
                    code: 'WECHAT_IMAGE_UPLOAD_FAILED',
                    message: `微信公众号正文图片上传失败: ${media.name}`,
                    retryable: response.status >= 500
                }
            };
        }
        return { url: data.url };
    }
}

export class YouTubeOfficialAdapter implements PlatformAdapter {
    readonly platform = 'youtube' as const;

    constructor(
        private fetchFn: FetchLike = fetch,
        private configuredSettings?: PlatformSettings
    ) {}

    getCapabilities(): PlatformCapabilities {
        return {
            targetKind: 'private-upload',
            supportsImages: false,
            supportsVideo: true,
            requiresVideo: true
        };
    }

    async validate(request: PlatformPublishRequest): Promise<ValidationIssue[]> {
        const issues = validatePlatformConfiguration('youtube', request.settings, request.content);
        if (!request.content.video) {
            issues.push({
                code: 'YOUTUBE_VIDEO_REQUIRED',
                field: 'video',
                message: 'YouTube 私密上传必须选择视频'
            });
        } else if (!request.content.video.data) {
            issues.push({
                code: 'LOCAL_MEDIA_NOT_LOADED',
                field: 'video',
                message: 'YouTube 视频必须先载入为本地二进制文件'
            });
        }
        return issues;
    }

    async testConnection(): Promise<ConnectionTestResult> {
        if (!this.configuredSettings) {
            return { success: false, message: 'YouTube 配置不可用' };
        }
        const token = await this.refreshAccessToken(this.configuredSettings);
        return token.error
            ? { success: false, message: token.error.message }
            : { success: true, message: '连接正常' };
    }

    async createDraft(request: PlatformPublishRequest): Promise<PlatformPublishResult> {
        const video = request.content.video;
        if (!video?.data) {
            return failure('youtube', 'LOCAL_MEDIA_NOT_LOADED', 'YouTube 视频尚未载入', false);
        }

        try {
            const tokenResult = await this.refreshAccessToken(request.settings);
            if (tokenResult.error) return { platform: 'youtube', success: false, error: tokenResult.error };
            const accessToken = tokenResult.token!;
            const metadata = {
                snippet: {
                    title: request.content.title,
                    description: request.content.summary || request.content.bodyMarkdown,
                    tags: request.content.tags
                },
                status: {
                    privacyStatus: 'private'
                }
            };
            const initResponse = await this.fetchFn(
                'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Upload-Content-Length': String(video.data.byteLength),
                        'X-Upload-Content-Type': video.mimeType || 'application/octet-stream'
                    },
                    body: JSON.stringify(metadata)
                }
            );
            const location = initResponse.headers.get('Location');
            if (!initResponse.ok || !location) {
                return failure(
                    'youtube',
                    'YOUTUBE_UPLOAD_INIT_FAILED',
                    'YouTube 上传会话创建失败',
                    initResponse.status >= 500 || initResponse.status === 429
                );
            }

            const uploadResponse = await this.fetchFn(location, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': video.mimeType || 'application/octet-stream'
                },
                body: video.data
            });
            const data = await readJson(uploadResponse);
            if (!uploadResponse.ok || !data || typeof data.id !== 'string') {
                return failure(
                    'youtube',
                    'YOUTUBE_UPLOAD_FAILED',
                    'YouTube 视频上传失败',
                    uploadResponse.status >= 500 || uploadResponse.status === 429
                );
            }
            return {
                platform: 'youtube',
                success: true,
                targetKind: 'private-upload',
                draftId: data.id,
                managementUrl: `https://studio.youtube.com/video/${encodeURIComponent(data.id)}/edit`
            };
        } catch {
            return failure('youtube', 'YOUTUBE_NETWORK_ERROR', '无法连接 YouTube 接口', true);
        }
    }

    private async refreshAccessToken(
        settings: PlatformSettings
    ): Promise<{ token?: string; error?: PublishError }> {
        try {
            const body = new URLSearchParams({
                client_id: settings.official.clientId || '',
                client_secret: settings.official.clientSecret || '',
                refresh_token: settings.official.refreshToken || '',
                grant_type: 'refresh_token'
            });
            const response = await this.fetchFn('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body
            });
            const data = await readJson(response);
            if (!response.ok || !data || typeof data.access_token !== 'string') {
                return {
                    error: {
                        code: 'YOUTUBE_AUTH_FAILED',
                        message: 'YouTube 认证失败，请重新连接账号',
                        retryable: response.status >= 500 || response.status === 429
                    }
                };
            }
            return { token: data.access_token };
        } catch {
            return {
                error: {
                    code: 'YOUTUBE_NETWORK_ERROR',
                    message: '无法连接 YouTube 接口',
                    retryable: true
                }
            };
        }
    }
}

function markdownToHtml(markdown: string, imageUrls: Map<string, string>): string {
    let value = markdown;
    for (const [path, url] of imageUrls) {
        const escapedPath = escapeRegExp(path);
        value = value
            .replace(new RegExp(`!\\[\\[${escapedPath}(?:\\|[^\\]]*)?\\]\\]`, 'g'), `<img src="${escapeHtml(url)}">`)
            .replace(new RegExp(`!\\[[^\\]]*\\]\\(<?${escapedPath}>?(?:\\s+["'][^"']*["'])?\\)`, 'g'), `<img src="${escapeHtml(url)}">`);
    }

    const lines = value.split(/\r?\n/);
    const output: string[] = [];
    let list: 'ul' | 'ol' | null = null;
    const closeList = () => {
        if (list) output.push(`</${list}>`);
        list = null;
    };

    for (const line of lines) {
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
        const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
        if (heading) {
            closeList();
            const level = heading[1].length;
            output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        } else if (unordered || ordered) {
            const nextList = unordered ? 'ul' : 'ol';
            if (list !== nextList) {
                closeList();
                list = nextList;
                output.push(`<${list}>`);
            }
            output.push(`<li>${inlineMarkdown((unordered || ordered)![1])}</li>`);
        } else if (!line.trim()) {
            closeList();
        } else if (/^<img\s/.test(line.trim())) {
            closeList();
            output.push(line.trim());
        } else {
            closeList();
            output.push(`<p>${inlineMarkdown(line)}</p>`);
        }
    }
    closeList();
    return output.join('');
}

function inlineMarkdown(value: string): string {
    return escapeHtml(value)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readJson(response: Response): Promise<any | null> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function failure(
    platform: PublishingPlatform,
    code: string,
    message: string,
    retryable: boolean
): PlatformPublishResult {
    return {
        platform,
        success: false,
        error: { code, message, retryable }
    };
}
