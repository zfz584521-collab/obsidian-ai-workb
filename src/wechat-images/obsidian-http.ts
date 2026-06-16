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

async function normalizeBody(
    body: BodyInit | null | undefined,
    headers: Record<string, string>
): Promise<string | ArrayBuffer | undefined> {
    if (body === undefined || body === null) return undefined;
    if (typeof body === 'string' || body instanceof ArrayBuffer) return body;
    if (body instanceof FormData) {
        const { contentType, buffer } = await encodeMultipartBody(body);
        headers['content-type'] = contentType;
        return buffer;
    }
    if (body instanceof Blob) return body.arrayBuffer();
    throw new Error('Unsupported request body format');
}

async function encodeMultipartBody(form: FormData): Promise<{
    contentType: string;
    buffer: ArrayBuffer;
}> {
    const boundary = `----ai-workbench-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();
    const pushText = (value: string) => chunks.push(encoder.encode(value));

    for (const [name, value] of form.entries()) {
        pushText(`--${boundary}\r\n`);
        if (value instanceof Blob) {
            const filename = value instanceof File ? value.name : 'blob';
            pushText(
                `Content-Disposition: form-data; name="${escapeMultipartValue(name)}"; filename="${escapeMultipartValue(filename)}"\r\n` +
                `Content-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`
            );
            chunks.push(new Uint8Array(await value.arrayBuffer()));
            pushText('\r\n');
        } else {
            pushText(
                `Content-Disposition: form-data; name="${escapeMultipartValue(name)}"\r\n\r\n` +
                `${value}\r\n`
            );
        }
    }
    pushText(`--${boundary}--\r\n`);

    const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return {
        contentType: `multipart/form-data; boundary=${boundary}`,
        buffer: bytes.buffer
    };
}

function escapeMultipartValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r|\n/g, ' ');
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
        const requestHeaders = normalizeHeaders(init?.headers);
        const body = await normalizeBody(init?.body, requestHeaders);

        const responsePromise = requestUrl({
            url,
            method: init?.method,
            headers: requestHeaders,
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
