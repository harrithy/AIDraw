# 🎨 AIDraw — AI 绘图工作流

[![English Docs](https://img.shields.io/badge/Docs-English-blue?style=flat-square)](./README.md)
[![日本語](https://img.shields.io/badge/ドキュメント-日本語-red?style=flat-square)](./README_ja.md)

一个基于浏览器的 AI 绘图工作流管理器，支持文生图 / 图生图两种模式，以文件夹为单位组织绘图任务，在可缩放画布上直观展示生成结果。

> **体验地址**：部署后通过浏览器直接访问，无需安装任何客户端。

---

## ✨ 功能特性

- **📁 文件夹工作区** — 按主题创建文件夹（人物设定、背景图、表情包等），每个文件夹拥有独立的画布
- **🖼️ 双模式绘图** — 支持文生图（Text-to-Image）和图生图（Image-to-Image），可拖拽 / 粘贴本地图片作为参考图
- **📋 任务队列管理** — 最多 10 个任务并发，自动轮询异步任务状态，支持重试失败任务
- **🗺️ 无限画布** — 可缩放、平移的画布，任务卡片支持拖拽排序，画布状态自动保存
- **🌓 深色模式** — 支持浅色 / 深色主题切换，偏好自动持久化
- **🔌 灵活 API 配置** — 可视化的 API 设置面板，支持任意兼容 OpenAI Images 接口的服务（默认适配多米 API `gpt-image-2`）
- **📱 响应式布局** — 适配桌面和移动端，左侧面板可折叠
- **✨ 丝滑动效** — 基于 GSAP 的页面过渡与交互动画
- **💾 本地持久化** — 基于 IndexedDB 的离线数据存储，所有任务和文件夹数据保存在浏览器本地
- **🚀 一键部署** — 已配置 Vercel 部署，支持 SPA 路由重写

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | React 19 |
| **类型系统** | TypeScript 5.9（严格模式） |
| **构建工具** | Vite 7 |
| **CSS 方案** | Tailwind CSS v4 |
| **组件库** | shadcn/ui + Radix UI |
| **动画库** | GSAP 3 + `@gsap/react` |
| **图标库** | Lucide React |
| **数据存储** | IndexedDB（浏览器本地） |
| **部署平台** | Vercel |

---

## 📂 项目结构

```
AIDraw/
├── client/                     # 前端应用（React + Vite）
│   ├── public/
│   │   ├── favicon.png         # 网站图标
│   │   └── logo.png            # 品牌 Logo
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/         # 画布相关组件
│   │   │   │   ├── EmptyCanvas.tsx       # 空画布占位
│   │   │   │   ├── JobCard.tsx           # 任务卡片
│   │   │   │   ├── WorkflowCanvas.tsx    # 画布主组件
│   │   │   │   └── WorkflowLinks.tsx     # 卡片连接线
│   │   │   ├── layout/         # 布局组件
│   │   │   │   ├── CanvasToolbar.tsx     # 画布工具栏
│   │   │   │   └── LeftSidebar.tsx       # 左侧文件夹面板
│   │   │   ├── modals/         # 弹窗组件
│   │   │   │   ├── ApiSettingsDialog.tsx # API 设置弹窗
│   │   │   │   ├── ImagePreview.tsx      # 图片预览
│   │   │   │   └── OnboardingGuide.tsx   # 新手引导
│   │   │   ├── panels/         # 面板组件
│   │   │   │   ├── ApiSettingsPanel.tsx  # API 设置面板
│   │   │   │   └── CreateJobPanel.tsx    # 创建任务面板
│   │   │   └── ui/             # 通用 UI 组件（shadcn/ui 风格）
│   │   ├── hooks/              # 自定义 Hooks
│   │   │   ├── useAppAnimations.ts       # 应用级动画
│   │   │   ├── useCanvasInteractions.ts  # 画布交互逻辑
│   │   │   └── useModalTransition.ts     # 弹窗过渡动画
│   │   ├── lib/                # 工具函数库
│   │   │   ├── canvas.ts       # 画布布局计算
│   │   │   ├── download.ts     # 图片下载
│   │   │   ├── format.ts       # 日期格式化
│   │   │   ├── jobImages.ts    # 任务图片处理
│   │   │   ├── jobLabels.ts    # 任务标签
│   │   │   ├── motion.ts       # 动画工具
│   │   │   └── utils.ts        # 通用工具
│   │   ├── types/              # 类型定义
│   │   │   └── ui.ts           # UI 相关类型
│   │   ├── api.ts              # API 层（数据存储 + 绘图接口调用）
│   │   ├── App.tsx             # 根组件
│   │   ├── main.tsx            # 入口文件
│   │   ├── styles.css          # 全局样式 + Tailwind
│   │   └── types.ts            # 核心类型定义
│   ├── index.html              # HTML 入口
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts          # Vite 配置（含代理 + 路径别名）
│   └── vercel.json             # Vercel 部署配置
├── server/                     # 服务端（预留，当前为静态文件存储）
│   └── data/
│       └── uploads/            # 上传文件目录
├── package.json                # 根 monorepo 配置
├── vercel.json                 # 根级 Vercel 配置
├── AI绘图工作流制作流程.md       # 产品设计文档
└── API接入说明.md               # API 接入技术文档
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9（项目使用 npm workspaces）

### 本地开发

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd AIDraw

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

开发服务器默认运行在 `http://127.0.0.1:5173`。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `client/dist/`。

### 类型检查

```bash
npm run check
```

---

## 🔧 配置说明

### API 接入

项目默认适配 **多米 API**（`gpt-image-2` 模型），兼容 OpenAI Images 接口规范。使用步骤：

1. 打开应用，点击右上角 **⚙️ 设置** 按钮
2. 填写 API 配置：
   - **Base URL**：API 服务地址，如 `https://duomiapi.com`
   - **Model**：模型名称，如 `gpt-image-2`
   - **API Key**：你的 API 密钥
3. 点击保存即可开始绘图

> **未配置 API Key 时**，系统使用本地模拟图片，方便开发调试。

### 图片上传

图生图模式下粘贴或拖拽本地图片时，图片会先上传到图床（`image.harrio.xyz`），再将公网 URL 发送给绘图 API。本地开发时 Vite 已配置代理转发，生产环境通过 Vercel rewrites 处理。

### 支持的图片尺寸

| 固定尺寸 | 宽高比 |
|----------|--------|
| `auto`、`1024x1024`、`1792x1024`、`1024x1792` | `1:1`、`3:2`、`2:3`、`16:9`、`9:16`、`1:2`、`2:1`、`4:3`、`3:4`、`5:4`、`4:5` |

也支持自定义尺寸（格式 `宽x高`，如 `800x600`），要求宽高均可被 16 整除。

---

## 🚢 部署

### Vercel 部署（推荐）

项目已配置好 Vercel 部署文件，一键导入即可：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

或通过 CLI：

```bash
npx vercel --prod
```

关键配置项：

- **Build Command**：`npm run build`
- **Output Directory**：`client/dist`
- **Install Command**：`npm install`

### 其他平台

由于项目是纯前端 SPA，可部署到任何支持静态文件的平台（Netlify、Cloudflare Pages、GitHub Pages 等）。注意需要配置 SPA 路由回退（所有路径指向 `index.html`）以及 `/image-upload/` 代理转发。

---

## 📖 使用指南

### 1. 创建文件夹

在左侧面板输入文件夹名称，点击 ➕ 创建。建议按主题分类，如"人物设定"、"背景图"、"表情包"。

### 2. 新建绘图任务

选中文件夹后，点击画布中的 **新建绘图** 按钮：

- **文生图**：输入提示词（Prompt），可选填反向提示词、选择尺寸和生成数量
- **图生图**：上传 / 粘贴参考图，设置重绘强度，输入提示词

### 3. 查看与管理任务

- 任务卡片显示在画布中，**拖拽**可调整位置
- 点击卡片上的 ⬅️➡️ 按钮可排序
- 已完成的任务可**点击预览大图**、**下载**或**用作新任务的参考图**
- 失败的任务可点击 🔄 重试

### 4. 画布操作

- **滚轮**：缩放画布
- **拖拽空白区域**：平移画布
- 画布状态（缩放、位置）自动保存

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！在提交代码前请确保通过类型检查：

```bash
npm run check
```

---

## 📄 许可证

[MIT](LICENSE)

---

<p align="center">
  <sub>Made with ❤️ and 🐱</sub>
</p>
