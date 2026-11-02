import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateJobPanel } from "./CreateJobPanel";
import { createCustomProviderTemplate } from "../../lib/customProviders";

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("@/components/ui/prompt-polish", () => ({ PromptPolish: () => null }));

describe("CreateJobPanel 暂停多米能力", () => {
  it("自定义中转模型可恢复草稿并绑定提交，不被内置模型校验重置", async () => {
    const config = { ...createCustomProviderTemplate(), baseUrl: "https://relay.example", models: ["my-model"] };
    localStorage.setItem("aidraw-draft-custom-folder", JSON.stringify({ prompt: "custom prompt", count: 1, model: "my-model" }));
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<CreateJobPanel activeFolderId="custom-folder" apiProviderId="duomi" customProvider={{ config, hasApiKey: true, apiKeyMasked: "masked" }} isSubmitting={false} variant="composer" onSubmit={onSubmit} onUploadImage={vi.fn()} />));
    expect(container.textContent).toContain("my-model");
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ customProviderId: config.id, model: "my-model", prompt: "custom prompt" });
  });
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it.each(["composer", "panel"] as const)("%s 不允许切换，旧能力草稿仍按模型提交", async (variant) => {
    // 覆盖旧草稿绕过禁用按钮的入口，并确认已有提示词和数量得到保留。
    localStorage.setItem("aidraw-draft-folder-test", JSON.stringify({
      prompt: "山间的小屋",
      count: 2,
      model: "gpt-image-2",
      creationMode: "capability",
      capabilityId: "image.gpt-image-2"
    }));
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(
      <CreateJobPanel
        activeFolderId="folder-test"
        apiProviderId="duomi"
        isSubmitting={false}
        variant={variant}
        onSubmit={onSubmit}
        onUploadImage={vi.fn()}
      />
    ));

    const capabilityButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("多米能力"));
    expect(capabilityButton?.disabled).toBe(true);
    act(() => capabilityButton!.click());
    expect(capabilityButton?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(".duomi-capability-panel")).toBeNull();

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      prompt: "山间的小屋",
      count: 2,
      model: "gpt-image-2"
    });
    expect(onSubmit.mock.calls[0][0].capabilityId).toBeUndefined();
  });
});
