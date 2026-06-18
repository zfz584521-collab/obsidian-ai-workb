/**
 * Default sidebar prompts shipped with the plugin.
 *
 * This module intentionally only deals with prompt templates. API keys,
 * endpoints, publishing accounts, and other local secrets stay in data.json.
 */

import { CustomPrompt, DEFAULT_XIAOHONGSHU_AUTOMATION_PROMPTS } from '../types';
import { getAllPresets } from './presets';

const SIDEBAR_DEFAULT_CATEGORIES = new Set([
    'basic',
    'xiaohongshu',
    'video',
    'wechat',
    'translate',
    'other'
]);

function defaultPromptId(prompt: Pick<CustomPrompt, 'category' | 'name'>, index: number): string {
    const category = prompt.category || 'uncategorized';
    return `builtin-${category}-${index + 1}`;
}

export function getDefaultSidebarPrompts(): CustomPrompt[] {
    const presetPrompts = getAllPresets()
        .filter(prompt => SIDEBAR_DEFAULT_CATEGORIES.has(prompt.category || ''))
        .map((prompt, index): CustomPrompt => ({
            ...prompt,
            id: defaultPromptId(prompt, index),
            enabled: true,
            createdAt: 0,
            updatedAt: 0
        }));

    return [
        ...presetPrompts,
        ...DEFAULT_XIAOHONGSHU_AUTOMATION_PROMPTS.map(prompt => ({ ...prompt, enabled: true }))
    ];
}

export function withDefaultSidebarPrompts(prompts: CustomPrompt[] = []): CustomPrompt[] {
    const merged = prompts.map(prompt => ({
        ...prompt,
        enabled: prompt.enabled !== false
    }));

    for (const defaultPrompt of getDefaultSidebarPrompts()) {
        const exists = merged.some(prompt =>
            prompt.id === defaultPrompt.id
            || (
                Boolean(prompt.automationAction)
                && prompt.automationAction === defaultPrompt.automationAction
            )
            || (
                prompt.category === defaultPrompt.category
                && prompt.name === defaultPrompt.name
            )
        );

        if (!exists) {
            merged.push({ ...defaultPrompt });
        }
    }

    return merged;
}
