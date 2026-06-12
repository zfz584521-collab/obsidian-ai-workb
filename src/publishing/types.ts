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
