# Multi-Platform Draft Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable, multi-platform “publish to draft” workflow for WeChat Official Account, Xiaohongshu, WeChat Channels, Douyin, X, and YouTube.

**Architecture:** Keep platform-neutral publishing logic in focused modules under `src/publishing/`. The Obsidian-facing layer extracts the active note and renders settings/modals, while adapters handle official APIs or a shared Webhook contract. The orchestrator validates and publishes each selected platform independently with stable idempotency keys and lightweight local history.

**Tech Stack:** TypeScript, Obsidian Plugin API, browser `fetch`, Web Crypto API, esbuild, Node.js `node:test`.

---

## File Map

### New production files

- `src/publishing/types.ts`: publishing settings, content, adapter, task, result, and error types.
- `src/publishing/defaults.ts`: default platform settings and deep merge for old `data.json`.
- `src/publishing/content.ts`: title extraction, Markdown media parsing, and platform override merging.
- `src/publishing/validation.ts`: URL, configuration, content, and media validation.
- `src/publishing/webhook.ts`: signed Webhook requests and two-stage media upload.
- `src/publishing/adapters.ts`: adapter factory, Webhook adapter, supported official adapters, and unsupported-official result.
- `src/publishing/service.ts`: concurrency, retry, idempotency, result aggregation, and history sanitization.
- `src/publishing/obsidian-content.ts`: active-note and Vault media loading.
- `src/publishing/modal.ts`: publish editor and per-platform result UI.
- `src/publishing/settings-ui.ts`: platform overview and platform configuration UI.

### Modified production files

- `src/types/index.ts`: add `publishing` to `WorkbenchSettings` and default settings.
- `src/interfaces.ts`: expose publishing service contracts used by the plugin.
- `src/settings.ts`: render the publishing settings section.
- `main.ts`: initialize publishing services, open the publish modal, render workbench controls, and refresh settings.
- `styles.css`: workbench platform grid, modal, settings list, result rows, and responsive behavior.
- `package.json`: add a test script using the existing esbuild dependency.

### New test files

- `tests/run-tests.mjs`: bundle TypeScript tests and run Node’s test runner.
- `tests/publishing-defaults.test.ts`
- `tests/publishing-content.test.ts`
- `tests/publishing-webhook.test.ts`
- `tests/publishing-adapters.test.ts`
- `tests/publishing-service.test.ts`
- `tests/publishing-ui.test.mjs`

## Scope Boundary

The first implementation provides:

- A working Webhook path for all six platforms.
- Direct official support for WeChat Official Account drafts and YouTube private uploads.
- A clear `OFFICIAL_API_UNAVAILABLE` validation error for Xiaohongshu, WeChat Channels, Douyin, and X when “official” is selected, directing the user to Webhook configuration.

This boundary satisfies the approved “official API first, Webhook fallback” architecture without pretending restricted or non-draft APIs are universally available. It does not auto-fallback from official API to Webhook.

---

### Task 1: Test Runner and Publishing Settings Model

**Files:**
- Create: `tests/run-tests.mjs`
- Create: `tests/publishing-defaults.test.ts`
- Create: `src/publishing/types.ts`
- Create: `src/publishing/defaults.ts`
- Modify: `src/types/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the failing settings tests**

Create `tests/publishing-defaults.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PUBLISHING_SETTINGS, mergePublishingSettings } from '../src/publishing/defaults';

test('publishing defaults contain all supported platforms disabled', () => {
    assert.deepEqual(Object.keys(DEFAULT_PUBLISHING_SETTINGS.platforms), [
        'wechat',
        'xiaohongshu',
        'wechatChannels',
        'douyin',
        'x',
        'youtube'
    ]);
    for (const settings of Object.values(DEFAULT_PUBLISHING_SETTINGS.platforms)) {
        assert.equal(settings.enabled, false);
        assert.equal(settings.connectionType, 'webhook');
    }
});

test('mergePublishingSettings preserves nested defaults for old data', () => {
    const merged = mergePublishingSettings({
        defaultPlatforms: ['wechat'],
        platforms: {
            wechat: {
                enabled: true,
                connectionType: 'official',
                official: { appId: 'wx-id' }
            }
        }
    });

    assert.deepEqual(merged.defaultPlatforms, ['wechat']);
    assert.equal(merged.platforms.wechat.enabled, true);
    assert.equal(merged.platforms.wechat.official.appId, 'wx-id');
    assert.equal(merged.platforms.wechat.webhook.authType, 'none');
    assert.equal(merged.platforms.youtube.enabled, false);
});
```

- [ ] **Step 2: Add the test runner and verify RED**

Create `tests/run-tests.mjs`:

```js
import { build } from 'esbuild';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const outdir = path.resolve('.test-build');
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const entries = (await readdir('tests'))
    .filter(name => name.endsWith('.test.ts'))
    .map(name => path.join('tests', name));

await build({
    entryPoints: entries,
    outdir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external'
});

