import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTypeScript } from './helpers/import-typescript.mjs';

const entry = fileURLToPath(
    new URL('../src/wechat-images/task-extractor.ts', import.meta.url)
);

function createClient(response) {
    return {
        calls: 0,
        async completeJson() {
            this.calls += 1;
            return response;
        }
    };
}

test('uses existing prompts without calling text AI', async () => {
    const { ImageTaskExtractor } = await importTypeScript(entry);
    const client = createClient('not used');
    const extractor = new ImageTaskExtractor(client, 10);
    const source = '🎨 AI提示词：warm editorial illustration';

    const tasks = await extractor.extract(source);

    assert.equal(client.calls, 0);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 'existing-01');
});

test('parses fenced structured tasks in response order', async () => {
    const { ImageTaskExtractor } = await importTypeScript(entry);
    const client = createClient(`\`\`\`json
{
  "tasks": [
    {
      "prompt": "editorial illustration of focused writing",
      "description": "专注写作",
      "anchor": {
        "heading": "为什么要写作",
        "nearbyText": "写作帮助我们整理思考",
        "placement": "after"
      }
    },
    {
      "prompt": "minimal knowledge map",
      "anchor": {
        "nearbyText": "知识需要持续连接",
        "placement": "before"
      }
    }
  ]
}
\`\`\``);
    const extractor = new ImageTaskExtractor(client, 10);

    const tasks = await extractor.extract('# 为什么要写作\n写作帮助我们整理思考');

    assert.equal(client.calls, 1);
    assert.deepEqual(tasks.map(task => task.id), ['generated-01', 'generated-02']);
    assert.equal(tasks[0].description, '专注写作');
    assert.deepEqual(tasks[1].anchor, {
        nearbyText: '知识需要持续连接',
        placement: 'before'
    });
});

test('rejects invalid, duplicate, and excessive generated tasks', async () => {
    const { ImageTaskExtractor } = await importTypeScript(entry);
    const invalidCases = [
        { tasks: [{ prompt: '', anchor: { nearbyText: 'x', placement: 'after' } }] },
        { tasks: [{ prompt: 'x', anchor: { placement: 'after' } }] },
        { tasks: [{ prompt: 'x', anchor: { nearbyText: 'x', placement: 'inside' } }] },
        {
            tasks: [
                { prompt: 'x', anchor: { nearbyText: 'x', placement: 'after' } },
                { prompt: 'x', anchor: { nearbyText: 'x', placement: 'after' } }
            ]
        }
    ];

    for (const value of invalidCases) {
        const extractor = new ImageTaskExtractor(createClient(JSON.stringify(value)), 10);
        await assert.rejects(() => extractor.extract('正文'), /配图任务/);
    }

    const excessive = {
        tasks: Array.from({ length: 3 }, (_, index) => ({
            prompt: `prompt-${index}`,
            anchor: { nearbyText: `text-${index}`, placement: 'after' }
        }))
    };
    const extractor = new ImageTaskExtractor(createClient(JSON.stringify(excessive)), 2);
    await assert.rejects(() => extractor.extract('正文'), /最多生成 2 张/);
});

test('rejects malformed JSON and empty task arrays', async () => {
    const { ImageTaskExtractor } = await importTypeScript(entry);

    await assert.rejects(
        () => new ImageTaskExtractor(createClient('{bad json'), 10).extract('正文'),
        /JSON/
    );
    await assert.rejects(
        () => new ImageTaskExtractor(createClient('{"tasks":[]}'), 10).extract('正文'),
        /配图任务/
    );
});
