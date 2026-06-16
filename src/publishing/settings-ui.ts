import { App, Modal, Notice, Setting } from 'obsidian';
import type AIWorkbenchPlugin from '../../main';
import {
    ConnectionType,
    PlatformSettings,
    PublishingPlatform,
    PUBLISHING_PLATFORMS
} from './types';
import { t } from '../i18n';

function getPlatformLabel(platform: PublishingPlatform): string {
    const keys: Record<PublishingPlatform, string> = {
        wechat: 'platforms.wechat',
        xiaohongshu: 'platforms.xiaohongshu',
        wechatChannels: 'platforms.wechatChannels',
        douyin: 'platforms.douyin',
        x: 'platforms.x',
        youtube: 'platforms.youtube'
    };
    return t(keys[platform]);
}

const OFFICIAL_FIELDS: Partial<Record<PublishingPlatform, Array<{
    key: string;
    label: string;
    secret?: boolean;
}>>> = {
    wechat: [
        { key: 'appId', label: 'AppID' },
        { key: 'appSecret', label: 'AppSecret', secret: true },
        { key: 'author', label: '默认作者' }
    ],
    youtube: [
        { key: 'clientId', label: 'Client ID' },
        { key: 'clientSecret', label: 'Client Secret', secret: true },
        { key: 'refreshToken', label: 'Refresh Token', secret: true },
        { key: 'channelId', label: 'Channel ID' }
    ]
};

export class PublishingSettingsRenderer {
    private wrapper: HTMLElement | null = null;

    constructor(
        private app: App,
        private plugin: AIWorkbenchPlugin,
        private container: HTMLElement
    ) {}

    render(): void {
        if (!this.wrapper) {
            this.wrapper = this.container.createDiv({ cls: 'ai-workbench-platform-settings' });
        }
        const wrapper = this.wrapper;
        wrapper.empty();
        wrapper.createEl('p', {
            text: t('settings.platformCredentials'),
            cls: 'setting-item-description'
        });

        new Setting(wrapper)
            .setName(t('settings.requestTimeout'))
            .setDesc(t('settings.requestTimeoutDesc'))
            .addSlider(slider => slider
                .setLimits(10, 300, 10)
                .setDynamicTooltip()
                .setValue(this.plugin.settings.publishing.requestTimeout)
                .onChange(async value => {
                    this.plugin.settings.publishing.requestTimeout = value;
                    await this.plugin.saveSettings();
                }));

        for (const platform of PUBLISHING_PLATFORMS) {
            this.renderPlatformRow(wrapper, platform);
        }
    }

    private renderPlatformRow(container: HTMLElement, platform: PublishingPlatform): void {
        const platformSettings = this.plugin.settings.publishing.platforms[platform];
        const setting = new Setting(container)
            .setClass('ai-workbench-platform-setting-row')
            .setName(getPlatformLabel(platform))
            .setDesc(this.statusText(platform, platformSettings));

        setting.addToggle(toggle => toggle
            .setTooltip(t('settings.enablePlatform'))
            .setValue(platformSettings.enabled)
            .onChange(async value => {
                platformSettings.enabled = value;
                await this.plugin.saveSettings();
                this.refresh();
            }));

        setting.addDropdown(dropdown => dropdown
            .addOption('official', t('settings.officialApi'))
            .addOption('webhook', t('settings.webhook'))
            .setValue(platformSettings.connectionType)
            .onChange(async value => {
                platformSettings.connectionType = value as ConnectionType;
                await this.plugin.saveSettings();
                this.refresh();
            }));

        setting.addButton(button => button
            .setButtonText(t('common.configure'))
            .onClick(() => {
                new PlatformConfigModal(this.app, this.plugin, platform, () => this.refresh()).open();
            }));

        setting.addButton(button => button
            .setButtonText(t('common.testConnection'))
            .onClick(async () => {
                button.setDisabled(true);
                const result = await this.plugin.getPublishingService().testConnection(platform);
                button.setDisabled(false);
                new Notice(t('notices.connectionTestSuccess', { platform: getPlatformLabel(platform) }));
                this.refresh();
            }));
    }

    private statusText(platform: PublishingPlatform, settings: PlatformSettings): string {
        if (!settings.enabled) return t('settings.platformNotConfigured');
        if (settings.connectionType === 'webhook') {
            return settings.webhook.url ? t('settings.webhookConfigured') : t('settings.webhookPending');
        }
        if (!OFFICIAL_FIELDS[platform]) return t('settings.useWebhook');
        const configured = OFFICIAL_FIELDS[platform]!
            .filter(field => field.secret || field.key !== 'author' && field.key !== 'channelId')
            .every(field => Boolean(settings.official[field.key]));
        return configured ? t('settings.officialApiConfigured') : t('settings.officialApiPending');
    }

    private refresh(): void {
        this.render();
    }
}

class PlatformConfigModal extends Modal {
    private draft: PlatformSettings;
    private defaultSelected: boolean;

    constructor(
        app: App,
        private plugin: AIWorkbenchPlugin,
        private platform: PublishingPlatform,
        private onSaved: () => void
    ) {
        super(app);
        this.draft = JSON.parse(JSON.stringify(plugin.settings.publishing.platforms[platform]));
        this.defaultSelected = plugin.settings.publishing.defaultPlatforms.includes(platform);
    }

