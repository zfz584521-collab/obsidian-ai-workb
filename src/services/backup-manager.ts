/**
 * Backup Manager Service - List and restore backups
 */

import { App, TFile, Modal, Setting, Notice } from 'obsidian';
import { BackupSettings } from '../types';

interface BackupInfo {
    path: string;
    filename: string;
    originalFile: string;
    originalPath?: string;
    createdAt: Date;
    size: number;
}

export class BackupManager {
    private app: App;
    private settings: BackupSettings;
    private backupDir: string = '.obsidian/plugins/ai-workbench/backups';

    constructor(app: App, settings: BackupSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * List all backups
     */
    async listBackups(): Promise<BackupInfo[]> {
        const vault = this.app.vault;
        const adapter = vault.adapter;

        if (!await adapter.exists(this.backupDir)) {
            return [];
        }

        const files = vault.getFiles();
        const backupFiles = files.filter(f => f.path.startsWith(this.backupDir));

        const backups: BackupInfo[] = [];

        for (const file of backupFiles) {
            const info = this.parseBackupFilename(file.name);
            if (info) {
                backups.push({
                    path: file.path,
                    filename: file.name,
                    originalFile: info.originalFile,
                    originalPath: info.originalPath,
                    createdAt: new Date(file.stat.mtime),
                    size: file.stat.size
                });
            }
        }

        // Sort by date, newest first
        return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    /**
     * Parse backup filename
     */
    private parseBackupFilename(filename: string): { originalFile: string; originalPath?: string } | null {
        // Current format: encoded/path.md--YYYYMMDD-HHMMSSmmm.md
        const currentMatch = filename.match(/^(.+)--(\d{8}-\d{9})\.[^.]+$/);
        if (currentMatch) {
            try {
                const originalPath = decodeURIComponent(currentMatch[1]);
                const originalFile = originalPath.split('/').pop()?.replace(/\.[^.]+$/, '') || originalPath;
                return { originalFile, originalPath };
            } catch {
                return null;
            }
        }

        // Legacy format: originalname-YYYYMMDD-HHMMSS.md
        const match = filename.match(/^(.+)-(\d{8}-\d{6})\.md$/);
        if (!match) return null;

        return {
            originalFile: match[1]
        };
    }

    /**
     * Restore a backup
     */
    async restore(backupPath: string, targetPath: string): Promise<boolean> {
        try {
            const vault = this.app.vault;

            const backupFile = vault.getAbstractFileByPath(backupPath);
            if (!(backupFile instanceof TFile)) {
                new Notice('备份文件不存在');
                return false;
            }

            const content = await vault.read(backupFile);

            const targetFile = vault.getAbstractFileByPath(targetPath);
            if (targetFile instanceof TFile) {
                await vault.modify(targetFile, content);
            } else {
                await vault.create(targetPath, content);
            }

            new Notice('已从备份恢复');
            return true;
        } catch (error) {
            console.error('Restore failed:', error);
            new Notice('恢复失败');
            return false;
        }
    }

    /**
     * Delete a backup
     */
    async delete(backupPath: string): Promise<boolean> {
        try {
            const vault = this.app.vault;
            const file = vault.getAbstractFileByPath(backupPath);

            if (file instanceof TFile) {
                await vault.delete(file);
            }

            return true;
        } catch (error) {
            console.error('Delete backup failed:', error);
            return false;
        }
    }

    /**
     * Clear all backups
     */
    async clearAll(): Promise<number> {
        const backups = await this.listBackups();
        let deleted = 0;

        for (const backup of backups) {
            if (await this.delete(backup.path)) {
                deleted++;
            }
        }

        return deleted;
    }

    /**
     * Show backup manager modal
     */
    showBackupModal(originalPath?: string) {
        new BackupListModal(this.app, this, originalPath).open();
    }
}

/**
 * Backup List Modal
 */
class BackupListModal extends Modal {
    private manager: BackupManager;
    private originalPath?: string;
    private backups: BackupInfo[] = [];

    constructor(app: App, manager: BackupManager, originalPath?: string) {
        super(app);
        this.manager = manager;
        this.originalPath = originalPath;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ai-workbench-backup-modal');

        contentEl.createEl('h3', { text: '备份管理' });

        // Load backups
        this.backups = await this.manager.listBackups();

        // Filter by original file if specified
        const filteredBackups = this.originalPath
            ? this.backups.filter(b =>
                b.originalPath === this.originalPath ||
                (!b.originalPath && b.originalFile === this.originalPath?.replace(/\.md$/, '').split('/').pop())
            )
            : this.backups;

        if (filteredBackups.length === 0) {
            contentEl.createEl('p', { text: '暂无备份', cls: 'muted' });
        } else {
            const list = contentEl.createDiv({ cls: 'backup-list' });

            for (const backup of filteredBackups) {
                const item = list.createDiv({ cls: 'backup-item' });

                const info = item.createDiv({ cls: 'backup-info' });
                info.createEl('strong', { text: backup.originalFile });

                const time = backup.createdAt.toLocaleString('zh-CN');
                info.createEl('span', { text: ` - ${time}`, cls: 'muted' });

                const actions = item.createDiv({ cls: 'backup-actions' });

                actions.createEl('button', { text: '查看' }, btn => {
                    btn.addEventListener('click', async () => {
                        const file = this.app.vault.getAbstractFileByPath(backup.path);
                        if (file instanceof TFile) {
                            await this.app.workspace.getLeaf().openFile(file);
                        }
                    });
                });

                actions.createEl('button', { text: '删除', cls: 'mod-warning' }, btn => {
                    btn.addEventListener('click', async () => {
                        await this.manager.delete(backup.path);
                        new Notice('已删除备份');
                        this.onOpen(); // Refresh
                    });
                });
            }
        }

        // Clear all button
        new Setting(contentEl)
            .setName('清空所有备份')
            .addButton(btn => btn
                .setButtonText('清空')
                .setWarning()
                .onClick(async () => {
                    const count = await this.manager.clearAll();
                    new Notice(`已删除 ${count} 个备份`);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
