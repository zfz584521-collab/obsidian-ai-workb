import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/workflow.ts', import.meta.url)
);
const source = '# 文章\n\n🎨 AI提示词：warm editorial illustration\n\n正文';
const file = { path: '文章.md', extension: 'md', basename: '文章' };
const image = {
    bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    extension: 'png',
    mimeType: 'image/png'
};

function settings(overrides = {}) {
    return {
        provider: 'openai-compatible',
        endpoint: 'https://api.example.com/v1',
        apiKey: 'key',
        model: 'image-model',
        size: '1536x1024',
        timeout: 10,
        retryCount: 0,
        concurrency: 1,
        maxImages: 10,
        previewTasks: false,
        keepOriginalPrompts: false,
        ...overrides
    };
}

function harness(options = {}) {
    const events = [];
    const created = [];
    const status = {
        setProcessing: value => events.push(['processing', value]),
        setProgress: (value, done, total) => events.push(['progress', value, done, total]),
        setCompleted: () => events.push(['completed']),
        setError: value => events.push(['error', value])
    };
    const app = {
        workspace: {
            getActiveFile: () => options.activeFile === undefined ? file : options.activeFile,
            getLeaf: () => ({
                openFile: async value => events.push(['open', value.path])
            })
        },
        vault: {
            read: async () => options.source === undefined ? source : options.source,
            createFolder: async path => events.push(['folder', path]),
            create: async (path, content) => {
                created.push({ path, content });
                return { path, extension: 'md', basename: '文章-已配图' };
            },
            adapter: {
                exists: async () => false,
                writeBinary: async path => events.push(['binary', path])
            }
        }
    };
    const fileService = {
        resolveIllustratedOutput: async () => ({
            articlePath: '文章-已配图.md',
            assetDirPath: '文章-已配图-assets',
            baseName: '文章-已配图'
        })
    };
    const preview = {
        confirm: async () => options.previewAccepted !== false
    };
    let providerCalls = 0;
    const providerFactory = () => ({
        async generate() {
            providerCalls += 1;
            if (options.providerError) throw options.providerError;
            return image;
        }
    });
    return {
        app, fileService, preview, status, providerFactory, events, created,
        get providerCalls() { return providerCalls; }
    };
}

test('rejects invalid input before extraction or file creation', async () => {
    const { WeChatImageWorkflow } = await importTypeScript(entry);
    const empty = harness({ source: '   ' });
    const workflow = new WeChatImageWorkflow(
        empty.app, { completeJson: async () => { throw new Error('unused'); } },
        empty.fileService, empty.status, empty.preview, settings(), empty.providerFactory
    );
    const result = await workflow.run();
    assert.equal(result.success, false);
    assert.equal(empty.created.length, 0);

    const invalid = harness();
    const invalidWorkflow = new WeChatImageWorkflow(
        invalid.app, { completeJson: async () => 'unused' },
        invalid.fileService, invalid.status, invalid.preview,
        settings({ endpoint: 'http://evil.example', apiKey: '' }),
        invalid.providerFactory
    );
    assert.equal((await invalidWorkflow.run()).success, false);
    assert.equal(invalid.providerCalls, 0);
});

test('preview rejection performs no generation or writes', async () => {
    const { WeChatImageWorkflow } = await importTypeScript(entry);
    const state = harness({ previewAccepted: false });
    const workflow = new WeChatImageWorkflow(
        state.app, { completeJson: async () => 'unused' },
        state.fileService, state.status, state.preview,
        settings({ previewTasks: true }), state.providerFactory
    );

    const result = await workflow.run();

    assert.equal(result.cancelled, true);
    assert.equal(state.providerCalls, 0);
    assert.equal(state.created.length, 0);
});

test('creates and opens a new illustrated article with progress', async () => {
    const { WeChatImageWorkflow } = await importTypeScript(entry);
    const state = harness();
    const workflow = new WeChatImageWorkflow(
        state.app, { completeJson: async () => 'unused' },
        state.fileService, state.status, state.preview, settings(), state.providerFactory
    );

    const result = await workflow.run();

    assert.equal(result.success, true);
    assert.equal(result.successCount, 1);
    assert.equal(state.created.length, 1);
    assert.match(state.created[0].content, /文章-已配图-assets\/image-01\.png/);
    assert.ok(state.events.some(event =>
        event[0] === 'progress' && event[1] === '正在生成' && event[2] === 1
    ));
    assert.ok(state.events.some(event => event[0] === 'open'));
});

test('total generation failure creates a failure article without assets', async () => {
    const { ImageProviderError, WeChatImageWorkflow } = await importTypeScript(entry);
    const state = harness({ providerError: new ImageProviderError('invalid', false) });
    const workflow = new WeChatImageWorkflow(
        state.app, { completeJson: async () => 'unused' },
        state.fileService, state.status, state.preview, settings(), state.providerFactory
    );

    const result = await workflow.run();

    assert.equal(result.success, true);
    assert.equal(result.failureCount, 1);
    assert.equal(state.events.some(event => event[0] === 'folder'), false);
    assert.match(state.created[0].content, /配图生成失败/);
});

test('extraction failure creates no output', async () => {
    const { WeChatImageWorkflow } = await importTypeScript(entry);
    const state = harness({ source: '# 无提示词\n正文' });
    const workflow = new WeChatImageWorkflow(
        state.app, { completeJson: async () => '{bad json' },
        state.fileService, state.status, state.preview, settings(), state.providerFactory
    );

    const result = await workflow.run();

    assert.equal(result.success, false);
    assert.equal(state.created.length, 0);
});
