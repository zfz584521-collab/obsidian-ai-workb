import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/prompt-parser.ts', import.meta.url)
);

test('parses supported prompt blocks in source order with exact metadata offsets', async () => {
    const { parseExistingImageTasks } = await importTypeScript(entry);
    const firstBlock = [
        '【配图 1 - 位置：文章开头】',
        '📍 放置位置：标题下方',
        '📷 图片描述：温暖的工作场景',
        '🎨 **AI绘图提示词**： warm editorial illustration, 16:9'
    ].join('\n');
    const secondBlock = [
        '【配图建议】',
        '图片描述: 蓝色科技流程图',
        '*AI提示词*: clean blue technology diagram'
    ].join('\n');
    const source = [
        '# 标题',
        '开场文字',
        '',
        firstBlock,
        '',
        '## 第一节',
        '正文',
        '',
        secondBlock,
        '',
        '收尾正文'
    ].join('\n');

    const tasks = parseExistingImageTasks(source);

    assert.equal(tasks.length, 2);
    assert.deepEqual(
        tasks.map(({ id, prompt, description, anchor }) => ({
            id,
            prompt,
            description,
            anchor
        })),
        [
            {
                id: 'existing-01',
                prompt: 'warm editorial illustration, 16:9',
                description: '温暖的工作场景',
                anchor: { placement: 'after' }
            },
            {
                id: 'existing-02',
                prompt: 'clean blue technology diagram',
                description: '蓝色科技流程图',
                anchor: { placement: 'after' }
            }
        ]
    );
    assert.deepEqual(tasks[0].sourceBlock, {
        startOffset: source.indexOf(firstBlock),
        endOffset: source.indexOf(firstBlock) + firstBlock.length
    });
    assert.deepEqual(tasks[1].sourceBlock, {
        startOffset: source.indexOf(secondBlock),
        endOffset: source.indexOf(secondBlock) + secondBlock.length
    });
    assert.equal(
        source.slice(tasks[0].sourceBlock.startOffset, tasks[0].sourceBlock.endOffset),
        firstBlock
    );
    assert.equal(
        source.slice(tasks[1].sourceBlock.startOffset, tasks[1].sourceBlock.endOffset),
        secondBlock
    );
});

test('parses standalone AI生图提示词 with emphasis and an English colon', async () => {
    const { parseExistingImageTasks } = await importTypeScript(entry);
    const promptLine = '  🎨 __AI生图提示词__ : cinematic paper-cut city at dawn  ';
    const source = [
        '这里的提示词只是普通叙述，不是图片任务。',
        '',
        promptLine,
        '',
        '# 后续标题',
        '正文'
    ].join('\n');

    const tasks = parseExistingImageTasks(source);

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 'existing-01');
    assert.equal(tasks[0].prompt, 'cinematic paper-cut city at dawn');
    assert.equal(tasks[0].description, undefined);
    assert.deepEqual(tasks[0].sourceBlock, {
        startOffset: source.indexOf(promptLine),
        endOffset: source.indexOf(promptLine) + promptLine.length
    });
});

test('ignores prose mentions and empty prompt values', async () => {
    const { parseExistingImageTasks } = await importTypeScript(entry);
    const source = [
        '写作时可以根据提示词调整语气。',
        '普通句子里提到 AI提示词：也不能成为任务。',
        '',
        '🎨 AI提示词：   ',
        '**AI绘图提示词**: **',
        'AI生图提示词 ：'
    ].join('\n');

    assert.deepEqual(parseExistingImageTasks(source), []);
});

test('includes adjacent metadata before a standalone prompt', async () => {
    const { parseExistingImageTasks } = await importTypeScript(entry);
    const block = [
        '📍 放置位置：第一小节后',
        '📷 图片描述：一张简洁的信息图',
        '🎨 AI提示词：minimal editorial infographic'
    ].join('\n');
    const source = `## 第一小节\n正文\n\n${block}\n\n后续正文`;

    const tasks = parseExistingImageTasks(source);

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].description, '一张简洁的信息图');
    assert.deepEqual(tasks[0].sourceBlock, {
        startOffset: source.indexOf(block),
        endOffset: source.indexOf(block) + block.length
    });
});
