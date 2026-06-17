import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildXiaohongshuFormattingPrompt,
    DEFAULT_XIAOHONGSHU_FORMATTING_RULES,
    parseXiaohongshuFormattedDraft
} from '../src/xiaohongshu/formatting';

test('buildXiaohongshuFormattingPrompt uses default visual rules when custom rules are empty', () => {
    const prompt = buildXiaohongshuFormattingPrompt('');

    assert.match(prompt, /小红书/);
    assert.match(prompt, /开头钩子/);
    assert.match(prompt, /#相关标签/);
    assert.match(prompt, /5 个标题候选/);
    assert.match(prompt, new RegExp(DEFAULT_XIAOHONGSHU_FORMATTING_RULES.split('\n')[0]));
});

test('buildXiaohongshuFormattingPrompt prioritizes user custom rules', () => {
    const prompt = buildXiaohongshuFormattingPrompt('每段不超过 30 字\n必须使用园艺口吻');

    assert.match(prompt, /每段不超过 30 字/);
    assert.match(prompt, /必须使用园艺口吻/);
    assert.doesNotMatch(prompt, /吸睛标题\s*\n\s*\n开头/);
});

test('parseXiaohongshuFormattedDraft extracts title body and hash tags', () => {
    const draft = parseXiaohongshuFormattedDraft(`标题选项：
1. 今天才知道的排版技巧
2. 手机阅读排版秘诀
3. 小红书这样排才好看
4. 排版别再乱来了
5. 这份排版模板收好

正文：
今天才知道的排版技巧

开头要短，先把痛点讲清楚。

✨ 重点一
手机上阅读要多换行。

#小红书运营 #排版`);

    assert.equal(draft.title, '今天才知道的排版技巧');
    assert.deepEqual(draft.titleOptions, [
        '今天才知道的排版技巧',
        '手机阅读排版秘诀',
        '小红书这样排才好看',
        '排版别再乱来了',
        '这份排版模板收好'
    ]);
    assert.match(draft.bodyMarkdown, /✨ 重点一/);
    assert.doesNotMatch(draft.bodyMarkdown, /标题选项/);
    assert.deepEqual(draft.tags, ['小红书运营', '排版']);
});
