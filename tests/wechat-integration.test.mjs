import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
const contextSource = await readFile(
    new URL('../src/services/context-menu.ts', import.meta.url),
    'utf8'
);
const settingsSource = await readFile(new URL('../src/settings.ts', import.meta.url), 'utf8');

test('registers and dispatches the one-click WeChat image command', () => {
    assert.match(mainSource, /id:\s*['"]wechat-insert-images['"]/);
    assert.match(mainSource, /executeWeChatImageInsertion\(\)/);
    assert.match(mainSource, /new WeChatImageWorkflow\(/);
    assert.match(mainSource, /actionId === ['"]wechat-insert-images['"]/);
    assert.match(mainSource, /公众号一键插入图片/);
});

test('exposes the workflow in editor, file, sidebar, and shortcut UI', () => {
    assert.match(contextSource, /executeWeChatImages/);
    assert.match(contextSource, /executeWeChatImages\(file\)/);
    assert.match(contextSource, /公众号一键插入图片/);
    assert.match(mainSource, /ai-workbench-wechat-images/);
    assert.match(settingsSource, /addOption\(['"]wechat-insert-images['"]/);
});
