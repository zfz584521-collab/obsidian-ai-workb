/**
 * Backup Service - Handles file backup before modifications
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { BackupSettings } from '../types';

export class BackupService {
    private app: App;
    private settings: BackupSettings;
    private backupDir: string = '.obsidian/plugins/ai-workbench/backups';

    constructor(app: App, settings: BackupSettings) {
        this.app = app;
        this.settings = settings;
    }

    updateSettings(settings: BackupSettings) {
        this.settings = settings;
    }

    /**
     * Create backup of a file before modification
     */
    async backup(file: TFile): Promise<string | null> {
        if (!this.settings.enabled) {
            return null;
        }

        try {
            // Try Git backup first if enabled
            if (this.settings.useGit) {
                const gitSuccess = await this.gitBackup(file);
                if (gitSuccess) {
                    return 'git';
                }
            }

            // Fall back to file backup
            return await this.fileBackup(file);
        } catch (error) {
            console.error('Backup failed:', error);
            return null;
        }
    }

    /**
     * Attempt to create a Git commit for backup
     */
    private async gitBackup(file: TFile): Promise<boolean> {
        try {
            // Check if obsidian-git plugin is available
            // @ts-ignore - accessing internal plugin
            const gitPlugin = this.app.internalPlugins?.plugins?.['obsidian-git']?.instance;
            if (!gitPlugin) {
                return false;
            }

            // Try to commit
            const content = await this.app.vault.read(file);
            const commitMessage = `backup: ${file.name} - AI Workbench 操作前`;

            // This is a simplified approach - actual implementation may vary
            // depending on obsidian-git's API
            return false; // For now, fall back to file backup
        } catch {
            return false;
        }
    }

    /**
     * Create a timestamped backup file
     */
    private async fileBackup(file: TFile): Promise<string> {
        const vault = this.app.vault;
        const timestamp = this.getTimestamp();
        const fileIdentity = this.getFileIdentity(file.path);
        const backupPath = normalizePath(
            `${this.backupDir}/${fileIdentity}--${timestamp}.${file.extension}`
        );

        // Ensure backup directory exists
        await this.ensureBackupDir();

        // Read original content
        const content = await vault.read(file);

        // Create backup file
        await vault.create(backupPath, content);

        // Clean up old backups
        await this.cleanupOldBackups(file.path);

        return backupPath;
    }

    /**
     * Ensure backup directory exists
     */
    private async ensureBackupDir(): Promise<void> {
        const vault = this.app.vault;
        const adapter = vault.adapter;

        if (!await adapter.exists(this.backupDir)) {
            await vault.createFolder(this.backupDir);
        }
    }

    /**
     * Remove old backups, keeping only the most recent ones
     */
    private async cleanupOldBackups(filePath: string): Promise<void> {
        const vault = this.app.vault;
        const adapter = vault.adapter;

        if (!await adapter.exists(this.backupDir)) {
            return;
        }

        // List all backup files for this note
        const files = vault.getFiles();
        const filePrefix = `${this.getFileIdentity(filePath)}--`;
        const backupFiles = files
            .filter(f => f.path.startsWith(`${this.backupDir}/`) && f.name.startsWith(filePrefix))
            .sort((a, b) => b.stat.mtime - a.stat.mtime);

        // Remove old backups beyond maxCount
        const toRemove = backupFiles.slice(this.settings.maxCount);
        for (const file of toRemove) {
            await vault.delete(file);
        }
    }

    /**
     * Get formatted timestamp for backup filename
     */
    private getTimestamp(): string {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
    }

    private getFileIdentity(filePath: string): string {
        return encodeURIComponent(normalizePath(filePath));
    }

    /**
     * Restore from backup
     */
    async restore(backupPath: string, targetFile: TFile): Promise<boolean> {
        try {
            const vault = this.app.vault;
            const backupFile = vault.getAbstractFileByPath(backupPath);

            if (!(backupFile instanceof TFile)) {
                return false;
            }

            const content = await vault.read(backupFile);
            await vault.modify(targetFile, content);

            return true;
        } catch (error) {
            console.error('Restore failed:', error);
            return false;
        }
    }
}
