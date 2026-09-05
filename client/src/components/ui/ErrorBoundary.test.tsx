import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";
import { parseImportBackups } from "../../lib/folderBackup";

// 可受控抛错的测试组件
function ProblematicChild({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message || "Test Render Crash");
  }
  return <div id="normal-content">正常渲染内容</div>;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ErrorBoundary component", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalConsoleError = console.error;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // 屏蔽 React 在发生捕获异常时向控制台打印的冗余错误
    console.error = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    console.error = originalConsoleError;
  });

  it("renders children normally without errors", () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <ProblematicChild shouldThrow={false} />
        </ErrorBoundary>
      );
    });

    const normal = container.querySelector("#normal-content");
    expect(normal).not.toBeNull();
    expect(normal?.textContent).toBe("正常渲染内容");
  });

  it("catches render error and displays rescue UI", () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <ProblematicChild shouldThrow={true} message="AI 绘图测试抛错" />
        </ErrorBoundary>
      );
    });

    // 正常内容不应存在
    expect(container.querySelector("#normal-content")).toBeNull();

    // 救灾界面应正确展示
    expect(container.textContent).toContain("AI 绘图测试抛错");
    expect(container.textContent).toContain("刷新重试");
    expect(container.textContent).toContain("原地恢复");
    expect(container.textContent).toContain("紧急导出数据备份（已脱敏）");
    expect(container.textContent).toContain("重置界面偏好并刷新");
  });

  it("calls onError callback with error and errorInfo when caught", () => {
    const onError = vi.fn();

    act(() => {
      root.render(
        <ErrorBoundary onError={onError}>
          <ProblematicChild shouldThrow={true} message="回调测试异常" />
        </ErrorBoundary>
      );
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("回调测试异常");
    expect(onError.mock.calls[0][1]).toHaveProperty("componentStack");
  });

  it("displays scope in title when scope prop is provided", () => {
    act(() => {
      root.render(
        <ErrorBoundary scope="画布工作区">
          <ProblematicChild shouldThrow={true} message="画布发生故障" />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).toContain("画布工作区异常拦截");
    expect(container.textContent).toContain("画布工作区渲染遇到了意外错误");
  });

  it("supports custom function fallback and in-place reset", () => {
    let shouldCrash = true;

    function DynamicChild() {
      if (shouldCrash) {
        throw new Error("动态故障");
      }
      return <div id="recovered-content">已成功恢复正常</div>;
    }

    act(() => {
      root.render(
        <ErrorBoundary
          fallback={(error, reset) => (
            <div>
              <span id="error-msg">{error.message}</span>
              <button id="reset-btn" onClick={reset}>
                重置
              </button>
            </div>
          )}
        >
          <DynamicChild />
        </ErrorBoundary>
      );
    });

    expect(container.querySelector("#error-msg")?.textContent).toBe("动态故障");

    // 修复故障并触发 reset
    shouldCrash = false;
    const btn = container.querySelector("#reset-btn") as HTMLButtonElement;
    act(() => {
      btn.click();
    });

    expect(container.querySelector("#recovered-content")?.textContent).toBe("已成功恢复正常");
  });

  it("removes all current and legacy preference keys on handleResetPreferences", () => {
    localStorage.setItem("aidraw-ui-preferences-v1", '{"corrupt": true}');
    localStorage.setItem("aidraw-theme", "dark");
    localStorage.setItem("aidraw-pet-enabled", "false");
    localStorage.setItem("aidraw-ui-preferences", '{"legacy": true}');
    localStorage.setItem("aidraw-page-preferences", '{"legacyPage": true}');

    // 拦截 window.location.reload
    const originalReload = window.location.reload;
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadMock }
    });

    try {
      act(() => {
        root.render(
          <ErrorBoundary>
            <ProblematicChild shouldThrow={true} message="测试崩溃偏好重置" />
          </ErrorBoundary>
        );
      });

      const buttons = container.querySelectorAll("button.error-action-btn");
      const resetPrefBtn = Array.from(buttons).find((btn) =>
        btn.textContent?.includes("重置界面偏好并刷新")
      ) as HTMLButtonElement;

      expect(resetPrefBtn).not.toBeNull();
      act(() => {
        resetPrefBtn.click();
      });

      expect(localStorage.getItem("aidraw-ui-preferences-v1")).toBeNull();
      expect(localStorage.getItem("aidraw-theme")).toBeNull();
      expect(localStorage.getItem("aidraw-pet-enabled")).toBeNull();
      expect(localStorage.getItem("aidraw-ui-preferences")).toBeNull();
      expect(localStorage.getItem("aidraw-page-preferences")).toBeNull();
      expect(reloadMock).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, reload: originalReload }
      });
    }
  });

  it("filters sensitive API keys from settings store in emergency backup", async () => {
    const database = await import("../../lib/storage/database");
    const mockSettings = [
      {
        providerId: "duomi",
        baseUrl: "https://duomiapi.com",
        apiKey: "sk-plain-secret-to-be-stripped",
        savedApiKeys: ["sk-plain-secret-to-be-stripped", "sk-another-secret-999"],
        savedApiKeyProviderIds: ["duomi", "grsai"],
        model: "gpt-image-2"
      }
    ];

    const mockDb = {
      objectStoreNames: {
        contains: (name: string) =>
          [database.FOLDER_STORE, database.JOB_STORE, database.UPLOADED_IMAGE_STORE, database.SETTINGS_STORE].includes(
            name
          )
      },
      transaction: (name: string) => ({
        objectStore: () => ({
          getAll: () => {
            const req: { result?: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
              onsuccess: null,
              onerror: null
            };
            setTimeout(() => {
              if (name === database.SETTINGS_STORE) req.result = mockSettings;
              else if (name === database.FOLDER_STORE) req.result = [{ id: "f-1", name: "默认" }];
              else req.result = [];
              req.onsuccess?.();
            }, 0);
            return req;
          }
        })
      })
    } as unknown as IDBDatabase;

    const openDbSpy = vi.spyOn(database, "openDb").mockResolvedValue(mockDb);

    let exportedBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      exportedBlob = blob;
      return "blob:mock-url";
    });
    URL.revokeObjectURL = vi.fn();

    try {
      act(() => {
        root.render(
          <ErrorBoundary>
            <ProblematicChild shouldThrow={true} message="测试备份脱敏" />
          </ErrorBoundary>
        );
      });

      const buttons = container.querySelectorAll("button.error-action-btn");
      const backupBtn = Array.from(buttons).find((btn) =>
        btn.textContent?.includes("紧急导出数据备份（已脱敏）")
      ) as HTMLButtonElement;

      expect(backupBtn).not.toBeNull();

      await act(async () => {
        backupBtn.click();
        // 等待异步读库与文件生成
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(exportedBlob).not.toBeNull();
      const text = await (exportedBlob as unknown as Blob).text();
      const json = JSON.parse(text);

      expect(json.format).toBe("aidraw-emergency-backup");
      expect(json.securityNotice).toContain("Sensitive API credentials");
      // 确认明文已完全脱敏
      expect(json.settings[0].apiKey).toBe("");
      expect(json.settings[0].savedApiKeys).toEqual([]);
      expect(json.settings[0].savedApiKeyProviderIds).toEqual([]);
      expect(text).not.toContain("sk-plain-secret-to-be-stripped");
      expect(text).not.toContain("sk-another-secret-999");
      // 保留非敏感字段
      expect(json.settings[0].baseUrl).toBe("https://duomiapi.com");
      expect(json.settings[0].model).toBe("gpt-image-2");
      expect(parseImportBackups(json)).toHaveLength(1);
    } finally {
      openDbSpy.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
