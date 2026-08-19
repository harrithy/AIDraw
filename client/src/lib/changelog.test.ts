import { describe, expect, it, beforeEach } from "vitest";
import {
  checkHasUnreadRelease,
  markReleaseAsRead,
  markAllReleasesAsRead,
  getUnreadReleasesCount,
  isReleaseRead,
  syncAndGetAllReleases,
  getStoredReleases,
  LATEST_RELEASE,
  INITIAL_RELEASES,
  RELEASE_STORAGE_KEY,
  RELEASE_HISTORY_STORAGE_KEY,
  type ReleaseNote
} from "./changelog";

describe("changelog and release announcement system", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("should have valid release notes structure", () => {
    expect(INITIAL_RELEASES.length).toBeGreaterThan(0);
    expect(LATEST_RELEASE.version).toBe("v1.3.1");
    expect(LATEST_RELEASE.title).toBeTruthy();
    expect(LATEST_RELEASE.items.length).toBeGreaterThan(0);
  });

  it("should detect unread release count when localStorage is empty", () => {
    expect(getUnreadReleasesCount()).toBe(INITIAL_RELEASES.length);
    expect(checkHasUnreadRelease()).toBe(true);
  });

  it("should mark single release as read and decrement unread count", () => {
    markReleaseAsRead(LATEST_RELEASE.version);
    expect(isReleaseRead(LATEST_RELEASE.version)).toBe(true);
    expect(getUnreadReleasesCount()).toBe(INITIAL_RELEASES.length - 1);
  });

  it("should mark all releases as read", () => {
    markAllReleasesAsRead();
    expect(getUnreadReleasesCount()).toBe(0);
    expect(checkHasUnreadRelease()).toBe(false);
  });

  it("should accumulate and preserve historical releases in local storage", () => {
    const legacyRelease: ReleaseNote = {
      version: "v0.9.0-alpha",
      title: "远古测试版",
      date: "2026-07-15",
      summary: "最早的内测版本",
      items: [
        {
          category: "feature",
          title: "初版雏形",
          description: "测试雏形功能"
        }
      ]
    };
    window.localStorage.setItem(
      RELEASE_HISTORY_STORAGE_KEY,
      JSON.stringify([legacyRelease])
    );

    const allReleases = syncAndGetAllReleases();
    expect(allReleases.some((r) => r.version === "v0.9.0-alpha")).toBe(true);
    expect(allReleases.some((r) => r.version === LATEST_RELEASE.version)).toBe(true);

    const stored = getStoredReleases();
    expect(stored.some((r) => r.version === "v0.9.0-alpha")).toBe(true);
    expect(stored.some((r) => r.version === LATEST_RELEASE.version)).toBe(true);
  });
});
