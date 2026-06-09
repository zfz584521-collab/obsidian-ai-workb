/**
 * AI Workbench - Obsidian Plugin
 * Main entry point
 */

import {
    App,
    Plugin,
    TFile,
    Notice,
    WorkspaceLeaf,
    ItemView,
    MarkdownView,
    Modal,
    Setting
} from 'obsidian';
import { WorkbenchSettings, DEFAULT_SETTINGS, ActionType, HistoryEntry, CustomPrompt } from './src/types';
import { AIService } from './src/services/ai';
import { BackupService } from './src/services/backup';
import { BackupManager } from './src/services/backup-manager';
import { FileService } from './src/services/file';
import { ClaudianService } from './src/services/claudian';
import { CustomPromptsService } from './src/services/custom-prompts';
import { ShortcutsService } from './src/services/shortcuts';
import { ContextMenuService } from './src/services/context-menu';
import { StatusBarService } from './src/services/status-bar';
import { UndoService } from './src/services/undo';
import { PreviewService } from './src/services/preview';
import { StatisticsService } from './src/services/statistics';
import { HelpService } from './src/services/help';
import { getCategorizedPresets, PRESET_CATEGORIES, PresetCategory } from './src/services/presets';
import { ActionHandler } from './src/actions';
import { WorkbenchSettingTab } from './src/settings';

const VIEW_TYPE = 'ai-workbench-view';

export default class AIWorkbenchPlugin extends Plugin {
    settings: WorkbenchSettings;
    private aiService: AIService;
    private backupService: BackupService;
    private backupManager: BackupManager;
    private fileService: FileService;
    private claudianService: ClaudianService;
    private customPromptsService: CustomPromptsService;
    private shortcutsService: ShortcutsService;
    private contextMenuService: ContextMenuService;
    private statusBarService: StatusBarService;
    private undoService: UndoService;
    private previewService: PreviewService;
    private statisticsService: StatisticsService;
    private helpService: HelpService;
    private actionHandler: ActionHandler;
    private history: HistoryEntry[] = [];

    async onload() {
        await this.loadSettings();

        // Initialize services
        this.aiService = new AIService(this.settings.api);
        this.backupService = new BackupService(this.app, this.settings.backup);
        this.backupManager = new BackupManager(this.app, this.settings.backup);
        this.fileService = new FileService(this.app, this.settings.output);
        this.claudianService = new ClaudianService(this.app);
        this.customPromptsService = new CustomPromptsService(this.settings.customPrompts);
        this.shortcutsService = new ShortcutsService(this.app, this, this.settings.shortcuts);
        this.statusBarService = new StatusBarService(this.app, this);
        this.undoService = new UndoService(this.app, this.backupManager, () => this.history);
        this.previewService = new PreviewService(this.app);
        this.statisticsService = new StatisticsService(this.app, this);
        this.helpService = new HelpService(this.app);
        this.actionHandler = new ActionHandler(
            this.app,
            this.aiService,
            this.backupService,
            this.fileService,
            this.settings
        );

        // Context menu
        this.contextMenuService = new ContextMenuService(
            this.app,
            this,
            this.settings.contextMenu,
            (action, isSelection) => this.executeAction(action, isSelection),
            (id) => this.executeCustomPrompt(id),
            () => this.customPromptsService.getAll()
        );

        // Register view
        this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new WorkbenchView(leaf, this));

        // Add ribbon icon
        this.addRibbonIcon('sparkles', 'AI Workbench', () => {
            this.activateView();
        });

        // Add command to open sidebar
        this.addCommand({
            id: 'open-ai-workbench',
            name: 'Open AI Workbench',
            callback: () => this.activateView()
        });

        // Add commands for quick actions
        this.addActionCommands();

        // Add backup management command
        this.addCommand({
            id: 'manage-backups',
            name: 'Manage Backups',
            callback: () => this.backupManager.showBackupModal()
        });

        // Add undo command
        this.addCommand({
            id: 'undo-last',
            name: 'Undo Last AI Operation',
            callback: () => this.undoService.undoLast()
        });

        // Add import presets command
        this.addCommand({
            id: 'import-presets',
            name: 'Import Preset Prompts',
            callback: () => this.showPresetImportModal()
        });

        // Add custom prompts commands
        this.refreshCustomPromptCommands();

        // Add Claudian commands
        this.addClaudianCommands();

