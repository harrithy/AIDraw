# Kling（可灵）视频生成 API 接入说明

> 依据多米API文档（https://s.apifox.cn/b924931e-29c0-4127-b025-d68c90285060，视频系列 → KLING）整理。
> 本文档用于 AIDraw 项目接入 Kling 视频生成的开发实施依据，待审查确认后开始编码。

---

## 1. 概述

### 1.1 结论

- Kling 接口与项目现有的 **异步任务模式**（创建任务 → 轮询查询）完全一致，可复用现有 `jobQueue`、租约、失败重试链路，无需改动队列。
- 推荐接入 **官方格式**（任务创建 + 任务查询），与当前 DuomiProvider 的 GROK 视频接入方式同构；dm 格式返回空对象、强依赖 Webhook 回调，与现有轮询架构不符，仅作备用。
- 视频结果通过 `task_result.videos[].url`（mp4）返回，项目前端已支持视频渲染（`ImagePreview` / `JobCard` 已处理 `.mp4`），可直接复用。

### 1.2 鉴权与通用约定

- **Base URL**：复用用户已配置的多米 API 地址（默认 `https://duomiapi.com`），Kling 路径前缀为 `/api/video/kling`。
- **鉴权**：请求头 `Authorization: <API Key>`（多米 API Key，即现有 `settings.apiKey`）。**注意：文档示例中 Authorization 直接是 Key 值，不带 Bearer 前缀**（与现有 Duomi 图片接口一致）。
- 官方格式与可灵官方文档一致（官方文档：https://app.klingai.com/cn/dev/document-api/apiReference/model/skillsMap），**仅域名和鉴权换成多米**；多米文档可能滞后于官方，接口细节以官方为准。
- 所有接口为 `application/json`。

---

## 2. 官方格式（推荐接入）

### 2.1 【文生视频】创建任务

- **POST** `/api/video/kling/v1/videos/text2video`
- **Header**：`Authorization: <API Key>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model_name` | enum<string> | 是 | `kling-v1` / `kling-v1-5` / `kling-v1-6` / `kling-v3`（默认 `kling-v1`）；文档注明最新支持 `kling-v2-5-turbo` |
| `prompt` | string | 是 | 描述词 |
| `negative_prompt` | string | 否 | 负面提示词 |
| `cfg_scale` | number | 否 | 创意相关度 0~1，默认 `0.5` |
| `mode` | enum<string> | 否 | `std`（标准，默认）/ `pro`（高品质） |
| `duration` | enum<integer> | 否 | `5` / `10`，默认 `5` |
| `camera_control` | object | 否 | 镜头控制：`type`（必需）+ `config`（必需：`horizontal/vertical/pan/tilt/roll/zoom`，各 0~±10） |
| `aspect_ratio` | enum<string> | 否 | `16:9` / `9:16` / `1:1`，默认 `16:9` |
| `callback_url` | string | 否 | Webhook 回调地址（可选，项目用轮询可省略） |
| `sound` | string | 否 | 示例中出现 `off`（音效开关） |
| `multi_shot` / `shot_type` / `multi_prompt` | - | 否 | 分镜相关（`multi_prompt` 为 `{index, prompt, duration}` 数组） |

**请求示例**

```json
{
  "model_name": "kling-v3",
  "prompt": "hi",
  "negative_prompt": "hi",
  "cfg_scale": 0.5,
  "mode": "std",
  "sound": "off",
  "duration": "5",
  "camera_control": {
    "type": "",
    "config": { "horizontal": 0, "vertical": 0, "pan": 0, "tilt": 0, "roll": 0, "zoom": 0 }
  },
  "multi_shot": false,
  "shot_type": "customize",
  "multi_prompt": [
    { "index": 1, "prompt": "string", "duration": "2" },
    { "index": 2, "prompt": "string", "duration": "3" }
  ],
  "aspect_ratio": "16:9",
  "callback_url": "https://webhook.site/xxx"
}
```

