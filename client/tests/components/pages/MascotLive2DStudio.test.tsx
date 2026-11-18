import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMascotLive2D, type MascotLive2DController } from "@/lib/mascotLive2D";
import { MascotLive2DStudio } from "@/components/pages/MascotLive2DStudio";

vi.mock("@/lib/mascotLive2D", () => ({ createMascotLive2D: vi.fn() }));

describe("Live2D 加载与回收", () => {
  let container: HTMLDivElement;
  let root: Root;
  const controller = (): MascotLive2DController => ({ setPaused: vi.fn(), play: vi.fn(), reset: vi.fn(), destroy: vi.fn() });

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.mocked(createMascotLive2D).mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("失败时保留原画，允许重试并在退出时销毁成功加载的模型", async () => {
    const loaded = controller();
    vi.mocked(createMascotLive2D).mockRejectedValueOnce(new Error("资源不可用")).mockResolvedValueOnce(loaded);
    await act(async () => root.render(<MascotLive2DStudio />));
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/mascot/aidraw-girl-2d-v1.png");
    expect(container.textContent).toContain("暂时无法加载");
    await act(async () => container.querySelector<HTMLButtonElement>(".mascot-live2d-fallback button")!.click());
    expect(container.querySelector(".mascot-live2d-fallback")).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="暂停 Live2D"]')!.click());
    expect(loaded.setPaused).toHaveBeenLastCalledWith(true);
    await act(async () => root.render(null));
    expect(loaded.destroy).toHaveBeenCalledOnce();
  });

  it("离开后才完成的加载也立即释放，不向已卸载组件写状态", async () => {
    let resolve!: (value: MascotLive2DController) => void;
    vi.mocked(createMascotLive2D).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await act(async () => root.render(<MascotLive2DStudio />));
    const signal = vi.mocked(createMascotLive2D).mock.calls[0][1];
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
    const late = controller();
    await act(async () => resolve(late));
    expect(late.destroy).toHaveBeenCalledOnce();
  });

  it("新增动作可重播，暂停后点动作会继续播放，结束时恢复陪伴", async () => {
    const loaded = controller();
    vi.mocked(createMascotLive2D).mockResolvedValueOnce(loaded);
    await act(async () => root.render(<MascotLive2DStudio />));
    expect(container.querySelectorAll(".mascot-live2d-actions button")).toHaveLength(8);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="暂停 Live2D"]')!.click());
    const actions = [["眨单眼", "wink"], ["摇头", "shake"], ["张望", "lookAround"], ["开心笑", "smile"]] as const;
    for (const [label, id] of actions) {
      const button = [...container.querySelectorAll<HTMLButtonElement>(".mascot-live2d-actions button")].find((item) => item.textContent === label)!;
      await act(async () => button.click());
      expect(loaded.play).toHaveBeenLastCalledWith(id);
      expect(button.getAttribute("aria-pressed")).toBe("true");
    }
    expect(loaded.setPaused).toHaveBeenLastCalledWith(false);
    const smile = container.querySelector<HTMLButtonElement>('.mascot-live2d-actions button:last-child')!;
    const count = vi.mocked(loaded.play).mock.calls.length;
    await act(async () => smile.click());
    expect(loaded.play).toHaveBeenCalledTimes(count + 1);
    await act(async () => vi.mocked(createMascotLive2D).mock.calls[0][2]());
    expect(container.querySelector(".mascot-live2d-actions button")?.getAttribute("aria-pressed")).toBe("true");
  });
});
