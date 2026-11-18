/** 同一原创角色的四种表现，原图保留透明通道，供头像和项目图标使用。 */
export const MASCOT_VARIANTS = [
  {
    id: "anime",
    number: "01",
    label: "少女 · 2D",
    english: "THE ORIGINAL",
    title: "把灵感，轻轻画出来。",
    description: "清亮的绿瞳、轻盈的侧辫和一支数位笔。她是陪你探索无限画布的绘画少女。",
    detail: "精致的 2D 插画，适合品牌展示、项目介绍与个人头像。",
    source: "/mascot/aidraw-girl-2d-v1.png",
    accent: "sage"
  },
  {
    id: "chibi",
    number: "02",
    label: "Q 版",
    english: "LITTLE COMPANION",
    title: "小小一只，装着大大的灵感。",
    description: "把少女的神情收进轻巧的 Q 版比例，画师帽、侧辫和画笔依然一眼可认。",
    detail: "轻巧的角色形象，适合项目头像、小尺寸展示与可爱贴纸。",
    source: "/mascot/aidraw-girl-chibi-v1.png",
    accent: "cream"
  },
  {
    id: "face",
    number: "03",
    label: "坨坨脸",
    english: "A LITTLE EXPRESSION",
    title: "今天，也有一点小得意。",
    description: "软软的脸颊和俏皮的表情，把绘画少女变成一枚有辨识度的小头像。",
    detail: "轮廓集中、表情清晰，适合图标、聊天头像与表情贴纸。",
    source: "/mascot/aidraw-girl-face-v1.png",
    accent: "peach"
  },
  {
    id: "live2d",
    number: "04",
    label: "Live2D",
    english: "DRAWN TO LIFE",
    title: "让画里的她，轻轻回应你。",
    description: "保留原创绘画少女的笔触与神情，用 Live2D 呈现细腻的呼吸、眨眼和目光互动。",
    detail: "Live2D 沿用同一位原创少女，下方展示她的透明立绘图标。",
    source: "/mascot/aidraw-girl-2d-v1.png",
    accent: "mist"
  }
] as const;

export type MascotVariant = (typeof MASCOT_VARIANTS)[number];
