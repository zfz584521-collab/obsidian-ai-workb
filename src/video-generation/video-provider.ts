import {
    GeneratedVideo,
    VideoGenerationRequest,
    VideoGenerationSettings,
    VideoProvider
} from './types';

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime'
]);

export class VideoProviderError extends Error {
    constructor(
        message: string,
        public readonly retryable: boolean,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'VideoProviderError';
    }
}

function validateUrl(value: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new VideoProviderError('视频 API 地址格式无效', false);
    }

    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
        throw new VideoProviderError('视频地址必须使用 HTTPS，本地服务除外', false);
    }
    return url;
}

function decodeBase64(value: string): Uint8Array {
    try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    } catch {
        throw new VideoProviderError('视频数据不是有效的 base64', false);
    }
}

function detectVideo(bytes: Uint8Array): GeneratedVideo | undefined {
    if (bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
        return { bytes, extension: 'mp4', mimeType: 'video/mp4' };
    }
    if (bytes.length >= 4 &&
        bytes[0] === 0x1a && bytes[1] === 0x45 &&
        bytes[2] === 0xdf && bytes[3] === 0xa3) {
        return { bytes, extension: 'webm', mimeType: 'video/webm' };
    }
    return undefined;
}

function extensionFromMime(mimeType: string): GeneratedVideo['extension'] {
    if (mimeType === 'video/webm') return 'webm';
    if (mimeType === 'video/quicktime') return 'mov';
    return 'mp4';
}

function normalizeVideo(bytes: Uint8Array, declaredMime?: string): GeneratedVideo {
    if (bytes.length === 0 || bytes.length > MAX_VIDEO_BYTES) {
        throw new VideoProviderError('视频数据大小无效', false);
    }
    if (declaredMime && !ALLOWED_MIME_TYPES.has(declaredMime)) {
        throw new VideoProviderError('视频 MIME 类型不受支持', false);
    }

    const detected = detectVideo(bytes);
    if (detected) return detected;
    if (declaredMime && ALLOWED_MIME_TYPES.has(declaredMime)) {
        return {
            bytes,
            extension: extensionFromMime(declaredMime),
            mimeType: declaredMime as GeneratedVideo['mimeType']
        };
    }
    throw new VideoProviderError('视频格式校验失败', false);
}

function requestError(status: number): VideoProviderError {
    const retryable = status === 429 || status >= 500;
    const messages: Record<number, string> = {
        400: '视频生成请求参数无效',
        401: '视频 API Key 无效或已过期',
        403: '没有权限调用视频 API',
        404: '视频 API 地址不存在',
        429: '视频生成请求过于频繁'
    };
    return new VideoProviderError(
        messages[status] || (retryable ? '视频服务暂时不可用' : `视频请求失败: ${status}`),
        retryable,
        status
    );
}

function extractResult(data: any): { b64?: string; url?: string; taskId?: string; status?: string } {
    const item = Array.isArray(data?.data) ? data.data[0] : undefined;
    return {
        b64: item?.b64_json || item?.base64 || data?.b64_json || data?.base64,
        url: item?.url || item?.video_url || data?.url || data?.video_url,
        taskId: data?.id || data?.task_id || data?.taskId,
        status: data?.status
    };
}

function resolveGenerationUrl(endpoint: URL): string {
    const url = endpoint.toString().replace(/\/$/, '');
    if (/\/(?:videos\/generations|contents\/generations\/tasks)$/i.test(endpoint.pathname)) {
        return url;
    }
    return `${url}/videos/generations`;
}

function retryDelay(attempt: number): number {
    return 1000 * Math.pow(2, attempt);
}

export class OpenAICompatibleVideoProvider implements VideoProvider {
    constructor(
        private settings: VideoGenerationSettings,
        private fetchFn: typeof fetch = fetch,
        private sleep: (ms: number) => Promise<void> =
            ms => new Promise(resolve => setTimeout(resolve, ms))
    ) {}

    async generate(request: VideoGenerationRequest): Promise<GeneratedVideo> {
        const endpoint = validateUrl(this.settings.endpoint);
        const generationUrl = resolveGenerationUrl(endpoint);
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            this.settings.timeout * 1000
        );

        try {
            const data = await this.createGenerationTask(generationUrl, request, controller.signal);
            return await this.resolveResult(generationUrl, data, controller.signal);
        } catch (error) {
            if (error instanceof VideoProviderError) throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new VideoProviderError('视频生成请求超时', true);
            }
            throw new VideoProviderError('视频服务网络请求失败', true);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async createGenerationTask(
        generationUrl: string,
        request: VideoGenerationRequest,
        signal: AbortSignal
    ): Promise<any> {
        const maxRetries = Math.max(0, this.settings.retryCount);
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.fetchFn(generationUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.settings.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.settings.model,
                        prompt: request.prompt,
                        size: request.size,
                        duration: request.duration,
                        response_format: 'b64_json'
                    }),
                    signal
                });

                if (!response.ok) throw requestError(response.status);
                return await this.readJson(response);
            } catch (error) {
                if (!(error instanceof VideoProviderError)) throw error;
                if (!error.retryable || attempt >= maxRetries) throw error;
                await this.sleep(retryDelay(attempt));
            }
        }
    }

    private async resolveResult(
        generationUrl: string,
        data: any,
        signal: AbortSignal
    ): Promise<GeneratedVideo> {
        let result = extractResult(data);
        if (typeof result.b64 === 'string') return normalizeVideo(decodeBase64(result.b64));
        if (typeof result.url === 'string') return await this.downloadVideo(result.url, signal);

        if (!result.taskId) {
            throw new VideoProviderError('视频 API 返回格式无效', false);
        }
        const taskId = result.taskId;

        for (let attempt = 0; attempt < this.settings.maxPollAttempts; attempt++) {
            if (attempt > 0) await this.sleep(this.settings.pollInterval * 1000);
            const response = await this.fetchFn(
                `${generationUrl}/${encodeURIComponent(taskId)}`,
                {
                    headers: { 'Authorization': `Bearer ${this.settings.apiKey}` },
                    signal
                }
            );
            if (!response.ok) throw requestError(response.status);
            const task = await this.readJson(response);
            result = extractResult(task);
            if (typeof result.b64 === 'string') return normalizeVideo(decodeBase64(result.b64));
            if (typeof result.url === 'string') return await this.downloadVideo(result.url, signal);
            if (['failed', 'error', 'cancelled'].includes(String(result.status || '').toLowerCase())) {
                throw new VideoProviderError('视频生成任务失败', false);
            }
        }

        throw new VideoProviderError('视频生成任务等待超时', true);
    }

    private async readJson(response: Response): Promise<any> {
        try {
            return await response.json();
        } catch {
            throw new VideoProviderError('视频 API 返回的 JSON 无效', false);
        }
    }

    private async downloadVideo(urlValue: string, signal: AbortSignal): Promise<GeneratedVideo> {
        const url = validateUrl(urlValue);
        const response = await this.fetchFn(url.toString(), { signal });
        if (!response.ok) throw requestError(response.status);

        const mimeType = response.headers.get('content-type')?.split(';', 1)[0].trim();
        const buffer = await response.arrayBuffer();
        return normalizeVideo(new Uint8Array(buffer), mimeType);
    }
}
