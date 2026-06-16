/**
 * i18n Type Definitions
 * Provides type safety for all translation keys
 */

export interface CommonTranslations {
  cancel: string;
  save: string;
  delete: string;
  edit: string;
  confirm: string;
  success: string;
  error: string;
  loading: string;
  processing: string;
  noData: string;
  unknown: string;
  close: string;
  create: string;
  import: string;
  export: string;
  configure: string;
  testConnection: string;
  enable: string;
  disable: string;
  required: string;
  optional: string;
}

export interface SettingsTranslations {
  // Language
  language: string;
  languageDesc: string;
  languageAuto: string;
  languageZhCN: string;
  languageEn: string;

  // API Configuration
  apiConfig: string;
  apiEndpoint: string;
  apiEndpointDesc: string;
  apiKey: string;
  apiKeyDesc: string;
  model: string;
  modelDesc: string;
  timeout: string;
  timeoutDesc: string;

  // Image Generation
  imageGeneration: string;
  imageProvider: string;
  imageProviderDesc: string;
  imageApiEndpoint: string;
  imageApiEndpointDesc: string;
  imageApiKey: string;
  imageApiKeyDesc: string;
  imageModel: string;
  imageSize: string;
  imageSizeDesc: string;
  imageTimeout: string;
  imageTimeoutDesc: string;
  retryCount: string;
  concurrency: string;
  maxImages: string;
  previewPrompt: string;
  keepOriginalPrompts: string;
  keepOriginalPromptsDesc: string;
  seconds: string;

  // Output Settings
  outputSettings: string;
  summaryPosition: string;
  summaryPositionDesc: string;
  summaryPositionAppend: string;
  summaryPositionPrepend: string;
  summaryPositionNewFile: string;
  outputLanguage: string;
  outputLanguageDesc: string;
  outputLanguageAuto: string;
  outputLanguageZh: string;
  outputLanguageEn: string;
  addTimestamp: string;
  addTimestampDesc: string;

  // Backup Settings
  backupSettings: string;
  enableBackup: string;
  enableBackupDesc: string;
  maxBackupCount: string;
  maxBackupCountDesc: string;

  // Claudian Integration
  claudianIntegration: string;
  showClaudianButton: string;
  showClaudianButtonDesc: string;

  // Custom Prompts
  customPrompts: string;
  addNewPrompt: string;
  addNewPromptDesc: string;
  importPreset: string;
  importExport: string;
  exportPrompts: string;
  importPrompts: string;
  noPrompts: string;
  promptName: string;
  promptNameDesc: string;
  promptDescription: string;
  promptDescriptionDesc: string;
  promptTemplate: string;
  promptTemplateDesc: string;
  outputMode: string;
  outputModeAppend: string;
  outputModePrepend: string;
  outputModeNewFile: string;
  outputModeReplace: string;
  outputModeSelection: string;
  editPrompt: string;
  newPrompt: string;

  // Shortcuts
  shortcuts: string;
  enableShortcuts: string;
  addShortcut: string;
  noShortcuts: string;
  action: string;
  key: string;
  keyDesc: string;
  modifiers: string;
  modifiersDesc: string;
  newShortcut: string;

  // Context Menu
  contextMenu: string;
  enableContextMenu: string;
  enableContextMenuDesc: string;
  showBuiltInActions: string;
  showBuiltInActionsDesc: string;
  showCustomPrompts: string;
  showCustomPromptsDesc: string;

  // Publishing Platforms
  publishingPlatforms: string;
  platformCredentials: string;
  requestTimeout: string;
  requestTimeoutDesc: string;
  enablePlatform: string;
  connectionType: string;
  officialApi: string;
  webhook: string;
  platformConfigured: string;
  platformNotConfigured: string;
  officialApiConfigured: string;
  officialApiPending: string;
  webhookConfigured: string;
  webhookPending: string;
  platformDisabled: string;
  useWebhook: string;
  defaultAuthor: string;
  platformSettings: string;
  defaultSelected: string;
  defaultSelectedDesc: string;
  webhookUrl: string;
  webhookUrlDesc: string;
  mediaUploadUrl: string;
  mediaUploadUrlDesc: string;
  authType: string;
  authTypeNone: string;
  authTypeBearer: string;
  authTypeHeaders: string;
  bearerToken: string;
  customHeadersJson: string;
  customHeadersDesc: string;
  signingSecret: string;
  signingSecretDesc: string;
  appId: string;
  appSecret: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelId: string;
  noOfficialApi: string;