**响应示例（200）**

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "fa02791a-b80d-442e-9b3f-e01c0f11d4f7",
  "data": {
    "task_id": "fa02791a-b80d-442e-9b3f-e01c0f11d4f7",
    "task_status": "submitted",
    "created_at": 1732017317153,
    "updated_at": 1732017317153
  }
}
```

> 取 `data.task_id` 作为任务 ID；`task_status` 初始为 `submitted`。

### 2.2 【文生视频】查询任务（单个）

- **GET** `/api/video/kling/v1/videos/text2video/{task_id}`
- **Header**：`Authorization: <API Key>`

**响应示例（成功）**

```json
{
  "code": 0,
  "message": "成功",
  "request_id": "c9993ceb-683b-4fac-a877-42abd2360a68",
  "data": {
    "task_id": "c9993ceb-683b-4fac-a877-42abd2360a68",
    "task_status": "succeed",
    "task_status_msg": null,
    "created_at": 1732017124,
    "updated_at": 1732017726,
    "task_result": {
      "images": null,
      "videos": [
        { "id": "c9993ceb-683b-4fac-a877-42abd2360a68",
          "url": "https://p2.a.kwimgs.com/.../output.mp4",
          "duration": "5" }
      ]
    }
  }
}
```

**状态映射（开发时需实测确认全部分支）：**

| `task_status` | 行为 |
|---|---|
| `submitted` / `processing` 等中间态 | 队列继续轮询（pending） |
| `succeed` | 取 `data.task_result.videos[].url` 为结果（succeeded） |
| `failed` / `fail` | 取 `task_status_msg` 或 `message` 报错（error） |

> ⚠️ 文档未列出全部中间态枚举，`submitted` 之后的实际中间态需联调时用真实任务验证，接入代码须做容错：识别不到的未知状态一律按「继续轮询」处理，仅 `succeed` 与失败态终止。

### 2.3 【图生视频】创建任务

- **POST** `/api/video/kling/v1/videos/image2video`
- **Header**：`Authorization: <API Key>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model_name` | enum<string> | 是 | `kling-v3`（文档注：最新支持 `kling-v2-5-turbo`） |
| `image` | string | 是 | 参考图（**公网 http(s) URL**，与现有图生图一致，需先走图床上传） |
| `image_tail` | string | 否 | 尾帧 |
| `prompt` | string | 是 | 描述词（文档标注「选填」但标记为必需，按必需处理） |
| `negative_prompt` | string | 否 | 负面提示词 |
| `cfg_scale` | number | 否 | 0~1，默认 0.5 |
| `mode` | string | 是 | `std` / `pro` |
| `duration` | integer | 否 | 时长 |
| `callback_url` | string | 否 | 回调 |
| `sound` | string | 否 | 音效开关 |

**响应**：同 2.1（`data.task_id`）。

### 2.4 【图生视频】查询任务（单个）

- **GET** `/api/video/kling/v1/videos/image2video/{task_id}`
- 响应结构与 2.2 相同。

### 2.5 【图生视频】多图参考生视频

- **POST** `/api/video/kling/v1/videos/multi-image2video`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model_name` | string | 是 | 示例 `kling-v1-6` |
| `image_list` | array<object> | 是 | `[{ "image": "<公网图片URL>" }]`，可传多张 |
| `prompt` | string | 是 | 描述词 |
| `negative_prompt` | string | 否 | 负面词 |
| `mode` | string | 否 | `std` 等 |
| `duration` | string | 否 | 示例 `"5"` |
| `aspect_ratio` | string | 否 | 示例 `"16:9"` |
| `callback_url` | string | 否 | 回调 |

**响应**：同 2.1。

### 2.6 【图生视频】多图参考查询任务（单个）

- **GET** `/api/video/kling/v1/videos/multi-image2video/{task_id}`
- 响应结构同 2.2，`task_result.videos[]` 多一个 `video_url_download` 字段（示例中出现）。

---

## 3. dm 格式（备用，不推荐本轮接入）

