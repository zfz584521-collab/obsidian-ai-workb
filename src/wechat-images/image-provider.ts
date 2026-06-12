import {
    GeneratedImage,
    ImageGenerationRequest,
    ImageGenerationSettings,
    ImageProvider
} from './types';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class ImageProviderError extends Error {
    constructor(
        message: string,
        public readonly retryable: boolean,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'ImageProviderError';
    }
}

function validateUrl(value: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new ImageProviderError('图片 API 地址格式无效', false);
    }

    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
        throw new ImageProviderError('图片地址必须使用 HTTPS，本地服务除外', false);
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
        throw new ImageProviderError('图片数据不是有效的 base64', false);
    }
}

function detectImage(bytes: Uint8Array): GeneratedImage | undefined {
    if (bytes.length >= 4 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 &&
        bytes[2] === 0x4e && bytes[3] === 0x47) {
        return { bytes, extension: 'png', mimeType: 'image/png' };
    }
    if (bytes.length >= 3 &&
        bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return { bytes, extension: 'jpg', mimeType: 'image/jpeg' };
    }
    if (bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
        return { bytes, extension: 'webp', mimeType: 'image/webp' };
    }
    return undefined;
}

function normalizeImage(bytes: Uint8Array, declaredMime?: string): GeneratedImage {
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
        throw new ImageProviderError('图片数据大小无效', false);
    }
    if (declaredMime && !ALLOWED_MIME_TYPES.has(declaredMime)) {
        throw new ImageProviderError('图片 MIME 类型不受支持', false);
    }

    const image = detectImage(bytes);
    if (!image || (declaredMime && image.mimeType !== declaredMime)) {
        throw new ImageProviderError('图片格式校验失败', false);
    }
    return image;
}

function requestError(status: number): ImageProviderError {
    const retryable = status === 429 || status >= 500;
    const messages: Record<number, string> = {
        400: '图片生成请求参数无效',
        401: '图片 API Key 无效或已过期',
        403: '没有权限调用图片 API',
        404: '图片 API 地址不存在',
        429: '图片生成请求过于频繁'
    };
    return new ImageProviderError(
        messages[status] || (retryable ? '图片服务暂时不可用' : `图片请求失败: ${status}`),
        retryable,
        status
    );
}

export class OpenAICompatibleImageProvider implements ImageProvider {
    constructor(
        private settings: ImageGenerationSettings,
        private fetchFn: typeof fetch = fetch
    ) {}

    async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
        const endpoint = validateUrl(this.settings.endpoint);
        const url = `${endpoint.toString().replace(/\/$/, '')}/images/generations`;
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            this.settings.timeout * 1000
        );

        try {
            const response = await this.fetchFn(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: this.settings.model,
                    prompt: request.prompt,
                    size: request.size,
                    response_format: 'b64_json'
                }),
                signal: controller.signal
            });

            if (!response.ok) throw requestError(response.status);
            let data: any;
            try {
                data = await response.json();
            } catch {
                throw new ImageProviderError('图片 API 返回的 JSON 无效', false);
            }
            const item = data?.data?.[0];
            if (typeof item?.b64_json === 'string') {
                return normalizeImage(decodeBase64(item.b64_json));
            }
            if (typeof item?.url === 'string') {
                return await this.downloadImage(item.url, controller.signal);
            }
            throw new ImageProviderError('图片 API 返回格式无效', false);
        } catch (error) {
            if (error instanceof ImageProviderError) throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new ImageProviderError('图片生成请求超时', true);
            }
            throw new ImageProviderError('图片服务网络请求失败', true);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async downloadImage(urlValue: string, signal: AbortSignal): Promise<GeneratedImage> {
        const url = validateUrl(urlValue);
        const response = await this.fetchFn(url.toString(), { signal });
        if (!response.ok) throw requestError(response.status);

        const mimeType = response.headers.get('content-type')?.split(';', 1)[0].trim();
        if (!mimeType) {
            throw new ImageProviderError('图片响应缺少 MIME 类型', false);
        }
        const buffer = await response.arrayBuffer();
        return normalizeImage(new Uint8Array(buffer), mimeType);
    }
}
