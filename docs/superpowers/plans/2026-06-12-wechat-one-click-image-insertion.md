# WeChat One-Click Image Insertion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click command that extracts or creates image prompts, generates images through an extensible provider, and creates a new illustrated WeChat article without modifying the source note.

**Architecture:** Keep parsing, anchor resolution, rendering, provider normalization, and concurrency control in small TypeScript modules with no Obsidian runtime dependency. Add one Obsidian orchestration service that validates the active note, coordinates generation, writes the shared article/asset output, and opens the new note. Wire that service into existing commands, sidebar, context menu, shortcuts, status bar, settings, and persistence.

**Tech Stack:** TypeScript, Obsidian Plugin API, OpenAI-compatible HTTP APIs, Node.js built-in test runner, esbuild.

---

## File Map

**Create**

- `src/wechat-images/types.ts` - Image-task, anchor, provider, generation-result, and workflow types.
- `src/wechat-images/prompt-parser.ts` - Parse existing WeChat image prompt blocks.
- `src/wechat-images/task-extractor.ts` - Use parsed tasks or request strict JSON tasks from text AI.
- `src/wechat-images/article-renderer.ts` - Insert successful images and failure notes into immutable source text.
- `src/wechat-images/image-provider.ts` - Provider interface, OpenAI-compatible implementation, response validation.
- `src/wechat-images/generation-coordinator.ts` - Concurrency, progress, retry classification, ordered results.
- `src/wechat-images/output-writer.ts` - Resolve shared names and write assets/new article.
- `src/wechat-images/workflow.ts` - Obsidian-facing orchestration service.
- `src/wechat-images/task-preview.ts` - Optional prompt-list confirmation modal.
- `tests/helpers/import-typescript.mjs` - Bundle a pure TypeScript module for Node tests.
- `tests/wechat-prompt-parser.test.mjs`
- `tests/wechat-task-extractor.test.mjs`
- `tests/wechat-article-renderer.test.mjs`
- `tests/wechat-image-provider.test.mjs`
- `tests/wechat-generation-coordinator.test.mjs`
- `tests/wechat-output-writer.test.mjs`
- `tests/wechat-integration.test.mjs`

**Modify**

- `src/types/index.ts` - Persist image-generation settings and allow the new shortcut action ID.
- `src/interfaces.ts` - Expose progress-capable status and image workflow contracts where useful.
- `src/services/ai.ts` - Add a JSON-oriented text request without changing existing chat behavior.
- `src/services/file.ts` - Add shared conflict-free article/asset naming helpers.
- `src/services/status-bar.ts` - Support explicit progress text.
- `src/services/context-menu.ts` - Add editor and file menu entries.
- `src/services/shortcuts.ts` - Route the new action ID through the existing callback.
- `src/settings.ts` - Add image provider and workflow settings.
- `src/services/presets.ts` - Add the discoverable WeChat one-click action entry.
- `main.ts` - Construct the workflow and register all entry points.
- `styles.css` - Style the task-preview modal and sidebar action if needed.
- `package.json` - Add a repeatable test script.
- `main.js` - Regenerated production bundle.

## Task 1: Add Test Infrastructure and Image Domain Types

**Files:**
- Create: `tests/helpers/import-typescript.mjs`
- Create: `src/wechat-images/types.ts`
- Create: `tests/wechat-types.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the TypeScript import helper**

Use esbuild to bundle pure TypeScript modules into a temporary ESM file:

```js
// tests/helpers/import-typescript.mjs
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function importTypeScript(entryPoint) {
    const outdir = await mkdtemp(join(tmpdir(), 'ai-workbench-test-'));
    const outfile = join(outdir, 'module.mjs');
    await build({
        entryPoints: [entryPoint],
        outfile,
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node20',
        external: ['obsidian']
    });
    return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}
```

- [ ] **Step 2: Write a failing runtime-defaults test**

```js
// tests/wechat-types.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(new URL('../src/wechat-images/types.ts', import.meta.url));

