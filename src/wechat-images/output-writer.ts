import { TaskGenerationResult } from './types';

export interface IllustratedOutputPaths {
    articlePath: string;
    assetDirPath: string;
    baseName: string;
}

export interface ImageOutputVault {
    exists(path: string): Promise<boolean>;
    createFolder(path: string): Promise<void>;
    writeBinary(path: string, data: ArrayBuffer): Promise<void>;
    createMarkdown(path: string, content: string): Promise<unknown>;
}

export class OutputWriteError extends Error {
    constructor(
        message: string,
        public readonly assetDirPath: string
    ) {
        super(message);
        this.name = 'OutputWriteError';
    }
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
}

function joinPath(parent: string, child: string): string {
    return parent ? `${parent}/${child}` : child;
}

export async function resolveIllustratedOutputPaths(
    originalPath: string,
    exists: (path: string) => Promise<boolean>,
    maxAttempts: number = 100
): Promise<IllustratedOutputPaths> {
    const normalized = normalizePath(originalPath);
    const slash = normalized.lastIndexOf('/');
    const parent = slash >= 0 ? normalized.slice(0, slash) : '';
    const filename = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    const originalBase = filename.replace(/\.md$/i, '');

    for (let counter = 0; counter <= maxAttempts; counter++) {
        const suffix = counter === 0 ? '' : `-${counter}`;
        const baseName = `${originalBase}-已配图${suffix}`;
        const articlePath = joinPath(parent, `${baseName}.md`);
        const assetDirPath = joinPath(parent, `${baseName}-assets`);
        if (!await exists(articlePath) && !await exists(assetDirPath)) {
            return { articlePath, assetDirPath, baseName };
        }
    }

    throw new Error('无法创建配图文章：文件名冲突过多');
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}

export class ImageOutputWriter {
    constructor(private vault: ImageOutputVault) {}

    resolve(originalPath: string): Promise<IllustratedOutputPaths> {
        return resolveIllustratedOutputPaths(
            originalPath,
            path => this.vault.exists(path)
        );
    }

    async saveImages(
        output: IllustratedOutputPaths,
        results: TaskGenerationResult[]
    ): Promise<TaskGenerationResult[]> {
        let directoryCreated = false;
        const saved: TaskGenerationResult[] = [];

        for (let index = 0; index < results.length; index++) {
            const result = results[index];
            if (!result.image) {
                saved.push({ ...result });
                continue;
            }

            try {
                if (!directoryCreated) {
                    await this.vault.createFolder(output.assetDirPath);
                    directoryCreated = true;
                }
                const filename = `image-${String(index + 1).padStart(2, '0')}.${result.image.extension}`;
                const assetPath = joinPath(output.assetDirPath, filename);
                await this.vault.writeBinary(
                    assetPath,
                    exactArrayBuffer(result.image.bytes)
                );
                saved.push({ ...result, assetPath });
            } catch (error) {
                saved.push({
                    task: result.task,
                    error: error instanceof Error ? error.message : '图片保存失败'
                });
            }
        }

        return saved;
    }

    async createArticle(
        output: IllustratedOutputPaths,
        content: string
    ): Promise<unknown> {
        try {
            return await this.vault.createMarkdown(output.articlePath, content);
        } catch {
            throw new OutputWriteError(
                `新文章创建失败，已生成图片保留在 ${output.assetDirPath}`,
                output.assetDirPath
            );
        }
    }
}
