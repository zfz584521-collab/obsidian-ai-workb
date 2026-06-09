/**
 * Claudian Service - Integration with Claudian plugin
 */

import { App, Notice, TFile, WorkspaceLeaf } from 'obsidian';

const CLAUDIAN_VIEW_TYPE = 'claudian-view';

export interface ClaudianIntegration {
    isAvailable(): boolean;
    openClaudian(): Promise<void>;
    sendToClaudian(content: string, autoSend?: boolean): Promise<void>;
}

export class ClaudianService implements ClaudianIntegration {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Check if Claudian plugin is installed and enabled
     */
    isAvailable(): boolean {
        // @ts-ignore - accessing internal plugins
        const claudianPlugin = this.app.plugins?.plugins?.['claudian'];
        return !!claudianPlugin;
    }

    /**
     * Get the Claudian plugin instance
     */
    private getPlugin(): any | null {
        // @ts-ignore
        return this.app.plugins?.plugins?.['claudian'] || null;
    }

    /**
     * Open Claudian view
     */
    async openClaudian(): Promise<void> {
        const plugin = this.getPlugin();
        if (!plugin) {
            new Notice('Claudian 插件未安装或未启用');
            return;
        }

        // Check if view is already open
        let leaf = this.app.workspace.getLeavesOfType(CLAUDIAN_VIEW_TYPE)[0];

        if (!leaf) {
            // Activate the view through the plugin
            await plugin.activateView();
            leaf = this.app.workspace.getLeavesOfType(CLAUDIAN_VIEW_TYPE)[0];
        }

        if (leaf) {
            this.app.workspace.revealLeaf(leaf);
        }
    }

    /**
     * Send content to Claudian
     */
    async sendToClaudian(content: string, autoSend: boolean = false): Promise<void> {
        const plugin = this.getPlugin();
        if (!plugin) {
            new Notice('Claudian 插件未安装或未启用');
            return;
        }

        // Open Claudian first
        await this.openClaudian();

        // Wait a bit for the view to be ready
        await new Promise(resolve => setTimeout(resolve, 300));

        // Get the view
        const leaf = this.app.workspace.getLeavesOfType(CLAUDIAN_VIEW_TYPE)[0];
        if (!leaf || !leaf.view) {
            new Notice('无法打开 Claudian 视图');
            return;
        }

        const view = leaf.view as any;

        // Try to get the input element or use plugin API
        try {
            // Method 1: Use the view's input element
            const inputEl = view.containerEl?.querySelector('textarea[class*="prompt"], textarea[placeholder*="Ask"], textarea');

            if (inputEl) {
                // Set the value
                (inputEl as HTMLTextAreaElement).value = content;

                // Trigger input event to update React state
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));

                // Focus the input
                (inputEl as HTMLTextAreaElement).focus();

                if (autoSend) {
                    // Find and click the send button
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const sendBtn = view.containerEl?.querySelector('button[type="submit"], button[aria-label*="Send"]');
                    if (sendBtn) {
                        (sendBtn as HTMLButtonElement).click();
                    }
                }

                new Notice('内容已发送到 Claudian');
                return;
            }

            // Method 2: Use plugin's internal API
            const tabManager = view.getTabManager?.();
            if (tabManager) {
                const activeTab = tabManager.getActiveTab?.();
                if (activeTab?.ui?.setPromptText) {
                    activeTab.ui.setPromptText(content);
                    new Notice('内容已发送到 Claudian');
                    return;
                }
            }

            // Method 3: Copy to clipboard as fallback
            await navigator.clipboard.writeText(content);
            new Notice('内容已复制到剪贴板，请粘贴到 Claudian');

        } catch (error) {
            console.error('[AI Workbench] Error sending to Claudian:', error);
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(content);
            new Notice('内容已复制到剪贴板，请粘贴到 Claudian');
        }
    }

    /**
     * Send current note to Claudian
     */
    async sendNoteToClaudian(file: TFile, instruction?: string): Promise<void> {
        const content = await this.app.vault.read(file);

        const prompt = instruction
            ? `${instruction}\n\n---\n\n文件: ${file.path}\n\n${content}`
            : `请处理以下笔记内容：\n\n---\n\n文件: ${file.path}\n\n${content}`;

        await this.sendToClaudian(prompt);
    }

    /**
     * Send selected text to Claudian
     */
    async sendSelectionToClaudian(selectedText: string, instruction?: string): Promise<void> {
        const prompt = instruction
            ? `${instruction}\n\n---\n\n${selectedText}`
            : selectedText;

        await this.sendToClaudian(prompt);
    }
}
