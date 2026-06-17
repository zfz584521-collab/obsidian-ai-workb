import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyPlatformOverride,
    createIdempotencyKey,
    extractTitle,
    extractTitleOptions,
    findMediaReferences,
    preparePublishBody,
    stripFrontmatter
} from '../src/publishing/content';
import {
    validateCommonContent,
    validatePlatformConfiguration,
    validateServiceUrl
} from '../src/publishing/validation';
import { PlatformSettings, PublishContent } from '../src/publishing/types';

const baseContent: PublishContent = {
    sourcePath: 'Notes/example.md',
    title: 'Base title',
    bodyMarkdown: 'Base body',
    images: [],
    tags: ['base']
};

const webhookSettings: PlatformSettings = {
    enabled: true,
    connectionType: 'webhook',
    official: {},
    webhook: {
        url: 'https://relay.example.com/draft',
        mediaUploadUrl: '',
        authType: 'none',
        token: '',
        headers: {},
        signingSecret: ''
    },
    defaults: {}
};

test('extractTitle follows frontmatter, h1, then filename priority', () => {
    assert.equal(extractTitle('# Heading\nBody', 'File name', 'Frontmatter'), 'Frontmatter');
    assert.equal(extractTitle('# Heading\nBody', 'File name'), 'Heading');
    assert.equal(extractTitle('Body', 'File name'), 'File name');
});

test('stripFrontmatter removes only the leading frontmatter block', () => {
    assert.equal(
        stripFrontmatter('---\ntitle: Example\n---\n# Heading\n---\nBody'),
        '# Heading\n---\nBody'
    );
});

test('extractTitleOptions reads article-provided title candidates before body marker', () => {
    const markdown = [
        '标题选项：',
        '1. 别再拿 AI 当搜索引擎了',
        '2、用 Claude 和 Obsidian 搭建第二大脑',
        '- 让知识库自己长大的方法',
        '',
        '【正文】',
        '',
        '真正的正文'
    ].join('\n');

    assert.deepEqual(extractTitleOptions(markdown, 'fallback'), [
        '别再拿 AI 当搜索引擎了',
        '用 Claude 和 Obsidian 搭建第二大脑',
        '让知识库自己长大的方法'
    ]);
});

test('extractTitleOptions reads numbered Chinese title labels before opening marker', () => {
    const markdown = [
        '标题候选：',
        '标题一：Obsidian网页剪藏工具完全教程：从零基础到高效',
        '标题二：收藏不是学习，Obsidian Web Clipper 才是知识入口',
        '标题三：让网页剪藏真正变成自己的知识',
        '',
        '【开头】',
        '正文内容'
    ].join('\n');

    assert.deepEqual(extractTitleOptions(markdown, 'fallback'), [
        'Obsidian网页剪藏工具完全教程：从零基础到高效',
        '收藏不是学习，Obsidian Web Clipper 才是知识入口',
        '让网页剪藏真正变成自己的知识'
    ]);
});

test('extractTitleOptions reads titles from decorative title option sections', () => {
    const markdown = [
        '# 2万字超长实战 Karpathy 的 LLM Wiki！别再把 AI 当聊天工具了',
        '',
        '—— 标题选项 ——',
        '1. Karpathy都在用的外脑搭建法：Claude+Obsidian，让你的知识自动复利',
        '2. 别再问完就忘了！手把手教你搭一个越问越聪明的个人知识库',
        '3. 给 AI 配一个“无限记忆卡”：零基础搭建会自我繁殖的第二大脑',
        '',
        '—— 正文 ——',
        '',
        '【开头】',
        '正文内容'
    ].join('\n');

    assert.deepEqual(extractTitleOptions(markdown, 'fallback').slice(0, 3), [
        'Karpathy都在用的外脑搭建法：Claude+Obsidian，让你的知识自动复利',
        '别再问完就忘了！手把手教你搭一个越问越聪明的个人知识库',
        '给 AI 配一个“无限记忆卡”：零基础搭建会自我繁殖的第二大脑'
    ]);
});

