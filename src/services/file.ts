/**
 * File Service - Handles file operations
 */

import { App, TFile, normalizePath } from 'obsidian';
import { OutputSettings } from '../types';
import { MAX_FILENAME_CONFLICT_ATTEMPTS, MARKDOWN_EXTENSION } from '../constants';

export class FileService {
    private app: App;
    private settings: OutputSettings;

    constructor(app: App, settings: OutputSettings) {
        this.app = app;
        this.settings = settings;
    }

    updateSettings(settings: OutputSettings) {
        this.settings = settings;
    }

    /**
     * Append content to the end of a file
     */
    async append(file: TFile, content: string, sectionTitle?: string): Promise<void> {
        const vault = this.app.vault;
        const originalContent = await vault.read(file);

        let newContent = originalContent;

        if (sectionTitle) {
            const timestamp = this.settings.includeTimestamp
                ? ` (${new Date().toLocaleString('zh-CN')})`
                : '';
            newContent += `\n\n---\n\n## ${sectionTitle}${timestamp}\n\n${content}`;
        } else {
            newContent += `\n\n${content}`;
        }

        await vault.modify(file, newContent);
    }

    /**
     * Prepend content to the beginning of a file (after frontmatter)
     */
    async prepend(file: TFile, content: string, sectionTitle?: string): Promise<void> {
        const vault = this.app.vault;
        const originalContent = await vault.read(file);

        let newContent: string;
        let insertPosition = 0;

        // Check for frontmatter
        if (originalContent.startsWith('---')) {
            const secondDash = originalContent.indexOf('---', 3);
            if (secondDash !== -1) {
                insertPosition = secondDash + 3;
            }
        }

        const beforeInsert = originalContent.slice(0, insertPosition);
        const afterInsert = originalContent.slice(insertPosition);

        if (sectionTitle) {
            const timestamp = this.settings.includeTimestamp
                ? ` (${new Date().toLocaleString('zh-CN')})`
                : '';
            newContent = `${beforeInsert}\n\n## ${sectionTitle}${timestamp}\n\n${content}\n\n---\n${afterInsert}`;
        } else {
            newContent = `${beforeInsert}\n\n${content}\n\n${afterInsert}`;
        }

        await vault.modify(file, newContent);
    }

    /**
     * Create a new file with the given content
     */
    async createNewFile(
        originalFile: TFile,
        suffix: string,
        content: string
    ): Promise<TFile> {
        const vault = this.app.vault;
        const parent = originalFile.parent;

        // Generate new filename
        let newFilename = `${originalFile.basename}-${suffix}${MARKDOWN_EXTENSION}`;
        let newPath = parent ? normalizePath(`${parent.path}/${newFilename}`) : newFilename;

        // Check if file exists, add number if needed
        let counter = 1;
        while (await vault.adapter.exists(newPath)) {
            if (counter > MAX_FILENAME_CONFLICT_ATTEMPTS) {
                throw new Error('无法创建新文件：文件名冲突过多，请手动删除部分备份文件');
            }

            newFilename = `${originalFile.basename}-${suffix}-${counter}${MARKDOWN_EXTENSION}`;
            newPath = parent ? normalizePath(`${parent.path}/${newFilename}`) : newFilename;
            counter++;
        }

        // Create the file
        const newFile = await vault.create(newPath, content);
        return newFile;
    }

    /**
     * Get current active note
     */
    getActiveFile(): TFile | null {
        return this.app.workspace.getActiveFile();
    }

    /**
     * Get selected text from the active editor
     */
    getSelectedText(): string | undefined {
        const view = this.app.workspace.getActiveViewOfType(
            // @ts-ignore - MarkdownView is available
            this.app.vault.getMarkdownView?.() || null
        );

        if (!view) return undefined;

        // @ts-ignore
        const editor = view.editor;
        if (!editor) return undefined;

        const selection = editor.getSelection();
        return selection || undefined;
    }

    /**
     * Replace file content entirely
     */
    async replace(file: TFile, content: string): Promise<void> {
        await this.app.vault.modify(file, content);
    }
}
