import type { ImageGenerationSettings, ImageProvider } from './types';
import type { JsonTextClient } from './task-extractor';
import { ImageTaskExtractor } from './task-extractor';
import {
    ImageProviderError,
    OpenAICompatibleImageProvider
} from './image-provider';
import { ImageGenerationCoordinator } from './generation-coordinator';
import { renderIllustratedArticle } from './article-renderer';
import {
    IllustratedOutputPaths,
    ImageOutputWriter
} from './output-writer';

export { ImageProviderError } from './image-provider';

interface WorkflowFile {
    path: string;
    extension: string;
}

interface WorkflowApp {
    workspace: {
        getActiveFile(): WorkflowFile | null;
        getLeaf(): { openFile(file: any): Promise<void> };
    };
    vault: {
        read(file: WorkflowFile): Promise<string>;
        createFolder(path: string): Promise<void>;
        create(path: string, content: string): Promise<any>;
        adapter: {
            exists(path: string): Promise<boolean>;
            writeBinary(path: string, data: ArrayBuffer): Promise<void>;
        };
    };
}

interface WorkflowFileService {
    resolveIllustratedOutput(file: WorkflowFile): Promise<IllustratedOutputPaths>;
}

interface WorkflowStatus {
    setProcessing(action: string): void;
    setProgress(action: string, completed: number, total: number): void;
    setCompleted(tokens?: number): void;
    setError(error: string): void;
}

interface WorkflowPreview {
    confirm(tasks: import('./types').ArticleImageTask[]): Promise<boolean>;
}

export interface WorkflowResult {
    success: boolean;
    cancelled?: boolean;
    successCount?: number;
    failureCount?: number;
    outputPath?: string;
    error?: string;
}

type ProviderFactory = (settings: ImageGenerationSettings) => ImageProvider;

function validateSettings(settings: ImageGenerationSettings): void {
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
    if (settings.maxImages < 1 || settings.maxImages > 10) {
        throw new Error('单篇图片数量必须在 1 到 10 之间');
    }
}

export class WeChatImageWorkflow {
    private running = false;

    constructor(
        private app: WorkflowApp,
        private textClient: JsonTextClient,
        private fileService: WorkflowFileService,
        private status: WorkflowStatus,
        private preview: WorkflowPreview,
        private settings: ImageGenerationSettings,
        private providerFactory: ProviderFactory =
            value => new OpenAICompatibleImageProvider(value)
    ) {}

    updateSettings(settings: ImageGenerationSettings): void {
        this.settings = { ...settings };
    }

    async run(file?: WorkflowFile): Promise<WorkflowResult> {
        if (this.running) {
            return { success: false, error: '公众号配图任务正在运行' };
        }
        this.running = true;

        try {
            const target = file || this.app.workspace.getActiveFile();
            if (!target || target.extension !== 'md') {
                throw new Error('请先打开一篇 Markdown 文章');
            }

            const source = await this.app.vault.read(target);
            if (!source.trim()) throw new Error('文章内容为空');
            validateSettings(this.settings);
            this.status.setProcessing('正在分析公众号配图');

            const extractor = new ImageTaskExtractor(
                this.textClient,
                this.settings.maxImages
            );
            const tasks = await extractor.extract(source);
            if (this.settings.previewTasks && !await this.preview.confirm(tasks)) {
                this.status.setCompleted();
                return { success: false, cancelled: true };
            }

            const output = await this.fileService.resolveIllustratedOutput(target);
            const coordinator = new ImageGenerationCoordinator(
                this.providerFactory(this.settings),
                this.settings.concurrency,
                this.settings.retryCount
            );
            const generated = await coordinator.generateAll(
                tasks,
                this.settings.size,
                (completed, total) =>
                    this.status.setProgress('正在生成', completed, total)
            );

            const writer = new ImageOutputWriter({
                exists: path => this.app.vault.adapter.exists(path),
                createFolder: path => this.app.vault.createFolder(path),
                writeBinary: (path, data) =>
                    this.app.vault.adapter.writeBinary(path, data),
                createMarkdown: (path, content) =>
                    this.app.vault.create(path, content)
            });
            const saved = await writer.saveImages(output, generated);
            const content = renderIllustratedArticle(source, saved, {
                keepOriginalPrompts: this.settings.keepOriginalPrompts
            });
            const newFile = await writer.createArticle(output, content);
            await this.app.workspace.getLeaf().openFile(newFile);

            const successCount = saved.filter(result => !!result.assetPath).length;
            const failureCount = saved.length - successCount;
            this.status.setCompleted();
            return {
                success: true,
                successCount,
                failureCount,
                outputPath: output.articlePath
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : '公众号配图失败';
            this.status.setError(message);
            return { success: false, error: message };
        } finally {
            this.running = false;
        }
    }
}
