# 多平台草稿发布功能设计

## 目标

在 AI 工作台中增加跨平台草稿发布能力。用户可从当前笔记载入内容，选择微信公众号、小红书、视频号、抖音、X 和 YouTube，发布前统一编辑标题、正文、封面、图片或视频，并一次提交到多个平台的草稿目标。

平台接入优先使用官方 API；当平台没有合适的官方草稿接口、用户没有对应资质或浏览器环境无法可靠直连时，允许改用用户配置的 Webhook/中转服务。

## 已确认决策

- 工作台采用“多平台勾选 + 一次提交”，同时保留单个平台快速选择能力。
- 每次发布前打开编辑弹窗，不直接使用原笔记静默提交。
- 发布弹窗支持标题、正文、封面、图片和视频。
- 采用“统一发布服务 + 平台适配器”架构。
- 每个平台可独立选择官方 API 或 Webhook。
- 多平台并行发布，单个平台失败不影响其他平台。
- 首版只创建草稿或等价的非公开内容，不自动公开发布。

## 平台目标语义

“发布到草稿箱”是产品层的统一表达，适配器按平台能力映射：

| 平台 | 首选目标 | 兜底目标 |
| --- | --- | --- |
| 微信公众号 | 官方草稿箱 | Webhook 草稿 |
| 小红书 | 官方开放能力可用时创建非公开内容 | Webhook 草稿 |
| 视频号 | 官方开放能力可用时创建非公开内容 | Webhook 草稿 |
| 抖音 | 官方开放能力可用时创建非公开内容 | Webhook 草稿 |
| X | Webhook 草稿 | 本功能不直接公开发帖 |
| YouTube | 私密视频上传或官方非公开状态 | Webhook 草稿 |

适配器必须返回实际采用的目标语义，例如 `native-draft`、`private-upload` 或 `webhook-draft`，界面不得把私密上传错误显示为平台原生草稿。

## 用户流程

1. 用户在 Obsidian 中打开一篇 Markdown 笔记。
2. AI 工作台显示“发布到草稿箱”区域和六个平台选项。
3. 用户勾选一个或多个已启用且已配置的平台。
4. 用户点击“编辑并发布”，打开发布弹窗。
5. 弹窗从当前笔记提取标题、正文、内嵌图片、封面候选和视频链接。
6. 用户编辑统一内容，并可切换平台标签覆盖平台专属字段。
7. 系统先做通用校验，再调用各平台适配器做平台级校验。
8. 校验通过的平台并行提交；校验失败的平台留在结果列表中，不阻塞其他平台。
9. 结果弹窗逐平台显示成功状态、草稿 ID、管理链接、目标语义或结构化错误。
10. 用户可只重试失败平台；重试沿用同一发布任务的幂等键。

## 工作台界面

在当前快捷操作和自定义操作之后、最近操作之前增加发布区域：

- 标题：“发布到草稿箱”。
- 六个平台使用稳定尺寸的复选项网格。
- 未启用或未配置的平台保持可见，但显示不可用状态和“前往设置”入口。
- 显示已选平台数量。
- 主按钮：“编辑并发布 N 个草稿”。
- 次按钮：“仅打开编辑器”，用于先准备内容而不立即提交。

平台选择保存在视图会话中，不写入笔记。设置中可保存默认选中的平台集合。

## 发布前编辑弹窗

弹窗分为统一内容和平台覆盖两层。

### 统一内容

- 标题
- 正文
- 封面
- 图片列表
- 视频文件或视频链接
- 摘要/描述
- 标签

### 平台覆盖

平台标签页默认继承统一内容。用户修改某平台字段后，仅该字段成为覆盖值，其他字段继续继承统一内容。界面应明确标识“继承”与“已覆盖”。

每个平台标签页显示：

- 实际发布目标语义
- 当前接入方式
- 字数和媒体限制
- 必填字段
- 校验错误

弹窗关闭前不上传媒体。用户点击提交后，服务再按平台需求处理媒体。

## 设置界面

在现有插件设置中增加“发布平台”部分。

### 平台总览

每个平台显示：

- 启用开关
- 官方 API 或 Webhook
- 配置摘要
- 最近一次连接测试状态
- 展开编辑入口

### 通用平台配置

每个平台包含：

- `enabled`
- `connectionType`: `official` 或 `webhook`
- 默认发布选项
- 平台专属内容默认值
- 是否自动上传 Obsidian 本地媒体

### 官方 API 配置

具体字段由平台适配器声明，例如 App ID、App Secret、Client ID、Client Secret、Access Token、Refresh Token 或频道 ID。设置页只负责按声明渲染，不在 UI 主流程中硬编码所有平台字段。

