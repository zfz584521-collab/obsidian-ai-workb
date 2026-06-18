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

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const VIDEO_EXTENSIONS = new Set(['avi', 'm4v', 'mkv', 'mov', 'mp4', 'webm']);

export interface PublishModalInitialContent {
    video?: PublishMedia;
}

export function createVaultVideoMedia(path: string): PublishMedia {
    const normalized = normalizeVaultPath(path);
    const name = normalized.substring(normalized.lastIndexOf('/') + 1) || normalized;
    return {
        kind: 'video',
        source: 'vault',
        path: normalized,
        name,
        mimeType: mimeType(extensionFromPath(path))
    };
}

export function applyInitialPublishContent(
    content: PublishContent,
    initialContent?: PublishModalInitialContent
): PublishContent {
    if (!initialContent?.video) return content;
    return {
        ...content,
        video: initialContent.video
    };
}

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
        this.contentEl.createEl('h2', { text: t('publishing.publishToDraft') });
        this.contentEl.createEl('p', {
            text: t('publishing.selectedPlatforms', { count: this.state.platforms.length }),
            cls: 'setting-item-description'
        });

        const layout = this.contentEl.createDiv({ cls: 'ai-workbench-publish-layout' });
        const editor = layout.createDiv({ cls: 'ai-workbench-publish-editor' });
        editor.createEl('h3', { text: t('publishing.unifiedContent') });
        this.renderBaseEditor(editor);
        editor.createEl('h3', { text: t('publishing.platformSettings') });
        this.renderPlatformEditor(editor);

        const side = layout.createDiv({ cls: 'ai-workbench-publish-side' });
        this.renderMediaEditor(side, this.state.base, false);
        this.renderResults(side);
        this.renderActions();
    }

	private renderBaseEditor(container: HTMLElement): void {
        const titleOptions = this.state.base.titleOptions || [];
		const titleSetting = new Setting(container)
			.setClass('ai-workbench-publish-setting')
			.setClass('ai-workbench-publish-setting--title')
            .setClass('ai-workbench-publish-title-picker')
			.setName(t('publishing.title'));
        this.renderTitleOptionDropdown(
            titleSetting,
            titleOptions,
            this.state.base.title,
            false,
            value => {
                this.state.base.title = value;
                this.render();
            }
        );
        titleSetting.addText(text => {
            text.inputEl.addClass('ai-workbench-custom-title');
            text
				.setValue(this.state.base.title)
				.onChange(value => this.state.base.title = value);
        });

		new Setting(container)
			.setClass('ai-workbench-publish-setting')
			.setClass('ai-workbench-publish-setting--long')
			.setClass('ai-workbench-publish-setting--body')
			.setName(t('publishing.body'))
			.addTextArea(text => text
				.setValue(this.state.base.bodyMarkdown)
				.onChange(value => this.state.base.bodyMarkdown = value));

		new Setting(container)
			.setClass('ai-workbench-publish-setting')
			.setClass('ai-workbench-publish-setting--long')
			.setClass('ai-workbench-publish-setting--summary')
			.setName(t('publishing.summary'))
			.addTextArea(text => text
				.setValue(this.state.base.summary || '')
				.onChange(value => this.state.base.summary = value));

		new Setting(container)
			.setClass('ai-workbench-publish-setting')
			.setClass('ai-workbench-publish-setting--tags')
			.setName(t('publishing.tags'))
			.setDesc(t('publishing.tagsDesc'))
			.addText(text => text
				.setValue(this.state.base.tags.join(', '))
                .onChange(value => this.state.base.tags = parseTags(value)));
    }

    private renderPlatformEditor(container: HTMLElement): void {
        const tabs = container.createDiv({ cls: 'ai-workbench-publish-tabs' });
        for (const platform of this.state.platforms) {
            const tab = tabs.createEl('button', {
                text: getPlatformLabel(platform),
                cls: platform === this.activePlatform ? 'is-active' : ''
            });
            tab.addEventListener('click', () => {
                this.activePlatform = platform;
                this.render();
            });
        }

        const panel = container.createDiv({ cls: 'ai-workbench-platform-override' });
        this.renderOverrideField(panel, 'title', t('publishing.platformTitle'), false);
        this.renderOverrideField(panel, 'bodyMarkdown', t('publishing.platformBody'), true);
        this.renderOverrideField(panel, 'summary', t('publishing.platformSummary'), true);
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
			.setClass('ai-workbench-publish-setting')
			.setClass(textarea ? 'ai-workbench-publish-setting--long' : 'ai-workbench-publish-setting--compact')
			.setName(label)
			.setDesc(enabled ? t('publishing.overridden') : t('publishing.inherited'))
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
		if (field === 'bodyMarkdown') {
			setting.setClass('ai-workbench-publish-setting--body');
		}
		if (field === 'summary') {
			setting.setClass('ai-workbench-publish-setting--summary');
		}

		if (textarea) {
			setting.addTextArea(text => {
                text.setValue(String(resolved[field] || ''))
                    .setDisabled(!enabled)
                    .onChange(value => this.state.setOverride(platform, field, value));
            });
        } else {
            if (field === 'title') {
                setting.setClass('ai-workbench-platform-title-picker');
                this.renderTitleOptionDropdown(
                    setting,
                    resolved.titleOptions || [],
                    String(resolved[field] || ''),
                    !enabled,
                    value => this.state.setOverride(platform, field, value)
                );
            }
            setting.addText(text => text
                .setValue(String(resolved[field] || ''))
                .setDisabled(!enabled)
                .onChange(value => this.state.setOverride(platform, field, value)));
        }
    }

    private renderTitleOptionDropdown(
        setting: Setting,
        titleOptions: string[],
        selectedTitle: string,
        disabled: boolean,
        onSelect: (value: string) => void
    ): void {
        if (titleOptions.length === 0) return;
        const selectedTitleIndex = titleOptions.indexOf(selectedTitle);
        setting.addDropdown(dropdown => {
            titleOptions.forEach((option, index) => dropdown.addOption(String(index), option));
            dropdown.addOption('custom', '自定义');
            dropdown.setValue(selectedTitleIndex >= 0 ? String(selectedTitleIndex) : 'custom');
            dropdown.setDisabled(disabled);
            dropdown.onChange(value => {
                if (value === 'custom') return;
                onSelect(titleOptions[Number(value)] || selectedTitle);
                this.render();
            });
        });
    }

    private renderOverrideTags(container: HTMLElement): void {
        const platform = this.activePlatform;
        const enabled = this.state.hasOverride(platform, 'tags');
        const resolved = this.state.resolve(platform);
        new Setting(container)
            .setName(t('publishing.platformTags'))
            .setDesc(enabled ? t('publishing.overridden') : t('publishing.inherited'))
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
            .setName(t('publishing.platformMedia'))
            .setDesc(overridden ? t('publishing.overridden') : t('publishing.inherited'))
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
        container.createEl('h3', { text: platformOverride ? t('publishing.platformMedia') : t('publishing.coverAndMedia') });
        const list = container.createDiv({ cls: 'ai-workbench-media-list' });
        if (content.images.length === 0 && !content.video) {
            list.createEl('p', { text: t('publishing.noMedia'), cls: 'setting-item-description' });
        }

        content.images.forEach((image, index) => {
            const row = list.createDiv({ cls: 'ai-workbench-media-row' });
            row.createEl('span', {
                text: `${content.cover?.path === image.path ? t('publishing.cover') + ' · ' : ''}${image.name}`
            });
            const coverButton = row.createEl('button', { text: t('publishing.setAsCover') });
            coverButton.addEventListener('click', () => {
                this.updateMediaContent(platformOverride, current => ({
                    ...current,
                    cover: image
                }));
            });
            const removeButton = row.createEl('button', { text: t('publishing.remove') });
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
            row.createEl('span', { text: `${t('publishing.video')} · ${content.video.name}` });
            const removeButton = row.createEl('button', { text: t('publishing.remove') });
            removeButton.addEventListener('click', () => {
                this.updateMediaContent(platformOverride, current => ({
                    ...current,
                    video: undefined
                }));
            });
        }

        const mediaActions = container.createDiv({ cls: 'ai-workbench-media-actions' });
        const addImage = mediaActions.createEl('button', { text: t('publishing.addImage') });
        addImage.addEventListener('click', () => {
            new VaultMediaPicker(this.app, 'image', media => {
                this.updateMediaContent(platformOverride, current => ({
                    ...current,
                    images: [...current.images, media],
                    cover: current.cover || media
                }));
            }).open();
        });
        const addVideo = mediaActions.createEl('button', { text: t('publishing.selectVideo') });
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
            progress.createEl('h3', { text: t('publishing.publishProgress') });
            for (const platform of this.state.platforms) {
                progress.createDiv({
                    cls: 'ai-workbench-publish-result-row',
                    text: `${getPlatformLabel(platform)} · ${t('publishing.submitting')}`
                });
            }
            return;
        }
        if (!this.lastResult) return;

        const results = container.createDiv({ cls: 'ai-workbench-publish-results' });
        results.createEl('h3', { text: t('publishing.publishResults') });
        for (const platform of this.lastResult.platforms) {
            const result = this.lastResult.results[platform];
            const row = results.createDiv({ cls: 'ai-workbench-publish-result-row' });
            row.createEl('strong', { text: getPlatformLabel(platform) });
            row.createEl('span', {
                text: result?.success
                    ? `${t('notices.success')} · ${targetKindLabel(result.targetKind)}`
                    : `${t('notices.failed')} · ${result?.error?.message || t('publishing.unknownError')}`,
                cls: result?.success ? 'is-success' : 'is-error'
            });
            if (result?.draftId) {
                row.createEl('span', { text: t('publishing.draftId', { id: result.draftId }) });
            }
            if (result?.managementUrl) {
                row.createEl('a', {
                    text: t('publishing.openManagement'),
                    href: result.managementUrl
                });
            }
        }
    }

    private renderActions(): void {
        const actions = this.contentEl.createDiv({ cls: 'ai-workbench-publish-actions' });
        if (this.lastResult && this.lastResult.status !== 'success') {
            const retry = actions.createEl('button', { text: t('publishing.retryFailed') });
            retry.addEventListener('click', () => this.retryFailed());
        }
        const cancel = actions.createEl('button', { text: t('common.close') });
        cancel.addEventListener('click', () => this.close());
        const submit = actions.createEl('button', {
            text: t('publishing.publishDrafts', { count: this.state.platforms.length }),
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
            new Notice(t('notices.mediaLoadFailed'));
        } finally {
            this.submitting = false;
            this.render();
        }
    }

    private async retryFailed(): Promise<void> {
        if (!this.lastResult) return;
        const previous = this.lastResult;
        this.submitting = true;
        this.render();
        try {
            const retried = await this.publishingService.retryFailed(previous);
            const results = { ...previous.results, ...retried.results };
            const successCount = previous.platforms
                .filter(platform => results[platform]?.success).length;
            this.lastResult = {
                ...previous,
                requests: { ...previous.requests, ...retried.requests },
                results,
                status: successCount === previous.platforms.length
                    ? 'success'
                    : successCount > 0 ? 'partial' : 'failed'
            };
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
        this.setPlaceholder(kind === 'image' ? t('publishing.selectImagePlaceholder') : t('publishing.selectVideoPlaceholder'));
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
        titleOptions: content.titleOptions ? [...content.titleOptions] : undefined,
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

function normalizeVaultPath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
}

function extensionFromPath(path: string): string {
    const match = path.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i);
    return match?.[1] || '';
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
    if (kind === 'native-draft') return t('publishing.nativeDraft');
    if (kind === 'private-upload') return t('publishing.privateUpload');
    return t('publishing.webhookDraft');
}

function resultNotice(result: PublishTaskResult): string {
    if (result.status === 'success') return t('notices.allSuccess');
    if (result.status === 'partial') return t('notices.partialFailed');
    return t('notices.allFailed');
}
