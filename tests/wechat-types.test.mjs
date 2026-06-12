import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(new URL('../src/wechat-images/types.ts', import.meta.url));

test('image defaults enforce the agreed safe limits', async () => {
    const { DEFAULT_IMAGE_SETTINGS } = await importTypeScript(entry);
    assert.equal(DEFAULT_IMAGE_SETTINGS.provider, 'openai-compatible');
    assert.equal(DEFAULT_IMAGE_SETTINGS.maxImages, 10);
    assert.equal(DEFAULT_IMAGE_SETTINGS.previewTasks, false);
    assert.equal(DEFAULT_IMAGE_SETTINGS.keepOriginalPrompts, false);
});
