import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const version = manifest.version;
const releaseDir = path.join(root, 'release');
const zipName = `ai-workbench-v${version}.zip`;

const requiredFiles = ['main.js', 'manifest.json', 'styles.css', 'README.md'];

await mkdir(releaseDir, { recursive: true });
for (const file of requiredFiles) {
    await copyFile(path.join(root, file), path.join(releaseDir, file));
}

const zipPath = path.join(root, zipName);
const tempZipPath = path.join(root, `${zipName}.tmp.zip`);
await rm(tempZipPath, { force: true });

const command = [
    '$ErrorActionPreference = "Stop";',
    'Compress-Archive',
    '-Path',
    requiredFiles.map(file => `'${path.join(releaseDir, file).replace(/'/g, "''")}'`).join(','),
    '-DestinationPath',
    `'${tempZipPath.replace(/'/g, "''")}'`,
    '-Force'
].join(' ');

const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    stdio: 'inherit'
});

if (result.status !== 0) {
    throw new Error('Failed to create release zip with PowerShell Compress-Archive');
}

const tempZip = await stat(tempZipPath);
if (tempZip.size < 50_000) {
    await rm(tempZipPath, { force: true });
    throw new Error(`Release zip looks incomplete (${tempZip.size} bytes)`);
}

await rm(zipPath, { force: true });
await rename(tempZipPath, zipPath);
const zip = await stat(zipPath);
await writeFile(
    path.join(releaseDir, 'README.md'),
    `${await readFile(path.join(releaseDir, 'README.md'), 'utf8')}\n\n---\n\nPackaged as ${zipName} (${zip.size} bytes).\n`,
    'utf8'
);

console.log(`Created ${zipName} (${zip.size} bytes)`);
