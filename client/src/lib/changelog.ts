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
    version: "v1.4.11",
    title: "新增 GPT Image 2.5 生图模型",
    date: "2026-09-09",
    badge: "✨ 最新版本",
    summary:
      "v1.4.11 接入多米API 最新发布的 GPT Image 2.5 生图模型：ChatGPT 模型分组下新增 gpt-image-2.5-flare（gpt-image-2 的替代品，出图速度约快一倍）与 gpt-image-2.5-sunburst（更高质量生图）两个可选项；「多米能力」文档模式下的 GPT Image 2 接口模型下拉同步开放这两个新模型，尺寸、参考图与思考深度参数保持不变。",
    highlights: [
      "🖼️ ChatGPT 分组新增 gpt-image-2.5-flare 与 gpt-image-2.5-sunburst，一键切换",
      "⚡ gpt-image-2.5-flare：替代 gpt-image-2，出图速度约快一倍",
      "✨ gpt-image-2.5-sunburst：面向更高质量要求的生图场景",
      "🧩 沿用 GPT Image 的 size / 参考图 / 思考深度参数，老任务与草稿完全兼容"
    ],
    items: [
      {
        category: "feature",
        title: "ChatGPT 分组新增 GPT Image 2.5 模型",
        description:
          "在创作面板的模型选择器 ChatGPT 分组中新增 gpt-image-2.5-flare 与 gpt-image-2.5-sunburst 两个选项，选择后直接走多米API 的 /v1/images/generations 异步生图链路，无需额外配置。",
        tag: "模型接入"
      },
      {
        category: "feature",
        title: "多米能力文档模式同步开放新模型",
        description:
          "「多米能力」模式下的 GPT Image 2 接口，其模型字段下拉同步开放 gpt-image-2、gpt-image-2.5-flare、gpt-image-2.5-sunburst 三个选项，默认值仍为 gpt-image-2，历史草稿中的模型值保持可用。",
        tag: "多米能力"
      },
      {
        category: "improvement",
        title: "同步 2.5 系列计费单价",
        description:
          "按官方计费表补全 gpt-image-2.5-flare 与 gpt-image-2.5-sunburst 的固定单价（均为 0.06 元/次），模型选择器会正常显示预计价格；Sunburst 为官方暂定单价，后续如有调整会同步更新。",
        tag: "计费说明"
      }
    ]
  },
  {
    version: "v1.4.10",
    title: "安全恢复闭环、凭据生命周期与画布防重渲染",
    date: "2026-09-04",
    badge: "✨ 最新版本",
    summary:
      "v1.4.10 全面落实《项目优化建议.md》核心治理项：修复 ErrorBoundary 偏好重置键名与灾备导出自动脱敏过滤 API Key；补全本地 API Key 凭据独立删除与激活智能回退管理；将全量服务端 API 与 Vite 构建脚本纳入严格 TypeScript 双轨检查；并在 App 轮询机制中引入快照防抖与 useCallback 稳定引用，彻底杜绝定时轮询引发的画布 JobCard 全量无效重渲染。",
    highlights: [
      "🛡️ ErrorBoundary 安全闭环：修复偏好重置键名漂移，灾备导出自动脱敏并剥离全部明文 API Key",
      "🔑 API Key 凭据管理：新增已保存凭据独立管理列表，支持按项删除与自动平滑回退，删除前带任务依赖警示",
      "📐 TypeScript 双轨严格检查：新增 tsconfig.node.json，涵盖 client/api 与 Vite 构建脚本，消除隐藏类型推导错误",
      "⚡ 画布防无效重渲染：引入队列/设置状态快照相等性比对，稳定核心交互回调，10s 定时轮询不再触发全量盒子重渲染",
      "🧪 全量测试覆盖扩充：新增 providerSettingsApi、ApiSettingsPanel 与 appSnapshots 全面测试，测试套件扩展至 24 个、247 项测试全部通过"
    ],
    items: [
      {
        category: "fix",
        title: "修复 ErrorBoundary 界面偏好重置键名",
        description:
          "直接引入 UI_PREFERENCES_STORAGE_KEY（aidraw-ui-preferences-v1）及旧版本键名统一清理，确保崩溃发生后点击重置能彻底清除损坏的偏好缓存并以安全默认值启动。",
        tag: "系统稳定性"
      },
      {
        category: "improvement",
        title: "灾备导出全量数据自动过滤 API Key",
        description:
          "在 ErrorBoundary 紧急导出 JSON 时自动脱敏剥离明文 apiKey 与 savedApiKeys，并在数据包与界面中增加安全声明，确保用户在提交 Issue 或日志时绝不会意外泄露敏感凭据。",
        tag: "安全隐私"
      },
      {
        category: "feature",
        title: "已保存 API Key 独立管理与删除能力",
        description:
          "在 API 设置面板新增已保存本地凭据管理区，支持独立激活、取消激活与彻底删除；删除当前激活 Key 时自动回退至同平台或其它可用绘图 Key，删除前提供依赖任务运行警示。",
        tag: "凭据管理"
      },
      {
        category: "improvement",
        title: "扩展 TypeScript 严格检查范围至 API 与工程配置",
        description:
          "新增 tsconfig.node.json 配置，将服务端媒体代理、DeepSeek 转发及 Vite/Vitest 配置全量纳入 npm run check 检查范围，提前拦截服务端 API 的潜在类型缺陷。",
        tag: "工程质量"
      },
      {
        category: "improvement",
        title: "画布操作回调稳定化与状态防抖",
        description:
          "为后台队列与 API 配置引入快照深度浅比对，数据未变动时不触发 React 状态更新；同时通过 useCallback 稳定传递给 WorkflowCanvas 的交互回调，大幅提升大量卡片场景下的流畅度。",
        tag: "性能优化"
      }
    ]
  },
  {
    version: "v1.4.9",
    title: "个性化设置抽屉、全局错误边界与模块化架构升级",
    date: "2026-09-04",
    summary:
      "v1.4.9 迎来重大体系升级：个性化设置全面重构为右侧抽屉，支持整页实时预览与外挂悬浮把手；引入全局 React ErrorBoundary 彻底拦截白屏并支持直连 IndexedDB 紧急数据抢救；同时将 8200+ 行超大单体 styles.css 拆解重构为 10 大高内聚领域样式模块，并修复靠边创作输入框的动画位移 Bug。",
    highlights: [
      "🗂️ 个性化设置重构为右侧抽屉，配备左外侧悬浮把手（Dock Toggle）与整页实时预览",
      "🛡️ 全局 React ErrorBoundary：彻底终结白屏死机，遭遇渲染异常时自动唤起自救面板",
      "💾 紧急数据抢救：即使组件崩溃仍可直连 IndexedDB 一键导出全量画布与任务 JSON 备份",
      "🎨 8200+ 行样式表模块化：拆解为 10 个高内聚领域样式模块，杜绝全局样式覆盖与污染",
      "✨ 全套现代化艺术微动效：GSAP 级联切页、雷达脉冲微标、双子星天象与保存按钮流光",
      "🐛 彻底修复创作输入框靠边定位时展开/折叠先回中间再弹回右边的关键帧位移问题"
    ],
    items: [
      {
        category: "feature",
        title: "全局 ErrorBoundary 错误边界与数据自救系统",
        description:
          "在 React 根节点注入全局错误边界拦截渲染层未捕获异常，彻底终结白屏崩溃；提供「刷新重试」、「原地恢复」、「重置界面偏好并刷新」以及直接绕过 React 状态树直连 IndexedDB 导出全量 JSON 备份的紧急数据抢救功能，并支持一键复制完整技术调用栈诊断报告。",
        tag: "系统稳定性"
      },
      {
        category: "improvement",
        title: "8200+ 行 styles.css 模块化工程重构",
        description:
          "将原先膨胀至 8,200+ 行的单体 styles.css 拆分为 10 个高内聚领域样式模块（tokens、base、layout、canvas、composer、modals、duomi、personalization、error-boundary、responsive），主入口通过 @import 严格保持自上而下的层叠优先级，彻底消除样式特异性污染。",
        tag: "架构重构"
      },
      {
        category: "feature",
        title: "右侧抽屉 + 整页实时预览模式",
        description:
          "个性化设置改为非模态右侧抽屉：无遮罩、不锁滚动、不拦截焦点。打开后进入预览会话，布局预设、页面区域、图片盒子与外观的每次调整都会实时渲染到画布上供查看，点击「应用」持久化保存，点击「取消」或按 Esc 即可安全恢复原设置。",
        tag: "个性化"
      },
      {
        category: "improvement",
        title: "外挂悬浮把手与现代卡片化 UI",
        description:
          "抽屉左侧外挂磁吸悬浮控制把手（Dock Toggle），展开/收起带有 180° 平滑弹簧旋转；全抽屉采用卡片化布局、毛玻璃通透背景、ChoiceGroup 胶囊选项组与带有操作图标的动作排序拖拽项，界面精致高级。",
        tag: "UI重构"
      },
      {
        category: "feature",
        title: "现代化与艺术化微动效系统",
        description:
          "融入 GSAP 级联切页交错入场动画、实时预览雷达双层声纳波纹、预设微缩模型交互增亮、日月外观天象悬停与保存按钮扫光 Shimmer 动效。",
        tag: "动效升级"
      },
      {
        category: "fix",
        title: "底部创作栏靠边动画位移修复",
        description:
          "重构 composer-pop-in 动画关键帧与悬停样式，解决创作输入框在靠右/靠左定位时展开和折叠由于硬编码 translateX(-50%) 导致先弹回屏幕中间再跳回边缘的视觉 Bug。",
        tag: "动画修复"
      }
    ]
  },
  {
    version: "v1.4.8",
    title: "页面与图片盒子个性化布局",
    date: "2026-09-04",
    badge: "✨ 最新版本",
    summary:
      "新增独立个性化设置中心：页面框架、创作框、图片盒子工具栏、附件缩略图、主题与桌宠现在都可以按习惯调整，并会即时保存在当前设备。",
    highlights: [
      "🎛️ 新增标准、专注画布、紧凑三套布局预设，并支持继续细调为自定义布局",
      "🧰 图片盒子工具按钮可显示、隐藏和排序，工具栏支持左右停靠及点击、悬停、始终展开",
      "🖼️ 附件支持列表、堆叠、首图 +N 三种模式，可调整方位、尺寸和最大展示数量",
      "📐 左栏、统计、素材库、全局工具栏与创作框均可个性化，刷新后设置仍然保留",
      "📱 适配宽屏、平板与窄屏安全布局，定位结果时会避开所有可见面板和盒子外侧轨道",
      "🌓 原有主题与 Mugi 快捷开关保持可用，并与个性化设置双向同步"
    ],
    items: [
      {
        category: "feature",
        title: "个性化设置中心",
        description:
          "全局工具栏新增独立设置入口，集中管理布局预设、页面区域、图片盒子和外观。设置即时生效并保存在本机，首次升级会继承原有主题与桌宠状态。",
        tag: "个性化"
      },
      {
        category: "feature",
        title: "图片盒子工具栏与附件布局",
        description:
          "工具按钮会先按任务能力过滤，再按用户指定顺序显示；附件新增列表、堆叠和首图 +N 模式，缩略图仍可点击放大。工具栏、附件与历史版本按钮使用独立外侧轨道，避免相互遮挡。",
        tag: "图片盒子"
      },
      {
        category: "improvement",
        title: "响应式停靠与安全定位",
        description:
          "桌面端完整应用自定义位置与尺寸，中等窗口采用安全停靠，窄屏自动使用全宽工具栏和创作框、底部横排附件。定位最新结果和搜索定位会读取可见面板及盒子外侧控件的实际边界。",
        tag: "响应式"
      }
    ]
  },
  {
    version: "v1.4.7",
    title: "任务标题一键复制",
    date: "2026-09-04",
    badge: "✨ 最新版本",
    summary:
      "画布任务卡片的标题现在可以直接点击复制：无需手动拖选文字，即可获取完整提示词，同时避免误触卡片拖拽。",
    highlights: [
      "📋 点击任务卡片标题即可复制完整提示词",
      "🖱️ 标题复制与卡片拖拽互不干扰，操作更准确",
      "⌨️ 标题支持键盘聚焦，并保留旧浏览器复制回退能力"
    ],
    items: [
      {
        category: "improvement",
        title: "任务标题支持点击复制",
        description:
          "将画布任务标题改为可交互的复制入口：点击后复制完整提示词并显示结果反馈；标题按下事件不会再启动卡片拖拽，同时补充键盘焦点样式和剪贴板兼容回退。",
        tag: "画布交互"
      }
    ]
  },
  {
    version: "v1.4.6",
    title: "AI 润写支持看图（参考图结合）",
    date: "2026-09-02",
    badge: "✨ 最新版本",
    summary:
      "AI 润写接入 DeepSeek 视觉模型：上传参考图后自动切换看图润写模型，AI 会观察图片里的主体、风格与构图，让润写出的提示词与你的参考图保持一致。",
    highlights: [
      "🖼️ 润写新增 deepseek-v4-flash-vision-exp（看图润写）模型，支持参考图识别",
      "📸 添加参考图后自动切换到看图润写模型，无需手动选择",
      "🧠 润写时结合图片的主体、风格、色调、构图与材质，提示词与图片内容一致",
      "🔗 参考图按公网 URL 传入，最多 5 张；非法地址自动过滤"
    ],
    items: [
      {
        category: "feature",
        title: "看图润写",
        description:
          "AI 润写支持传入参考图片：调用 DeepSeek 官方图像理解格式（image_url 内容块），润写前模型会先观察图片元素，再结合图片内容优化提示词；有参考图时自动选用视觉模型。",
        tag: "看图润写"
      }
    ]
  },
  {
    version: "v1.4.5",
    title: "Mugi 桌宠入驻画布！",
    date: "2026-09-02",
    badge: "✨ 最新版本",
    summary:
      "Mugi（琴吹紬猫娘）桌宠正式入驻 AIDraw：她会自己在你项目窗口里踱步巡游，可以拖动到任意角落，轻点互动还有随机动作和小气泡台词。",
    highlights: [
      "🐱 Mugi 桌宠默认开启，在窗口内自动左右巡游移动，碰到边缘自动转身",
      "🧭 可拖到窗口任意位置；松开后继续巡游，不会被重置",
      "👆 轻点触发随机动作：挥手 / 跳跃 / 比心 / 敲代码 / 喝茶 / 睡觉… 并弹出可爱台词",
      "⚙️ 工具栏新增 Mugi 开关按钮，关闭后不再打扰，状态会记住",
      "🎞️ 13 个动作 GIF 全部本地化，无外部依赖"
    ],
    items: [
      {
        category: "feature",
        title: "Mugi 桌宠",
        description:
          "把 Mugi（琴吹紬猫娘）桌宠嵌入画布：自动巡游移动、碰到窗口边缘转身、可拖拽定位、点击互动播放随机动作并弹出气泡台词；工具栏猫猫按钮一键开关，偏好持久化保存。",
        tag: "桌宠"
      }
    ]
  },
  {
    version: "v1.4.4",
    title: "生图提示词 AI 润写（DeepSeek 官方 API）",
    date: "2026-09-02",
    badge: "✨ 最新版本",
    summary:
      "提示词输入框旁新增「AI 润写」按钮：接入 DeepSeek 官方 Chat Completions API，一键把生图提示词润写为细节增强、更简洁或英文版本，流式逐字回填输入框，支持一键回退原文与模型/思考强度调节。",
    highlights: [
      "✨ 提示词输入框旁新增「AI 润写」按钮，支持细节增强 / 更简洁 / 翻译成英文三种风格",
      "⚡ DeepSeek 润写采用流式输出，结果逐字回填输入框，输入框自动滚动到底部，最新内容始终可见",
      "🤖 下拉内可选 deepseek-v4-pro（质量优先）或 deepseek-v4-flash（更快更省）",
      "🧠 思考强度可切换：关闭 / 低 / 高（官方默认）/ 最高，按官方 thinking.enabled + reasoning_effort 接入",
      "↩️ 润写完成后出现「回退」按钮，可一键还原为润写前的原文",
      "🔑 API 设置新增 DeepSeek（AI 润写）Key 配置，与绘图平台 Key 独立管理、互不干扰",
      "🛡️ 官方接口不支持浏览器跨域，请求统一经同源代理转发，Key 不离开浏览器"
    ],
    items: [
      {
        category: "feature",
        title: "生图提示词 AI 润写（流式 + 回退 + 模型/思考可调）",
        description:
          "创作面板与重绘编辑弹窗的提示词输入框旁新增「AI 润写」按钮，调用 DeepSeek 官方 POST /chat/completions 接口（流式 SSE），提供细节增强、更简洁、翻译成英文三种润写风格；下拉可切换 deepseek-v4-pro / deepseek-v4-flash 模型与思考强度（关闭/低/高/最高），结果逐字回填输入框并自动滚动跟随，支持一键回退到润写前原文。",
        tag: "提示词润写"
      },
      {
        category: "improvement",
        title: "DeepSeek Key 独立配置",
        description:
          "API 设置新增 DeepSeek（AI 润写）平台（https://api.deepseek.com），Key 仅作为润写服务凭据保存，不会切换绘图供应商，不影响现有生成流程。",
        tag: "接口接入"
      },
      {
        category: "fix",
        title: "修复「多米能力」面板空白",
        description:
          "旧草稿如果引用了已下线的能力分类或能力，切换到「多米能力」时面板会空白。现在恢复草稿时会自动回退到首个有效的分类与能力，面板恢复可用。",
        tag: "体验修复"
      }
    ]
  },
  {
    version: "v1.4.3",
    title: "远程失败任务重试修复",
    date: "2026-09-01",
    badge: "✨ 最新版本",
    summary:
      "修复异步生成任务已被远端明确判定失败后，点击继续仍反复查询旧任务 ID、无法重新发起绘制的问题；同时保留查询中断时恢复原任务的计费安全策略。",
    highlights: [
      "🔁 远端返回 error 后，再次点击继续会清除旧任务 ID 并重新发起生成请求",
      "🛑 终态失败不再被误判为查询中断，避免对无效任务 ID 持续轮询",
      "💳 网络异常、超时等非终态问题仍只恢复原任务，不会贸然重复提交"
    ],
    items: [
      {
        category: "fix",
        title: "失败任务不再轮询旧 ID",
        description:
          "当远程接口明确返回 error 状态时，任务现在会保存为终态失败。再次点击继续会清理 remoteTaskId、remoteTaskIds 与旧查询地址，使用原绘制参数重新提交任务。",
        tag: "任务重试"
      },
      {
        category: "improvement",
        title: "区分终态失败与查询中断",
        description:
          "远端明确失败时允许重新生成；只有网络抖动、查询超时等状态不确定的情况才继续追踪原任务，从而兼顾可恢复性与重复扣费防护。",
        tag: "计费安全"
      }
    ]
  },
  {
    version: "v1.4.2",
    title: "任务续查安全、媒体代理加固与性能升级",
    date: "2026-08-31",
    summary:
      "本次更新重点提升付费异步任务的可靠性与本地项目的安全边界：任务会绑定创建时使用的 API Key，断线或查询失败后优先恢复原远程任务；同时加固媒体代理、减少无效轮询，并优化首屏包体与弹窗无障碍体验。",
    highlights: [
      "💳 已取得远程任务 ID 的失败任务只恢复查询，不会再次提交，降低重复扣费风险",
      "🔑 每个任务绑定创建时使用的 API Key；切换当前 Key 后，运行中的任务仍可使用原凭据继续追踪",
      "🔄 远程状态查询遇到网络抖动会自动退避重试，视频、音频和文件任务最长追踪时间延长至 120 分钟",
      "🛡️ 媒体代理新增私网地址拦截、逐跳重定向校验、超时、流式大小限制与轻量限流",
      "⚡ 状态同步改为批量刷新，轮询降频；弹窗与 API 文档按需加载，主入口包体显著缩小"
    ],
    items: [
      {
        category: "fix",
        title: "付费异步任务安全续查",
        description:
          "任务会保存不含 Key 明文的凭据标识。查询中断、页面恢复或达到追踪时限后，只要已有远程任务 ID，点击重试就会继续查询原任务，不再重新发起生成请求。若提交结果未知且没有任务 ID，则阻止一键重提并提示先到远程平台确认。",
        tag: "计费安全"
      },
      {
        category: "fix",
        title: "远程查询容错与长任务追踪",
        description:
          "查询请求异常时最多进行 5 次指数退避重试，网络抖动不再立即把任务判为失败；普通图片保持 30 分钟追踪窗口，视频、音频、文件和混合输出任务延长至 120 分钟。",
        tag: "队列可靠性"
      },
      {
        category: "fix",
        title: "媒体代理与远程转存安全加固",
        description:
          "阻止访问 localhost、私网、链路本地和保留地址，并对每次重定向重新校验；新增跨站限制、请求超时、轻量限流和边读边计数的 200 MB 上限，避免无长度响应占满内存。",
        tag: "安全加固"
      },
      {
        category: "improvement",
        title: "状态同步与加载性能优化",
        description:
          "合并短时间内重复的跨标签页状态通知，把全量兜底轮询从 2.5 秒调整为 10 秒并在页面隐藏时暂停；图片预览、设置、重绘、新手引导、公告和 API 文档改为首次使用时加载。",
        tag: "性能优化"
      },
      {
        category: "improvement",
        title: "备份边界、无障碍与工程质量",
        description:
          "文件夹 JSON 备份现在明确提示仅保存媒体链接、不包含媒体原文件，并剥离任务凭据标识、限制导入体积；自定义弹窗增加焦点锁定和关闭后焦点恢复，同时补齐自动测试、CI、许可证与项目文档。",
        tag: "体验完善"
      }
    ]
  },
  {
    version: "v1.4.1",
    title: "多米 API 文档同步更新（SUNO / Sora / PIX）",
    date: "2026-08-26",
    summary:
      "对照多米 API 最新文档同步三个能力：SUNO 生成音乐接入 GPT 描述提示词与音乐控制滑杆参数、Sora 新增 10/15/25 秒时长、PIX 镜头运动改为官方 20 种枚举选择。",
    highlights: [
      "🎵 SUNO 生成音乐新增 gpt_description_prompt（GPT 描述提示词）与 metadata（控制滑杆）参数，并移除已下线的 custom_mode",
      "🎬 Sora 视频生成时长新增 10 / 15 / 25 秒选项",
      "🎥 PIX 镜头运动从自由文本升级为官方 20 种镜头枚举选择"
    ],
    items: [
      {
        category: "improvement",
        title: "SUNO 生成音乐参数同步",
        description:
          "新增 GPT 描述提示词 gpt_description_prompt 与 metadata 音乐控制参数（style_weight / weirdness_constraint / audio_weight 及 can_control_sliders）；移除文档已下线的 custom_mode 字段。",
        tag: "接口同步"
      },
      {
        category: "improvement",
        title: "Sora 时长选项扩展",
        description: "视频生成时长在原有 4/8/12 秒基础上新增 10/15/25 秒，与多米最新文档枚举保持一致。",
        tag: "参数扩展"
      },
      {
        category: "improvement",
        title: "PIX 镜头运动枚举化",
        description:
          "镜头运动参数改为下拉选择，提供 horizontal_left、hitchcock、whip_pan 等 20 种官方镜头运动，避免手输错误。",
        tag: "交互优化"
      }
    ]
  },
  {
    version: "v1.4.0",
    title: "文件夹一键导出导入 & 多版本对比修复",
    date: "2026-08-26",
    summary:
      "新增当前文件夹一键导出与备份导入能力，任务、素材库与多版本历史可跨浏览器安全迁移；同时修复同一任务多次重绘后新旧版本对比不可见的问题，并支持版本历史默认折叠、一键展开对比。",
    highlights: [
      "📦 顶栏左上角新增「导出当前文件夹」：任务列表、素材库与画布状态一键打包为 JSON 下载",
      "📥 新增「导入文件夹备份」：格式校验后生成全新文件夹，自动防重名，不覆盖任何现有数据",
      "🛡️ 导入安全策略：备份中的进行中任务重置为失败，避免导入后自动重新提交产生费用",
      "🖼️ 修复多版本任务卡片被结果资产字段遮挡、展开后只剩新图的问题，新旧版本可并排对比",
      "🗂️ 多版本卡片默认折叠只显示最新一张，点击卡片右缘按钮即可展开历史版本"
    ],
    items: [
      {
        category: "feature",
        title: "文件夹导出与导入备份",
        description:
          "画布顶栏最左端新增导出/导入按钮。导出当前文件夹的全部任务（提示词、参数、多版本输出、画布坐标与排序）、素材库记录与画布状态为 JSON 文件；导入时生成全新文件夹并自动切换，同名文件夹自动追加「(导入N)」后缀。",
        tag: "备份迁移"
      },
      {
        category: "feature",
        title: "导入安全策略",
        description:
          "导入备份会重新生成所有实体 ID，并清除跨浏览器无效的远程任务字段；备份中的 pending/running 任务统一重置为失败并附提示，防止导入后队列自动重新提交产生费用。",
        tag: "数据安全"
      },
      {
        category: "fix",
        title: "多版本卡片新旧对比不可见",
        description:
          "修复多版本任务卡片被 outputAssets（只保存最新一次结果）遮挡、只显示最新一张图的问题，版本历史现在可正常展开并排对比，大图预览也恢复「对比版本 vs 当前版本」双栏展示。",
        tag: "对比修复"
      },
      {
        category: "improvement",
        title: "版本历史默认折叠、一键展开",
        description:
          "多版本卡片默认只显示最新一张，点击卡片右缘的展开按钮即可查看全部历史版本，兼顾画布整洁与新旧对比需求。",
        tag: "交互优化"
      }
    ]
  },
  {
    version: "v1.3.1",
    title: "Nano Banana 新增 Gemini 3.1 Flash Lite 选项 & 下拉排版优化",
    date: "2026-08-19",
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
