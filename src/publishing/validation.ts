import {
    PlatformSettings,
    PublishContent,
    PublishingPlatform,
    ValidationIssue
} from './types';

const PLATFORM_NAMES: Record<PublishingPlatform, string> = {
    wechat: '微信公众号',
    xiaohongshu: '小红书',
    wechatChannels: '视频号',
    douyin: '抖音',
    x: 'X',
    youtube: 'YouTube'
};

export function validateServiceUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ||
            (url.protocol === 'http:' &&
                (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
    } catch {
        return false;
    }
}

export function validateCommonContent(content: PublishContent): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!content.title.trim()) {
        issues.push({
            code: 'TITLE_REQUIRED',
            field: 'title',
            message: '标题不能为空'
        });
    }
    if (!content.bodyMarkdown.trim() && !content.video) {
        issues.push({
            code: 'CONTENT_REQUIRED',
            field: 'bodyMarkdown',
            message: '正文或视频至少需要一项'
        });
    }
    return issues;
}

export function validatePlatformConfiguration(
    platform: PublishingPlatform,
    settings: PlatformSettings,
    content?: PublishContent
): ValidationIssue[] {
    if (settings.connectionType === 'webhook') {
        return validateWebhookConfiguration(settings, content);
    }

    if (platform === 'wechat') {
        return requireOfficialFields(settings, [
            ['appId', 'AppID'],
            ['appSecret', 'AppSecret']
        ]);
    }

    if (platform === 'youtube') {
        return requireOfficialFields(settings, [
            ['clientId', 'Client ID'],
            ['clientSecret', 'Client Secret'],
            ['refreshToken', 'Refresh Token']
        ]);
    }

    return [{
        code: 'OFFICIAL_API_UNAVAILABLE',
        field: 'connectionType',
        message: `${PLATFORM_NAMES[platform]} 当前不提供本插件可用的草稿接口，请改用 Webhook`
    }];
}

function validateWebhookConfiguration(
    settings: PlatformSettings,
    content?: PublishContent
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!validateServiceUrl(settings.webhook.url)) {
        issues.push({
            code: 'WEBHOOK_URL_INVALID',
            field: 'webhook.url',
            message: 'Webhook URL 必须使用 HTTPS，本地服务可使用 HTTP'
        });
    }

    if (hasLocalMedia(content) && !validateServiceUrl(settings.webhook.mediaUploadUrl)) {
        issues.push({
            code: 'MEDIA_UPLOAD_URL_REQUIRED',
            field: 'webhook.mediaUploadUrl',
            message: '发布本地媒体时必须配置有效的媒体上传 URL'
        });
    }
    return issues;
}

function requireOfficialFields(
    settings: PlatformSettings,
    fields: Array<[string, string]>
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const [field, label] of fields) {
        if (!settings.official[field]?.trim()) {
            issues.push({
            code: 'OFFICIAL_FIELD_REQUIRED',
            field: `official.${field}`,
            message: `${label} 不能为空`
            });
        }
    }
    return issues;
}

function hasLocalMedia(content?: PublishContent): boolean {
    if (!content) return false;
    return content.cover?.source === 'vault' ||
        content.video?.source === 'vault' ||
        content.images.some(image => image.source === 'vault');
}
