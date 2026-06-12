import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('sidebar renders stable category classes and action counts', () => {
    assert.match(
        mainSource,
        /ai-workbench-category--\$\{categoryClass\}/,
        'category containers should include a stable modifier class'
    );
    assert.match(
        mainSource,
        /cls:\s*['"]category-count['"]/,
        'category headers should render an action count'
    );
    assert.match(
        mainSource,
        /text:\s*String\(prompts\.length\s*\+/,
        'the count should reflect the prompts in the category'
    );
});

test('category cards use restrained accents and neutral action buttons', () => {
    assert.match(
        styles,
        /\.ai-workbench-category::before/,
        'category cards should render a narrow accent bar'
    );
    assert.match(
        styles,
        /\.ai-workbench-category--basic\s*\{/,
        'the basic category should define an accent'
    );
    assert.match(
        styles,
        /\.ai-workbench-category--xiaohongshu\s*\{/,
        'the Xiaohongshu category should define an accent'
    );
    assert.match(
        styles,
        /\.ai-workbench-category-header\s+\.category-count/,
        'the action count should have a dedicated style'
    );
    assert.match(
        styles,
        /\.ai-workbench-category\s+\.ai-workbench-buttons/,
        'category grids should be scoped for compact card spacing'
    );
    assert.match(
        styles,
        /\.ai-workbench-action-btn\.custom\s*\{[^}]*border-style:\s*solid/s,
        'custom action buttons should use a neutral solid border'
    );
});
