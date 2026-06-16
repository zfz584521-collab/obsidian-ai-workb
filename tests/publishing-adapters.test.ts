import assert from 'node:assert/strict';
import test from 'node:test';
import {
    PublishingAdapterFactory,
    UnavailableOfficialAdapter,
    WeChatOfficialAdapter,
    WebhookPlatformAdapter,
    YouTubeOfficialAdapter
} from '../src/publishing/adapters';
import {
    PlatformPublishRequest,
    PlatformSettings,
    PublishingPlatform
} from '../src/publishing/types';
import { WebhookClient } from '../src/publishing/webhook';

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers }
    });
}

const webhookSettings: PlatformSettings = {
    enabled: true,
    connectionType: 'webhook',
    official: {},
    webhook: {
        url: 'https://relay/draft',
        mediaUploadUrl: 'https://relay/media',
        authType: 'none',
        token: '',
        headers: {},
        signingSecret: ''
    },
    defaults: {}
};

function requestFor(
    platform: PublishingPlatform,
    settings: PlatformSettings
): PlatformPublishRequest {
    return {
        taskId: 'task-1',
        idempotencyKey: `idem-${platform}`,
        platform,
        content: {
            sourcePath: 'Notes/example.md',
            title: 'Title',
            bodyMarkdown: '# Heading\n\nBody',
            cover: {
                kind: 'image',
                source: 'vault',
                path: 'cover.png',
                name: 'cover.png',
                mimeType: 'image/png',
                data: new Uint8Array([1, 2, 3]).buffer
            },
            images: [],
            video: platform === 'youtube' ? {
                kind: 'video',
                source: 'vault',
                path: 'video.mp4',
                name: 'video.mp4',
                mimeType: 'video/mp4',
                data: new Uint8Array([4, 5, 6]).buffer
            } : undefined,
            tags: ['tag']
        },
        settings
    };
}

test('adapter factory selects Webhook for every configured platform', () => {
    const factory = new PublishingAdapterFactory(new WebhookClient());
    for (const platform of [
        'wechat',
        'xiaohongshu',
        'wechatChannels',
        'douyin',
        'x',
        'youtube'
    ] as PublishingPlatform[]) {
        assert.ok(factory.create(platform, webhookSettings) instanceof WebhookPlatformAdapter);
    }
});

test('official factory supports WeChat and YouTube only', () => {
    const factory = new PublishingAdapterFactory(new WebhookClient());
    const officialSettings = { ...webhookSettings, connectionType: 'official' as const };
    assert.ok(factory.create('wechat', officialSettings) instanceof WeChatOfficialAdapter);
    assert.ok(factory.create('youtube', officialSettings) instanceof YouTubeOfficialAdapter);
    assert.ok(factory.create('x', officialSettings) instanceof UnavailableOfficialAdapter);
});

test('unavailable official adapter returns an actionable validation issue', async () => {
    const settings = { ...webhookSettings, connectionType: 'official' as const };
    const adapter = new UnavailableOfficialAdapter('x');
    assert.deepEqual(await adapter.validate(requestFor('x', settings)), [{
        code: 'OFFICIAL_API_UNAVAILABLE',
        field: 'connectionType',
        message: 'X 当前不提供本插件可用的草稿接口，请改用 Webhook'
    }]);
});

test('WeChat official adapter uploads cover before creating a native draft', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.includes('/cgi-bin/token')) return jsonResponse({ access_token: 'access-token' });
        if (url.includes('/material/add_material')) return jsonResponse({ media_id: 'cover-media-id' });
        return jsonResponse({ media_id: 'draft-id' });
    };
    const settings: PlatformSettings = {
        ...webhookSettings,
        connectionType: 'official',
        official: { appId: 'wx-id', appSecret: 'wx-secret', author: 'Author' }
    };

    const result = await new WeChatOfficialAdapter(fetchFn)
        .createDraft(requestFor('wechat', settings));

    assert.equal(result.success, true);
    assert.equal(result.targetKind, 'native-draft');
    assert.deepEqual(calls.map(call => call.url.includes('/cgi-bin/')
        ? call.url.match(/\/cgi-bin\/([^?]+)/)?.[1]
        : ''), ['token', 'material/add_material', 'draft/add']);
    const draftBody = JSON.parse(String(calls[2].init?.body));
    assert.equal(draftBody.articles[0].thumb_media_id, 'cover-media-id');
    assert.match(draftBody.articles[0].content, /line-height:\s*1\.9/);
    assert.match(draftBody.articles[0].content, /data-section-index="1"/);
    assert.doesNotMatch(JSON.stringify(result), /wx-secret|access-token/);
});

test('YouTube official adapter initializes a private resumable upload', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url === 'https://oauth2.googleapis.com/token') {
            return jsonResponse({ access_token: 'youtube-access-token' });
        }
        if (url.includes('uploadType=resumable')) {
            return new Response(null, {
                status: 200,
                headers: { Location: 'https://upload.youtube/session-1' }
            });
        }
        return jsonResponse({ id: 'video-id' });
    };
    const settings: PlatformSettings = {
        ...webhookSettings,
        connectionType: 'official',
        official: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            refreshToken: 'refresh-token'
        }
    };

    const result = await new YouTubeOfficialAdapter(fetchFn)
        .createDraft(requestFor('youtube', settings));

    assert.equal(result.success, true);
    assert.equal(result.targetKind, 'private-upload');
    const metadata = JSON.parse(String(calls[1].init?.body));
    assert.equal(metadata.status.privacyStatus, 'private');
    assert.equal(calls[2].url, 'https://upload.youtube/session-1');
    assert.doesNotMatch(JSON.stringify(result), /client-secret|refresh-token|youtube-access-token/);
});

test('official authentication failures are sanitized and not retryable', async () => {
    const settings: PlatformSettings = {
        ...webhookSettings,
        connectionType: 'official',
        official: {
            clientId: 'client-id',
            clientSecret: 'very-secret',
            refreshToken: 'refresh-secret'
        }
    };
    const result = await new YouTubeOfficialAdapter(async () =>
        jsonResponse({ error_description: 'refresh-secret invalid' }, 401)
    ).createDraft(requestFor('youtube', settings));

    assert.equal(result.error?.code, 'YOUTUBE_AUTH_FAILED');
    assert.equal(result.error?.retryable, false);
    assert.doesNotMatch(result.error?.message || '', /refresh-secret|very-secret/);
});

test('YouTube official validation rejects a remote-only video', async () => {
    const settings: PlatformSettings = {
        ...webhookSettings,
        connectionType: 'official',
        official: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            refreshToken: 'refresh-token'
        }
    };
    const request = requestFor('youtube', settings);
    request.content.video = {
        kind: 'video',
        source: 'remote',
        path: 'https://example.com/video.mp4',
        name: 'video.mp4',
        remoteUrl: 'https://example.com/video.mp4'
    };

    assert.equal(
        (await new YouTubeOfficialAdapter().validate(request))[0].code,
        'LOCAL_MEDIA_NOT_LOADED'
    );
});
