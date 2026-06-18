import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSignedHeaders, WebhookClient } from '../src/publishing/webhook';
import { PlatformPublishRequest } from '../src/publishing/types';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function createRequest(source: 'vault' | 'remote'): PlatformPublishRequest {
    return {
        taskId: 'task-1',
        idempotencyKey: 'idem-1',
        platform: 'xiaohongshu',
        content: {
            sourcePath: 'Notes/example.md',
            title: 'Title',
            bodyMarkdown: 'Body',
            images: [{
                kind: 'image',
                source,
                path: source === 'vault' ? 'assets/image.png' : 'https://example.com/image.png',
                name: 'image.png',
                mimeType: 'image/png',
                data: source === 'vault' ? new Uint8Array([1, 2, 3]).buffer : undefined,
                remoteUrl: source === 'remote' ? 'https://example.com/image.png' : undefined
            }],
            tags: []
        },
        settings: {
            enabled: true,
            connectionType: 'webhook',
            official: {},
            webhook: {
                url: 'https://relay/draft',
                mediaUploadUrl: 'https://relay/media',
                authType: 'bearer',
                token: 'top-secret-token',
                headers: {},
                signingSecret: 'signing-secret'
            },
            defaults: {}
        }
    };
}

test('buildSignedHeaders signs timestamp and raw JSON body', async () => {
    const headers = await buildSignedHeaders(
        {
            authType: 'bearer',
            token: 'token',
            headers: {},
            signingSecret: 'secret'
        },
        '{"hello":"world"}',
        'idem-1',
        1700000000
    );

    assert.equal(headers.Authorization, 'Bearer token');
    assert.equal(headers['X-AI-Workbench-Timestamp'], '1700000000');
    assert.equal(headers['Idempotency-Key'], 'idem-1');
    assert.match(headers['X-AI-Workbench-Signature'], /^[a-f0-9]{64}$/);
});

test('custom authentication headers cannot replace protocol headers', async () => {
    const headers = await buildSignedHeaders(
        {
            authType: 'headers',
            token: '',
            headers: { 'Idempotency-Key': 'attacker-value', 'X-Relay-Key': 'relay-key' },
            signingSecret: ''
        },
        '{}',
        'idem-1',
        1700000000
    );

    assert.equal(headers['Idempotency-Key'], 'idem-1');
    assert.equal(headers['X-Relay-Key'], 'relay-key');
});

test('WebhookClient uploads local media before creating a draft', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.endsWith('/media')) {
            return jsonResponse({ success: true, mediaRef: 'media-1' });
        }
        return jsonResponse({
            success: true,
            draftId: 'draft-1',
            managementUrl: 'https://relay/drafts/1',
            targetKind: 'webhook-draft'
        });
    };

    const result = await new WebhookClient(fetchFn, () => 1700000000)
        .createDraft(createRequest('vault'));

    assert.deepEqual(calls.map(call => call.url), [
        'https://relay/media',
        'https://relay/draft'
    ]);
    assert.equal(result.draftId, 'draft-1');
    assert.equal(result.targetKind, 'webhook-draft');
    const draftBody = JSON.parse(String(calls[1].init?.body));
    assert.equal(draftBody.media.images[0].mediaRef, 'media-1');
});

test('WebhookClient keeps remote media URLs without uploading', async () => {
    const calls: string[] = [];
    const fetchFn = async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return jsonResponse({
            success: true,
            draftId: 'draft-2',
            targetKind: 'webhook-draft'
        });
    };

    const result = await new WebhookClient(fetchFn).createDraft(createRequest('remote'));
    assert.equal(result.success, true);
    assert.deepEqual(calls, ['https://relay/draft']);
});

test('WebhookClient normalizes HTTP and invalid response errors', async () => {
    const httpResult = await new WebhookClient(async () =>
        jsonResponse({ message: 'secret top-secret-token' }, 502)
    ).createDraft(createRequest('remote'));
    assert.equal(httpResult.error?.code, 'WEBHOOK_HTTP_ERROR');
    assert.equal(httpResult.error?.retryable, true);
    assert.doesNotMatch(httpResult.error?.message || '', /top-secret-token/);

    const invalidResult = await new WebhookClient(async () =>
        jsonResponse({ success: true })
    ).createDraft(createRequest('remote'));
    assert.equal(invalidResult.error?.code, 'WEBHOOK_INVALID_RESPONSE');
});

test('WebhookClient includes safe relay error details for HTTP failures', async () => {
    const result = await new WebhookClient(async () =>
        jsonResponse({
            success: false,
            error: {
                code: 'XHS_DRAFT_SERVER_ERROR',
                message: '请先用带调试端口的 Edge 打开小红书创作服务平台: 9222'
            }
        }, 500)
    ).createDraft(createRequest('remote'));

    assert.equal(result.error?.code, 'WEBHOOK_HTTP_ERROR');
    assert.match(result.error?.message || '', /HTTP 500/);
    assert.match(result.error?.message || '', /调试端口/);
});

test('connection test contains no note content', async () => {
    let body = '';
    const client = new WebhookClient(async (_input, init) => {
        body = String(init?.body);
        return jsonResponse({ success: true });
    });

    const result = await client.testConnection('xiaohongshu', createRequest('remote').settings);
    assert.equal(result.success, true);
    assert.doesNotMatch(body, /Title|Body|Notes\/example/);
});