        // Register shortcuts
        this.refreshShortcuts();

        // Register context menu
        this.contextMenuService.register();

        // Init status bar
        this.statusBarService.init(this.settings.ui.showStatusBar);

        // Add settings tab
        this.addSettingTab(new WorkbenchSettingTab(this.app, this));

        // Load statistics
        await this.statisticsService.load();

        // Add help commands
        this.addCommand({
            id: 'show-help',
            name: 'Show Help & Tips',
            callback: () => this.helpService.showQuickTips()
        });

        this.addCommand({
            id: 'show-shortcuts',
            name: 'Show Keyboard Shortcuts',
            callback: () => {
                const shortcuts = this.settings.shortcuts.bindings.map(b => ({
                    key: this.shortcutsService.getBindingDisplay(b),
                    action: this.getActionDisplayName(b.actionId, b.customPromptId)
                }));
                this.helpService.showShortcutsHelp(shortcuts);
            }
        });

        this.addCommand({
            id: 'show-stats',
            name: 'Show Usage Statistics',
            callback: () => this.showStatisticsModal()
        });

        console.log('AI Workbench loaded');
    }

    onunload() {
        this.shortcutsService.clearAll();
        console.log('AI Workbench unloaded');
    }

    async loadSettings() {
        const saved = await this.loadData();
        this.settings = {
            api: { ...DEFAULT_SETTINGS.api, ...saved?.api },
            output: { ...DEFAULT_SETTINGS.output, ...saved?.output },
            backup: { ...DEFAULT_SETTINGS.backup, ...saved?.backup },
            claudian: { ...DEFAULT_SETTINGS.claudian, ...saved?.claudian },
            customPrompts: { ...DEFAULT_SETTINGS.customPrompts, ...saved?.customPrompts },
            shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...saved?.shortcuts },
            contextMenu: { ...DEFAULT_SETTINGS.contextMenu, ...saved?.contextMenu },
            ui: { ...DEFAULT_SETTINGS.ui, ...saved?.ui }
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.aiService.updateSettings(this.settings.api);
        this.backupService.updateSettings(this.settings.backup);
        this.fileService.updateSettings(this.settings.output);
        this.customPromptsService.updateSettings(this.settings.customPrompts);
        this.shortcutsService.updateSettings(this.settings.shortcuts);
        this.contextMenuService.updateSettings(this.settings.contextMenu);
        this.statusBarService.setEnabled(this.settings.ui.showStatusBar);
    }

    /**
     * Get services
     */
    getCustomPromptsService(): CustomPromptsService {
        return this.customPromptsService;
    }

    getShortcutsService(): ShortcutsService {
        return this.shortcutsService;
    }

    getBackupManager(): BackupManager {
        return this.backupManager;
    }

    getUndoService(): UndoService {
        return this.undoService;
    }

    getPreviewService(): PreviewService {
        return this.previewService;
    }

    getStatisticsService(): StatisticsService {
        return this.statisticsService;
    }

    getHelpService(): HelpService {
        return this.helpService;
    }

    /**
     * Show statistics modal
     */
    private showStatisticsModal() {
        const stats = this.statisticsService.getStats();
        const summary = this.statisticsService.getSummary();

        new StatisticsModal(
            this.app,
            stats,
            summary,
            async () => {
                await this.statisticsService.reset();
                new Notice('统计已重置');
            }
        ).open();
    }

    /**
     * Refresh shortcuts
     */
    refreshShortcuts() {
        this.shortcutsService.clearAll();
        this.shortcutsService.registerAll((actionId, customPromptId) => {
            if (actionId === 'custom' && customPromptId) {
                this.executeCustomPrompt(customPromptId);
            } else {
                this.executeAction(actionId as ActionType);
            }
        });
    }

    /**
     * Add commands for each action
     */
    private addActionCommands() {
        const actions: { id: string; name: string; type: ActionType }[] = [
            { id: 'summarize', name: '总结当前笔记', type: 'summarize' },
            { id: 'outline', name: '生成大纲', type: 'outline' },
            { id: 'translate', name: '翻译笔记', type: 'translate' },
            { id: 'format', name: '格式化笔记', type: 'format' },
            { id: 'mindmap', name: '生成思维导图 (Markdown)', type: 'mindmap' },
            { id: 'mermaid', name: '生成思维导图 (Mermaid)', type: 'mermaid' }
        ];

        for (const action of actions) {
            this.addCommand({
                id: action.id,
                name: action.name,
                callback: () => this.executeAction(action.type)
            });

            // Add selection variant
            this.addCommand({
                id: `${action.id}-selection`,
                name: `${action.name} (选中文字)`,
                editorCheckCallback: (checking, editor) => {
                    const selection = editor.getSelection();
                    if (!selection) return false;
                    if (checking) return true;
                    this.executeAction(action.type, true);
                    return true;
                }
            });
        }
    }

    /**
     * Refresh custom prompt commands
     */
    refreshCustomPromptCommands() {
        const prompts = this.customPromptsService.getAll();
        for (const prompt of prompts) {
            this.addCommand({
                id: `custom-${prompt.id}`,
                name: `自定义: ${prompt.name}`,
                callback: () => this.executeCustomPrompt(prompt.id)
            });
        }
    }

    /**
     * Add Claudian-related commands
     */
    private addClaudianCommands() {
        this.addCommand({
            id: 'send-to-claudian',
            name: '发送当前笔记到 Claudian',
            checkCallback: (checking: boolean) => {
                if (!this.claudianService.isAvailable()) return false;
                if (checking) return true;
                this.sendToClaudian();
            }
        });

        this.addCommand({
            id: 'send-selection-to-claudian',
            name: '发送选中文字到 Claudian',
            editorCheckCallback: (checking, editor) => {
                if (!this.claudianService.isAvailable()) return false;
                const selection = editor.getSelection();
                if (!selection) return false;
                if (checking) return true;
                this.sendSelectionToClaudian(selection);
                return true;
            }
        });
    }

    /**
     * Execute an action on the current note
     */
    async executeAction(actionType: ActionType, isSelection: boolean = false): Promise<void> {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            new Notice('没有打开的笔记');
            return;
        }

        if (!(file instanceof TFile)) {
            new Notice('当前文件不是笔记');
            return;
        }

        const content = await this.app.vault.read(file);
        const selectedText = this.getSelectedText();

        if (isSelection && !selectedText) {
            new Notice('请先选中要处理的文字');
            return;
        }

        const context = {
            notePath: file.path,
            noteContent: content,
            noteTitle: file.basename,
            selectedText,
            selectionFrom: isSelection ? this.getSelectionPosition('from') : undefined,
            selectionTo: isSelection ? this.getSelectionPosition('to') : undefined,
            isSelection
        };

        const actionName = this.getActionName(actionType);
        this.statusBarService.setProcessing(actionName);
        new Notice(`正在处理: ${actionName}...`);

        // Check if preview mode is enabled
        const previewMode = this.settings.ui.confirmBeforeReplace;

        // Generate first and apply exactly once after optional confirmation.
        const result = await this.actionHandler.execute(actionType, context, undefined, { previewOnly: true });

        if (result.success && result.output) {
            this.statusBarService.setCompleted(result.tokensUsed);

            if (previewMode) {
                // Show preview modal
                this.previewService.showPreview(
                    result.originalContent || content,
                    result.output,
                    actionName,
                    async () => {
                        // User accepted - apply the result
                        const applyResult = await this.actionHandler.applyResult(actionType, context, result.output!);
                        if (applyResult.success) {
                            new Notice(`${actionName} 完成`);
                            this.addToHistory(actionType, actionName, file, applyResult, isSelection);
                        }
                    },
                    () => {
                        new Notice('已取消操作');
                    }
                );
            } else {
                const applyResult = await this.actionHandler.applyResult(actionType, context, result.output);
                if (applyResult.success) {
                    new Notice(`${actionName} 完成`);
                    this.addToHistory(actionType, actionName, file, applyResult, isSelection);
                    await this.statisticsService.recordSuccess(actionName, result.tokensUsed ? {
                        prompt: 0,
                        completion: 0,
                        total: result.tokensUsed
                    } : undefined);
                }
            }
        } else {
            this.statusBarService.setError(result.error || '未知错误');
            new Notice(`操作失败: ${result.error}`);
            await this.statisticsService.recordFailure();
        }
    }

    /**
     * Execute a custom prompt
     */
    async executeCustomPrompt(promptId: string): Promise<void> {
        const prompt = this.customPromptsService.getById(promptId);
        if (!prompt) {
            new Notice('Prompt 不存在');
            return;
        }

        const file = this.app.workspace.getActiveFile();
        if (!file) {
            new Notice('没有打开的笔记');
            return;
        }

        if (!(file instanceof TFile)) {
            new Notice('当前文件不是笔记');
            return;
        }

        const content = await this.app.vault.read(file);
        const selectedText = this.getSelectedText();
        const isSelection = !!selectedText && prompt.outputMode === 'selection';

        const context = {
            notePath: file.path,
            noteContent: content,
            noteTitle: file.basename,
            selectedText,
            selectionFrom: isSelection ? this.getSelectionPosition('from') : undefined,
            selectionTo: isSelection ? this.getSelectionPosition('to') : undefined,
            isSelection
        };

        this.statusBarService.setProcessing(prompt.name);
        new Notice(`正在执行: ${prompt.name}...`);

        const result = await this.actionHandler.execute('custom', context, prompt);

        if (result.success) {
            this.statusBarService.setCompleted(result.tokensUsed);
            new Notice(`${prompt.name} 完成`);
            this.addToHistory('custom', prompt.name, file, result, isSelection);
        } else {
            this.statusBarService.setError(result.error || '未知错误');
            new Notice(`操作失败: ${result.error}`);
        }
    }

    /**
     * Get action display name
     */
    getActionDisplayName(actionId: string, customPromptId?: string): string {
        if (actionId === 'custom' && customPromptId) {
            const prompt = this.customPromptsService.getById(customPromptId);
            return prompt?.name || '自定义';
        }

        const names: Record<string, string> = {
            summarize: '总结',
            outline: '大纲',
            translate: '翻译',
            format: '格式化',
            mindmap: '思维导图',
            mermaid: 'Mermaid'
        };
        return names[actionId] || actionId;
    }

    /**
     * Send current note to Claudian
     */
    async sendToClaudian(instruction?: string): Promise<void> {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            new Notice('没有打开的笔记');
            return;
        }

        if (!(file instanceof TFile)) {
            new Notice('当前文件不是笔记');
            return;
        }

        const selectedText = this.getSelectedText();
        if (selectedText) {
            await this.sendSelectionToClaudian(selectedText, instruction);
        } else {
            await this.claudianService.sendNoteToClaudian(file, instruction);
        }
    }

    /**
     * Send selected text to Claudian
     */
    async sendSelectionToClaudian(selectedText: string, instruction?: string): Promise<void> {
        await this.claudianService.sendSelectionToClaudian(selectedText, instruction);
    }

    /**
     * Show preset import modal
     */
    private showPresetImportModal() {
        new PresetImportModal(
            this.app,
            getCategorizedPresets(),
            async (selectedPresets) => {
                let imported = 0;
                for (const preset of selectedPresets) {
                    this.customPromptsService.add(preset);
                    imported++;
                }
                await this.saveSettings();
                this.refreshCustomPromptCommands();
                new Notice(`已导入 ${imported} 个预设 Prompt`);
            }
        ).open();
    }

    /**
     * Get selected text from active editor
     */
    private getSelectedText(): string | undefined {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return undefined;

        const editor = view.editor;
        if (!editor) return undefined;

        const selection = editor.getSelection();
        return selection || undefined;
    }

    private getSelectionPosition(which: 'from' | 'to'): { line: number; ch: number } | undefined {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        return view?.editor.getCursor(which);
    }

    /**
     * Get display name for action
     */
    private getActionName(action: ActionType): string {
        const names: Record<ActionType, string> = {
            summarize: '总结',
            outline: '生成大纲',
            translate: '翻译',
            format: '格式化',
            mindmap: '思维导图',
            mermaid: 'Mermaid 思维导图',
            custom: '自定义处理'
        };
        return names[action] || '处理';
    }

    /**
     * Add entry to history
     */
    private addToHistory(action: ActionType, actionName: string, file: TFile, result: any, isSelection: boolean = false): void {
        const entry: HistoryEntry = {
            id: `history-${Date.now()}`,
            action,
            actionName,
            notePath: file.path,
            noteTitle: file.basename,
            timestamp: Date.now(),
            success: result.success,
            outputPath: result.outputPath,
            isSelection,
            tokensUsed: result.tokensUsed?.total
        };

        this.history.unshift(entry);
        if (this.history.length > 20) {
            this.history.pop();
        }
    }

    /**
     * Get history entries
     */
    getHistory(): HistoryEntry[] {
        return this.history;
    }

    /**
     * Check if Claudian is available
     */
    isClaudianAvailable(): boolean {
        return this.claudianService.isAvailable();
    }

    /**
     * Activate sidebar view
     */
    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }
}

