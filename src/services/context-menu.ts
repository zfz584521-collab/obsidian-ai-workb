/**
 * Context Menu Service - Right-click menu integration
 */

import { App, Plugin, Menu, TFile, MarkdownView } from 'obsidian';
import { ContextMenuSettings, ActionType, CustomPrompt } from '../types';

export class ContextMenuService {
    private app: App;
    private plugin: Plugin;
    private settings: ContextMenuSettings;
    private executeAction: (actionType: ActionType, isSelection?: boolean) => Promise<void>;
    private executeCustomPrompt: (promptId: string) => Promise<void>;
    private getCustomPrompts: () => CustomPrompt[];

    constructor(
        app: App,
        plugin: Plugin,
        settings: ContextMenuSettings,
        executeAction: (actionType: ActionType, isSelection?: boolean) => Promise<void>,
        executeCustomPrompt: (promptId: string) => Promise<void>,
        getCustomPrompts: () => CustomPrompt[]
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.executeAction = executeAction;
        this.executeCustomPrompt = executeCustomPrompt;
        this.getCustomPrompts = getCustomPrompts;
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
            item.setTitle('AI 工作台')
                .setIcon('sparkles')
                .onClick(() => { });
        });

        // Built-in actions
        if (this.settings.showBuiltInActions) {
            const actions: { type: ActionType; label: string; needsSelection?: boolean }[] = [
                { type: 'summarize', label: '总结' },
                { type: 'outline', label: '大纲' },
                { type: 'translate', label: '翻译' },
                { type: 'format', label: '格式化' },
                { type: 'mindmap', label: '思维导图' },
                { type: 'mermaid', label: 'Mermaid' }
            ];

            for (const action of actions) {
                menu.addItem((item) => {
                    const title = hasSelection
                        ? `${action.label} (选中文字)`
                        : action.label;

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
            item.setTitle('AI 工作台')
                .setIcon('sparkles')
                .onClick(() => { });
        });

        if (this.settings.showBuiltInActions) {
            const actions: { type: ActionType; label: string }[] = [
                { type: 'summarize', label: '总结' },
                { type: 'translate', label: '翻译' },
                { type: 'mindmap', label: '思维导图' }
            ];

            for (const action of actions) {
                menu.addItem((item) => {
                    item.setTitle(action.label)
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