密钥字段默认掩码显示。插件数据保存方式沿用现有 `saveData`；界面文案不得宣称这些字段已加密，因为 Obsidian 插件数据默认只是本地存储。

### Webhook 配置

- Webhook URL
- 媒体上传 URL
- 认证方式：无、Bearer Token 或自定义请求头
- Token 或请求头
- 请求超时
- 可选签名密钥
- 测试连接按钮

URL 默认要求 HTTPS；仅允许 `localhost` 和 `127.0.0.1` 使用 HTTP。

## 类型与配置模型

在 `WorkbenchSettings` 中新增 `publishing`：

```ts
type PublishingPlatform =
    | 'wechat'
    | 'xiaohongshu'
    | 'wechatChannels'
    | 'douyin'
    | 'x'
    | 'youtube';

interface PublishingSettings {
    defaultPlatforms: PublishingPlatform[];
    requestTimeout: number;
    platforms: Record<PublishingPlatform, PlatformSettings>;
}

interface PlatformSettings {
    enabled: boolean;
    connectionType: 'official' | 'webhook';
    official: Record<string, string>;
    webhook: {
        url: string;
        mediaUploadUrl: string;
        authType: 'none' | 'bearer' | 'headers';
        token: string;
        headers: Record<string, string>;
        signingSecret: string;
    };
    defaults: Record<string, string | boolean | string[]>;
}
```

加载设置时对 `publishing` 及六个平台逐层合并默认值，保证旧版 `data.json` 无需手工迁移。

## 服务边界

### PublishingService

负责编排发布，不包含平台协议细节：

- 从活动笔记构建发布内容。
- 解析和规范化 Markdown。
- 选择适配器。
- 执行通用与平台校验。
- 生成发布任务 ID 和平台幂等键。
- 限制并发并汇总结果。
- 保存发布记录。
- 重试失败平台。

### ContentExtractor

输入活动 `TFile` 和 Vault 内容，输出统一内容模型：

```ts
interface PublishContent {
    sourcePath: string;
    title: string;
    bodyMarkdown: string;
    summary?: string;
    cover?: PublishMedia;
    images: PublishMedia[];
    video?: PublishMedia;
    tags: string[];
}
```

标题优先级：

1. 发布弹窗中的用户输入
2. Frontmatter `title`
3. 第一个一级标题
4. 文件名

媒体解析支持 Obsidian Wiki 嵌入、标准 Markdown 图片和 Vault 内相对路径。远程 URL 保留为远程媒体。首版一次发布最多选择一个视频。

### PlatformAdapter

所有平台适配器遵循同一接口：

```ts
interface PlatformAdapter {
    platform: PublishingPlatform;
    getCapabilities(): PlatformCapabilities;
    validate(request: PlatformPublishRequest): Promise<ValidationIssue[]>;
    testConnection(): Promise<ConnectionTestResult>;
    createDraft(request: PlatformPublishRequest): Promise<PlatformPublishResult>;
}
```

每个平台提供官方适配器和 Webhook 适配器。适配器工厂根据设置选择实现。官方实现不可用时不得自动把内容发送给 Webhook，除非用户明确把该平台设置为 Webhook。

### PublishingHistoryService

保存轻量发布记录：

- 任务 ID
- 源笔记路径
- 提交时间
- 目标平台
- 每个平台状态
- 草稿 ID
- 管理链接
- 目标语义
- 错误代码和可读错误

记录不保存正文、密钥或媒体副本。

## Webhook 契约

请求使用 `POST application/json`：

```json
{
  "version": "1",
  "taskId": "publish-task-id",
  "idempotencyKey": "task-platform-hash",
  "platform": "xiaohongshu",
  "target": "draft",
  "content": {
    "title": "标题",
    "bodyMarkdown": "正文",
    "summary": "摘要",
    "tags": ["标签"]
  },
  "media": {
    "cover": null,
    "images": [],
    "video": null
  },
  "metadata": {
    "sourcePath": "Notes/example.md"
  }
}
```

本地媒体使用 multipart 上传会显著增加中转契约复杂度。首版 Webhook 采用两阶段协议：

1. 插件先调用平台设置中的 `mediaUploadUrl` 上传二进制文件，获得中转服务媒体引用。
2. 插件调用配置的发布 Webhook，正文请求中携带媒体引用。

包含本地媒体时 `mediaUploadUrl` 必填。若中转服务声明支持远程 URL，可跳过远程媒体上传。

成功响应：

```json
{
  "success": true,
  "draftId": "draft-123",
  "managementUrl": "https://example.com/drafts/draft-123",
  "targetKind": "webhook-draft"
}
```

