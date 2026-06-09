/**
 * AI Service - Handles API calls
 */

import { ApiSettings, AIResponse } from '../types';

export class AIService {
    private settings: ApiSettings;

    constructor(settings: ApiSettings) {
        this.settings = settings;
    }

    updateSettings(settings: ApiSettings) {
        this.settings = settings;
    }

    async chat(prompt: string, content: string): Promise<AIResponse> {
        if (!this.settings.apiKey) {
            return {
                success: false,
                error: 'API Key 未配置，请在设置中填写'
            };
        }

        if (!this.settings.endpoint) {
            return {
                success: false,
                error: 'API 端点未配置'
            };
        }

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
                    content: '你是一个专业的笔记助手，帮助用户处理和优化他们的笔记内容。'
                },
                {
                    role: 'user',
                    content: `${prompt}\n\n---\n\n以下是笔记内容：\n\n${content}`
                }
            ],
            temperature: 0.7,
            max_tokens: 4096
        };

        console.log('[AI Workbench] Requesting:', url);
        console.log('[AI Workbench] Model:', this.settings.model);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout * 1000);

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
                return {
                    success: false,
                    error: errorMsg
                };
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
            console.error('[AI Workbench] Request error:', error);
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    return { success: false, error: '请求超时，请检查网络或增加超时时间' };
                }
                return { success: false, error: `请求错误: ${error.message}` };
            }
            return { success: false, error: '未知错误' };
        }
    }
}