| 接口 | 路径 | 说明 |
|---|---|---|
| generate(文本) | `POST /api/video/kling/pro/generate` | 文生视频；`prompt`(必需)、`ratio`(16:9/9:16/1:1)、`cfg`、`camera_json`(type: down_back/forward_up/right_turn_forward/left_turn_forward/horizontal/vertical/zoom/tilt/pan/roll + 各轴 -10~10)、`negative_prompt`、`callback_url` |
| generate(图片) | `POST /api/video/kling/pro/generate` | 同路径；`image`(必需，公网 URL)、`tail_image`(尾帧)、`cfg`(必需 0-1 步长0.05)、`callback_url`(必需) |
| extend | `POST /api/video/kling/pro/extend` | 视频延长；`key`(API KEY，body 内，必需)、`callback_url`(必需)、`task_id`(必需)、`prompt`(可选) |
| feed | `GET /api/video/kling/feed` | 任务查询；Query 参数 `key`、`task_id` |

> dm 格式的创建接口返回空对象 `{}`，结果只能靠 `callback_url` Webhook 推送 + `feed` 轮询获取；与项目现有「返回 task_id 再轮询」的模式不兼容，本轮不接入。**但 AIDraw 是纯前端应用，无法接收 Webhook 回调**，因此 dm 格式基本不可用，除非有中转服务，故本轮明确排除。

---

## 4. 接入方案（开发实施计划）

### 4.1 新增文件

`client/src/lib/providers/KlingProvider.ts`

```ts
export class KlingProvider implements ImageModelProvider {
  async createTask(job: DrawJob, settings: StoredSettings): Promise<CreatedProviderTask>
  async queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ProviderTaskResult>
}
```

### 4.2 createTask 逻辑

1. 由 `job.model` 判定视频类型（文生/图生/多图）：
   - 无输入图 → `POST {base}/api/video/kling/v1/videos/text2video`
   - 1 张输入图 → `POST {base}/api/video/kling/v1/videos/image2video`
   - 多张输入图 → `POST {base}/api/video/kling/v1/videos/multi-image2video`
2. 请求体映射：
   - `model_name: job.model`；`prompt: job.prompt.trim()`
   - `mode: job.thinking === "high" ? "pro" : "std"`（高品质映射）
   - `aspect_ratio: job.size`（现有 size 字段，如 `16:9`）
   - `duration: job.duration ?? 5`（Kling 枚举为 5/10）
   - `cfg_scale: 0.5`（暂定）
   - 输入图先校验为公网 URL（复用 `assertDuomiImageUrls` 的同类逻辑，建议提为公共工具）
3. 请求头 `Authorization: settings.apiKey`，**不带 Bearer**。
4. 取响应 `data.task_id`；`queryUrl` 按任务类型生成对应的查询端点（参考 2.2/2.4/2.6）。

### 4.3 queryTask 逻辑

- GET `job.queryUrl`（createTask 时已按类型固化，可持久化）
- 状态映射：
  - `succeed` → 取 `data.task_result.videos[0].url`，返回 `{ state: "succeeded", imageUrl }`
  - `failed`（或 `fail`/`error` 类）→ `{ state: "error", errorMessage: task_status_msg || message }`
  - 其他未知状态 → `{ state: "pending" }`（保守轮询，避免误判）
- 复用现有 `fetchJson` 风格错误处理（可提取公共 fetch 工具或按 DuomiProvider 模式复制，建议先提取公共工具）。

### 4.4 模型注册（`imageModels.ts`）

```ts
export const KLING_VIDEO_MODELS = ["kling-v1", "kling-v1-5", "kling-v1-6", "kling-v3"] as const;
export const isKlingVideoModel = (model: string) => (KLING_VIDEO_MODELS as readonly string[]).includes(model);
export const isVideoModel = (model: string) => isGrokVideoModel(model) || isKlingVideoModel(model);
```

- 在 `duomiImageModelGroups` 的 GROK 视频分组后新增「KLING 视频」分组（kling-v1 默认）。
- `SupportedImageModel` 联合类型同步扩展。

### 4.5 Provider 注册（`providerRegistry.ts`）

