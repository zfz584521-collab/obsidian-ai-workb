import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/image-provider.ts', import.meta.url)
);
const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

function settings(overrides = {}) {
    return {
        provider: 'openai-compatible',
        endpoint: 'https://api.example.com/v1/',
        apiKey: 'sk-private',
        model: 'image-model',
        size: '1536x1024',
        timeout: 1,
        retryCount: 2,
        concurrency: 2,
        maxImages: 10,
        previewTasks: false,
        keepOriginalPrompts: false,
        ...overrides
    };
}

function jsonResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    };
}

test('requests base64 output and normalizes PNG bytes', async () => {
    const { OpenAICompatibleImageProvider } = await importTypeScript(entry);
    let captured;
    const provider = new OpenAICompatibleImageProvider(settings(), async (url, init) => {
        captured = { url, init };
        return jsonResponse({
            data: [{ b64_json: Buffer.from(pngBytes).toString('base64') }]
        });
    });

    const image = await provider.generate({ prompt: 'test prompt', size: '1536x1024' });
    const body = JSON.parse(captured.init.body);

    assert.equal(captured.url, 'https://api.example.com/v1/images/generations');
    assert.equal(body.model, 'image-model');
    assert.equal(body.prompt, 'test prompt');
    assert.equal(body.size, '1536x1024');
    assert.equal(body.response_format, 'b64_json');
    assert.equal(image.mimeType, 'image/png');
    assert.deepEqual([...image.bytes], [...pngBytes]);
});

test('downloads secure URL images and accepts localhost HTTP only', async () => {
    const { OpenAICompatibleImageProvider } = await importTypeScript(entry);
    const fetchFn = async (url) => {
        if (String(url).endsWith('/images/generations')) {
            return jsonResponse({ data: [{ url: 'https://cdn.example.com/image.png' }] });
        }
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => pngBytes.buffer
        };
    };
    const image = await new OpenAICompatibleImageProvider(settings(), fetchFn)
        .generate({ prompt: 'test', size: '1536x1024' });
    assert.equal(image.extension, 'png');

    const insecure = async (url) => {
        if (String(url).endsWith('/images/generations')) {
            return jsonResponse({ data: [{ url: 'http://evil.example/image.png' }] });
        }
        throw new Error('should not download');
    };
    await assert.rejects(
        () => new OpenAICompatibleImageProvider(settings(), insecure)
            .generate({ prompt: 'test', size: '1536x1024' }),
        /HTTPS/
    );
});

test('rejects invalid images and classifies HTTP failures safely', async () => {
    const { ImageProviderError, OpenAICompatibleImageProvider } =
        await importTypeScript(entry);

    const invalid = new OpenAICompatibleImageProvider(settings(), async () =>
        jsonResponse({ data: [{ b64_json: Buffer.from('not-image').toString('base64') }] })
    );
    await assert.rejects(() => invalid.generate({ prompt: 'x', size: 'x' }), /图片格式/);

    const malformed = new OpenAICompatibleImageProvider(settings(), async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw new SyntaxError('bad json');
        }
    }));
    await assert.rejects(
        () => malformed.generate({ prompt: 'x', size: 'x' }),
        error => error instanceof ImageProviderError && !error.retryable
    );

    for (const [status, retryable] of [[401, false], [429, true], [503, true]]) {
        const provider = new OpenAICompatibleImageProvider(settings(), async () =>
            jsonResponse({ error: { message: `secret ${settings().apiKey}` } }, status)
        );
        await assert.rejects(
            () => provider.generate({ prompt: 'x', size: 'x' }),
            error => {
                assert.ok(error instanceof ImageProviderError);
                assert.equal(error.retryable, retryable);
                assert.doesNotMatch(error.message, /sk-private/);
                return true;
            }
        );
    }
});

test('aborts timed out requests as retryable failures', async () => {
    const { ImageProviderError, OpenAICompatibleImageProvider } =
        await importTypeScript(entry);
    const fetchFn = async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
        });
    });
    const provider = new OpenAICompatibleImageProvider(
        settings({ timeout: 0.01 }),
        fetchFn
    );

    await assert.rejects(
        () => provider.generate({ prompt: 'x', size: 'x' }),
        error => error instanceof ImageProviderError && error.retryable
    );
});
