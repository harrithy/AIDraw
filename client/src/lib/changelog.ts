export type ReleaseCategory = "feature" | "improvement" | "fix";

export type ReleaseItem = {
  title: string;
  description: string;
  category: ReleaseCategory;
  tag?: string;
};

export type ReleaseNote = {
  version: string;
  title: string;
  date: string;
  badge?: string;
  summary: string;
  highlights?: string[];
  items: ReleaseItem[];
};

export const RELEASE_STORAGE_KEY = "aidraw-last-seen-release";
export const RELEASE_HISTORY_STORAGE_KEY = "aidraw-release-history";
export const READ_RELEASES_STORAGE_KEY = "aidraw-read-releases-list";

/**
 * 当前代码版本内置的发布日志清单。
 * 每次代码更新迭代时，只需在数组顶部新增最新一版的 ReleaseNote。
 */
export const INITIAL_RELEASES: ReleaseNote[] = [
  {
    version: "v1.3.1",
    title: "Nano Banana 新增 Gemini 3.1 Flash Lite 选项 & 下拉排版优化",
    date: "2026-08-19",
    badge: "✨ 最新版本",
    summary:
      "Nano Banana 系列新增 gemini-3.1-flash-lite-image-preview 模型支持与计费配置；全面优化下拉选择菜单排版，长模型名称完整单行展示无换行。",
    highlights: [
      "✨ Nano Banana 系列新增 gemini-3.1-flash-lite-image-preview 高性价比图像预览模型",
      "💰 同步接入多米能力注册表与模型计费矩阵，自动计算生成预估费用",
      "📐 全局优化 Select 下拉框文字换行机制与菜单自适应宽度，确保长模型标识整洁单行显示"
    ],
    items: [
      {
        category: "feature",
        title: "新增 gemini-3.1-flash-lite-image-preview 模型支持",
        description:
          "在 NANO-BANANA 分组下新增 Gemini 3.1 Flash Lite 生图与编辑模型，适配多米 API 并提供预估价格展示。",
        tag: "模型扩展"
      },
      {
        category: "improvement",
        title: "下拉选择菜单自适应宽度与单行展示",
        description:
          "优化 SelectItem 与 model-select-content 布局，防止长模型名称在连字符处折行，确保所有选项单行整洁展示。",
        tag: "排版优化"
      }
    ]
  },
  {
    version: "v1.3.0",
    title: "版本公告中心上线 & 富媒体结果展示优化",
    date: "2026-08-18",
    summary:
      "新增可追踪的版本公告中心，支持未读提醒、历史版本查看与一键标记已读；同时优化图片和视频结果卡片，让富媒体内容获得更完整的展示空间与更直接的预览入口。",
    highlights: [
      "📣 新增版本公告中心，支持未读数量角标与首次进入自动提醒",
      "🗂️ 公告历史自动持久化，支持按版本回看并一键全部标记已读",
      "🖼️ 图片与视频结果卡片改为沉浸式展示，减少无效留白",
      "🔍 图片结果新增悬浮放大预览入口，点击即可查看大图",
      "📐 修正弹窗定位和窄屏滚动布局，提升不同窗口尺寸下的可用性"
    ],
    items: [
      {
        category: "feature",
        title: "版本公告中心与未读提醒",
        description:
          "工具栏新增更新日志入口，支持显示未读数量；部署新版本后会在新手引导结束时自动提示，避免错过重要更新。",
        tag: "版本管理"
      },
      {
        category: "feature",
        title: "历史公告持久化与一键已读",
        description:
          "公告按版本保存到本地存储，可在下拉菜单中回看历史记录，并支持将全部公告一次性标记为已读。",
        tag: "便捷操作"
      },
      {
        category: "improvement",
        title: "富媒体结果卡片沉浸式展示",
        description:
          "仅包含图片或视频的结果卡片现在会充分利用卡片空间，移除多余说明区域和边框，让生成结果更清晰。",
        tag: "视觉优化"
      },
      {
        category: "improvement",
        title: "图片悬浮放大预览",
        description:
          "图片结果增加悬浮预览按钮，点击即可打开大图预览；同时保留图片本身的点击预览交互。",
        tag: "交互优化"
      },
      {
        category: "fix",
        title: "弹窗定位与滚动边界修正",
        description:
          "统一弹窗居中定位，优化编辑弹窗和公告弹窗在窄屏、高度受限窗口中的滚动与内容边界。",
        tag: "细节修复"
      }
    ]
  },
  {
    version: "v1.2.0",
    title: "多米全能能力重构 & 蛇形网格智能排版全新上线！",
    date: "2026-08-17",
    badge: "✨ 最新版本",
    summary:
      "本次更新对多米全系模型能力界面进行了从上往下的纯净流式重构，引入了智能蛇形网格排版系统、多米 API 官方开发文档弹窗，以及全域丝滑微动效体系！",
    highlights: [
      "📐 多米能力面板从上往下垂直流式重构，控件尺寸精细化收拢",
      "🐍 蛇形网格（S形走位折行）智能排版与 4 倍舒适间距扩展",
      "📖 接口文档一键查询弹窗，集成 JS / cURL / Python 实战代码一键复制",
      "🖼️ 智能 Base64 图片拖拽选择器，自动转换与缩略预览",
      "📋 图片卡片一键复制最新图片直链，一键批量清理失败任务",
      "✨ 全域微动效：模型伸缩、Tab 胶囊弹跳、聚焦流光与物理触感反馈"
    ],
    items: [
      {
        category: "feature",
        title: "蛇形网格智能排版（S形折行排序）",
        description:
          "重置排版模板新增「蛇形网格」模式，支持自定义每行展示数量（2~6个）。第一行从左往右，第二行从右往左，极大缩短视线折返距离，并扩大了 4 倍网格间距。",
        tag: "核心特性"
      },
      {
        category: "feature",
        title: "多米能力自上而下单列流式重构",
        description:
          "彻底重构多米能力字段排版，所有表单项自顶向下单列展示，下拉选择框（200px）、数字框（130px）、单行输入框（340px）与开关胶囊全部精细化收束，告别生硬拉伸。",
        tag: "视觉升级"
      },
      {
        category: "feature",
        title: "多米 API 使用文档弹窗 & 实战代码库",
        description:
          "深度对接多米官方 Apifox 规范，新增独立文档弹窗，涵盖快速上手指南、JavaScript / cURL / Python 实战调用代码一键复制，以及全模型价格矩阵与计费 FAQ。",
        tag: "开发赋能"
      },
      {
        category: "feature",
        title: "智能 Base64 本地图片选图转换器",
        description:
          "针对 Midjourney 混图等 Base64 字段，支持直接多选本地图片，前端自动异步压缩并编码为 Base64 数组与缩略图卡片，支持一键删除与多图拖拽。",
        tag: "效率提升"
      },
      {
        category: "feature",
        title: "图片卡片工具栏复制最新图片链接 & 一键清理失败任务",
        description:
          "图片盒子工具栏新增复制图标，一键复制当前盒子最新生成的图片或视频直链；画布工具栏支持一键检测并清理所有失败任务卡片。",
        tag: "便捷操作"
      },
      {
        category: "improvement",
        title: "全流程伸缩与微动效体系",
        description:
          "模型切换时带有平滑淡入伸缩（@keyframes capability-switch-in），分类 Tab、选择器、图片上传框与提交按钮均配备 Apple 级弹性阻尼触感。",
        tag: "体验优化"
      },
      {
        category: "fix",
        title: "浅色模式弹层对比度与小红星前置标注",
        description:
          "修复浅色主题下排版弹窗文字看不清的对比度问题；必填小红星 * 统一紧凑前置在标题左侧，解决多余换行拉伸间隙。",
        tag: "细节修复"
      }
    ]
  },
  {
    version: "v1.1.0",
    title: "多模型矩阵升级 & 画布智能排版模板",
    date: "2026-08-10",
    summary:
      "引入了灵活的画布自动排版系统，全面升级了 Kling 价格动态计算与 Nano-Banana 2.0 模型支持。",
    items: [
      {
        category: "feature",
        title: "画布一键重置排版模板",
        description: "支持从左往右流水线排序与从上往下单列纵向排序，自动保持舒适固定的盒子间距。",
        tag: "排版"
      },
      {
        category: "feature",
        title: "Kling 动态计费与模型升级",
        description: "支持 Kling-v1 ~ Kling-v3、声音开关、模式与时长的多维度实时价格估算。",
        tag: "模型"
      },
      {
        category: "improvement",
        title: "深浅双色主题深度打磨",
        description: "全局色彩采用 HSL 精准调色，支持系统级暗黑模式与明亮模式无缝切换。",
        tag: "主题"
      }
    ]
  },
  {
    version: "v1.0.0",
    title: "AIDraw 赛博画布初版发布！",
    date: "2026-08-01",
    summary:
      "支持无限视界节点流画布、多文件夹管理、高并发异步生成队列与多供应商直连调用。",
    items: [
      {
        category: "feature",
        title: "无限节点流画布",
        description: "支持画布平移、缩放、卡片拖拽、提示词继承与分支重试生成。",
        tag: "画布"
      },
      {
        category: "feature",
        title: "多渠道模型聚合调度",
        description: "原生支持 GPT Image 2、Nano Banana、Midjourney、Kling 等主流 AI 绘图与视频模型。",
        tag: "核心"
      }
    ]
  }
];

