import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/output-writer.ts', import.meta.url)
);
const task = index => ({
    id: `generated-0${index}`,
    prompt: `prompt-${index}`,
    anchor: { nearbyText: '正文', placement: 'after' }
});
const image = {
    bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    extension: 'png',
    mimeType: 'image/png'
};

function createVault(existing = []) {
    const paths = new Set(existing);
    const events = [];
    return {
        events,
        async exists(path) {
            return paths.has(path);
        },
        async createFolder(path) {
            events.push(['folder', path]);
            paths.add(path);
        },
        async writeBinary(path, data) {
            events.push(['binary', path, data.byteLength]);
            paths.add(path);
        },
        async createMarkdown(path, content) {
            events.push(['markdown', path, content]);
            paths.add(path);
        }
    };
}

test('resolves one shared suffix for article and asset directory', async () => {
    const { resolveIllustratedOutputPaths } = await importTypeScript(entry);
    const existing = new Set([
        '文章-已配图.md',
        '文章-已配图-1-assets'
    ]);
    const output = await resolveIllustratedOutputPaths(
        '文章.md',
        path => Promise.resolve(existing.has(path))
    );

    assert.deepEqual(output, {
        articlePath: '文章-已配图-2.md',
        assetDirPath: '文章-已配图-2-assets',
        baseName: '文章-已配图-2'
    });
});

test('writes successful images in task order before creating article', async () => {
    const { ImageOutputWriter } = await importTypeScript(entry);
    const vault = createVault();
    const writer = new ImageOutputWriter(vault);
    const output = await writer.resolve('目录/文章.md');
    const results = [
        { task: task(1), image },
        { task: task(2), error: 'failed' },
        { task: task(3), image }
    ];

    const saved = await writer.saveImages(output, results);
    await writer.createArticle(output, '# 新文章');

    assert.equal(saved[0].assetPath, '目录/文章-已配图-assets/image-01.png');
    assert.equal(saved[1].assetPath, undefined);
    assert.equal(saved[2].assetPath, '目录/文章-已配图-assets/image-03.png');
    assert.deepEqual(vault.events.map(event => event[0]), [
        'folder', 'binary', 'binary', 'markdown'
    ]);
});

test('does not create an asset directory when every image fails', async () => {
    const { ImageOutputWriter } = await importTypeScript(entry);
    const vault = createVault();
    const writer = new ImageOutputWriter(vault);
    const output = await writer.resolve('文章.md');

    await writer.saveImages(output, [{ task: task(1), error: 'failed' }]);

    assert.deepEqual(vault.events, []);
});

test('reports retained assets when article creation fails and never writes source', async () => {
    const { ImageOutputWriter, OutputWriteError } = await importTypeScript(entry);
    const vault = createVault();
    vault.createMarkdown = async path => {
        vault.events.push(['markdown-failed', path]);
        throw new Error('disk full');
    };
    const writer = new ImageOutputWriter(vault);
    const output = await writer.resolve('原文.md');
    await writer.saveImages(output, [{ task: task(1), image }]);

    await assert.rejects(
        () => writer.createArticle(output, 'new content'),
        error => {
            assert.ok(error instanceof OutputWriteError);
            assert.equal(error.assetDirPath, '原文-已配图-assets');
            return true;
        }
    );
    assert.equal(vault.events.some(event => event[1] === '原文.md'), false);
});
