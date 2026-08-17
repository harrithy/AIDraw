import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Coins,
  Copy,
  Cpu,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Music,
  Play,
  Radio,
  Sparkles,
  Terminal,
  Video,
  Wrench,
  Zap
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";

type DocTab = "quickstart" | "examples" | "images" | "videos" | "audio" | "pricing";
type CodeLang = "curl" | "javascript" | "python";

type DuomiApiDocDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DuomiApiDocDialog({ open, onOpenChange }: DuomiApiDocDialogProps) {
  const [activeTab, setActiveTab] = useState<DocTab>("quickstart");
  const [activeLang, setActiveLang] = useState<CodeLang>("javascript");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="duomi-doc-dialog max-w-4xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* 顶部 Header */}
        <div className="duomi-doc-header p-5 pr-14 border-b border-[var(--line)] bg-[var(--subtle)] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--green)] flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <BookOpen size={22} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                多米 API 接口使用文档与指引
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--green)]/10 text-[var(--green)] font-semibold">
                  v2.0 官方规范
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--muted)] mt-0.5">
                基于多米 API 多模态生成模型聚合平台接口规范，覆盖图像、视频、音频全栈能力与实战调用示例
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 font-medium ml-auto sm:ml-0"
            onClick={() => window.open("https://s.apifox.cn/b924931e-29c0-4127-b025-d68c90285060", "_blank", "noopener,noreferrer")}
          >
            <span>Apifox 在线文档</span>
            <ExternalLink size={13} />
          </Button>
        </div>

        {/* 主体左右分栏布局 */}
        <div className="duomi-doc-body flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* 左侧导航 Tab 栏 */}
          <nav className="duomi-doc-nav w-full md:w-56 p-3 border-r border-[var(--line)] bg-[var(--panel-strong)] flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto flex-shrink-0">
            <button
              type="button"
              className={`duomi-doc-nav-item ${activeTab === "quickstart" ? "active" : ""}`}
              onClick={() => setActiveTab("quickstart")}
            >
              <Zap size={16} />
              <span>快速开发上手</span>
            </button>
            <button
              type="button"
              className={`duomi-doc-nav-item ${activeTab === "examples" ? "active" : ""}`}
              onClick={() => setActiveTab("examples")}
            >
              <Lightbulb size={16} />
              <span>实战使用示例 ⭐</span>
            </button>
            <button
              type="button"
              className={`duomi-doc-nav-item ${activeTab === "images" ? "active" : ""}`}
              onClick={() => setActiveTab("images")}
            >
              <ImageIcon size={16} />
              <span>图像系列 (MJ / Nano)</span>
            </button>
            <button
              type="button"
              className={`duomi-doc-nav-item ${activeTab === "videos" ? "active" : ""}`}
              onClick={() => setActiveTab("videos")}
            >
              <Video size={16} />
              <span>视频系列 (Kling / Seed)</span>
            </button>
            <button
              type="button"
              className={`duomi-doc-nav-item ${activeTab === "audio" ? "active" : ""}`}
              onClick={() => setActiveTab("audio")}
            >
              <Music size={16} />
              <span>音乐音频 (Suno AI)</span>
            </button>
            <button
              type="button"
              className={`duomi-doc-nav-item ${activeTab === "pricing" ? "active" : ""}`}
              onClick={() => setActiveTab("pricing")}
            >
              <Coins size={16} />
              <span>计费与常见问题</span>
            </button>
          </nav>

          {/* 右侧内容详情区 */}
          <div className="duomi-doc-content flex-1 p-6 overflow-y-auto space-y-6">
            {/* 1. 快速上手 */}
            {activeTab === "quickstart" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <section>
                  <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-2">
                    <Sparkles className="text-[var(--green)]" size={18} />
                    平台简介与异步工作机制
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    多米 API 采用统一的<strong>「异步任务派发 + 轮询查询 / Webhook 回调」</strong>架构。绝大部分高负荷生成任务（如 Midjourney 混图、可灵视频、Suno 音乐）在提交后会立即返回任务 ID (<code className="px-1 py-0.5 rounded bg-[var(--hover)] font-mono text-[var(--ink)]">taskId</code>)，后台分布式集群生成完毕后回调或供前端轮询。
                  </p>
                </section>

                <section className="p-4 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-1.5">
                      <Code2 size={16} className="text-[var(--green)]" />
                      鉴权请求头格式 (Authorization)
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => copyToClipboard('Authorization: Bearer YOUR_API_KEY\nContent-Type: application/json', 'auth-header')}
                      title="复制代码"
                    >
                      {copiedCode === "auth-header" ? <Check size={14} className="text-[var(--green)]" /> : <Copy size={14} />}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--line)] font-mono text-xs text-[var(--ink)] overflow-x-auto">
                    <code>Authorization: Bearer YOUR_API_KEY{"\n"}Content-Type: application/json</code>
                  </pre>
                  <div className="text-xs text-[var(--muted)] space-y-1">
                    <p>• <strong>Base URL</strong>：默认为系统配置中的 API 网关（如 <code className="text-[var(--green)] font-mono">https://api.duomi.ai</code>）。</p>
                    <p>• <strong>API Key</strong>：请在主界面右上角「设置」中填入多米平台密钥，本系统会自动安全保存并在请求时注入。</p>
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold text-[var(--ink)]">标准任务生成生命周期</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-center">
                      <span className="font-semibold text-amber-600 block mb-0.5">NOT_START</span>
                      <span className="text-[var(--muted)] text-[11px]">任务排队中</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-center">
                      <span className="font-semibold text-blue-600 block mb-0.5">IN_PROGRESS</span>
                      <span className="text-[var(--muted)] text-[11px]">AI 正在生成中</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-center">
                      <span className="font-semibold text-emerald-600 block mb-0.5">SUCCESS</span>
                      <span className="text-[var(--muted)] text-[11px]">已完成并产出结果</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-center">
                      <span className="font-semibold text-rose-600 block mb-0.5">FAILURE</span>
                      <span className="text-[var(--muted)] text-[11px]">失败 (含错误原因)</span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* 2. 实战使用示例 */}
            {activeTab === "examples" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-1">
                    <Lightbulb className="text-[var(--green)]" size={18} />
                    完整使用示例与代码实战
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    这里提供了常见场景的<strong>界面操作步骤</strong>与对应的<strong>多语言代码调用范例</strong>。
                  </p>
                </div>

                {/* 语言切换栏 */}
                <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
                  <span className="text-xs font-semibold text-[var(--ink)]">代码语言切换：</span>
                  <div className="inline-flex rounded-lg p-1 bg-[var(--subtle)] border border-[var(--line)]">
                    {(["javascript", "curl", "python"] as CodeLang[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                          activeLang === lang
                            ? "bg-[var(--panel-strong)] text-[var(--green)] font-bold shadow-xs"
                            : "text-[var(--muted)] hover:text-[var(--ink)]"
                        }`}
                        onClick={() => setActiveLang(lang)}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 案例 1: Midjourney 混图 (Blend) */}
                <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[var(--green)] text-white text-xs font-bold">示例 1</span>
                      <h4 className="font-bold text-sm text-[var(--ink)]">Midjourney 混图 (Blend) 多图融合</h4>
                    </div>
                    <span className="text-xs text-[var(--green)] font-bold">约 ¥0.18/次</span>
                  </div>

                  {/* UI 操作流程步骤条 */}
                  <div className="p-3 rounded-lg bg-[var(--panel-strong)] border border-[var(--line)] text-xs space-y-2">
                    <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                      <Terminal size={14} className="text-[var(--green)]" />
                      <span>画布界面操作流程：</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[var(--muted)] leading-relaxed pl-1">
                      <li>在底部控制台选择<strong>「多米能力」</strong> ➔ 一级分类切换至<strong>「图像」</strong>；</li>
                      <li>在能力下拉列表选择<strong>「Midjourney 混图」</strong>；</li>
                      <li>在「Base64 图片」区域直接<strong>点击上传 2~5 张参考图</strong>（系统自动异步转为 Base64 数组，无需手动粘贴）；</li>
                      <li>选择画面比例为 <code className="font-mono text-[var(--ink)]">SQUARE (1:1)</code> 或 <code className="font-mono text-[var(--ink)]">PORTRAIT (2:3)</code>；</li>
                      <li>点击<strong>「加入队列」</strong>，画布将自动创建图片盒子并实时监听生成状态。</li>
                    </ol>
                  </div>

                  {/* 代码调用示例 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--muted)]">API 请求代码调用示例：</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          const code =
                            activeLang === "javascript"
                              ? `// 1. 提交混图任务
const res = await fetch("https://api.duomi.ai/api/v1/mj/blend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    base64Array: [
      "data:image/jpeg;base64,...(图1 Base64)...",
      "data:image/jpeg;base64,...(图2 Base64)..."
    ],
    dimensions: "SQUARE",
    notifyHook: "https://your-domain.com/webhook"
  })
});
const { taskId } = await res.json();

