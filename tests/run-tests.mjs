import { build } from 'esbuild';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const outdir = path.join(tmpdir(), 'ai-workbench-tests');
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const entries = (await readdir('tests'))
    .filter(name => name.endsWith('.test.ts'))
    .map(name => path.join('tests', name));
const sourceTests = (await readdir('tests'))
    .filter(name => name.endsWith('.test.mjs'))
    .map(name => path.join('tests', name));

await build({
    entryPoints: entries,
    outdir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external'
});

const testFiles = (await readdir(outdir))
    .filter(name => name.endsWith('.js'))
    .map(name => path.join(outdir, name));

const result = spawnSync(
    process.execPath,
    ['--test', ...testFiles, ...sourceTests],
    { stdio: 'inherit' }
);
process.exit(result.status ?? 1);