const result = spawnSync(process.execPath, ['--test', outdir], { stdio: 'inherit' });
process.exit(result.status ?? 1);
```

Modify `package.json`:

```json
"scripts": {
  "dev": "node esbuild.config.mjs",
  "build": "node esbuild.config.mjs production",
  "test": "node tests/run-tests.mjs"
}
```

Run: `npm test`

Expected: FAIL because `src/publishing/defaults.ts` does not exist.

- [ ] **Step 3: Add publishing types**

Create `src/publishing/types.ts` with these exported contracts:

```ts
export const PUBLISHING_PLATFORMS = [
    'wechat',
    'xiaohongshu',
    'wechatChannels',
    'douyin',
    'x',
    'youtube'
] as const;

export type PublishingPlatform = typeof PUBLISHING_PLATFORMS[number];
export type ConnectionType = 'official' | 'webhook';
export type TargetKind = 'native-draft' | 'private-upload' | 'webhook-draft';

export interface WebhookSettings {
    url: string;
    mediaUploadUrl: string;
    authType: 'none' | 'bearer' | 'headers';
    token: string;
    headers: Record<string, string>;
    signingSecret: string;
}

export interface PlatformSettings {
    enabled: boolean;
    connectionType: ConnectionType;
    official: Record<string, string>;
    webhook: WebhookSettings;
    defaults: Record<string, string | boolean | string[]>;
}

export interface PublishingSettings {
    defaultPlatforms: PublishingPlatform[];
    requestTimeout: number;
    platforms: Record<PublishingPlatform, PlatformSettings>;
}

export interface PublishMedia {
    kind: 'image' | 'video';
    source: 'vault' | 'remote';
    path: string;
    name: string;
    mimeType?: string;
    data?: ArrayBuffer;
    remoteUrl?: string;
}

export interface PublishContent {
    sourcePath: string;
    title: string;
    bodyMarkdown: string;
    summary?: string;
    cover?: PublishMedia;
    images: PublishMedia[];
    video?: PublishMedia;
    tags: string[];
}

export interface PlatformContentOverride {
    title?: string;
    bodyMarkdown?: string;
    summary?: string;
    cover?: PublishMedia | null;
    images?: PublishMedia[];
    video?: PublishMedia | null;
    tags?: string[];
}

export interface PlatformPublishRequest {
    taskId: string;
    idempotencyKey: string;
    platform: PublishingPlatform;
    content: PublishContent;
    settings: PlatformSettings;
}

export interface PublishError {
    code: string;
    message: string;
    retryable: boolean;
    field?: string;
    details?: string;
}

export interface PlatformPublishResult {
    platform: PublishingPlatform;
    success: boolean;
    targetKind?: TargetKind;
    draftId?: string;
    managementUrl?: string;
    error?: PublishError;
}

export type PublishTaskStatus = 'success' | 'partial' | 'failed';

export interface PublishingHistoryEntry {
    taskId: string;
    sourcePath: string;
    createdAt: number;
    status: PublishTaskStatus;
    results: Partial<Record<PublishingPlatform, {
        success: boolean;
        targetKind?: TargetKind;
        draftId?: string;
        managementUrl?: string;
        errorCode?: string;
        errorMessage?: string;
    }>>;
}

export interface PublishTaskResult {
    taskId: string;
    sourcePath: string;
    platforms: PublishingPlatform[];
    status: PublishTaskStatus;
    requests: Partial<Record<PublishingPlatform, PlatformPublishRequest>>;
    results: Partial<Record<PublishingPlatform, PlatformPublishResult>>;
}

export interface ValidationIssue {
    code: string;
    message: string;
    field?: string;
}

export interface ConnectionTestResult {
    success: boolean;
    message: string;
}

export interface PlatformCapabilities {
    targetKind: TargetKind;
    supportsImages: boolean;
    supportsVideo: boolean;
    maxImages?: number;
    requiresVideo?: boolean;
}

export interface PlatformAdapter {
    platform: PublishingPlatform;
    getCapabilities(): PlatformCapabilities;
    validate(request: PlatformPublishRequest): Promise<ValidationIssue[]>;
    testConnection(): Promise<ConnectionTestResult>;
    createDraft(request: PlatformPublishRequest): Promise<PlatformPublishResult>;
}
```

- [ ] **Step 4: Add defaults and deep merge**

Create `src/publishing/defaults.ts`:

```ts
import {
    PUBLISHING_PLATFORMS,
    PlatformSettings,
    PublishingPlatform,
    PublishingSettings
} from './types';

function createPlatformSettings(): PlatformSettings {
    return {
        enabled: false,
        connectionType: 'webhook',
        official: {},
        webhook: {
            url: '',
            mediaUploadUrl: '',
            authType: 'none',
            token: '',
            headers: {},
            signingSecret: ''
        },
        defaults: {}
    };
}

export const DEFAULT_PUBLISHING_SETTINGS: PublishingSettings = {
    defaultPlatforms: [],
    requestTimeout: 60,
    platforms: PUBLISHING_PLATFORMS.reduce((result, platform) => {
        result[platform] = createPlatformSettings();
        return result;
    }, {} as Record<PublishingPlatform, PlatformSettings>)
};

