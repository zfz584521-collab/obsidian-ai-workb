/**
 * Shortcuts Service - Manage keyboard shortcuts
 */

import { App, Plugin } from 'obsidian';
import { ShortcutSettings, ShortcutBinding } from '../types';

export class ShortcutsService {
    private app: App;
    private plugin: Plugin;
    private settings: ShortcutSettings;
    private registeredShortcuts: Map<string, () => void> = new Map();
    private keydownHandlers: Set<(evt: KeyboardEvent) => void> = new Set();

    constructor(app: App, plugin: Plugin, settings: ShortcutSettings) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
    }

    updateSettings(settings: ShortcutSettings) {
        this.settings = settings;
    }

    /**
     * Register all shortcuts
     */
    registerAll(executeAction: (actionId: string, customPromptId?: string) => void) {
        if (!this.settings.enabled) return;

        this.clearAll();

        for (const binding of this.settings.bindings) {
            this.register(binding, executeAction);
        }
    }

    /**
     * Register a single shortcut
     */
    private register(binding: ShortcutBinding, executeAction: (actionId: string, customPromptId?: string) => void) {
        const key = this.getShortcutKey(binding);

        // Use Obsidian's built-in keymap system
        const handler = (evt: KeyboardEvent) => {
            if (this.matchesBinding(evt, binding)) {
                evt.preventDefault();
                evt.stopPropagation();
                executeAction(binding.actionId, binding.customPromptId);
            }
        };
        document.addEventListener('keydown', handler);
        this.keydownHandlers.add(handler);

        this.registeredShortcuts.set(key, () => executeAction(binding.actionId, binding.customPromptId));
    }

    /**
     * Check if keyboard event matches a binding
     */
    private matchesBinding(evt: KeyboardEvent, binding: ShortcutBinding): boolean {
        // Check key
        if (evt.key.toLowerCase() !== binding.key.toLowerCase()) {
            return false;
        }

        // Check modifiers
        const mods = binding.modifiers || [];

        const hasCtrl = evt.ctrlKey || evt.metaKey;
        const hasAlt = evt.altKey;
        const hasShift = evt.shiftKey;

        const needsCtrl = mods.includes('Ctrl');
        const needsAlt = mods.includes('Alt');
        const needsShift = mods.includes('Shift');

        if (hasCtrl !== needsCtrl) return false;
        if (hasAlt !== needsAlt) return false;
        if (hasShift !== needsShift) return false;

        return true;
    }

    /**
     * Clear all registered shortcuts
     */
    clearAll() {
        for (const handler of this.keydownHandlers) {
            document.removeEventListener('keydown', handler);
        }
        this.keydownHandlers.clear();
        this.registeredShortcuts.clear();
    }

    /**
     * Get unique key for a binding
     */
    private getShortcutKey(binding: ShortcutBinding): string {
        const mods = (binding.modifiers || []).sort().join('+');
        return `${mods}+${binding.key}`;
    }

    /**
     * Add a new shortcut binding
     */
    addBinding(binding: ShortcutBinding): boolean {
        // Check for duplicate
        const exists = this.settings.bindings.some(
            b => this.getShortcutKey(b) === this.getShortcutKey(binding)
        );
        if (exists) return false;

        this.settings.bindings.push(binding);
        return true;
    }

    /**
     * Remove a shortcut binding
     */
    removeBinding(index: number): boolean {
        if (index < 0 || index >= this.settings.bindings.length) return false;
        this.settings.bindings.splice(index, 1);
        return true;
    }

    /**
     * Update a shortcut binding
     */
    updateBinding(index: number, binding: ShortcutBinding): boolean {
        if (index < 0 || index >= this.settings.bindings.length) return false;
        this.settings.bindings[index] = binding;
        return true;
    }

    /**
     * Get display string for a binding
     */
    getBindingDisplay(binding: ShortcutBinding): string {
        const parts: string[] = [];
        const mods = binding.modifiers || [];

        // Platform-specific modifier display
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        if (mods.includes('Ctrl')) {
            parts.push(isMac ? '⌘' : 'Ctrl');
        }
        if (mods.includes('Alt')) {
            parts.push(isMac ? '⌥' : 'Alt');
        }
        if (mods.includes('Shift')) {
            parts.push(isMac ? '⇧' : 'Shift');
        }

        parts.push(binding.key.toUpperCase());

        return parts.join(' + ');
    }
}