- `providers` 表中新增 `kling: new KlingProvider()`；`ImageProviderId` 类型加 `"kling"`。
- `resolveProviderId`：`isKlingVideoModel(job.model)` 时返回 `"kling"`；`getRequiredApiProvider("kling")` 返回 `"duomi"`（共用多米 Key，与 GROK 一致）。

### 4.6 UI 接入

- 模型下拉自动获得 KLING 分组（走 `getImageModelGroups`），视频生成时长、图生视频入口（输入图上传）均为现有能力，无需新 UI。
- 前端视频渲染已支持 `.mp4`，无需改动。

### 4.7 队列与租约

- 无需改动 `jobQueue.ts`；Kling 走现有 `createTask → queryTask` 轮询、90s 租约续期、30 分钟超时。
- 建议联调时确认 Kling 任务从 submitted 到 succeed 的典型耗时（通常数分钟），若超 30 分钟需上调 `TASK_TIMEOUT_MINUTES`（按任务类型区分）。

---

## 5. 风险与待验证点

| # | 事项 | 说明 |
|---|---|---|
| 1 | 中间态枚举 | `submitted` 后的实际状态值（`processing`?）需真实任务验证；代码按未知状态继续轮询兜底 |
| 2 | 失败态取值 | 失败时是 `task_status: "failed"` 还是 `fail`？报错信息在 `task_status_msg` 还是 `message`？联调确认 |
| 3 | 图生视频 prompt 必填 | 文档标注「选填」但标了必需，实际以 API 行为为准 |
| 4 | `kling-v2-5-turbo` | 文档文字提及但枚举未列出，先不入下拉，待验证后补 |
| 5 | duration | 图生视频示例为 `3`，文生视频枚举 `5/10`，以实际支持值为准（UI 先提供 5/10） |
| 6 | 图片 URL 要求 | 图生视频的 `image` 需公网 URL，复用现有图床上传链路 |
| 7 | 400 错误示例 | 文档有 400 分支但未抓到示例，错误解析用通用兜底 |

---

## 6. 待办清单

> 状态：✅ 已完成 ｜ ⏳ 待真实 Key 联调 ｜ ⬜ 未开始

- [x] 新建 `KlingProvider.ts`（createTask + queryTask，含 code≠0 错误处理、negative_prompt、SUCCEED 文案修复）
- [x] `imageModels.ts`：KLING 模型常量、`isKlingVideoModel`、模型分组、`isVideoModel` 扩展
- [x] `types.ts` / `providerRegistry.ts`：`ImageProviderId` 加 `kling` 并注册（复用多米 Key）
- [x] UI 适配：`CreateJobPanel` / `RegenerateEditDialog` 视频分支扩展（尺寸 16:9/9:16/1:1、时长 5/10）、`JobCard` 时长显示、`MockProvider` 视频分支
- [x] 搭建 Vitest 测试框架并编写单测（4 个测试文件，67 用例全绿，覆盖 create/query 分支、错误路径、provider 路由、MockProvider）
- [x] 前端类型检查 `npm run check` 通过
- [x] 浏览器实操验证（playwright）：KLING 模型分组、时长/尺寸选项、mock 视频卡片渲染
- [x] 修复 reviewer 审查问题（code≠0 白轮询、UI 当图片模型、MockProvider 坏视频、negative_prompt、SUCCEED 文案、时长显示、tsbuildinfo gitignore）
- [ ] ⏳ 用真实 API Key 联调：文生视频、图生视频（含多图），验证状态流转与 mp4 输出
- [ ] ⏳ 确认中间态枚举、失败态字段（`task_status` 的 `submitted` 后续值、`failed`/`fail` 等）与接入文档假设一致
- [ ] ⏳ 验证 `kling-v2-5-turbo` 模型（文档提及但枚举未列）可用性
- [ ] ⬜ 公共工具抽取：`fetchJson` / `getErrorMessage` / 公网 URL 校验在 DuomiProvider 与 KlingProvider 间去重（暂缓项）
