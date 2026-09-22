/**
 * 前端图片异步上传注册池
 * 用于解耦「加入队列」与「图床上传完成」：
 * 用户选图后立即发起上传并向此注册池登记，加入队列时无需等待上传；
 * 任务进入画布并排队，当调度器执行到该任务时，通过此注册池等待对应上传完成并拿到真实公网 URL。
 */

type UploadEntry = {
  promise: Promise<string>;
  resolvedUrl?: string;
  error?: Error;
  status: "pending" | "resolved" | "rejected";
};

class UploadRegistry {
  private uploads = new Map<string, UploadEntry>();

  /**
   * 注册一个正在进行的上传任务。
   * @param key - 唯一的上传标识符
   * @param promise - 返回图床公网 URL 的 Promise
   */
  registerUpload(key: string, promise: Promise<string>): void {
    const entry: UploadEntry = {
      promise,
      status: "pending"
    };

    promise
      .then((url) => {
        entry.resolvedUrl = url;
        entry.status = "resolved";
      })
      .catch((err) => {
        entry.error = err instanceof Error ? err : new Error(String(err));
        entry.status = "rejected";
      });

    this.uploads.set(key, entry);
  }

  /**
   * 检查指定 key 是否存在于当前运行周期中。
   */
  hasUpload(key: string): boolean {
    return this.uploads.has(key);
  }

  /**
   * 检查指定 key 是否仍在上传中。
   */
  isUploadPending(key: string): boolean {
    return this.uploads.get(key)?.status === "pending";
  }

  /**
   * 获取已完成的公网 URL（如果已完成）。
   */
  getResolvedUrl(key: string): string | undefined {
    return this.uploads.get(key)?.resolvedUrl;
  }

  /**
   * 等待指定的上传任务完成并返回公网 URL。
   * 若上传失败或任务不存在（如刷新页面后丢失内存引用），将抛出明确异常。
   */
  async waitForUpload(key: string): Promise<string> {
    const entry = this.uploads.get(key);
    if (!entry) {
      throw new Error("找不到该参考图的上传任务，可能页面已刷新或上传已中断");
    }

    if (entry.status === "resolved" && entry.resolvedUrl) {
      return entry.resolvedUrl;
    }

    if (entry.status === "rejected") {
      throw entry.error ?? new Error("参考图上传失败");
    }

    try {
      const url = await entry.promise;
      return url;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  /**
   * 等待一组上传任务全部完成。
   */
  async waitForAll(keys: string[]): Promise<string[]> {
    return Promise.all(keys.map((key) => this.waitForUpload(key)));
  }

  /**
   * 清理已不再需要的上传记录。
   */
  clearUpload(key: string): void {
    this.uploads.delete(key);
  }

  /**
   * 清空所有记录（用于单元测试）。
   */
  clearAll(): void {
    this.uploads.clear();
  }
}

export const uploadRegistry = new UploadRegistry();