export function mergePublishingSettings(saved?: Partial<PublishingSettings>): PublishingSettings {
    const platforms = PUBLISHING_PLATFORMS.reduce((result, platform) => {
        const current = saved?.platforms?.[platform];
        const fallback = createPlatformSettings();
        result[platform] = {
            ...fallback,
            ...current,
            official: { ...fallback.official, ...current?.official },
            webhook: { ...fallback.webhook, ...current?.webhook },
            defaults: { ...fallback.defaults, ...current?.defaults }
        };
        return result;
    }, {} as Record<PublishingPlatform, PlatformSettings>);

    return {
        ...DEFAULT_PUBLISHING_SETTINGS,
        ...saved,
        defaultPlatforms: saved?.defaultPlatforms ?? [],
        platforms
    };
}
```

Add `publishing: PublishingSettings` to `WorkbenchSettings`, import the type, and set:

```ts
publishing: DEFAULT_PUBLISHING_SETTINGS
```

in `DEFAULT_SETTINGS`.

- [ ] **Step 5: Run tests and build**

Run: `npm test`

Expected: PASS for both settings tests.

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -f tests/run-tests.mjs tests/publishing-defaults.test.ts
git add package.json src/types/index.ts src/publishing/types.ts src/publishing/defaults.ts
git commit -m "feat: add publishing settings model"
```

---

### Task 2: Content Parsing, Overrides, and Validation

**Files:**
- Create: `tests/publishing-content.test.ts`
- Create: `src/publishing/content.ts`
- Create: `src/publishing/validation.ts`

- [ ] **Step 1: Write failing content tests**

Create tests covering:

```ts
const baseContent: PublishContent = {
    sourcePath: 'Notes/example.md',
    title: 'Base title',
    bodyMarkdown: 'Base body',
    images: [],
    tags: ['base']
};

test('extractTitle follows frontmatter, h1, then filename priority', () => {
    assert.equal(extractTitle('# Heading\nBody', 'File name', 'Frontmatter'), 'Frontmatter');
    assert.equal(extractTitle('# Heading\nBody', 'File name'), 'Heading');
    assert.equal(extractTitle('Body', 'File name'), 'File name');
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

test('applyPlatformOverride only replaces explicit fields', () => {
    const merged = applyPlatformOverride(baseContent, {
        title: 'X title',
        cover: null
    });
    assert.equal(merged.title, 'X title');
    assert.equal(merged.bodyMarkdown, baseContent.bodyMarkdown);
    assert.equal(merged.cover, undefined);
});
```

Also test URL rules:

```ts
test('validateServiceUrl permits HTTPS and local HTTP only', () => {
    assert.equal(validateServiceUrl('https://relay.example.com'), true);
    assert.equal(validateServiceUrl('http://localhost:8787'), true);
    assert.equal(validateServiceUrl('http://127.0.0.1:8787'), true);
    assert.equal(validateServiceUrl('http://relay.example.com'), false);
});
```

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because content and validation modules do not exist.

- [ ] **Step 3: Implement pure content helpers**

Create `src/publishing/content.ts` exporting:

```ts
export function extractTitle(markdown: string, basename: string, frontmatterTitle?: string): string;
export function stripFrontmatter(markdown: string): string;
export function findMediaReferences(markdown: string): Array<{
    kind: 'image' | 'video';
    path: string;
    source: 'vault' | 'remote';
}>;
export function applyPlatformOverride(
    content: PublishContent,
    override?: PlatformContentOverride
): PublishContent;
export function createIdempotencyKey(
    taskId: string,
    platform: PublishingPlatform,
    content: PublishContent
): Promise<string>;
```

Use regex only for Markdown token discovery, not for JSON or HTTP payload manipulation. Use `crypto.subtle.digest('SHA-256', ...)` for the idempotency content hash.

- [ ] **Step 4: Implement validation helpers**

Create `src/publishing/validation.ts`:

```ts
export function validateServiceUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ||
            (url.protocol === 'http:' &&
                (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
    } catch {
        return false;
    }
}

export function validateCommonContent(content: PublishContent): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!content.title.trim()) {
        issues.push({ code: 'TITLE_REQUIRED', field: 'title', message: '标题不能为空' });
    }
    if (!content.bodyMarkdown.trim() && !content.video) {
        issues.push({ code: 'CONTENT_REQUIRED', field: 'bodyMarkdown', message: '正文或视频至少需要一项' });
    }
    return issues;
}

export function validatePlatformConfiguration(
    platform: PublishingPlatform,
    settings: PlatformSettings
): ValidationIssue[];
```

Webhook configuration requires a valid `url`; local media additionally requires `mediaUploadUrl`. Official configuration requirements:

- WeChat: `appId`, `appSecret`
- YouTube: `clientId`, `clientSecret`, `refreshToken`
- Other official modes: `OFFICIAL_API_UNAVAILABLE`

