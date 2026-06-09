/**
 * AI Workbench - Constants
 *
 * This file contains all magic numbers and configuration constants
 * to improve code maintainability and readability.
 */

// ============ AI Service Constants ============

/**
 * Default temperature for AI generation (0.0 - 2.0)
 * Higher values = more creative, lower values = more focused
 */
export const DEFAULT_TEMPERATURE = 0.7;

/**
 * Maximum tokens for AI completion
 * Higher values allow longer responses but cost more
 */
export const DEFAULT_MAX_TOKENS = 4096;

/**
 * Maximum number of retry attempts for API requests
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay in milliseconds between retries
 * Uses exponential backoff: 1s, 2s, 4s
 */
export const RETRY_DELAY_BASE_MS = 1000;

/**
 * Maximum retry delay in milliseconds
 */
export const MAX_RETRY_DELAY_MS = 10000;

// ============ History Constants ============

/**
 * Maximum number of history entries to keep in memory
 */
export const MAX_HISTORY_ENTRIES = 20;

// ============ Backup Constants ============

/**
 * Maximum attempts when creating a new file with conflict resolution
 */
export const MAX_FILENAME_CONFLICT_ATTEMPTS = 100;

/**
 * Default maximum number of backups per file
 */
export const DEFAULT_MAX_BACKUPS = 10;

// ============ UI Constants ============

/**
 * Debounce delay in milliseconds for settings input
 */
export const SETTINGS_DEBOUNCE_MS = 500;

/**
 * Minimum API key length for validation
 */
export const MIN_API_KEY_LENGTH = 20;

/**
 * Minimum characters to show in masked API key
 */
export const API_KEY_MASK_LENGTH = 4;

// ============ Selection Constants ============

/**
 * Maximum allowed character offset for selection position shift
 * If the position shifts more than this, the operation is cancelled
 */
export const MAX_SELECTION_OFFSET = 10;

// ============ Default Prompt ============

/**
 * Default system prompt for AI assistant
 */
export const DEFAULT_SYSTEM_PROMPT = '你是一个专业的笔记助手，帮助用户处理和优化他们的笔记内容。';

// ============ File Extensions ============

/**
 * Default file extension for markdown files
 */
export const MARKDOWN_EXTENSION = '.md';

// ============ Token Estimation ============

/**
 * Average characters per token (rough estimate for Chinese text)
 */
export const CHARS_PER_TOKEN_ZH = 2;

/**
 * Average characters per token (rough estimate for English text)
 */
export const CHARS_PER_TOKEN_EN = 4;