export const LATEST_RELEASE = INITIAL_RELEASES[0];

/** 从本地存储获取历史累积的所有公告 */
export const getStoredReleases = (): ReleaseNote[] => {
  try {
    const raw = window.localStorage.getItem(RELEASE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * 自动将代码中的新版本公告与本地持久化历史公告合并同步，
 * 并持久化存储到本地，确保每次部署新版本代码时历史公告永久累积保存。
 */
export const syncAndGetAllReleases = (): ReleaseNote[] => {
  const stored = getStoredReleases();
  const releaseMap = new Map<string, ReleaseNote>();

  // 1. 先注入代码中定义的版本记录（最新代码定义的拥有最新内容）
  for (const rel of INITIAL_RELEASES) {
    releaseMap.set(rel.version, rel);
  }

  // 2. 再将本地存储的历史记录合并进来（若本地存有更早的旧版本则予以保留）
  for (const rel of stored) {
    if (!releaseMap.has(rel.version)) {
      releaseMap.set(rel.version, rel);
    }
  }

  const allReleases = Array.from(releaseMap.values());

  // 3. 将合并后的完整发布历史同步回 localStorage
  try {
    window.localStorage.setItem(RELEASE_HISTORY_STORAGE_KEY, JSON.stringify(allReleases));
  } catch (error) {
    console.error("持久化保存发布历史失败:", error);
  }

  return allReleases;
};

/** 获取所有已读版本的列表 */
export const getReadVersions = (): string[] => {
  try {
    const raw = window.localStorage.getItem(READ_RELEASES_STORAGE_KEY);
    const readList: string[] = raw ? JSON.parse(raw) : [];
    // 向前兼容单个 last-seen-release
    const legacy = window.localStorage.getItem(RELEASE_STORAGE_KEY);
    if (legacy && !readList.includes(legacy)) {
      readList.push(legacy);
    }
    return Array.isArray(readList) ? readList : [];
  } catch {
    return [];
  }
};

/** 检查某个具体版本是否已读 */
export const isReleaseRead = (version: string): boolean => {
  const readList = getReadVersions();
  return readList.includes(version);
};

/** 获取当前未读的公告版本数量 */
export const getUnreadReleasesCount = (): number => {
  const all = syncAndGetAllReleases();
  const readList = getReadVersions();
  return all.filter((r) => !readList.includes(r.version)).length;
};

/** 检查是否存在未读的更新公告 */
export const checkHasUnreadRelease = (): boolean => {
  return getUnreadReleasesCount() > 0;
};

/** 将指定版本标记为已读 */
export const markReleaseAsRead = (version = LATEST_RELEASE.version): void => {
  try {
    const readList = getReadVersions();
    if (!readList.includes(version)) {
      readList.push(version);
      window.localStorage.setItem(READ_RELEASES_STORAGE_KEY, JSON.stringify(readList));
    }
    window.localStorage.setItem(RELEASE_STORAGE_KEY, version);
  } catch (error) {
    console.error("保存版本已读状态失败:", error);
  }
};

/** 一键已读：将所有历史和当前公告标记为已读 */
export const markAllReleasesAsRead = (): void => {
  try {
    const all = syncAndGetAllReleases();
    const allVersions = all.map((r) => r.version);
    window.localStorage.setItem(READ_RELEASES_STORAGE_KEY, JSON.stringify(allVersions));
    window.localStorage.setItem(RELEASE_STORAGE_KEY, LATEST_RELEASE.version);
  } catch (error) {
    console.error("一键已读失败:", error);
  }
};
