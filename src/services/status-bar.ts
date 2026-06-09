/**
 * Status Bar Service - Show AI status in status bar
 */

import { App, Plugin, StatusBar } from 'obsidian';

export class StatusBarService {
    private app: App;
    private plugin: Plugin;
    private statusBarEl: HTMLElement | null = null;
    private isEnabled: boolean = false;

    private isProcessing: boolean = false;
    private currentAction: string = '';
    private tokenCount: { prompt: number; completion: number; total: number } | null = null;
    private lastError: string | null = null;

    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * Initialize status bar
     */
    init(enabled: boolean) {
        this.isEnabled = enabled;
        if (!enabled) return;

        this.statusBarEl = this.plugin.addStatusBarItem();
        this.statusBarEl.addClass('ai-workbench-status');
        this.render();
    }

    /**
     * Update enabled state
     */
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        if (enabled && !this.statusBarEl) {
            this.init(true);
        } else if (!enabled && this.statusBarEl) {
            this.statusBarEl.remove();
            this.statusBarEl = null;
        }
    }

    /**
     * Set processing state
     */
    setProcessing(action: string) {
        this.isProcessing = true;
        this.currentAction = action;
        this.lastError = null;
        this.render();
    }

    /**
     * Set completed state
     */
    setCompleted(tokens?: { prompt: number; completion: number; total: number }) {
        this.isProcessing = false;
        this.currentAction = '';
        this.tokenCount = tokens || null;
        this.render();

        // Auto-hide token count after 5 seconds
        if (tokens) {
            setTimeout(() => {
                if (!this.isProcessing) {
                    this.tokenCount = null;
                    this.render();
                }
            }, 5000);
        }
    }

    /**
     * Set error state
     */
    setError(error: string) {
        this.isProcessing = false;
        this.currentAction = '';
        this.lastError = error;
        this.render();

        // Auto-clear error after 10 seconds
        setTimeout(() => {
            this.lastError = null;
            this.render();
        }, 10000);
    }

    /**
     * Render status bar
     */
    private render() {
        if (!this.statusBarEl || !this.isEnabled) return;

        this.statusBarEl.empty();

        if (this.isProcessing) {
            this.statusBarEl.addClass('processing');
            this.statusBarEl.createSpan({ text: '⏳ ' });
            this.statusBarEl.createSpan({ text: this.currentAction + '...' });
            return;
        }

        if (this.lastError) {
            this.statusBarEl.addClass('error');
            this.statusBarEl.createSpan({ text: '❌ 错误' });
            this.statusBarEl.setAttribute('aria-label', this.lastError);
            return;
        }

        if (this.tokenCount) {
            this.statusBarEl.createSpan({ text: `✨ ${this.tokenCount.total} tokens` });
            return;
        }

        // Idle state
        this.statusBarEl.removeClass('processing', 'error');
        this.statusBarEl.createSpan({ text: '✨ AI' });
        this.statusBarEl.setAttribute('aria-label', 'AI Workbench 就绪');
    }
}
