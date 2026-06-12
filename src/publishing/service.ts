import { PublishingAdapterFactory } from './adapters';
import {
    applyPlatformOverride,
    createIdempotencyKey
} from './content';
import {
    ConnectionTestResult,
    PlatformAdapter,
    PlatformContentOverride,
    PlatformPublishRequest,
    PlatformPublishResult,
    PublishContent,
    PublishingHistoryEntry,
    PublishingPlatform,
    PublishingSettings,
    PublishTaskResult,
    PublishTaskStatus
} from './types';
import { validateCommonContent } from './validation';

const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 2;
const MAX_HISTORY_ENTRIES = 50;

interface AdapterFactoryLike {
    create(platform: PublishingPlatform, settings: PublishingSettings['platforms'][PublishingPlatform]): PlatformAdapter;
}

export interface PublishTaskInput {
    content: PublishContent;
    overrides: Partial<Record<PublishingPlatform, PlatformContentOverride>>;
    platforms: PublishingPlatform[];
}

export class PublishingService {
    private history: PublishingHistoryEntry[];

    constructor(
        private settings: PublishingSettings,
        private adapterFactory: AdapterFactoryLike | PublishingAdapterFactory,
        private saveHistory: (entries: PublishingHistoryEntry[]) => Promise<void>,
        private sleep: (ms: number) => Promise<void> =
            ms => new Promise(resolve => setTimeout(resolve, ms)),
        initialHistory: PublishingHistoryEntry[] = [],
        private createTaskId: () => string =
            () => `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    ) {
        this.history = [...initialHistory].slice(0, MAX_HISTORY_ENTRIES);
    }

    updateSettings(settings: PublishingSettings): void {
        this.settings = settings;
    }

    async publishAll(input: PublishTaskInput): Promise<PublishTaskResult> {
        const taskId = this.createTaskId();
        const requests: Partial<Record<PublishingPlatform, PlatformPublishRequest>> = {};

        for (const platform of input.platforms) {
            const content = applyPlatformOverride(input.content, input.overrides[platform]);
            requests[platform] = {
                taskId,
                platform,
                content,
                settings: this.settings.platforms[platform],
                idempotencyKey: await createIdempotencyKey(taskId, platform, content)
            };
        }

        return this.runRequests(taskId, input.content.sourcePath, input.platforms, requests);
    }

    async retryFailed(task: PublishTaskResult): Promise<PublishTaskResult> {
        const platforms = task.platforms.filter(platform => task.results[platform]?.success === false);
        const requests: Partial<Record<PublishingPlatform, PlatformPublishRequest>> = {};
        for (const platform of platforms) {
            const request = task.requests[platform];
            if (request) requests[platform] = request;
        }
        return this.runRequests(task.taskId, task.sourcePath, platforms, requests);
    }

    async testConnection(platform: PublishingPlatform): Promise<ConnectionTestResult> {
        const settings = this.settings.platforms[platform];
        if (!settings.enabled) {
            return { success: false, message: '请先启用该发布平台' };
        }
        try {
            return await this.adapterFactory.create(platform, settings).testConnection();
        } catch {
            return { success: false, message: '平台连接测试失败' };
        }
    }

    private async runRequests(
        taskId: string,
        sourcePath: string,
        platforms: PublishingPlatform[],
        requests: Partial<Record<PublishingPlatform, PlatformPublishRequest>>
    ): Promise<PublishTaskResult> {
        const results: Partial<Record<PublishingPlatform, PlatformPublishResult>> = {};
        let nextIndex = 0;
        const worker = async () => {
            while (nextIndex < platforms.length) {
                const platform = platforms[nextIndex++];
                const request = requests[platform];
                if (!request) {
                    results[platform] = platformFailure(
                        platform,
                        'PUBLISH_REQUEST_MISSING',
                        '发布请求不存在',
                        false
                    );
                    continue;
                }
                try {
                    results[platform] = await this.executeRequest(request);
                } catch {
                    results[platform] = platformFailure(
                        platform,
                        'ADAPTER_ERROR',
                        '平台适配器执行失败',
                        false
                    );
                }
            }
        };
        const workers: Promise<void>[] = [];
        for (let index = 0; index < Math.min(MAX_CONCURRENCY, platforms.length); index++) {
            workers.push(worker());
        }
        await Promise.all(workers);

        const result: PublishTaskResult = {
            taskId,
            sourcePath,
            platforms,
            status: statusFromResults(platforms, results),
            requests,
            results
        };
        await this.persistHistory(result);
        return result;
    }

    private async executeRequest(
        request: PlatformPublishRequest
    ): Promise<PlatformPublishResult> {
        if (!request.settings.enabled) {
            return platformFailure(
                request.platform,
                'PLATFORM_DISABLED',
                '该发布平台尚未启用',
                false
            );
        }

        const commonIssues = validateCommonContent(request.content);
        if (commonIssues.length > 0) {
            const issue = commonIssues[0];
            return platformFailure(
                request.platform,
                issue.code,
                issue.message,
                false,
                issue.field
            );
        }

        const adapter = this.adapterFactory.create(request.platform, request.settings);
        const adapterIssues = await adapter.validate(request);
        if (adapterIssues.length > 0) {
            const issue = adapterIssues[0];
            return platformFailure(
                request.platform,
                issue.code,
                issue.message,
                false,
                issue.field
            );
        }

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const result = await adapter.createDraft(request);
            if (result.success || !result.error?.retryable || attempt === MAX_RETRIES) {
                return result;
            }
            await this.sleep(250 * Math.pow(2, attempt));
        }

        return platformFailure(
            request.platform,
            'PUBLISH_FAILED',
            '发布失败',
            false
        );
    }

    private async persistHistory(task: PublishTaskResult): Promise<void> {
        const currentIndex = this.history.findIndex(entry => entry.taskId === task.taskId);
        const previous = currentIndex >= 0 ? this.history[currentIndex] : undefined;
        const mergedResults = {
            ...(previous?.results || {}),
            ...sanitizeResults(task.results)
        };
        const entry: PublishingHistoryEntry = {
            taskId: task.taskId,
            sourcePath: task.sourcePath,
            createdAt: previous?.createdAt || Date.now(),
            status: statusFromHistoryResults(mergedResults),
            results: mergedResults
        };

        if (currentIndex >= 0) {
            this.history.splice(currentIndex, 1);
        }
        this.history.unshift(entry);
        this.history = this.history.slice(0, MAX_HISTORY_ENTRIES);
        await this.saveHistory([...this.history]);
    }
}

function sanitizeResults(
    results: Partial<Record<PublishingPlatform, PlatformPublishResult>>
): PublishingHistoryEntry['results'] {
    const sanitized: PublishingHistoryEntry['results'] = {};
    for (const platform of Object.keys(results) as PublishingPlatform[]) {
        const result = results[platform];
        if (!result) continue;
        sanitized[platform] = {
            success: result.success,
            targetKind: result.targetKind,
            draftId: result.draftId,
            managementUrl: result.managementUrl,
            errorCode: result.error?.code,
            errorMessage: result.error?.message
        };
    }
    return sanitized;
}

function statusFromResults(
    platforms: PublishingPlatform[],
    results: Partial<Record<PublishingPlatform, PlatformPublishResult>>
): PublishTaskStatus {
    if (platforms.length === 0) return 'failed';
    const successCount = platforms.filter(platform => results[platform]?.success).length;
    if (successCount === platforms.length) return 'success';
    return successCount > 0 ? 'partial' : 'failed';
}

function statusFromHistoryResults(
    results: PublishingHistoryEntry['results']
): PublishTaskStatus {
    const values = Object.keys(results)
        .map(platform => results[platform as PublishingPlatform])
        .filter((result): result is NonNullable<typeof result> => Boolean(result));
    if (values.length === 0) return 'failed';
    const successCount = values.filter(result => result.success).length;
    if (successCount === values.length) return 'success';
    return successCount > 0 ? 'partial' : 'failed';
}

function platformFailure(
    platform: PublishingPlatform,
    code: string,
    message: string,
    retryable: boolean,
    field?: string
): PlatformPublishResult {
    return {
        platform,
        success: false,
        error: { code, message, retryable, field }
    };
}
