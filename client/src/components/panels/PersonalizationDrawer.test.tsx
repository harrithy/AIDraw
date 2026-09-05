import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultUiPreferences } from "../../lib/uiPreferences";
import { PersonalizationDrawer } from "./PersonalizationDrawer";

const messages = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn() }));
vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("../ui/message", () => ({ Message: messages }));

describe("PersonalizationDrawer 保存反馈", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("保存失败不提示成功、不清除待应用状态，重试成功后才确认", () => {
    const onCommit = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    act(() => root.render(
      <PersonalizationDrawer
        open
        preferences={createDefaultUiPreferences()}
        onOpenChange={vi.fn()}
        onPreview={vi.fn()}
        onPreviewPreset={vi.fn()}
        onPreviewReset={vi.fn()}
        onCancel={vi.fn()}
        onCommit={onCommit}
      />
    ));
    const reset = document.querySelector<HTMLButtonElement>('[aria-label="恢复默认布局"]');
    const apply = Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("应用设置"));
    expect(reset).toBeTruthy();
    expect(apply).toBeTruthy();
    act(() => reset!.click());
    expect(apply!.disabled).toBe(false);

    act(() => apply!.click());

    expect(messages.success).not.toHaveBeenCalled();
    expect(apply!.disabled).toBe(false);
    expect(document.body.textContent).toContain("有未保存的调整");

    act(() => apply!.click());

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(messages.success).toHaveBeenCalledExactlyOnceWith("已应用个性化设置");
    expect(apply!.disabled).toBe(true);
  });
});
