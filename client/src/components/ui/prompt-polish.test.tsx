import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  polishWithDeepSeek: vi.fn(),
  getSettings: vi.fn(),
  messageError: vi.fn(),
  messageInfo: vi.fn(),
  messageSuccess: vi.fn()
}));

vi.mock("radix-ui", () => ({
  DropdownMenu: {
    Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    Trigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Separator: () => <hr />,
    Item: ({
      children,
      onSelect
    }: {
      children: ReactNode;
      onSelect?: (event: { preventDefault: () => void }) => void;
    }) => (
      <button type="button" onClick={() => onSelect?.({ preventDefault: () => undefined })}>
        {children}
      </button>
    )
  }
}));

vi.mock("@/lib/deepseekApi", () => ({
  DEEPSEEK_MODEL_LABELS: {
    "deepseek-v4-pro": "deepseek-v4-pro（质量优先）",
    "deepseek-v4-flash": "deepseek-v4-flash（更快更省）",
    "deepseek-v4-flash-vision-exp": "deepseek-v4-flash-vision-exp（看图润写）"
  },
  DEEPSEEK_THINKING_LABELS: { off: "关闭", low: "低", high: "高", max: "最高" },
  PROMPT_POLISH_STYLE_LABELS: { enhance: "细节增强", concise: "更简洁", english: "翻译成英文" },
  getDeepSeekApiKey: () => "sk-deepseek-test",
  isDeepSeekVisionModel: (model: string) => model === "deepseek-v4-flash-vision-exp",
  polishWithDeepSeek: mocks.polishWithDeepSeek
}));

vi.mock("@/lib/storage/settings", () => ({ getSettings: mocks.getSettings }));
vi.mock("@/components/ui/message", () => ({
  Message: {
    error: mocks.messageError,
    info: mocks.messageInfo,
    success: mocks.messageSuccess
  }
}));

import { PromptPolish } from "./prompt-polish";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const findStyleButton = () =>
  Array.from(document.body.querySelectorAll("button")).find(
    (button) => button.textContent === "细节增强"
  ) as HTMLButtonElement;

describe("PromptPolish", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.getSettings.mockResolvedValue({});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("只在润写完整成功后一次性覆盖提示词", async () => {
    mocks.polishWithDeepSeek.mockResolvedValue("完整的新提示词");
    const onPolished = vi.fn();
    act(() => root.render(<PromptPolish text="原始提示词" onPolished={onPolished} />));

    await act(async () => findStyleButton().click());

    expect(onPolished).toHaveBeenCalledTimes(1);
    expect(onPolished).toHaveBeenCalledWith("完整的新提示词");
  });

  it("流式请求失败时保留原提示词", async () => {
    mocks.polishWithDeepSeek.mockRejectedValue(new Error("网络中断"));
    const onPolished = vi.fn();
    act(() => root.render(<PromptPolish text="不能丢失的原文" onPolished={onPolished} />));

    await act(async () => findStyleButton().click());

    expect(onPolished).not.toHaveBeenCalled();
    expect(mocks.messageError).toHaveBeenCalledWith("网络中断");
  });

  it("请求期间用户修改了提示词时不覆盖新输入", async () => {
    let resolvePolish: ((value: string) => void) | undefined;
    mocks.polishWithDeepSeek.mockImplementation(
      () => new Promise<string>((resolve) => { resolvePolish = resolve; })
    );
    const onPolished = vi.fn();
    act(() => root.render(<PromptPolish text="原始提示词" onPolished={onPolished} />));

    act(() => findStyleButton().click());
    await vi.waitFor(() => expect(mocks.polishWithDeepSeek).toHaveBeenCalledTimes(1));
    act(() => root.render(<PromptPolish text="用户刚输入的新内容" onPolished={onPolished} />));
    await act(async () => resolvePolish?.("AI 返回的结果"));

    expect(onPolished).not.toHaveBeenCalled();
    expect(mocks.messageInfo).toHaveBeenCalledWith("润写期间提示词已被修改，本次结果未覆盖你的新内容");
  });
});
