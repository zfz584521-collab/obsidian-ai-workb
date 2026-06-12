import assert from 'node:assert/strict';
import test from 'node:test';
import { PublishingService, PublishTaskInput } from '../src/publishing/service';
import { mergePublishingSettings } from '../src/publishing/defaults';
import {
    ConnectionTestResult,
    PlatformAdapter,
    PlatformCapabilities,
    PlatformPublishRequest,
    PlatformPublishResult,
    PublishingHistoryEntry,
    PublishingPlatform,
    ValidationIssue
} from '../src/publishing/types';

class FakeAdapter implements PlatformAdapter {
    createCalls = 0;
    active = 0;
    maxActive = 0;

    constructor(
        public platform: PublishingPlatform,
        private results: PlatformPublishResult[],
        private issues: ValidationIssue[] = [],
        private delayMs = 0
    ) {}

    getCapabilities(): PlatformCapabilities {
        return {
            targetKind: 'webhook-draft',
            supportsImages: true,
            supportsVideo: true
        };
    }

    async validate(): Promise<ValidationIssue[]> {
        return this.issues;
    }

    async testConnection(): Promise<ConnectionTestResult> {
        return { success: true, message: 'ok' };
    }

    async createDraft(): Promise<PlatformPublishResult> {
        this.createCalls += 1;
        this.active += 1;
        this.maxActive = Math.max(this.maxActive, this.active);
        if (this.delayMs) {
            await new Promise(resolve => setTimeout(resolve, this.delayMs));
        }
        this.active -= 1;
        return this.results[Math.min(this.createCalls - 1, this.results.length - 1)];
    }
}

function success(platform: PublishingPlatform): PlatformPublishResult {
    return {
        platform,
        success: true,
        targetKind: 'webhook-draft',
        draftId: `${platform}-draft`
    };
}

function failure(
    platform: PublishingPlatform,
    retryable = false
): PlatformPublishResult {
    return {
        platform,
        success: false,
        error: {
            code: 'RELAY_FAILED',
            message: 'relay failed',
            retryable
        }
    };
}

function inputFor(platforms: PublishingPlatform[]): PublishTaskInput {
    return {
        content: {
            sourcePath: 'Notes/example.md',
            title: 'Title',
            bodyMarkdown: 'Body',
            images: [],
            tags: []
        },
        overrides: {},
        platforms
    };
}

function createService(
    adapters: Partial<Record<PublishingPlatform, FakeAdapter>>,
    saved: PublishingHistoryEntry[] = []
) {
    const historyWrites: PublishingHistoryEntry[][] = [];
    const settings = mergePublishingSettings({
        platforms: Object.fromEntries(
            Object.keys(adapters).map(platform => [platform, { enabled: true }])
        )
    });
    const service = new PublishingService(
        settings,
        {
            create(platform: PublishingPlatform): PlatformAdapter {
                const adapter = adapters[platform];
                if (!adapter) throw new Error(`Missing adapter: ${platform}`);
                return adapter;
            }
        },
        async entries => {
            historyWrites.push(entries);
        },
        async () => {},
        saved,
        () => 'task-1'
    );
    return { service, historyWrites };
}

test('publishAll keeps successful platforms when another platform fails', async () => {
    const { service } = createService({
        wechat: new FakeAdapter('wechat', [success('wechat')]),
        x: new FakeAdapter('x', [failure('x')])
    });

    const result = await service.publishAll(inputFor(['wechat', 'x']));
    assert.equal(result.results.wechat?.success, true);
    assert.equal(result.results.x?.success, false);
    assert.equal(result.status, 'partial');
});

test('validation failure prevents adapter execution', async () => {
    const adapter = new FakeAdapter('wechat', [success('wechat')]);
    const { service } = createService({ wechat: adapter });
    const input = inputFor(['wechat']);
    input.content.title = '';

    const result = await service.publishAll(input);
    assert.equal(adapter.createCalls, 0);
    assert.equal(result.results.wechat?.error?.code, 'TITLE_REQUIRED');
});

test('retryable failures retry at most twice', async () => {
    const adapter = new FakeAdapter('wechat', [
        failure('wechat', true),
        failure('wechat', true),
        success('wechat')
    ]);
    const { service } = createService({ wechat: adapter });

    const result = await service.publishAll(inputFor(['wechat']));
    assert.equal(result.status, 'success');
    assert.equal(adapter.createCalls, 3);
});

test('non-retryable failures do not retry', async () => {
    const adapter = new FakeAdapter('wechat', [failure('wechat', false)]);
    const { service } = createService({ wechat: adapter });

    await service.publishAll(inputFor(['wechat']));
    assert.equal(adapter.createCalls, 1);
});

test('retryFailed submits failed platforms only and reuses idempotency keys', async () => {
    const wechat = new FakeAdapter('wechat', [success('wechat')]);
    const x = new FakeAdapter('x', [failure('x'), success('x')]);
    const { service } = createService({ wechat, x });
    const previous = await service.publishAll(inputFor(['wechat', 'x']));
    const previousKey = previous.requests.x?.idempotencyKey;

    const retried = await service.retryFailed(previous);
    assert.deepEqual(retried.platforms, ['x']);
    assert.equal(retried.requests.x?.idempotencyKey, previousKey);
    assert.equal(wechat.createCalls, 1);
    assert.equal(x.createCalls, 2);
});

test('publishing runs no more than three platform adapters concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const adapters = {} as Record<PublishingPlatform, FakeAdapter>;
    for (const platform of [
        'wechat', 'xiaohongshu', 'wechatChannels', 'douyin', 'x', 'youtube'
    ] as PublishingPlatform[]) {
        const adapter = new FakeAdapter(platform, [success(platform)]);
        adapter.createDraft = async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 10));
            active -= 1;
            return success(platform);
        };
        adapters[platform] = adapter;
    }
    const { service } = createService(adapters);

    await service.publishAll(inputFor(Object.keys(adapters) as PublishingPlatform[]));
    assert.equal(maxActive, 3);
});

test('saved history omits content, media data, requests, and settings', async () => {
    const { service, historyWrites } = createService({
        wechat: new FakeAdapter('wechat', [success('wechat')])
    });

    await service.publishAll(inputFor(['wechat']));
    const serialized = JSON.stringify(historyWrites.at(-1));
    assert.doesNotMatch(serialized, /bodyMarkdown|requests|settings|Body/);
    assert.match(serialized, /wechat-draft/);
});

test('an adapter exception does not cancel other platforms', async () => {
    const broken = new FakeAdapter('x', [failure('x')]);
    broken.createDraft = async () => {
        throw new Error('unexpected adapter error');
    };
    const { service } = createService({
        wechat: new FakeAdapter('wechat', [success('wechat')]),
        x: broken
    });

    const result = await service.publishAll(inputFor(['wechat', 'x']));
    assert.equal(result.status, 'partial');
    assert.equal(result.results.wechat?.success, true);
    assert.equal(result.results.x?.error?.code, 'ADAPTER_ERROR');
});
