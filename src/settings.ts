/**
 * Settings Tab - Plugin settings UI
 */

import { App, PluginSettingTab, Setting, Modal, Notice, debounce } from 'obsidian';
import type AIWorkbenchPlugin from '../main';
import { WorkbenchSettings, CustomPrompt, ShortcutBinding } from './types';
import { SETTINGS_DEBOUNCE_MS, MIN_API_KEY_LENGTH, API_KEY_MASK_LENGTH } from './constants';
import { PublishingSettingsRenderer } from './publishing/settings-ui';
import { t, i18n } from './i18n';

export class WorkbenchSettingTab extends PluginSettingTab {
    plugin: AIWorkbenchPlugin;

    constructor(app: App, plugin: AIWorkbenchPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('ai-workbench-settings');

        // Language Settings (at the top)
        containerEl.createEl('h2', { text: t('settings.language') });

        new Setting(containerEl)
            .setName(t('settings.language'))
            .setDesc(t('settings.languageDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('auto', t('settings.languageAuto'))
                .addOption('zh-CN', t('settings.languageZhCN'))
                .addOption('en', t('settings.languageEn'))
                .setValue(this.plugin.settings.i18n.language)
                .onChange(async (value: 'auto' | 'zh-CN' | 'en') => {
                    this.plugin.settings.i18n.language = value;
                    await this.plugin.saveSettings();
                    // Update i18n service
                    const obsidianLocale = (this.app.vault as any).getConfig?.('locale')?.toString();
                    i18n.setLanguage(value, obsidianLocale);
                    // Re-render settings to show updated language
                    this.display();
                }));

        // API Settings
        containerEl.createEl('h2', { text: t('settings.apiConfig') });

        new Setting(containerEl)
            .setName(t('settings.apiEndpoint'))
            .setDesc(t('settings.apiEndpointDesc'))
            .addText(text => text
                .setPlaceholder('https://api.openai.com/v1')
                .setValue(this.plugin.settings.api.endpoint)
                .onChange(debounce(async (value: string) => {
                    // 验证endpoint格式
                    if (value && !this.validateEndpoint(value)) {
                        new Notice(t('validation.apiEndpointInvalid'));
                        return;
                    }

                    this.plugin.settings.api.endpoint = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName(t('settings.apiKey'))
            .setDesc(t('settings.apiKeyDesc'))
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.maskApiKey(this.plugin.settings.api.apiKey))
                .onChange(debounce(async (value: string) => {
                    // 如果是掩码显示，忽略
                    if (value.includes('...')) {
                        return;
                    }

                    // 验证API密钥格式
                    if (value && !this.validateApiKey(value)) {
                        new Notice(t('validation.apiKeyInvalid'));
                        return;
                    }

                    this.plugin.settings.api.apiKey = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName(t('settings.model'))
            .setDesc(t('settings.modelDesc'))
            .addText(text => text
                .setPlaceholder('gpt-4o-mini')
                .setValue(this.plugin.settings.api.model)
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.api.model = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName(t('settings.timeout'))
            .setDesc(t('settings.timeoutDesc'))
            .addSlider(slider => slider
                .setLimits(10, 300, 10)
                .setValue(this.plugin.settings.api.timeout)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.api.timeout = value;
                    await this.plugin.saveSettings();
                }));

        // Image Generation Settings
        containerEl.createEl('h2', { text: t('settings.imageGeneration') });

        new Setting(containerEl)
            .setName(t('settings.imageProvider'))
            .setDesc(t('settings.imageProviderDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('openai-compatible', 'OpenAI 兼容 API')
                .setValue(this.plugin.settings.images.provider)
                .onChange(async (value: 'openai-compatible') => {
                    this.plugin.settings.images.provider = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.imageApiEndpoint'))
            .setDesc(t('settings.imageApiEndpointDesc'))
            .addText(text => text
                .setPlaceholder('https://api3.wlai.vip/v1')
                .setValue(this.plugin.settings.images.endpoint)
                .onChange(debounce(async (value: string) => {
                    if (value && !this.validateEndpoint(value)) {
                        new Notice(t('validation.httpsRequired'));
                        return;
                    }
                    this.plugin.settings.images.endpoint = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName(t('settings.imageApiKey'))
            .setDesc(t('settings.imageApiKeyDesc'))
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.maskApiKey(this.plugin.settings.images.apiKey))
                .onChange(debounce(async (value: string) => {
                    if (value.includes('...')) return;
                    this.plugin.settings.images.apiKey = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName(t('settings.imageModel'))
            .addText(text => text
                .setPlaceholder('gpt-image-1')
                .setValue(this.plugin.settings.images.model)
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.images.model = value.trim();
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName(t('settings.imageSize'))
            .setDesc(t('settings.imageSizeDesc'))
            .addText(text => text
                .setPlaceholder('1536x1024')
                .setValue(this.plugin.settings.images.size)
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.images.size = value.trim();
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName(t('settings.imageTimeout'))
            .setDesc(t('settings.imageTimeoutDesc'))
            .addSlider(slider => slider
                .setLimits(30, 300, 10)
                .setValue(this.plugin.settings.images.timeout)
                .setDynamicTooltip()
                .onChange(async value => {
                    this.plugin.settings.images.timeout = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.retryCount'))
            .addSlider(slider => slider
                .setLimits(0, 5, 1)
                .setValue(this.plugin.settings.images.retryCount)
                .setDynamicTooltip()
                .onChange(async value => {
                    this.plugin.settings.images.retryCount = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.concurrency'))
            .addSlider(slider => slider
                .setLimits(1, 5, 1)
                .setValue(this.plugin.settings.images.concurrency)
                .setDynamicTooltip()
                .onChange(async value => {
                    this.plugin.settings.images.concurrency = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.maxImages'))
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.images.maxImages)
                .setDynamicTooltip()
                .onChange(async value => {
                    this.plugin.settings.images.maxImages = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.previewPrompt'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.images.previewTasks)
                .onChange(async value => {
                    this.plugin.settings.images.previewTasks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.keepOriginalPrompts'))
            .setDesc(t('settings.keepOriginalPromptsDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.images.keepOriginalPrompts)
                .onChange(async value => {
                    this.plugin.settings.images.keepOriginalPrompts = value;
                    await this.plugin.saveSettings();
                }));

        // Output Settings
        containerEl.createEl('h2', { text: t('settings.outputSettings') });

        new Setting(containerEl)
            .setName(t('settings.summaryPosition'))
            .setDesc(t('settings.summaryPositionDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('append', t('settings.summaryPositionAppend'))
                .addOption('prepend', t('settings.summaryPositionPrepend'))
                .addOption('newFile', t('settings.summaryPositionNewFile'))
                .setValue(this.plugin.settings.output.summaryPosition)
                .onChange(async (value: 'append' | 'prepend' | 'newFile') => {
                    this.plugin.settings.output.summaryPosition = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.outputLanguage'))
            .setDesc(t('settings.outputLanguageDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('auto', t('settings.outputLanguageAuto'))
                .addOption('zh', t('settings.outputLanguageZh'))
                .addOption('en', t('settings.outputLanguageEn'))
                .setValue(this.plugin.settings.output.language)
                .onChange(async (value: 'auto' | 'zh' | 'en') => {
                    this.plugin.settings.output.language = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.addTimestamp'))
            .setDesc(t('settings.addTimestampDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.output.includeTimestamp)
                .onChange(async (value) => {
                    this.plugin.settings.output.includeTimestamp = value;
                    await this.plugin.saveSettings();
                }));

        // Backup Settings
        containerEl.createEl('h2', { text: t('settings.backupSettings') });

        new Setting(containerEl)
            .setName(t('settings.enableBackup'))
            .setDesc(t('settings.enableBackupDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.backup.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.backup.enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.maxBackupCount'))
            .setDesc(t('settings.maxBackupCountDesc'))
            .addSlider(slider => slider
                .setLimits(1, 50, 1)
                .setValue(this.plugin.settings.backup.maxCount)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.backup.maxCount = value;
                    await this.plugin.saveSettings();
                }));

        // Claudian Settings
        containerEl.createEl('h2', { text: t('settings.claudianIntegration') });

        new Setting(containerEl)
            .setName(t('settings.showClaudianButton'))
            .setDesc(t('settings.showClaudianButtonDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.claudian.showButton)
                .onChange(async (value) => {
                    this.plugin.settings.claudian.showButton = value;
                    await this.plugin.saveSettings();
                }));

        // Custom Prompts Settings
        containerEl.createEl('h2', { text: t('settings.customPrompts') });

        const promptsContainer = containerEl.createDiv({ cls: 'ai-workbench-custom-prompts' });
        this.renderCustomPrompts(promptsContainer);

        new Setting(containerEl)
            .setName(t('settings.addNewPrompt'))
            .setDesc(t('settings.addNewPromptDesc'))
            .addButton(btn => btn
                .setButtonText(t('common.create'))
                .onClick(() => {
                    const modal = new CustomPromptModal(this.app, async (prompt) => {
                        this.plugin.getCustomPromptsService().add(prompt);
                        await this.plugin.saveSettings();
                        this.plugin.refreshCustomPromptCommands();
                        this.display();
                    });
                    modal.open();
                }))
            .addButton(btn => btn
                .setButtonText(t('settings.importPreset'))
                .setCta()
                .onClick(() => {
                    this.plugin['showPresetImportModal']();
                }));

        // Import/Export
        new Setting(containerEl)
            .setName(t('settings.importExport'))
            .addButton(btn => btn
                .setButtonText(t('settings.exportPrompts'))
                .onClick(() => {
                    const data = this.plugin.getCustomPromptsService().export();
                    const json = JSON.stringify(data, null, 2);
                    navigator.clipboard.writeText(json);
                    new Notice(t('notices.copiedToClipboard'));
                }))
            .addButton(btn => btn
                .setButtonText(t('settings.importPrompts'))
                .onClick(() => {
                    const modal = new ImportPromptsModal(this.app, async (json) => {
                        try {
                            const data = JSON.parse(json);
                            const count = this.plugin.getCustomPromptsService().import(data);
                            await this.plugin.saveSettings();
                            this.plugin.refreshCustomPromptCommands();
                            this.display();
                            new Notice(t('notices.importSuccess', { count }));
                        } catch (e) {
                            new Notice(t('notices.importFailed'));
                        }
                    });
                    modal.open();
                }));

        // Keyboard Shortcuts
        containerEl.createEl('h2', { text: t('settings.shortcuts') });

        new Setting(containerEl)
            .setName(t('settings.enableShortcuts'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shortcuts.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.shortcuts.enabled = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshShortcuts();
                }));

        const shortcutsContainer = containerEl.createDiv({ cls: 'ai-workbench-shortcuts' });
        this.renderShortcuts(shortcutsContainer);

        new Setting(containerEl)
            .setName(t('settings.addShortcut'))
            .addButton(btn => btn
                .setButtonText(t('common.create'))
                .onClick(() => {
                    const modal = new ShortcutModal(
                        this.app,
                        this.plugin.getCustomPromptsService().getAll(),
                        async (binding) => {
                            this.plugin.getShortcutsService().addBinding(binding);
                            await this.plugin.saveSettings();
                            this.plugin.refreshShortcuts();
                            this.display();
                        }
                    );
                    modal.open();
                }));

        // Context Menu Settings
        containerEl.createEl('h2', { text: t('settings.contextMenu') });

        new Setting(containerEl)
            .setName(t('settings.enableContextMenu'))
            .setDesc(t('settings.enableContextMenuDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenu.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenu.enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.showBuiltInActions'))
            .setDesc(t('settings.showBuiltInActionsDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenu.showBuiltInActions)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenu.showBuiltInActions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.showCustomPrompts'))
            .setDesc(t('settings.showCustomPromptsDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenu.showCustomPrompts)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenu.showCustomPrompts = value;
                    await this.plugin.saveSettings();
                }));

        // Publishing platform settings
        containerEl.createEl('h2', { text: t('settings.publishingPlatforms') });
        new PublishingSettingsRenderer(this.app, this.plugin, containerEl).render();

        // UI Settings
        containerEl.createEl('h2', { text: t('settings.uiSettings') });

        new Setting(containerEl)
            .setName(t('settings.showStatusBar'))
            .setDesc(t('settings.showStatusBarDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ui.showStatusBar)
                .onChange(async (value) => {
                    this.plugin.settings.ui.showStatusBar = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settings.confirmBeforeReplace'))
            .setDesc(t('settings.confirmBeforeReplaceDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ui.confirmBeforeReplace)
                .onChange(async (value) => {
                    this.plugin.settings.ui.confirmBeforeReplace = value;
                    await this.plugin.saveSettings();
                }));

        // Backup Management
        containerEl.createEl('h2', { text: t('settings.backupManagement') });

        new Setting(containerEl)
            .setName(t('settings.manageBackups'))
            .setDesc(t('settings.manageBackupsDesc'))
            .addButton(btn => btn
                .setButtonText(t('settings.manageBackups'))
                .onClick(() => {
                    this.plugin.getBackupManager().showBackupModal();
                }));

        new Setting(containerEl)
            .setName(t('settings.clearAllBackups'))
            .addButton(btn => btn
                .setButtonText(t('settings.clearConfirm'))
                .setWarning()
                .onClick(async () => {
                    const count = await this.plugin.getBackupManager().clearAll();
                    new Notice(t('notices.backupCleared', { count }));
                }));
    }

    private renderCustomPrompts(container: HTMLElement) {
        container.empty();
        const prompts = this.plugin.getCustomPromptsService().getAll();

        if (prompts.length === 0) {
            container.createEl('p', { text: t('settings.noPrompts'), cls: 'muted' });
            return;
        }

        for (const prompt of prompts) {
            const item = container.createDiv({ cls: 'ai-workbench-custom-prompt-item' });

            const info = item.createDiv({ cls: 'prompt-info' });
            info.createEl('strong', { text: prompt.name });
            if (prompt.description) {
                info.createEl('p', { text: prompt.description, cls: 'prompt-desc' });
            }

            const actions = item.createDiv({ cls: 'prompt-actions' });

            actions.createEl('button', { text: t('common.edit') }, btn => {
                btn.addEventListener('click', () => {
                    const modal = new CustomPromptModal(this.app, async (updated) => {
                        this.plugin.getCustomPromptsService().update(prompt.id, updated);
                        await this.plugin.saveSettings();
                        this.display();
                    }, prompt);
                    modal.open();
                });
            });

            actions.createEl('button', { text: t('common.delete'), cls: 'mod-warning' }, btn => {
                btn.addEventListener('click', async () => {
                    this.plugin.getCustomPromptsService().delete(prompt.id);
                    await this.plugin.saveSettings();
                    this.plugin.refreshCustomPromptCommands();
                    this.display();
                });
            });
        }
    }

    private renderShortcuts(container: HTMLElement) {
        container.empty();
        const bindings = this.plugin.settings.shortcuts.bindings;

        if (bindings.length === 0) {
            container.createEl('p', { text: t('settings.noShortcuts'), cls: 'muted' });
            return;
        }

        for (let i = 0; i < bindings.length; i++) {
            const binding = bindings[i];
            const item = container.createDiv({ cls: 'ai-workbench-shortcut-item' });

            const display = this.plugin.getShortcutsService().getBindingDisplay(binding);
            const actionName = this.plugin.getActionDisplayName(binding.actionId, binding.customPromptId);

            item.createEl('kbd', { text: display, cls: 'shortcut-key' });
            item.createEl('span', { text: '→ ' + actionName, cls: 'shortcut-action' });

            const deleteBtn = item.createEl('button', { text: '×', cls: 'shortcut-delete' });
            deleteBtn.addEventListener('click', async () => {
                this.plugin.getShortcutsService().removeBinding(i);
                await this.plugin.saveSettings();
                this.plugin.refreshShortcuts();
                this.display();
            });
        }
    }

    /**
     * Mask API key for display (show first N and last N characters)
     */
    private maskApiKey(key: string): string {
        if (!key || key.length < API_KEY_MASK_LENGTH * 3) return key;
        return key.substring(0, API_KEY_MASK_LENGTH) + '...' + key.substring(key.length - API_KEY_MASK_LENGTH);
    }

    /**
     * Validate API key format
     */
    private validateApiKey(key: string): boolean {
        // Common API key formats:
        // OpenAI: sk-... (starts with sk-)
        // Anthropic: sk-ant-... (starts with sk-ant-)
        // Other providers may have different formats
        // At minimum, key should meet the minimum length requirement and contain only alphanumeric and hyphens
        if (key.length < MIN_API_KEY_LENGTH) return false;

        // Allow alphanumeric, hyphens, and underscores
        return /^[a-zA-Z0-9\-_]+$/.test(key);
    }

    /**
     * Validate API endpoint URL
     */
    private validateEndpoint(endpoint: string): boolean {
        try {
            const url = new URL(endpoint);
            // Only allow HTTPS (production) or HTTP (localhost)
            return url.protocol === 'https:' ||
                   (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
        } catch {
            return false;
        }
    }
}

/**
 * Custom Prompt Edit Modal
 */
class CustomPromptModal extends Modal {
    private onSave: (prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
    private existingPrompt?: CustomPrompt;

    private name: string = '';
    private description: string = '';
    private prompt: string = '';
    private outputMode: 'append' | 'prepend' | 'newFile' | 'replace' | 'selection' = 'append';

    constructor(
        app: App,
        onSave: (prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>) => void,
        existingPrompt?: CustomPrompt
    ) {
        super(app);
        this.onSave = onSave;
        this.existingPrompt = existingPrompt;

        if (existingPrompt) {
            this.name = existingPrompt.name;
            this.description = existingPrompt.description;
            this.prompt = existingPrompt.prompt;
            this.outputMode = existingPrompt.outputMode;
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-modal');

        contentEl.createEl('h3', { text: this.existingPrompt ? t('settings.editPrompt') : t('settings.newPrompt') });

        new Setting(contentEl)
            .setName(t('settings.promptName'))
            .setDesc(t('settings.promptNameDesc'))
            .addText(text => text
                .setPlaceholder(t('settings.promptNameDesc'))
                .setValue(this.name)
                .onChange(value => this.name = value));

        new Setting(contentEl)
            .setName(t('settings.promptDescription'))
            .setDesc(t('settings.promptDescriptionDesc'))
            .addText(text => text
                .setPlaceholder(t('common.optional'))
                .setValue(this.description)
                .onChange(value => this.description = value));

        new Setting(contentEl)
            .setName(t('settings.promptTemplate'))
            .setDesc(t('settings.promptTemplateDesc'))
            .addTextArea(text => text
                .setPlaceholder('请帮我...')
                .setValue(this.prompt)
                .onChange(value => this.prompt = value));

        new Setting(contentEl)
            .setName(t('settings.outputMode'))
            .addDropdown(dropdown => dropdown
                .addOption('append', t('settings.outputModeAppend'))
                .addOption('prepend', t('settings.outputModePrepend'))
                .addOption('newFile', t('settings.outputModeNewFile'))
                .addOption('replace', t('settings.outputModeReplace'))
                .addOption('selection', t('settings.outputModeSelection'))
                .setValue(this.outputMode)
                .onChange(value => this.outputMode = value as any));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t('common.cancel'))
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText(t('common.save'))
                .setCta()
                .onClick(() => {
                    if (!this.name.trim()) {
                        new Notice(t('validation.nameRequired'));
                        return;
                    }
                    if (!this.prompt.trim()) {
                        new Notice(t('validation.promptRequired'));
                        return;
                    }
                    this.onSave({
                        name: this.name.trim(),
                        description: this.description.trim(),
                        prompt: this.prompt.trim(),
                        outputMode: this.outputMode
                    });
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Shortcut Edit Modal
 */
class ShortcutModal extends Modal {
    private onSave: (binding: ShortcutBinding) => void;
    private customPrompts: any[];

    private actionId: string = 'summarize';
    private customPromptId: string = '';
    private key: string = '';
    private modifiers: ('Ctrl' | 'Alt' | 'Shift')[] = ['Ctrl', 'Alt'];

    constructor(
        app: App,
        customPrompts: any[],
        onSave: (binding: ShortcutBinding) => void
    ) {
        super(app);
        this.customPrompts = customPrompts;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-modal');

        contentEl.createEl('h3', { text: t('settings.newShortcut') });

        new Setting(contentEl)
            .setName(t('settings.action'))
            .addDropdown(dropdown => {
                dropdown.addOption('summarize', t('actions.summarize'));
                dropdown.addOption('outline', t('actions.outline'));
                dropdown.addOption('translate', t('actions.translate'));
                dropdown.addOption('format', t('actions.format'));
                dropdown.addOption('mindmap', t('actions.mindmap'));
                dropdown.addOption('mermaid', t('actions.mermaid'));
                dropdown.addOption('wechat-insert-images', t('actions.wechatInsertImages'));

                for (const prompt of this.customPrompts) {
                    dropdown.addOption(`custom:${prompt.id}`, `${t('actions.custom')}: ${prompt.name}`);
                }

                dropdown.onChange(value => {
                    if (value.startsWith('custom:')) {
                        this.actionId = 'custom';
                        this.customPromptId = value.replace('custom:', '');
                    } else {
                        this.actionId = value;
                        this.customPromptId = '';
                    }
                });
            });

        new Setting(contentEl)
            .setName(t('settings.key'))
            .setDesc(t('settings.keyDesc'))
            .addText(text => text
                .setPlaceholder('S')
                .setValue(this.key)
                .onChange(value => this.key = value.toUpperCase()));

        new Setting(contentEl)
            .setName(t('settings.modifiers'))
            .setDesc(t('settings.modifiersDesc'))
            .addToggle(toggle => toggle
                .setTooltip('Ctrl / ⌘')
                .setValue(this.modifiers.includes('Ctrl'))
                .onChange(value => {
                    if (value) {
                        if (!this.modifiers.includes('Ctrl')) this.modifiers.push('Ctrl');
                    } else {
                        this.modifiers = this.modifiers.filter(m => m !== 'Ctrl');
                    }
                }))
            .addToggle(toggle => toggle
                .setTooltip('Alt / ⌥')
                .setValue(this.modifiers.includes('Alt'))
                .onChange(value => {
                    if (value) {
                        if (!this.modifiers.includes('Alt')) this.modifiers.push('Alt');
                    } else {
                        this.modifiers = this.modifiers.filter(m => m !== 'Alt');
                    }
                }))
            .addToggle(toggle => toggle
                .setTooltip('Shift / ⇧')
                .setValue(this.modifiers.includes('Shift'))
                .onChange(value => {
                    if (value) {
                        if (!this.modifiers.includes('Shift')) this.modifiers.push('Shift');
                    } else {
                        this.modifiers = this.modifiers.filter(m => m !== 'Shift');
                    }
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t('common.cancel'))
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText(t('common.save'))
                .setCta()
                .onClick(() => {
                    if (!this.key) {
                        new Notice(t('validation.keyRequired'));
                        return;
                    }
                    this.onSave({
                        actionId: this.actionId,
                        customPromptId: this.customPromptId || undefined,
                        key: this.key,
                        modifiers: this.modifiers
                    });
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Import Prompts Modal
 */
class ImportPromptsModal extends Modal {
    private onImport: (json: string) => void;
    private json: string = '';

    constructor(app: App, onImport: (json: string) => void) {
        super(app);
        this.onImport = onImport;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-modal');

        contentEl.createEl('h3', { text: t('settings.importPrompts') });

        new Setting(contentEl)
            .setName('JSON')
            .setDesc(t('validation.jsonDataRequired'))
            .addTextArea(text => text
                .setPlaceholder('[{...}]')
                .setValue(this.json)
                .onChange(value => this.json = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t('common.cancel'))
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText(t('common.import'))
                .setCta()
                .onClick(() => {
                    if (!this.json.trim()) {
                        new Notice(t('validation.jsonDataRequired'));
                        return;
                    }
                    this.onImport(this.json);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
