# API 接入说明

当前项目已按多米 API 的 `gpt-image-2` 图片生成文档接入异步生成流程。

## 使用方式

打开接口设置弹窗，填写：

- Base URL，例如 `https://duomiapi.com`
- Model，例如 `gpt-image-2`
- API Key

保存后，新建绘图任务会直接使用新的 URL 和 Key，不需要重启服务。

如果要删除已保存的 Key，勾选清空已保存 Key 后保存。完整 API Key 只保存在浏览器本地，界面只显示脱敏后的 Key。

## 当前行为

- 未配置 API Key 时，绘图任务继续使用本地模拟图，方便开发测试。
- 配置 API Key 后，文生图和带参考图的任务都会调用 `POST /v1/images/generations`。
- 上传或粘贴本地参考图时，会先调用同源代理 `POST /image-upload/upload`，由 Vite/Vercel 转发到 `https://image.harrio.xyz/upload`，把 `file` 上传到图床，再使用返回的公网 URL。
- 创建栏的 Size 会作为请求体 `size` 发送，默认值为 `auto`；选择自定义时会发送实际的 `宽x高`。
- 创建接口只返回任务 `id`，项目会继续轮询 `GET /v1/tasks/{id}`。
- 任务成功后，项目读取 `data.images[0].url` 作为画布图片地址。
- 真实接口请求单次超时时间为 60 秒，异步任务总等待时间为 10 分钟。
- 已完成或失败的任务可以在图片卡片上点击重新绘制按钮再次加入队列。

## 创建任务请求

项目会发送：

```json
{
  "model": "gpt-image-2",
  "prompt": "用户提示词",
  "size": "auto、1024x1024、16:9 或自定义宽x高",
  "quality": "high",
  "oversea": false,
  "image": [
    "https://example.com/reference.png"
  ]
}
```

没有参考图时不会发送 `image` 字段。真实多米请求的参考图只发送公网 `http(s)` 图片 URL；本地上传或粘贴图片会先通过 `/image-upload/upload` 上传到 `https://image.harrio.xyz/` 获取 URL，不会再把 `data:image/...;base64` 发送给多米。`size` 支持 `auto`、`1024x1024`、`1792x1024`、`1024x1792`、自定义 `宽x高`，以及 `1:1`、`3:2`、`2:3`、`16:9`、`9:16`、`1:2`、`2:1`、`4:3`、`3:4`、`5:4`、`4:5`。

自定义尺寸要求：宽和高都能被 16 整除；每条边范围为 16 到 3840；像素预算为 655,360 到 8,294,400。`quality` 支持 `low`、`medium`、`high`。

## 查询任务响应

项目期望查询接口返回：

```json
{
  "id": "任务 id",
  "state": "succeeded",
  "data": {
    "images": [
      {
        "url": "https://cdn.example.com/output.png",
        "file_name": "output.png"
      }
    ],
    "description": ""
  },
  "progress": 100,
  "action": "generate"
}
```
