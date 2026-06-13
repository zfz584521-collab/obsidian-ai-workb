import {
    ConnectionTestResult,
    PlatformPublishRequest,
    PlatformPublishResult,
    PlatformSettings,
    PublishMedia,
    PublishingPlatform,
    WebhookSettings
} from './types';

export type FetchLike = (
    input: RequestInfo | URL,
    init?: RequestInit
) => Promise<Response>;

interface UploadedMedia {
    mediaRef?: string;
    remoteUrl?: string;
    name: string;
    kind: 'image' | 'video';
}

export async function buildSignedHeaders(
    settings: Pick<WebhookSettings, 'authType' | 'token' | 'headers' | 'signingSecret'>,
    rawBody: string,
    idempotencyKey: string,
    timestamp: number
): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (settings.authType === 'bearer' && settings.token) {
        headers.Authorization = `Bearer ${settings.token}`;
    } else if (settings.authType === 'headers') {
        Object.assign(headers, settings.headers);
    }

    headers['Idempotency-Key'] = idempotencyKey;
    if (settings.signingSecret) {
        headers['X-AI-Workbench-Timestamp'] = String(timestamp);
        headers['X-AI-Workbench-Signature'] = await createSignature(
            settings.signingSecret,
            `${timestamp}.${rawBody}`
        );
    }
    return headers;
}

export class WebhookClient {
    constructor(
        private fetchFn: FetchLike = fetch,
        private now: () => number = () => Math.floor(Date.now() / 1000)
    ) {}

    async testConnection(
        platform: PublishingPlatform,
        settings: PlatformSettings
    ): Promise<ConnectionTestResult> {
        const rawBody = JSON.stringify({
            version: '1',
            type: 'connection-test',
            platform
        });

        try {
            const headers = await buildSignedHeaders(
                settings.webhook,
                rawBody,
                `connection-test-${platform}`,
                this.now()
            );
            const response = await this.fetchFn(settings.webhook.url, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: rawBody
            });
            if (!response.ok) {
                return {
                    success: false,
                    message: `连接测试失败（HTTP ${response.status}）`
                };
            }

            const body = await readJson(response);
            return body?.success === false
                ? { success: false, message: '中转服务拒绝了连接测试' }
                : { success: true, message: '连接正常' };
        } catch {
            return { success: false, message: '无法连接到中转服务' };
        }
    }

    async createDraft(request: PlatformPublishRequest): Promise<PlatformPublishResult> {
        try {
            const mediaCache = new Map<string, UploadedMedia>();
            const cover = await this.prepareMedia(request.content.cover, request, mediaCache);
            const images: UploadedMedia[] = [];
            for (const image of request.content.images) {
                const uploaded = await this.prepareMedia(image, request, mediaCache);
                if (uploaded) images.push(uploaded);
            }
            const video = await this.prepareMedia(request.content.video, request, mediaCache);
            const rawBody = JSON.stringify({
                version: '1',
                taskId: request.taskId,
                idempotencyKey: request.idempotencyKey,
                platform: request.platform,
                target: 'draft',
                content: {
                    title: request.content.title,
                    bodyMarkdown: request.content.bodyMarkdown,
                    summary: request.content.summary,
                    tags: request.content.tags
                },
                media: { cover, images, video },
                metadata: {
                    sourcePath: request.content.sourcePath
                }
            });
            const headers = await buildSignedHeaders(
                request.settings.webhook,
                rawBody,
                request.idempotencyKey,
                this.now()
            );
            const response = await this.fetchFn(request.settings.webhook.url, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: rawBody
            });

            if (!response.ok) {
                return failure(
                    request.platform,
                    'WEBHOOK_HTTP_ERROR',
                    `中转服务请求失败（HTTP ${response.status}）`,
                    isRetryableStatus(response.status)
                );
            }

            const body = await readJson(response);
            if (!body || body.success !== true || typeof body.draftId !== 'string') {
                return failure(
                    request.platform,
                    'WEBHOOK_INVALID_RESPONSE',
                    '中转服务返回了无效响应',
                    false
                );
            }

            return {
                platform: request.platform,
                success: true,
                draftId: body.draftId,
                managementUrl: typeof body.managementUrl === 'string'
                    ? body.managementUrl
                    : undefined,
                targetKind: 'webhook-draft'
            };
        } catch (error) {
            if (error instanceof WebhookClientError) {
                return failure(
                    request.platform,
                    error.code,
                    error.message,
                    error.retryable
                );
            }
            return failure(
                request.platform,
                'WEBHOOK_NETWORK_ERROR',
                '无法连接到中转服务',
                true
            );
        }
    }

    private async prepareMedia(
        media: PublishMedia | undefined,
        request: PlatformPublishRequest,
        cache: Map<string, UploadedMedia>
    ): Promise<UploadedMedia | null> {
        if (!media) return null;
        if (media.source === 'remote') {
            return {
                remoteUrl: media.remoteUrl || media.path,
                name: media.name,
                kind: media.kind
            };
        }

        const cached = cache.get(media.path);
        if (cached) return cached;
        if (!media.data) {
            throw new WebhookClientError(
                'LOCAL_MEDIA_NOT_LOADED',
                `本地媒体尚未载入: ${media.name}`,
                false
            );
        }

        const uploaded = await this.uploadMedia(media, request);
        cache.set(media.path, uploaded);
        return uploaded;
    }

    private async uploadMedia(
        media: PublishMedia,
        request: PlatformPublishRequest
    ): Promise<UploadedMedia> {
        const form = new FormData();
        const metadata = JSON.stringify({
            taskId: request.taskId,
            platform: request.platform,
            idempotencyKey: request.idempotencyKey,
            name: media.name,
            kind: media.kind
        });
        form.append('file', new Blob([media.data!], {
            type: media.mimeType || 'application/octet-stream'
        }), media.name);
        form.append('taskId', request.taskId);
        form.append('platform', request.platform);
        form.append('idempotencyKey', request.idempotencyKey);

        const headers = await buildSignedHeaders(
            request.settings.webhook,
            metadata,
            request.idempotencyKey,
            this.now()
        );
        const response = await this.fetchFn(request.settings.webhook.mediaUploadUrl, {
            method: 'POST',
            headers,
            body: form
        });

        if (!response.ok) {
            throw new WebhookClientError(
                'MEDIA_UPLOAD_FAILED',
                `媒体上传失败（HTTP ${response.status}）`,
                isRetryableStatus(response.status)
            );
        }

        const body = await readJson(response);
        if (!body || body.success !== true || typeof body.mediaRef !== 'string') {
            throw new WebhookClientError(
                'MEDIA_UPLOAD_INVALID_RESPONSE',
                '媒体上传服务返回了无效响应',
                false
            );
        }
        return {
            mediaRef: body.mediaRef,
            name: media.name,
            kind: media.kind
        };
    }
}

class WebhookClientError extends Error {
    constructor(
        public code: string,
        message: string,
        public retryable: boolean
    ) {
        super(message);
    }
}

async function createSignature(secret: string, value: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(value)
    );
    return Array.from(new Uint8Array(signature))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function readJson(response: Response): Promise<any | null> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
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