- [ ] **Step 5: Run GREEN**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -f tests/publishing-content.test.ts
git add src/publishing/content.ts src/publishing/validation.ts
git commit -m "feat: add publishing content preparation"
```

---

### Task 3: Obsidian Note and Media Extraction

**Files:**
- Create: `src/publishing/obsidian-content.ts`
- Modify: `src/interfaces.ts`
- Create: `tests/publishing-ui.test.mjs`

- [ ] **Step 1: Add failing source-structure tests**

Add assertions to `tests/publishing-ui.test.mjs` that:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const obsidianContentSource = await readFile(
    new URL('../src/publishing/obsidian-content.ts', import.meta.url),
    'utf8'
);

test('Obsidian content extractor reads note metadata and binary media', () => {
assert.match(obsidianContentSource, /metadataCache\.getFileCache/);
assert.match(obsidianContentSource, /vault\.read/);
assert.match(obsidianContentSource, /vault\.readBinary/);
assert.match(obsidianContentSource, /getFirstLinkpathDest/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/publishing-ui.test.mjs`

Expected: FAIL because `src/publishing/obsidian-content.ts` does not exist.

- [ ] **Step 3: Implement `ObsidianContentExtractor`**

Create a class with:

```ts
export class ObsidianContentExtractor {
    constructor(private app: App) {}

    async extract(file: TFile): Promise<PublishContent>;
    async loadMedia(media: PublishMedia): Promise<PublishMedia>;
}
```

`extract()` must:

- Read Markdown with `app.vault.read(file)`.
- Read frontmatter with `app.metadataCache.getFileCache(file)?.frontmatter`.
- Use Task 2 helpers for title and media references.
- Resolve Wiki links and relative links with `metadataCache.getFirstLinkpathDest(path, file.path)`.
- Set the first image as the default cover.
- Keep at most one video.
- Preserve remote media as URLs without downloading.

`loadMedia()` must call `vault.readBinary()` only when an adapter is about to upload local media.

- [ ] **Step 4: Add interface**

Add to `src/interfaces.ts`:

```ts
export interface IObsidianContentExtractor {
    extract(file: import('obsidian').TFile): Promise<import('./publishing/types').PublishContent>;
    loadMedia(media: import('./publishing/types').PublishMedia): Promise<import('./publishing/types').PublishMedia>;
}
```

- [ ] **Step 5: Run GREEN and build**

Run: `node --test tests/publishing-ui.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -f tests/publishing-ui.test.mjs
git add src/publishing/obsidian-content.ts src/interfaces.ts
git commit -m "feat: extract publishable note content"
```

---

### Task 4: Signed Webhook Client

**Files:**
- Create: `tests/publishing-webhook.test.ts`
- Create: `src/publishing/webhook.ts`

- [ ] **Step 1: Write failing Webhook tests**

Use an injected `fetchFn` and fixed clock:

```ts
function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

const requestWithLocalImage: PlatformPublishRequest = {
    taskId: 'task-1',
    idempotencyKey: 'idem-1',
    platform: 'xiaohongshu',
    content: {
        sourcePath: 'Notes/example.md',
        title: 'Title',
        bodyMarkdown: 'Body',
        images: [{
            kind: 'image',
            source: 'vault',
            path: 'assets/image.png',
            name: 'image.png',
            mimeType: 'image/png',
            data: new Uint8Array([1, 2, 3]).buffer
        }],
        tags: []
    },
    settings: {
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
    }
};

test('buildSignedHeaders signs timestamp and raw JSON body', async () => {
    const headers = await buildSignedHeaders(
        { authType: 'bearer', token: 'token', headers: {}, signingSecret: 'secret' },
        '{"hello":"world"}',
        'idem-1',
        1700000000
    );
    assert.equal(headers.Authorization, 'Bearer token');
    assert.equal(headers['X-AI-Workbench-Timestamp'], '1700000000');
    assert.equal(headers['Idempotency-Key'], 'idem-1');
    assert.match(headers['X-AI-Workbench-Signature'], /^[a-f0-9]{64}$/);
});

test('WebhookClient uploads local media before creating a draft', async () => {
    const calls: string[] = [];
    const fetchFn = async (url: string) => {
        calls.push(url);
        if (url.endsWith('/media')) {
            return jsonResponse({ success: true, mediaRef: 'media-1' });
        }
        return jsonResponse({
            success: true,
            draftId: 'draft-1',
            managementUrl: 'https://relay/drafts/1',
            targetKind: 'webhook-draft'
        });
    };

    const result = await new WebhookClient(fetchFn).createDraft(requestWithLocalImage);
    assert.deepEqual(calls, ['https://relay/media', 'https://relay/draft']);
    assert.equal(result.draftId, 'draft-1');
});
```

Also test:

- Remote media skips media upload.
- Non-2xx responses become `WEBHOOK_HTTP_ERROR`.
- Invalid response shape becomes `WEBHOOK_INVALID_RESPONSE`.
- Secrets do not appear in returned errors.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because `src/publishing/webhook.ts` does not exist.

- [ ] **Step 3: Implement signing and request helpers**

Create:

```ts
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function buildSignedHeaders(
    settings: Pick<WebhookSettings, 'authType' | 'token' | 'headers' | 'signingSecret'>,
    rawBody: string,
    idempotencyKey: string,
    timestamp: number
): Promise<Record<string, string>>;
```

