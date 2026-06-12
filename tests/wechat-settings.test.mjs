import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const typesEntry = fileURLToPath(new URL('../src/types/index.ts', import.meta.url));
const mainSource = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../src/settings.ts', import.meta.url), 'utf8');

test('persists image settings with safe defaults', async () => {
    const { DEFAULT_SETTINGS } = await importTypeScript(typesEntry);
    assert.equal(DEFAULT_SETTINGS.images.provider, 'openai-compatible');
    assert.equal(DEFAULT_SETTINGS.images.maxImages, 10);
    assert.match(mainSource, /images:\s*\{\s*\.\.\.DEFAULT_SETTINGS\.images,\s*\.\.\.saved\?\.images\s*\}/s);
    assert.match(mainSource, /weChatImageWorkflow\?\.updateSettings\(this\.settings\.images\)/);
});

test('renders every required image setting control', () => {
    for (const field of [
        'endpoint', 'apiKey', 'model', 'size', 'timeout',
        'retryCount', 'concurrency', 'maxImages',
        'previewTasks', 'keepOriginalPrompts'
    ]) {
        assert.match(
            settingsSource,
            new RegExp(`settings\\.images\\.${field}`),
            `missing image setting ${field}`
        );
    }
    assert.match(settingsSource, /图片生成/);
});
