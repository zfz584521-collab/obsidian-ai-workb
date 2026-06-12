import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function importTypeScript(entryPoint) {
    const outdir = await mkdtemp(join(tmpdir(), 'ai-workbench-test-'));
    const outfile = join(outdir, 'module.mjs');
    try {
        await build({
            entryPoints: [entryPoint],
            outfile,
            bundle: true,
            platform: 'node',
            format: 'esm',
            target: 'node20',
            external: ['obsidian']
        });
        return await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
    } finally {
        await rm(outdir, { recursive: true, force: true });
    }
}