test('image defaults enforce the agreed safe limits', async () => {
    const { DEFAULT_IMAGE_SETTINGS } = await importTypeScript(entry);
    assert.equal(DEFAULT_IMAGE_SETTINGS.provider, 'openai-compatible');
    assert.equal(DEFAULT_IMAGE_SETTINGS.maxImages, 10);
    assert.equal(DEFAULT_IMAGE_SETTINGS.previewTasks, false);
    assert.equal(DEFAULT_IMAGE_SETTINGS.keepOriginalPrompts, false);
});
```

- [ ] **Step 3: Run the test and verify failure**

Run:

```powershell
node --test tests/wechat-types.test.mjs
```

Expected: FAIL because `src/wechat-images/types.ts` does not exist.

- [ ] **Step 4: Define the shared types and defaults**

Create these concrete contracts:

```ts
export type ImageProviderType = 'openai-compatible';
export type AnchorPlacement = 'before' | 'after';

export interface ArticleAnchor {
    heading?: string;
    nearbyText?: string;
    placement: AnchorPlacement;
}

export interface SourceBlock {
    startOffset: number;
    endOffset: number;
}

export interface ArticleImageTask {
    id: string;
    prompt: string;
    description?: string;
    sourceBlock?: SourceBlock;
    anchor: ArticleAnchor;
}

export interface ImageGenerationSettings {
    provider: ImageProviderType;
    endpoint: string;
    apiKey: string;
    model: string;
    size: string;
    timeout: number;
    retryCount: number;
    concurrency: number;
    maxImages: number;
    previewTasks: boolean;
    keepOriginalPrompts: boolean;
}

export const DEFAULT_IMAGE_SETTINGS: ImageGenerationSettings = {
    provider: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-image-1',
    size: '1536x1024',
    timeout: 120,
    retryCount: 2,
    concurrency: 2,
    maxImages: 10,
    previewTasks: false,
    keepOriginalPrompts: false
};

export interface ImageGenerationRequest {
    prompt: string;
    size: string;
}

