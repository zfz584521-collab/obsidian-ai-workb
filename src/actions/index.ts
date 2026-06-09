/**
 * Action handlers
 */

import { App, TFile, Notice, MarkdownView } from 'obsidian';
import { AIService } from '../services/ai';
import { BackupService } from '../services/backup';
import { FileService } from '../services/file';
import { ActionType, ActionContext, ActionResult, WorkbenchSettings, BUILTIN_PROMPTS, CustomPrompt } from '../types';
import { MAX_SELECTION_OFFSET } from '../constants';

export interface ExecuteOptions {
    previewOnly?: boolean;
}

export class ActionHandler {
    private app: App;
    private aiService: AIService;
    private backupService: BackupService;
    private fileService: FileService;
    private settings: WorkbenchSettings;

    constructor(
        app: App,
        aiService: AIService,
        backupService: BackupService,
        fileService: FileService,
        settings: WorkbenchSettings
    ) {
        this.app = app;
        this.aiService = aiService;
        this.backupService = backupService;
        this.fileService = fileService;
        this.settings = settings;
    }

    async execute(
        actionType: ActionType,
        context: ActionContext,
        customPrompt?: CustomPrompt,
        options: ExecuteOptions = {}
    ): Promise<ActionResult & { originalContent?: string }> {
        const timestamp = Date.now();

        try {
            // Get prompt for action
            const prompt = this.getPrompt(actionType, customPrompt);

            // Get content to process (prefer selected text if available)
            const content = context.isSelection && context.selectedText
                ? context.selectedText
                : (context.selectedText || context.noteContent);

            // Call AI
            const response = await this.aiService.chat(prompt, content);

            if (!response.success || !response.content) {
                return {
                    success: false,
                    error: response.error || 'AI 处理失败',
                    timestamp
                };
            }

            // Determine output mode
            const outputMode = customPrompt?.outputMode || this.getDefaultOutputMode(actionType, context.isSelection);

            // If preview only, return without writing
            if (options.previewOnly) {
                return {
                    success: true,
                    output: response.content,
                    timestamp,
                    originalContent: content,
                    tokensUsed: response.tokensUsed?.total
                };
            }

            // Handle output
            const file = this.getTargetFile(context.notePath);
            const outputPath = await this.handleOutput(outputMode, file, response.content, actionType, context, customPrompt);

            return {
                success: true,
                output: response.content,
                outputPath,
                timestamp,
                originalContent: content,
                tokensUsed: response.tokensUsed?.total
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            new Notice(`操作失败: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage,
                timestamp
            };
        }
    }

    /**
     * Apply the result after preview
     */
    async applyResult(
        actionType: ActionType,
        context: ActionContext,
        output: string,
        customPrompt?: CustomPrompt
    ): Promise<ActionResult> {
        const timestamp = Date.now();

        try {
            const file = this.getTargetFile(context.notePath);
            const outputMode = customPrompt?.outputMode || this.getDefaultOutputMode(actionType, context.isSelection);
            const outputPath = await this.handleOutput(outputMode, file, output, actionType, context, customPrompt);

            return {
                success: true,
                output,
                outputPath,
                timestamp
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return {
                success: false,
                error: errorMessage,
                timestamp
            };
        }
    }

    /**
     * Handle output based on mode - extracted to reduce code duplication
     */
    private async handleOutput(
        outputMode: 'append' | 'prepend' | 'newFile' | 'replace' | 'selection',
        file: TFile,
        content: string,
        actionType: ActionType,
        context: ActionContext,
        customPrompt?: CustomPrompt
    ): Promise<string | undefined> {
        // If processing selection with 'selection' mode, replace the selected text
        if (context.isSelection && outputMode === 'selection') {
            await this.backupService.backup(file);
            await this.replaceSelection(context, content);
            return undefined;
        }

        switch (outputMode) {
            case 'append':
                await this.backupService.backup(file);
                await this.fileService.append(file, content, this.getSectionTitle(actionType, customPrompt));
                return undefined;

            case 'prepend':
                await this.backupService.backup(file);
                await this.fileService.prepend(file, content, this.getSectionTitle(actionType, customPrompt));
                return undefined;

            case 'replace':
                await this.backupService.backup(file);
                await this.fileService.replace(file, content);
                return undefined;

            case 'newFile':
                const suffix = this.getOutputSuffix(actionType, customPrompt);
                const newFile = await this.fileService.createNewFile(file, suffix, content);
                return newFile.path;

            case 'selection':
                // Handled above
                return undefined;

            default:
                return undefined;
        }
    }

    /**
     * Replace selected text in the editor
     */
    private async replaceSelection(context: ActionContext, newContent: string): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.file?.path !== context.notePath) {
            throw new Error('原笔记已不在活动编辑器中，请重新执行操作');
        }

        const editor = view.editor;
        if (!editor || !context.selectionFrom || !context.selectionTo) {
            throw new Error('编辑器不可用');
        }

        // Check if the current content matches the expected selection
        const currentText = editor.getRange(context.selectionFrom, context.selectionTo);

        if (currentText !== context.selectedText) {
            // Content has changed - try to find the original text in the document
            const fullContent = editor.getValue();
            const originalIndex = fullContent.indexOf(context.selectedText);

            if (originalIndex === -1) {
                // Original text not found anywhere in the document
                throw new Error('原选区内容已被修改或删除，无法替换。请撤销更改后重试。');
            }

            // Found the text but position changed
            // Calculate the offset to see how much the position shifted
            const originalPos = editor.posToOffset(context.selectionFrom);
            const foundPos = originalIndex;

            if (Math.abs(foundPos - originalPos) > MAX_SELECTION_OFFSET) {
                // Position shifted significantly - warn the user
                throw new Error(`检测到内容位置变化（偏移 ${Math.abs(foundPos - originalPos)} 字符），为安全起见已取消操作。请重新选择文本后重试。`);
            }

            // Small shift might be acceptable, but we still notify
            console.warn('[AI Workbench] Selection position shifted by', foundPos - originalPos, 'characters');
        }

        // Perform the replacement
        editor.replaceRange(newContent, context.selectionFrom, context.selectionTo);
    }

    private getTargetFile(notePath: string): TFile {
        const file = this.app.vault.getAbstractFileByPath(notePath);
        if (!(file instanceof TFile)) {
            throw new Error('目标笔记不存在');
        }
        return file;
    }

    private getPrompt(actionType: ActionType, customPrompt?: CustomPrompt): string {
        if (actionType === 'custom' && customPrompt) {
            return customPrompt.prompt;
        }
        return BUILTIN_PROMPTS[actionType] || BUILTIN_PROMPTS.summarize;
    }

    private getDefaultOutputMode(actionType: ActionType, isSelection: boolean): 'append' | 'prepend' | 'newFile' | 'replace' | 'selection' {
        if (isSelection) {
            return 'selection';
        }

        switch (actionType) {
            case 'summarize':
                return this.settings.output.summaryPosition;
            case 'outline':
            case 'mindmap':
            case 'mermaid':
                return 'append';
            case 'translate':
                return 'newFile';
            case 'format':
                return 'replace';
            default:
                return 'append';
        }
    }

    private getSectionTitle(actionType: ActionType, customPrompt?: CustomPrompt): string {
        if (customPrompt) {
            return customPrompt.name;
        }
        const titles: Record<ActionType, string> = {
            summarize: 'AI 总结',
            outline: '目录',
            translate: '翻译',
            format: '格式化',
            mindmap: '思维导图',
            mermaid: 'Mermaid 思维导图',
            custom: 'AI 处理'
        };
        return titles[actionType] || 'AI 处理';
    }

    private getOutputSuffix(actionType: ActionType, customPrompt?: CustomPrompt): string {
        if (customPrompt) {
            return customPrompt.name.toLowerCase().replace(/[^a-z0-9一-龥]/g, '-');
        }
        const suffixes: Record<ActionType, string> = {
            summarize: 'summary',
            outline: 'outline',
            translate: 'translated',
            format: 'formatted',
            mindmap: 'mindmap',
            mermaid: 'mermaid',
            custom: 'ai'
        };
        return suffixes[actionType] || 'ai';
    }
}
