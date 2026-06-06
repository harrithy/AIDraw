# API 接入说明

当前后端已经接入 Nowcoding 图片生成接口。

## 使用方式

### 方式一：在界面里配置

打开右侧的 `API / Provider Settings` 面板，填写：

- Base URL，例如 `https://nowcoding.ai/v1`
- Model，例如 `gpt-image-2`
- API Key

点击 `Save API Settings` 后，文生图会立即使用新的 URL 和 Key，不需要重启服务。

如果要删除已保存的 Key，勾选 `Clear saved API key` 后保存。

完整 API Key 不会回传到前端，界面只显示脱敏后的 Key。

### 方式二：使用环境变量

在项目根目录新建 `.env` 文件：

```env
PORT=4100
NOWCODING_BASE_URL=https://nowcoding.ai/v1
NOWCODING_API_KEY=你的_API_KEY
NOWCODING_IMAGE_MODEL=gpt-image-2
```

保存后重启服务：

```bash
npm run dev
```

## 当前行为

- 在界面或 `.env` 中配置 API Key 后，文生图任务会调用 `POST /images/generations`。
- 未配置 `NOWCODING_API_KEY` 时，文生图继续使用本地模拟图，方便开发测试。
- 图生图暂时仍使用本地模拟图，因为当前文档截图只提供了 `generations` 接口，没有明确图生图参数。
- 文生图真实接口请求超时时间为 10 分钟。
- 已完成或失败的任务可以在图片卡片上点击重新绘制按钮再次加入队列。

## 请求参数

后端会发送：

```json
{
  "model": "gpt-image-2",
  "prompt": "用户提示词",
  "size": "auto",
  "n": 1,
  "thinking": "auto",
  "response_format": "b64_json"
}
```

返回的 `b64_json` 会被保存为本地 PNG 文件，并显示到画布中。
