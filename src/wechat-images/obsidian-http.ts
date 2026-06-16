interface ObsidianRequest {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer;
    throw?: boolean;
}

interface ObsidianResponse {
    status: number;
    headers: Record<string, string>;
    arrayBuffer: ArrayBuffer;
    json: unknown;
}

type ObsidianRequestUrl = (
    request: ObsidianRequest
) => Promise<ObsidianResponse>;

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    const normalized: Record<string, string> = {};
    new Headers(headers).forEach((value, key) => {
        normalized[key] = value;
    });
    return normalized;
}

export function createObsidianImageFetch(
    requestUrl: ObsidianRequestUrl
): typeof fetch {
    return (async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.toString()
                : input.url;
        const body = init?.body;
        if (body !== undefined &&
            typeof body !== 'string' &&
            !(body instanceof ArrayBuffer)) {
            throw new Error('图片请求正文格式不受支持');
        }

        const responsePromise = requestUrl({
            url,
            method: init?.method,
            headers: normalizeHeaders(init?.headers),
            body,
            throw: false
        });
        const response = init?.signal
            ? await Promise.race([
                responsePromise,
                new Promise<never>((_resolve, reject) => {
                    if (init.signal?.aborted) {
                        const error = new Error('aborted');
                        error.name = 'AbortError';
                        reject(error);
                        return;
                    }
                    init.signal?.addEventListener('abort', () => {
                        const error = new Error('aborted');
                        error.name = 'AbortError';
                        reject(error);
                    }, { once: true });
                })
            ])
            : await responsePromise;
        const headers = new Headers(response.headers);

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            headers,
            json: async () => response.json,
            arrayBuffer: async () => response.arrayBuffer
        } as Response;
    }) as typeof fetch;
}