// 2. 轮询查询任务进度
const queryRes = await fetch(\`https://api.duomi.ai/api/v1/task/\${taskId}\`, {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const task = await queryRes.json();
console.log(task.status, task.result?.images);`
                              : activeLang === "curl"
                              ? `curl -X POST "https://api.duomi.ai/api/v1/mj/blend" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "base64Array": ["data:image/jpeg;base64,AAA...", "data:image/jpeg;base64,BBB..."],
    "dimensions": "SQUARE"
  }'`
                              : `import requests

# 1. 提交任务
url = "https://api.duomi.ai/api/v1/mj/blend"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "base64Array": ["data:image/jpeg;base64,AAA...", "data:image/jpeg;base64,BBB..."],
    "dimensions": "SQUARE"
}
response = requests.post(url, json=payload, headers=headers)
task_id = response.json().get("taskId")

# 2. 查询状态
query_url = f"https://api.duomi.ai/api/v1/task/{task_id}"
task_status = requests.get(query_url, headers=headers).json()
print("任务状态:", task_status["status"])`;
                          copyToClipboard(code, "example-mj-blend");
                        }}
                        title="复制代码"
                      >
                        {copiedCode === "example-mj-blend" ? <Check size={14} className="text-[var(--green)]" /> : <Copy size={14} />}
                      </Button>
                    </div>

                    <pre className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--line)] font-mono text-[11px] text-[var(--ink)] overflow-x-auto leading-relaxed">
                      {activeLang === "javascript" && (
                        <code>{`// 1. 提交混图任务
const res = await fetch("https://api.duomi.ai/api/v1/mj/blend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    base64Array: [
      "data:image/jpeg;base64,...(图1 Base64)...",
      "data:image/jpeg;base64,...(图2 Base64)..."
    ],
    dimensions: "SQUARE",
    notifyHook: "https://your-domain.com/webhook"
  })
});
const { taskId } = await res.json();

// 2. 轮询查询任务进度
const queryRes = await fetch(\`https://api.duomi.ai/api/v1/task/\${taskId}\`, {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const task = await queryRes.json();
console.log(task.status, task.result?.images);`}</code>
                      )}
                      {activeLang === "curl" && (
                        <code>{`curl -X POST "https://api.duomi.ai/api/v1/mj/blend" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "base64Array": ["data:image/jpeg;base64,AAA...", "data:image/jpeg;base64,BBB..."],
    "dimensions": "SQUARE"
  }'`}</code>
                      )}
                      {activeLang === "python" && (
                        <code>{`import requests

url = "https://api.duomi.ai/api/v1/mj/blend"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "base64Array": ["data:image/jpeg;base64,AAA...", "data:image/jpeg;base64,BBB..."],
    "dimensions": "SQUARE"
}
response = requests.post(url, json=payload, headers=headers)
task_id = response.json().get("taskId")
print("已提交任务 ID:", task_id)`}</code>
                      )}
                    </pre>
                  </div>
                </div>

                {/* 案例 2: 可灵 (KLING) 图生视频 */}
                <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">示例 2</span>
                      <h4 className="font-bold text-sm text-[var(--ink)]">可灵 (KLING) 图生视频任务创建</h4>
                    </div>
                    <span className="text-xs text-blue-600 font-bold">官方格式 · 推荐</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--panel-strong)] border border-[var(--line)] text-xs space-y-1 text-[var(--muted)]">
                    <p>• <strong>参数示范</strong>：<code className="text-[var(--ink)] font-mono">image: "https://your-domain.com/photo.png"</code>, <code className="text-[var(--ink)] font-mono">prompt: "赛博朋克猫咪在下雨的霓虹街道缓缓奔跑，4K高清电影质感"</code>, <code className="text-[var(--ink)] font-mono">duration: 10</code>, <code className="text-[var(--ink)] font-mono">mode: "pro"</code>。</p>
                  </div>

                  <pre className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--line)] font-mono text-[11px] text-[var(--ink)] overflow-x-auto leading-relaxed">
                    <code>{`POST /api/v1/kling/video/create
{
  "model_name": "kling-v1.5",
  "image": "https://images.unsplash.com/photo-1543852786-1cf6624b9987",
  "prompt": "镜头缓缓推进，赛博猫娘眨眼并微笑着挥手，带有光影粒子流动",
  "duration": 5,
  "mode": "pro",
  "sound": "on"
}`}</code>
                  </pre>
                </div>

                {/* 案例 3: Suno AI 音乐生成 */}
                <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-xs font-bold">示例 3</span>
                      <h4 className="font-bold text-sm text-[var(--ink)]">Suno AI 文生音乐与歌词标记</h4>
                    </div>
                    <span className="text-xs text-amber-600 font-bold">Suno v3.5 / v4.0</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--panel-strong)] border border-[var(--line)] text-xs space-y-1.5 text-[var(--muted)]">
                    <p className="font-semibold text-[var(--ink)]">歌词结构化标记格式推荐：</p>
                    <pre className="p-2 rounded bg-[var(--card-bg)] border border-[var(--line)] font-mono text-[11px] text-[var(--ink)]">
{`[Verse 1]
Neon lights on the rain-slicked street
Quantum pulses in a cybernetic beat

[Chorus]
Yuki running through the digital stream
Whispering code inside a neon dream`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* 3. 图像系列 */}
            {activeTab === "images" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <ImageIcon className="text-[var(--green)]" size={18} />
                  图像能力与参数规范
                </h3>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--ink)]">Midjourney 混图 (Blend)</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">约 ¥0.18/次</span>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      将多张参考图融合成全新的艺术作品。支持 2~5 张图片混合。
                    </p>
                    <ul className="text-xs space-y-1 text-[var(--ink)] list-disc list-inside">
                      <li><strong>base64Array</strong>：支持选择本地图片文件直接自动转为 Base64 数组，无需手动编码。</li>
                      <li><strong>dimensions</strong>：比例支持 <code className="text-xs font-mono">PORTRAIT (2:3)</code>、<code className="text-xs font-mono">SQUARE (1:1)</code>、<code className="text-xs font-mono">LANDSCAPE (3:2)</code>。</li>
                      <li><strong>notifyHook</strong>：可选的回调 Webhook 地址。</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--ink)]">Nano-Banana 极速文生图 / 图生图</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-bold">约 ¥0.05/次</span>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      高吞吐、极速出图模型，支持指定长宽比（1:1, 16:9, 9:16, 4:3, 3:4）与高清分辨率选项。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. 视频系列 */}
            {activeTab === "videos" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <Video className="text-[var(--green)]" size={18} />
                  视频大模型能力矩阵
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-1.5">
                    <div className="font-bold text-[var(--ink)] flex items-center justify-between">
                      <span>KLING 可灵官方格式</span>
                      <span className="text-[11px] text-[var(--green)]">推荐</span>
                    </div>
                    <p className="text-[var(--muted)] leading-relaxed">
                      支持文生视频、图生视频、多图参考、视频特效、视频延长、人脸识别对口型与音画同步。
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-1.5">
                    <div className="font-bold text-[var(--ink)] flex items-center justify-between">
                      <span>Seedance 2.0 (即梦)</span>
                      <span className="text-[11px] text-blue-600">最新</span>
                    </div>
                    <p className="text-[var(--muted)] leading-relaxed">
                      字节跳动即梦视频生成大模型，支持高动态镜头运动与超写实光影运镜。
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-1.5">
                    <div className="font-bold text-[var(--ink)]">Runway Gen-3 Alpha</div>
                    <p className="text-[var(--muted)] leading-relaxed">
                      电影级逼真物理光影渲染，支持文本生视频、图片生视频及 Act-two 表情动作迁移。
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-1.5">
                    <div className="font-bold text-[var(--ink)]">Pix 特效与人声驱动</div>
                    <p className="text-[var(--muted)] leading-relaxed">
                      多达数十种预设特效模版与人声驱动，支持快速合成趣味特效短视频。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. 音乐音频 */}
            {activeTab === "audio" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <Music className="text-[var(--green)]" size={18} />
                  Suno AI 音乐与音频处理
                </h3>

                <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-2 text-xs">
                  <h4 className="font-bold text-sm text-[var(--ink)]">全流程音乐生成套件</h4>
                  <p className="text-[var(--muted)] leading-relaxed">
                    多米 API 完整接入了 Suno AI 音乐生成能力，包括：
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[var(--ink)]">
                    <div className="p-2 rounded bg-[var(--panel-strong)] border border-[var(--line)]">
                      • <strong>文生歌曲</strong>：输入风格提示词或自定歌词生成完整歌曲
                    </div>
                    <div className="p-2 rounded bg-[var(--panel-strong)] border border-[var(--line)]">
                      • <strong>Add Instrumental</strong>：为歌曲生成纯器乐伴奏
                    </div>
                    <div className="p-2 rounded bg-[var(--panel-strong)] border border-[var(--line)]">
                      • <strong>Add Vocals</strong>：为伴奏智能填入人声唱腔
                    </div>
                    <div className="p-2 rounded bg-[var(--panel-strong)] border border-[var(--line)]">
                      • <strong>音乐编辑</strong>：格式转 WAV、变速、裁剪与歌词时间线对齐
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. 计费与常见问题 */}
            {activeTab === "pricing" && (
              <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <Coins className="text-[var(--green)]" size={18} />
                  计费规则与常见问题
                </h3>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-1.5">
                    <h4 className="font-bold text-sm text-[var(--ink)] flex items-center gap-1.5">
                      <HelpCircle size={15} className="text-[var(--green)]" />
                      常见报错与排查 (Status Codes)
                    </h4>
                    <ul className="space-y-1 text-[var(--muted)]">
                      <li>• <code className="text-rose-600 font-mono">401 Unauthorized</code>：API Key 填写错误或已失效，请检查设置。</li>
                      <li>• <code className="text-rose-600 font-mono">402 / 429 Insufficient Balance</code>：多米平台账户额度不足，请前往官网充值。</li>
                      <li>• <code className="text-rose-600 font-mono">400 Bad Request</code>：请求参数校验不通过（如缺少必填参数或 Base64 格式损坏）。</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--subtle)] space-y-1.5">
                    <h4 className="font-bold text-sm text-[var(--ink)]">扣费与退款机制</h4>
                    <p className="text-[var(--muted)] leading-relaxed">
                      任务提交成功进入队列时会预扣对应额度。如果任务生成过程中发生服务异常导致 <code className="font-mono">FAILURE</code> 状态，系统将自动回退额度。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
