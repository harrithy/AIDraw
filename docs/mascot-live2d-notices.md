# 原创 Live2D 的第三方声明

- **Live2D Cubism Core 5.1.0**：来自 [Live2D 官方运行时地址](https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js)。原始版权头保持不变；该文件标明属于可再分发代码。适用 [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)，项目同时保留完整条款于 `client/public/vendor/live2d/LICENSE.html`。Core 不属于 MIT 许可。发布应用时须遵守其适用的发布及再分发条款。
- **pixi-live2d-display 0.4.0**：MIT，[源代码](https://github.com/guansss/pixi-live2d-display)。仅用于渲染原创模型，未采用示例角色或示例模型。
- **PixiJS 6.5.10**：MIT，[源代码](https://github.com/pixijs/pixijs)。
- **live2d-autorig-claude**：MIT，Copyright 2026 henceketh，[源代码](https://github.com/henceketh/live2d-autorig-claude/tree/9c21423559cd4dafebf4c4304f1b2dacdd9f7d31)。`scripts/mascot/vendor/` 仅保留生成模型需要的 moc3 写入器、RigBuilder 与 Mesh 定义，完整许可在该目录的 `LICENSE`。本项目自己的构建脚本修正了传给 Core 的画布像素尺寸，并自行实现小幅动作与眼部切片绑定；未修改第三方源码。

角色原画为 AIDraw 原创生成资产。闭眼补图使用同一原画，通过内置 imagegen 编辑模式生成。只把眼部纹理切片用于 Live2D，原画 PNG 保持不变。模型目录不包含官方示例模型、第三方角色素材或外部生成服务的模型。

闭眼补图的实际提示词：

> Edit this exact transparent 1254 by 1254 anime illustration to create a Live2D blink texture. Change ONLY BOTH EYES to naturally, gently closed smiling eyelids. Follow each eye's tilted angle and outer eyelash silhouette; elegant thin dark curved closed upper eyelid/eyelashes, preserve same brows and blush and face outline. NO change to mouth (keep original happy open smile), hair, bangs, ears, hat, proportions, pose, clothing, stylus, tablet, hands, colors, transparency, framing or any other pixels. Maintain original exact eye locations, face size, canvas size, and alignment. This must be the SAME original young anime maiden, NOT a different character or style, and not younger or older. No new details, text, decoration or background. Output a perfectly aligned closed-eyes expression variant suitable for cropping ONLY the two eyelid regions into Live2D texture parts.
