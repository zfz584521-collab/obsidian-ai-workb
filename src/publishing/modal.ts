import {
    App,
    FuzzySuggestModal,
    Modal,
    Notice,
    Setting,
    TFile
} from 'obsidian';
import { applyPlatformOverride } from './content';
import { PublishingService, PublishTaskInput } from './service';
import {
    PlatformContentOverride,
    PublishContent,
    PublishMedia,
    PublishingPlatform,
    PublishTaskResult
} from './types';

const PLATFORM_LABELS: Record<PublishingPlatform, string> = {
    wechat: '微信公众号',
    xiaohongshu: '小红书',
    wechatChannels: '视频号',
    douyin: '抖音',
    x: 'X',
    youtube: 'YouTube'
};

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const VIDEO_EXTENSIONS = new Set(['avi', 'm4v', 'mkv', 'mov', 'mp4', 'webm']);

export class PublishModalState {
    constructor(
        public base: PublishContent,
        public platforms: PublishingPlatform[],
        public overrides: Partial<Record<PublishingPlatform, PlatformContentOverride>> = {}
    ) {}

    resolve(platform: PublishingPlatform): PublishContent {
        return applyPlatformOverride(this.base, this.overrides[platform]);
    }

    setOverride<K extends keyof PlatformContentOverride>(
        platform: PublishingPlatform,
        field: K,
        value: PlatformContentOverride[K]
    ): void {
        this.overrides[platform] = {
            ...this.overrides[platform],
            [field]: value
        };
    }

    clearOverride(
        platform: PublishingPlatform,
        field: keyof PlatformContentOverride
    ): void {
        const override = this.overrides[platform];
        if (!override) return;
        delete override[field];
        if (Object.keys(override).length === 0) {
            delete this.overrides[platform];
        }
    }

    hasOverride(
        platform: PublishingPlatform,
        field: keyof PlatformContentOverride
    ): boolean {
        return Object.prototype.hasOwnProperty.call(this.overrides[platform] || {}, field);
    }
}

export class PublishEditorModal extends Modal {
    private state: PublishModalState;
    private activePlatform: PublishingPlatform;
    private submitting = false;
    private lastResult: PublishTaskResult | null = null;

    constructor(
        app: App,
        content: PublishContent,
        platforms: PublishingPlatform[],
        private publishingService: PublishingService,
        private loadMedia?: (media: PublishMedia) => Promise<PublishMedia>
    ) {
        super(app);
        this.state = new PublishModalState(cloneContent(content), [...platforms]);
        this.activePlatform = platforms[0];
    }

