/**
 * AI Service - Handles API calls
 */

import { ApiSettings, AIResponse } from '../types';
import { IAIService } from '../interfaces';
import {
    DEFAULT_TEMPERATURE,
    DEFAULT_MAX_TOKENS,
    MAX_RETRY_ATTEMPTS,
    RETRY_DELAY_BASE_MS,
    MAX_RETRY_DELAY_MS,
    DEFAULT_SYSTEM_PROMPT
} from '../constants';

export class AIService implements IAIService {
    private settings: ApiSettings;

    constructor(settings: ApiSettings) {
        this.settings = settings;
    }

    updateSettings(settings: ApiSettings) {
        this.settings = settings;
    }

    async chat(prompt: string, content: string): Promise<AIResponse> {
        // Validate API key
        if (!this.settings.apiKey) {
            return {
                success: false,
                error: 'API Key 未配置，请在设置中填写'
            };
        }

        // Validate endpoint
        if (!this.settings.endpoint) {
            return {
                success: false,
                error: 'API 端点未配置'
            };
        }

        // Validate endpoint format
        if (!this.validateEndpoint(this.settings.endpoint)) {
            return {
                success: false,
                error: 'API 端点格式不正确，必须是有效的 HTTPS URL（本地测试可使用 HTTP）'
            };
        }

        // Validate model name
        if (!this.validateModelName(this.settings.model)) {
            return {
                success: false,
                error: '模型名称格式不正确'
            };
        }

        // Try request with retry logic
        for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                const result = await this.makeRequest(prompt, content);
                return result;
            } catch (error) {
                const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS;

                // Only retry on retryable errors
                if (!isLastAttempt && this.isRetryableError(error)) {
                    const delay = Math.min(
                        RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1),
                        MAX_RETRY_DELAY_MS
                    );
                    console.log(`[AI Workbench] 重试 ${attempt}/${MAX_RETRY_ATTEMPTS}，等待 ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Return error for non-retryable errors or last attempt
                if (error instanceof Error) {
                    return { success: false, error: error.message };
                }
                return { success: false, error: '未知错误' };
            }
        }

        return { success: false, error: '请求失败' };
    }

    async completeJson(prompt: string, content: string): Promise<string> {
        const response = await this.chat(prompt, content);
        if (!response.success || !response.content) {
            throw new Error(response.error || '文本 AI 未返回任务');
        }
        return response.content;
    }

    /**
     * Make the actual API request
     */
    private async makeRequest(prompt: string, content: string): Promise<AIResponse> {
        const endpoint = this.settings.endpoint.replace(/\/$/, '');
        const url = `${endpoint}/chat/completions`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.apiKey}`,
            ...this.settings.headers
        };

        const body = {
            model: this.settings.model,
            messages: [
                {
                    role: 'system',
                    content: DEFAULT_SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: `${prompt}\n\n---\n\n以下是笔记内容：\n\n${content}`
                }
            ],
            temperature: DEFAULT_TEMPERATURE,
            max_tokens: DEFAULT_MAX_TOKENS
        };

        console.log('[AI Workbench] Requesting:', url);
        console.log('[AI Workbench] Model:', this.settings.model);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout * 1000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('[AI Workbench] Response status:', response.status);

            if (!response.ok) {
                let errorMsg = `请求失败: ${response.status}`;
                try {
                    const errorData = await response.json();
                    console.error('[AI Workbench] Error response:', errorData);
                    errorMsg = errorData.error?.message || errorData.message || errorMsg;
                } catch {
                    const errorText = await response.text();
                    console.error('[AI Workbench] Error text:', errorText);
                }

                // Provide user-friendly error messages
                errorMsg = this.getFriendlyErrorMessage(response.status, errorMsg);

                // Create error object with status code for retry logic
                const error: any = new Error(errorMsg);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            console.log('[AI Workbench] Response data:', JSON.stringify(data).substring(0, 500));

            // Check for different response formats
            let resultContent = '';

            // OpenAI format
            if (data.choices && data.choices[0]) {
                resultContent = data.choices[0].message?.content || data.choices[0].text || '';
            }
            // Claude format (if using Claude API)
            else if (data.content && data.content[0]) {
                resultContent = data.content[0].text || '';
            }

            if (!resultContent) {
                console.error('[AI Workbench] Empty response:', data);
                return {
                    success: false,
                    error: 'API 返回空内容，请检查模型名称是否正确'
                };
            }

            return {
                success: true,
                content: resultContent,
                tokensUsed: {
                    prompt: data.usage?.prompt_tokens || 0,
                    completion: data.usage?.completion_tokens || 0,
                    total: data.usage?.total_tokens || 0
                }
            };
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    const timeoutError: any = new Error('请求超时，请检查网络或增加超时时间');
                    timeoutError.isTimeout = true;
                    throw timeoutError;
                }
            }
            throw error;
        }
    }

    /**
     * Check if an error is retryable
     */
    private isRetryableError(error: any): boolean {
        // Timeout errors
        if (error.isTimeout) return true;

        // Network errors (TypeError from fetch)
        if (error instanceof TypeError) return true;

        // 5xx server errors
        if (error.status >= 500 && error.status < 600) return true;

        // 429 rate limit
        if (error.status === 429) return true;

        return false;
    }

    /**
     * Validate API endpoint URL
     */
    private validateEndpoint(endpoint: string): boolean {
        try {
            const url = new URL(endpoint);
            // Only allow HTTPS (production) or HTTP (localhost)
            return url.protocol === 'https:' ||
                   (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
        } catch {
            return false;
        }
    }

    /**
     * Validate model name format
     */
    private validateModelName(model: string): boolean {
        if (!model || model.trim().length === 0) {
            return false;
        }
        // Model names should contain only alphanumeric, hyphens, dots, slashes
        return /^[a-zA-Z0-9\-\.\/]+$/.test(model);
    }

    /**
     * Get user-friendly error message based on HTTP status code
     */
    private getFriendlyErrorMessage(status: number, originalMessage: string): string {
        const errorMap: Record<number, string> = {
            400: '请求参数错误，请检查模型名称和配置',
            401: 'API密钥无效或已过期，请检查设置',
            403: '无权访问该API，请检查权限设置',
            404: 'API端点不存在，请检查URL设置',
            429: '请求过于频繁，请稍后再试',
            500: 'API服务器错误，请稍后再试',
            502: 'API网关错误，请稍后再试',
            503: 'API服务不可用，请稍后再试',
            504: 'API网关超时，请稍后再试'
        };

        return errorMap[status] || originalMessage;
    }
}
