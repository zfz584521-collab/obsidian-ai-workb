import { App, Modal, Notice, Setting } from 'obsidian';
import type AIWorkbenchPlugin from '../../main';
import {
    ConnectionType,
    PlatformSettings,
    PublishingPlatform,
    PUBLISHING_PLATFORMS
} from './types';

const PLATFORM_LABELS: Record<PublishingPlatform, string> = {
    wechat: '微信公众号',
    xiaohongshu: '小红书',
    wechatChannels: '视频号',
    douyin: '抖音',
    x: 'X',
    youtube: 'YouTube'
};

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
            text: '平台凭据保存在本地插件数据中，但不等同于加密存储。',
            cls: 'setting-item-description'
        });

        new Setting(wrapper)
            .setName('发布请求超时')
            .setDesc('平台 API 与 Webhook 请求的超时时间（秒）')
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
            .setName(PLATFORM_LABELS[platform])
            .setDesc(this.statusText(platform, platformSettings));

        setting.addToggle(toggle => toggle
            .setTooltip('启用平台')
            .setValue(platformSettings.enabled)
            .onChange(async value => {
                platformSettings.enabled = value;
                await this.plugin.saveSettings();
                this.refresh();
            }));

        setting.addDropdown(dropdown => dropdown
            .addOption('official', '官方 API')
            .addOption('webhook', 'Webhook')
            .setValue(platformSettings.connectionType)
            .onChange(async value => {
                platformSettings.connectionType = value as ConnectionType;
                await this.plugin.saveSettings();
                this.refresh();
            }));

        setting.addButton(button => button
            .setButtonText('配置')
            .onClick(() => {
                new PlatformConfigModal(this.app, this.plugin, platform, () => this.refresh()).open();
            }));

        setting.addButton(button => button
            .setButtonText('测试连接')
            .onClick(async () => {
                button.setDisabled(true);
                const result = await this.plugin.getPublishingService().testConnection(platform);
                button.setDisabled(false);
                new Notice(`${PLATFORM_LABELS[platform]}：${result.message}`);
                this.refresh();
            }));
    }

    private statusText(platform: PublishingPlatform, settings: PlatformSettings): string {
        if (!settings.enabled) return '未启用';
        if (settings.connectionType === 'webhook') {
            return settings.webhook.url ? 'Webhook 已配置' : 'Webhook 待配置';
        }
        if (!OFFICIAL_FIELDS[platform]) return '当前需使用 Webhook';
        const configured = OFFICIAL_FIELDS[platform]!
            .filter(field => field.secret || field.key !== 'author' && field.key !== 'channelId')
            .every(field => Boolean(settings.official[field.key]));
        return configured ? '官方 API 已配置' : '官方 API 待配置';
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
        this.contentEl.createEl('h3', { text: `${PLATFORM_LABELS[this.platform]}设置` });

        new Setting(this.contentEl)
            .setName('启用平台')
            .addToggle(toggle => toggle
                .setValue(this.draft.enabled)
                .onChange(value => this.draft.enabled = value));

        new Setting(this.contentEl)
            .setName('接入方式')
            .addDropdown(dropdown => dropdown
                .addOption('official', '官方 API')
                .addOption('webhook', 'Webhook')
                .setValue(this.draft.connectionType)
                .onChange(value => {
                    this.draft.connectionType = value as ConnectionType;
                    this.render();
                }));

        new Setting(this.contentEl)
            .setName('工作台默认选中')
            .setDesc('打开工作台时默认勾选此平台')
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
                .setButtonText('取消')
                .onClick(() => this.close()))
            .addButton(button => button
                .setButtonText('保存')
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
                text: `${PLATFORM_LABELS[this.platform]}当前不提供本插件可用的草稿接口，请改用 Webhook。`,
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
            .setName('Webhook URL')
            .setDesc('必须使用 HTTPS；localhost 可使用 HTTP')
            .addText(text => text
                .setPlaceholder('https://relay.example.com/draft')
                .setValue(this.draft.webhook.url)
                .onChange(value => this.draft.webhook.url = value.trim()));

        new Setting(container)
            .setName('媒体上传 URL')
            .setDesc('发布本地图片或视频时必填')
            .addText(text => text
                .setPlaceholder('https://relay.example.com/media')
                .setValue(this.draft.webhook.mediaUploadUrl)
                .onChange(value => this.draft.webhook.mediaUploadUrl = value.trim()));

        new Setting(container)
            .setName('认证方式')
            .addDropdown(dropdown => dropdown
                .addOption('none', '无')
                .addOption('bearer', 'Bearer Token')
                .addOption('headers', '自定义请求头')
                .setValue(this.draft.webhook.authType)
                .onChange(value => {
                    this.draft.webhook.authType = value as PlatformSettings['webhook']['authType'];
                    this.render();
                }));

        if (this.draft.webhook.authType === 'bearer') {
            new Setting(container)
                .setName('Bearer Token')
                .addText(text => {
                    text.setValue(this.draft.webhook.token)
                        .onChange(value => this.draft.webhook.token = value);
                    text.inputEl.type = 'password';
                });
        }

        if (this.draft.webhook.authType === 'headers') {
            new Setting(container)
                .setName('自定义请求头 JSON')
                .setDesc('例如 {"X-API-Key":"value"}')
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
            .setName('签名密钥')
            .setDesc('用于 HMAC-SHA256 请求签名，可留空')
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
