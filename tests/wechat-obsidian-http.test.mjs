import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/obsidian-http.ts', import.meta.url)
);

test('adapts Obsidian requestUrl to the image provider fetch contract', async () => {
    const { createObsidianImageFetch } = await importTypeScript(entry);
    let captured;
    const imageFetch = createObsidianImageFetch(async request => {
        captured = request;
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            arrayBuffer: new ArrayBuffer(0),
            json: { data: [{ b64_json: 'abc' }] },
            text: '{"data":[{"b64_json":"abc"}]}'
        };
    });

    const response = await imageFetch('https://api.example.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer secret'
        },
        body: '{"model":"gpt-image-2"}'
    });

    assert.deepEqual(captured, {
        url: 'https://api.example.com/v1/images/generations',
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: 'Bearer secret'
        },
        body: '{"model":"gpt-image-2"}',
        throw: false
    });
    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [{ b64_json: 'abc' }] });
    assert.equal(response.headers.get('content-type'), 'application/json');
});

test('adapts FormData bodies to multipart requestUrl uploads', async () => {
    const { createObsidianImageFetch } = await importTypeScript(entry);
    let captured;
    const imageFetch = createObsidianImageFetch(async request => {
        captured = request;
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            arrayBuffer: new ArrayBuffer(0),
            json: { media_id: 'media-id' },
            text: '{"media_id":"media-id"}'
        };
    });

    const form = new FormData();
    form.append('media', new Blob(['image-bytes'], { type: 'image/png' }), 'cover.png');

    await imageFetch('https://api.weixin.qq.com/cgi-bin/material/add_material', {
        method: 'POST',
        body: form
    });

    assert.equal(captured.method, 'POST');
    assert.match(captured.headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.ok(captured.body instanceof ArrayBuffer);
    const body = new TextDecoder().decode(captured.body);
    assert.match(body, /name="media"; filename="cover\.png"/);
    assert.match(body, /Content-Type: image\/png/);
    assert.match(body, /image-bytes/);
});
