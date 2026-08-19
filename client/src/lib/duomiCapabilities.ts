import type { CapabilityCategory } from "../types";

export type DuomiCapabilityStatus = "released" | "developing" | "obsolete" | "disabled";
export type DuomiCapabilityOutputKind = "image" | "video" | "audio" | "music" | "file" | "lyrics" | "data" | "mixed";
export type DuomiCapabilityFieldType = "text" | "textarea" | "number" | "select" | "boolean" | "url" | "url-list" | "json";

export type DuomiCapabilityField = {
  key: string;
  label: string;
  type: DuomiCapabilityFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
};

export type DuomiCapabilityAuth = {
  style: "none" | "authorization" | "bearer" | "key-header" | "key-body";
  name?: string;
  prefix?: string;
};

export type DuomiCapability = {
  id: string;
  name: string;
  provider: string;
  category: CapabilityCategory;
  status: DuomiCapabilityStatus;
  outputKind: DuomiCapabilityOutputKind;
  description?: string;
  sourceDocId: string;
  priceLabel: string;
  priceNote?: string;
  auth: DuomiCapabilityAuth;
  fields: DuomiCapabilityField[];
  /** 文档写死的请求参数，创建任务时强制合并，用户无法修改。 */
  fixedParams?: Record<string, unknown>;
  create: {
    method: "GET" | "POST";
    path: string;
    contentType: "application/json" | "multipart/form-data" | "application/x-www-form-urlencoded";
  };
  query: {
    strategy: "none" | "path" | "shared";
    method: "GET" | "POST";
    path?: string;
    taskIdParam?: string;
  };
};

type CapabilityInput = Omit<DuomiCapability, "auth" | "fields" | "priceLabel" | "create" | "query"> & {
  auth?: DuomiCapabilityAuth;
  fields?: DuomiCapabilityField[];
  priceLabel?: string;
  create: Omit<DuomiCapability["create"], "method" | "contentType"> &
    Partial<Pick<DuomiCapability["create"], "method" | "contentType">>;
  query?: Partial<DuomiCapability["query"]>;
};

const prompt = (required = true): DuomiCapabilityField => ({
  key: "prompt",
  label: "提示词",
  type: "textarea",
  required
});
const url = (key: string, label: string, required = true): DuomiCapabilityField => ({ key, label, type: "url", required });
const text = (key: string, label: string, required = false, defaultValue?: string): DuomiCapabilityField => ({
  key,
  label,
  type: "text",
  required,
  defaultValue
});
const number = (key: string, label: string, required = false, defaultValue?: number): DuomiCapabilityField => ({
  key,
  label,
  type: "number",
  required,
  defaultValue
});
const bool = (key: string, label: string, defaultValue = false, required = false): DuomiCapabilityField => ({
  key,
  label,
  type: "boolean",
  required,
  defaultValue
});
const json = (key: string, label: string, required = false): DuomiCapabilityField => ({ key, label, type: "json", required });
const select = (
  key: string,
  label: string,
  options: Array<string | number>,
  defaultValue?: string | number,
  required = false
): DuomiCapabilityField => ({
  key,
  label,
  type: "select",
  required,
  defaultValue,
  options: options.map((value) => ({ label: String(value), value }))
});

const auth: DuomiCapabilityAuth = { style: "authorization" };
const defaultQuery = { strategy: "none", method: "GET", taskIdParam: "task_id" } as const;

const capability = (input: CapabilityInput): DuomiCapability => ({
  ...input,
  auth: input.auth ?? auth,
  fields: input.fields ?? [prompt()],
  priceLabel: input.priceLabel ?? "以实际账单为准",
  create: {
    method: input.create.method ?? "POST",
    contentType: input.create.contentType ?? "application/json",
    path: input.create.path
  },
  query: {
    strategy: input.query?.strategy ?? defaultQuery.strategy,
    method: input.query?.method ?? defaultQuery.method,
    path: input.query?.path,
    taskIdParam: input.query?.taskIdParam ?? defaultQuery.taskIdParam
  }
});

const midjourneyQuery = { strategy: "shared", method: "GET", path: "/api/midjourney/feed", taskIdParam: "task_id" } as const;
const sunoQuery = { strategy: "shared", method: "GET", path: "/api/suno/feed", taskIdParam: "task_id" } as const;
const runwayQuery = { strategy: "shared", method: "GET", path: "/api/video/runway/feed", taskIdParam: "task_id" } as const;
const pikaQuery = { strategy: "shared", method: "GET", path: "/api/video/pika/feed", taskIdParam: "task_id" } as const;
const lumaQuery = { strategy: "shared", method: "GET", path: "/api/video/luma/feed", taskIdParam: "task_id" } as const;
const pixQuery = { strategy: "shared", method: "GET", path: "/api/video/pix/feed", taskIdParam: "task_id" } as const;
const unifiedVideoQuery = { strategy: "path", method: "GET", path: "/v1/videos/tasks/{task_id}" } as const;

