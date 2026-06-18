import {
    ArticleImageTask,
    ImageProvider,
    TaskGenerationResult
} from './types';
import { ImageProviderError } from './image-provider';

export { ImageProviderError } from './image-provider';

function sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : '未知错误';
    return message
        .split(/\r?\n/, 1)[0]
        .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[REDACTED]')
        .slice(0, 160);
}

export class ImageGenerationCoordinator {
    private readonly workerCount: number;
    private readonly retries: number;

    constructor(
        private provider: ImageProvider,
        concurrency: number,
        retryCount: number,
        private sleep: (ms: number) => Promise<void> =
            ms => new Promise(resolve => setTimeout(resolve, ms))
    ) {
        this.workerCount = Math.max(1, Math.min(5, Math.floor(concurrency) || 1));
        this.retries = Math.max(0, Math.floor(retryCount) || 0);
    }

    async generateAll(
        tasks: ArticleImageTask[],
        size: string,
        onProgress: (completed: number, total: number) => void
    ): Promise<TaskGenerationResult[]> {
        const results = new Array<TaskGenerationResult>(tasks.length);
        let nextIndex = 0;
        let completed = 0;

        const worker = async () => {
            while (true) {
                const index = nextIndex++;
                if (index >= tasks.length) return;
                const task = tasks[index];

                try {
                    results[index] = {
                        task,
                        image: await this.generateWithRetry(task, size)
                    };
                } catch (error) {
                    results[index] = {
                        task,
                        error: sanitizeError(error)
                    };
                }

                completed += 1;
                onProgress(completed, tasks.length);
            }
        };

        const count = Math.min(this.workerCount, tasks.length);
        await Promise.all(Array.from({ length: count }, () => worker()));
        return results;
    }

    private async generateWithRetry(task: ArticleImageTask, size: string) {
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            try {
                return await this.provider.generate({ prompt: task.prompt, size });
            } catch (error) {
                const retryable = error instanceof ImageProviderError && error.retryable;
                if (!retryable || attempt === this.retries) throw error;
                await this.sleep(1000 * Math.pow(2, attempt));
            }
        }
        throw new Error('图片生成失败');
    }
}
