import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const typesEntry = fileURLToPath(new URL('../src/types/index.ts', import.meta.url));
const mainSource = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../src/settings.ts', import.meta.url), 'utf8');

test('persists video settings with portable safe defaults', async () => {
    const { DEFAULT_SETTINGS } = await importTypeScript(typesEntry);
    assert.equal(DEFAULT_SETTINGS.videos.provider, 'openai-compatible');
    assert.equal(DEFAULT_SETTINGS.videos.size, '1080x1920');
    assert.equal(DEFAULT_SETTINGS.videos.duration, 5);
    assert.match(mainSource, /videos:\s*\{\s*\.\.\.DEFAULT_SETTINGS\.videos,\s*\.\.\.saved\?\.videos\s*\}/s);
    assert.match(mainSource, /videoGenerationWorkflow(?:\?\.)?\.?updateSettings\(this\.settings\.videos\)/);
});

test('renders every required video setting control', () => {
    for (const field of [
        'endpoint', 'apiKey', 'model', 'size', 'duration',
        'timeout', 'retryCount', 'pollInterval', 'maxPollAttempts'
    ]) {
        assert.match(
            settingsSource,
            new RegExp(`settings\\.videos\\.${field}`),
            `missing video setting ${field}`
        );
    }
    assert.match(settingsSource, /videoGeneration/);
    assert.match(settingsSource, /videoApiEndpoint/);
});

test('registers and exposes the one-click short video generation command', () => {
    assert.match(mainSource, /id:\s*['"]generate-short-video['"]/);
    assert.match(mainSource, /executeShortVideoGeneration\(\)/);
    assert.match(mainSource, /new VideoGenerationWorkflow\(/);
    assert.match(mainSource, /ai-workbench-generate-video/);
});
