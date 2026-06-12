import { App, Modal, Setting } from 'obsidian';
import { ArticleImageTask } from './types';

export class ImageTaskPreviewService {
    constructor(private app: App) {}

    confirm(tasks: ArticleImageTask[]): Promise<boolean> {
        return new Promise(resolve => {
            new ImageTaskPreviewModal(this.app, tasks, resolve).open();
        });
    }
}

class ImageTaskPreviewModal extends Modal {
    private resolved = false;

    constructor(
        app: App,
        private tasks: ArticleImageTask[],
        private resolveResult: (accepted: boolean) => void
    ) {
        super(app);
    }

    onOpen(): void {
        this.contentEl.addClass('ai-workbench-image-task-preview');
        this.contentEl.createEl('h2', { text: `确认配图任务（${this.tasks.length} 张）` });

        for (const [index, task] of this.tasks.entries()) {
            const item = this.contentEl.createDiv({ cls: 'ai-workbench-image-task' });
            item.createEl('h3', {
                text: `${index + 1}. ${task.description || '文章配图'}`
            });
            item.createEl('div', {
                cls: 'ai-workbench-image-task__prompt',
                text: task.prompt
            });
            item.createEl('div', {
                cls: 'ai-workbench-image-task__anchor',
                text: [
                    task.anchor.heading ? `标题：${task.anchor.heading}` : '',
                    task.anchor.nearbyText ? `原文：${task.anchor.nearbyText}` : '',
                    `位置：${task.anchor.placement === 'before' ? '之前' : '之后'}`
                ].filter(Boolean).join('；')
            });
        }

        new Setting(this.contentEl)
            .addButton(button => button
                .setButtonText('取消')
                .onClick(() => this.finish(false)))
            .addButton(button => button
                .setButtonText('开始生成')
                .setCta()
                .onClick(() => this.finish(true)));
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolved = true;
            this.resolveResult(false);
        }
    }

    private finish(accepted: boolean): void {
        if (this.resolved) return;
        this.resolved = true;
        this.resolveResult(accepted);
        this.close();
    }
}
