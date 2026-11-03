import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrawFolder, DrawJob } from "../../types";
import { getPositionedJobs } from "../../lib/canvas";
import { notifyCanvasViewport } from "../../lib/canvasVisibility";
import { createDefaultUiPreferences } from "../../lib/uiPreferences";
import { WorkflowCanvas } from "./WorkflowCanvas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 用轻量卡片隔离视口调度，模拟展开和收起；真实卡片交互另由浏览器验证。 */
const { renderCard } = vi.hoisted(() => ({ renderCard: vi.fn() }));
vi.mock("./JobCard", () => ({
  JobCard: ({ job, onRetentionChange, onHeightChange }: {
    job: DrawJob;
    onRetentionChange: (id: string, retain: boolean) => void;
    onHeightChange: (id: string, height: number) => void;
  }) => {
    renderCard(job.id);
    return <article className="job-card" data-job-id={job.id}>
      <button onClick={() => onRetentionChange(job.id, true)}>展开</button>
      <button onClick={() => onRetentionChange(job.id, false)}>收起</button>
      <button onClick={() => onHeightChange(job.id, 3000)}>长内容</button>
    </article>;
  }
}));

const jobs = getPositionedJobs(Array.from({ length: 273 }, (_, index) => ({
  id: `job-${index}`, folderId: "folder", mode: "text-to-image", status: "completed", prompt: "测试",
  negativePrompt: "", width: 1024, height: 1024, count: 1, thinking: "standard", model: "gpt-image-2",
  orderIndex: index, posX: 0, posY: 0, createdAt: "2026-11-03", updatedAt: "2026-11-03"
} satisfies DrawJob)));
const folder: DrawFolder = {
  id: "folder", name: "测试", canvasPanX: 0, canvasPanY: 0, canvasZoom: 1,
  createdAt: "2026-11-03", updatedAt: "2026-11-03"
};

describe("WorkflowCanvas 大文件夹裁剪", () => {
  let container: HTMLDivElement;
  let root: Root;
  const noop = () => {};
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderCard.mockClear();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const render = (activeFolder = folder, draggingJobId: string | null = null) => act(() => root.render(
    <WorkflowCanvas
      activeFolder={activeFolder} boardSize={{ width: 169000, height: 1000 }}
      isDragging={Boolean(draggingJobId)} isCanvasDragging={false} isLoading={false}
      onStartCreating={noop} positionedJobs={jobs} draggingJobId={draggingJobId}
      onPointerDown={noop} onPointerMove={noop} onPointerUp={noop} onPointerCancel={noop} onWheel={noop}
      onMoveJob={noop} onPreviewJob={noop} onRetryJob={noop} onEditRetryJob={noop}
      cardPreferences={createDefaultUiPreferences().card}
    />
  ));
  const pan = (panX: number, panY = 0) => act(() => notifyCanvasViewport(container.querySelector(".canvas-stage")!, { panX, panY, zoom: 1 }));

  it("只挂载缓冲视口内的少量卡片和连线，并限制 SVG 图层宽度", () => {
    render();
    expect(container.querySelectorAll(".job-card").length).toBeLessThan(8);
    expect(container.querySelectorAll(".workflow-link").length).toBeLessThan(8);
    expect(Number.parseFloat((container.querySelector(".workflow-links") as SVGElement).style.width)).toBeLessThan(4000);
  });

  it("缓冲区内的小幅平移不重新渲染卡片，越过边界时才补充远处任务", () => {
    render();
    const initialRenders = renderCard.mock.calls.length;
    pan(-20);
    pan(-40);
    expect(renderCard.mock.calls.length).toBe(initialRenders);
    pan(-jobs[200].x + 300);
    expect(container.querySelector('[data-job-id="job-200"]')).not.toBeNull();
    expect(container.querySelector('[data-job-id="job-0"]')).toBeNull();
    expect(container.querySelectorAll(".job-card").length).toBeLessThan(8);
  });

  it("展开内容移出屏幕后仍保持挂载，收起后允许卸载", () => {
    render();
    act(() => (container.querySelector('[data-job-id="job-0"] button') as HTMLButtonElement).click());
    pan(-jobs[200].x + 300);
    expect(container.querySelector('[data-job-id="job-0"]')).not.toBeNull();
    act(() => (container.querySelectorAll('[data-job-id="job-0"] button')[1] as HTMLButtonElement).click());
    expect(container.querySelector('[data-job-id="job-0"]')).toBeNull();
  });

  it("搜索跳转或缩放导致视口变化时立即显示目标，并保留正在拖动的远处卡片", () => {
    render({ ...folder, canvasPanX: -jobs[250].x * 0.55 + 400, canvasZoom: 0.55 }, "job-0");
    expect(container.querySelector('[data-job-id="job-250"]')).not.toBeNull();
    expect(container.querySelector('[data-job-id="job-0"]')).not.toBeNull();
    expect(container.querySelectorAll(".job-card").length).toBeLessThan(12);
  });

  it("记录卡片实际高度，长结果滚动到下半部分仍然可见", () => {
    render();
    act(() => (container.querySelectorAll('[data-job-id="job-0"] button')[2] as HTMLButtonElement).click());
    pan(0, -2300);
    expect(container.querySelector('[data-job-id="job-0"]')).not.toBeNull();
  });
});
