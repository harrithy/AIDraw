# 🎨 AIDraw — AI Drawing Workflow

[![中文文档](https://img.shields.io/badge/文档-中文-orange?style=flat-square)](./README_zh-CN.md)
[![日本語](https://img.shields.io/badge/ドキュメント-日本語-red?style=flat-square)](./README_ja.md)

A browser-based AI drawing workflow manager supporting Text-to-Image and Image-to-Image generation modes. Organize tasks by folders and visualize results on a zoomable, pannable canvas.

> **Try it out**: Access directly in your browser after deployment — no client installation needed.

---

## ✨ Features

- **📁 Folder Workspaces** — Create folders by theme (character designs, backgrounds, stickers, etc.), each with its own independent canvas
- **🖼️ Dual Generation Modes** — Supports Text-to-Image and Image-to-Image. Drag-and-drop or paste local images as references
- **📋 Task Queue Management** — Up to 10 concurrent jobs with automatic async status polling and retry for failed tasks
- **🗺️ Infinite Canvas** — Zoomable and pannable canvas with drag-to-reorder task cards; canvas state is auto-saved
- **🌓 Dark Mode** — Toggle between light and dark themes with persistent preference
- **🔌 Flexible API Configuration** — Visual API settings panel compatible with any OpenAI Images-compatible service (defaults to Duomi API `gpt-image-2`)
- **📱 Responsive Layout** — Adapts to desktop and mobile; collapsible left sidebar
- **✨ Smooth Animations** — GSAP-powered page transitions and interaction effects
- **💾 Local Persistence** — IndexedDB-based offline storage; all tasks and folder data live in the browser
- **🚀 One-Click Deploy** — Pre-configured for Vercel with SPA route rewrites

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-------------|
| **Framework** | React 19 |
| **Type System** | TypeScript 5.9 (strict mode) |
| **Build Tool** | Vite 7 |
| **CSS** | Tailwind CSS v4 |
| **Component Library** | shadcn/ui + Radix UI |
| **Animation** | GSAP 3 + `@gsap/react` |
| **Icons** | Lucide React |
| **Data Storage** | IndexedDB (browser-local) |
| **Deployment** | Vercel |

---

## 📂 Project Structure

```
AIDraw/
├── client/                     # Frontend app (React + Vite)
│   ├── public/
│   │   ├── favicon.png         # Favicon
│   │   └── logo.png            # Brand logo
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/         # Canvas components
│   │   │   │   ├── EmptyCanvas.tsx       # Empty canvas placeholder
│   │   │   │   ├── JobCard.tsx           # Job card
│   │   │   │   ├── WorkflowCanvas.tsx    # Main canvas
│   │   │   │   └── WorkflowLinks.tsx     # Card connector lines
│   │   │   ├── layout/         # Layout components
│   │   │   │   ├── CanvasToolbar.tsx     # Canvas toolbar
│   │   │   │   └── LeftSidebar.tsx       # Left folder panel
│   │   │   ├── modals/         # Modal dialogs
│   │   │   │   ├── ApiSettingsDialog.tsx # API settings dialog
│   │   │   │   ├── ImagePreview.tsx      # Image preview
│   │   │   │   └── OnboardingGuide.tsx   # Onboarding guide
│   │   │   ├── panels/         # Panel components
│   │   │   │   ├── ApiSettingsPanel.tsx  # API settings panel
│   │   │   │   └── CreateJobPanel.tsx    # Create job panel
│   │   │   └── ui/             # Shared UI components (shadcn/ui style)
│   │   ├── hooks/              # Custom Hooks
│   │   │   ├── useAppAnimations.ts       # App-level animations
│   │   │   ├── useCanvasInteractions.ts  # Canvas interaction logic
│   │   │   └── useModalTransition.ts     # Modal transition animations
│   │   ├── lib/                # Utility libraries
│   │   │   ├── canvas.ts       # Canvas layout calculations
│   │   │   ├── download.ts     # Image download helpers
│   │   │   ├── format.ts       # Date formatting
│   │   │   ├── jobImages.ts    # Job image processing
│   │   │   ├── jobLabels.ts    # Job label helpers
│   │   │   ├── motion.ts       # Animation utilities
│   │   │   └── utils.ts        # General utilities
│   │   ├── types/              # Type definitions
│   │   │   └── ui.ts           # UI-related types
│   │   ├── api.ts              # API layer (data storage + image generation)
│   │   ├── App.tsx             # Root component
│   │   ├── main.tsx            # Entry point
│   │   ├── styles.css          # Global styles + Tailwind
│   │   └── types.ts            # Core type definitions
│   ├── index.html              # HTML entry
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts          # Vite config (proxy + path aliases)
│   └── vercel.json             # Vercel deployment config
├── server/                     # Server (reserved; static file storage)
│   └── data/
│       └── uploads/            # Upload directory
├── package.json                # Root monorepo config
├── vercel.json                 # Root Vercel config
├── AI绘图工作流制作流程.md       # Product design doc (Chinese)
└── API接入说明.md               # API integration guide (Chinese)
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9 (project uses npm workspaces)

### Local Development

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd AIDraw

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

The dev server runs at `http://127.0.0.1:5173` by default.

### Production Build

```bash
npm run build
```

Output is generated in `client/dist/`.

### Type Check

```bash
npm run check
```

---

## 🔧 Configuration

### API Integration

The project defaults to the **Duomi API** (`gpt-image-2` model) and is compatible with the OpenAI Images API specification. To get started:

1. Open the app and click the **⚙️ Settings** button in the top-right corner
2. Fill in the API configuration:
   - **Base URL**: API service address, e.g. `https://duomiapi.com`
   - **Model**: Model name, e.g. `gpt-image-2`
   - **API Key**: Your API key
3. Click save and start generating images

> **Without an API Key**, the system uses local placeholder images for development and testing.

### Image Upload

In Image-to-Image mode, when you paste or drag-and-drop a local image, it is first uploaded to an image hosting service (`image.harrio.xyz`), and the resulting public URL is sent to the drawing API. In local development, Vite proxies the upload request; in production, Vercel rewrites handle it.

### Supported Image Sizes

| Fixed Sizes | Aspect Ratios |
|-------------|---------------|
| `auto`, `1024x1024`, `1792x1024`, `1024x1792` | `1:1`, `3:2`, `2:3`, `16:9`, `9:16`, `1:2`, `2:1`, `4:3`, `3:4`, `5:4`, `4:5` |

Custom sizes are also supported (format `WxH`, e.g. `800x600`). Both width and height must be divisible by 16.

---

## 🚢 Deployment

### Vercel (Recommended)

The project is pre-configured for Vercel. Deploy with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Or via the CLI:

```bash
npx vercel --prod
```

Key configuration:
- **Build Command**: `npm run build`
- **Output Directory**: `client/dist`
- **Install Command**: `npm install`

### Other Platforms

Since this is a pure frontend SPA, it can be deployed to any static hosting platform (Netlify, Cloudflare Pages, GitHub Pages, etc.). Make sure to configure SPA fallback routing (all paths → `index.html`) and the `/image-upload/` proxy forwarding.

---

## 📖 User Guide

### 1. Create a Folder

Enter a folder name in the left panel and click ➕ to create. It's recommended to categorize by theme, e.g. "Character Designs", "Backgrounds", "Stickers".

### 2. Create a Drawing Job

Select a folder, then click the **New Drawing** button on the canvas:

- **Text-to-Image**: Enter a prompt, optionally add a negative prompt, choose size and generation count
- **Image-to-Image**: Upload/paste a reference image, set the denoising strength, and enter a prompt

### 3. View & Manage Jobs

- Job cards appear on the canvas — **drag** to reposition
- Click the ⬅️➡️ buttons on a card to reorder
- Completed jobs can be **previewed full-size**, **downloaded**, or **used as a reference** for new jobs
- Failed jobs can be retried with 🔄

### 4. Canvas Controls

- **Scroll wheel**: Zoom the canvas
- **Drag empty space**: Pan the canvas
- Canvas state (zoom, position) is automatically saved

---

## 🤝 Contributing

Issues and Pull Requests are welcome! Please ensure the type check passes before submitting:

```bash
npm run check
```

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">
  <sub>Made with ❤️ and 🐱</sub>
</p>
