# 🎨 AIDraw — AI 作画ワークフロー

[![English Docs](https://img.shields.io/badge/Docs-English-blue?style=flat-square)](./README.md)
[![中文文档](https://img.shields.io/badge/文档-中文-orange?style=flat-square)](./README_zh-CN.md)

ブラウザベースの AI 作画ワークフローマネージャーです。Text-to-Image / Image-to-Image の2つの生成モードに対応し、フォルダ単位で作画タスクを整理、ズーム＆パン可能なキャンバス上で生成結果を直感的に表示します。

> **お試し**：デプロイ後、ブラウザから直接アクセス可能。クライアントのインストールは不要です。

---

## ✨ 機能

- **📁 フォルダワークスペース** — テーマ別にフォルダを作成（キャラクターデザイン、背景、スタンプなど）。各フォルダに独立したキャンバスを提供
- **🖼️ 2つの生成モード** — Text-to-Image と Image-to-Image に対応。ローカル画像をドラッグ＆ドロップまたは貼り付けて参照画像に
- **📋 タスクキュー管理** — 最大10件の同時実行、非同期ステータスの自動ポーリング、失敗タスクのリトライ
- **🗺️ 無限キャンバス** — ズーム＆パン可能。タスクカードのドラッグで並び替え。キャンバス状態は自動保存
- **🌓 ダークモード** — ライト / ダークテーマの切り替え。設定は自動保存
- **🔌 柔軟な API 設定** — ビジュアル API 設定パネル。OpenAI Images 互換の任意のサービスに対応（デフォルト：多米 API `gpt-image-2`）
- **📱 レスポンシブレイアウト** — デスクトップ・モバイル対応。左サイドバーは折りたたみ可能
- **✨ スムーズなアニメーション** — GSAP によるページ遷移とインタラクション効果
- **💾 ローカル永続化** — IndexedDB ベースのオフラインストレージ。全タスク・フォルダデータはブラウザ内に保存
- **🚀 ワンクリックデプロイ** — Vercel 向け設定済み。SPA ルートリライト対応

---

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|----------|------|
| **フレームワーク** | React 19 |
| **型システム** | TypeScript 5.9（strict モード） |
| **ビルドツール** | Vite 7 |
| **CSS** | Tailwind CSS v4 |
| **コンポーネントライブラリ** | shadcn/ui + Radix UI |
| **アニメーション** | GSAP 3 + `@gsap/react` |
| **アイコン** | Lucide React |
| **データストレージ** | IndexedDB（ブラウザローカル） |
| **デプロイ** | Vercel |

---

## 📂 プロジェクト構成

```
AIDraw/
├── client/                     # フロントエンドアプリ（React + Vite）
│   ├── public/
│   │   ├── favicon.png         # ファビコン
│   │   └── logo.png            # ブランドロゴ
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/         # キャンバス関連コンポーネント
│   │   │   │   ├── EmptyCanvas.tsx       # 空キャンバスのプレースホルダー
│   │   │   │   ├── JobCard.tsx           # ジョブカード
│   │   │   │   ├── WorkflowCanvas.tsx    # メインキャンバス
│   │   │   │   └── WorkflowLinks.tsx     # カード接続線
│   │   │   ├── layout/         # レイアウトコンポーネント
│   │   │   │   ├── CanvasToolbar.tsx     # キャンバスツールバー
│   │   │   │   └── LeftSidebar.tsx       # 左フォルダパネル
│   │   │   ├── modals/         # モーダルダイアログ
│   │   │   │   ├── ApiSettingsDialog.tsx # API 設定ダイアログ
│   │   │   │   ├── ImagePreview.tsx      # 画像プレビュー
│   │   │   │   └── OnboardingGuide.tsx   # オンボーディングガイド
│   │   │   ├── panels/         # パネルコンポーネント
│   │   │   │   ├── ApiSettingsPanel.tsx  # API 設定パネル
│   │   │   │   └── CreateJobPanel.tsx    # ジョブ作成パネル
│   │   │   └── ui/             # 共通 UI コンポーネント（shadcn/ui スタイル）
│   │   ├── hooks/              # カスタムフック
│   │   │   ├── useAppAnimations.ts       # アプリレベルアニメーション
│   │   │   ├── useCanvasInteractions.ts  # キャンバス操作ロジック
│   │   │   └── useModalTransition.ts     # モーダル遷移アニメーション
│   │   ├── lib/                # ユーティリティライブラリ
│   │   │   ├── canvas.ts       # キャンバスレイアウト計算
│   │   │   ├── download.ts     # 画像ダウンロード
│   │   │   ├── format.ts       # 日付フォーマット
│   │   │   ├── jobImages.ts    # ジョブ画像処理
│   │   │   ├── jobLabels.ts    # ジョブラベル
│   │   │   ├── motion.ts       # アニメーションユーティリティ
│   │   │   └── utils.ts        # 汎用ユーティリティ
│   │   ├── types/              # 型定義
│   │   │   └── ui.ts           # UI 関連の型
│   │   ├── api.ts              # API レイヤー（データ保存 + 画像生成）
│   │   ├── App.tsx             # ルートコンポーネント
│   │   ├── main.tsx            # エントリーポイント
│   │   ├── styles.css          # グローバルスタイル + Tailwind
│   │   └── types.ts            # コア型定義
│   ├── index.html              # HTML エントリー
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts          # Vite 設定（プロキシ + パスエイリアス）
│   └── vercel.json             # Vercel デプロイ設定
├── server/                     # サーバー（予約、静的ファイルストレージ）
│   └── data/
│       └── uploads/            # アップロードディレクトリ
├── package.json                # ルート monorepo 設定
├── vercel.json                 # ルート Vercel 設定
├── AI绘图工作流制作流程.md       # 製品設計ドキュメント（中国語）
└── API接入说明.md               # API 統合ガイド（中国語）
```

---

## 🚀 クイックスタート

### 前提条件

- **Node.js** >= 18
- **npm** >= 9（npm workspaces を使用）

### ローカル開発

```bash
# 1. リポジトリをクローン
git clone <your-repo-url>
cd AIDraw

# 2. 依存関係をインストール
npm install

# 3. 開発サーバーを起動
npm run dev
```

開発サーバーはデフォルトで `http://127.0.0.1:5173` で起動します。

### 本番ビルド

```bash
npm run build
```

ビルド成果物は `client/dist/` に出力されます。

### 型チェック

```bash
npm run check
```

---

## 🔧 設定

### API 連携

プロジェクトはデフォルトで **多米 API**（`gpt-image-2` モデル）に最適化されており、OpenAI Images API 仕様と互換性があります。利用手順：

1. アプリを開き、右上の **⚙️ 設定** ボタンをクリック
2. API 設定を入力：
   - **Base URL**：API サービスアドレス（例：`https://duomiapi.com`）
   - **Model**：モデル名（例：`gpt-image-2`）
   - **API Key**：API キー
3. 保存をクリックして作画を開始

> **API Key 未設定時**は、システムがローカルのプレースホルダー画像を使用します（開発・テスト用）。

### 画像アップロード

Image-to-Image モードでローカル画像を貼り付けまたはドラッグ＆ドロップすると、画像はまず画像ホスティングサービス（`image.harrio.xyz`）にアップロードされ、生成された公開 URL が作画 API に送信されます。ローカル開発時は Vite がアップロードリクエストをプロキシ転送し、本番環境では Vercel の rewrites で処理します。

### 対応画像サイズ

| 固定サイズ | アスペクト比 |
|------------|-------------|
| `auto`、`1024x1024`、`1792x1024`、`1024x1792` | `1:1`、`3:2`、`2:3`、`16:9`、`9:16`、`1:2`、`2:1`、`4:3`、`3:4`、`5:4`、`4:5` |

カスタムサイズも対応（形式 `幅x高さ`、例：`800x600`）。幅と高さはともに 16 で割り切れる必要があります。

---

## 🚢 デプロイ

### Vercel（推奨）

プロジェクトは Vercel 向けに設定済みです。ワンクリックでデプロイ：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

または CLI で：

```bash
npx vercel --prod
```

主要設定：
- **Build Command**：`npm run build`
- **Output Directory**：`client/dist`
- **Install Command**：`npm install`

### その他のプラットフォーム

純粋なフロントエンド SPA のため、任意の静的ホスティングプラットフォーム（Netlify、Cloudflare Pages、GitHub Pages など）にデプロイ可能です。SPA フォールバックルーティング（全パス → `index.html`）と `/image-upload/` プロキシ転送の設定が必要です。

---

## 📖 ユーザーガイド

### 1. フォルダを作成

左パネルにフォルダ名を入力し、➕ をクリックして作成。「キャラクターデザイン」「背景」「スタンプ」などのテーマ別に分類することをおすすめします。

### 2. 作画ジョブを作成

フォルダを選択し、キャンバス上の **新規作画** ボタンをクリック：

- **Text-to-Image**：プロンプトを入力。必要に応じてネガティブプロンプト、サイズ、生成枚数を設定
- **Image-to-Image**：参照画像をアップロード/貼り付け、ノイズ除去強度を設定し、プロンプトを入力

### 3. ジョブの表示と管理

- ジョブカードがキャンバスに表示されます — **ドラッグ**で位置を調整
- カード上の ⬅️➡️ ボタンで並び替え
- 完了したジョブは**フルサイズプレビュー**、**ダウンロード**、または**新しいジョブの参照画像として使用**可能
- 失敗したジョブは 🔄 でリトライ

### 4. キャンバス操作

- **スクロールホイール**：キャンバスをズーム
- **空白領域をドラッグ**：キャンバスをパン
- キャンバス状態（ズーム、位置）は自動保存

---

## 🤝 コントリビューション

Issue や Pull Request を歓迎します！提出前に型チェックが通過することを確認してください：

```bash
npm run check
```

---

## 📄 ライセンス

[MIT](LICENSE)

---

<p align="center">
  <sub>Made with ❤️ and 🐱</sub>
</p>
