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
    // Check for i18n function calls instead of hardcoded strings
    assert.match(settingsSource, /publishingPlatforms/);
    assert.match(publishingSettingsSource, /connectionType/);
    assert.match(publishingSettingsSource, /testConnection/);
    assert.match(publishingSettingsSource, /mediaUploadUrl/);
    assert.match(styles, /\.ai-workbench-platform-settings/);
});

test('publish modal supports unified content, platform overrides, and failed retry', () => {
    // Check for i18n function calls instead of hardcoded strings
    assert.match(modalSource, /unifiedContent/);
    assert.match(modalSource, /platformSettings/);
    assert.match(modalSource, /retryFailed/);
    assert.match(modalSource, /overridden/);
    assert.match(styles, /\.ai-workbench-publish-modal/);
    assert.match(styles, /\.ai-workbench-publish-result-row/);
});

test('publish modal gives long text fields enough editing space', () => {
    assert.match(modalSource, /ai-workbench-publish-setting--body/);
    assert.match(styles, /\.ai-workbench-publish-setting--long/);
    assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1\.45fr\)\s+minmax\(360px,\s*0\.95fr\)/);
    assert.match(styles, /\.ai-workbench-publish-setting--long[\s\S]*flex-direction:\s*column/);
});

test('publish modal lets users choose article title candidates or customize title', () => {
    assert.match(modalSource, /titleOptions/);
    assert.match(modalSource, /addDropdown/);
    assert.match(modalSource, /ai-workbench-publish-title-picker/);
    assert.match(modalSource, /ai-workbench-custom-title/);
});

test('platform title overrides can choose title candidates or customize title', () => {
    assert.match(modalSource, /renderTitleOptionDropdown/);
    assert.match(modalSource, /ai-workbench-platform-title-picker/);
    assert.match(modalSource, /titleOptions\.forEach/);
    assert.match(modalSource, /dropdown\.addOption\('custom'/);
});

test('workbench renders six selectable publishing platforms', () => {
    assert.match(mainSource, /ai-workbench-publishing/);
    // Check for i18n keys instead of hardcoded platform names
    assert.match(mainSource, /'platforms\.wechat'/);
    assert.match(mainSource, /'platforms\.xiaohongshu'/);
    assert.match(mainSource, /'platforms\.wechatChannels'/);
    assert.match(mainSource, /'platforms\.douyin'/);
    assert.match(mainSource, /'platforms\.x'/);
    assert.match(mainSource, /'platforms\.youtube'/);
    assert.match(styles, /\.ai-workbench-platform-grid/);
    assert.match(styles, /grid-template-columns/);
});

test('saving publishing settings refreshes open workbench publishing controls', () => {
    assert.match(mainSource, /refreshWorkbenchViews\(\)/);
    assert.match(mainSource, /getLeavesOfType\(VIEW_TYPE\)/);
    assert.match(mainSource, /refreshPublishingControls\(\)/);
});

test('official publishing uses the Obsidian request transport', () => {
    assert.match(mainSource, /const obsidianFetch = createObsidianImageFetch\(requestUrl\)/);
    assert.match(mainSource, /new WebhookClient\(obsidianFetch\)/);
    assert.match(mainSource, /new PublishingAdapterFactory\(\s*new WebhookClient\(obsidianFetch\),\s*obsidianFetch\s*\)/s);
});

test('Xiaohongshu formatting exposes custom rules and two-step automation', () => {
    assert.match(settingsSource, /xiaohongshuFormatting/);
    assert.match(settingsSource, /formattingRules/);
    assert.match(mainSource, /formatXiaohongshuDraft/);
    assert.match(mainSource, /formatAndPublishXiaohongshuDraft/);
    assert.match(mainSource, /buildXiaohongshuFormattingPrompt/);
    assert.match(mainSource, /parseXiaohongshuFormattedDraft/);
});

test('Xiaohongshu automation lives in configurable custom prompts', async () => {
    const typesSource = await readFile(new URL('../src/types/index.ts', import.meta.url), 'utf8');
    const customPromptsSource = await readFile(new URL('../src/services/custom-prompts.ts', import.meta.url), 'utf8');

    assert.match(typesSource, /DEFAULT_XIAOHONGSHU_AUTOMATION_PROMPTS/);
    assert.match(typesSource, /automationAction\?: 'xiaohongshu-format' \| 'xiaohongshu-format-publish'/);
    assert.match(typesSource, /enabled\?: boolean/);
    assert.match(mainSource, /withDefaultAutomationPrompts/);
    assert.match(mainSource, /prompt\.automationAction === 'xiaohongshu-format'/);
    assert.match(mainSource, /prompt\.automationAction === 'xiaohongshu-format-publish'/);
    assert.match(customPromptsSource, /getEnabled\(\)/);
    assert.match(settingsSource, /setName\('启用 Prompt'\)/);
});
