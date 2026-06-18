import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

test('installable bundle files include core, publishing, xiaohongshu, and video features', async () => {
    const [main, manifest, styles, xhsServer] = await Promise.all([
        readFile(new URL('../main.js', import.meta.url), 'utf8'),
        readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
        stat(new URL('../styles.css', import.meta.url)),
        readFile(new URL('../scripts/xhs-draft-server.mjs', import.meta.url), 'utf8')
    ]);
    const parsedManifest = JSON.parse(manifest);

    assert.equal(parsedManifest.id, 'ai-workbench');
    assert.equal(parsedManifest.name, 'AI Workbench');
    assert.equal(parsedManifest.version, '0.1.1');
    assert.ok(styles.size > 10000);
    for (const marker of [
        'summarize',
        'open-draft-publisher',
        'wechat-insert-images',
        'xiaohongshu-format',
        'generate-short-video',
        'VideoGenerationWorkflow'
    ]) {
        assert.match(main, new RegExp(marker), `missing install bundle marker: ${marker}`);
    }
    assert.match(xhsServer, /remote-debugging-port/);
    assert.match(xhsServer, /xhs\/draft/);
});
