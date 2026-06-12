/**
 * AI Workbench - Service Interfaces
 *
 * This file contains interface definitions for all core services.
 * Using interfaces improves type safety, enables dependency injection,
 * and makes unit testing easier.
 */

import { ApiSettings, AIResponse, CustomPrompt, BackupSettings, OutputSettings } from './types';

/**
 * AI Service Interface
 */
export interface IAIService {
    /**
     * Update service settings
     */
    updateSettings(settings: ApiSettings): void;

    /**
     * Send chat request to AI API
     */
    chat(prompt: string, content: string): Promise<AIResponse>;
}

/**
 * Backup Service Interface
 */
export interface IBackupService {
    /**
     * Update service settings
     */
    updateSettings(settings: BackupSettings): void;

    /**
     * Create a backup of a file before modification
     * @returns Backup path or null if backup failed
     */
    backup(file: import('obsidian').TFile): Promise<string | null>;

    /**
     * Restore from backup
     */
    restore(backupPath: string, targetFile: import('obsidian').TFile): Promise<boolean>;
}

/**
 * File Service Interface
 */
export interface IFileService {
    /**
     * Update service settings
     */
    updateSettings(settings: OutputSettings): void;

    /**
     * Append content to end of file
     */
    append(file: import('obsidian').TFile, content: string, sectionTitle?: string): Promise<void>;

    /**
     * Prepend content to beginning of file
     */
    prepend(file: import('obsidian').TFile, content: string, sectionTitle?: string): Promise<void>;

    /**
     * Create a new file with the given content
     */
    createNewFile(
        originalFile: import('obsidian').TFile,
        suffix: string,
        content: string
    ): Promise<import('obsidian').TFile>;

    /**
     * Get current active file
     */
    getActiveFile(): import('obsidian').TFile | null;

    /**
     * Replace file content entirely
     */
    replace(file: import('obsidian').TFile, content: string): Promise<void>;
}

/**
 * Custom Prompts Service Interface
 */
export interface ICustomPromptsService {
    /**
     * Update service settings
     */
    updateSettings(settings: { prompts: CustomPrompt[] }): void;

    /**
     * Get all custom prompts
     */
    getAll(): CustomPrompt[];

    /**
     * Get a specific prompt by ID
     */
    getById(id: string): CustomPrompt | undefined;

    /**
     * Add a new custom prompt
     */
    add(prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): CustomPrompt;

    /**
     * Update an existing prompt
     */
    update(id: string, updates: Partial<Omit<CustomPrompt, 'id' | 'createdAt'>>): CustomPrompt | null;

    /**
     * Delete a prompt
     */
    delete(id: string): boolean;
}

/**
 * Backup Manager Interface
 */
export interface IBackupManager {
    /**
     * List all backups
     */
    listBackups(): Promise<BackupInfo[]>;

    /**
     * Restore from backup
     */
    restore(backupPath: string, targetPath: string): Promise<boolean>;

    /**
     * Delete a backup
     */
    delete(backupPath: string): Promise<boolean>;

    /**
     * Clear all backups
     */
    clearAll(): Promise<number>;

    /**
     * Show backup manager modal
     */
    showBackupModal(originalPath?: string): void;
}

/**
 * Backup Info Interface
 */
export interface BackupInfo {
    path: string;
    filename: string;
    originalFile: string;
    originalPath?: string;
    createdAt: Date;
    size: number;
}

/**
 * Statistics Service Interface
 */
export interface IStatisticsService {
    /**
     * Load statistics from storage
     */
    load(): Promise<void>;

    /**
     * Record a successful operation
     */
    recordSuccess(actionName: string, tokensUsed?: { prompt: number; completion: number; total: number }): Promise<void>;

    /**
     * Record a failed operation
     */
    recordFailure(): Promise<void>;

    /**
     * Get statistics data
     */
    getStats(): any;

    /**
     * Get summary statistics
     */
    getSummary(): any;

    /**
     * Reset all statistics
     */
    reset(): Promise<void>;
}

/**
 * Action Handler Interface
 */
