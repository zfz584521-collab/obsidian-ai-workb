import {
    PUBLISHING_PLATFORMS,
    PlatformSettings,
    PublishingPlatform,
    PublishingSettings,
    WebhookSettings
} from './types';

type SavedPlatformSettings = Partial<Omit<PlatformSettings, 'webhook'>> & {
    webhook?: Partial<WebhookSettings>;
};

export type SavedPublishingSettings = Partial<Omit<PublishingSettings, 'platforms'>> & {
    platforms?: Partial<Record<PublishingPlatform, SavedPlatformSettings>>;
};

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

export function mergePublishingSettings(saved?: SavedPublishingSettings): PublishingSettings {
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
