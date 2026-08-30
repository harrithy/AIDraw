const syncChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("aidraw-state-sync")
    : null;

const pendingLocalFolderIds = new Set<string>();
const pendingRemoteFolderIds = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const collapseFolderIds = (folderIds: Set<string>) =>
  folderIds.has("") ? [""] : Array.from(folderIds);

const flushStateUpdates = () => {
  flushTimer = null;
  const remoteFolderIds = collapseFolderIds(pendingRemoteFolderIds);
  const localFolderIds = collapseFolderIds(pendingLocalFolderIds);
  pendingRemoteFolderIds.clear();
  pendingLocalFolderIds.clear();

  if (remoteFolderIds.length > 0) {
    syncChannel?.postMessage({ type: "STATE_UPDATED", folderIds: remoteFolderIds });
  }
  if (localFolderIds.length > 0 && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("aidraw-state-update", {
        detail: {
          folderIds: localFolderIds,
          folderId: localFolderIds.length === 1 ? localFolderIds[0] : undefined
        }
      })
    );
  }
};

const scheduleStateUpdate = (folderIds: string[], broadcast: boolean) => {
  for (const folderId of folderIds) {
    pendingLocalFolderIds.add(folderId);
    if (broadcast) pendingRemoteFolderIds.add(folderId);
  }
  if (flushTimer === null) flushTimer = setTimeout(flushStateUpdates, 50);
};

/**
 * 通知当前页面与其他标签页重新读取指定文件夹的数据。
 * 空字符串表示全局数据（文件夹列表或 API 设置）发生了变化。
 */
export const broadcastStateUpdate = (folderId: string) => {
  scheduleStateUpdate([folderId], true);
};

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data?.type !== "STATE_UPDATED" || typeof window === "undefined") return;
    const folderIds = Array.isArray(event.data.folderIds)
      ? event.data.folderIds.filter((value: unknown): value is string => typeof value === "string")
      : typeof event.data.folderId === "string"
        ? [event.data.folderId]
        : [];
    scheduleStateUpdate(folderIds, false);
  };
}
