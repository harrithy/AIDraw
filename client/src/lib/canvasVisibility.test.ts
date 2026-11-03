import { describe, expect, it } from "vitest";
import type { DrawJob } from "../types";
import { getPositionedJobs, type PositionedJob } from "./canvas";
import {
  containsCanvasBounds, getCanvasLinks, getCanvasViewportBounds,
  getVisibleCanvasJobs, getVisibleCanvasLinks, intersectsCanvasBounds
} from "./canvasVisibility";

/** 创建真实默认横排任务，覆盖裁剪后全局顺序和超长画布的情况。 */
const makeJobs = (count: number) => getPositionedJobs(Array.from({ length: count }, (_, index) => ({
  id: `job-${index}`, folderId: "folder", mode: "text-to-image", status: "completed", prompt: "测试",
  negativePrompt: "", width: 1024, height: 1024, count: 1, thinking: "standard", model: "gpt-image-2",
  orderIndex: index, posX: 0, posY: 0, createdAt: "2026-11-03", updatedAt: "2026-11-03"
} satisfies DrawJob)));

describe("画布视口裁剪", () => {
  it("正确反算平移、缩放和屏幕像素缓冲区", () => {
    expect(getCanvasViewportBounds({ panX: -100, panY: 50, zoom: 0.5, width: 1000, height: 700 }, 100))
      .toEqual({ left: 0, top: -300, right: 2400, bottom: 1500 });
  });

  it("边缘接触仍可见，完全越界时才裁剪", () => {
    const bounds = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(intersectsCanvasBounds(bounds, { left: 100, top: 20, right: 200, bottom: 40 })).toBe(true);
    expect(intersectsCanvasBounds(bounds, { left: 101, top: 20, right: 200, bottom: 40 })).toBe(false);
    expect(containsCanvasBounds(bounds, { left: 1, top: 1, right: 99, bottom: 99 })).toBe(true);
    expect(containsCanvasBounds(bounds, { left: -1, top: 1, right: 99, bottom: 99 })).toBe(false);
  });

  it("千个任务只选择视口附近的卡片，同时保留原始索引", () => {
    const jobs = makeJobs(1000);
    const target = jobs[500];
    const bounds = getCanvasViewportBounds({ panX: -target.x + 300, panY: 0, zoom: 1, width: 1440, height: 1000 }, 600);
    const visible = getVisibleCanvasJobs(jobs, bounds, new Set(), null);
    expect(visible.length).toBeLessThan(8);
    expect(visible).toContain(target);
    expect(visible.every((item) => jobs[item.index] === item)).toBe(true);
    expect(visible).not.toContain(jobs[0]);
  });

  it("标题或侧边参考图进入视口时，卡片仍然保留", () => {
    const [job] = makeJobs(1);
    const bounds = { left: job.x + job.cardSize.cardWidth + 100, top: job.y, right: 1200, bottom: 500 };
    expect(getVisibleCanvasJobs([job], bounds, new Set(), null)).toEqual([job]);
  });

  it("保留屏幕外正在拖动和有展开内容的卡片", () => {
    const jobs = makeJobs(30);
    const bounds = { left: 0, top: 0, right: 1000, bottom: 800 };
    const visible = getVisibleCanvasJobs(jobs, bounds, new Set(["job-20"]), "job-25");
    expect(visible).toContain(jobs[20]);
    expect(visible).toContain(jobs[25]);
    expect(visible).not.toContain(jobs[15]);
  });

  it("长文本和文件结果滚到下半部时使用实际高度，而不是图片卡片的默认高度", () => {
    const [job] = makeJobs(1);
    const bounds = { left: 0, top: 2000, right: 1000, bottom: 3000 };
    expect(getVisibleCanvasJobs([job], bounds, new Set(), null)).toEqual([]);
    expect(getVisibleCanvasJobs([job], bounds, new Set(), null, new Map([[job.job.id, 3000]]))).toEqual([job]);
  });

  it("连线维持原始相邻关系和索引，不跨过被裁剪的卡片重新连接", () => {
    const jobs = makeJobs(30);
    const links = getCanvasLinks(jobs);
    const target = jobs[15];
    const visible = getVisibleCanvasLinks(links, { left: target.x, top: 0, right: target.x + 400, bottom: 800 }, null);
    expect(visible.length).toBeLessThan(4);
    expect(visible.every((link) => link.from === jobs[link.index] && link.to === jobs[link.index + 1])).toBe(true);
    expect(visible.some((link) => link.index === 14)).toBe(true);
  });

  it("连线两端都在屏幕外但穿过视口时仍保留", () => {
    const jobs: PositionedJob[] = makeJobs(2).map((item, index) => ({ ...item, x: index === 0 ? -2000 : 3000 }));
    const links = getCanvasLinks(jobs);
    expect(getVisibleCanvasLinks(links, { left: 0, top: 0, right: 1000, bottom: 800 }, null)).toEqual(links);
  });

  it("拖动屏幕外卡片时保留相邻两条连线，空列表不创建连线", () => {
    const jobs = makeJobs(30);
    const links = getCanvasLinks(jobs);
    const visible = getVisibleCanvasLinks(links, { left: 0, top: 0, right: 1000, bottom: 800 }, "job-20");
    expect(visible.some((link) => link.index === 19)).toBe(true);
    expect(visible.some((link) => link.index === 20)).toBe(true);
    expect(getCanvasLinks([])).toEqual([]);
    expect(getCanvasLinks(jobs.slice(0, 1))).toEqual([]);
  });
});