    onOpen(): void {
        this.render();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private render(): void {
        this.contentEl.empty();
        this.contentEl.addClass('ai-workbench-publish-modal');
        this.contentEl.createEl('h2', { text: '发布到草稿箱' });
        this.contentEl.createEl('p', {
            text: `已选择 ${this.state.platforms.length} 个平台。提交只创建草稿或等价的非公开内容。`,
            cls: 'setting-item-description'
        });

        const layout = this.contentEl.createDiv({ cls: 'ai-workbench-publish-layout' });
        const editor = layout.createDiv({ cls: 'ai-workbench-publish-editor' });
        editor.createEl('h3', { text: '统一内容' });
        this.renderBaseEditor(editor);
        editor.createEl('h3', { text: '平台设置' });
        this.renderPlatformEditor(editor);

        const side = layout.createDiv({ cls: 'ai-workbench-publish-side' });
        this.renderMediaEditor(side, this.state.base, false);
        this.renderResults(side);
        this.renderActions();
    }

    private renderBaseEditor(container: HTMLElement): void {
        new Setting(container)
            .setName('标题')
            .addText(text => text
                .setValue(this.state.base.title)
                .onChange(value => this.state.base.title = value));

        new Setting(container)
            .setName('正文')
            .addTextArea(text => text
                .setValue(this.state.base.bodyMarkdown)
                .onChange(value => this.state.base.bodyMarkdown = value));

        new Setting(container)
            .setName('摘要')
            .addTextArea(text => text
                .setValue(this.state.base.summary || '')
                .onChange(value => this.state.base.summary = value));

        new Setting(container)
            .setName('标签')
            .setDesc('使用逗号分隔')
            .addText(text => text
                .setValue(this.state.base.tags.join(', '))
                .onChange(value => this.state.base.tags = parseTags(value)));
    }

    private renderPlatformEditor(container: HTMLElement): void {
        const tabs = container.createDiv({ cls: 'ai-workbench-publish-tabs' });
        for (const platform of this.state.platforms) {
            const tab = tabs.createEl('button', {
                text: PLATFORM_LABELS[platform],
                cls: platform === this.activePlatform ? 'is-active' : ''
            });
            tab.addEventListener('click', () => {
                this.activePlatform = platform;
                this.render();
            });
        }

        const panel = container.createDiv({ cls: 'ai-workbench-platform-override' });
        this.renderOverrideField(panel, 'title', '平台标题', false);
        this.renderOverrideField(panel, 'bodyMarkdown', '平台正文', true);
        this.renderOverrideField(panel, 'summary', '平台摘要', true);
        this.renderOverrideTags(panel);
        this.renderMediaOverride(panel);
    }

    private renderOverrideField(
        container: HTMLElement,
        field: 'title' | 'bodyMarkdown' | 'summary',
        label: string,
        textarea: boolean
    ): void {
        const platform = this.activePlatform;
        const enabled = this.state.hasOverride(platform, field);
        const resolved = this.state.resolve(platform);
        const setting = new Setting(container)
            .setName(label)
            .setDesc(enabled ? '已覆盖' : '继承统一内容')
            .addToggle(toggle => toggle
                .setValue(enabled)
                .onChange(value => {
                    if (value) {
                        this.state.setOverride(platform, field, resolved[field] || '');
                    } else {
                        this.state.clearOverride(platform, field);
                    }
                    this.render();
                }));

        if (textarea) {
            setting.addTextArea(text => {
                text.setValue(String(resolved[field] || ''))
                    .setDisabled(!enabled)
                    .onChange(value => this.state.setOverride(platform, field, value));
            });
        } else {
            setting.addText(text => text
                .setValue(String(resolved[field] || ''))
                .setDisabled(!enabled)
                .onChange(value => this.state.setOverride(platform, field, value)));
        }
    }

    private renderOverrideTags(container: HTMLElement): void {
        const platform = this.activePlatform;
        const enabled = this.state.hasOverride(platform, 'tags');
        const resolved = this.state.resolve(platform);
        new Setting(container)
            .setName('平台标签')
            .setDesc(enabled ? '已覆盖' : '继承统一内容')
            .addToggle(toggle => toggle
                .setValue(enabled)
                .onChange(value => {
                    if (value) {
                        this.state.setOverride(platform, 'tags', [...resolved.tags]);
                    } else {
                        this.state.clearOverride(platform, 'tags');
                    }
                    this.render();
                }))
            .addText(text => text
                .setValue(resolved.tags.join(', '))
                .setDisabled(!enabled)
                .onChange(value => this.state.setOverride(platform, 'tags', parseTags(value))));
    }

    private renderMediaOverride(container: HTMLElement): void {
        const platform = this.activePlatform;
        const overridden = this.state.hasOverride(platform, 'images') ||
            this.state.hasOverride(platform, 'cover') ||
            this.state.hasOverride(platform, 'video');
        new Setting(container)
            .setName('平台媒体')
            .setDesc(overridden ? '已覆盖' : '继承统一内容')
            .addToggle(toggle => toggle
                .setValue(overridden)
                .onChange(value => {
                    if (value) {
                        const resolved = this.state.resolve(platform);
                        this.state.setOverride(platform, 'images', [...resolved.images]);
                        this.state.setOverride(platform, 'cover', resolved.cover ?? null);
                        this.state.setOverride(platform, 'video', resolved.video ?? null);
                    } else {
                        this.state.clearOverride(platform, 'images');
                        this.state.clearOverride(platform, 'cover');
                        this.state.clearOverride(platform, 'video');
                    }
                    this.render();
                }));

        if (overridden) {
            const mediaContainer = container.createDiv({ cls: 'ai-workbench-override-media' });
            this.renderMediaEditor(mediaContainer, this.state.resolve(platform), true);
        }
    }

    private renderMediaEditor(
        container: HTMLElement,
        content: PublishContent,
        platformOverride: boolean
    ): void {
        container.createEl('h3', { text: platformOverride ? '平台媒体' : '封面与媒体' });
        const list = container.createDiv({ cls: 'ai-workbench-media-list' });
        if (content.images.length === 0 && !content.video) {
            list.createEl('p', { text: '暂无媒体', cls: 'setting-item-description' });
        }

        content.images.forEach((image, index) => {
            const row = list.createDiv({ cls: 'ai-workbench-media-row' });
            row.createEl('span', {
                text: `${content.cover?.path === image.path ? '封面 · ' : ''}${image.name}`
            });
            const coverButton = row.createEl('button', { text: '设为封面' });
            coverButton.addEventListener('click', () => {
                this.updateMediaContent(platformOverride, current => ({
                    ...current,
                    cover: image
                }));
            });
            const removeButton = row.createEl('button', { text: '移除' });
            removeButton.addEventListener('click', () => {
                this.updateMediaContent(platformOverride, current => {
                    const images = current.images.filter((_item, itemIndex) => itemIndex !== index);
                    return {
                        ...current,
                        images,
                        cover: current.cover?.path === image.path ? images[0] : current.cover
                    };
                });
            });
        });

        if (content.video) {
            const row = list.createDiv({ cls: 'ai-workbench-media-row' });
            row.createEl('span', { text: `视频 · ${content.video.name}` });
            const removeButton = row.createEl('button', { text: '移除' });
            removeButton.addEventListener('click', () => {
                this.updateMediaContent(platformOverride, current => ({
                    ...current,
                    video: undefined
                }));
            });
        }

        const mediaActions = container.createDiv({ cls: 'ai-workbench-media-actions' });
        const addImage = mediaActions.createEl('button', { text: '添加图片' });
        addImage.addEventListener('click', () => {
            new VaultMediaPicker(this.app, 'image', media => {
                this.updateMediaContent(platformOverride, current => ({
                    ...current,
                    images: [...current.images, media],
                    cover: current.cover || media
                }));
            }).open();
        });
        const addVideo = mediaActions.createEl('button', { text: '选择视频' });
        addVideo.addEventListener('click', () => {
            new VaultMediaPicker(this.app, 'video', media => {
                this.updateMediaContent(platformOverride, current => ({
                    ...current,
                    video: media
                }));
            }).open();
        });
    }

    private updateMediaContent(
        platformOverride: boolean,
        update: (content: PublishContent) => PublishContent
    ): void {
        if (!platformOverride) {
            this.state.base = update(this.state.base);
        } else {
            const platform = this.activePlatform;
            const updated = update(this.state.resolve(platform));
            this.state.setOverride(platform, 'images', updated.images);
            this.state.setOverride(platform, 'cover', updated.cover ?? null);
            this.state.setOverride(platform, 'video', updated.video ?? null);
        }
        this.render();
    }

    private renderResults(container: HTMLElement): void {
        if (this.submitting) {
            const progress = container.createDiv({ cls: 'ai-workbench-publish-results' });
            progress.createEl('h3', { text: '发布进度' });
            for (const platform of this.state.platforms) {
                progress.createDiv({
                    cls: 'ai-workbench-publish-result-row',
                    text: `${PLATFORM_LABELS[platform]} · 提交中`
                });
            }
            return;
        }
        if (!this.lastResult) return;

        const results = container.createDiv({ cls: 'ai-workbench-publish-results' });
        results.createEl('h3', { text: '发布结果' });
        for (const platform of this.lastResult.platforms) {
            const result = this.lastResult.results[platform];
            const row = results.createDiv({ cls: 'ai-workbench-publish-result-row' });
            row.createEl('strong', { text: PLATFORM_LABELS[platform] });
            row.createEl('span', {
                text: result?.success
                    ? `成功 · ${targetKindLabel(result.targetKind)}`
                    : `失败 · ${result?.error?.message || '未知错误'}`,
                cls: result?.success ? 'is-success' : 'is-error'
            });
            if (result?.draftId) {
                row.createEl('span', { text: `草稿 ID: ${result.draftId}` });
            }
            if (result?.managementUrl) {
                row.createEl('a', {
                    text: '打开管理页面',
                    href: result.managementUrl
                });
            }
        }
    }

    private renderActions(): void {
        const actions = this.contentEl.createDiv({ cls: 'ai-workbench-publish-actions' });
        if (this.lastResult && this.lastResult.status !== 'success') {
            const retry = actions.createEl('button', { text: '仅重试失败平台' });
            retry.addEventListener('click', () => this.retryFailed());
        }
        const cancel = actions.createEl('button', { text: '关闭' });
        cancel.addEventListener('click', () => this.close());
        const submit = actions.createEl('button', {
            text: `发布 ${this.state.platforms.length} 个草稿`,
            cls: 'mod-cta'
        });
        submit.disabled = this.submitting || this.state.platforms.length === 0;
        submit.addEventListener('click', () => this.submit());
    }

    private async submit(): Promise<void> {
        this.submitting = true;
        this.lastResult = null;
        this.render();
        try {
            await this.hydrateStateMedia();
            const input: PublishTaskInput = {
                content: this.state.base,
                overrides: this.state.overrides,
                platforms: this.state.platforms
            };
            this.lastResult = await this.publishingService.publishAll(input);
            new Notice(resultNotice(this.lastResult));
        } catch {
            new Notice('媒体载入失败，请检查文件是否仍然存在');
        } finally {
            this.submitting = false;
            this.render();
        }
    }

    private async retryFailed(): Promise<void> {
        if (!this.lastResult) return;
        this.submitting = true;
        this.render();
        try {
            this.lastResult = await this.publishingService.retryFailed(this.lastResult);
            new Notice(resultNotice(this.lastResult));
        } finally {
            this.submitting = false;
            this.render();
        }
    }

    private async hydrateStateMedia(): Promise<void> {
        if (!this.loadMedia) return;
        const cache = new Map<string, PublishMedia>();
        const hydrate = async (media?: PublishMedia | null): Promise<PublishMedia | undefined> => {
            if (!media) return undefined;
            if (media.source === 'remote' || media.data) return media;
            const cached = cache.get(media.path);
            if (cached) return cached;
            const loaded = await this.loadMedia!(media);
            cache.set(media.path, loaded);
            return loaded;
        };
        const hydrateContent = async (content: PublishContent): Promise<PublishContent> => ({
            ...content,
            cover: await hydrate(content.cover),
            images: await Promise.all(content.images.map(image => hydrate(image)))
                .then(items => items.filter((item): item is PublishMedia => Boolean(item))),
            video: await hydrate(content.video)
        });

        this.state.base = await hydrateContent(this.state.base);
        for (const platform of this.state.platforms) {
            const override = this.state.overrides[platform];
            if (!override) continue;
            if (override.cover !== undefined && override.cover !== null) {
                override.cover = await hydrate(override.cover);
            }
            if (override.images !== undefined) {
                override.images = (await Promise.all(override.images.map(image => hydrate(image))))
                    .filter((item): item is PublishMedia => Boolean(item));
            }
            if (override.video !== undefined && override.video !== null) {
                override.video = await hydrate(override.video);
            }
        }
    }
}

class VaultMediaPicker extends FuzzySuggestModal<TFile> {
    constructor(
        app: App,
        private kind: 'image' | 'video',
        private onChoose: (media: PublishMedia) => void
    ) {
        super(app);
        this.setPlaceholder(kind === 'image' ? '选择 Vault 图片' : '选择 Vault 视频');
    }