Use:

```ts
const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(settings.signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
);
```

Sign `${timestamp}.${rawBody}` and encode lowercase hex.

- [ ] **Step 4: Implement `WebhookClient`**

Constructor:

```ts
export class WebhookClient {
    constructor(
        private fetchFn: FetchLike = fetch,
        private now: () => number = () => Math.floor(Date.now() / 1000)
    ) {}

    async testConnection(platform: PublishingPlatform, settings: PlatformSettings): Promise<ConnectionTestResult>;
    async createDraft(request: PlatformPublishRequest): Promise<PlatformPublishResult>;
}
```

Connection testing sends:

```json
{"version":"1","type":"connection-test","platform":"wechat"}
```

It must not include note content.

Local media upload uses `FormData` with `file`, `taskId`, `platform`, and `idempotencyKey`. Draft creation uses the JSON contract from the design document.

- [ ] **Step 5: Run GREEN**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -f tests/publishing-webhook.test.ts
git add src/publishing/webhook.ts
git commit -m "feat: add signed publishing webhook client"
```

---

### Task 5: Platform Adapters and Official API Boundary

**Files:**
- Create: `tests/publishing-adapters.test.ts`
- Create: `src/publishing/adapters.ts`

- [ ] **Step 1: Write failing adapter tests**

Cover factory routing:

```ts
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
const officialSettings: PlatformSettings = {
    ...webhookSettings,
    connectionType: 'official'
};
const factory = new PublishingAdapterFactory(new WebhookClient());

test('adapter factory selects Webhook for every configured platform', () => {
    for (const platform of PUBLISHING_PLATFORMS) {
        const adapter = factory.create(platform, webhookSettings);
        assert.equal(adapter.constructor.name, 'WebhookPlatformAdapter');
    }
});

test('official factory supports WeChat and YouTube only', () => {
    assert.equal(factory.create('wechat', officialSettings).constructor.name, 'WeChatOfficialAdapter');
    assert.equal(factory.create('youtube', officialSettings).constructor.name, 'YouTubeOfficialAdapter');
    assert.equal(factory.create('x', officialSettings).constructor.name, 'UnavailableOfficialAdapter');
});

test('unavailable official adapter returns an actionable validation issue', async () => {
    const adapter = factory.create('x', officialSettings);
    const request: PlatformPublishRequest = {
        taskId: 'task-1',
        idempotencyKey: 'idem-1',
        platform: 'x',
        content: {
            sourcePath: 'Notes/example.md',
            title: 'Title',
            bodyMarkdown: 'Body',
            images: [],
            tags: []
        },
        settings: officialSettings
    };
    const issues = await adapter.validate(request);
    assert.deepEqual(issues, [{
        code: 'OFFICIAL_API_UNAVAILABLE',
        field: 'connectionType',
        message: 'X 当前不提供本插件可用的草稿接口，请改用 Webhook'
    }]);
});
```

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because adapters do not exist.

- [ ] **Step 3: Implement shared adapter classes**

Add:

```ts
export class PublishingAdapterFactory {
    constructor(
        private webhookClient: WebhookClient,
        private fetchFn: FetchLike = fetch
    ) {}

    create(platform: PublishingPlatform, settings: PlatformSettings): PlatformAdapter;
}
```

`WebhookPlatformAdapter` delegates test and create calls to `WebhookClient`.

`UnavailableOfficialAdapter` never sends a network request and returns `OFFICIAL_API_UNAVAILABLE`.

- [ ] **Step 4: Implement WeChat official draft adapter**

The adapter must:

- Validate `appId` and `appSecret`.
- Fetch an access token from the official token endpoint.
- Upload cover and inline images before draft creation.
- Convert Markdown to conservative HTML: headings, paragraphs, lists, links, emphasis, and uploaded images.
- Call the official draft-add endpoint.
- Return `targetKind: 'native-draft'`.
- Convert token, media, and draft errors into sanitized `PublishError`.

Keep endpoint constants in the adapter and inject `fetchFn` for tests.

- [ ] **Step 5: Implement YouTube private upload adapter**

The adapter must:

- Validate `clientId`, `clientSecret`, and `refreshToken`.
- Exchange refresh token for access token.
- Require one video.
- Use resumable upload initialization followed by binary upload.
- Set `status.privacyStatus` to `private`.
- Use title, summary/body, and tags.
- Return `targetKind: 'private-upload'` and the video management URL.

- [ ] **Step 6: Test official request shape**

Add fetch-injection tests asserting:

- WeChat sends draft content only after required media uploads.
- YouTube sends `privacyStatus: private`.
- Authentication errors are not retryable.
- No test error includes app secrets, refresh tokens, or bearer tokens.

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -f tests/publishing-adapters.test.ts
git add src/publishing/adapters.ts
git commit -m "feat: add platform publishing adapters"
```

---

### Task 6: Publishing Orchestration, Retry, and History

