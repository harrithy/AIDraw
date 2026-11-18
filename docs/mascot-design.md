# AIDraw 绘画少女形象

## 角色与展示

原创绘画少女：奶油白短发、薄荷发梢、侧辫、绿瞳、小猫耳，佩戴带叠层画框徽记的鼠尾草绿贝雷帽，身着奶油白连帽外套和绿色画师裙。方向为青春灵动的少女；Q 版与坨坨脸沿用同一角色特征。

独立页面 `/mascot` 默认展示原创少女的 Live2D，工作区左侧“项目形象馆”入口在新标签页打开。保留少女、Q 版、坨坨脸的静态图与透明 PNG 下载。

- `client/public/mascot/aidraw-girl-2d-v1.png`：1254 × 1254 透明原画，未改写。
- `client/public/mascot/aidraw-girl-chibi-v1.png`：Q 版。
- `client/public/mascot/aidraw-girl-face-v1.png`：坨坨脸图标。
- `docs/assets/aidraw-girl-eyes-closed-v1.png`：通过内置 imagegen 编辑模式生成的闭眼补图，仅眼部切片用于模型。
- `client/public/mascot/live2d/`：原生 Cubism `.moc3`、`.model3.json`、参数说明与纹理图集。

## Live2D 制作与边界

这是原创角色的首版轻量绑定。运行时使用真实 `.moc3`，由本地 Cubism Core 5.1.0 解算，PixiJS 6.5.10 与 pixi-live2d-display 0.4.0 渲染。角色并非 CSS 整图摆动，也没有使用示例角色。

模型有 5 个 ArtMesh 与 9 个参数：头部左右、点头、侧头、呼吸、发梢轻摆、目光横纵移动和双眼开合。原画主网格保留完整外观，双眼单独使用原画与闭眼补图的纹理切片。眨眼通过原生参数混合眼部补图；不是完整的眼皮、睫毛、虹膜分层精修。头发与服装未完整拆件，适合小幅互动，不提供大幅转身、手臂挥动或口型同步。没有生成 Cubism Editor 的 `.cmo3` 工程。

页面提供陪伴、眨眼、点头、歪头、眨单眼、摇头、张望、开心笑，以及暂停与重置。新增动作复用现有原生参数：眨单眼时保留另一只眼睁开；摇头组合左右轻摆、目光与发梢；张望依次看向两侧，再归还指针跟随；开心笑则闭眼、轻轻侧头。按钮分两行排列，各动作播放完自动回到陪伴，可再次点击重播；暂停时点击动作会继续播放。

目光跟随展示区域内的指针；离开区域后自然归中。页面隐藏或角色离开视口时停止渲染；系统减少动态效果时默认暂停。切换画风会释放画布、纹理和 Core 模型；失败时显示原画与重试按钮。运行时和模型均从本站加载，不需要账号或第三方请求。

## 复现模型

`scripts/mascot/build_live2d.py` 负责纹理切片、自动网格、参数关键形与图集打包。它不重绘原画；闭眼绘画修改来自 imagegen 补图。使用 Python 3.13，依赖 numpy 与 Pillow，执行 `py -3.13 scripts/mascot/build_live2d.py` 即可重新生成模型。第三方二进制写入器保留在 `scripts/mascot/vendor/`，来源、版本与许可证见 [Live2D 第三方声明](mascot-live2d-notices.md)。

## 验证

官方 Core 已成功创建模型，逐一改变全部 9 个参数，确认每个参数都改变顶点或不透明度。`npm run check`、51 个测试文件共 438 项测试（`npm test --workspace client -- --maxWorkers=2`）及 `npm run build` 通过。动作测试覆盖单眼独立开合、左右运动、极端指针输入的参数边界、动作结束归位、暂停后触发及重复播放。

生产预览验证了原画与闭眼显示、点头后回到陪伴、暂停后连续截图一致、快速切换不会留存画布、断网失败后可重新加载、390px 窄屏无横向溢出，以及减少动态效果时默认暂停。测试中无意外页面错误。模型文件存在或能加载本身不等于美术精修完成；真实手机 GPU 尚未验收。

## 图片生成方式与提示词

图片使用内置 imagegen 工具，透明背景模式。以下为保留的原画、Q 版与坨坨脸实际提示词。

### anime

