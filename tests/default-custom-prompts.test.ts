import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getDefaultSidebarPrompts,
    withDefaultSidebarPrompts
} from '../src/services/default-custom-prompts';

test('default sidebar prompts include the early feature categories without secret settings', () => {
    const prompts = getDefaultSidebarPrompts();
    const names = new Set(prompts.map(prompt => prompt.name));
    const categories = new Set(prompts.map(prompt => prompt.category));

    for (const category of ['basic', 'xiaohongshu', 'video', 'wechat', 'translate', 'other']) {
        assert.ok(categories.has(category), `expected ${category} defaults`);
    }

    for (const name of [
        '润色文章',
        '扩写内容',
        '短视频脚本',
        '公众号完整排版',
        '中译英',
        'SEO 优化标题'
    ]) {
        assert.ok(names.has(name), `expected ${name} default prompt`);
    }

    assert.equal(categories.has('code'), false, 'code prompts should stay opt-in');
    assert.equal(JSON.stringify(prompts).includes('apiKey'), false, 'defaults must not include API keys');
    assert.equal(JSON.stringify(prompts).includes('appSecret'), false, 'defaults must not include account secrets');
});

test('default sidebar prompts are merged without duplicating existing user prompts', () => {
    const [defaultPrompt] = getDefaultSidebarPrompts();
    const existing = {
        ...defaultPrompt,
        id: 'user-imported-copy',
        prompt: 'user customized prompt'
    };

    const merged = withDefaultSidebarPrompts([existing]);
    const matches = merged.filter(prompt =>
        prompt.category === defaultPrompt.category && prompt.name === defaultPrompt.name
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].prompt, 'user customized prompt');
});

test('deleted default sidebar prompts stay deleted after settings reload', () => {
    const [defaultPrompt] = getDefaultSidebarPrompts();

    const merged = withDefaultSidebarPrompts([], [defaultPrompt.id]);

    assert.equal(merged.some(prompt => prompt.id === defaultPrompt.id), false);
});
