# AI绘图工作流制作流程

## 1. 项目目标

制作一个 AI 绘图工作流管理器，用户可以先选择绘图模式，再创建绘图任务。系统支持任务排队、最多 10 个任务并行绘制、同一文件夹下的绘图结果显示在同一个画布中，并支持对图片进行排序。

第一版重点不是复杂节点编排，而是先跑通：

- 文生图 / 图生图模式选择
- 创建绘图任务
- 工作流执行与等待状态
- 最多 10 个并行绘图
- 文件夹级画布
- 绘图结果展示
- 图片排序

## 2. 制作总顺序

### 阶段一：需求确认与基础设计

目标：确认程序要先实现哪些功能，避免一开始做得过大。

需要确认：

- 绘图接口来源：OpenAI、Stable Diffusion、ComfyUI、其他 API，或先用模拟接口
- 前端技术栈：React 或 Vue
- 后端技术栈：Node.js、Python/FastAPI 或其他
- 图片存储方式：本地文件夹或对象存储
- 是否需要用户登录
- 是否需要保存历史工作流

阶段一完成标准：

- 明确第一版 MVP 功能
- 明确技术栈
- 明确绘图 API 来源
- 明确图片保存位置

## 3. 第一版 MVP 功能流程

### 3.1 创建文件夹

用户先创建一个绘图文件夹，例如：

- 人物设定
- 背景图
- 商品图
- 表情包

每个文件夹对应一个独立画布。

同一个文件夹下生成的所有图片，都显示在该文件夹的同一个画布中。

### 3.2 进入文件夹画布

进入文件夹后，用户看到：

- 当前文件夹名称
- 可缩放画布
- 已生成图片
- 正在生成的任务卡片
- 新建绘图按钮
- 排序控制

画布基础能力：

- 缩放
- 平移
- 显示图片
- 显示任务状态
- 保存画布缩放与位置状态

### 3.3 选择绘图模式

用户点击新建绘图后，第一步先选择：

- 文生图
- 图生图

#### 文生图需要填写

- 提示词 prompt
- 反向提示词 negative prompt，可选
- 图片尺寸
- 生成数量
- 模型或风格，可选

#### 图生图需要填写

- 原始图片
- 提示词 prompt
- 反向提示词 negative prompt，可选
- 重绘强度
- 图片尺寸
- 生成数量
- 模型或风格，可选

### 3.4 创建工作流任务

用户填写参数后，系统创建绘图任务。

每个绘图任务需要包含：

- 任务 ID
- 所属文件夹 ID
- 模式：文生图 / 图生图
- 输入参数
- 状态
- 排序序号
- 创建时间
- 输出图片地址

任务状态包括：

- 等待中
- 绘制中
- 已完成
- 失败

### 3.5 任务队列与 10 个并行绘制

系统需要有一个绘图任务队列。

规则：

- 同时最多运行 10 个绘图任务
- 超过 10 个的任务进入等待队列
- 任务完成后，自动从等待队列中取下一个任务执行
- 任务失败后记录错误，并释放并发名额
- 前端能实时看到任务状态变化

第一版可以先使用内存队列。

后续版本再升级为数据库任务队列或 Redis 队列。

### 3.6 等待完成并进入下一步

任务创建后，用户不需要停留等待。

用户可以继续：

- 新建下一个绘图任务
- 切换文件夹
- 查看已经完成的图片
- 调整图片排序

当任务完成时：

- 图片自动出现在当前文件夹画布中
- 任务状态变为已完成
- 保存输出图片地址

### 3.7 图片排序

同一个文件夹中的图片支持排序。

第一版建议支持：

- 手动拖拽排序
- 按生成时间排序
- 按名称排序

每张图片保存一个 orderIndex。

画布展示时按照 orderIndex 排列。

## 4. 推荐页面结构

### 4.1 文件夹列表页

用途：

- 查看所有绘图文件夹
- 新建文件夹
- 删除文件夹，可后置
- 进入文件夹画布

### 4.2 文件夹画布页

用途：

- 查看当前文件夹所有绘图结果
- 查看任务状态
- 缩放和平移画布
- 新建绘图任务
- 调整图片排序

### 4.3 新建绘图面板

用途：

- 选择文生图或图生图
- 填写绘图参数
- 上传图生图原图
- 提交绘图任务

### 4.4 任务详情面板

用途：

- 查看单个任务参数
- 查看生成状态
- 查看失败原因
- 重新运行任务，可后置

## 5. 推荐数据结构

### 5.1 文件夹

```ts
type DrawFolder = {
  id: string;
  name: string;
  canvasZoom: number;
  canvasPanX: number;
  canvasPanY: number;
  createdAt: string;
  updatedAt: string;
};
```

### 5.2 绘图任务

