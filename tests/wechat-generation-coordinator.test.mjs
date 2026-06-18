import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/generation-coordinator.ts', import.meta.url)
);
const image = {
    bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    extension: 'png',
    mimeType: 'image/png'
};
const tasks = Array.from({ length: 4 }, (_, index) => ({
    id: `generated-0${index + 1}`,
    prompt: `prompt-${index + 1}`,
    anchor: { nearbyText: `text-${index + 1}`, placement: 'after' }
}));

test('limits concurrency, preserves order, and reports final progress', async () => {
    const { ImageGenerationCoordinator } = await importTypeScript(entry);
    let active = 0;
    let maximum = 0;
    const provider = {
        async generate(request) {
            active += 1;
            maximum = Math.max(maximum, active);
            const delay = request.prompt.endsWith('1') ? 30 : 5;
            await new Promise(resolve => setTimeout(resolve, delay));
            active -= 1;
            return image;
        }
    };
    const progress = [];
    const coordinator = new ImageGenerationCoordinator(provider, 2, 0);

    const results = await coordinator.generateAll(
        tasks,
        '1536x1024',
        (completed, total) => progress.push([completed, total])
    );

    assert.equal(maximum, 2);
    assert.deepEqual(results.map(result => result.task.id), tasks.map(task => task.id));
    assert.deepEqual(progress, [[1, 4], [2, 4], [3, 4], [4, 4]]);
});

test('retries retryable errors and attempts final errors once', async () => {
    const { ImageGenerationCoordinator, ImageProviderError } =
        await importTypeScript(entry);
    const attempts = new Map();
    const provider = {
        async generate(request) {
            const count = (attempts.get(request.prompt) || 0) + 1;
            attempts.set(request.prompt, count);
            if (request.prompt === 'retry' && count < 3) {
                throw new ImageProviderError('temporary', true);
            }
            if (request.prompt === 'final') {
                throw new ImageProviderError('invalid', false);
            }
            return image;
        }
    };
    const coordinator = new ImageGenerationCoordinator(provider, 1, 2);
    const input = [
        { ...tasks[0], prompt: 'retry' },
        { ...tasks[1], prompt: 'final' },
        { ...tasks[2], prompt: 'success' }
    ];

    const results = await coordinator.generateAll(input, 'size', () => {});

    assert.equal(attempts.get('retry'), 3);
    assert.equal(attempts.get('final'), 1);
    assert.equal(attempts.get('success'), 1);
    assert.ok(results[0].image);
    assert.match(results[1].error, /invalid/);
    assert.ok(results[2].image);
});

test('waits between retryable image generation attempts', async () => {
    const { ImageGenerationCoordinator, ImageProviderError } =
        await importTypeScript(entry);
    let attempts = 0;
    const delays = [];
    const provider = {
        async generate() {
            attempts += 1;
            if (attempts < 3) {
                throw new ImageProviderError('rate limited', true, 429);
            }
            return image;
        }
    };
    const coordinator = new ImageGenerationCoordinator(
        provider,
        1,
        2,
        async ms => delays.push(ms)
    );

    const [result] = await coordinator.generateAll([tasks[0]], 'size', () => {});

    assert.ok(result.image);
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [1000, 2000]);
});

test('clamps concurrency and sanitizes provider errors', async () => {
    const { ImageGenerationCoordinator, ImageProviderError } =
        await importTypeScript(entry);
    const provider = {
        async generate() {
            throw new ImageProviderError('Bearer sk-secret\nfull response', false);
        }
    };
    const coordinator = new ImageGenerationCoordinator(provider, 99, 0);

    const [result] = await coordinator.generateAll([tasks[0]], 'size', () => {});

    assert.doesNotMatch(result.error, /sk-secret|full response/);
});
