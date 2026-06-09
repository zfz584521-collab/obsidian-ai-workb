/**
 * Action handlers
 */

import { App, TFile, Notice, MarkdownView } from 'obsidian';
import { AIService } from '../services/ai';
import { BackupService } from '../services/backup';
import { FileService } from '../services/file';
import { ActionType, ActionContext, ActionResult, WorkbenchSettings, BUILTIN_PROMPTS, CustomPrompt } from '../types';

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
            let outputPath: string | undefined;

            // If processing selection with 'selection' mode, replace the selected text
            if (context.isSelection && outputMode === 'selection') {
                await this.backupService.backup(file);
                await this.replaceSelection(context, response.content);
            } else {
                switch (outputMode) {
                    case 'append':
                        await this.backupService.backup(file);
                        const sectionTitle = this.getSectionTitle(actionType, customPrompt);
                        await this.fileService.append(file, response.content, sectionTitle);
                        break;

                    case 'prepend':
                        await this.backupService.backup(file);
                        await this.fileService.prepend(file, response.content, this.getSectionTitle(actionType, customPrompt));
                        break;

                    case 'replace':
                        await this.backupService.backup(file);
                        await this.fileService.replace(file, response.content);
                        break;

                    case 'newFile':
                        const suffix = this.getOutputSuffix(actionType, customPrompt);
                        const newFile = await this.fileService.createNewFile(file, suffix, response.content);
                        outputPath = newFile.path;
                        break;

                    case 'selection':
                        // Handled above
                        break;
                }
            }

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
            let outputPath: string | undefined;

            const outputMode = customPrompt?.outputMode || this.getDefaultOutputMode(actionType, context.isSelection);

            if (context.isSelection && outputMode === 'selection') {
                await this.backupService.backup(file);
                await this.replaceSelection(context, output);
            } else {
                switch (outputMode) {
                    case 'append':
                        await this.backupService.backup(file);
                        const sectionTitle = this.getSectionTitle(actionType, customPrompt);
                        await this.fileService.append(file, output, sectionTitle);
                        break;

                    case 'prepend':
                        await this.backupService.backup(file);
                        await this.fileService.prepend(file, output, this.getSectionTitle(actionType, customPrompt));
                        break;

                    case 'replace':
                        await this.backupService.backup(file);
                        await this.fileService.replace(file, output);
                        break;

                    case 'newFile':
                        const suffix = this.getOutputSuffix(actionType, customPrompt);
                        const newFile = await this.fileService.createNewFile(file, suffix, output);
                        outputPath = newFile.path;
                        break;
                }
            }

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

        const currentText = editor.getRange(context.selectionFrom, context.selectionTo);
        if (currentText !== context.selectedText) {
            throw new Error('原选区已发生变化，请重新执行操作');
        }

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
