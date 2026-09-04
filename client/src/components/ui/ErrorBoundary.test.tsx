import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";

// 可受控抛错的测试组件
function ProblematicChild({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message || "Test Render Crash");
  }
  return <div id="normal-content">正常渲染内容</div>;
}

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
    expect(container.textContent).toContain("紧急导出全部数据备份");
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
});
