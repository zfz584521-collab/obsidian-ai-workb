/**
 * Context Menu Service - Right-click menu integration
 */

import { App, Plugin, Menu, TFile, MarkdownView } from 'obsidian';
import { ContextMenuSettings, ActionType, CustomPrompt } from '../types';
import { t } from '../i18n';

export class ContextMenuService {
    private app: App;
    private plugin: Plugin;
    private settings: ContextMenuSettings;
    private executeAction: (actionType: ActionType, isSelection?: boolean) => Promise<void>;
    private executeCustomPrompt: (promptId: string) => Promise<void>;
    private getCustomPrompts: () => CustomPrompt[];
    private executeWeChatImages: (file?: TFile) => Promise<void>;

    constructor(
        app: App,
        plugin: Plugin,
        settings: ContextMenuSettings,
        executeAction: (actionType: ActionType, isSelection?: boolean) => Promise<void>,
        executeCustomPrompt: (promptId: string) => Promise<void>,
        getCustomPrompts: () => CustomPrompt[],
        executeWeChatImages: (file?: TFile) => Promise<void>
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.executeAction = executeAction;
        this.executeCustomPrompt = executeCustomPrompt;
        this.getCustomPrompts = getCustomPrompts;
        this.executeWeChatImages = executeWeChatImages;
    }

    updateSettings(settings: ContextMenuSettings) {
        this.settings = settings;
    }

    /**
     * Register context menu for editor
     */
    register() {
        this.plugin.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: any, view: MarkdownView) => {
                if (!this.settings.enabled) return;
                this.buildMenu(menu, view, editor);
            })
        );

        // File context menu
        this.plugin.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
                if (this.settings.enabled && file.extension === 'md') {
                    this.buildFileMenu(menu, file);
                }
            })
        );
    }

    /**
     * Build editor context menu
     */
    private buildMenu(menu: Menu, view: MarkdownView, editor: any) {
        const selection = editor.getSelection();
        const hasSelection = !!selection;

        // Add AI Workbench section
        menu.addItem((item) => {
            item.setTitle(t('actions.aiWorkbench'))
                .setIcon('sparkles')
                .onClick(() => { });
        });
        menu.addItem(item => item
            .setTitle(t('actions.wechatInsertImages'))
            .setIcon('image-plus')
            .onClick(() => this.executeWeChatImages()));

        // Built-in actions
        if (this.settings.showBuiltInActions) {
            const actions: { type: ActionType; labelKey: string }[] = [
                { type: 'summarize', labelKey: 'actions.summarize' },
                { type: 'outline', labelKey: 'actions.outline' },
                { type: 'translate', labelKey: 'actions.translate' },
                { type: 'format', labelKey: 'actions.format' },
                { type: 'mindmap', labelKey: 'actions.mindmap' },
                { type: 'mermaid', labelKey: 'actions.mermaid' }
            ];

            for (const action of actions) {
                menu.addItem((item) => {
                    const label = t(action.labelKey);
                    const title = hasSelection
                        ? `${label} (${t('actions.selectedText')})`
                        : label;

                    item.setTitle(title)
                        .onClick(() => {
                            this.executeAction(action.type, hasSelection);
                        });
                });
            }
        }

        // Custom prompts
        if (this.settings.showCustomPrompts) {
            const prompts = this.getCustomPrompts();

            if (prompts.length > 0) {
                menu.addSeparator();

                for (const prompt of prompts) {
                    menu.addItem((item) => {
                        item.setTitle(`✨ ${prompt.name}`)
                            .onClick(() => {
                                this.executeCustomPrompt(prompt.id);
                            });
                    });
                }
            }
        }
    }

    /**
     * Build file context menu
     */
    private buildFileMenu(menu: Menu, file: TFile) {
        menu.addItem((item) => {
            item.setTitle(t('actions.aiWorkbench'))
                .setIcon('sparkles')
                .onClick(() => { });
        });
        menu.addItem(item => item
            .setTitle(t('actions.wechatInsertImages'))
            .setIcon('image-plus')
            .onClick(() => this.executeWeChatImages(file)));

        if (this.settings.showBuiltInActions) {
            const actions: { type: ActionType; labelKey: string }[] = [
                { type: 'summarize', labelKey: 'actions.summarize' },
                { type: 'translate', labelKey: 'actions.translate' },
                { type: 'mindmap', labelKey: 'actions.mindmap' }
            ];

            for (const action of actions) {
                menu.addItem((item) => {
                    item.setTitle(t(action.labelKey))
                        .onClick(async () => {
                            // Open the file first
                            await this.app.workspace.getLeaf().openFile(file);
                            await this.executeAction(action.type, false);
                        });
                });
            }
        }
    }
}