```ts
type DrawMode = "text-to-image" | "image-to-image";

type DrawJobStatus = "pending" | "running" | "completed" | "failed";

type DrawJob = {
  id: string;
  folderId: string;
  mode: DrawMode;
  status: DrawJobStatus;
  prompt: string;
  negativePrompt?: string;
  inputImageUrl?: string;
  outputImageUrl?: string;
  width: number;
  height: number;
  count: number;
  orderIndex: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 5.3 工作流

第一版工作流可以简化，不做复杂节点系统。

```ts
type Workflow = {
  id: string;
  folderId: string;
  mode: DrawMode;
  jobId: string;
  params: Record<string, unknown>;
  createdAt: string;
};
```

后续如果要升级为节点工作流，再扩展为：

```ts
type WorkflowGraph = {
  id: string;
  folderId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};
```

## 6. 推荐接口设计

### 6.1 文件夹接口

- `GET /api/folders`：获取文件夹列表
- `POST /api/folders`：创建文件夹
- `GET /api/folders/:id`：获取文件夹详情
- `PATCH /api/folders/:id`：更新文件夹信息或画布状态

### 6.2 绘图任务接口

- `GET /api/folders/:folderId/jobs`：获取文件夹下任务
- `POST /api/folders/:folderId/jobs`：创建绘图任务
- `GET /api/jobs/:jobId`：获取任务详情
- `PATCH /api/jobs/:jobId/order`：更新图片排序
- `POST /api/jobs/:jobId/retry`：重新执行任务，后置功能

### 6.3 上传接口

- `POST /api/uploads/image`：上传图生图原图

### 6.4 状态同步

第一版可选方案：

- 前端轮询任务状态
- 每 2 到 5 秒请求一次任务列表

后续优化方案：

- WebSocket
- Server-Sent Events

## 7. 推荐技术栈

### 前端

推荐：

- React
- TypeScript
- Vite
- React Flow 或自定义画布
- Zustand

如果更偏 Vue：

- Vue 3
- TypeScript
- Vite
- Vue Flow
- Pinia

### 后端

推荐二选一：

- Node.js + Express / Fastify
- Python + FastAPI

如果绘图接口使用 ComfyUI 或 Stable Diffusion，本地模型方向更推荐 Python/FastAPI。

如果主要调用第三方 API，Node.js 或 Python 都可以。

### 存储

第一版：

- SQLite
- 本地 uploads 文件夹

后续：

- PostgreSQL
- 对象存储
- Redis 队列

## 8. 开发顺序建议

### 第一步：项目初始化

目标：

- 创建前端项目
- 创建后端项目
- 配置 TypeScript 或 Python 环境
- 配置基础目录

完成后应能启动：

- 前端页面
- 后端接口服务

### 第二步：文件夹功能

目标：

- 创建文件夹
- 查看文件夹列表
- 进入文件夹画布

### 第三步：文件夹画布

目标：

- 实现基础画布页面
- 支持缩放
- 支持平移
- 支持显示图片卡片和任务卡片

### 第四步：新建绘图任务

目标：

- 实现文生图 / 图生图选择
- 实现参数表单
- 实现图片上传
- 提交任务到后端

### 第五步：后端任务队列

目标：

- 实现任务创建
- 实现 pending / running / completed / failed 状态
- 实现最多 10 个并发
- 接入模拟绘图接口

说明：

第一版建议先使用模拟绘图接口，确认流程正确后再接真实 AI。

### 第六步：结果显示

目标：

- 任务完成后生成输出图片地址
- 前端轮询任务列表
- 完成图片自动显示到画布上

### 第七步：图片排序

目标：

- 实现手动拖拽排序
- 保存 orderIndex
- 支持按时间 / 名称排序

### 第八步：接入真实 AI 绘图

目标：

- 替换模拟绘图接口
- 对接文生图
- 对接图生图
- 保存真实输出图片

### 第九步：优化与扩展

可后续添加：

- WebSocket 实时状态
- 任务失败重试
- 批量创建任务
- 节点式工作流编辑器
- 图片局部重绘
- 图片放大
- 图片收藏
- 多用户登录

## 9. 第一版验收标准

第一版完成后，需要满足：

- 可以创建多个文件夹
- 每个文件夹有自己的画布
- 可以选择文生图或图生图
- 可以创建绘图任务
- 同时最多 10 个任务运行
- 多余任务自动等待
- 任务完成后图片显示在对应文件夹画布中
- 同一个文件夹下的图片都在同一个画布
- 可以给图片排序
- 刷新页面后数据仍然存在

## 10. 待确认问题

开始制作程序前，需要确认以下问题：

1. 使用 React 还是 Vue？
2. 后端使用 Node.js 还是 Python/FastAPI？
3. 第一版是否先用模拟绘图接口？
4. 图片是否先保存在本地项目目录？
5. 是否需要用户登录？
6. 画布排序是更偏网格排序，还是自由拖拽摆放？
7. 后续是否要升级成真正的节点式工作流？

