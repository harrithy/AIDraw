const syncChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("aidraw-state-sync")
    : null;

/**
 * 通知当前页面与其他标签页重新读取指定文件夹的数据。
 * 空字符串表示全局数据（文件夹列表或 API 设置）发生了变化。
 */
export const broadcastStateUpdate = (folderId: string) => {
  syncChannel?.postMessage({ type: "STATE_UPDATED", folderId });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aidraw-state-update", { detail: { folderId } }));
  }
};

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data?.type !== "STATE_UPDATED" || typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("aidraw-state-update", { detail: { folderId: event.data.folderId } })
    );
  };
}
