# API 接入说明

当前项目已接入多米 API 的 `gpt-image-2` 与 NANO-BANANA 异步图片生成流程。

## 使用方式

打开接口设置弹窗，填写：

- Base URL，例如 `https://duomiapi.com`
- API Key

保存后，新建绘图任务会直接使用新的 URL 和 Key，不需要重启服务。具体模型在创建栏的“模型”下拉框中选择：

- ChatGPT：`gpt-image-2`
- NANO-BANANA：`gemini-3-pro-image-preview`、`gemini-2.5-flash-image`、`gemini-3.1-flash-image-preview`

NANO-BANANA 默认选择 `gemini-3-pro-image-preview`。接口文档右侧显示的 `nano-banana-pro`、`nano-banana`、`nano-banana-2` 是模型说明名称，不作为下拉选项发送。

如果要删除已保存的 Key，勾选清空已保存 Key 后保存。完整 API Key 只保存在浏览器本地，界面只显示脱敏后的 Key。

## 当前行为

- 未配置 API Key 时，绘图任务继续使用本地模拟图，方便开发测试。
- 配置 API Key 后，`gpt-image-2` 的文生图和带参考图任务会调用 `POST /v1/images/generations`。
- NANO-BANANA 文生图调用 `POST /api/gemini/nano-banana`。
- NANO-BANANA 图生图调用 `POST /api/gemini/nano-banana-edit`，参考图使用 `image_urls`，最多 10 张。
- NANO-BANANA 创建接口返回 `data.task_id`，项目轮询 `GET /api/gemini/nano-banana/{id}`，成功后读取 `data.data.images[0].url`。
- 上传或粘贴本地参考图时，会先调用同源代理 `POST /image-upload/upload`，由 Vite/Vercel 转发到 `https://image.harrio.xyz/upload`，把 `file` 上传到图床，再使用返回的公网 URL。
- 创建栏的 Size 会作为请求体 `size` 发送，默认值为 `auto`；选择自定义时会发送实际的 `宽x高`。
- 创建接口只返回任务 `id`，项目会继续轮询 `GET /v1/tasks/{id}`。
- 任务成功后，项目读取 `data.images[0].url` 作为画布图片地址。
- 真实接口请求单次超时时间为 60 秒，异步任务总等待时间为 30 分钟。
- 已完成或失败的任务可以在图片卡片上点击重新绘制按钮再次加入队列。

## 创建任务请求

项目会发送：

以下示例使用 `jsonc` 注释解释字段，实际请求时需要发送不含注释的标准 JSON。

```jsonc
{
  // 使用 gpt-image-2 图片模型
  "model": "gpt-image-2",
  // 用户输入的绘图提示词
  "prompt": "用户提示词",
  // 支持预设比例、固定尺寸和自定义宽高
  "size": "auto、1024x1024、16:9 或自定义宽x高",
  // gpt-image-2 的生成质量
  "quality": "high",
  "oversea": false,
  // 图生图时发送公网参考图地址；文生图不发送该字段
  "image": [
    "https://example.com/reference.png"
  ]
}
```

没有参考图时不会发送 `image` 字段。真实多米请求的参考图只发送公网 `http(s)` 图片 URL；本地上传或粘贴图片会先通过 `/image-upload/upload` 上传到 `https://image.harrio.xyz/` 获取 URL，不会再把 `data:image/...;base64` 发送给多米。`size` 支持 `auto`、`1024x1024`、`1792x1024`、`1024x1792`、自定义 `宽x高`，以及 `1:1`、`3:2`、`2:3`、`16:9`、`9:16`、`1:2`、`2:1`、`4:3`、`3:4`、`5:4`、`4:5`。

自定义尺寸要求：宽和高都能被 16 整除；每条边范围为 16 到 3840；像素预算为 655,360 到 8,294,400。`quality` 支持 `low`、`medium`、`high`。

## 查询任务响应

项目期望查询接口返回：

```jsonc
{
  // 多米异步任务编号
  "id": "任务 id",
  // succeeded 表示任务生成成功
  "state": "succeeded",
  "data": {
    // 生成结果图片列表
    "images": [
      {
        "url": "https://cdn.example.com/output.png",
        "file_name": "output.png"
      }
    ],
    "description": ""
  },
  // 任务完成进度
  "progress": 100,
  "action": "generate"
}
```

## NANO-BANANA 请求

文生图请求示例：

```jsonc
{
  // NANO-BANANA 当前默认使用的底层模型
  "model": "gemini-3-pro-image-preview",
  // 用户输入的绘图提示词
  "prompt": "用户提示词",
  // 图片宽高比；选择 auto 时项目不发送该字段
  "aspect_ratio": "16:9",
  // 输出分辨率，K 必须大写
  "image_size": "4K",
  "oversea": false
}
```

图生图会改用 `/api/gemini/nano-banana-edit`，并增加公网参考图数组：

```jsonc
{
  // NANO-BANANA 当前默认使用的底层模型
  "model": "gemini-3-pro-image-preview",
  // 用户输入的图片编辑提示词
  "prompt": "用户提示词",
  // 最多传入 10 张公网参考图，不支持 base64
  "image_urls": [
    "https://example.com/reference.png"
  ],
  // 单参考图选择 auto 时项目不发送该字段
  "aspect_ratio": "16:9",
  // 输出分辨率，支持 1K、2K、4K
  "image_size": "4K"
}
```

Nano Pro 与 Nano 2 系列默认使用 `4K`，也可以选择 `1K`、`2K`；`gemini-2.5-flash-image` 和 `nano-banana` 不发送 `image_size`，由模型自动决定分辨率。NANO-BANANA 支持 `auto`、`1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`21:9` 比例。选择 `auto` 时不会发送 `aspect_ratio`，由接口自适应。