失败响应：

```json
{
  "success": false,
  "error": {
    "code": "MEDIA_FORMAT_UNSUPPORTED",
    "message": "视频格式不受支持",
    "retryable": false
  }
}
```

签名启用时使用 `HMAC-SHA256(signingSecret, timestamp + "." + rawBody)`。请求携带：

- `X-AI-Workbench-Timestamp`: Unix 秒时间戳
- `X-AI-Workbench-Signature`: 小写十六进制 HMAC
- `Idempotency-Key`: 平台幂等键

媒体上传和草稿创建使用相同的认证与签名规则，并由自动化测试覆盖。

## 并发、幂等与重试

- 单次任务的平台请求并行执行，但默认最多同时处理 3 个平台。
- 每个平台拥有独立状态：`pending`、`validating`、`uploading`、`creating`、`succeeded`、`failed`。
- 幂等键由任务 ID、平台和内容摘要组成。
- 自动重试只用于网络错误、超时和明确可重试的服务端错误。
- 认证失败、字段校验失败和不支持的媒体格式不自动重试。
- 自动重试最多 2 次，采用短退避。
- 用户手动重试失败平台时沿用原幂等键。

## 错误处理

错误统一转换为：

```ts
interface PublishError {
    code: string;
    message: string;
    retryable: boolean;
    field?: string;
    details?: string;
}
```

界面按平台显示错误，不只弹出一个总 Notice。全局 Notice 仅用于提示“全部成功”“部分成功”或“全部失败”。

错误消息不得输出 Access Token、Secret、自定义认证头或完整请求体。调试日志默认只记录平台、阶段、状态码和错误代码。

## 安全与隐私

- 发布前明确显示即将发送的平台。
- 不向未选中平台发送内容或媒体。
- 不把官方 API 失败自动降级到 Webhook。
- Webhook 测试使用最小探测请求，不发送当前笔记内容。
- 本地发布记录不保存正文和媒体。
- UI 不宣称插件设置已加密。
- URL 校验阻止非本地 HTTP。

## 测试策略

### 单元测试

- 旧设置与 `publishing` 默认值逐层合并。
- 标题优先级和 Markdown 媒体解析。
- 平台覆盖值与统一内容合并。
- 适配器工厂正确选择官方 API 或 Webhook。
- Webhook 请求与响应序列化。
- 平台校验错误转换。
- 幂等键稳定且平台间不同。
- 发布记录不包含正文、媒体和密钥。

### 编排测试

- 六个平台全部成功。
- 部分成功时其他平台不被取消。
- 校验失败的平台不发起网络请求。
- 可重试错误按上限重试。
- 手动重试只提交失败平台并沿用幂等键。
- 取消弹窗时不上传媒体。

### UI 结构测试

沿用现有源码结构测试方式，验证：

- 工作台包含六个平台和批量发布入口。
- 未配置平台显示不可用状态。
- 设置页包含平台总览和接入方式切换。
- 发布结果逐平台呈现。

### 手工验证

- Obsidian 深色和浅色主题。
- 窄侧栏下平台按钮不溢出。
- 长标题、长平台错误和长文件名可换行。
- 本地图片、远程图片、无媒体和单视频笔记。
- 官方 API 与 Webhook 各至少完成一个真实草稿链路。

## 实现范围

首版包含：

- 六个平台的设置模型和界面。
- 工作台多选发布入口。
- 发布前编辑弹窗。
- 内容和媒体解析。
- 统一发布编排。
- 官方 API / Webhook 适配器框架。
- 可获得稳定官方能力的平台实现。
- 统一 Webhook 实现。
- 发布结果和轻量发布记录。

首版不包含：

- 自动公开发布。
- 定时发布。
- 评论、互动和数据分析。
- 多账号管理。
- 视频转码和图片编辑。
- 云端密钥托管。
- 插件自带中转服务器。

## 验收标准

1. 用户可在设置中启用六个平台，并为每个平台选择官方 API 或 Webhook。
2. 用户可测试连接，错误不会泄露凭据。
3. 工作台可勾选多个平台并进入发布前编辑弹窗。
4. 用户可编辑统一内容并为单个平台覆盖字段。
5. 系统可解析当前笔记的标题、正文和 Vault 媒体。
6. 配置完整的平台可创建草稿或明确标识的等价非公开内容。
7. 单个平台失败不影响其他平台，且可只重试失败平台。
8. 重试不会因重复点击创建重复草稿。
9. 旧用户设置可正常加载，无需手工修改 `data.json`。
10. `npm run build` 和新增自动化测试通过。
