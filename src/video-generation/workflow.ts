import type { ImageGenerationSettings, ImageProvider } from '../wechat-images/types';
import { OpenAICompatibleImageProvider } from '../wechat-images/image-provider';
import type { VideoGenerationSettings, VideoProvider } from './types';
import { OpenAICompatibleVideoProvider } from './video-provider';

interface WorkflowFile {
    path: string;
    extension: string;
    basename: string;
}

interface WorkflowApp {
    workspace: {
        getActiveFile(): WorkflowFile | null;
        getActiveViewOfType(type: unknown): { file?: WorkflowFile; editor?: { getSelection(): string } } | null;
    };
    vault: {
        read(file: WorkflowFile): Promise<string>;
        modify(file: WorkflowFile, content: string): Promise<void>;
        createFolder?(path: string): Promise<unknown>;
        adapter: {
            exists(path: string): Promise<boolean>;
            writeBinary(path: string, data: ArrayBuffer): Promise<void>;
        };
    };
}

interface WorkflowStatus {
    setProcessing(action: string): void;
    setProgress(action: string, completed: number, total: number): void;
    setCompleted(tokens?: number): void;
    setError(error: string): void;
}

export interface VideoPromptBuilder {
    build(source: string): Promise<string>;
}

export interface VideoWorkflowResult {
    success: boolean;
    outputPath?: string;
    error?: string;
}

export interface VideoPromptPreparationResult {
    success: boolean;
    file?: WorkflowFile;
    prompt?: string;
    error?: string;
}

type ProviderFactory = (settings: VideoGenerationSettings) => VideoProvider;
type ImageProviderFactory = (settings: ImageGenerationSettings) => ImageProvider;

const VIDEO_PROMPT_HEADING = 'AI 短视频提示词';
const VIDEO_IMAGE_HEADING = 'AI 短视频参考图';
const VIDEO_OUTPUT_HEADING = 'AI 生成短视频';

function validateSettings(settings: VideoGenerationSettings): void {
    let url: URL;
    try {
        url = new URL(settings.endpoint);
    } catch {
        throw new Error('视频 API 地址格式无效');
    }
    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
        throw new Error('视频 API 必须使用 HTTPS，本地服务除外');
    }
    if (!settings.apiKey.trim()) throw new Error('请先配置视频 API Key');
    if (!settings.model.trim()) throw new Error('请先配置视频模型');
    if (!settings.size.trim()) throw new Error('请先配置视频尺寸');
    if (settings.duration < 1 || settings.duration > 60) {
        throw new Error('视频时长必须在 1 到 60 秒之间');
    }
}

function validateImageSettings(settings?: ImageGenerationSettings): ImageGenerationSettings {
    if (!settings) throw new Error('请先配置图片生成模型');
    let url: URL;
    try {
        url = new URL(settings.endpoint);
    } catch {
        throw new Error('图片 API 地址格式无效');
    }
    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
        throw new Error('图片 API 必须使用 HTTPS，本地服务除外');
    }
    if (!settings.apiKey.trim()) throw new Error('请先配置图片 API Key');
    if (!settings.model.trim()) throw new Error('请先配置图片模型');
    if (!settings.size.trim()) throw new Error('请先配置图片尺寸');
    return settings;
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}

function splitPath(path: string): { parent: string; basename: string } {
    const normalized = normalizePath(path);
    const slash = normalized.lastIndexOf('/');
    const parent = slash >= 0 ? normalized.slice(0, slash) : '';
    const filename = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    return { parent, basename: filename.replace(/\.md$/i, '') };
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
}

function joinPath(parent: string, child: string): string {
    return parent ? `${parent}/${child}` : child;
}

function relativeEmbedPath(filePath: string, assetPath: string): string {
    const { parent } = splitPath(filePath);
    return parent && assetPath.startsWith(`${parent}/`)
        ? assetPath.slice(parent.length + 1)
        : assetPath;
}

async function resolveAssetPath(
    file: WorkflowFile,
    exists: (path: string) => Promise<boolean>,
    filenamePrefix: string,
    extension: string
): Promise<{ assetDirPath: string; assetPath: string }> {
    const { parent, basename } = splitPath(file.path);
    const assetDirPath = joinPath(parent, `${basename}-assets`);
    for (let counter = 1; counter <= 100; counter++) {
        const assetPath = joinPath(
            assetDirPath,
            `${filenamePrefix}-${String(counter).padStart(2, '0')}.${extension}`
        );
        if (!await exists(assetPath)) return { assetDirPath, assetPath };
    }
    throw new Error('无法创建文件：文件名冲突过多');
}