/**
 * Sidebar View
 */
class WorkbenchView extends ItemView {
    private plugin: AIWorkbenchPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: AIWorkbenchPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'AI Workbench';
    }

    getIcon(): string {
        return 'sparkles';
    }

    async onOpen() {
        this.render();
    }

    private render() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('ai-workbench');

        // Header
        const header = container.createDiv({ cls: 'ai-workbench-header' });
        header.createEl('h2', { text: 'AI 工作台' });

        // Current note info
        const noteInfo = container.createDiv({ cls: 'ai-workbench-note-info' });
        this.updateNoteInfo(noteInfo);

        // Quick actions
        const actionsContainer = container.createDiv({ cls: 'ai-workbench-actions' });
        actionsContainer.createEl('h3', { text: '快捷操作' });

        const buttonsContainer = actionsContainer.createDiv({ cls: 'ai-workbench-buttons' });

        const actions: { type: ActionType; label: string }[] = [
            { type: 'summarize', label: '总结' },
            { type: 'outline', label: '大纲' },
            { type: 'translate', label: '翻译' },
            { type: 'format', label: '格式化' },
            { type: 'mindmap', label: '思维导图' },
            { type: 'mermaid', label: 'Mermaid' }
        ];

        for (const action of actions) {
            const btn = buttonsContainer.createEl('button', {
                cls: 'ai-workbench-action-btn',
                text: action.label
            });
            btn.addEventListener('click', () => {
                const selectedText = this.plugin['getSelectedText']();
                this.plugin.executeAction(action.type, !!selectedText);
            });
        }

        // Custom Prompts - grouped by category
        const customPrompts = this.plugin.getCustomPromptsService().getAll();
        if (customPrompts.length > 0) {
            // Group prompts by category
            const grouped = this.groupByCategory(customPrompts);

            for (const [categoryId, prompts] of grouped) {
                const category = PRESET_CATEGORIES.find(c => c.id === categoryId) || {
                    id: categoryId,
                    name: categoryId === 'uncategorized' ? '未分类' : categoryId,
                    icon: '📌',
                    description: ''
                };

                const categoryContainer = container.createDiv({ cls: 'ai-workbench-category' });

                // Category header
                const header = categoryContainer.createDiv({ cls: 'ai-workbench-category-header' });
                header.createEl('span', {
                    text: `${category.icon} ${category.name}`,
                    cls: 'category-title'
                });

                // Buttons
                const buttonsContainer = categoryContainer.createDiv({ cls: 'ai-workbench-buttons' });

                for (const prompt of prompts) {
                    const btn = buttonsContainer.createEl('button', {
                        cls: 'ai-workbench-action-btn custom',
                        text: prompt.name
                    });
                    btn.addEventListener('click', () => {
                        this.plugin.executeCustomPrompt(prompt.id);
                    });
                }
            }
        }

        // Claudian section
        if (this.plugin.settings.claudian.showButton) {
            const claudianContainer = container.createDiv({ cls: 'ai-workbench-claudian' });
            claudianContainer.createEl('h3', { text: '高级操作' });

            if (this.plugin.isClaudianAvailable()) {
                const sendNoteBtn = claudianContainer.createEl('button', {
                    cls: 'ai-workbench-claudian-btn primary',
                    text: '📤 发送到 Claudian'
                });
                sendNoteBtn.addEventListener('click', () => {
                    this.plugin.sendToClaudian();
                });

                const sendWithInstructionBtn = claudianContainer.createEl('button', {
                    cls: 'ai-workbench-claudian-btn',
                    text: '✏️ 发送并附带指令'
                });
                sendWithInstructionBtn.addEventListener('click', () => {
                    this.showInstructionDialog();
                });
            } else {
                const notAvailable = claudianContainer.createDiv({ cls: 'ai-workbench-claudian-unavailable' });
                notAvailable.createEl('span', { text: 'Claudian 插件未安装或未启用' });
            }

            // Backup management
            const backupBtn = claudianContainer.createEl('button', {
                cls: 'ai-workbench-claudian-btn',
                text: '📦 备份管理'
            });
            backupBtn.addEventListener('click', () => {
                this.plugin.getBackupManager().showBackupModal();
            });
        }

        // History
        const historyContainer = container.createDiv({ cls: 'ai-workbench-history' });
        historyContainer.createEl('h3', { text: '最近操作' });
        const historyList = historyContainer.createDiv({ cls: 'ai-workbench-history-list' });
        this.renderHistory(historyList);

        // Refresh on file change
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.updateNoteInfo(noteInfo);
            })
        );
    }

    private groupByCategory(prompts: CustomPrompt[]): Map<string, CustomPrompt[]> {
        const grouped = new Map<string, CustomPrompt[]>();

        // Initialize all categories in order
        for (const cat of PRESET_CATEGORIES) {
            grouped.set(cat.id, []);
        }
        grouped.set('uncategorized', []);

        // Group prompts
        for (const prompt of prompts) {
            const cat = prompt.category || 'uncategorized';
            if (!grouped.has(cat)) {
                grouped.set(cat, []);
            }
            grouped.get(cat)!.push(prompt);
        }

        // Remove empty categories and return in order
        const result = new Map<string, CustomPrompt[]>();
        for (const [catId, prompts] of grouped) {
            if (prompts.length > 0) {
                result.set(catId, prompts);
            }
        }

        return result;
    }

    private updateNoteInfo(container: HTMLElement) {
        container.empty();
        const file = this.app.workspace.getActiveFile();
        if (file) {
            container.createEl('span', { text: '当前笔记: ' });
            container.createEl('strong', { text: file.basename });
        } else {
            container.createEl('span', { text: '未打开笔记', cls: 'muted' });
        }
    }

    private renderHistory(container: HTMLElement) {
        container.empty();
        const history = this.plugin.getHistory();

        if (history.length === 0) {
            container.createEl('p', { text: '暂无操作记录', cls: 'muted' });
            return;
        }

        for (const entry of history.slice(0, 5)) {
            const item = container.createDiv({ cls: 'ai-workbench-history-item' });
            const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });

            item.createEl('span', { text: time, cls: 'time' });
            item.createEl('span', { text: entry.actionName + (entry.isSelection ? ' (选)' : '') });
            item.createEl('span', { text: entry.noteTitle, cls: 'note' });

            if (entry.success) {
                item.createEl('span', { text: '✓', cls: 'success' });
            } else {
                item.createEl('span', { text: '✗', cls: 'error' });
            }
        }
    }

    private showInstructionDialog() {
        const modal = new InstructionModal(this.app, (instruction) => {
            this.plugin.sendToClaudian(instruction);
        });
        modal.open();
    }

    async onClose() {
        // Cleanup
    }
}