test('preparePublishBody removes body marker and all planning content above it', () => {
    const markdown = [
        '标题选项：',
        '1. 候选标题',
        '',
        '摘要：这部分不应该进正文',
        '',
        '【正文】',
        '',
        '## 第一节',
        '',
        '正文内容'
    ].join('\n');

    assert.equal(preparePublishBody(markdown), '## 第一节\n\n正文内容');
});

test('preparePublishBody uses opening marker as body start and removes structural markers', () => {
    const markdown = [
        '标题候选：',
        '标题一：候选标题',
        '',
        '【开头】',
        '开头正文',
        '',
        '【结尾】',
        '结尾正文'
    ].join('\n');

    assert.equal(preparePublishBody(markdown), '开头正文\n\n结尾正文');
});

test('preparePublishBody treats decorative正文 divider as body start', () => {
    const markdown = [
        '—— 标题选项 ——',
        '1. 候选标题',
        '',
        '—— 正文 ——',
        '',
        '【开头】',
        '正文内容'
    ].join('\n');

    assert.equal(preparePublishBody(markdown), '正文内容');
});

test('findMediaReferences reads wiki embeds and markdown images', () => {
    assert.deepEqual(findMediaReferences(
        '![[assets/cover.png]]\n![Alt](https://example.com/a.jpg)\n![[clip.mp4]]'
    ), [
        { kind: 'image', path: 'assets/cover.png', source: 'vault' },
        { kind: 'image', path: 'https://example.com/a.jpg', source: 'remote' },
        { kind: 'video', path: 'clip.mp4', source: 'vault' }
    ]);
});

test('findMediaReferences tolerates malformed URL encoding', () => {
    assert.deepEqual(findMediaReferences('![[assets/100%cover.png]]'), [{
        kind: 'image',
        path: 'assets/100%cover.png',
        source: 'vault'
    }]);
});

test('applyPlatformOverride only replaces explicit fields', () => {
    const merged = applyPlatformOverride(baseContent, {
        title: 'X title',
        cover: null
    });

    assert.equal(merged.title, 'X title');
    assert.equal(merged.bodyMarkdown, baseContent.bodyMarkdown);
    assert.equal(merged.cover, undefined);
    assert.notEqual(merged.tags, baseContent.tags);
});

test('createIdempotencyKey is stable and platform specific', async () => {
    const first = await createIdempotencyKey('task-1', 'wechat', baseContent);
    const second = await createIdempotencyKey('task-1', 'wechat', baseContent);
    const otherPlatform = await createIdempotencyKey('task-1', 'x', baseContent);

    assert.equal(first, second);
    assert.notEqual(first, otherPlatform);
    assert.match(first, /^task-1-wechat-[a-f0-9]{64}$/);
});

test('validateServiceUrl permits HTTPS and local HTTP only', () => {
    assert.equal(validateServiceUrl('https://relay.example.com'), true);
    assert.equal(validateServiceUrl('http://localhost:8787'), true);
    assert.equal(validateServiceUrl('http://127.0.0.1:8787'), true);
    assert.equal(validateServiceUrl('http://relay.example.com'), false);
});

test('validateCommonContent requires title and either body or video', () => {
    assert.deepEqual(
        validateCommonContent({ ...baseContent, title: '', bodyMarkdown: '' }).map(issue => issue.code),
        ['TITLE_REQUIRED', 'CONTENT_REQUIRED']
    );
});

test('webhook configuration requires media URL when local media exists', () => {
    const content: PublishContent = {
        ...baseContent,
        images: [{
            kind: 'image',
            source: 'vault',
            path: 'assets/image.png',
            name: 'image.png'
        }]
    };

    assert.deepEqual(
        validatePlatformConfiguration('wechat', webhookSettings, content).map(issue => issue.code),
        ['MEDIA_UPLOAD_URL_REQUIRED']
    );
});

test('unsupported official mode returns an actionable issue', () => {
    assert.deepEqual(
        validatePlatformConfiguration('x', {
            ...webhookSettings,
            connectionType: 'official'
        }, baseContent),
        [{
            code: 'OFFICIAL_API_UNAVAILABLE',
            field: 'connectionType',
            message: 'X 当前不提供本插件可用的草稿接口，请改用 Webhook'
        }]
    );
});
