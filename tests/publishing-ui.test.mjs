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
const styles = await readFile(
    new URL('../styles.css', import.meta.url),
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
