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
