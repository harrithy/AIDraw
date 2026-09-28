import { describe, expect, it } from "vitest";
import type { DrawJob } from "../types";
import { fuzzyMatch, fuzzyMatchIndices, matchJobSearch, splitHighlight } from "./jobSearch";

/** 构造一个字段完整的测试任务，仅覆盖需要断言的字段。 */
const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "completed",
  prompt: "",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "standard",
  model: "gpt-image-2",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: "2026-09-23T19:49:05.000Z",
  updatedAt: "2026-09-23T19:49:05.000Z",
  ...overrides
});

describe("模糊匹配", () => {
  it("按子序列顺序命中并返回字符下标", () => {
    expect(fuzzyMatchIndices("生成一张娜美的泳装", "生成泳装")).toEqual([0, 1, 7, 8]);
    expect(fuzzyMatch("abc", "ac")).toBe(true);
    expect(fuzzyMatch("abc", "ca")).toBe(false);
  });

  it("空查询或空文本不算命中", () => {
    expect(fuzzyMatchIndices("abc", "")).toBeNull();
    expect(fuzzyMatchIndices("", "a")).toBeNull();
  });
});

/** 真实 UUID v4 任务 ID：version 位（下标 14）恒为字符 "4"。 */
const UUID_V4_ID = "2937e87e-efb5-44ce-a4db-bc95accb8dc6";
const UUID_V4_ID_ALT = "3e6abc3b-4615-4d95-9043-ab2b0803d27a";

describe("任务全局搜索", () => {
  const job = makeJob({
    prompt: "生成一张娜美的泳装",
    negativePrompt: "lowres, bad anatomy",
    folderId: "folder-test2"
  });
  const folderName = "测试2";

  it("UUID v4 任务 ID 中的固定字符 4 不再导致全量命中", () => {
    const uuidJob = makeJob({ id: UUID_V4_ID, prompt: "生成一张娜美的泳装" });

    expect(uuidJob.id[14]).toBe("4");
    expect(uuidJob.id).toContain("4");
    expect(matchJobSearch(uuidJob, folderName, "4")).toBeNull();
  });

  it("十六进制字母同样不再命中纯中文提示词", () => {
    const uuidJob = makeJob({ id: UUID_V4_ID_ALT, prompt: "生成一张娜美的泳装" });

    expect(matchJobSearch(uuidJob, folderName, "a")).toBeNull();
  });

  it("任务 ID 与状态已移出搜索范围", () => {
    const failedJob = makeJob({ id: "abc-123", prompt: "风景", status: "failed" });

    expect(matchJobSearch(failedJob, folderName, "abc-123")).toBeNull();
    expect(matchJobSearch(failedJob, folderName, "failed")).toBeNull();
  });

  it("提示词中真实的数字仍然可以搜到", () => {
    const hdJob = makeJob({ prompt: "4K 高清风景" });

    expect(matchJobSearch(hdJob, folderName, "4")?.promptIndices).toEqual([0]);
  });

  it("命中提示词时返回可高亮的字符下标", () => {
    const match = matchJobSearch(job, folderName, "娜美");

    expect(match?.promptIndices).toEqual([4, 5]);
    expect(match?.negativePromptIndices).toBeNull();
    expect(match?.folderIndices).toBeNull();
  });

  it("仅在反向提示词命中时标注来源", () => {
    const match = matchJobSearch(job, folderName, "lowres");

    expect(match).not.toBeNull();
    expect(match?.promptIndices).toBeNull();
    expect(match?.negativePromptIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("仅在文件夹名命中时标注来源", () => {
    const match = matchJobSearch(makeJob({ prompt: "一只猫" }), folderName, "测试");

    expect(match?.promptIndices).toBeNull();
    expect(match?.folderIndices).toEqual([0, 1]);
  });

  it("默认文件夹名参与匹配", () => {
    const match = matchJobSearch(makeJob({ prompt: "一只猫" }), "默认文件夹", "默认");

    expect(match?.folderIndices).toEqual([0, 1]);
  });

  it("多关键词要求全部命中，关键词可分散在不同字段", () => {
    // 提示词命中「生成一张」与「娜美」，两段高亮合并
    expect(matchJobSearch(job, folderName, "生成一张 娜美")?.promptIndices).toEqual([0, 1, 2, 3, 4, 5]);
    // 「泳装」只在提示词，「测试」只在文件夹名，两者都命中才算通过
    expect(matchJobSearch(job, folderName, "泳装 测试")).not.toBeNull();
    expect(matchJobSearch(job, folderName, "娜美 不存在的词")).toBeNull();
  });

  it("大小写不敏感且忽略首尾空白", () => {
    const englishJob = makeJob({ prompt: "Japanese JK swimsuit" });

    expect(matchJobSearch(englishJob, folderName, "  jk  ")?.promptIndices).toEqual([0, 10]);
  });

  it("空查询不返回结果", () => {
    expect(matchJobSearch(job, folderName, "   ")).toBeNull();
    expect(matchJobSearch(job, folderName, "")).toBeNull();
  });
});

describe("命中高亮切分", () => {
  it("按命中下标切分为命中/未命中片段", () => {
    expect(splitHighlight("娜美的泳装", [0, 1, 3, 4])).toEqual([
      { text: "娜美", hit: true },
      { text: "的", hit: false },
      { text: "泳装", hit: true }
    ]);
  });

  it("无命中下标时返回单个未命中片段", () => {
    expect(splitHighlight("娜美的泳装", null)).toEqual([{ text: "娜美的泳装", hit: false }]);
    expect(splitHighlight("", [0])).toEqual([]);
  });
});
