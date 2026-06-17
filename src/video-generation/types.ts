export type VideoProviderType = 'openai-compatible' | 'webhook';

export interface VideoGenerationSettings {
    provider: VideoProviderType;
    endpoint: string;
    apiKey: string;
    model: string;
    size: string;
    duration: number;
    timeout: number;
    retryCount: number;
    pollInterval: number;
    maxPollAttempts: number;
}

export const DEFAULT_VIDEO_SETTINGS: VideoGenerationSettings = {
    provider: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'video-model',
    size: '1080x1920',
    duration: 5,
    timeout: 600,
    retryCount: 1,
    pollInterval: 5,
    maxPollAttempts: 120
};

export interface VideoGenerationRequest {
    prompt: string;
    size: string;
    duration: number;
}

export interface GeneratedVideo {
    bytes: Uint8Array;
    extension: 'mp4' | 'webm' | 'mov';
    mimeType: 'video/mp4' | 'video/webm' | 'video/quicktime';
}

export interface VideoProvider {
    generate(request: VideoGenerationRequest): Promise<GeneratedVideo>;
}