export interface GeneratedImage {
    bytes: Uint8Array;
    extension: 'png' | 'jpg' | 'webp';
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface ImageProvider {
    generate(request: ImageGenerationRequest): Promise<GeneratedImage>;
}

export interface TaskGenerationResult {
    task: ArticleImageTask;
    image?: GeneratedImage;
    assetPath?: string;
    error?: string;
}
```

- [ ] **Step 5: Add a test script and run it**

Add:

```json
"scripts": {
  "dev": "node esbuild.config.mjs",
  "build": "node esbuild.config.mjs production",
  "test": "node --test tests/*.test.mjs"
}
```

Run:

```powershell
npm test
```

Expected: all existing tests and `wechat-types.test.mjs` PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/wechat-images/types.ts tests/helpers/import-typescript.mjs tests/wechat-types.test.mjs
git commit -m "test: add WeChat image workflow foundations"
```

## Task 2: Parse Existing Image Prompt Blocks

**Files:**
- Create: `src/wechat-images/prompt-parser.ts`
- Create: `tests/wechat-prompt-parser.test.mjs`

- [ ] **Step 1: Write failing parser tests**

Cover multiple labels, punctuation, Markdown emphasis, ordering, descriptions,
and source offsets:

```js
test('parses existing prompt blocks in source order', async () => {
    const source = [
        '# 标题',
        '开场文字',
        '',
        '【配图1 - 位置：文章开头】',
        '📷 图片描述：温暖的工作场景',
        '🎨 AI绘图提示词：warm editorial illustration, 16:9',
        '',
        '## 第一节',
        '正文',
        '',
        '**AI生图提示词**: clean blue technology diagram'
    ].join('\n');

    const tasks = parseExistingImageTasks(source);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].description, '温暖的工作场景');
    assert.equal(tasks[0].prompt, 'warm editorial illustration, 16:9');
    assert.equal(tasks[1].prompt, 'clean blue technology diagram');
    assert.ok(tasks[0].sourceBlock.startOffset < tasks[1].sourceBlock.startOffset);
});
```

Also assert that ordinary prose containing “提示词” is ignored and empty
prompt values produce no task.

- [ ] **Step 2: Run the tests and verify failure**

Run:

```powershell
node --test tests/wechat-prompt-parser.test.mjs
```

Expected: FAIL because `parseExistingImageTasks` is not implemented.

- [ ] **Step 3: Implement block parsing**

Export:

```ts
export function parseExistingImageTasks(source: string): ArticleImageTask[]
```

Implementation rules:

- Match `AI提示词`, `AI绘图提示词`, and `AI生图提示词`.
- Accept optional emoji, Markdown emphasis, whitespace, `:` or `：`.
- Start the source block at the nearest preceding `【配图...】` line when
  present; otherwise start at the prompt line.
- Include adjacent placement and description lines in the source block.
- End before the next blank-line-separated prose block or heading.
- Use exact offsets from the original string.
- Set `anchor` to `{ placement: 'after' }` for source-block tasks because the
  renderer uses the exact block.
- Assign stable IDs `existing-01`, `existing-02`, and so on.

- [ ] **Step 4: Run the focused tests**

```powershell
node --test tests/wechat-prompt-parser.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/wechat-images/prompt-parser.ts tests/wechat-prompt-parser.test.mjs
git commit -m "feat: parse WeChat image prompt blocks"
```

## Task 3: Generate Structured Tasks When Prompts Are Missing

**Files:**
- Create: `src/wechat-images/task-extractor.ts`
- Create: `tests/wechat-task-extractor.test.mjs`
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Write failing extraction tests**

Use a fake text client:

```js
const textClient = {
    calls: 0,
    async completeJson() {
        this.calls += 1;
        return JSON.stringify({
            tasks: [{
                prompt: 'editorial illustration of focused writing',
                description: '专注写作',
                anchor: {
                    heading: '为什么要写作',
                    nearbyText: '写作帮助我们整理思考',
                    placement: 'after'
                }
            }]
        });
    }
};
```

Assert:

- Existing prompts return parser tasks and `completeJson` is not called.
- Missing prompts call the text client once.
- JSON fences are stripped.
- Empty prompts, invalid placement, missing heading and nearby text, duplicate
  tasks, and more than `maxImages` are rejected.
- Output IDs are `generated-01`, `generated-02`, in response order.

- [ ] **Step 2: Run the tests and verify failure**

```powershell
node --test tests/wechat-task-extractor.test.mjs
```

Expected: FAIL because `ImageTaskExtractor` does not exist.

- [ ] **Step 3: Add a JSON-capable text method**

Extend `AIService` with:

```ts
async completeJson(prompt: string, content: string): Promise<string> {
    const response = await this.chat(prompt, content);
    if (!response.success || !response.content) {
        throw new Error(response.error || '文本 AI 未返回任务');
    }
    return response.content;
}
```

This keeps endpoint validation, timeout, retries, and credentials in the
existing service.

- [ ] **Step 4: Implement the extractor**

Create:

```ts
export interface JsonTextClient {
    completeJson(prompt: string, content: string): Promise<string>;
}

export class ImageTaskExtractor {
    constructor(
        private textClient: JsonTextClient,
        private maxImages: number
    ) {}

    async extract(source: string): Promise<ArticleImageTask[]>
}
```

The system instruction must demand only this shape:

```json
{
  "tasks": [
    {
      "prompt": "English image generation prompt",
      "description": "Chinese image description",
      "anchor": {
        "heading": "Exact Markdown heading text without #",
        "nearbyText": "Exact short excerpt copied from the article",
        "placement": "before or after"
      }
    }
  ]
}
```

Request three to five tasks, cap at `maxImages`, and instruct the model to copy
heading/excerpt text exactly. Parse after removing one optional fenced-code
wrapper. Validate every field and reject the entire response when invalid.

- [ ] **Step 5: Run focused tests and build**

```powershell
node --test tests/wechat-task-extractor.test.mjs
npm run build
```

Expected: tests PASS and esbuild exits 0.

- [ ] **Step 6: Commit**

```powershell
git add src/services/ai.ts src/wechat-images/task-extractor.ts tests/wechat-task-extractor.test.mjs main.js
git commit -m "feat: extract structured WeChat image tasks"
```

## Task 4: Render Images Without Mutating Source Content

**Files:**
- Create: `src/wechat-images/article-renderer.ts`
- Create: `tests/wechat-article-renderer.test.mjs`

- [ ] **Step 1: Write failing renderer tests**

Test these exact behaviors:

```js
test('replaces an existing prompt block by default', async () => {
    const rendered = renderIllustratedArticle(source, [{
        task,
        assetPath: '文章-已配图-assets/image-01.png'
    }], { keepOriginalPrompts: false });

    assert.match(rendered, /!\[\[文章-已配图-assets\/image-01\.png\]\]/);
    assert.doesNotMatch(rendered, /AI绘图提示词/);
    assert.equal(source, originalSource);
});
```

Also cover:

- `keepOriginalPrompts: true`.
- Heading plus nearby-text matching before and after.
- Multiple exact-offset edits applied from end to start.
- Unmatched generated anchors appended under one `## 配图` section.
- Failed tasks retain existing prompt blocks.
- Failed generated tasks insert a sanitized warning note.
- API keys, newlines, and provider response bodies are removed from errors.

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/wechat-article-renderer.test.mjs
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement pure rendering**

Export:

```ts
export interface RenderOptions {
    keepOriginalPrompts: boolean;
}

export function renderIllustratedArticle(
    source: string,
    results: TaskGenerationResult[],
    options: RenderOptions
): string
```

Use these rules:

- Existing successful task: replace exact source block, or retain it and append
  the embed when configured.
- Generated successful task: locate heading, then nearby text inside that
  section; insert before/after the excerpt.
- Failed existing task: keep source block and append warning.
- Failed generated task: place warning at anchor or fallback section.
- Unmatched anchors: collect under a single final `## 配图`.
- Escape description text used in Markdown.
- Reduce errors to one line and at most 160 characters.

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests/wechat-article-renderer.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/wechat-images/article-renderer.ts tests/wechat-article-renderer.test.mjs
git commit -m "feat: render illustrated WeChat articles"
```

## Task 5: Implement the OpenAI-Compatible Image Provider

**Files:**
- Create: `src/wechat-images/image-provider.ts`
- Create: `tests/wechat-image-provider.test.mjs`

- [ ] **Step 1: Write failing provider tests**

Inject `fetch` into the provider and test:

- Request URL is `${endpointWithoutSlash}/images/generations`.
- Request includes model, prompt, size, and `response_format: 'b64_json'`.
- Base64 PNG responses become `Uint8Array`.
- HTTPS image URLs are downloaded and normalized.
- `http://localhost` is accepted; other HTTP URLs are rejected.
- Unsupported MIME types and zero-byte or oversized payloads fail.
- Authentication errors include a safe message but never the API key.
- Timeout aborts the request.

Example:

```js
const provider = new OpenAICompatibleImageProvider(settings, async () => ({
    ok: true,
    json: async () => ({
        data: [{ b64_json: Buffer.from(pngBytes).toString('base64') }]
    })
}));

const image = await provider.generate({ prompt: 'test', size: '1536x1024' });
assert.equal(image.mimeType, 'image/png');
assert.deepEqual([...image.bytes], [...pngBytes]);
```

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/wechat-image-provider.test.mjs
```

Expected: FAIL because the provider is not implemented.

- [ ] **Step 3: Implement provider validation and normalization**

Create:

```ts
export class ImageProviderError extends Error {
    constructor(
        message: string,
        public readonly retryable: boolean,
        public readonly status?: number
    ) {
        super(message);
    }
}

export class OpenAICompatibleImageProvider implements ImageProvider {
    constructor(
        private settings: ImageGenerationSettings,
        private fetchFn: typeof fetch = fetch
    ) {}