export const DUOMI_CAPABILITIES: DuomiCapability[] = [
  capability({ id: "image.midjourney.blend", name: "Midjourney 混图", provider: "Midjourney", category: "image", status: "released", outputKind: "image", sourceDocId: "api-192667740", priceLabel: "约 ¥0.18/次", auth: { style: "key-header", name: "key" }, create: { path: "/api/midjourney/imagine/blend" }, query: midjourneyQuery, fields: [{ key: "base64Array", label: "Base64 图片", type: "url-list", required: true }, select("dimensions", "比例", ["SQUARE", "PORTRAIT", "LANDSCAPE"], "SQUARE"), text("state", "自定义状态"), url("callback_url", "回调 URL", false), prompt(false)] }),
  capability({ id: "image.midjourney.fast", name: "Midjourney 快速生成", provider: "Midjourney", category: "image", status: "released", outputKind: "image", sourceDocId: "api-192667741", priceLabel: "约 ¥0.14/次", create: { path: "/api/midjourney/imagine/fast" }, query: midjourneyQuery, fields: [select("action", "动作", ["generate", "upsample1", "upsample2", "upsample3", "upsample4", "variation1", "variation2", "variation3", "variation4"], "generate", true), prompt(false), url("callback_url", "回调 URL", false), text("image_id", "图像 ID")] }),
  capability({ id: "image.midjourney.relax", name: "Midjourney 慢速生成", provider: "Midjourney", category: "image", status: "developing", outputKind: "image", sourceDocId: "api-192667742", priceLabel: "以实际账单为准", description: "文档标记为开发中，不推荐调用", auth: { style: "key-body", name: "key" }, create: { path: "/api/midjourney/imagine/relax", contentType: "multipart/form-data" }, query: midjourneyQuery, fields: [select("action", "动作", ["generate", "upsample1", "variation1"], "generate", true), prompt(), text("image_id", "图像 ID"), url("callback_url", "回调 URL")] }),
  capability({ id: "image.gpt-image-2", name: "GPT Image 2", provider: "GPT Image", category: "image", status: "released", outputKind: "image", sourceDocId: "api-192667743", priceLabel: "约 ¥0.06/次", create: { path: "/v1/images/generations?async=true" }, query: { strategy: "path", method: "GET", path: "/v1/tasks/{id}" }, fields: [select("model", "模型", ["gpt-image-2"], "gpt-image-2", true), prompt(), select("size", "尺寸", ["auto", "1024x1024", "1792x1024", "1024x1792", "1:1", "3:2", "2:3", "16:9", "9:16", "1:2", "2:1", "4:3", "3:4", "5:4", "4:5"], "auto"), { key: "image", label: "参考图片 URL", type: "url-list" }, select("quality", "质量", ["low", "medium", "high"], "high"), bool("oversea", "海外线路"), url("callback_url", "回调 URL", false)] }),
  capability({ id: "image.nano-banana.generate", name: "Nano Banana 文生图", provider: "Nano Banana", category: "image", status: "released", outputKind: "image", sourceDocId: "api-346130262", priceLabel: "¥0.05 - ¥0.15/次", create: { path: "/api/gemini/nano-banana" }, query: { strategy: "path", method: "GET", path: "/api/gemini/nano-banana/{id}" }, fields: [select("model", "模型", ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview", "gemini-3.1-flash-lite-image-preview"], "gemini-2.5-flash-image", true), prompt(), select("aspect_ratio", "比例", ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"], "auto"), select("image_size", "分辨率", ["1K", "2K", "4K"], "2K"), bool("oversea", "海外线路")] }),
  capability({ id: "image.nano-banana.edit", name: "Nano Banana 图片编辑", provider: "Nano Banana", category: "image", status: "released", outputKind: "image", sourceDocId: "api-346293340", priceLabel: "¥0.05 - ¥0.15/次", create: { path: "/api/gemini/nano-banana-edit" }, query: { strategy: "path", method: "GET", path: "/api/gemini/nano-banana/{id}" }, fields: [select("model", "模型", ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview", "gemini-3.1-flash-lite-image-preview"], "gemini-2.5-flash-image", true), prompt(), { key: "image_urls", label: "参考图片 URL", type: "url-list", required: true, max: 10 }, select("aspect_ratio", "比例", ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"], "auto"), select("image_size", "分辨率", ["1K", "2K", "4K"], "2K")] }),
  capability({ id: "image.kling.generate", name: "Kling 图像生成", provider: "Kling", category: "image", status: "released", outputKind: "image", sourceDocId: "api-355768170", priceLabel: "约 ¥0.02 起", create: { path: "/api/klingai/v1/images/generations" }, query: { strategy: "path", method: "GET", path: "/api/klingai/v1/images/generations/{task_id}" }, fields: [text("model_name", "模型", true), prompt(), text("negative_prompt", "负面提示词"), url("image", "参考图 URL", false), url("image_reference", "人物参考图 URL", false), number("image_fidelity", "图像参考强度", false, 0.5), number("human_fidelity", "人物参考强度", false, 0.45), select("resolution", "清晰度", ["1k", "2k"], "1k"), number("n", "数量", false, 1), text("aspect_ratio", "比例")] }),
  capability({ id: "image.kling.multi", name: "Kling 多图参考生图", provider: "Kling", category: "image", status: "released", outputKind: "image", sourceDocId: "api-355772739", priceLabel: "约 ¥0.32/次", create: { path: "/api/klingai/v1/images/multi-image2image" }, query: { strategy: "path", method: "GET", path: "/api/klingai/v1/images/multi-image2image/{task_id}" }, fields: [text("model_name", "模型", true), prompt(), json("subject_image_list", "主体图片列表", true), url("scene_image", "场景图 URL"), url("style_image", "风格图 URL"), number("n", "数量", true, 1), text("aspect_ratio", "比例", true), url("callback_url", "回调 URL", false)] }),
  capability({ id: "image.kling.expand", name: "Kling 扩图", provider: "Kling", category: "image", status: "released", outputKind: "image", sourceDocId: "api-355920252", priceLabel: "约 ¥0.16/次", create: { path: "/api/klingai/v1/images/editing/expand" }, query: { strategy: "path", method: "GET", path: "/api/klingai/v1/images/editing/expand/{task_id}" }, fields: [url("image", "图片 URL"), number("up_expansion_ratio", "向上扩展", true, 0), number("down_expansion_ratio", "向下扩展", true, 0), number("left_expansion_ratio", "向左扩展", true, 0), number("right_expansion_ratio", "向右扩展", true, 0), prompt(), number("n", "数量", true, 1), url("callback_url", "回调 URL", false)] }),
  capability({ id: "image.kling.try-on", name: "Kling 虚拟试穿", provider: "Kling", category: "image", status: "disabled", outputKind: "image", sourceDocId: "api-355933025", priceLabel: "已停用", description: "多米文档已明确标记停用", create: { path: "/api/klingai/v1/images/kolors-virtual-try-on" }, query: { strategy: "path", method: "GET", path: "/api/klingai/v1/images/kolors-virtual-try-on/{task_id}" }, fields: [text("model_name", "模型", false, "kolors-virtual-try-on-v1"), url("human_image", "人物图片 URL"), url("cloth_image", "服装图片 URL")] }),

  capability({ id: "video.pix.generate", name: "PIX 视频生成", provider: "PIX", category: "video", status: "released", outputKind: "video", sourceDocId: "api-229567120", priceLabel: "约 ¥0.30/次", create: { path: "/api/video/pix/pro/generate" }, query: pixQuery, fields: [select("model", "模型", ["auto", "v5.5", "v5", "v4.5", "v4", "v5.6", "v6", "c1"], "auto", true), prompt(), text("ratio", "比例"), text("quality", "质量"), select("duration", "时长（秒）", [5, 8, 10, 15], 5), select("audio", "生成音频", [0, 1], 1), url("callback_url", "回调 URL", false), url("image", "首帧图片 URL", false), url("last_image", "尾帧图片 URL", false), { key: "image_list", label: "多图 URL", type: "url-list" }, number("template_id", "特效模板 ID"), number("motion_strength", "运动强度"), json("motion_scale", "运动缩放参数"), number("seed", "随机种子"), select("sound_effect_switch", "音效开关", [0, 1], 0), text("sound_effect_content", "音效描述"), { key: "lip_sync_tts_speaker_id", label: "口型同步音色 ID", type: "select", options: [{ label: "Auto（自动）", value: "Auto" }, { label: "Ethan", value: "14" }, { label: "Adrian", value: "6" }, { label: "Oliver", value: "13" }, { label: "James", value: "2" }, { label: "Liam", value: "4" }, { label: "Jack", value: "12" }, { label: "Mason", value: "11" }, { label: "Julia", value: "10" }, { label: "Chloe", value: "5" }, { label: "Emily", value: "1" }, { label: "Sophia", value: "9" }, { label: "Isabella", value: "3" }, { label: "Ava", value: "8" }, { label: "Harper", value: "7" }] }, text("lip_sync_tts_content", "口型同步文本"), text("camera_movement", "镜头运动"), select("style", "风格", ["anime", "3d_animation", "comic", "cyberpunk", "clay"])] }),
  capability({ id: "video.runway.text", name: "Runway 文生视频", provider: "Runway", category: "video", status: "released", outputKind: "video", sourceDocId: "api-194071079", priceLabel: "约 ¥0.32/次", create: { path: "/api/video/runway/pro/generate" }, query: runwayQuery, fields: [url("callback_url", "回调 URL", false), text("ratio", "比例"), prompt(), text("style", "风格"), select("model", "模型", ["gen2", "gen3", "gen4", "gen4.5"], "gen4", true), json("options", "高级参数")] }),
  capability({ id: "video.runway.image", name: "Runway 图生视频", provider: "Runway", category: "video", status: "released", outputKind: "video", sourceDocId: "api-197459654", priceLabel: "约 ¥0.32/次", create: { path: "/api/video/runway/pro/generate" }, query: runwayQuery, fields: [url("callback_url", "回调 URL", false), url("image", "首帧图片 URL"), url("last_image", "尾帧图片 URL", false), text("style", "风格"), select("model", "模型", ["gen2", "gen3", "gen4", "gen4.5"], "gen4"), prompt(), json("options", "高级参数", true)] }),
  capability({ id: "video.runway.video", name: "Runway 视频转视频", provider: "Runway", category: "video", status: "developing", outputKind: "video", sourceDocId: "api-219262780", priceLabel: "约 ¥0.32/次", description: "官方接口当前内测中，提交可能被拒绝", auth: { style: "key-body", name: "key" }, create: { path: "/api/video/runway/pro/generate" }, query: runwayQuery, fields: [url("callback_url", "回调 URL"), url("video", "源视频 URL"), text("model", "模型", true), prompt(), json("options", "高级参数", true)] }),
  capability({ id: "video.runway.act-two", name: "Runway Act-two", provider: "Runway", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-227504069", priceLabel: "约 ¥0.50/次", create: { path: "/api/video/runway/pro/act_one" }, query: runwayQuery, fields: [url("video", "驱动视频 URL", false), url("image", "角色图片 URL", false), url("character_video", "角色视频 URL", false), url("callback_url", "回调 URL", false), json("options", "高级参数")] }),
  capability({ id: "video.runway.aleph", name: "Runway Aleph", provider: "Runway", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-329979819", priceLabel: "约 ¥1.00/次", create: { path: "/api/video/runway/pro/aleph" }, query: runwayQuery, fields: [prompt(), url("video", "源视频 URL"), json("options", "高级参数"), { key: "images", label: "参考图片 URL", type: "url-list" }] }),
  capability({ id: "video.luma.generate", name: "Luma 视频生成", provider: "Luma", category: "video", status: "released", outputKind: "video", sourceDocId: "api-196217807", priceLabel: "约 ¥1.18/次", description: "官网当前标记维护中", create: { path: "/api/video/luma/pro/generate" }, query: lumaQuery, fields: [{ ...prompt(), key: "user_prompt" }, url("image_url", "首帧图片 URL"), url("image_end_url", "尾帧图片 URL", false), bool("expand_prompt", "扩写提示词", true), url("callback_url", "回调 URL", false), bool("loop", "循环视频", false)] }),
  capability({ id: "video.luma.extend", name: "Luma 扩展视频", provider: "Luma", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-208852651", priceLabel: "以实际账单为准", create: { path: "/api/video/luma/pro/extend" }, query: lumaQuery, fields: [url("callback_url", "回调 URL"), text("task_id", "原任务 ID", true), { ...prompt(false), key: "user_prompt" }, bool("expand_prompt", "扩写提示词", true)] }),
  capability({ id: "video.pika.text", name: "Pika 文生视频", provider: "Pika", category: "video", status: "developing", outputKind: "video", sourceDocId: "api-192667788", priceLabel: "约 ¥0.30/次", description: "官网当前标记维护中", auth: { style: "key-body", name: "key" }, create: { path: "/api/video/pika/pro/generate" }, query: pikaQuery, fields: [url("callback_url", "回调 URL"), text("ratio", "比例", true), prompt(), bool("sfx", "音效"), number("model", "模型", false, 1.5), json("options", "高级参数", true)] }),
  capability({ id: "video.pika.image", name: "Pika 图片特效", provider: "Pika", category: "video", status: "developing", outputKind: "video", sourceDocId: "api-197164281", priceLabel: "约 ¥0.30/次", create: { path: "/api/video/pika/pro/generate" }, query: pikaQuery, fields: [url("callback_url", "回调 URL"), prompt(), bool("sfx", "音效"), url("image", "图片 URL"), select("style", "特效", ["Inflate", "Melt", "Explode", "Squish", "Crush", "Cake-ify", "Ta-da", "Deflate", "Crumble", "Dissolve", "Levitate", "Decapitate", "Eye-pop"]), number("model", "模型", false, 1.5)] }),
  capability({ id: "video.pika.reference", name: "Pika 参考视频", provider: "Pika", category: "video", status: "developing", outputKind: "video", sourceDocId: "api-197168595", priceLabel: "约 ¥0.30/次", auth: { style: "key-body", name: "key" }, create: { path: "/api/video/pika/pro/generate" }, query: pikaQuery, fields: [url("callback_url", "回调 URL"), prompt(), bool("sfx", "音效", false, true), text("style", "风格", true), url("video", "参考视频 URL"), json("options", "高级参数", true)] }),
  capability({ id: "video.kling.dm-text", name: "Kling 文生视频（旧格式）", provider: "Kling", category: "video", status: "released", outputKind: "video", sourceDocId: "api-208316908", priceLabel: "动态计费", description: "兼容旧任务，新任务推荐官方格式", create: { path: "/api/video/kling/pro/generate" }, query: { strategy: "shared", method: "GET", path: "/api/video/kling/feed", taskIdParam: "task_id" }, fields: [url("callback_url", "回调 URL", false), prompt(), select("ratio", "比例", ["16:9", "9:16", "1:1"]), text("negative_prompt", "负面提示词"), text("cfg", "引导强度"), json("camera_json", "镜头参数")] }),
  capability({ id: "video.kling.dm-image", name: "Kling 图生视频（旧格式）", provider: "Kling", category: "video", status: "released", outputKind: "video", sourceDocId: "api-208316909", priceLabel: "动态计费", description: "兼容旧任务，新任务推荐官方格式", create: { path: "/api/video/kling/pro/generate" }, query: { strategy: "shared", method: "GET", path: "/api/video/kling/feed", taskIdParam: "task_id" }, fields: [url("callback_url", "回调 URL"), prompt(false), url("image", "首帧图片 URL"), url("tail_image", "尾帧图片 URL", false), text("negative_prompt", "负面提示词"), text("cfg", "引导强度", true)] }),
  capability({ id: "video.kling.dm-extend", name: "Kling 视频延长（旧格式）", provider: "Kling", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-208316910", priceLabel: "动态计费", auth: { style: "key-body", name: "key" }, create: { path: "/api/video/kling/pro/extend" }, query: { strategy: "shared", method: "GET", path: "/api/video/kling/feed", taskIdParam: "task_id" }, fields: [url("callback_url", "回调 URL"), text("task_id", "原任务 ID", true), prompt(false)] }),
  capability({ id: "video.kling.text", name: "Kling 文生视频", provider: "Kling", category: "video", status: "released", outputKind: "video", sourceDocId: "api-235281645", priceLabel: "¥0.16 - ¥1.60/秒", priceNote: "按模型、模式、声音与时长动态计费", create: { path: "/api/video/kling/v1/videos/text2video" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/text2video/{task_id}" }, fields: [select("model_name", "模型", ["kling-v1", "kling-v1-5", "kling-v1-6", "kling-v3"], "kling-v1", true), prompt(), text("negative_prompt", "负面提示词"), number("cfg_scale", "引导强度", false, 0.5), select("mode", "模式", ["std", "pro"], "std"), select("duration", "时长（秒）", [5, 10], 5), json("camera_control", "镜头控制"), select("aspect_ratio", "比例", ["16:9", "9:16", "1:1"], "16:9"), select("sound", "音画同步", ["on", "off"], "off"), bool("multi_shot", "多镜头"), text("shot_type", "镜头类型"), json("multi_prompt", "分镜提示词"), url("callback_url", "回调 URL", false)] }),
  capability({ id: "video.kling.image", name: "Kling 图生视频", provider: "Kling", category: "video", status: "released", outputKind: "video", sourceDocId: "api-235281711", priceLabel: "¥0.16 - ¥1.60/秒", priceNote: "按模型、模式、声音与时长动态计费", create: { path: "/api/video/kling/v1/videos/image2video" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/image2video/{task_id}" }, fields: [select("model_name", "模型", ["kling-v3"], "kling-v3", true), url("image", "首帧图片 URL"), url("image_tail", "尾帧图片 URL", false), prompt(), text("negative_prompt", "负面提示词"), number("cfg_scale", "引导强度"), select("mode", "模式", ["std", "pro"], "std", true), number("duration", "时长（秒）", false, 5), select("sound", "音画同步", ["on", "off"], "off"), bool("multi_shot", "多镜头"), text("shot_type", "镜头类型"), json("multi_prompt", "分镜提示词"), url("callback_url", "回调 URL", false)] }),
  capability({ id: "video.kling.multi-image", name: "Kling 多图参考视频", provider: "Kling", category: "video", status: "released", outputKind: "video", sourceDocId: "api-348742959", priceLabel: "约 ¥0.80/次起", create: { path: "/api/video/kling/v1/videos/multi-image2video" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/multi-image2video/{task_id}" }, fields: [text("model_name", "模型", true), json("image_list", "图片列表", true), prompt(), text("negative_prompt", "负面提示词"), select("mode", "模式", ["std", "pro"], "std"), text("duration", "时长（秒）", false, "5"), text("aspect_ratio", "比例"), url("callback_url", "回调 URL", false)] }),
  capability({ id: "video.kling.effects", name: "Kling 视频特效", provider: "Kling", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-295807123", priceLabel: "约 ¥0.80/次", create: { path: "/api/video/kling/v1/videos/effects" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/effects/{task_id}" }, fields: [select("effect_scene", "特效", ["bloombloom", "dizzydizzy", "fuzzyfuzzy", "squish", "expansion", "hug", "kiss", "heart_gesture"], undefined, true), json("input", "输入参数", true), url("callback_url", "回调 URL")] }),
  capability({ id: "video.kling.extend", name: "Kling 视频延长", provider: "Kling", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-355088221", priceLabel: "动态计费", create: { path: "/api/video/kling/v1/videos/video-extend" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/video-extend/{task_id}" }, fields: [text("video_id", "视频 ID", true), prompt(false), url("callback_url", "回调 URL", false)] }),
  capability({ id: "video.sora.generate", name: "Sora 视频生成", provider: "Sora", category: "video", status: "released", outputKind: "video", sourceDocId: "api-357826026", priceLabel: "约 ¥0.20/秒", create: { path: "/v1/videos/generations" }, query: unifiedVideoQuery, fields: [select("model", "模型", ["sora-2", "sora-2-pro", "sora-2-temporary"], "sora-2", true), prompt(), text("aspect_ratio", "比例"), select("duration", "时长（秒）", [4, 8, 12], 4), { key: "image_urls", label: "参考图片 URL", type: "url-list", max: 1 }, text("character_url", "角色视频 URL"), text("character_timestamps", "角色时间段"), url("callback_url", "回调 URL", false), text("characters", "角色配置"), select("size", "尺寸", ["small", "large"], "small")] }),
  capability({ id: "video.sora.remix", name: "Sora 重新编辑视频", provider: "Sora", category: "tool", status: "obsolete", outputKind: "video", sourceDocId: "api-377123824", priceLabel: "已废弃", create: { path: "/v1/videos/{video_id}/remix" }, query: unifiedVideoQuery, fields: [text("video_id", "视频 ID", true), text("model", "模型", true), prompt(), text("aspect_ratio", "比例"), number("duration", "时长（秒)")] }),
  capability({ id: "video.sora.character", name: "Sora 创建角色", provider: "Sora", category: "tool", status: "obsolete", outputKind: "data", sourceDocId: "api-388274081", priceLabel: "已废弃", create: { path: "/v1/characters" }, query: unifiedVideoQuery, fields: [url("url", "视频 URL", false), text("from_task", "来源任务 ID"), text("timestamps", "时间段", true), url("callback_url", "回调 URL", false)] }),
  capability({ id: "video.veo.generate", name: "VEO 视频生成", provider: "VEO", category: "video", status: "released", outputKind: "video", sourceDocId: "api-393471292", priceLabel: "¥0.20 - ¥1.20/次", create: { path: "/v1/videos/generations" }, query: unifiedVideoQuery, fields: [select("model", "模型", ["veo3.1-fast", "veo3.1-pro"], "veo3.1-fast", true), prompt(), select("generation_type", "生成模式", ["TEXT", "FIRST&LAST", "REFERENCE"], "TEXT"), select("aspect_ratio", "比例", ["16:9", "9:16"], "16:9"), select("duration", "时长（秒）", [8], 8), select("quality", "清晰度", ["720p", "1080p", "4k"], "720p"), { key: "image_urls", label: "参考图片 URL", type: "url-list" }] }),
  capability({ id: "video.grok.generate", name: "GROK 视频生成", provider: "GROK", category: "video", status: "released", outputKind: "video", sourceDocId: "api-427255838", priceLabel: "¥0.04 - ¥0.05/秒", create: { path: "/v1/videos/generations" }, query: unifiedVideoQuery, fields: [select("model", "模型", ["grok-video", "grok-video-1.5"], "grok-video", true), prompt(), select("aspect_ratio", "比例", ["2:3", "3:2", "1:1", "9:16", "16:9"], "16:9"), select("duration", "时长（秒）", [6, 10, 15, 20, 25, 30], 10), { key: "image_urls", label: "参考图片 URL", type: "url-list" }, select("quality", "清晰度", ["720p"], "720p"), bool("oversea", "海外线路")] }),
  capability({ id: "video.seedance.generate", name: "Seedance 2.0", provider: "Seedance", category: "video", status: "developing", outputKind: "video", sourceDocId: "api-439407283", priceLabel: "约 ¥1.00/秒", create: { path: "/api/v3/contents/generations/tasks" }, query: { strategy: "path", method: "GET", path: "/api/v3/contents/generations/tasks/{task_id}" }, fields: [text("model", "模型", true), json("content", "多模态内容", true), bool("generate_audio", "生成音频", true), text("ratio", "比例"), number("duration", "时长（秒）"), text("resolution", "清晰度"), bool("watermark", "水印")] }),

  capability({ id: "music.suno.generate", name: "SUNO 生成音乐", provider: "SUNO", category: "music", status: "released", outputKind: "music", sourceDocId: "api-192667789", priceLabel: "约 ¥0.34/次", create: { path: "/api/suno/generate", contentType: "multipart/form-data" }, query: sunoQuery, fields: [url("callback_url", "回调 URL", false), select("custom_mode", "自定义模式", [0, 1], 0, true), select("make_instrumental", "纯音乐", [0, 1], 0, true), prompt(false), select("mv", "版本", ["chirp-bluejay", "chirp-auk", "chirp-v4", "chirp-v3-5", "chirp-fenix"], "chirp-fenix"), text("title", "歌名"), text("tags", "风格"), text("continue_at", "续写起点（秒）"), text("continue_clip_id", "续写片段 ID"), text("negative_tags", "排除风格"), text("cover_clip_id", "翻唱片段 ID")] }),
  capability({ id: "music.suno.concat", name: "SUNO 合并音乐", provider: "SUNO", category: "music", status: "released", outputKind: "music", sourceDocId: "api-192667790", priceLabel: "约 ¥0.003/次", auth: { style: "key-body", name: "key" }, create: { path: "/api/suno/concat", contentType: "multipart/form-data" }, query: sunoQuery, fields: [text("task_id", "片段任务 ID", true), url("callback_url", "回调 URL")] }),
  capability({ id: "music.suno.lyrics", name: "SUNO 生成歌词", provider: "SUNO", category: "music", status: "released", outputKind: "lyrics", sourceDocId: "api-192667791", priceLabel: "约 ¥0.003/次", create: { path: "/api/suno/lyrics", contentType: "multipart/form-data" }, fields: [prompt()] }),
  capability({ id: "music.suno.upload", name: "SUNO 上传音频", provider: "SUNO", category: "music", status: "released", outputKind: "audio", sourceDocId: "api-225630789", priceLabel: "免费", auth: { style: "key-header", name: "key" }, create: { path: "/api/suno/uploads/audio" }, fields: [url("file", "音频 URL"), text("extension", "扩展名", false, "mp3")] }),
  capability({ id: "music.suno.video", name: "SUNO 生成音乐视频", provider: "SUNO", category: "music", status: "released", outputKind: "video", sourceDocId: "api-279693815", priceLabel: "约 ¥0.005/次", create: { path: "/api/suno/video" }, query: sunoQuery, fields: [text("task_id", "音乐任务 ID", true)] }),
  capability({ id: "music.suno.lyrics-v2", name: "SUNO 歌词 V2", provider: "SUNO", category: "music", status: "released", outputKind: "lyrics", sourceDocId: "api-309826086", priceLabel: "约 ¥0.003/次", create: { path: "/api/suno/submit/lyrics" }, query: sunoQuery, fields: [prompt()] }),
  capability({ id: "music.suno.wav", name: "SUNO 转 WAV", provider: "SUNO", category: "music", status: "released", outputKind: "audio", sourceDocId: "api-310009063", priceLabel: "约 ¥0.005/次", create: { path: "/api/suno/wav" }, query: sunoQuery, fields: [text("task_id", "音乐任务 ID", true)] }),
  capability({ id: "music.suno.speed", name: "SUNO 调整速度", provider: "SUNO", category: "music", status: "released", outputKind: "audio", sourceDocId: "api-310204596", priceLabel: "约 ¥0.001/次", create: { path: "/api/suno/speed" }, query: sunoQuery, fields: [text("task_id", "音乐任务 ID", true), number("speed_multiplier", "速度倍率", true, 1), bool("keep_pitch", "保持音调", true), text("title", "标题")] }),
  capability({ id: "music.suno.crop", name: "SUNO 裁剪音乐", provider: "SUNO", category: "music", status: "released", outputKind: "audio", sourceDocId: "api-310304786", priceLabel: "约 ¥0.001/次", create: { path: "/api/suno/crop" }, query: sunoQuery, fields: [text("task_id", "音乐任务 ID", true), number("crop_start_s", "开始时间", true, 0), number("crop_end_s", "结束时间", true), bool("is_crop_remove", "移除选中片段")] }),
  capability({ id: "music.suno.timing", name: "SUNO 歌词时间线", provider: "SUNO", category: "music", status: "released", outputKind: "lyrics", sourceDocId: "api-310323557", priceLabel: "约 ¥0.002/次", create: { path: "/api/suno/timing" }, query: sunoQuery, fields: [text("task_id", "音乐任务 ID", true), text("clip_id", "音乐片段 ID")] }),
  capability({ id: "music.suno.midi", name: "SUNO 生成 MIDI", provider: "SUNO", category: "music", status: "released", outputKind: "file", sourceDocId: "api-391746125", priceLabel: "约 ¥0.005/次", create: { path: "/api/suno/midi" }, query: sunoQuery, fields: [text("task_id", "音乐任务 ID", true), text("clip_id", "音乐片段 ID")] }),
  capability({ id: "music.suno.underpainting", name: "SUNO 配乐（清唱加伴奏）", provider: "SUNO", category: "music", status: "released", outputKind: "music", sourceDocId: "doc-7571704", priceLabel: "约 ¥0.34/次", description: "为上传的清唱音频自动配乐，需先在「上传音频」中获取 clip_id 与风格标签", create: { path: "/api/suno/generate", contentType: "multipart/form-data" }, query: sunoQuery, fixedParams: { mv: "chirp-bluejay", task: "underpainting", prompt: "", override_fields: ["prompt", "tags"] }, fields: [text("underpainting_clip_id", "清唱片段 ID", true), text("tags", "风格标签", true), number("underpainting_start_s", "起始时间（秒）", false, 0), number("underpainting_end_s", "结束时间（秒）", true), text("title", "歌名"), url("callback_url", "回调 URL", false)] }),
  capability({ id: "music.suno.overpainting", name: "SUNO 人声（清唱加歌声）", provider: "SUNO", category: "music", status: "released", outputKind: "music", sourceDocId: "doc-7571707", priceLabel: "约 ¥0.34/次", description: "为上传的清唱音频配上人声歌唱，需先在「上传音频」中获取 clip_id 与风格标签", create: { path: "/api/suno/generate", contentType: "multipart/form-data" }, query: sunoQuery, fixedParams: { mv: "chirp-bluejay", task: "overpainting", override_fields: ["prompt", "tags"] }, fields: [text("overpainting_clip_id", "清唱片段 ID", true), prompt(true), text("tags", "风格标签", true), number("overpainting_start_s", "起始时间（秒）", false, 0), number("overpainting_end_s", "结束时间（秒）", true), text("title", "歌名"), url("callback_url", "回调 URL", false)] }),

  capability({ id: "audio.kling.text-effect", name: "Kling 文生音效", provider: "Kling", category: "music", status: "released", outputKind: "audio", sourceDocId: "api-349066672", priceLabel: "约 ¥0.20/次", create: { path: "/api/video/kling/v1/audio/text-to-audio" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/audio/text-to-audio/{task_id}" }, fields: [text("effect_scene", "场景", true), json("input", "输入参数", true), url("callback_url", "回调 URL")] }),
  capability({ id: "audio.kling.video-effect", name: "Kling 视频生音效", provider: "Kling", category: "music", status: "released", outputKind: "audio", sourceDocId: "api-349101403", priceLabel: "约 ¥0.20/次", create: { path: "/api/video/kling/v1/audio/video-to-audio" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/audio/video-to-audio/{task_id}" }, fields: [text("effect_scene", "场景", true), json("input", "输入参数", true), url("callback_url", "回调 URL")] }),
  capability({ id: "audio.kling.tts", name: "Kling 语音合成", provider: "Kling", category: "music", status: "released", outputKind: "audio", sourceDocId: "api-354805711", priceLabel: "约 ¥0.04/次", create: { path: "/api/video/kling/v1/audio/tts" }, query: { strategy: "none", method: "GET" }, fields: [text("text", "合成文本", true), text("voice_id", "声音 ID", true), text("voice_language", "语言", true), number("voice_speed", "语速", false, 1)] }),
  capability({ id: "tool.kling.identify-face", name: "Kling 人脸识别", provider: "Kling", category: "tool", status: "released", outputKind: "data", sourceDocId: "api-354873578", priceLabel: "以实际账单为准", create: { path: "/api/video/kling/v1/videos/identify-face" }, query: { strategy: "none", method: "GET" }, fields: [url("video_url", "视频 URL")] }),
  capability({ id: "tool.kling.lip-sync", name: "Kling 对口型", provider: "Kling", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-354877188", priceLabel: "约 ¥0.40/次", create: { path: "/api/video/kling/v1/videos/advanced-lip-sync" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/advanced-lip-sync/{task_id}" }, fields: [text("session_id", "人脸识别会话 ID", true), json("face_choose", "人脸与音频配置", true)] }),
  capability({ id: "tool.kling.avatar", name: "Kling 数字人", provider: "Kling", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-383343750", priceLabel: "std ¥0.30/秒，pro ¥0.60/秒", create: { path: "/api/video/kling/v1/videos/avatar/image2video" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/avatar/image2video/{task_id}" }, fields: [url("image", "人物图片 URL"), text("audio_id", "音频 ID"), url("sound_file", "音频文件 URL", false), prompt(false), select("mode", "模式", ["std", "pro"], "std"), url("callback_url", "回调 URL", false)] }),
  capability({ id: "tool.kling.presets-elements", name: "Kling 官方主体查询", provider: "Kling", category: "tool", status: "released", outputKind: "data", sourceDocId: "api-385074604", priceLabel: "免费", description: "分页查询官方主体（特效、音效等预设元素），同步返回列表数据", create: { method: "GET", path: "/api/video/kling/v1/general/presets-elements" }, query: { strategy: "none", method: "GET" }, fields: [number("pageNum", "页码", false, 1), number("pageSize", "每页数量", false, 30)] }),
  capability({ id: "tool.kling.omni", name: "Kling Omni-Video", provider: "Kling", category: "tool", status: "released", outputKind: "video", sourceDocId: "api-385074605", priceLabel: "动态计费", create: { path: "/api/video/kling/v1/videos/omni-video" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/omni-video/{id}" }, fields: [text("model_name", "模型", true), prompt(), select("mode", "模式", ["std", "pro"], "std"), text("aspect_ratio", "比例"), select("sound", "声音", ["on", "off"], "on"), text("duration", "时长（秒）", false, "3"), bool("multi_shot", "多镜头", true), text("shot_type", "镜头类型"), json("multi_prompt", "分镜提示词"), url("callback_url", "回调 URL", false)] }),
  capability({ id: "tool.kling.motion", name: "Kling 动作控制", provider: "Kling", category: "tool", status: "developing", outputKind: "video", sourceDocId: "api-403906024", priceLabel: "动态计费", create: { path: "/api/video/kling/v1/videos/motion-control" }, query: { strategy: "path", method: "GET", path: "/api/video/kling/v1/videos/motion-control/{id}" }, fields: [select("model_name", "模型", ["kling-v2-6", "kling-v3"], "kling-v2-6"), text("mode", "模式", true), url("image_url", "人物图片 URL"), text("character_orientation", "人物朝向", true), url("video_url", "动作视频 URL"), prompt()] })
];

const capabilityMap = new Map(DUOMI_CAPABILITIES.map((item) => [item.id, item]));

export const getDuomiCapability = (capabilityId: string) => capabilityMap.get(capabilityId);

export const getDuomiCapabilitiesByCategory = (category: CapabilityCategory) =>
  DUOMI_CAPABILITIES.filter((item) => item.category === category);

export const getDuomiCapabilityDefaultValues = (item: DuomiCapability) =>
  Object.fromEntries(item.fields.filter((field) => field.defaultValue !== undefined).map((field) => [field.key, field.defaultValue]));

export const isDuomiCapabilitySubmittable = (item: DuomiCapability) =>
  item.status === "released" || item.status === "developing";

export const DUOMI_CATEGORY_LABELS: Record<CapabilityCategory, string> = {
  image: "图像",
  video: "视频",
  music: "音乐",
  tool: "专项工具"
};
