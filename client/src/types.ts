/**
 * AI绘图工作流 — 核心类型定义
 * 项目所有数据结构的类型基础，每个类型对应一个业务实体
 */

/**
 * 绘图模式：文生图 或 图生图
 * - `text-to-image`：纯粹靠提示词生成图像
 * - `image-to-image`：以参考图为基础进行变换
 */
export type DrawMode = "text-to-image" | "image-to-image";

/**
 * 绘图任务的生命周期状态
 * - `pending`：排队等待中
 * - `running`：正在生成
 * - `completed`：已完成（可以下载或用作参考图）
 * - `failed`：生成失败（可以重试）
 */
export type DrawJobStatus = "pending" | "running" | "completed" | "failed";

/**
 * 预设的图像尺寸选项
 * 包含固定像素尺寸（如 1024x1024）和宽高比（如 16:9）
 * `auto` 表示由 API 自动决定最佳尺寸
 */
export type PresetDrawSize =
  | "auto"
  | "1024x1024"
  | "1792x1024"
  | "1024x1792"
  | "1:1"
  | "3:2"
  | "2:3"
  | "16:9"
  | "9:16"
  | "1:2"
  | "2:1"
  | "4:3"
  | "3:4"
  | "5:4"
  | "4:5"
  | "21:9";

/**
 * 图像尺寸：可以是预设值，也可以是自定义 `宽x高` 格式
 * 例如 `"1024x768"` 表示宽 1024px、高 768px
 */
export type DrawSize = PresetDrawSize | `${number}x${number}`;

/** NANO-BANANA 支持的输出分辨率，K 必须大写 */
export type NanoImageSize = "1K" | "2K" | "4K";

/** 绘图任务实际使用的接口提供者 */
export type ImageProviderId = "duomi" | "nano-banana" | "mock";

/** API Key 所属的平台供应商 */
export type ApiProviderId = "duomi";

/**
 * 文件夹（工作区）
 * 每个文件夹独立管理一组绘图任务，画布状态也独立保存
 */
export type DrawFolder = {
  /** 文件夹唯一 ID */
  id: string;
  /** 文件夹名称（用户可自定义） */
  name: string;
  /** 画布缩放比例（0.55 ~ 1.8） */
  canvasZoom: number;
  /** 画布水平偏移（px） */
  canvasPanX: number;
  /** 画布垂直偏移（px） */
  canvasPanY: number;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
  /** 最后更新时间（ISO 字符串） */
  updatedAt: string;
};

/**
 * 用户上传并保存到文件夹图片库中的图片
 */
export type UploadedImage = {
  /** 图片记录唯一 ID */
  id: string;
  /** 所属文件夹 ID */
  folderId: string;
  /** 图床返回的持久化访问地址 */
  url: string;
  /** 上传时的原始文件名 */
  originalName: string;
  /** 原始文件 MIME 类型 */
  mimeType: string;
  /** 原始文件大小（字节） */
  byteSize: number;
  /** 上传时间（ISO 字符串） */
  createdAt: string;
};

/**
 * 绘图任务 — 整个应用的核心数据单元
 * 每个任务记录一次 AI 绘图的完整生命周期
 */
export type DrawJob = {
  /** 任务唯一 ID */
  id: string;
  /** 所属文件夹 ID */
  folderId: string;
  /** 绘图模式 */
  mode: DrawMode;
  /** 当前状态 */
  status: DrawJobStatus;
  /** 正向提示词 */
  prompt: string;
  /** 负向提示词（告诉 AI 不要生成什么） */
  negativePrompt: string;
  /** 输入参考图 URL（图生图模式使用） */
  inputImageUrl?: string;
  /** 多张输入参考图 URL（批量图生图） */
  inputImageUrls?: string[];
  /** 输出图像 URL（单张结果） */
  outputImageUrl?: string;
  /** 输出图像 URL 列表（多次生成的历史版本） */
  outputImageUrls?: string[];
  /** 图像宽度（px） */
  width: number;
  /** 图像高度（px） */
  height: number;
  /** 图像尺寸（预设值或自定义尺寸） */
  size?: DrawSize;
  /** 生成数量 */
  count: number;
  /** 图生图的变化强度（0~1，仅 image-to-image 模式） */
  strength?: number;
  /** 推理深度：high=深度思考, medium=平衡, low=快速, standard=标准 */
  thinking: "high" | "medium" | "low" | "standard";
  /** 使用的 AI 模型名称 */
  model: string;
  /** NANO-BANANA 输出分辨率 */
  imageSize?: NanoImageSize;
  /** 排序索引（在同文件夹内） */
  orderIndex: number;
  /** 画布自由拖拽：卡片在画布坐标系中的 X 坐标 */
  posX: number;
  /** 画布自由拖拽：卡片在画布坐标系中的 Y 坐标 */
  posY: number;
  /** 是否已经由用户手动拖动过位置（用于区分默认布局和自定义布局） */
  hasCustomPosition?: boolean;
  /** 失败时的错误信息 */
  errorMessage?: string;
  /** 任务提供者 */
  provider?: ImageProviderId;
  /** 远程任务 ID */
  remoteTaskId?: string;
  /** 远程状态 */
  remoteStatus?: string;
  /** 提交时间 */
  submitTime?: string;
  /** 查询 URL */
  queryUrl?: string;
  /** 当前负责执行任务的浏览器标签页 */
  queueOwnerId?: string;
  /** 执行租约到期时间，过期后其他标签页可以接管 */
  leaseExpiresAt?: string;
  /** 开始执行时间（ISO 字符串） */
  startedAt?: string;
  /** 完成时间（ISO 字符串） */
  completedAt?: string;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
  /** 最后更新时间（ISO 字符串） */
  updatedAt: string;
};

