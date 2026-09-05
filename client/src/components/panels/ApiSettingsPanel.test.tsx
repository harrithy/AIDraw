import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ApiSettingsPanel } from "./ApiSettingsPanel";
import type { ImageProviderSettings } from "../../types";

const mockSettings: ImageProviderSettings = {
  providerId: "duomi",
  baseUrl: "https://duomiapi.com",
  model: "gpt-image-2",
  hasApiKey: true,
  apiKeyMasked: "sk-d...1111",
  savedApiKeysMasked: ["sk-d...1111", "sk-g...2222", "sk-p...3333"],
  savedApiKeyProviderIds: ["duomi", "grsai", "deepseek"],
  activeApiKeyIndex: 0
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ApiSettingsPanel component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders saved credentials list with badges and active marker", () => {
    act(() => {
      root.render(
        <ApiSettingsPanel
          settings={mockSettings}
          onSave={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("已保存凭据管理 (3)");
    expect(container.textContent).toContain("sk-d...1111");
    expect(container.textContent).toContain("sk-g...2222");
    expect(container.textContent).toContain("sk-p...3333");
    expect(container.textContent).toContain("使用中");
    expect(container.textContent).toContain("取消激活");
    expect(container.textContent).toContain("使用");
  });

  it("calls onSave with clearApiKey when cancel-activation button is clicked", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <ApiSettingsPanel
          settings={mockSettings}
          onSave={onSave}
        />
      );
    });

    const deactivateBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("取消激活")
    );
    expect(deactivateBtn).not.toBeUndefined();

    await act(async () => {
      deactivateBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith({ clearApiKey: true });
  });

  it("calls onSave with setActiveApiKeyIndex when activate button is clicked on inactive key", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <ApiSettingsPanel
          settings={mockSettings}
          onSave={onSave}
        />
      );
    });

    // 索引 1 是 grsai 密钥，未激活，显示“使用”按钮
    const activateBtn = Array.from(container.querySelectorAll(".saved-key-btn-action.activate")).find(
      (btn) => btn.textContent?.includes("使用")
    );
    expect(activateBtn).not.toBeUndefined();

    await act(async () => {
      (activateBtn as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledWith({ setActiveApiKeyIndex: 1 });
  });

  it("prompts with confirm and calls onSave with deleteApiKeyIndex when delete button is clicked", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirmSpy);

    act(() => {
      root.render(
        <ApiSettingsPanel
          settings={mockSettings}
          onSave={onSave}
        />
      );
    });

    const deleteBtns = container.querySelectorAll(".saved-key-btn-del");
    expect(deleteBtns.length).toBe(3);

    await act(async () => {
      (deleteBtns[1] as HTMLButtonElement).click();
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain("sk-g...2222");
    expect(onSave).toHaveBeenCalledWith({ deleteApiKeyIndex: 1 });

  });

  it("does not call onSave when delete confirmation is cancelled", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirmSpy);

    act(() => {
      root.render(
        <ApiSettingsPanel
          settings={mockSettings}
          onSave={onSave}
        />
      );
    });

    const deleteBtns = container.querySelectorAll(".saved-key-btn-del");

    await act(async () => {
      (deleteBtns[0] as HTMLButtonElement).click();
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();

  });
});
