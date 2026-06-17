'use strict';

/**
 * 全局状态（单一数据源）
 *
 * 设计原则:
 * - state 是可读的全局快照
 * - 业务变更走 tasksStore / searchStore / configStore, 便于:
 *   · 集中日志/审计
 *   · 未来接 immutable / observer
 *   · 单测可观察中间状态
 */

export const state = {
  currentPage: 'search',
  searchResults: [],
  lastQuery: '',
  selectedTracks: new Set(), // track.id
  tasks: new Map(), // taskId → task
  config: {},
  sysInfo: {},
  globalSpeed: 0
};

/**
 * 任务 store — 封装 tasks Map 的所有变更入口
 *
 * 用法:
 *   import { tasksStore } from './state.js';
 *   tasksStore.add(task);
 *   tasksStore.update(id, { progress: 50 });
 *   tasksStore.remove(id);
 *   tasksStore.clear();
 *   tasksStore.replaceAll(list);   // 启动时从主进程拉取
 *
 * 内部保持 state.tasks 引用稳定 (同一个 Map 实例), 旧代码读 state.tasks 仍能工作
 */
export const tasksStore = {
  add(task) {
    if (!task || task.id === null || task.id === undefined) return;
    state.tasks.set(task.id, task);
  },
  update(id, patch) {
    const t = state.tasks.get(id);
    if (!t) return;
    Object.assign(t, patch);
  },
  /**
   * 合并多个进度事件: 如果 id 已有任务, 用 Object.assign 合并 patch
   * 这就是 onTaskProgress 的核心场景
   */
  mergeProgress(progressData) {
    if (!progressData || progressData.id === null || progressData.id === undefined) return;
    const existing = state.tasks.get(progressData.id);
    if (existing) Object.assign(existing, progressData);
    else state.tasks.set(progressData.id, progressData);
  },
  remove(id) {
    state.tasks.delete(id);
  },
  clear() {
    state.tasks.clear();
  },
  /** 从主进程同步: 删本地多余的, 覆盖剩下的 */
  replaceAll(tasks) {
    const incomingIds = new Set(tasks.map((t) => t.id));
    for (const id of state.tasks.keys()) {
      if (!incomingIds.has(id)) state.tasks.delete(id);
    }
    for (const t of tasks) state.tasks.set(t.id, t);
  },
  /** 清除所有 status === 'done' 的任务 */
  clearDone() {
    for (const [id, t] of state.tasks) {
      if (t.status === 'done') state.tasks.delete(id);
    }
  }
};

export const DEFAULT_CONFIG = Object.freeze({
  downloadDir: '~/Music',
  maxConcurrent: 3,
  defaultFormat: 'FLAC',
  defaultQuality: '24bit/96kHz',
  autoWriteMetadata: false,
  autoOrganize: true
});

/** IPC 断开时的兜底配置 (避免 init 阶段崩溃) */
export const FALLBACK_SYS_INFO = Object.freeze({
  platform: 'win32',
  version: '2.4.1'
});