**Files:**
- Create: `tests/publishing-service.test.ts`
- Create: `src/publishing/service.ts`
- Modify: `src/interfaces.ts`

- [ ] **Step 1: Write failing orchestration tests**

Cover:

```ts
class FakeAdapter implements PlatformAdapter {
    createCalls = 0;

    constructor(
        public platform: PublishingPlatform,
        private result: PlatformPublishResult
    ) {}

    getCapabilities(): PlatformCapabilities {
        return {
            targetKind: 'webhook-draft',
            supportsImages: true,
            supportsVideo: true
        };
    }

    async validate(request: PlatformPublishRequest): Promise<ValidationIssue[]> {
        return request.content.title.trim()
            ? []
            : [{ code: 'TITLE_REQUIRED', field: 'title', message: '标题不能为空' }];
    }

    async testConnection(): Promise<ConnectionTestResult> {
        return { success: true, message: 'ok' };
    }

    async createDraft(): Promise<PlatformPublishResult> {
        this.createCalls += 1;
        return this.result;
    }
}

const wechatAdapter = new FakeAdapter('wechat', {
    platform: 'wechat',
    success: true,
    targetKind: 'native-draft',
    draftId: 'wechat-1'
});
const xAdapter = new FakeAdapter('x', {
    platform: 'x',
    success: false,
    error: { code: 'RELAY_FAILED', message: 'relay failed', retryable: false }
});
const adapterFactory = {
    create(platform: PublishingPlatform): PlatformAdapter {
        return platform === 'wechat' ? wechatAdapter : xAdapter;
    }
} as PublishingAdapterFactory;
const service = new PublishingService(
    mergePublishingSettings({
        platforms: {
            wechat: { enabled: true },
            x: { enabled: true }
        }
    }),
    adapterFactory,
    async () => {}
);

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

test('publishAll keeps successful platforms when another platform fails', async () => {
    const result = await service.publishAll(inputFor(['wechat', 'x']));
    assert.equal(result.results.wechat.success, true);
    assert.equal(result.results.x.success, false);
    assert.equal(result.status, 'partial');
});

test('validation failure prevents adapter network execution', async () => {
    const inputWithMissingTitle = inputFor(['wechat']);
    inputWithMissingTitle.content.title = '';
    const callsBefore = wechatAdapter.createCalls;
    await service.publishAll(inputWithMissingTitle);
    assert.equal(wechatAdapter.createCalls, callsBefore);
});

test('retryFailed reuses idempotency keys and submits failed platforms only', async () => {
    const previousTask = await service.publishAll(inputFor(['wechat', 'x']));
    const retried = await service.retryFailed(previousTask);
    assert.deepEqual(retried.platforms, ['x']);
    assert.equal(retried.requests.x.idempotencyKey, previousTask.requests.x.idempotencyKey);
});
```

Also test:

- Retryable failures retry at most twice.
- Non-retryable failures do not retry.
- Maximum active adapters is three.
- History serialization omits content, media data, and settings.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement orchestration**

Create:

```ts
export interface PublishTaskInput {
    content: PublishContent;
    overrides: Partial<Record<PublishingPlatform, PlatformContentOverride>>;
    platforms: PublishingPlatform[];
}

export class PublishingService {
    constructor(
        private settings: PublishingSettings,
        private adapterFactory: PublishingAdapterFactory,
        private saveHistory: (entries: PublishingHistoryEntry[]) => Promise<void>,
        private sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))
    ) {}

    updateSettings(settings: PublishingSettings): void;
    publishAll(input: PublishTaskInput): Promise<PublishTaskResult>;
    retryFailed(task: PublishTaskResult): Promise<PublishTaskResult>;
    testConnection(platform: PublishingPlatform): Promise<ConnectionTestResult>;
}
```

Use a three-worker queue, not unbounded `Promise.all`. Each platform:

1. Resolves platform overrides.
2. Generates an idempotency key.
3. Validates common content and adapter rules.
4. Calls `createDraft`.
5. Retries only `retryable` failures, at most twice.
6. Produces an independent result.

- [ ] **Step 4: Implement sanitized history**

Define `PublishingHistoryEntry` with only:

```ts
{
    taskId,
    sourcePath,
    createdAt,
    status,
    results: {
        [platform]: {
            success,
            targetKind,
            draftId,
            managementUrl,
            errorCode,
            errorMessage
        }
    }
}
```

Store at most 50 entries in plugin data under `publishingHistory`.

- [ ] **Step 5: Add interface**

Add `IPublishingService` to `src/interfaces.ts` with `publishAll`, `retryFailed`, `testConnection`, and `updateSettings`.

- [ ] **Step 6: Run GREEN**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -f tests/publishing-service.test.ts
git add src/publishing/service.ts src/interfaces.ts
git commit -m "feat: orchestrate multi-platform draft publishing"
```

---

### Task 7: Publishing Settings UI

**Files:**
- Create: `src/publishing/settings-ui.ts`
- Modify: `src/settings.ts`
- Modify: `styles.css`
- Modify: `tests/publishing-ui.test.mjs`

- [ ] **Step 1: Write failing UI structure tests**

Assert source contains:

```js
assert.match(settingsSource, /发布平台/);
assert.match(publishingSettingsSource, /connectionType/);
assert.match(publishingSettingsSource, /测试连接/);
assert.match(publishingSettingsSource, /mediaUploadUrl/);
assert.match(styles, /\.ai-workbench-platform-settings/);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/publishing-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement platform settings renderer**