function extractPromptBlock(markdown: string): string | undefined {
    const lines = markdown.split(/\r?\n/);
    const headingIndex = lines.findIndex(line =>
        /^##\s+AI\s*短视频提示词\s*$/.test(line.trim())
    );
    if (headingIndex < 0) return undefined;
    const values: string[] = [];
    for (let index = headingIndex + 1; index < lines.length; index++) {
        const line = lines[index];
        if (/^##\s+/.test(line.trim())) break;
        values.push(line);
    }
    return values.join('\n').trim() || undefined;
}

export class AIShortVideoPromptBuilder implements VideoPromptBuilder {
    constructor(private textClient: { chat(prompt: string, content: string): Promise<{ success: boolean; content?: string; error?: string }> }) {}

    async build(source: string): Promise<string> {
        const prompt = [
            '请把下面的短视频文案或脚本改写成适合 AI 视频生成模型的中文提示词。',
            '要求：竖屏短视频，镜头语言清晰，包含主体、场景、动作、光线、风格和节奏。',
            '如果原文已经是分镜脚本，请保留分镜结构并压缩成可直接生成视频的提示词。',
            '只返回提示词，不要解释。'
        ].join('\n');
        const response = await this.textClient.chat(prompt, source);
        if (!response.success || !response.content?.trim()) {
            throw new Error(response.error || '视频提示词生成失败');
        }
        return response.content.trim();
    }
}

export class VideoGenerationWorkflow {
    private running = false;

    constructor(
        private app: WorkflowApp,
        private status: WorkflowStatus,
        private promptBuilder: VideoPromptBuilder,
        private settings: VideoGenerationSettings,
        private providerFactory: ProviderFactory =
            value => new OpenAICompatibleVideoProvider(value),
        private markdownViewType?: unknown,
        private imageSettings?: ImageGenerationSettings,
        private imageProviderFactory: ImageProviderFactory =
            value => new OpenAICompatibleImageProvider(value)
    ) {}

    updateSettings(settings: VideoGenerationSettings): void {
        this.settings = { ...settings };
    }

    updateImageSettings(settings: ImageGenerationSettings): void {
        this.imageSettings = { ...settings };
    }

    async run(file?: WorkflowFile): Promise<VideoWorkflowResult> {
        return this.runInternal(file);
    }

    async preparePrompt(file?: WorkflowFile): Promise<VideoPromptPreparationResult> {
        if (this.running) {
            return { success: false, error: '短视频生成任务正在运行' };
        }
        this.running = true;

        try {
            const { target, source } = await this.resolveSource(file, false);
            this.status.setProcessing('正在生成视频提示词');
            const prompt = await this.promptBuilder.build(source);
            this.status.setCompleted();
            return { success: true, file: target, prompt };
        } catch (error) {
            const message = error instanceof Error ? error.message : '视频提示词生成失败';
            this.status.setError(message);
            return { success: false, error: message };
        } finally {
            this.running = false;
        }
    }

    async writePrompt(prompt: string = '', file?: WorkflowFile): Promise<VideoWorkflowResult> {
        if (this.running) {
            return { success: false, error: '短视频生成任务正在运行' };
        }
        this.running = true;

        try {
            const value = prompt.trim();
            if (!value) throw new Error('视频提示词不能为空');
            const { target, markdown } = await this.resolveSource(file, false);
            const nextContent = `${markdown.trimEnd()}\n\n## ${VIDEO_PROMPT_HEADING}\n\n${value}\n`;
            await this.app.vault.modify(target, nextContent);
            this.status.setCompleted();
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : '视频提示词写入失败';
            this.status.setError(message);
            return { success: false, error: message };
        } finally {
            this.running = false;
        }
    }

    async generateImage(file?: WorkflowFile): Promise<VideoWorkflowResult> {
        if (this.running) {
            return { success: false, error: '短视频生成任务正在运行' };
        }
        this.running = true;

        try {
            const imageSettings = validateImageSettings(this.imageSettings);
            const { target, markdown, source } = await this.resolveSource(file, false);
            const prompt = extractPromptBlock(markdown) || source;
            if (!prompt.trim()) throw new Error('视频图片提示词不能为空');

            this.status.setProgress('正在生成短视频参考图', 0, 1);
            const image = await this.imageProviderFactory(imageSettings).generate({
                prompt,
                size: imageSettings.size
            });
            const output = await resolveAssetPath(
                target,
                path => this.app.vault.adapter.exists(path),
                'video-reference',
                image.extension
            );
            if (!await this.app.vault.adapter.exists(output.assetDirPath)) {
                await this.app.vault.createFolder?.(output.assetDirPath);
            }
            await this.app.vault.adapter.writeBinary(
                output.assetPath,
                exactArrayBuffer(image.bytes)
            );

            const embedPath = relativeEmbedPath(target.path, output.assetPath);
            const nextContent = `${markdown.trimEnd()}\n\n## ${VIDEO_IMAGE_HEADING}\n\n![[${embedPath}]]\n`;
            await this.app.vault.modify(target, nextContent);

            this.status.setProgress('正在生成短视频参考图', 1, 1);
            this.status.setCompleted();
            return { success: true, outputPath: output.assetPath };
        } catch (error) {
            const message = error instanceof Error ? error.message : '短视频参考图生成失败';
            this.status.setError(message);
            return { success: false, error: message };
        } finally {
            this.running = false;
        }
    }

    async runWithPrompt(prompt: string, file?: WorkflowFile): Promise<VideoWorkflowResult> {
        return this.runInternal(file, prompt);
    }

    private async runInternal(file?: WorkflowFile, confirmedPrompt?: string): Promise<VideoWorkflowResult> {
        if (this.running) {
            return { success: false, error: '短视频生成任务正在运行' };
        }
        this.running = true;

        try {
            const { target, markdown, source } = await this.resolveSource(file, true);
            let prompt = confirmedPrompt?.trim() || extractPromptBlock(markdown);
            if (!prompt) {
                this.status.setProcessing('正在生成视频提示词');
                prompt = await this.promptBuilder.build(source);
            }
            if (!prompt) throw new Error('视频提示词不能为空');

            this.status.setProgress('正在生成短视频', 0, 1);
            const video = await this.providerFactory(this.settings).generate({
                prompt,
                size: this.settings.size,
                duration: this.settings.duration
            });
            const output = await resolveAssetPath(
                target,
                path => this.app.vault.adapter.exists(path),
                'video',
                video.extension
            );
            if (!await this.app.vault.adapter.exists(output.assetDirPath)) {
                await this.app.vault.createFolder?.(output.assetDirPath);
            }
            await this.app.vault.adapter.writeBinary(
                output.assetPath,
                exactArrayBuffer(video.bytes)
            );

            const embedPath = relativeEmbedPath(target.path, output.assetPath);
            const nextContent = `${markdown.trimEnd()}\n\n## ${VIDEO_OUTPUT_HEADING}\n\n![[${embedPath}]]\n`;
            await this.app.vault.modify(target, nextContent);

            this.status.setProgress('正在生成短视频', 1, 1);
            this.status.setCompleted();
            return { success: true, outputPath: output.assetPath };
        } catch (error) {
            const message = error instanceof Error ? error.message : '短视频生成失败';
            this.status.setError(message);
            return { success: false, error: message };
        } finally {
            this.running = false;
        }
    }

    private async resolveSource(file?: WorkflowFile, shouldValidateVideo: boolean = true): Promise<{
        target: WorkflowFile;
        markdown: string;
        source: string;
    }> {
        const target = file || this.app.workspace.getActiveFile();
        if (!target || target.extension !== 'md') {
            throw new Error('请先打开一篇 Markdown 笔记');
        }

        if (shouldValidateVideo) validateSettings(this.settings);
        const markdown = await this.app.vault.read(target);
        const selected = this.getSelection(target);
        const source = (selected || markdown).trim();
        if (!source) throw new Error('短视频文案或脚本为空');
        return { target, markdown, source };
    }

    private getSelection(file: WorkflowFile): string | undefined {
        const view = this.app.workspace.getActiveViewOfType(this.markdownViewType);
        if (view?.file?.path !== file.path) return undefined;
        const selection = view.editor?.getSelection();
        return selection?.trim() || undefined;
    }
}
