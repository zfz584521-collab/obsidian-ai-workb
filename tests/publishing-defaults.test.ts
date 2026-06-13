import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PUBLISHING_SETTINGS, mergePublishingSettings } from '../src/publishing/defaults';

test('publishing defaults contain all supported platforms disabled', () => {
    assert.deepEqual(Object.keys(DEFAULT_PUBLISHING_SETTINGS.platforms), [
        'wechat',
        'xiaohongshu',
        'wechatChannels',
        'douyin',
        'x',
        'youtube'
    ]);
    for (const settings of Object.values(DEFAULT_PUBLISHING_SETTINGS.platforms)) {
        assert.equal(settings.enabled, false);
        assert.equal(settings.connectionType, 'webhook');
    }
});

test('mergePublishingSettings preserves nested defaults for old data', () => {
    const merged = mergePublishingSettings({
        defaultPlatforms: ['wechat'],
        platforms: {
            wechat: {
                enabled: true,
                connectionType: 'official',
                official: { appId: 'wx-id' }
            }
        }
    });

    assert.deepEqual(merged.defaultPlatforms, ['wechat']);
    assert.equal(merged.platforms.wechat.enabled, true);
    assert.equal(merged.platforms.wechat.official.appId, 'wx-id');
    assert.equal(merged.platforms.wechat.webhook.authType, 'none');
    assert.equal(merged.platforms.wechat.webhook.mediaUploadUrl, '');
    assert.equal(merged.platforms.youtube.enabled, false);
});
