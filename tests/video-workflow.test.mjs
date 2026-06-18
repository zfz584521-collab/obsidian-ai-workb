import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/video-generation/workflow.ts', import.meta.url)
);
const file = { path: 'notes/script.md', extension: 'md', basename: 'script', parent: { path: 'notes' } };
const mp4 = {
    bytes: Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]),
    extension: 'mp4',
    mimeType: 'video/mp4'
};
const png = {
    bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    extension: 'png',
    mimeType: 'image/png'
};

function settings(overrides = {}) {
    return {
        provider: 'openai-compatible',
        endpoint: 'https://api.example.com/v1',
        apiKey: 'key',
        model: 'video-model',
        size: '1080x1920',
        duration: 5,
        timeout: 10,
        retryCount: 0,
        pollInterval: 1,
        maxPollAttempts: 2,
        ...overrides
    };
}

function harness(options = {}) {
    const events = [];
    const modified = [];
    const binaries = [];
    const app = {
        workspace: {
            getActiveFile: () => options.activeFile === undefined ? file : options.activeFile,
            getActiveViewOfType: () => options.selection ? {
                file,
                editor: { getSelection: () => options.selection }
            } : null
        },
        vault: {
            read: async () => options.source === undefined ? '# 标题\n\n短视频脚本内容' : options.source,
            modify: async (target, content) => modified.push({ path: target.path, content }),
            adapter: {
                exists: async path => options.existing?.has(path) || false,
                writeBinary: async (path, data) => binaries.push({ path, data })
            }
        }
    };
    const status = {
        setProcessing: value => events.push(['processing', value]),
        setProgress: (value, done, total) => events.push(['progress', value, done, total]),
        setCompleted: () => events.push(['completed']),
        setError: value => events.push(['error', value])
    };
    let promptInput = '';
    const promptBuilder = {
        build: async source => {
            promptInput = source;
            return options.prompt || 'cinematic vertical short video prompt';
        }
    };
    let providerRequest;
    const providerFactory = () => ({
        generate: async request => {
            providerRequest = request;
            return mp4;
        }
    });
    return {
        app, status, promptBuilder, providerFactory, events, modified, binaries,
        get promptInput() { return promptInput; },
        get providerRequest() { return providerRequest; }
    };
}

test('generates a video from the current note and inserts an Obsidian embed', async () => {
    const { VideoGenerationWorkflow } = await importTypeScript(entry);
    const state = harness();
    const workflow = new VideoGenerationWorkflow(
        state.app, state.status, state.promptBuilder, settings(), state.providerFactory
    );

    const result = await workflow.run();

    assert.equal(result.success, true);
    assert.equal(result.outputPath, 'notes/script-assets/video-01.mp4');
    assert.equal(state.providerRequest.prompt, 'cinematic vertical short video prompt');
    assert.equal(state.providerRequest.size, '1080x1920');
    assert.equal(state.providerRequest.duration, 5);
    assert.equal(state.binaries[0].path, 'notes/script-assets/video-01.mp4');
    assert.match(state.modified[0].content, /!\[\[script-assets\/video-01\.mp4\]\]/);
});

test('uses selected script text when the editor has a selection', async () => {
    const { VideoGenerationWorkflow } = await importTypeScript(entry);
    const state = harness({ selection: '选中的短视频脚本' });
    const workflow = new VideoGenerationWorkflow(
        state.app, state.status, state.promptBuilder, settings(), state.providerFactory
    );

    await workflow.run();

    assert.equal(state.promptInput, '选中的短视频脚本');
});

test('prepares an editable prompt without requesting video generation', async () => {
    const { VideoGenerationWorkflow } = await importTypeScript(entry);
    const state = harness({ prompt: 'editable prompt draft' });
    const workflow = new VideoGenerationWorkflow(
        state.app, state.status, state.promptBuilder, settings(), state.providerFactory
    );

    const result = await workflow.preparePrompt();

    assert.equal(result.success, true);
    assert.equal(result.prompt, 'editable prompt draft');
    assert.equal(result.file.path, file.path);
    assert.equal(state.binaries.length, 0);
    assert.equal(state.modified.length, 0);
    assert.equal(state.providerRequest, undefined);
});

test('writes a prepared video prompt into the current note without requiring video settings', async () => {
    const { VideoGenerationWorkflow } = await importTypeScript(entry);
    const state = harness({ prompt: 'editable prompt draft' });
    const workflow = new VideoGenerationWorkflow(
        state.app, state.status, state.promptBuilder,
        settings({ apiKey: '', endpoint: 'http://evil.example' }),
        state.providerFactory
    );

    const prepared = await workflow.preparePrompt();
    const result = await workflow.writePrompt(prepared.prompt, prepared.file);

    assert.equal(prepared.success, true);
    assert.equal(result.success, true);
    assert.match(state.modified[0].content, /## AI 短视频提示词/);
    assert.match(state.modified[0].content, /editable prompt draft/);
    assert.equal(state.binaries.length, 0);
});

test('generates a video reference image with image settings and inserts an embed', async () => {
    const { VideoGenerationWorkflow } = await importTypeScript(entry);
    const state = harness({ source: '# Title\n\n## AI 短视频提示词\n\nA vertical product video prompt\n' });
    let imageRequest;
    const imageProviderFactory = () => ({
        generate: async request => {
            imageRequest = request;
            return png;
        }
    });
    const workflow = new VideoGenerationWorkflow(
        state.app,
        state.status,
        state.promptBuilder,
        settings({ apiKey: '', endpoint: 'http://evil.example' }),
        state.providerFactory,
        undefined,
        { endpoint: 'https://image.example.com/v1', apiKey: 'image-key', model: 'image-model', size: '1024x1024', timeout: 10 },
        imageProviderFactory
    );

    const result = await workflow.generateImage();

    assert.equal(result.success, true);
    assert.equal(result.outputPath, 'notes/script-assets/video-reference-01.png');
    assert.equal(imageRequest.prompt, 'A vertical product video prompt');
    assert.equal(imageRequest.size, '1024x1024');
    assert.equal(state.providerRequest, undefined);
    assert.equal(state.binaries[0].path, 'notes/script-assets/video-reference-01.png');
    assert.match(state.modified[0].content, /!\[\[script-assets\/video-reference-01\.png\]\]/);
});

test('generates a video from a confirmed editable prompt', async () => {
    const { VideoGenerationWorkflow } = await importTypeScript(entry);
    const state = harness();
    const workflow = new VideoGenerationWorkflow(
        state.app, state.status, state.promptBuilder, settings(), state.providerFactory
    );

    const result = await workflow.runWithPrompt('confirmed prompt', file);

    assert.equal(result.success, true);
    assert.equal(state.promptInput, '');
    assert.equal(state.providerRequest.prompt, 'confirmed prompt');
    assert.equal(state.binaries[0].path, 'notes/script-assets/video-01.mp4');
    assert.match(state.modified[0].content, /!\[\[script-assets\/video-01\.mp4\]\]/);
});

test('rejects missing settings before requesting a video', async () => {
    const { VideoGenerationWorkflow } = await importTypeScript(entry);
    const state = harness();
    const workflow = new VideoGenerationWorkflow(
        state.app, state.status, state.promptBuilder,
        settings({ apiKey: '', endpoint: 'http://evil.example' }),
        state.providerFactory
    );

    const result = await workflow.run();

    assert.equal(result.success, false);
    assert.equal(state.binaries.length, 0);
    assert.equal(state.modified.length, 0);
});
