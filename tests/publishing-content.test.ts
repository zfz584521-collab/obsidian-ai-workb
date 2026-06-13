import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyPlatformOverride,
    createIdempotencyKey,
    extractTitle,
    findMediaReferences,
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
