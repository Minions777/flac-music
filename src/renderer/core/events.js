'use strict';

/**
 * IPC 事件订阅
 * 集中注册所有 task-progress / task-finished / menu 事件
 * 业务回调委托给对应的 page 模块
 *
 * 性能要点:
 * - onTaskProgress 用 rAF 合并, 高并发下载(10+ 任务)时不再卡主线程
 * - 数据合并通过 tasksStore, 不再散落 state.tasks.set()
 */

import {
  onTaskProgress,
  onTaskFinished,
  onPauseAll,
  onResumeAll,
  onClearDone,
  onConfirmClose,
  onCheckUpdate,
  updateCheck as apiUpdateCheck
} from './api.js';
import { state, tasksStore } from './state.js';
import {
  refreshDownloadList,
  updateGlobalSpeed,
  updateDlBadge,
  pauseAll,
  resumeAll,
  clearDone,
  refreshTasksFromMain
} from '../pages/downloads.js';
import { showCloseModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { handleUpdateResult } from '../pages/settings.js';

/* ─────────── rAF 调度器 ─────────────────────────────────────── */

/**
 * 在 requestAnimationFrame 周期内合并多次事件, 周期内只触发一次 flush
 * 单任务刷新开销 O(1); 多任务并发的 DOM 写入会合并到下一帧
 */
function createRafBatcher(flush) {
  const pending = new Map(); // id → latest data
  let frameId = 0;
  const schedule = () => {
    if (frameId) return;
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      if (pending.size > 0) {
        const batch = Array.from(pending.values());
        pending.clear();
        try {
          flush(batch);
        } catch (e) {
          // flush 内部错误不能破坏 IPC 链路
          console.error('[events] flush error:', e);
        }
      }
    });
  };
  return {
    push(data) {
      if (!data || data.id === null || data.id === undefined) return;
      pending.set(data.id, data);
      schedule();
    },
    cancel() {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
      pending.clear();
    }
  };
}

/* ─────────── 状态文案映射 ───────────────────────────────────── */

const STATUS_LABELS = {
  downloading: '下载中',
  queued: '等待中',
  done: '已完成',
  failed: '失败',
  paused: '已暂停'
};

/* ─────────── DOM 单卡片增量更新 ─────────────────────────────── */

function updateCardInPlace(card, data) {
  const pct = card.querySelector('.task-pct');
  const fill = card.querySelector('.task-prog-fill');
  const spd = card.querySelector('.task-spd');
  const stTxt = card.querySelector('.task-status-text');
  if (pct) pct.textContent = data.progress + '%';
  if (fill) fill.style.width = data.progress + '%';
  if (spd) {
    spd.textContent = data.status === 'downloading' ? `${Math.round(data.speed / 1024)} KB/s` : '';
  }
  if (stTxt) stTxt.textContent = STATUS_LABELS[data.status] || data.status;
}

/* ─────────── 主入口 ─────────────────────────────────────────── */

export function setupEvents() {
  const progressBatcher = createRafBatcher((batch) => {
    // 1. 合并数据到 store
    for (const data of batch) tasksStore.mergeProgress(data);

    // 2. 增量更新可见卡片
    if (state.currentPage === 'downloads') {
      for (const data of batch) {
        const card = document.querySelector(`.task-card[data-id="${data.id}"]`);
        if (card) updateCardInPlace(card, data);
      }
    }
    // 3. 汇总信息 (每帧最多一次, 比每事件一次快 10x+)
    updateGlobalSpeed();
    updateDlBadge();
  });

  onTaskProgress((data) => progressBatcher.push(data));

  onTaskFinished((data) => {
    const task = state.tasks.get(data.id);
    if (task) Object.assign(task, data);
    if (data.status === 'done') {
      showToast(`「${task?.title || '音乐'}」下载完成`, 'success');
    }
    if (state.currentPage === 'downloads') refreshDownloadList();
  });

  onPauseAll(() => pauseAll());
  onResumeAll(() => resumeAll());
  onClearDone(() => clearDone());
  onConfirmClose(({ activeTasks }) => showCloseModal(activeTasks));
  onCheckUpdate(async () => {
    try {
      const result = await apiUpdateCheck();
      handleUpdateResult(result);
    } catch (_) {}
  });

  // 启动时拉一次任务列表, 修正内存状态
  refreshTasksFromMain();
}
