import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const obsidianContentSource = await readFile(
    new URL('../src/publishing/obsidian-content.ts', import.meta.url),
    'utf8'
);
const interfacesSource = await readFile(
    new URL('../src/interfaces.ts', import.meta.url),
    'utf8'
);

test('Obsidian content extractor reads note metadata and binary media', () => {
    assert.match(obsidianContentSource, /metadataCache\.getFileCache/);
    assert.match(obsidianContentSource, /vault\.read/);
    assert.match(obsidianContentSource, /vault\.readBinary/);
    assert.match(obsidianContentSource, /getFirstLinkpathDest/);
});

test('Obsidian content extractor exposes a narrow service interface', () => {
    assert.match(interfacesSource, /interface IObsidianContentExtractor/);
    assert.match(interfacesSource, /Promise<import\('\.\/publishing\/types'\)\.PublishContent>/);
});