    onOpen(): void {
        this.render();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private render(): void {
        this.contentEl.empty();
        this.contentEl.addClass('ai-workbench-platform-config-modal');
        this.contentEl.createEl('h3', { text: `${getPlatformLabel(this.platform)} ${t('settings.platformSettings')}` });

        new Setting(this.contentEl)
            .setName(t('settings.enablePlatform'))
            .addToggle(toggle => toggle
                .setValue(this.draft.enabled)
                .onChange(value => this.draft.enabled = value));

        new Setting(this.contentEl)
            .setName(t('settings.connectionType'))
            .addDropdown(dropdown => dropdown
                .addOption('official', t('settings.officialApi'))
                .addOption('webhook', t('settings.webhook'))
                .setValue(this.draft.connectionType)
                .onChange(value => {
                    this.draft.connectionType = value as ConnectionType;
                    this.render();
                }));

        new Setting(this.contentEl)
            .setName(t('settings.defaultSelected'))
            .setDesc(t('settings.defaultSelectedDesc'))
            .addToggle(toggle => toggle
                .setValue(this.defaultSelected)
                .onChange(value => this.defaultSelected = value));

        const fields = this.contentEl.createDiv({ cls: 'ai-workbench-platform-fields' });
        if (this.draft.connectionType === 'official') {
            this.renderOfficialFields(fields);
        } else {
            this.renderWebhookFields(fields);
        }

        new Setting(this.contentEl)
            .addButton(button => button
                .setButtonText(t('common.cancel'))
                .onClick(() => this.close()))
            .addButton(button => button
                .setButtonText(t('common.save'))
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.publishing.platforms[this.platform] = this.draft;
                    this.plugin.settings.publishing.defaultPlatforms = this.defaultSelected
                        ? uniquePlatforms([
                            ...this.plugin.settings.publishing.defaultPlatforms,
                            this.platform
                        ])
                        : this.plugin.settings.publishing.defaultPlatforms
                            .filter(platform => platform !== this.platform);
                    await this.plugin.saveSettings();
                    this.onSaved();
                    this.close();
                }));
    }

    private renderOfficialFields(container: HTMLElement): void {
        const fields = OFFICIAL_FIELDS[this.platform];
        if (!fields) {
            container.createEl('p', {
                text: `${getPlatformLabel(this.platform)} ${t('settings.noOfficialApi')}`,
                cls: 'ai-workbench-platform-status'
            });
            return;
        }

        for (const field of fields) {
            new Setting(container)
                .setName(field.label)
                .addText(text => {
                    text.setValue(this.draft.official[field.key] || '')
                        .onChange(value => this.draft.official[field.key] = value.trim());
                    if (field.secret) text.inputEl.type = 'password';
                });
        }
    }

    private renderWebhookFields(container: HTMLElement): void {
        new Setting(container)
            .setName(t('settings.webhookUrl'))
            .setDesc(t('settings.webhookUrlDesc'))
            .addText(text => text
                .setPlaceholder('https://relay.example.com/draft')
                .setValue(this.draft.webhook.url)
                .onChange(value => this.draft.webhook.url = value.trim()));

        new Setting(container)
            .setName(t('settings.mediaUploadUrl'))
            .setDesc(t('settings.mediaUploadUrlDesc'))
            .addText(text => text
                .setPlaceholder('https://relay.example.com/media')
                .setValue(this.draft.webhook.mediaUploadUrl)
                .onChange(value => this.draft.webhook.mediaUploadUrl = value.trim()));

        new Setting(container)
            .setName(t('settings.authType'))
            .addDropdown(dropdown => dropdown
                .addOption('none', t('settings.authTypeNone'))
                .addOption('bearer', t('settings.authTypeBearer'))
                .addOption('headers', t('settings.authTypeHeaders'))
                .setValue(this.draft.webhook.authType)
                .onChange(value => {
                    this.draft.webhook.authType = value as PlatformSettings['webhook']['authType'];
                    this.render();
                }));

        if (this.draft.webhook.authType === 'bearer') {
            new Setting(container)
                .setName(t('settings.bearerToken'))
                .addText(text => {
                    text.setValue(this.draft.webhook.token)
                        .onChange(value => this.draft.webhook.token = value);
                    text.inputEl.type = 'password';
                });
        }

        if (this.draft.webhook.authType === 'headers') {
            new Setting(container)
                .setName(t('settings.customHeadersJson'))
                .setDesc(t('settings.customHeadersDesc'))
                .addTextArea(text => text
                    .setValue(JSON.stringify(this.draft.webhook.headers, null, 2))
                    .onChange(value => {
                        try {
                            const parsed = JSON.parse(value);
                            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                this.draft.webhook.headers = parsed;
                            }
                        } catch {
                            // Keep the last valid value until the user fixes the JSON.
                        }
                    }));
        }

        new Setting(container)
            .setName(t('settings.signingSecret'))
            .setDesc(t('settings.signingSecretDesc'))
            .addText(text => {
                text.setValue(this.draft.webhook.signingSecret)
                    .onChange(value => this.draft.webhook.signingSecret = value);
                text.inputEl.type = 'password';
            });
    }
}

function uniquePlatforms(platforms: PublishingPlatform[]): PublishingPlatform[] {
    return platforms.filter((platform, index) => platforms.indexOf(platform) === index);
}