Redesign the AIDraw mascot as a genuinely charming YOUTHFUL ANIME GIRL — 少女感: fresh, lively, sweet and lightly mischievous, like the heroine of an art-club slice-of-life anime.
The two supplied images show rejected extremes. Reference 1 feels too mature; reference 2 feels like a baby mascot. Use them ONLY to retain the ivory/mint/sage palette, the three-stacked-canvas beret emblem and the drawing-assistant idea. Find the youthful anime-girl sweet spot; do not copy either face/proportions.
Primary character: a pretty cheerful late-teen / young-adult anime artist girl with NORMAL anime human proportions, about six-heads-tall equivalent, shown from waist up. Soft youthful face, small short chin but NOT a wide baby dumpling face, a subtle small nose and a natural tiny cheerful smiling mouth. Clear medium-large emerald/jade anime eyes with delicate highlights and fine lash lines; expressive eyebrows, light natural blush. A fresh sparkling expression and a playful gentle head tilt. No realistic makeup, lip gloss, heavy lashes or fashion-model expression.
Hair: airy shoulder-length ivory-white hair with soft mint-green ends, a loose side braid tucked beside one cheek, wispy parted bangs and one small green-tipped paintbrush-curved forelock. Small subtle cat ears tucked into the hairstyle rather than oversized toy ears. A SMALL stylish sage-green artist beret sitting lightly on her head, with the familiar cream emblem of three offset rounded canvas cards.
Clothes: a loose cream hooded art-club cardigan with sage-green lining over a simple sage apron dress, relaxed youthful creative-studio styling, modest and wholesome, NOT a formal collared adult work shirt and NOT a toddler onesie. Normal delicate human hands rather than mittens. One hand holds a slim digital stylus near her shoulder and the other casually holds a small drawing tablet close to her waist. No skin emphasis.
Style: beautiful crisp modern 2D Japanese anime illustration, fresh light linework, soft cel-shading with refined hair detail, airy pastel light, attractive youthful 少女 aesthetic. Cute and lovely through expression and character design, not through infantilized anatomy. No 3D, no chibi, no plush-toy forms, no giant marble eyes, no huge baby forehead, no sharp mature jaw, no long face.
Use a true square 1:1 canvas, clear centered icon-friendly composition, entire head/ears/beret/hands/tablet inside frame and 8 percent transparent margins. Palette: sage green #426b50, ivory, mint, soft peach. Genuine transparent-background PNG. NO lettering, watermark, frame, decorative backdrop or collage.

### chibi

Use the provided youthful AIDraw anime artist girl as the exact identity reference. Produce her Q版 chibi avatar, around 2.8 heads tall, retaining a lovely youthful anime-girl face and personality rather than a baby or animal plush. Keep the ivory shoulder-length hair, mint tips, little side braid with sage ribbon, modest small cat ears, sage artist beret with three cream layered-canvas badge, jade anime eyes and fresh cheerful natural smile. Keep the eyes expressive but not enormous marble spheres, keep normal small human hands and natural tiny anime mouth rather than omega mouth. Cream hooded cardigan, sage apron dress, slim ivory/green stylus and small drawing tablet. Compact knee-up or full figure, lightly dynamic standing pose, pretty polished Japanese chibi game illustration, delicate clean lines, fresh soft cel shading, readable original silhouette. Preserve少女气质 even while proportions are simplified. No toddler onesie, paw mittens, enormous ears, huge doll forehead, adult makeup or seductive fashion. Single character centered, true square 1:1 icon canvas, all features fully inside frame with 8 percent padding. Transparent background alpha PNG, no floor, scenery, pedestal, lettering, watermark or collage.

### blob

Use this youthful AIDraw anime artist girl as the identity reference. Create her '坨坨脸' humorous cute face-only icon: a cheekily squished, softly rounded head with her ivory/mint bob, tiny side braid and ribbon, sage painter beret with three offset cream canvas cards, small cream cat ears, jade anime eyes. The face is a simple comic deformation of THIS少女 character, not a preschool baby or fluffy animal mascot. Half-lidded playful anime eyes, small tilted smug smile, peach blush, charming slightly sulky expression. A tiny normal hand squeezes one cheek, a slim green-tipped stylus peeks from the side. Simplified graphic 2D anime sticker, lovely controlled dark-sage linework, clean pastel flats, a few crisp soft shadows, very legible at app-icon size. No giant glass marble eyes or huge blank forehead, no infant anatomy, no plush texture. One centered head-only cutout, square 1:1 canvas, generous safe padding, all hair/ears/hat inside frame. Genuine transparent alpha PNG. No text, watermark, background, border or collage.