    getItems(): TFile[] {
        const extensions = this.kind === 'image' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
        return this.app.vault.getFiles()
            .filter(file => extensions.has(file.extension.toLowerCase()));
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile): void {
        this.onChoose({
            kind: this.kind,
            source: 'vault',
            path: file.path,
            name: file.name,
            mimeType: mimeType(file.extension)
        });
    }
}

function cloneContent(content: PublishContent): PublishContent {
    return {
        ...content,
        cover: content.cover ? { ...content.cover } : undefined,
        images: content.images.map(image => ({ ...image })),
        video: content.video ? { ...content.video } : undefined,
        tags: [...content.tags]
    };
}

function parseTags(value: string): string[] {
    return value.split(/[,，]/)
        .map(tag => tag.trim().replace(/^#/, ''))
        .filter(Boolean);
}

function mimeType(extension: string): string | undefined {
    const normalized = extension.toLowerCase();
    if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
    if (IMAGE_EXTENSIONS.has(normalized)) return `image/${normalized === 'svg' ? 'svg+xml' : normalized}`;
    if (normalized === 'mov') return 'video/quicktime';
    if (normalized === 'mkv') return 'video/x-matroska';
    if (normalized === 'avi') return 'video/x-msvideo';
    if (VIDEO_EXTENSIONS.has(normalized)) return `video/${normalized}`;
    return undefined;
}

function targetKindLabel(kind?: string): string {
    if (kind === 'native-draft') return '原生草稿';
    if (kind === 'private-upload') return '私密上传';
    return 'Webhook 草稿';
}

function resultNotice(result: PublishTaskResult): string {
    if (result.status === 'success') return '全部平台草稿创建成功';
    if (result.status === 'partial') return '部分平台成功，可重试失败平台';
    return '草稿创建失败，请查看各平台结果';
}
