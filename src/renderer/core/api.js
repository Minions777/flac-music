'use strict';

/**
 * preload bridge 的薄包装
 * - 集中所有对 window.flacMusic 的访问
 * - 任何 preload API 变动只需改这一处
 * - 业务模块只 import 本文件, 不直接访问全局
 */

const api = window.flacMusic;

if (!api) {
  console.error('[API] preload 未加载, IPC 不可用');
}

export const search = (kw, page = 1) => api?.search(kw, page);
export const downloadAdd = (tracks) => api?.downloadAdd(tracks);
export const downloadPause = (id) => api?.downloadPause(id);
export const downloadResume = (id) => api?.downloadResume(id);
export const downloadCancel = (id) => api?.downloadCancel(id);
export const downloadList = () => api?.downloadList();
export const configGet = () => api?.configGet();
export const configSet = (updates) => api?.configSet(updates);
export const chooseDir = () => api?.chooseDir();
export const revealFile = (fp) => api?.revealFile(fp);
export const openDir = () => api?.openDir();
export const libraryScan = () => api?.libraryScan();
export const systemInfo = () => api?.systemInfo();
export const forceQuit = () => api?.forceQuit();
export const windowMin = () => api?.windowMin();
export const windowMax = () => api?.windowMax();
export const openExternal = (url) => api?.openExternal(url);
export const updateCheck = () => api?.updateCheck();
export const updateDownload = () => api?.updateDownload();
export const updateInstall = () => api?.updateInstall();
export const reportError = (message, stack, context) =>
  api?.reportError({ message, stack, context });

// 事件订阅 (返回取消函数, 使用 removeListener 精确移除, 不会误清其他订阅)
export const onTaskProgress = (cb) => api?.onTaskProgress(cb);
export const onTaskFinished = (cb) => api?.onTaskFinished(cb);
export const onNav = (cb) => api?.onNav(cb);
export const onPauseAll = (cb) => api?.onPauseAll(cb);
export const onResumeAll = (cb) => api?.onResumeAll(cb);
export const onClearDone = (cb) => api?.onClearDone(cb);
export const onConfirmClose = (cb) => api?.onConfirmClose(cb);
export const onCheckUpdate = (cb) => api?.onCheckUpdate(cb);
export const onUpdateStatus = (cb) => api?.onUpdateStatus(cb);
export const onShortcuts = (cb) => api?.onShortcuts(cb);