    async generate(request: ImageGenerationRequest): Promise<GeneratedImage>
}
```

Validation requirements:

- Endpoint and downloaded URL must be HTTPS, except localhost HTTP.
- Accept `image/png`, `image/jpeg`, and `image/webp`.
- Detect base64 type by magic bytes.
- Reject empty data and data over 25 MB.
- Mark network errors, timeouts, 429, and 5xx as retryable.
- Mark 400, 401, 403, malformed response, and invalid image data as final.
- Never include headers, API keys, or full response bodies in thrown messages.

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests/wechat-image-provider.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/wechat-images/image-provider.ts tests/wechat-image-provider.test.mjs
git commit -m "feat: add OpenAI-compatible image provider"
```

## Task 6: Add Concurrency, Retry, and Progress Coordination

**Files:**
- Create: `src/wechat-images/generation-coordinator.ts`
- Create: `tests/wechat-generation-coordinator.test.mjs`

- [ ] **Step 1: Write failing coordinator tests**

Use a deferred fake provider to assert:

- In-flight requests never exceed configured concurrency.
- Results preserve source task order even when completion order differs.
- Retryable errors are retried exactly `retryCount` times after the first call.
- Non-retryable errors are attempted once.
- Progress receives `(completed, total)` after each final task result.
- One failed task does not prevent later tasks.

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/wechat-generation-coordinator.test.mjs
```

Expected: FAIL because `ImageGenerationCoordinator` does not exist.

- [ ] **Step 3: Implement the coordinator**

Create:

```ts
export class ImageGenerationCoordinator {
    constructor(
        private provider: ImageProvider,
        private concurrency: number,
        private retryCount: number
    ) {}

