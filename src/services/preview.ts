/**
 * Preview Service - Show diff between original and AI result
 */

import { App, Modal, Setting, ButtonComponent } from 'obsidian';

export class PreviewService {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Show a preview modal with original and result
     */
    showPreview(
        original: string,
        result: string,
        title: string,
        onAccept: () => void,
        onReject?: () => void
    ) {
        new PreviewModal(
            this.app,
            original,
            result,
            title,
            onAccept,
            onReject
        ).open();
    }

    /**
     * Show a simple diff view
     */
    showDiff(
        original: string,
        modified: string,
        title: string
    ) {
        new DiffModal(
            this.app,
            original,
            modified,
            title
        ).open();
    }
}

/**
 * Preview Modal - Show before/after comparison
 */
class PreviewModal extends Modal {
    private original: string;
    private result: string;
    private title: string;
    private onAccept: () => void;
    private onReject?: () => void;

    private accepted: boolean = false;

    constructor(
        app: App,
        original: string,
        result: string,
        title: string,
        onAccept: () => void,
        onReject?: () => void
    ) {
        super(app);
        this.original = original;
        this.result = result;
        this.title = title;
        this.onAccept = onAccept;
        this.onReject = onReject;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-preview-modal');

        contentEl.createEl('h3', { text: this.title });

        // Tab container
        const tabs = contentEl.createDiv({ cls: 'preview-tabs' });

        const tabOriginal = tabs.createEl('button', { text: '原文', cls: 'preview-tab active' });
        const tabResult = tabs.createEl('button', { text: 'AI 结果', cls: 'preview-tab' });
        const tabCompare = tabs.createEl('button', { text: '对比', cls: 'preview-tab' });

        // Content area
        const content = contentEl.createDiv({ cls: 'preview-content' });

        const renderOriginal = () => {
            content.empty();
            content.createEl('pre', { text: this.original.slice(0, 2000) + (this.original.length > 2000 ? '\n...' : '') });
        };

        const renderResult = () => {
            content.empty();
            content.createEl('pre', { text: this.result.slice(0, 2000) + (this.result.length > 2000 ? '\n...' : '') });
        };

        const renderCompare = () => {
            content.empty();
            content.createDiv({ cls: 'preview-compare' });

            const left = content.createDiv({ cls: 'compare-side' });
            left.createEl('h4', { text: '原文' });
            left.createEl('pre', { text: this.original.slice(0, 1000) });

            const right = content.createDiv({ cls: 'compare-side' });
            right.createEl('h4', { text: 'AI 结果' });
            right.createEl('pre', { text: this.result.slice(0, 1000) });
        };

        // Tab switching
        const setActive = (activeTab: HTMLElement) => {
            [tabOriginal, tabResult, tabCompare].forEach(t => t.removeClass('active'));
            activeTab.addClass('active');
        };

        tabOriginal.addEventListener('click', () => {
            setActive(tabOriginal);
            renderOriginal();
        });

        tabResult.addEventListener('click', () => {
            setActive(tabResult);
            renderResult();
        });

        tabCompare.addEventListener('click', () => {
            setActive(tabCompare);
            renderCompare();
        });

        // Initial render
        renderResult();

        // Action buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => {
                    this.accepted = false;
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('接受')
                .setCta()
                .onClick(() => {
                    this.accepted = true;
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();

        if (this.accepted) {
            this.onAccept();
        } else if (this.onReject) {
            this.onReject();
        }
    }
}

/**
 * Diff Modal - Side by side comparison
 */
class DiffModal extends Modal {
    private original: string;
    private modified: string;
    private title: string;

    constructor(
        app: App,
        original: string,
        modified: string,
        title: string
    ) {
        super(app);
        this.original = original;
        this.modified = modified;
        this.title = title;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-preview-modal');

        contentEl.createEl('h3', { text: this.title });

        const container = contentEl.createDiv({ cls: 'diff-container' });

        const left = container.createDiv({ cls: 'diff-side' });
        left.createEl('h4', { text: '原文' });
        left.createEl('pre', { text: this.original });

        const right = container.createDiv({ cls: 'diff-side' });
        right.createEl('h4', { text: '修改后' });
        right.createEl('pre', { text: this.modified });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('关闭')
                .setCta()
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
