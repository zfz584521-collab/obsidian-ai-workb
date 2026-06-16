import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/publishing/wechat-renderer.ts', import.meta.url)
);

test('renders WeChat paragraphs with spacious mobile reading styles', async () => {
    const { renderWeChatArticleHtml } = await importTypeScript(entry);
    const html = renderWeChatArticleHtml([
        '你平时怎么用AI？是不是问一句、拿答案、关窗口，第二天又像失忆一样从头再问？这种只烧Token不积累的做法，其实把AI的巨大潜力浪费了。今天分享一套方法，价值不是教会你用某个软件，而是帮AI变成一台持续长大的知识基础设施。',
        '',
        '这套方法适用于投资研究、医学常识、竞品分析，甚至哲学思考。只要你坚持喂一个月，系统就会变成深度互联的资源网。'
    ].join('\n'), new Map());

    const paragraphs = html.match(/<p style="[^"]+">[^<]+<\/p>/g) || [];
    assert.ok(paragraphs.length >= 3);
    assert.match(html, /line-height:\s*1\.9/);
    assert.match(html, /margin:\s*0 0 18px/);
    assert.match(html, /font-size:\s*16px/);
    for (const paragraph of paragraphs) {
        const text = paragraph.replace(/<[^>]+>/g, '');
        assert.ok(text.length <= 140);
    }
});

test('renders headings as numbered WeChat section cards', async () => {
    const { renderWeChatArticleHtml } = await importTypeScript(entry);
    const html = renderWeChatArticleHtml('## 为什么这种用法突然火了？\n\n正文内容。', new Map());

    assert.match(html, /data-section-index="1"/);
    assert.match(html, /background:\s*#f5f8ff/);
    assert.match(html, /border-left:\s*4px solid #2f80ed/);
    assert.match(html, /01/);
    assert.match(html, /为什么这种用法突然火了？/);
});

test('renders standalone bold lines as WeChat section cards', async () => {
    const { renderWeChatArticleHtml } = await importTypeScript(entry);
    const html = renderWeChatArticleHtml('**Daily three steps**\n\nBody content.', new Map());

    assert.match(html, /data-section-index="1"/);
    assert.match(html, /background:\s*#f5f8ff/);
    assert.match(html, /01/);
    assert.match(html, /Daily three steps/);
    assert.doesNotMatch(html, /<p[^>]+><strong>Daily three steps/);
});

test('renders uploaded images with centered layout and italic captions', async () => {
    const { renderWeChatArticleHtml } = await importTypeScript(entry);
    const html = renderWeChatArticleHtml([
        '![[image-01.png]]',
        '',
        '*一张对比图，左边是混乱对话，右边是有结构的知识网络。*'
    ].join('\n'), new Map([['image-01.png', 'https://mmbiz.qpic.cn/image-01.png']]));

    assert.match(html, /<section[^>]+data-image-block="true"/);
    assert.match(html, /text-align:\s*center/);
    assert.match(html, /<img src="https:\/\/mmbiz\.qpic\.cn\/image-01\.png"/);
    assert.match(html, /max-width:\s*100%/);
    assert.match(html, /data-caption="true"/);
    assert.match(html, /一张对比图/);
});
