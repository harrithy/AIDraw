import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrawFolder, DrawJob } from "../../types";
import { CanvasToolbar } from "./CanvasToolbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 真实 UUID v4 任务 ID：version 位（下标 14）恒为字符 "4"。 */
const job = (overrides: Partial<DrawJob>): DrawJob => ({
  id: "2937e87e-efb5-44ce-a4db-bc95accb8dc6",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "completed",
  prompt: "生成一张日本jk的泳装",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "standard",
  model: "gpt-image-2",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: "2026-09-23T19:49:05.000Z",
  updatedAt: "2026-09-23T19:49:05.000Z",
  ...overrides
});

const folders: DrawFolder[] = [
  {
    id: "folder-1",
    name: "测试2",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z"
  } as DrawFolder
];

describe("CanvasToolbar 全局搜索下拉", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const renderToolbar = (searchQuery: string, jobs: DrawJob[]) => {
    act(() => {
      root.render(
        <CanvasToolbar
          zoom={1}
          darkMode={false}
          onZoomOut={() => {}}
          onZoomIn={() => {}}
          onResetCanvas={() => {}}
          hasLatestOutput={false}
          onJumpToLatestOutput={() => {}}
          onSortByTime={() => {}}
          onSortByName={() => {}}
          onOpenApiSettings={() => {}}
          onOpenPersonalization={() => {}}
          onOpenGuide={() => {}}
          onToggleTheme={() => {}}
          petEnabled={false}
          onTogglePet={() => {}}
          searchQuery={searchQuery}
          onSearchQueryChange={() => {}}
          jobs={jobs}
          allJobs={jobs}
          folders={folders}
        />
      );
    });
  };

  const items = () => Array.from(container.querySelectorAll(".search-dropdown-item"));
  const hits = () =>
    Array.from(container.querySelectorAll("mark.search-hit")).map((node) => node.textContent);

  it("输入 4 时不再返回全部任务（UUID 版本位不再参与匹配）", () => {
    const jobs = [
      job({ id: "2937e87e-efb5-44ce-a4db-bc95accb8dc6" }),
      job({ id: "3e6abc3b-4615-4d95-9043-ab2b0803d27a", prompt: "生成一张娜美的泳装" })
    ];

    renderToolbar("4", jobs);

    expect(items()).toHaveLength(0);
    expect(container.querySelector(".search-dropdown-empty")).not.toBeNull();
  });

  it("命中提示词时高亮命中的字符", () => {
    const jobs = [
      job({ prompt: "生成一张日本jk的泳装" }),
      job({ id: "3e6abc3b-4615-4d95-9043-ab2b0803d27a", prompt: "生成一张娜美的泳装" })
    ];

    renderToolbar("娜美", jobs);

    expect(items()).toHaveLength(1);
    expect(hits()).toEqual(["娜美"]);
  });

  it("仅在文件夹名命中时标注命中来源", () => {
    const jobs = [job({ prompt: "一只猫" })];

    renderToolbar("测试", jobs);

    expect(items()).toHaveLength(1);
    expect(container.querySelector(".search-hit-source")?.textContent).toBe("文件夹名");
    expect(hits()).toEqual(["测试"]);
  });

  it("仅在反向提示词命中时展示反向提示词行与来源", () => {
    const jobs = [job({ prompt: "一只猫", negativePrompt: "lowres, bad anatomy" })];

    renderToolbar("lowres", jobs);

    expect(items()).toHaveLength(1);
    expect(container.querySelector(".search-hit-source")?.textContent).toBe("反向提示词");
    expect(container.querySelector(".search-dropdown-negative")).not.toBeNull();
    expect(hits()).toEqual(["lowres"]);
  });
});
