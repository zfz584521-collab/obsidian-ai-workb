/**
 * Undo Service - Undo last AI operation
 */

import { App, TFile, Notice } from 'obsidian';
import { BackupManager } from './backup-manager';
import { HistoryEntry } from '../types';

export class UndoService {
    private app: App;
    private backupManager: BackupManager;
    private getHistory: () => HistoryEntry[];

    constructor(
        app: App,
        backupManager: BackupManager,
        getHistory: () => HistoryEntry[]
    ) {
        this.app = app;
        this.backupManager = backupManager;
        this.getHistory = getHistory;
    }

    /**
     * Undo the last successful operation
     */
    async undoLast(): Promise<boolean> {
        const history = this.getHistory();

        // Find the last successful operation
        const lastOp = history.find(h => h.success);
        if (!lastOp) {
            new Notice('没有可撤销的操作');
            return false;
        }

        // Get the backup file
        const backups = await this.backupManager.listBackups();
        const noteName = lastOp.noteTitle;
        const recentBackup = backups.find(b =>
            (b.originalPath === lastOp.notePath ||
                (!b.originalPath && b.originalFile === noteName)) &&
            b.createdAt.getTime() <= lastOp.timestamp
        );

        if (!recentBackup) {
            new Notice('未找到备份文件');
            return false;
        }

        // Restore from backup
        const file = this.app.vault.getAbstractFileByPath(lastOp.notePath);
        if (!(file instanceof TFile)) {
            new Notice('文件不存在');
            return false;
        }

        const success = await this.backupManager.restore(recentBackup.path, lastOp.notePath);

        if (success) {
            new Notice(`已撤销: ${lastOp.actionName}`);
            return true;
        }

        return false;
    }

    /**
     * Undo a specific operation
     */
    async undoOperation(entry: HistoryEntry): Promise<boolean> {
        if (!entry.success) {
            new Notice('该操作失败，无需撤销');
            return false;
        }

        const backups = await this.backupManager.listBackups();
        const noteName = entry.noteTitle;
        const backup = backups.find(b =>
            (b.originalPath === entry.notePath ||
                (!b.originalPath && b.originalFile === noteName)) &&
            Math.abs(b.createdAt.getTime() - entry.timestamp) < 60000 // Within 1 minute
        );

        if (!backup) {
            new Notice('未找到对应的备份文件');
            return false;
        }

        const file = this.app.vault.getAbstractFileByPath(entry.notePath);
        if (!(file instanceof TFile)) {
            new Notice('文件不存在');
            return false;
        }

        const success = await this.backupManager.restore(backup.path, entry.notePath);

        if (success) {
            new Notice(`已撤销: ${entry.actionName}`);
            return true;
        }

        return false;
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        const history = this.getHistory();
        return history.some(h => h.success);
    }
}
