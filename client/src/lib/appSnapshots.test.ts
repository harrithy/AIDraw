import { describe, expect, it } from "vitest";
import type { DrawJob, ImageProviderSettings, QueueStats } from "../types";
import {
  areJobSnapshotsEqual,
  getLatestOutputTime,
  isSameProviderSettings,
  isSameQueue
} from "./appSnapshots";

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "completed",
  prompt: "测试",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "high",
  model: "gpt-image-2",
  orderIndex: 0,
  posX: 100,
  posY: 200,
  hasCustomPosition: false,
  createdAt: "2026-06-25T07:00:00.000Z",
  updatedAt: "2026-06-25T07:05:00.000Z",
  completedAt: "2026-06-25T07:05:00.000Z",
  ...overrides
});

const makeProviderSettings = (
  overrides: Partial<ImageProviderSettings> = {}
): ImageProviderSettings => ({
  providerId: "duomi",
  baseUrl: "https://duomiapi.com",
  model: "gpt-image-2",
  hasApiKey: true,
  apiKeyMasked: "sk-d...1234",
  savedApiKeysMasked: ["sk-d...1234", "sk-g...5678"],
  savedApiKeyProviderIds: ["duomi", "grsai"],
  activeApiKeyIndex: 0,
  ...overrides
});

describe("appSnapshots", () => {
  describe("getLatestOutputTime", () => {
    it("prefers completedAt over updatedAt and createdAt", () => {
      const job = makeJob({
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        completedAt: "2026-01-03T00:00:00.000Z"
      });
      expect(getLatestOutputTime(job)).toBe(Date.parse("2026-01-03T00:00:00.000Z"));
    });

    it("falls back to updatedAt when completedAt is missing", () => {
      const job = makeJob({
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        completedAt: undefined
      });
      expect(getLatestOutputTime(job)).toBe(Date.parse("2026-01-02T00:00:00.000Z"));
    });

    it("returns 0 for invalid date strings", () => {
      const job = makeJob({
        createdAt: "invalid-date",
        updatedAt: undefined,
        completedAt: undefined
      });
      expect(getLatestOutputTime(job)).toBe(0);
    });
  });

  describe("areJobSnapshotsEqual", () => {
    it("returns true for identical job lists", () => {
      const a = [makeJob({ id: "1" }), makeJob({ id: "2" })];
      const b = [makeJob({ id: "1" }), makeJob({ id: "2" })];
      expect(areJobSnapshotsEqual(a, b)).toBe(true);
    });

    it("returns false when lengths differ", () => {
      const a = [makeJob({ id: "1" })];
      const b = [makeJob({ id: "1" }), makeJob({ id: "2" })];
      expect(areJobSnapshotsEqual(a, b)).toBe(false);
    });

    it("returns false when a job position or timestamp changes", () => {
      const a = [makeJob({ id: "1", posX: 100 })];
      const b = [makeJob({ id: "1", posX: 150 })];
      expect(areJobSnapshotsEqual(a, b)).toBe(false);

      const c = [makeJob({ id: "1", updatedAt: "2026-01-01T00:00:00.000Z" })];
      const d = [makeJob({ id: "1", updatedAt: "2026-01-02T00:00:00.000Z" })];
      expect(areJobSnapshotsEqual(c, d)).toBe(false);
    });
  });

  describe("isSameQueue", () => {
    it("returns true when running, pending, and maxConcurrent are equal", () => {
      const q1: QueueStats = { running: 2, pending: 5, maxConcurrent: 30 };
      const q2: QueueStats = { running: 2, pending: 5, maxConcurrent: 30 };
      expect(isSameQueue(q1, q2)).toBe(true);
    });

    it("returns false when any metric changes", () => {
      const q1: QueueStats = { running: 2, pending: 5, maxConcurrent: 30 };
      expect(isSameQueue(q1, { ...q1, running: 3 })).toBe(false);
      expect(isSameQueue(q1, { ...q1, pending: 6 })).toBe(false);
      expect(isSameQueue(q1, { ...q1, maxConcurrent: 10 })).toBe(false);
    });
  });

  describe("isSameProviderSettings", () => {
    it("returns true for deeply equal provider settings", () => {
      const s1 = makeProviderSettings();
      const s2 = makeProviderSettings();
      expect(isSameProviderSettings(s1, s2)).toBe(true);
    });

    it("returns false when provider, active index, or keys list change", () => {
      const s1 = makeProviderSettings();
      expect(isSameProviderSettings(s1, { ...s1, providerId: "grsai" })).toBe(false);
      expect(isSameProviderSettings(s1, { ...s1, activeApiKeyIndex: 1 })).toBe(false);
      expect(isSameProviderSettings(s1, { ...s1, savedApiKeysMasked: ["sk-different"] })).toBe(false);
      expect(isSameProviderSettings(s1, { ...s1, hasApiKey: false })).toBe(false);
    });
  });
});
