import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const obsidianContentSource = await readFile(
    new URL('../src/publishing/obsidian-content.ts', import.meta.url),
    'utf8'
);
const interfacesSource = await readFile(
    new URL('../src/interfaces.ts', import.meta.url),
    'utf8'
);
const settingsSource = await readFile(
    new URL('../src/settings.ts', import.meta.url),
    'utf8'
);
const publishingSettingsSource = await readFile(
    new URL('../src/publishing/settings-ui.ts', import.meta.url),
    'utf8'
);
const modalSource = await readFile(
    new URL('../src/publishing/modal.ts', import.meta.url),
    'utf8'
);
const styles = await readFile(
    new URL('../styles.css', import.meta.url),
    'utf8'
);
const mainSource = await readFile(
    new URL('../main.ts', import.meta.url),
    'utf8'
);

test('Obsidian content extractor reads note metadata and binary media', () => {
    assert.match(obsidianContentSource, /metadataCache\.getFileCache/);
    assert.match(obsidianContentSource, /vault\.read/);
    assert.match(obsidianContentSource, /vault\.readBinary/);
    assert.match(obsidianContentSource, /getFirstLinkpathDest/);
});

test('Obsidian content extractor exposes a narrow service interface', () => {
    assert.match(interfacesSource, /interface IObsidianContentExtractor/);
    assert.match(interfacesSource, /Promise<import\('\.\/publishing\/types'\)\.PublishContent>/);
});

test('settings expose publishing platforms and connection controls', () => {
    assert.match(settingsSource, /发布平台/);
    assert.match(publishingSettingsSource, /connectionType/);
    assert.match(publishingSettingsSource, /测试连接/);
    assert.match(publishingSettingsSource, /mediaUploadUrl/);
    assert.match(styles, /\.ai-workbench-platform-settings/);
});

test('publish modal supports unified content, platform overrides, and failed retry', () => {
    assert.match(modalSource, /统一内容/);
    assert.match(modalSource, /平台设置/);
    assert.match(modalSource, /仅重试失败平台/);
    assert.match(modalSource, /已覆盖/);
    assert.match(styles, /\.ai-workbench-publish-modal/);
    assert.match(styles, /\.ai-workbench-publish-result-row/);
});

test('workbench renders six selectable publishing platforms', () => {
    assert.match(mainSource, /ai-workbench-publishing/);
    assert.match(mainSource, /编辑并发布/);
    for (const platform of ['微信公众号', '小红书', '视频号', '抖音', 'X', 'YouTube']) {
        assert.match(mainSource, new RegExp(platform));
    }
    assert.match(styles, /\.ai-workbench-platform-grid/);
    assert.match(styles, /grid-template-columns/);
});
