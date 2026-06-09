/**
 * Help Service - Welcome guide and tips
 */

import { App, Modal, Setting } from 'obsidian';

export class HelpService {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Show welcome guide (for first-time users)
     */
    showWelcomeGuide() {
        new WelcomeModal(this.app).open();
    }

    /**
     * Show keyboard shortcuts help
     */
    showShortcutsHelp(shortcuts: { key: string; action: string }[]) {
        new ShortcutsHelpModal(this.app, shortcuts).open();
    }

    /**
     * Show quick tips
     */
    showQuickTips() {
        new TipsModal(this.app).open();
    }
}

/**
 * Welcome Modal - First-time user guide
 */
class WelcomeModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-help-modal');

        contentEl.createEl('h2', { text: '👋 欢迎使用 AI Workbench' });

        contentEl.createEl('p', {
            text: 'AI Workbench 是你的 Obsidian AI 助手，帮你快速处理笔记内容。',
            cls: 'welcome-intro'
        });

        // Quick Start
        const quickStart = contentEl.createDiv({ cls: 'help-section' });
        quickStart.createEl('h3', { text: '🚀 快速开始' });

        const steps = [
            '配置 API：在设置中填写你的 API Key',
            '打开侧边栏：点击左侧 ✨ 图标或按 Ctrl+P 输入 "AI Workbench"',
            '选择动作：点击「总结」「翻译」等按钮',
            '查看结果：AI 生成的结果会追加到笔记末尾'
        ];

        const ol = quickStart.createEl('ol');
        steps.forEach(step => ol.createEl('li', { text: step }));

        // Features
        const features = contentEl.createDiv({ cls: 'help-section' });
        features.createEl('h3', { text: '✨ 主要功能' });

        const featureList = [
            { icon: '📝', name: '快捷操作', desc: '总结、大纲、翻译、格式化、思维导图' },
            { icon: '🎨', name: '自定义 Prompt', desc: '创建自己的 AI 处理动作' },
            { icon: '⌨️', name: '快捷键', desc: 'Ctrl+Alt+S 总结，Ctrl+Alt+T 翻译' },
            { icon: '🖱️', name: '右键菜单', desc: '选中文字右键快速处理' },
            { icon: '🔗', name: 'Claudian 集成', desc: '发送到 Claude Code 深度处理' }
        ];

        for (const f of featureList) {
            const item = features.createDiv({ cls: 'feature-item' });
            item.createEl('span', { text: f.icon, cls: 'feature-icon' });
            const info = item.createDiv({ cls: 'feature-info' });
            info.createEl('strong', { text: f.name });
            info.createEl('span', { text: f.desc });
        }

        // Tips
        const tips = contentEl.createDiv({ cls: 'help-section' });
        tips.createEl('h3', { text: '💡 小技巧' });

        const tipList = [
            '选中部分文字后点击按钮，只处理选中内容',
            '在设置中开启「替换前确认」可预览对比',
            '导入预设模板快速添加常用 Prompt',
            '操作前会自动备份，可随时恢复'
        ];

        const ul = tips.createEl('ul');
        tipList.forEach(tip => ul.createEl('li', { text: tip }));

        // Close button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('开始使用')
                .setCta()
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Shortcuts Help Modal
 */
class ShortcutsHelpModal extends Modal {
    private shortcuts: { key: string; action: string }[];

    constructor(app: App, shortcuts: { key: string; action: string }[]) {
        super(app);
        this.shortcuts = shortcuts;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-help-modal');

        contentEl.createEl('h2', { text: '⌨️ 快捷键' });

        const list = contentEl.createDiv({ cls: 'shortcuts-list' });

        for (const shortcut of this.shortcuts) {
            const item = list.createDiv({ cls: 'shortcut-help-item' });
            item.createEl('kbd', { text: shortcut.key });
            item.createEl('span', { text: shortcut.action });
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('关闭')
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Tips Modal
 */
class TipsModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-help-modal');

        contentEl.createEl('h2', { text: '💡 使用技巧' });

        const tips = [
            {
                title: '处理选中文字',
                content: '选中笔记中的部分文字，然后执行操作，AI 只会处理选中内容。'
            },
            {
                title: '预览模式',
                content: '在设置中开启「替换前确认」，AI 处理完成后会显示预览窗口，可对比后再决定是否应用。'
            },
            {
                title: '自定义 Prompt',
                content: '创建自己的 Prompt 模板，例如"润色文章"、"扩写内容"等，一键执行常用操作。'
            },
            {
                title: '备份恢复',
                content: '所有修改操作前都会自动备份，可通过「备份管理」查看和恢复。'
            },
            {
                title: 'Claudian 集成',
                content: '需要更复杂的处理？发送到 Claudian 让 Claude Code 深度处理。'
            },
            {
                title: '思维导图',
                content: '生成 Markdown 或 Mermaid 格式的思维导图，可直接粘贴到思维导图工具中使用。'
            }
        ];

        for (const tip of tips) {
            const section = contentEl.createDiv({ cls: 'tip-section' });
            section.createEl('h4', { text: tip.title });
            section.createEl('p', { text: tip.content });
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('知道了')
                .setCta()
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
