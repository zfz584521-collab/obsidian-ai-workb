/**
 * Settings Tab - Plugin settings UI
 */

import { App, PluginSettingTab, Setting, Modal, Notice, debounce } from 'obsidian';
import type AIWorkbenchPlugin from '../main';
import { WorkbenchSettings, CustomPrompt, ShortcutBinding } from './types';
import { SETTINGS_DEBOUNCE_MS, MIN_API_KEY_LENGTH, API_KEY_MASK_LENGTH } from './constants';

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

        // API Settings
        containerEl.createEl('h2', { text: 'API 配置' });

        new Setting(containerEl)
            .setName('API 端点')
            .setDesc('支持 OpenAI 兼容的 API 端点（必须是有效的 HTTPS URL）')
            .addText(text => text
                .setPlaceholder('https://api.openai.com/v1')
                .setValue(this.plugin.settings.api.endpoint)
                .onChange(debounce(async (value: string) => {
                    // 验证endpoint格式
                    if (value && !this.validateEndpoint(value)) {
                        new Notice('API 端点必须是有效的 HTTPS URL（本地测试可使用 HTTP）');
                        return;
                    }

                    this.plugin.settings.api.endpoint = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('你的 API 密钥（已加密存储）')
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
                        new Notice('API Key 格式不正确');
                        return;
                    }

                    this.plugin.settings.api.apiKey = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName('模型')
            .setDesc('使用的模型名称')
            .addText(text => text
                .setPlaceholder('gpt-4o-mini')
                .setValue(this.plugin.settings.api.model)
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.api.model = value;
                    await this.plugin.saveSettings();
                }, SETTINGS_DEBOUNCE_MS)));

        new Setting(containerEl)
            .setName('超时时间')
            .setDesc('请求超时时间（秒）')
            .addSlider(slider => slider
                .setLimits(10, 300, 10)
                .setValue(this.plugin.settings.api.timeout)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.api.timeout = value;
                    await this.plugin.saveSettings();
                }));

        // Output Settings
        containerEl.createEl('h2', { text: '输出设置' });

        new Setting(containerEl)
            .setName('总结位置')
            .setDesc('AI 生成的总结添加到笔记的位置')
            .addDropdown(dropdown => dropdown
                .addOption('append', '追加到末尾')
                .addOption('prepend', '插入到开头')
                .addOption('newFile', '新建文件')
                .setValue(this.plugin.settings.output.summaryPosition)
                .onChange(async (value: 'append' | 'prepend' | 'newFile') => {
                    this.plugin.settings.output.summaryPosition = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('输出语言')
            .setDesc('翻译等功能的默认语言')
            .addDropdown(dropdown => dropdown
                .addOption('auto', '自动检测')
                .addOption('zh', '中文')
                .addOption('en', '英文')
                .setValue(this.plugin.settings.output.language)
                .onChange(async (value: 'auto' | 'zh' | 'en') => {
                    this.plugin.settings.output.language = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('添加时间戳')
            .setDesc('在 AI 生成的内容前添加时间戳')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.output.includeTimestamp)
                .onChange(async (value) => {
                    this.plugin.settings.output.includeTimestamp = value;
                    await this.plugin.saveSettings();
                }));

        // Backup Settings
        containerEl.createEl('h2', { text: '备份设置' });

        new Setting(containerEl)
            .setName('启用备份')
            .setDesc('修改笔记前自动备份')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.backup.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.backup.enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('最大备份数')
            .setDesc('每个文件保留的最大备份数量')
            .addSlider(slider => slider
                .setLimits(1, 50, 1)
                .setValue(this.plugin.settings.backup.maxCount)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.backup.maxCount = value;
                    await this.plugin.saveSettings();
                }));

        // Claudian Settings
        containerEl.createEl('h2', { text: 'Claudian 集成' });

        new Setting(containerEl)
            .setName('显示 Claudian 按钮')
            .setDesc('在侧边栏显示"发送到 Claudian"按钮')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.claudian.showButton)
                .onChange(async (value) => {
                    this.plugin.settings.claudian.showButton = value;
                    await this.plugin.saveSettings();
                }));

        // Custom Prompts Settings
        containerEl.createEl('h2', { text: '自定义 Prompt' });

        const promptsContainer = containerEl.createDiv({ cls: 'ai-workbench-custom-prompts' });
        this.renderCustomPrompts(promptsContainer);

        new Setting(containerEl)
            .setName('添加新 Prompt')
            .setDesc('创建自定义的 AI 处理动作')
            .addButton(btn => btn
                .setButtonText('新建')
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
                .setButtonText('导入预设')
                .setCta()
                .onClick(() => {
                    this.plugin['showPresetImportModal']();
                }));

        // Import/Export
        new Setting(containerEl)
            .setName('导入/导出')
            .addButton(btn => btn
                .setButtonText('导出 Prompts')
                .onClick(() => {
                    const data = this.plugin.getCustomPromptsService().export();
                    const json = JSON.stringify(data, null, 2);
                    navigator.clipboard.writeText(json);
                    new Notice('已复制到剪贴板');
                }))
            .addButton(btn => btn
                .setButtonText('导入 Prompts')
                .onClick(() => {
                    const modal = new ImportPromptsModal(this.app, async (json) => {
                        try {
                            const data = JSON.parse(json);
                            const count = this.plugin.getCustomPromptsService().import(data);
                            await this.plugin.saveSettings();
                            this.plugin.refreshCustomPromptCommands();
                            this.display();
                            new Notice(`成功导入 ${count} 个 Prompt`);
                        } catch (e) {
                            new Notice('导入失败：格式错误');
                        }
                    });
                    modal.open();
                }));

        // Keyboard Shortcuts
        containerEl.createEl('h2', { text: '快捷键' });

        new Setting(containerEl)
            .setName('启用快捷键')
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
            .setName('添加快捷键')
            .addButton(btn => btn
                .setButtonText('新建')
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
        containerEl.createEl('h2', { text: '右键菜单' });

        new Setting(containerEl)
            .setName('启用右键菜单')
            .setDesc('在编辑器右键菜单中显示 AI 操作')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenu.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenu.enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('显示内置动作')
            .setDesc('在右键菜单中显示总结、翻译等内置动作')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenu.showBuiltInActions)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenu.showBuiltInActions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('显示自定义 Prompt')
            .setDesc('在右键菜单中显示自定义 Prompt')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenu.showCustomPrompts)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenu.showCustomPrompts = value;
                    await this.plugin.saveSettings();
                }));

        // UI Settings
        containerEl.createEl('h2', { text: '界面设置' });

        new Setting(containerEl)
            .setName('显示状态栏')
            .setDesc('在底部状态栏显示 AI 状态')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ui.showStatusBar)
                .onChange(async (value) => {
                    this.plugin.settings.ui.showStatusBar = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('替换前确认')
            .setDesc('替换原文前弹出确认对话框')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ui.confirmBeforeReplace)
                .onChange(async (value) => {
                    this.plugin.settings.ui.confirmBeforeReplace = value;
                    await this.plugin.saveSettings();
                }));

        // Backup Management
        containerEl.createEl('h2', { text: '备份管理' });

        new Setting(containerEl)
            .setName('管理备份')
            .setDesc('查看、恢复或删除备份文件')
            .addButton(btn => btn
                .setButtonText('打开备份管理')
                .onClick(() => {
                    this.plugin.getBackupManager().showBackupModal();
                }));

        new Setting(containerEl)
            .setName('清空所有备份')
            .addButton(btn => btn
                .setButtonText('清空')
                .setWarning()
                .onClick(async () => {
                    const count = await this.plugin.getBackupManager().clearAll();
                    new Notice(`已删除 ${count} 个备份`);
                }));
    }

    private renderCustomPrompts(container: HTMLElement) {
        container.empty();
        const prompts = this.plugin.getCustomPromptsService().getAll();

        if (prompts.length === 0) {
            container.createEl('p', { text: '暂无自定义 Prompt，点击下方按钮创建', cls: 'muted' });
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

            actions.createEl('button', { text: '编辑' }, btn => {
                btn.addEventListener('click', () => {
                    const modal = new CustomPromptModal(this.app, async (updated) => {
                        this.plugin.getCustomPromptsService().update(prompt.id, updated);
                        await this.plugin.saveSettings();
                        this.display();
                    }, prompt);
                    modal.open();
                });
            });

            actions.createEl('button', { text: '删除', cls: 'mod-warning' }, btn => {
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
            container.createEl('p', { text: '暂无快捷键，点击下方按钮创建', cls: 'muted' });
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

        contentEl.createEl('h3', { text: this.existingPrompt ? '编辑 Prompt' : '新建 Prompt' });

        new Setting(contentEl)
            .setName('名称')
            .setDesc('显示在按钮上的名称')
            .addText(text => text
                .setPlaceholder('例如：润色文章')
                .setValue(this.name)
                .onChange(value => this.name = value));

        new Setting(contentEl)
            .setName('描述')
            .setDesc('简短描述这个动作的作用')
            .addText(text => text
                .setPlaceholder('可选')
                .setValue(this.description)
                .onChange(value => this.description = value));

        new Setting(contentEl)
            .setName('Prompt 模板')
            .setDesc('发送给 AI 的指令')
            .addTextArea(text => text
                .setPlaceholder('请帮我...')
                .setValue(this.prompt)
                .onChange(value => this.prompt = value));

        new Setting(contentEl)
            .setName('输出方式')
            .addDropdown(dropdown => dropdown
                .addOption('append', '追加到末尾')
                .addOption('prepend', '插入到开头')
                .addOption('newFile', '新建文件')
                .addOption('replace', '替换原文')
                .addOption('selection', '替换选中文字')
                .setValue(this.outputMode)
                .onChange(value => this.outputMode = value as any));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('保存')
                .setCta()
                .onClick(() => {
                    if (!this.name.trim()) {
                        new Notice('请输入名称');
                        return;
                    }
                    if (!this.prompt.trim()) {
                        new Notice('请输入 Prompt');
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

        contentEl.createEl('h3', { text: '新建快捷键' });

        new Setting(contentEl)
            .setName('动作')
            .addDropdown(dropdown => {
                dropdown.addOption('summarize', '总结');
                dropdown.addOption('outline', '大纲');
                dropdown.addOption('translate', '翻译');
                dropdown.addOption('format', '格式化');
                dropdown.addOption('mindmap', '思维导图');
                dropdown.addOption('mermaid', 'Mermaid 思维导图');

                for (const prompt of this.customPrompts) {
                    dropdown.addOption(`custom:${prompt.id}`, `自定义: ${prompt.name}`);
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
            .setName('按键')
            .setDesc('按下要绑定的键')
            .addText(text => text
                .setPlaceholder('例如：S')
                .setValue(this.key)
                .onChange(value => this.key = value.toUpperCase()));

        new Setting(contentEl)
            .setName('修饰键')
            .setDesc('选择需要按下的修饰键')
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
                .setButtonText('取消')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('保存')
                .setCta()
                .onClick(() => {
                    if (!this.key) {
                        new Notice('请输入按键');
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

        contentEl.createEl('h3', { text: '导入 Prompts' });

        new Setting(contentEl)
            .setName('JSON 数据')
            .setDesc('粘贴导出的 Prompts JSON')
            .addTextArea(text => text
                .setPlaceholder('[{...}]')
                .setValue(this.json)
                .onChange(value => this.json = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('导入')
                .setCta()
                .onClick(() => {
                    if (!this.json.trim()) {
                        new Notice('请粘贴 JSON 数据');
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
