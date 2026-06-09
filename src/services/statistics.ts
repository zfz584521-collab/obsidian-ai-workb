/**
 * Statistics Service - Track usage and tokens
 */

import { App, Plugin, TFile } from 'obsidian';

export interface UsageStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokensUsed: number;
    promptTokens: number;
    completionTokens: number;
    actionsCount: Record<string, number>;
    lastReset: number;
}

export interface DailyStats {
    date: string;
    requests: number;
    tokens: number;
}

export class StatisticsService {
    private app: App;
    private plugin: Plugin;
    private statsPath: string = '.obsidian/plugins/ai-workbench/stats.json';
    private stats: UsageStats;

    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
        this.stats = this.getDefaultStats();
    }

    private getDefaultStats(): UsageStats {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokensUsed: 0,
            promptTokens: 0,
            completionTokens: 0,
            actionsCount: {},
            lastReset: Date.now()
        };
    }

    /**
     * Load statistics from file
     */
    async load(): Promise<void> {
        try {
            const adapter = this.app.vault.adapter;
            if (await adapter.exists(this.statsPath)) {
                const content = await adapter.read(this.statsPath);
                this.stats = JSON.parse(content);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
            this.stats = this.getDefaultStats();
        }
    }

    /**
     * Save statistics to file
     */
    async save(): Promise<void> {
        try {
            const adapter = this.app.vault.adapter;
            await adapter.write(this.statsPath, JSON.stringify(this.stats, null, 2));
        } catch (error) {
            console.error('Failed to save stats:', error);
        }
    }

    /**
     * Record a successful request
     */
    async recordSuccess(action: string, tokens?: { prompt: number; completion: number; total: number }): Promise<void> {
        this.stats.totalRequests++;
        this.stats.successfulRequests++;

        if (tokens) {
            this.stats.totalTokensUsed += tokens.total;
            this.stats.promptTokens += tokens.prompt;
            this.stats.completionTokens += tokens.completion;
        }

        this.stats.actionsCount[action] = (this.stats.actionsCount[action] || 0) + 1;

        await this.save();
    }

    /**
     * Record a failed request
     */
    async recordFailure(): Promise<void> {
        this.stats.totalRequests++;
        this.stats.failedRequests++;
        await this.save();
    }

    /**
     * Get current statistics
     */
    getStats(): UsageStats {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    async reset(): Promise<void> {
        this.stats = this.getDefaultStats();
        await this.save();
    }

    /**
     * Get usage summary for display
     */
    getSummary(): {
        totalRequests: number;
        successRate: string;
        totalTokens: string;
        topActions: { action: string; count: number }[];
    } {
        const successRate = this.stats.totalRequests > 0
            ? Math.round((this.stats.successfulRequests / this.stats.totalRequests) * 100) + '%'
            : '0%';

        const totalTokens = this.formatTokens(this.stats.totalTokensUsed);

        const topActions = Object.entries(this.stats.actionsCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([action, count]) => ({ action, count }));

        return {
            totalRequests: this.stats.totalRequests,
            successRate,
            totalTokens,
            topActions
        };
    }

    /**
     * Format token count
     */
    private formatTokens(count: number): string {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
    }

    /**
     * Get estimated cost (approximate)
     */
    getEstimatedCost(pricePerMillion: number = 0.15): string {
        // Default price: $0.15 per million tokens (approximate GPT-4o-mini price)
        const cost = (this.stats.totalTokensUsed / 1000000) * pricePerMillion;
        return '$' + cost.toFixed(4);
    }
}