/**
 * 队列统计信息
 * 用于展示当前系统的任务处理能力
 */
export type QueueStats = {
  /** 最大并发数 */
  maxConcurrent: number;
  /** 正在运行的任务数 */
  running: number;
  /** 等待中的任务数 */
  pending: number;
};

/**
 * 图像生成服务的提供者状态
 * 目前支持"多米API"和"浏览器模拟"两种后端
 */
export type ImageProviderStatus = {
  /** 文生图使用的后端 */
  textToImage: "duomi" | "mock";
  /** 图生图使用的后端 */
  imageToImage: "duomi" | "mock";
  /** 是否配置了多米 API Key */
  hasDuomiKey: boolean;
  /** 多米 API 基础 URL */
  duomiBaseUrl: string;
  /** 默认模型名称 */
  duomiModel: string;
  /** 已脱敏的 API Key（显示为 `sk-****xxxx`） */
  apiKeyMasked: string;
  /** 所有保存的脱敏 API Key 列表 */
  savedApiKeysMasked: string[];
  /** 当前使用的 API Key 所属供应商 */
  providerId: ApiProviderId;
  /** 每个已保存 API Key 对应的供应商 */
  savedApiKeyProviderIds: ApiProviderId[];
  /** 当前使用的 API Key 在保存列表中的索引 */
  activeApiKeyIndex: number;
  /** 是否使用了已保存的配置 */
  usesSavedConfig: boolean;
};

/**
 * 健康检查响应
 * 前端定期轮询此接口，同步队列状态和服务配置
 */
export type HealthPayload = {
  /** 服务是否正常 */
  ok: boolean;
  /** 队列统计 */
  queue: QueueStats;
  /** 图像服务状态 */
  imageProvider: ImageProviderStatus;
};

/**
 * 创建任务的请求载荷
 * 提交绘图任务时发送到后端的数据
 */
export type CreateJobPayload = {
  /** 绘图模式 */
  mode: DrawMode;
  /** 正向提示词（必填） */
  prompt: string;
  /** 参考图 URL（仅图生图模式） */
  inputImageUrl?: string;
  /** 多张参考图 URL（批量图生图） */
  inputImageUrls?: string[];
  /** 图像宽度 */
  width: number;
  /** 图像高度 */
  height: number;
  /** 图像尺寸 */
  size?: DrawSize;
  /** 生成数量 */
  count: number;
  /** 变化强度（0~1） */
  strength?: number;
  /** 推理深度 */
  thinking?: "high" | "medium" | "low";
  /** 模型名称 */
  model?: string;
  /** NANO-BANANA 输出分辨率 */
  imageSize?: NanoImageSize;
};

/**
 * 图像服务配置（前端展示用）
 */
export type ImageProviderSettings = {
  /** API 基础 URL */
  baseUrl: string;
  /** 模型名称 */
  model: string;
  /** 是否已配置 API Key */
  hasApiKey: boolean;
  /** 已脱敏的 API Key */
  apiKeyMasked: string;
  /** 所有保存的脱敏 API Key */
  savedApiKeysMasked: string[];
  /** 当前使用的 API Key 所属供应商 */
  providerId: ApiProviderId;
  /** 每个已保存 API Key 对应的供应商 */
  savedApiKeyProviderIds: ApiProviderId[];
  /** 当前使用的 API Key 在保存列表中的索引 */
  activeApiKeyIndex: number;
};

/**
 * 更新图像服务配置的请求载荷
 * 所有字段都是可选的——只传需要修改的字段即可
 */
export type UpdateImageProviderSettingsPayload = {
  /** 新的 API 基础 URL */
  baseUrl?: string;
  /** 新的模型名称 */
  model?: string;
  /** 新的 API Key（作为当前激活的Key） */
  apiKey?: string;
  /** 设为 true 时清除已保存的 API Key */
  clearApiKey?: boolean;
  /** 导入一个新的 API Key */
  importApiKey?: string;
  /** 导入的 API Key 所属供应商 */
  providerId?: ApiProviderId;
  /** 切换当前活跃的 API Key（传入其在 savedApiKeysMasked 中的索引） */
  setActiveApiKeyIndex?: number;
};