export interface IActionHandler {
    /**
     * Execute an action
     */
    execute(
        actionType: import('./types').ActionType,
        context: import('./types').ActionContext,
        customPrompt?: CustomPrompt,
        options?: { previewOnly?: boolean }
    ): Promise<import('./types').ActionResult & { originalContent?: string }>;

    /**
     * Apply the result after preview
     */
    applyResult(
        actionType: import('./types').ActionType,
        context: import('./types').ActionContext,
        output: string,
        customPrompt?: CustomPrompt
    ): Promise<import('./types').ActionResult>;
}

/**
 * Preview Service Interface
 */
export interface IPreviewService {
    /**
     * Show preview modal
     */
    showPreview(
        originalContent: string,
        newContent: string,
        actionName: string,
        onAccept: () => Promise<void>,
        onCancel: () => void
    ): void;
}

/**
 * Undo Service Interface
 */
export interface IUndoService {
    /**
     * Undo the last successful operation
     */
    undoLast(): Promise<boolean>;

    /**
     * Check if undo is available
     */
    canUndo(): boolean;
}

/**
 * Shortcuts Service Interface
 */
export interface IShortcutsService {
    /**
     * Update service settings
     */
    updateSettings(settings: import('./types').ShortcutSettings): void;

    /**
     * Register all shortcuts
     */
    registerAll(executeAction: (actionId: string, customPromptId?: string) => void): void;

    /**
     * Clear all registered shortcuts
     */
    clearAll(): void;

    /**
     * Add a new shortcut binding
     */
    addBinding(binding: import('./types').ShortcutBinding): boolean;

    /**
     * Remove a shortcut binding
     */
    removeBinding(index: number): boolean;

    /**
     * Get display string for a binding
     */
    getBindingDisplay(binding: import('./types').ShortcutBinding): string;
}

/**
 * Status Bar Service Interface
 */
export interface IStatusBarService {
    /**
     * Initialize status bar
     */
    init(enabled: boolean): void;

    /**
     * Set processing status
     */
    setProcessing(actionName: string): void;

    /**
     * Set completed status
     */
    setCompleted(tokensUsed?: number): void;

    /**
     * Set error status
     */
    setError(error: string): void;

    /**
     * Set enabled state
     */
    setEnabled(enabled: boolean): void;
}

/**
 * Context Menu Service Interface
 */
export interface IContextMenuService {
    /**
     * Update service settings
     */
    updateSettings(settings: import('./types').ContextMenuSettings): void;

    /**
     * Register context menu
     */
    register(): void;
}

/**
 * Claudian Service Interface
 */
export interface IClaudianService {
    /**
     * Check if Claudian plugin is available
     */
    isAvailable(): boolean;

    /**
     * Send content to Claudian
     */
    sendToClaudian(content: string, autoSend?: boolean): Promise<void>;

    /**
     * Send current note to Claudian
     */
    sendNoteToClaudian(file: import('obsidian').TFile, instruction?: string): Promise<void>;

    /**
     * Send selected text to Claudian
     */
    sendSelectionToClaudian(selectedText: string, instruction?: string): Promise<void>;
}

/**
 * Help Service Interface
 */
export interface IHelpService {
    /**
     * Show quick tips
     */
    showQuickTips(): void;

    /**
     * Show shortcuts help
     */
    showShortcutsHelp(shortcuts: Array<{ key: string; action: string }>): void;
}

/**
 * Obsidian publishing content extractor interface
 */
export interface IObsidianContentExtractor {
    extract(file: import('obsidian').TFile): Promise<import('./publishing/types').PublishContent>;
    loadMedia(media: import('./publishing/types').PublishMedia): Promise<import('./publishing/types').PublishMedia>;
}

/**
 * Multi-platform publishing service interface
 */
export interface IPublishingService {
    updateSettings(settings: import('./publishing/types').PublishingSettings): void;
    publishAll(input: import('./publishing/service').PublishTaskInput): Promise<import('./publishing/types').PublishTaskResult>;
    retryFailed(task: import('./publishing/types').PublishTaskResult): Promise<import('./publishing/types').PublishTaskResult>;
    testConnection(platform: import('./publishing/types').PublishingPlatform): Promise<import('./publishing/types').ConnectionTestResult>;
}
