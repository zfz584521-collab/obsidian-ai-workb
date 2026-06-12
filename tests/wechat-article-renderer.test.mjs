import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/article-renderer.ts', import.meta.url)
);

test('replaces existing blocks by default without mutating source', async () => {
    const { renderIllustratedArticle } = await importTypeScript(entry);
    const block = '📷 图片描述：写作场景\n🎨 AI提示词：warm writing scene';
    const source = `# 标题\n\n${block}\n\n正文`;
    const original = `${source}`;
    const task = {
        id: 'existing-01',
        prompt: 'warm writing scene',
        description: '写作场景',
        sourceBlock: {
            startOffset: source.indexOf(block),
            endOffset: source.indexOf(block) + block.length
        },
        anchor: { placement: 'after' }
    };

    const rendered = renderIllustratedArticle(source, [{
        task,
        assetPath: '文章-已配图-assets/image-01.png'
    }], { keepOriginalPrompts: false });

    assert.match(rendered, /!\[\[文章-已配图-assets\/image-01\.png\]\]/);
    assert.doesNotMatch(rendered, /AI提示词/);
    assert.equal(source, original);
});

test('keeps prompt blocks when configured and applies multiple offsets safely', async () => {
    const { renderIllustratedArticle } = await importTypeScript(entry);
    const first = '🎨 AI提示词：first';
    const second = '🎨 AI提示词：second';
    const source = `${first}\n\n正文\n\n${second}`;
    const makeResult = (block, index) => ({
        task: {
            id: `existing-0${index}`,
            prompt: block,
            sourceBlock: {
                startOffset: source.indexOf(block),
                endOffset: source.indexOf(block) + block.length
            },
            anchor: { placement: 'after' }
        },
        assetPath: `assets/image-0${index}.png`
    });

    const rendered = renderIllustratedArticle(
        source,
        [makeResult(first, 1), makeResult(second, 2)],
        { keepOriginalPrompts: true }
    );

    assert.match(rendered, /AI提示词：first[\s\S]*image-01\.png/);
    assert.match(rendered, /AI提示词：second[\s\S]*image-02\.png/);
});

test('inserts generated images around exact nearby text within a heading', async () => {
    const { renderIllustratedArticle } = await importTypeScript(entry);
    const source = '# 开头\n引言\n\n## 为什么写作\n写作帮助我们整理思考。\n后续内容';
    const task = {
        id: 'generated-01',
        prompt: 'writing',
        anchor: {
            heading: '为什么写作',
            nearbyText: '写作帮助我们整理思考。',
            placement: 'after'
        }
    };

    const rendered = renderIllustratedArticle(source, [{
        task,
        assetPath: 'assets/image-01.png'
    }], { keepOriginalPrompts: false });

    assert.match(rendered, /写作帮助我们整理思考。\n\n!\[\[assets\/image-01\.png\]\]/);
});

test('keeps failed existing prompts and sanitizes failure details', async () => {
    const { renderIllustratedArticle } = await importTypeScript(entry);
    const block = '🎨 AI提示词：failed';
    const source = `${block}\n\n正文`;
    const task = {
        id: 'existing-01',
        prompt: 'failed',
        sourceBlock: { startOffset: 0, endOffset: block.length },
        anchor: { placement: 'after' }
    };

    const rendered = renderIllustratedArticle(source, [{
        task,
        error: 'Bearer sk-secret-value\n完整 provider response body'
    }], { keepOriginalPrompts: false });

    assert.match(rendered, /AI提示词：failed/);
    assert.match(rendered, /\[!warning\] 配图生成失败/);
    assert.doesNotMatch(rendered, /sk-secret-value|provider response body/);
});

test('appends unmatched generated results to one fallback section', async () => {
    const { renderIllustratedArticle } = await importTypeScript(entry);
    const source = '# 标题\n正文';
    const results = [
        {
            task: {
                id: 'generated-01',
                prompt: 'one',
                description: '第一张',
                anchor: { nearbyText: '不存在一', placement: 'after' }
            },
            assetPath: 'assets/image-01.png'
        },
        {
            task: {
                id: 'generated-02',
                prompt: 'two',
                anchor: { nearbyText: '不存在二', placement: 'after' }
            },
            error: 'timeout'
        }
    ];

    const rendered = renderIllustratedArticle(
        source,
        results,
        { keepOriginalPrompts: false }
    );

    assert.equal((rendered.match(/## 配图/g) || []).length, 1);
    assert.match(rendered, /image-01\.png/);
    assert.match(rendered, /\[!warning\] 配图生成失败/);
});