    async generateAll(
        tasks: ArticleImageTask[],
        size: string,
        onProgress: (completed: number, total: number) => void
    ): Promise<TaskGenerationResult[]>
}
```

Clamp concurrency to `1..5`. Use a shared next-index cursor and that many
workers. Each worker retries only `ImageProviderError.retryable === true`,
stores a sanitized error for failures, and increments progress exactly once
per completed task.

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests/wechat-generation-coordinator.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/wechat-images/generation-coordinator.ts tests/wechat-generation-coordinator.test.mjs
git commit -m "feat: coordinate image generation"
```

## Task 7: Resolve Shared Output Names and Write Files

**Files:**
- Create: `src/wechat-images/output-writer.ts`
- Create: `tests/wechat-output-writer.test.mjs`
- Modify: `src/services/file.ts`
- Modify: `src/interfaces.ts`

- [ ] **Step 1: Write failing output tests**

Use a fake vault adapter and assert:

- `文章.md` resolves to `文章-已配图.md` plus
  `文章-已配图-assets/`.
- Existing article or asset directory forces both to use `-1`.
- The asset directory is not created when all tasks fail.
- Successful bytes are written before the article is created.
- Article creation failure leaves the asset directory and reports its path.
- The source path is never passed to `modify`, `writeBinary`, or `create`.

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/wechat-output-writer.test.mjs
```

Expected: FAIL because output reservation and writing are missing.

- [ ] **Step 3: Add reusable path reservation**

Extend `FileService` with a method that checks article and directory together:

```ts
async resolveIllustratedOutput(originalFile: TFile): Promise<{
    articlePath: string;
    assetDirPath: string;
    baseName: string;
}>
```

Check `原名-已配图.md` and `原名-已配图-assets` as one reservation. Increment
the shared suffix until neither exists. Reuse `normalizePath` and the existing
conflict-attempt limit.

- [ ] **Step 4: Implement the writer with a narrow vault contract**

Define an injectable contract for tests:

```ts
export interface ImageOutputVault {
    exists(path: string): Promise<boolean>;
    createFolder(path: string): Promise<void>;
    writeBinary(path: string, data: ArrayBuffer): Promise<void>;
    createMarkdown(path: string, content: string): Promise<void>;
}
```

Create `ImageOutputWriter` methods to:

1. Resolve the shared base name.
2. Lazily create the asset directory on the first successful image.
3. Save images as `image-01.ext`, preserving task order.
4. Return results with `assetPath`.
5. Render and create the new Markdown article.

Wrap the real Obsidian vault with `adapter.writeBinary` or the supported vault
binary API, converting the exact `Uint8Array` slice to `ArrayBuffer`.

- [ ] **Step 5: Run focused tests and build**

```powershell
node --test tests/wechat-output-writer.test.mjs
npm run build
```

Expected: tests PASS and build exits 0.

- [ ] **Step 6: Commit**

```powershell
git add src/services/file.ts src/interfaces.ts src/wechat-images/output-writer.ts tests/wechat-output-writer.test.mjs main.js
git commit -m "feat: write illustrated article outputs"
```

## Task 8: Build the Workflow and Optional Task Preview

**Files:**
- Create: `src/wechat-images/workflow.ts`
- Create: `src/wechat-images/task-preview.ts`
- Create: `tests/wechat-workflow.test.mjs`
- Modify: `src/services/status-bar.ts`
- Modify: `src/interfaces.ts`
- Modify: `styles.css`

- [ ] **Step 1: Write failing workflow tests**

Inject all dependencies and assert:

- No active Markdown file returns before extraction.
- Empty source returns before extraction.
- Invalid image configuration returns before file creation.
- Preview rejection performs no image calls or writes.
- Preview acceptance proceeds.
- Progress text is `正在生成 2/5 张图片`.
- Partial failure still creates and opens the new article.
- Total generation failure creates an article but no asset directory.
- Extraction failure creates no output.
- Source content read at start is the exact content passed to the renderer.

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/wechat-workflow.test.mjs
```

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Add a promise-based task preview modal**

Create:

```ts
export class ImageTaskPreviewService {
    constructor(private app: App) {}

    confirm(tasks: ArticleImageTask[]): Promise<boolean>
}
```

The modal lists image number, description, prompt, and anchor summary. Resolve
`true` only from the CTA button; closing or cancelling resolves `false`.

- [ ] **Step 4: Add explicit progress support**

Add to `StatusBarService`:

```ts
setProgress(action: string, completed: number, total: number) {
    this.setProcessing(`${action} ${completed}/${total}`);
}
```

Update `IStatusBarService` to match.

- [ ] **Step 5: Implement orchestration**

Create `WeChatImageWorkflow.run(file?: TFile): Promise<WorkflowResult>` with
these ordered operations:

1. Reject concurrent calls through a workflow-local running flag.
2. Resolve provided file or active file and require `.md`.
3. Read and reject blank source.
4. Validate endpoint, key, model, limits, and size.
5. Extract tasks.
6. Preview when enabled; return a cancelled result when rejected.
7. Resolve shared output paths before generation.
8. Construct provider and coordinator from current settings.
9. Generate all tasks while updating status progress.
10. Save successful assets.
11. Render from the unchanged source string.
12. Create the new article.
13. Open it with `this.app.workspace.getLeaf().openFile(newFile)`.
14. Return success and failure counts.

Use `try/finally` to clear the workflow-local running flag. Fatal errors set
status-bar error state; completed partial runs set completed state.

- [ ] **Step 6: Style the preview modal**

Add scoped rules for:

```css
.ai-workbench-image-task-preview
.ai-workbench-image-task
.ai-workbench-image-task__prompt
.ai-workbench-image-task__anchor
```

Use Obsidian theme variables, wrapping long prompts without horizontal page
overflow.

- [ ] **Step 7: Run tests and build**

```powershell
node --test tests/wechat-workflow.test.mjs
npm run build
```

Expected: tests PASS and build exits 0.

- [ ] **Step 8: Commit**

```powershell
git add src/interfaces.ts src/services/status-bar.ts src/wechat-images/workflow.ts src/wechat-images/task-preview.ts tests/wechat-workflow.test.mjs styles.css main.js
git commit -m "feat: orchestrate one-click article images"
```

## Task 9: Persist and Edit Image Settings

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/settings.ts`
- Modify: `main.ts`
- Create: `tests/wechat-settings.test.mjs`

- [ ] **Step 1: Write failing settings tests**

Read source files and assert:

- `WorkbenchSettings` includes `images: ImageGenerationSettings`.
- `DEFAULT_SETTINGS.images` spreads `DEFAULT_IMAGE_SETTINGS`.
- `loadSettings` merges saved image settings with defaults.
- Settings UI includes endpoint, API key, model, size, timeout, retries,
  concurrency, max images, preview, and keep-prompts controls.
- `saveSettings` updates the workflow's settings.

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/wechat-settings.test.mjs
```

Expected: FAIL because image settings are not persisted or displayed.

- [ ] **Step 3: Add image settings to persisted types**

Import `ImageGenerationSettings` and `DEFAULT_IMAGE_SETTINGS`, then add:

```ts
export interface WorkbenchSettings {
    api: ApiSettings;
    images: ImageGenerationSettings;
    // existing sections remain unchanged
}
```

And:

```ts
images: { ...DEFAULT_IMAGE_SETTINGS }
```

Update `main.ts.loadSettings()`:

```ts
images: { ...DEFAULT_SETTINGS.images, ...saved?.images }
```

- [ ] **Step 4: Add the settings UI**

Create a `图片生成` section after text API settings. Use:

- Text controls for endpoint, API key, model, and size.
- Sliders: timeout `30..300`, retries `0..5`, concurrency `1..5`, maximum
  images `1..10`.
- Toggles for preview and keeping prompts.
- Existing API-key masking and endpoint validation helpers.

Every change updates `this.plugin.settings.images` and calls
`await this.plugin.saveSettings()`.

- [ ] **Step 5: Refresh workflow settings on save**

Add:

```ts
this.weChatImageWorkflow.updateSettings(this.settings.images);
```

The workflow must copy or replace settings, not retain stale nested data.

- [ ] **Step 6: Run tests and build**

```powershell
node --test tests/wechat-settings.test.mjs
npm run build
```

Expected: tests PASS and build exits 0.

- [ ] **Step 7: Commit**

```powershell
git add src/types/index.ts src/settings.ts main.ts tests/wechat-settings.test.mjs main.js
git commit -m "feat: configure image generation"
```

## Task 10: Wire Commands, Menus, Sidebar, and Shortcuts

**Files:**
- Modify: `main.ts`
- Modify: `src/services/context-menu.ts`
- Modify: `src/services/presets.ts`
- Modify: `src/settings.ts`
- Modify: `src/types/index.ts`
- Create: `tests/wechat-integration.test.mjs`

- [ ] **Step 1: Write failing integration tests**

Source-level assertions should verify:

- Command ID `wechat-insert-images`.
- Command calls `executeWeChatImageInsertion()`.
- Context menu receives and invokes an image callback in editor and file menus.
- File-menu callback passes the clicked file rather than relying on focus.
- WeChat sidebar renders a dedicated one-click image button.
- Shortcut action dropdown includes `wechat-insert-images`.
- Shortcut dispatch routes the action to the image workflow.
- Display-name lookup returns `公众号一键插入图片`.

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/wechat-integration.test.mjs
```

Expected: FAIL because the entry points are absent.

- [ ] **Step 3: Construct and expose the workflow**

In `main.ts`, construct:

```ts
this.weChatImageWorkflow = new WeChatImageWorkflow(
    this.app,
    this.aiService,
    this.fileService,
    this.statusBarService,
    new ImageTaskPreviewService(this.app),
    this.settings.images
);
```

Add:

```ts
async executeWeChatImageInsertion(file?: TFile): Promise<void> {
    if (this.isProcessing) {
        new Notice('正在处理中，请稍候...');
        return;
    }
    this.isProcessing = true;
    try {
        const result = await this.weChatImageWorkflow.run(file);
        if (result.cancelled) new Notice('已取消配图');
        else if (result.success) {
            new Notice(`配图完成：成功 ${result.successCount} 张，失败 ${result.failureCount} 张`);
        } else {
            new Notice(`配图失败：${result.error}`);
        }
    } finally {
        this.isProcessing = false;
    }
}
```

- [ ] **Step 4: Register the command**

Add:

```ts
this.addCommand({
    id: 'wechat-insert-images',
    name: '公众号一键插入图片',
    callback: () => this.executeWeChatImageInsertion()
});
```

- [ ] **Step 5: Add context-menu callbacks**

Extend `ContextMenuService` constructor with:

```ts
private executeWeChatImages: (file?: TFile) => Promise<void>
```

Add `公众号一键插入图片` to the editor menu. Add it to file menus and pass the
clicked `TFile` directly to avoid active-file race conditions.

- [ ] **Step 6: Add sidebar discovery**

Do not model this workflow as a normal `CustomPrompt`, because it does binary
generation and multi-file output. In the WeChat category rendering branch,
append one dedicated action button:

```ts
if (categoryId === 'wechat') {
    // button text: 公众号一键插入图片
    // click: this.plugin.executeWeChatImageInsertion()
}
```

Add a corresponding discoverability item in `presets.ts` only if the existing
sidebar renderer requires category metadata; it must not be importable as a
custom prompt.

- [ ] **Step 7: Route configurable shortcuts**

Allow `ShortcutBinding.actionId` to contain `wechat-insert-images`. Add the
action to `ShortcutModal`'s built-in dropdown. Update `refreshShortcuts()`:

```ts
if (actionId === 'wechat-insert-images') {
    this.executeWeChatImageInsertion();
} else if (actionId === 'custom' && customPromptId) {
    this.executeCustomPrompt(customPromptId);
} else {
    this.executeAction(actionId as ActionType);
}
```

Update `getActionDisplayName()` accordingly.

- [ ] **Step 8: Run focused and full verification**

```powershell
node --test tests/wechat-integration.test.mjs
npm test
npm run build
```

Expected: all tests PASS and build exits 0.

- [ ] **Step 9: Commit**

```powershell
git add main.ts src/services/context-menu.ts src/services/presets.ts src/settings.ts src/types/index.ts tests/wechat-integration.test.mjs main.js
git commit -m "feat: expose one-click WeChat image insertion"
```

## Task 11: Document Usage and Perform End-to-End Verification

**Files:**
- Modify: `使用说明.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Verify: all files changed by Tasks 1-10

- [ ] **Step 1: Document the workflow**

Add:

- Where to find the command.
- How existing prompts are recognized.
- How prompt-free articles receive generated tasks.
- Output naming and asset-directory examples.
- Partial-failure behavior.
- Image API configuration and local credential storage.
- The guarantee that the source article is not modified.

- [ ] **Step 2: Run the complete automated suite**

```powershell
npm test
npm run build
git diff --check
```

Expected:

- Every Node test passes.
- esbuild exits 0 and regenerates `main.js`.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 3: Run a manual Obsidian smoke test**

Use a temporary vault note containing two explicit prompts:

```markdown
# 测试文章

开场内容。

【配图1 - 位置：开头下方】
📷 图片描述：暖色写作场景
🎨 AI绘图提示词：warm editorial illustration of a writer, 16:9

## 第一节

正文内容。

🎨 AI提示词：minimal blue technology workflow diagram, 16:9
```

Verify:

1. The command appears in the command palette, sidebar, editor menu, and file
   menu.
2. The progress count advances.
3. `测试文章-已配图.md` and its matching asset directory are created.
4. Both embeds render.
5. `测试文章.md` remains byte-for-byte unchanged.
6. Re-running creates `测试文章-已配图-1.md` and the matching `-1-assets`
   directory.

- [ ] **Step 4: Run the prompt-free and failure smoke tests**

Verify:

1. A prompt-free article shows generated tasks when preview is enabled.
2. Cancelling preview creates no article or directory.
3. One deliberately invalid prompt produces a warning while successful images
   remain inserted.
4. Invalid API credentials fail every entered image task, create the documented
   failure article, and do not create an empty asset directory.
5. No notice, Markdown warning, or console line exposes the API key.

- [ ] **Step 5: Inspect scope and source immutability**

```powershell
git status --short
git diff --stat
git diff -- src/services/file.ts src/wechat-images main.ts
```

Confirm:

- No unrelated files or `.claude/` content are staged.
- No workflow path calls `vault.modify(sourceFile, ...)`.
- The generated bundle is the only mechanical output.

- [ ] **Step 6: Commit documentation and final verification**

```powershell
git add README.md 使用说明.md CHANGELOG.md main.js
git commit -m "docs: explain one-click WeChat image insertion"
```
