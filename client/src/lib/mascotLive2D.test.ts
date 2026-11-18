import { describe, expect, it } from "vitest";
import { getMascotLive2DFrame, MASCOT_LIVE2D_ACTION_DURATIONS, type MascotLive2DAction } from "./mascotLive2D";

describe("原创 Live2D 动作边界", () => {
  it("指针离开画布后可以回到正视，越界输入不会拉伸眼睛", () => {
    const neutral = getMascotLive2DFrame(0, "idle", 0, { x: 0, y: 0 });
    expect(neutral.ParamEyeBallX).toBe(0);
    expect(neutral.ParamEyeBallY).toBe(0);
    const outside = getMascotLive2DFrame(0, "idle", 0, { x: 9, y: -8 });
    expect(outside.ParamEyeBallX).toBeLessThanOrEqual(1);
    expect(outside.ParamEyeBallY).toBeGreaterThanOrEqual(-1);
    expect(Math.abs(outside.ParamAngleX)).toBeLessThanOrEqual(30);
    expect(Math.abs(outside.ParamAngleY)).toBeLessThanOrEqual(30);
  });

  it("眨眼后双眼重新睁开，歪头与点头结束后回到待机幅度", () => {
    const focus = { x: 0, y: 0 };
    const closed = getMascotLive2DFrame(0, "blink", 0.3, focus);
    expect(closed.ParamEyeLOpen).toBeCloseTo(0);
    expect(closed.ParamEyeROpen).toBeCloseTo(0);
    const reopened = getMascotLive2DFrame(0, "blink", 0.8, focus);
    expect(reopened.ParamEyeLOpen).toBeCloseTo(1);
    for (const action of ["nod", "tilt"] as const) {
      expect(getMascotLive2DFrame(0, action, 2, focus).ParamAngleZ).toBeCloseTo(0);
      expect(getMascotLive2DFrame(0, action, 2, focus).ParamAngleY).toBeCloseTo(0);
    }
  });

  it("眨单眼时保持另一只眼睁开，开心笑则同时闭眼", () => {
    // 即便恰逢自动眨眼，单眼动作中另一只眼也保持睁开。
    const wink = getMascotLive2DFrame(3.21, "wink", 0.6, { x: 0, y: 0 });
    expect(wink.ParamEyeLOpen).toBeCloseTo(0);
    expect(wink.ParamEyeROpen).toBeCloseTo(1);
    const smile = getMascotLive2DFrame(0, "smile", 1.2, { x: 0, y: 0 });
    expect(smile.ParamEyeLOpen).toBeCloseTo(0);
    expect(smile.ParamEyeROpen).toBeCloseTo(0);
    expect(smile.ParamAngleZ).toBeLessThan(0);
  });

  it("摇头和张望都覆盖左右方向，张望首尾归还指针跟随", () => {
    const focus = { x: 0, y: 0 };
    const shaking = Array.from({ length: 21 }, (_, i) => getMascotLive2DFrame(0, "shake", i / 10, focus).ParamAngleX);
    expect(Math.min(...shaking)).toBeLessThan(-15);
    expect(Math.max(...shaking)).toBeGreaterThan(15);
    const right = getMascotLive2DFrame(0, "lookAround", 0.8, focus);
    const left = getMascotLive2DFrame(0, "lookAround", 2.4, focus);
    expect(right.ParamEyeBallX).toBeGreaterThan(0.8);
    expect(left.ParamEyeBallX).toBeLessThan(-0.8);
    expect(right.ParamAngleX).toBeGreaterThan(20);
    expect(left.ParamAngleX).toBeLessThan(-20);
  });

  it("全部动作在极端指针位置也不越界，结束后回到相同的待机姿态", () => {
    const focus = { x: 9, y: -8 };
    for (const action of Object.keys(MASCOT_LIVE2D_ACTION_DURATIONS) as MascotLive2DAction[]) {
      const duration = MASCOT_LIVE2D_ACTION_DURATIONS[action];
      for (let step = 0; step <= 20; step++) {
        const frame = getMascotLive2DFrame(0.5, action, duration * step / 20, focus);
        for (const [id, value] of Object.entries(frame)) {
          expect(Number.isFinite(value), `${action}: ${id}`).toBe(true);
          if (id.startsWith("ParamAngle")) expect(Math.abs(value)).toBeLessThanOrEqual(30);
          else if (id.endsWith("Open") || id === "ParamBreath") {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
          } else expect(Math.abs(value)).toBeLessThanOrEqual(1);
        }
      }
      const rest = getMascotLive2DFrame(0.5, "idle", 0, focus);
      const ended = getMascotLive2DFrame(0.5, action, duration + 0.1, focus);
      for (const id of Object.keys(rest) as (keyof typeof rest)[]) expect(ended[id], `${action}: ${id}`).toBeCloseTo(rest[id]);
    }
  });
});
