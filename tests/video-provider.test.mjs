import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/video-generation/video-provider.ts', import.meta.url)
);
const mp4Bytes = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d
]);

function settings(overrides = {}) {
    return {
        provider: 'openai-compatible',
        endpoint: 'https://api.example.com/v1/',
        apiKey: 'sk-private',
        model: 'video-model',
        size: '1080x1920',
        duration: 5,
        timeout: 1,
        retryCount: 1,
        pollInterval: 1,
        maxPollAttempts: 2,
        ...overrides
    };
}

function jsonResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body)
    };
}

test('requests OpenAI-compatible video generation and normalizes base64 MP4 bytes', async () => {
    const { OpenAICompatibleVideoProvider } = await importTypeScript(entry);
    let captured;
    const provider = new OpenAICompatibleVideoProvider(settings(), async (url, init) => {
        captured = { url, init };
        return jsonResponse({
            data: [{ b64_json: Buffer.from(mp4Bytes).toString('base64') }]
        });
    });

    const video = await provider.generate({ prompt: 'shot list', size: '1080x1920', duration: 5 });
    const body = JSON.parse(captured.init.body);

    assert.equal(captured.url, 'https://api.example.com/v1/videos/generations');
    assert.equal(body.model, 'video-model');
    assert.equal(body.prompt, 'shot list');
    assert.equal(body.size, '1080x1920');
    assert.equal(body.duration, 5);
    assert.equal(body.response_format, 'b64_json');
    assert.equal(video.extension, 'mp4');
    assert.equal(video.mimeType, 'video/mp4');
    assert.deepEqual([...video.bytes], [...mp4Bytes]);
});

test('uses a full provider task endpoint without appending the default path', async () => {
    const { OpenAICompatibleVideoProvider } = await importTypeScript(entry);
    let capturedUrl = '';
    const provider = new OpenAICompatibleVideoProvider(
        settings({
            endpoint: 'https://api3.wlai.vip/volc/v1/contents/generations/tasks'
        }),
        async (url) => {
            capturedUrl = String(url);
            return jsonResponse({
                data: [{ b64_json: Buffer.from(mp4Bytes).toString('base64') }]
            });
        }
    );

    await provider.generate({ prompt: 'shot list', size: '1080x1920', duration: 5 });

    assert.equal(
        capturedUrl,
        'https://api3.wlai.vip/volc/v1/contents/generations/tasks'
    );
});

test('retries retryable video creation failures before giving up', async () => {
    const { OpenAICompatibleVideoProvider } = await importTypeScript(entry);
    const calls = [];
    const delays = [];
    const provider = new OpenAICompatibleVideoProvider(
        settings({ retryCount: 2 }),
        async (url) => {
            calls.push(String(url));
            if (calls.length === 1) {
                return jsonResponse({ error: { message: 'rate limited' } }, 429);
            }
            return jsonResponse({
                data: [{ b64_json: Buffer.from(mp4Bytes).toString('base64') }]
            });
        },
        async ms => delays.push(ms)
    );

    const video = await provider.generate({ prompt: 'shot list', size: '1080x1920', duration: 5 });

    assert.equal(video.mimeType, 'video/mp4');
    assert.equal(calls.length, 2);
    assert.deepEqual(delays, [1000]);
});

test('downloads secure URL videos and rejects non-local HTTP downloads', async () => {
    const { OpenAICompatibleVideoProvider } = await importTypeScript(entry);
    const fetchFn = async (url) => {
        if (String(url).endsWith('/videos/generations')) {
            return jsonResponse({ data: [{ url: 'https://cdn.example.com/video.mp4' }] });
        }
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'video/mp4' },
            arrayBuffer: async () => mp4Bytes.buffer
        };
    };

    const video = await new OpenAICompatibleVideoProvider(settings(), fetchFn)
        .generate({ prompt: 'test', size: '1080x1920', duration: 5 });
    assert.equal(video.extension, 'mp4');

    const insecure = async (url) => {
        if (String(url).endsWith('/videos/generations')) {
            return jsonResponse({ data: [{ url: 'http://evil.example/video.mp4' }] });
        }
        throw new Error('should not download');
    };
    await assert.rejects(
        () => new OpenAICompatibleVideoProvider(settings(), insecure)
            .generate({ prompt: 'test', size: '1080x1920', duration: 5 }),
        /HTTPS/
    );
});

test('polls asynchronous video tasks until a result URL is available', async () => {
    const { OpenAICompatibleVideoProvider } = await importTypeScript(entry);
    const calls = [];
    const fetchFn = async (url) => {
        calls.push(String(url));
        if (String(url).endsWith('/videos/generations')) {
            return jsonResponse({ id: 'task-1', status: 'queued' });
        }
        if (String(url).endsWith('/videos/generations/task-1')) {
            return jsonResponse({
                status: calls.length < 3 ? 'running' : 'succeeded',
                data: calls.length < 3 ? [] : [{ url: 'https://cdn.example.com/video.mp4' }]
            });
        }
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'video/mp4' },
            arrayBuffer: async () => mp4Bytes.buffer
        };
    };

    const video = await new OpenAICompatibleVideoProvider(settings(), fetchFn)
        .generate({ prompt: 'test', size: '1080x1920', duration: 5 });

    assert.equal(video.mimeType, 'video/mp4');
    assert.ok(calls.includes('https://api.example.com/v1/videos/generations/task-1'));
});
