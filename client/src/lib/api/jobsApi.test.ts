import { describe, expect, it, vi } from "vitest";
import type { DrawJob } from "../../types";
import { jobsApi } from "./jobsApi";

const mockJobs: Partial<DrawJob>[] = [
  {
    id: "job-1",
    folderId: "folder-a",
    prompt: "A cyber cat girl",
    status: "completed",
    createdAt: "2026-06-01T10:00:00.000Z"
  },
  {
    id: "job-2",
    folderId: "folder-b",
    prompt: "Futuristic city with neon lights",
    status: "completed",
    createdAt: "2026-06-02T12:00:00.000Z"
  }
];

vi.mock("../storage/database", () => ({
  JOB_STORE: "jobs",
  FOLDER_STORE: "folders",
  openDb: vi.fn(async () => ({
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        getAll: vi.fn(() => {
          const req: { result: Partial<DrawJob>[]; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            result: [...mockJobs],
            onsuccess: null,
            onerror: null
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        })
      }))
    }))
  }))
}));

describe("jobsApi", () => {
  it("listAllJobs returns all jobs across folders sorted by createdAt desc", async () => {
    const results = await jobsApi.listAllJobs();
    expect(results).toHaveLength(2);
    // Should be sorted createdAt descending: job-2 (June 2) before job-1 (June 1)
    expect(results[0].id).toBe("job-2");
    expect(results[1].id).toBe("job-1");
  });
});
