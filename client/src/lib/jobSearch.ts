import type { DrawJob } from "../types";

/**
 * 全局搜索的匹配范围。
 *
 * 注意：这里刻意**不包含** `job.id` 与 `job.status`。
 * 任务 ID 由 `crypto.randomUUID()` 生成（UUID v4），其中 version 位恒为字符 "4"，
 * 一旦把 ID 纳入子序列模糊匹配，输入单个 "4"（以及 0-9a-f 中任意字符）就会命中几乎所有任务。
 */
const SEARCHABLE_FIELDS = ["prompt", "negativePrompt", "folder"] as const;

/** 命中来源字段。 */
export type JobSearchSource = (typeof SEARCHABLE_FIELDS)[number];

/** 单条任务的搜索命中详情，包含用于高亮的字符下标。 */
export type JobSearchMatch = {
  /** 命中正向提示词的字符下标；未命中时为 null */
  promptIndices: number[] | null;
  /** 命中反向提示词的字符下标；未命中时为 null */
  negativePromptIndices: number[] | null;
  /** 命中所在文件夹名的字符下标；未命中时为 null */
  folderIndices: number[] | null;
};

/**
 * 子序列模糊匹配：pattern 的字符需按顺序出现在 str 中，但不要求连续。
 * @returns 命中时返回每个 pattern 字符在 str 中的下标数组；未命中返回 null。
 */
export const fuzzyMatchIndices = (str: string, pattern: string): number[] | null => {
  if (!pattern || !str) return null;
  const haystack = str.toLowerCase();
  const needle = pattern.toLowerCase();
  const indices: number[] = [];
  let needleIdx = 0;
  for (let haystackIdx = 0; haystackIdx < haystack.length && needleIdx < needle.length; haystackIdx++) {
    if (needle[needleIdx] === haystack[haystackIdx]) {
      indices.push(haystackIdx);
      needleIdx++;
    }
  }
  return needleIdx === needle.length ? indices : null;
};

/** 子序列模糊匹配的布尔版本。 */
export const fuzzyMatch = (str: string, pattern: string): boolean => fuzzyMatchIndices(str, pattern) !== null;

/**
 * 收集某个字段上所有关键词的命中下标（多个关键词命中同一字段时取并集）。
 * @returns 该字段一个关键词都没命中时返回 null。
 */
const collectFieldIndices = (text: string, patterns: string[]): number[] | null => {
  if (!text) return null;
  const merged = new Set<number>();
  for (const pattern of patterns) {
    const indices = fuzzyMatchIndices(text, pattern);
    if (indices) indices.forEach((index) => merged.add(index));
  }
  return merged.size > 0 ? [...merged].sort((a, b) => a - b) : null;
};

/**
 * 判断任务是否命中搜索词，并返回用于高亮的字符下标。
 *
 * 匹配语义：空格分隔的每个关键词都必须能在「提示词 / 反向提示词 / 文件夹名」
 * 之一中模糊命中（不同关键词可以命中不同字段）。
 *
 * @param job - 待匹配任务
 * @param folderName - 任务所在文件夹的显示名
 * @param query - 搜索框内容
 * @returns 命中详情；未命中返回 null
 */
export const matchJobSearch = (job: DrawJob, folderName: string, query: string): JobSearchMatch | null => {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return null;

  const keywords = normalized.split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return null;

  const texts: Record<JobSearchSource, string> = {
    prompt: job.prompt,
    negativePrompt: job.negativePrompt ?? "",
    folder: folderName
  };

  // 每个关键词都必须在某个字段中模糊命中（关键词可分散在不同字段）。
  // 原实现的「整串查询命中同一字段」兜底是死分支：若含空格的整串是某字段的子序列，
  // 则每个关键词必然也是该字段的子序列，因此已被下面的 every 完全覆盖。
  const everyKeywordMatched = keywords.every((keyword) =>
    SEARCHABLE_FIELDS.some((field) => fuzzyMatch(texts[field], keyword))
  );
  if (!everyKeywordMatched) return null;

  return {
    promptIndices: collectFieldIndices(texts.prompt, keywords),
    negativePromptIndices: collectFieldIndices(texts.negativePrompt, keywords),
    folderIndices: collectFieldIndices(texts.folder, keywords)
  };
};

/** 一段带命中标记的文本片段。 */
export type HighlightSegment = {
  /** 片段文本 */
  text: string;
  /** 是否为搜索命中片段 */
  hit: boolean;
};

/**
 * 把文本按命中下标切分为「命中 / 未命中」片段，供渲染高亮使用。
 * @param text - 原始文本
 * @param indices - 命中字符下标（来自 matchJobSearch）
 */
export const splitHighlight = (text: string, indices: number[] | null | undefined): HighlightSegment[] => {
  if (!text) return [];
  if (!indices || indices.length === 0) return [{ text, hit: false }];

  const hits = new Set(indices);
  const segments: HighlightSegment[] = [];
  for (let index = 0; index < text.length; index++) {
    const hit = hits.has(index);
    const last = segments[segments.length - 1];
    if (last && last.hit === hit) {
      last.text += text[index];
    } else {
      segments.push({ text: text[index], hit });
    }
  }
  return segments;
};
