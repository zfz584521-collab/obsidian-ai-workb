/**
 * Custom Prompts Service - Manage user-defined prompt templates
 */

import { CustomPrompt, CustomPromptSettings } from '../types';
import { ICustomPromptsService } from '../interfaces';

export class CustomPromptsService implements ICustomPromptsService {
    private settings: CustomPromptSettings;

    constructor(settings: CustomPromptSettings) {
        this.settings = settings;
    }

    updateSettings(settings: CustomPromptSettings) {
        this.settings = settings;
    }

    /**
     * Get all custom prompts
     */
    getAll(): CustomPrompt[] {
        return this.settings.prompts || [];
    }

    /**
     * Get a specific prompt by ID
     */
    getById(id: string): CustomPrompt | undefined {
        return this.settings.prompts.find(p => p.id === id);
    }

    /**
     * Add a new custom prompt
     */
    add(prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): CustomPrompt {
        const newPrompt: CustomPrompt = {
            ...prompt,
            id: this.generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.settings.prompts.push(newPrompt);
        return newPrompt;
    }

    /**
     * Update an existing prompt
     */
    update(id: string, updates: Partial<Omit<CustomPrompt, 'id' | 'createdAt'>>): CustomPrompt | null {
        const index = this.settings.prompts.findIndex(p => p.id === id);
        if (index === -1) return null;

        this.settings.prompts[index] = {
            ...this.settings.prompts[index],
            ...updates,
            updatedAt: Date.now()
        };

        return this.settings.prompts[index];
    }

    /**
     * Delete a prompt
     */
    delete(id: string): boolean {
        const index = this.settings.prompts.findIndex(p => p.id === id);
        if (index === -1) return false;

        this.settings.prompts.splice(index, 1);
        return true;
    }

    /**
     * Reorder prompts
     */
    reorder(fromIndex: number, toIndex: number): void {
        if (fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= this.settings.prompts.length || toIndex >= this.settings.prompts.length) return;

        const [item] = this.settings.prompts.splice(fromIndex, 1);
        this.settings.prompts.splice(toIndex, 0, item);
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Import prompts from JSON
     */
    import(data: CustomPrompt[]): number {
        let imported = 0;
        for (const prompt of data) {
            try {
                this.add({
                    name: prompt.name,
                    description: prompt.description || '',
                    prompt: prompt.prompt,
                    outputMode: prompt.outputMode || 'append'
                });
                imported++;
            } catch (e) {
                console.error('Failed to import prompt:', prompt, e);
            }
        }
        return imported;
    }

    /**
     * Export prompts to JSON
     */
    export(): CustomPrompt[] {
        return JSON.parse(JSON.stringify(this.settings.prompts));
    }
}