/**
 * Simple instruction input modal
 */
class InstructionModal extends Modal {
    private onSubmit: (instruction: string) => void;
    private instruction: string = '';

    constructor(app: App, onSubmit: (instruction: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-modal');

        contentEl.createEl('h3', { text: '发送到 Claudian' });

        new Setting(contentEl)
            .setName('附加指令')
            .setDesc('输入你想让 Claudian 执行的操作')
            .addText(text => text
                .setPlaceholder('例如：帮我重写这一段...')
                .onChange((value) => {
                    this.instruction = value;
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => {
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('发送')
                .setCta()
                .onClick(() => {
                    this.onSubmit(this.instruction);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Preset Import Modal
 */
class PresetImportModal extends Modal {
    private categorizedPresets: any[];
    private onImport: (selected: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
    private selected: Set<string> = new Set(); // Use preset name as key
    private allPresets: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    constructor(
        app: App,
        categorizedPresets: any[],
        onImport: (selected: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>[]) => void
    ) {
        super(app);
        this.categorizedPresets = categorizedPresets;
        this.onImport = onImport;

        // Flatten all presets
        for (const cat of categorizedPresets) {
            for (const preset of cat.presets) {
                this.allPresets.push(preset);
            }
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-preset-modal');

        contentEl.createEl('h3', { text: '导入预设 Prompt' });

        // Select all / none
        const actionsBar = contentEl.createDiv({ cls: 'preset-actions' });
        actionsBar.createEl('button', { text: '全选' }, btn => {
            btn.addEventListener('click', () => {
                for (const p of this.allPresets) {
                    this.selected.add(p.name);
                }
                this.renderCategories(container);
            });
        });
        actionsBar.createEl('button', { text: '全不选' }, btn => {
            btn.addEventListener('click', () => {
                this.selected.clear();
                this.renderCategories(container);
            });
        });

        // Preset categories
        const container = contentEl.createDiv({ cls: 'preset-categories' });
        this.renderCategories(container);

        // Import button
        const footerSetting = new Setting(contentEl);
        footerSetting.controlEl.createEl('span', { text: `已选择 ${this.selected.size} 个`, cls: 'preset-count' });
        footerSetting
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('导入')
                .setCta()
                .onClick(() => {
                    const selectedPresets = this.allPresets.filter(p => this.selected.has(p.name));
                    this.onImport(selectedPresets);
                    this.close();
                }));
    }

    private renderCategories(container: HTMLElement) {
        container.empty();

        for (const cat of this.categorizedPresets) {
            const section = container.createDiv({ cls: 'preset-category' });

            // Category header
            const header = section.createDiv({ cls: 'preset-category-header' });
            header.createEl('span', { text: cat.category.icon + ' ' + cat.category.name, cls: 'preset-category-name' });
            header.createEl('span', { text: cat.category.description, cls: 'preset-category-desc' });

            // Category presets
            const list = section.createDiv({ cls: 'preset-category-list' });

            for (const preset of cat.presets) {
                const item = list.createDiv({
                    cls: 'preset-item' + (this.selected.has(preset.name) ? ' selected' : '')
                });

                const checkbox = item.createEl('input', { type: 'checkbox' });
                checkbox.checked = this.selected.has(preset.name);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        this.selected.add(preset.name);
                    } else {
                        this.selected.delete(preset.name);
                    }
                    item.toggleClass('selected', checkbox.checked);
                    this.updateCount();
                });

                const info = item.createDiv({ cls: 'preset-info' });
                info.createEl('strong', { text: preset.name });
                info.createEl('p', { text: preset.description, cls: 'preset-desc' });
            }
        }
    }

    private updateCount() {
        const countEl = this.contentEl.querySelector('.preset-count');
        if (countEl) {
            countEl.textContent = `已选择 ${this.selected.size} 个`;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Statistics Modal
 */
class StatisticsModal extends Modal {
    private stats: any;
    private summary: any;
    private onReset: () => void;

    constructor(app: App, stats: any, summary: any, onReset: () => void) {
        super(app);
        this.stats = stats;
        this.summary = summary;
        this.onReset = onReset;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-stats-modal');

        contentEl.createEl('h2', { text: '📊 使用统计' });

        // Overview
        const overview = contentEl.createDiv({ cls: 'stats-overview' });

        const createStatCard = (label: string, value: string) => {
            const card = overview.createDiv({ cls: 'stat-card' });
            card.createEl('div', { text: value, cls: 'stat-value' });
            card.createEl('div', { text: label, cls: 'stat-label' });
        };

        createStatCard('总请求数', this.summary.totalRequests.toString());
        createStatCard('成功率', this.summary.successRate);
        createStatCard('总 Token', this.summary.totalTokens);
        createStatCard('预估费用', this.stats.totalTokensUsed ? '$' + ((this.stats.totalTokensUsed / 1000000) * 0.15).toFixed(4) : '$0');

        // Top Actions
        if (this.summary.topActions.length > 0) {
            const actionsSection = contentEl.createDiv({ cls: 'stats-section' });
            actionsSection.createEl('h3', { text: '常用操作' });

            for (const item of this.summary.topActions) {
                const row = actionsSection.createDiv({ cls: 'stats-row' });
                row.createEl('span', { text: item.action });
                row.createEl('span', { text: item.count + ' 次', cls: 'stats-count' });
            }
        }

        // Details
        const details = contentEl.createDiv({ cls: 'stats-section' });
        details.createEl('h3', { text: '详细统计' });

        const detailsList = details.createDiv({ cls: 'stats-details' });
        detailsList.createEl('p', { text: `Prompt Tokens: ${this.stats.promptTokens.toLocaleString()}` });
        detailsList.createEl('p', { text: `Completion Tokens: ${this.stats.completionTokens.toLocaleString()}` });
        detailsList.createEl('p', { text: `失败请求: ${this.stats.failedRequests}` });

        const lastReset = new Date(this.stats.lastReset).toLocaleDateString('zh-CN');
        detailsList.createEl('p', { text: `统计开始: ${lastReset}`, cls: 'muted' });

        // Actions
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('重置统计')
                .setWarning()
                .onClick(async () => {
                    this.onReset();
                    this.close();
                }))
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
