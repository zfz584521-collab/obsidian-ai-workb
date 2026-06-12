# WeChat One-Click Image Insertion Design

## Goal

Add a one-click workflow that generates and inserts images into a WeChat
article stored as an Obsidian Markdown note.

The workflow must never modify or overwrite the source article. It creates a
new illustrated article and stores generated images in an article-specific
asset directory.

## User Experience

The feature is available from:

- The WeChat preset category.
- The Obsidian command palette.
- The editor context menu.
- The configurable shortcut list.

The default flow starts immediately. A setting can enable a confirmation
dialog that lists the detected or generated image tasks before image
generation begins.

During generation, the status bar reports progress such as:

`Generating image 2/5`

On completion, the plugin reports the number of successful and failed images
and opens the new illustrated article.

## Output Files

For a source article named `Article.md`, the default output is:

```text
Article.md
Article-已配图.md
Article-已配图-assets/
  image-01.png
  image-02.png
```

Name conflicts are resolved by adding a numeric suffix:

```text
Article-已配图-1.md
Article-已配图-1-assets/
```

The article and its asset directory always use the same resolved suffix.
Images are embedded with Obsidian Markdown links:

```markdown
![[Article-已配图-assets/image-01.png]]
```

The source article is read only and remains unchanged in successful, partial,
and failed runs.

## Architecture

The feature uses a structured pipeline with independently testable services.

### WeChat Image Command

The command coordinates the user-facing workflow:

1. Validate the active Markdown file and image settings.
2. Read the complete source article.
3. Ask the task extractor for image tasks.
4. Optionally show the task preview.
5. Resolve the new article and asset directory names.
6. Generate each image through the configured provider.
7. Build the illustrated article entirely in memory.
8. Create the new article.
9. Open the new article and report the result.

It does not write to the source file and does not use the normal replace,
append, or backup path.

### Image Task Extractor

The extractor first parses image prompts already present in the article.
Supported labels include:

- `AI提示词`
- `AI绘图提示词`
- `AI生图提示词`

Leading icons, Markdown emphasis, spacing, and Chinese or English punctuation
may vary.

Each extracted task contains:

```ts
interface ArticleImageTask {
    id: string;
    prompt: string;
    description?: string;
    sourceBlock?: {
        startOffset: number;
        endOffset: number;
    };
    anchor: ArticleAnchor;
}
```

If at least one valid prompt is found, the parser uses the existing tasks and
does not ask the text AI to invent additional tasks.

If no valid prompt is found, the extractor calls the configured text AI and
requests strict JSON. The response describes three to five image tasks by
default and may not exceed the configured maximum of ten.

The JSON response is validated before any image request starts. Invalid JSON,
empty tasks, prompts over the configured limit, and unusable anchors stop the
workflow without creating output files.

### Article Anchors

Generated tasks identify insertion points using content-based anchors rather
than line numbers:

```ts
interface ArticleAnchor {
    heading?: string;
    nearbyText?: string;
    placement: 'before' | 'after';
}
```

Existing prompt blocks use their exact source offsets. AI-created tasks use a
heading plus a short exact excerpt from nearby source text. The renderer
matches the heading first and the excerpt second.

If an individual anchor cannot be matched during rendering, that image is
placed in a final `## 配图` section with its description. This fallback is not
treated as image-generation failure.

### Image Provider

Image generation is isolated behind an extensible provider contract:

```ts
interface ImageProvider {
    generate(request: ImageGenerationRequest): Promise<GeneratedImage>;
}
```

The first implementation targets an OpenAI-compatible image API. Text and
image APIs have separate settings so users can choose different endpoints,
keys, and models.

The provider returns normalized binary image data and a detected or validated
file extension. Provider-specific response formats, including base64 image
data and downloadable image URLs, are handled inside the provider.

Future providers such as local services, ComfyUI, or skill-backed generation
can implement the same interface without changing article parsing or
rendering.

### Image Generation Coordinator

The coordinator:

- Enforces the configured concurrency limit.
- Reports completed and total task counts.
- Applies request timeout and retry settings.
- Sanitizes generated filenames.
- Saves successful images in task order.
- Records each task as successful or failed.

The default filenames are deterministic:

```text
image-01.png
image-02.png
```

Retries apply only to timeout, rate-limit, network, and server errors.
Validation and authentication errors fail immediately.

### Article Renderer

The renderer receives the immutable source text, tasks, and generation
results. It returns a new Markdown string without writing files.

For existing prompt blocks:

- The default behavior replaces the complete detected image suggestion block
  with the generated image and optional description.
- When `keepOriginalPrompts` is enabled, the original block is retained and
  the image is inserted directly below it.

For AI-created tasks, the image is inserted at the matched content anchor.

Successful image output uses:

```markdown
![[Article-已配图-assets/image-01.png]]
```

If a task fails, its prompt content is retained and followed by a visible
failure note:

```markdown
> [!warning] 配图生成失败
> 本位置的图片未生成成功：<safe error summary>
```

The renderer applies edits from the end of the article toward the beginning
so earlier offsets remain valid.

### Output Writer

The output writer resolves one shared available base name for the article and
asset directory before generation starts.

It creates the asset directory only when the first image is ready to save.
After all generation attempts finish, it creates the new article with the
rendered content.

If article creation fails after images have been saved, the asset directory is
kept to avoid destroying generated work. The plugin reports its path so the
user can recover the images.

## Settings

Add an image-generation settings section containing:

- Provider type.
- Image API endpoint.
- Image API key.
- Image model.
- Default image size or aspect ratio.
- Request timeout.
- Retry count.
- Maximum concurrency.
- Maximum images per article, default `10`.
- Preview image tasks before generation, default `false`.
- Keep original prompt blocks, default `false`.

Image API credentials are stored locally through the existing plugin settings
mechanism. They are independent from text AI credentials.

The first provider exposes only settings supported by the OpenAI-compatible
request contract. Unsupported provider options are not sent.

## Partial Failure Behavior

Image tasks are independent. A failed image does not cancel remaining tasks.

When some images succeed:

- Successful files are saved and inserted.
- Failed positions retain their prompt and receive a failure note.
- The new article is created.
- The completion notice reports success and failure counts.

When every image fails:

- A new article is still created because each original prompt and its failure
  note provide a complete record of the attempted run.
- No empty asset directory is created.

Fatal failures that occur before task execution, such as invalid settings,
empty articles, invalid generated task JSON, or zero tasks, create neither an
article nor an asset directory.

## Safety and Validation

- Only an active Markdown file can be processed.
- Empty articles are rejected.
- API endpoint validation follows the existing HTTPS rule, with HTTP allowed
  only for localhost.
- Article names, directory names, image names, and extensions are sanitized.
- Downloadable image URLs must use HTTPS, or HTTP on localhost.
- Image responses must pass size and MIME-type validation before being saved.
- Error messages inserted into Markdown are reduced to a safe, short summary
  and must not contain API keys or full provider responses.
- The source article is never passed to a file modification method.

## Integration With Existing Code

The implementation should reuse:

- Existing command, context-menu, sidebar, and shortcut registration patterns.
- The current status bar service for progress and completion state.
- The current settings tab and local persistence.
- `FileService` naming behavior where practical, extended so an article and
  asset directory can reserve one shared conflict-free suffix.
- The current text `AIService` when prompts must be generated for an article
  that has none.

The image workflow remains separate from `ActionHandler` because it has
multiple AI calls, binary outputs, partial success, and a strict requirement
to create a new article.

## Tests

Unit tests cover:

- Parsing every supported prompt label and punctuation variation.
- Parsing multiple existing image blocks in source order.
- Falling back to text AI only when no valid existing prompt is found.
- Strict validation of generated JSON tasks and the ten-image limit.
- Exact source-block replacement.
- Prompt retention mode.
- Heading and nearby-text anchor matching.
- End-of-article fallback for unmatched anchors.
- Successful, partial, and total image-generation failure.
- Retry classification and concurrency limits.
- MIME type, extension, URL, and path validation.
- Shared numeric suffix resolution for article and asset directory.
- Rendering without changing source content.

Integration-oriented tests cover:

- Command registration in all required entry points.
- Settings persistence and provider construction.
- Binary image writes followed by new article creation.
- No source-file modification calls in any result path.
- Opening the new article after completion.

The final verification includes the TypeScript build and the repository's
existing test suite.

## Acceptance Criteria

The feature is complete when:

1. A user can run one command on a WeChat Markdown article.
2. Existing prompts are used when present; otherwise structured tasks are
   generated from the article.
3. Images are produced through an extensible provider interface.
4. Successful images are saved beside the new article in its asset directory.
5. Images appear at their intended positions or in the documented fallback
   section.
6. Partial failures are visible without discarding successful work.
7. The new article follows the `原文章名-已配图.md` naming rule with automatic
   conflict numbering.
8. The original article remains byte-for-byte unchanged.