Create:

```ts
export class PublishingSettingsRenderer {
    constructor(
        private app: App,
        private plugin: AIWorkbenchPlugin,
        private container: HTMLElement
    ) {}

    render(): void;
}
```

Render six rows with:

- Platform name.
- Enable toggle.
- Connection type dropdown.
- Status summary.
- Configure button.
- Test connection button.

Use an Obsidian `Modal` for detailed fields. Official fields are declared by a platform metadata map:

```ts
wechat: ['appId', 'appSecret', 'author']
youtube: ['clientId', 'clientSecret', 'refreshToken', 'channelId']
```

Unsupported official platforms show explanatory text and recommend Webhook.

Webhook fields include URL, media upload URL, auth type, token, JSON headers, signing secret, and timeout inherited from publishing settings.

- [ ] **Step 4: Wire into settings tab**

In `WorkbenchSettingTab.display()`, insert before UI settings:

```ts
containerEl.createEl('h2', { text: '发布平台' });
new PublishingSettingsRenderer(this.app, this.plugin, containerEl).render();
```

Every saved change calls `plugin.saveSettings()`. Connection testing calls `plugin.getPublishingService().testConnection(platform)` and shows the result with `Notice`.

- [ ] **Step 5: Add restrained responsive styles**

Add styles for:

- `.ai-workbench-platform-settings`
- `.ai-workbench-platform-setting-row`
- `.ai-workbench-platform-status`
- `.ai-workbench-platform-config-modal`
- `.ai-workbench-platform-fields`

Use Obsidian CSS variables, maximum 8px radii, stable row dimensions, and no nested cards.

- [ ] **Step 6: Run GREEN and build**

Run: `node --test tests/publishing-ui.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -f tests/publishing-ui.test.mjs
git add src/publishing/settings-ui.ts src/settings.ts styles.css
git commit -m "feat: add publishing platform settings"
```

---

### Task 8: Publish Editor and Results Modal

**Files:**
- Create: `src/publishing/modal.ts`
- Modify: `styles.css`
- Modify: `tests/publishing-ui.test.mjs`

- [ ] **Step 1: Write failing modal source tests**

Assert:

```js
assert.match(modalSource, /统一内容/);
assert.match(modalSource, /平台设置/);
assert.match(modalSource, /仅重试失败平台/);
assert.match(modalSource, /已覆盖/);
assert.match(styles, /\.ai-workbench-publish-modal/);
assert.match(styles, /\.ai-workbench-publish-result-row/);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/publishing-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement publish modal state**

Create `PublishModalState` as a pure exported class so platform inheritance is testable:

```ts
export class PublishModalState {
    constructor(
        public base: PublishContent,
        public platforms: PublishingPlatform[],
        public overrides: Partial<Record<PublishingPlatform, PlatformContentOverride>> = {}
    ) {}

    resolve(platform: PublishingPlatform): PublishContent;
    setOverride<K extends keyof PlatformContentOverride>(
        platform: PublishingPlatform,
        field: K,
        value: PlatformContentOverride[K]
    ): void;
    clearOverride(platform: PublishingPlatform, field: keyof PlatformContentOverride): void;
}
```

- [ ] **Step 4: Implement `PublishEditorModal`**

Constructor:

```ts
constructor(
    app: App,
    content: PublishContent,
    platforms: PublishingPlatform[],
    publishingService: PublishingService
)
```

Render:

- Unified title, body, summary, tags, cover, images, and one video.
- Platform tabs with inheritance/override indicators.
- Platform target kind and validation messages.
- Cancel and publish buttons.
- Disabled publish button while submitting.
- Per-platform progress rows.

After completion, show:

- Success, partial, or failure summary.
- Draft ID and management link where returned.
- Target kind label.
- Error message.
- “仅重试失败平台” button when applicable.

- [ ] **Step 5: Add modal styles**

Ensure:

- No text overlap at desktop and mobile widths.
- Media list has stable thumbnail dimensions.
- Tabs scroll horizontally rather than shrink labels.
- Result rows wrap long errors and URLs.

- [ ] **Step 6: Run GREEN and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -f tests/publishing-ui.test.mjs
git add src/publishing/modal.ts styles.css
git commit -m "feat: add draft publishing editor"
```

---

### Task 9: Plugin and Workbench Integration

**Files:**
- Modify: `main.ts`
- Modify: `src/types/index.ts`
- Modify: `styles.css`
- Modify: `tests/publishing-ui.test.mjs`

- [ ] **Step 1: Write failing workbench tests**

Assert:

```js
assert.match(mainSource, /ai-workbench-publishing/);
assert.match(mainSource, /编辑并发布/);
for (const platform of ['微信公众号', '小红书', '视频号', '抖音', 'X', 'YouTube']) {
    assert.match(mainSource, new RegExp(platform));
}
assert.match(styles, /\.ai-workbench-platform-grid/);
assert.match(styles, /grid-template-columns/);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/publishing-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Initialize publishing services**

Add plugin fields:

```ts
private contentExtractor: ObsidianContentExtractor;
private publishingService: PublishingService;
private publishingHistory: PublishingHistoryEntry[] = [];
```

During `onload()`:

```ts
this.contentExtractor = new ObsidianContentExtractor(this.app);
const webhookClient = new WebhookClient();
const adapterFactory = new PublishingAdapterFactory(webhookClient);
this.publishingService = new PublishingService(
    this.settings.publishing,
    adapterFactory,
    async entries => {
        this.publishingHistory = entries;
        await this.saveData({
            ...this.settings,
            publishingHistory: this.publishingHistory
        });
    }
);
```

Refactor `loadSettings()` to read `publishingHistory` separately and use `mergePublishingSettings(saved?.publishing)`.

Refactor `saveSettings()` to preserve `publishingHistory`, then call `publishingService.updateSettings(this.settings.publishing)`.

- [ ] **Step 4: Add plugin entry method**

Add:

```ts
async openPublishingModal(platforms: PublishingPlatform[]): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
        new Notice('请先打开一篇 Markdown 笔记');
        return;
    }
    const content = await this.contentExtractor.extract(file);
    new PublishEditorModal(this.app, content, platforms, this.publishingService).open();
}

getPublishingService(): PublishingService {
    return this.publishingService;
}
```

Also register command `open-draft-publisher`.

- [ ] **Step 5: Render workbench platform controls**

In `WorkbenchView`, add `selectedPlatforms` initialized from `settings.publishing.defaultPlatforms`.

Render after custom actions:

- Section `.ai-workbench-publishing`.
- Six checkbox-style platform buttons in `.ai-workbench-platform-grid`.
- Disabled state for platforms that are not enabled.
- Settings shortcut for disabled/unconfigured platforms.
- Count label.
- Primary “编辑并发布 N 个草稿” button.

Use Lucide icons available through Obsidian `setIcon`, including `send`, `settings`, `check`, and `external-link`.

- [ ] **Step 6: Add responsive styles**

Use two columns in the sidebar and one column below 280px container width. Give platform controls stable minimum height and allow labels to wrap.

- [ ] **Step 7: Run GREEN**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: build succeeds and updates `main.js`.

- [ ] **Step 8: Commit**

```bash
git add -f tests/publishing-ui.test.mjs
git add main.ts src/types/index.ts styles.css main.js
git commit -m "feat: integrate draft publishing workbench"
```

---

### Task 10: Documentation, Security Review, and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`
- Modify: `使用说明.md`
- Modify: `CHANGELOG.md`
- Modify: `manifest.json` only if versioning is explicitly requested

- [ ] **Step 1: Update user documentation**

Document:

- How to enable platforms.
- Official API vs Webhook behavior.
- Supported official adapters: WeChat and YouTube.
- Webhook URL, media URL, authentication, and signing headers.
- Draft target semantics.
- Local credential storage warning: local, not encrypted.
- How partial failure and retry work.

- [ ] **Step 2: Run secret and logging review**

Run:

```powershell
rg -n "console\.(log|error).*?(token|secret|authorization|request body|settings)" main.ts src
```

Expected: no logging of publishing secrets, authorization headers, full settings, or full publish payloads.

- [ ] **Step 3: Run placeholder and scope scan**

Run:

```powershell
rg -n "TBD|TODO|implement later|auto.*fallback|publish public" src/publishing main.ts src/settings.ts
```

Expected: no unfinished publishing code and no automatic public publishing path.

- [ ] **Step 4: Run full automated verification**

Run: `npm test`

Expected: all Node tests pass.

Run: `npm run build`

Expected: esbuild exits successfully.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Perform Obsidian manual verification**

Verify:

1. Existing settings load without errors.
2. Platform settings save and reload.
3. Connection test sends no note content.
4. Workbench shows all six platforms.
5. Disabled platforms cannot be selected.
6. A Markdown note opens the editor with extracted title and media.
7. Platform override can be set and cleared.
8. A Webhook success displays draft ID and management URL.
9. Partial failure keeps successful results and enables failed-only retry.
10. Deep and light themes show no overlap at narrow sidebar widths.

- [ ] **Step 6: Update changelog**

Add an unreleased entry describing multi-platform draft publishing, configuration, supported direct adapters, and Webhook support.

- [ ] **Step 7: Commit**

```bash
git add README.md README_EN.md 使用说明.md CHANGELOG.md
git commit -m "docs: document multi-platform draft publishing"
```

---

## Final Completion Check

Before claiming completion:

```powershell
npm test
npm run build
git diff --check
git status --short
```

Expected:

- All tests pass.
- Production bundle builds.
- No whitespace errors.
- Only intentional user-owned files such as the pre-existing `.claude/` remain untracked.