  // UI Settings
  uiSettings: string;
  showStatusBar: string;
  showStatusBarDesc: string;
  confirmBeforeReplace: string;
  confirmBeforeReplaceDesc: string;
  showTokenCount: string;

  // Backup Management
  backupManagement: string;
  manageBackups: string;
  manageBackupsDesc: string;
  clearAllBackups: string;
  clearConfirm: string;
}

export interface ValidationTranslations {
  apiEndpointInvalid: string;
  apiKeyInvalid: string;
  apiEndpointRequired: string;
  modelNameInvalid: string;
  httpsRequired: string;
  nameRequired: string;
  promptRequired: string;
  jsonInvalid: string;
  keyRequired: string;
  jsonDataRequired: string;
}

export interface ActionTranslations {
  summarize: string;
  outline: string;
  translate: string;
  format: string;
  mindmap: string;
  mermaid: string;
  wechatInsertImages: string;
  custom: string;
  aiSummary: string;
  aiOutline: string;
  aiTranslate: string;
  aiFormat: string;
  aiMindmap: string;
  aiMermaid: string;
  aiProcessing: string;
  selectedText: string;
  aiWorkbench: string;
}

export interface NoticeTranslations {
  copiedToClipboard: string;
  importSuccess: string;
  importFailed: string;
  exportSuccess: string;
  operationFailed: string;
  backupCleared: string;
  connectionTestSuccess: string;
  connectionTestFailed: string;
  requestTimeout: string;
  apiError: string;
  networkError: string;
  processing: string;
  success: string;
  failed: string;
  partialSuccess: string;
  mediaLoadFailed: string;
  selectionChanged: string;
  originalNotFound: string;
  allSuccess: string;
  partialFailed: string;
  allFailed: string;
}

export interface PlatformTranslations {
  wechat: string;
  xiaohongshu: string;
  wechatChannels: string;
  douyin: string;
  x: string;
  youtube: string;
}

export interface PublishingTranslations {
  publishToDraft: string;
  selectedPlatforms: string;
  unifiedContent: string;
  platformSettings: string;
  title: string;
  body: string;
  summary: string;
  tags: string;
  tagsDesc: string;
  platformTitle: string;
  platformBody: string;
  platformSummary: string;
  platformTags: string;
  platformMedia: string;
  inherited: string;
  overridden: string;
  coverAndMedia: string;
  noMedia: string;
  cover: string;
  setAsCover: string;
  remove: string;
  video: string;
  addImage: string;
  selectVideo: string;
  publishProgress: string;
  publishResults: string;
  submitting: string;
  publishDrafts: string;
  retryFailed: string;
  draftId: string;
  openManagement: string;
  nativeDraft: string;
  privateUpload: string;
  webhookDraft: string;
  selectImage: string;
  selectImagePlaceholder: string;
  selectVideoPlaceholder: string;
  unknownError: string;
}

export interface PreviewTranslations {
  original: string;
  aiResult: string;
  compare: string;
  modified: string;
}

export interface BackupTranslations {
  restoreBackup: string;
  deleteBackup: string;
  backupInfo: string;
  originalFile: string;
  createdTime: string;
  fileSize: string;
  confirmRestore: string;
  confirmDelete: string;
  noBackups: string;
}

export interface ErrorTranslations {
  unknownError: string;
  apiNotConfigured: string;
  apiEndpointNotConfigured: string;
  apiProcessingFailed: string;
  targetNoteNotFound: string;
  editorNotAvailable: string;
  originalNoteMoved: string;
  selectionContentChanged: string;
  positionShifted: string;
}

export interface Translations {
  common: CommonTranslations;
  settings: SettingsTranslations;
  validation: ValidationTranslations;
  actions: ActionTranslations;
  notices: NoticeTranslations;
  platforms: PlatformTranslations;
  publishing: PublishingTranslations;
  preview: PreviewTranslations;
  backup: BackupTranslations;
  errors: ErrorTranslations;
}

export type SupportedLanguage = 'zh-CN' | 'en';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}
