'use strict';

/**
 * 下载页 - 任务卡片、暂停/恢复/取消、重试、统计
 *
 * 功能:
 * - 卡片增量更新: 只更新变化的字段 (进度/速度/状态), 不重建 DOM
 * - 全量刷新只在任务集变化时触发 (切换页/收到 task-finished)
 * - 任务 CRUD 走 tasksStore, 不用散落 state.tasks.xxx
 * - 拖拽重排序 (HTML5 drag-and-drop, DragSorter)
 * - 按状态分组 (下载中 / 等待中 / 已暂停 / 失败 / 已完成)
 */

import { $, esc } from '../core/dom.js';
import {
  downloadPause,
  downloadResume,
  downloadCancel,
  downloadList,
  openDir,
  downloadAdd,
  revealFile
} from '../core/api.js';
import { state, tasksStore } from '../core/state.js';
import { formatBytes, formatSpeed, statusLabel, safeFormat } from '../core/format.js';
import { showToast } from '../components/toast.js';
import { DragSorter } from '../core/drag-sort.js';

let _sorter = null;
let _groupByStatus = false; // 是否按状态分组

export function setupDownloadsPage() {
  $('pause-all-btn')?.addEventListener('click', pauseAll);
  $('resume-all-btn')?.addEventListener('click', resumeAll);
  $('clear-done-btn')?.addEventListener('click', clearDone);
  $('open-dir-btn')?.addEventListener('click', () => openDir());

  // 分组开关
  $('group-toggle-btn')?.addEventListener('click', () => {
    _groupByStatus = !_groupByStatus;
    const btn = $('group-toggle-btn');
    if (btn) {
      btn.textContent = _groupByStatus ? '📋 列表视图' : '📊 分组视图';
      btn.classList.toggle('active', _groupByStatus);
    }
    refreshDownloadList();
  });
}

export function refreshDownloadList() {
  const list = $('dl-task-list');
  const placeholder = $('dl-placeholder');
  if (!list) return;

  const tasks = [...state.tasks.values()].reverse();
  if (tasks.length === 0) {
    list.style.display = 'none';
    placeholder.style.display = 'flex';
    updateStats([], [], [], []);
    return;
  }
  list.style.display = 'flex';
  placeholder.style.display = 'none';

  const active = tasks.filter((t) => t.status === 'downloading');
  const queued = tasks.filter((t) => t.status === 'queued');
  const done = tasks.filter((t) => t.status === 'done');
  const failed = tasks.filter((t) => t.status === 'failed');
  updateStats(active, queued, done, failed);

  if (_groupByStatus) {
    renderGrouped(list, tasks);
  } else {
    renderFlat(list, tasks);
  }
}

/** 扁平列表 (含拖拽) */
function renderFlat(list, tasks) {
  // 增量: 删除不存在的, 更新/插入其余
  const current = new Set(tasks.map((t) => String(t.id)));
  list.querySelectorAll('.task-card').forEach((c) => {
    if (!current.has(c.dataset.id)) c.remove();
  });
  tasks.forEach((task) => {
    const sid = String(task.id);
    let card = list.querySelector(`.task-card[data-id="${sid}"]`);
    if (!card) {
      card = buildTaskCard(task);
      list.prepend(card);
    } else {
      updateTaskCard(card, task);
    }
  });
  setupSorter(list);
}

/** 分组渲染 */
function renderGrouped(list, tasks) {
  // 清理分组视图
  disposeSorter();
  const groups = [
    { key: 'downloading', label: '下载中' },
    { key: 'queued', label: '等待中' },
    { key: 'paused', label: '已暂停' },
    { key: 'failed', label: '失败' },
    { key: 'done', label: '已完成' }
  ];
  list.innerHTML = '';
  groups.forEach((g) => {
    const items = tasks.filter((t) => (t.status || 'queued') === g.key);
    if (items.length === 0) return;
    const groupEl = document.createElement('div');
    groupEl.className = 'dl-group';
    groupEl.dataset.status = g.key;
    groupEl.innerHTML = `
      <div class="dl-group-header">
        <span class="dl-group-label">${g.label}</span>
        <span class="dl-group-count">${items.length}</span>
      </div>
      <div class="dl-group-items"></div>
    `;
    const itemsEl = groupEl.querySelector('.dl-group-items');
    items.forEach((task) => itemsEl.appendChild(buildTaskCard(task)));
    list.appendChild(groupEl);
  });
}

function setupSorter(list) {
  disposeSorter();
  _sorter = new DragSorter(list, {
    itemSelector: '.task-card',
    onReorder: (orderedIds) => {
      // 将新顺序写回 state.tasks (按 id 重排 Map)
      const newOrder = orderedIds.map((id) => state.tasks.get(id)).filter(Boolean);
      // 清除 Map, 按新顺序重新插入
      state.tasks.clear();
      newOrder.forEach((t) => state.tasks.set(t.id, t));
      // 注: 任务顺序仅是 UI 展示, 不影响主进程
      // 如需持久化, 通过 IPC 通知主进程
    }
  });
}

function disposeSorter() {
  if (_sorter) {
    _sorter.destroy();
    _sorter = null;
  }
}

function buildTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card status-${task.status}`;
  card.dataset.id = String(task.id);
  card.innerHTML = taskCardHTML(task);
  bindTaskActions(card, task);
  return card;
}

function updateTaskCard(card, task) {
  card.className = `task-card status-${task.status}`;
  const pct = card.querySelector('.task-pct');
  const spd = card.querySelector('.task-spd');
  const fill = card.querySelector('.task-prog-fill');
  const stTxt = card.querySelector('.task-status-text');

  if (pct) pct.textContent = task.progress + '%';
  if (fill) fill.style.width = task.progress + '%';
  if (spd) spd.textContent = task.status === 'downloading' ? formatSpeed(task.speed) : '';
  if (stTxt) stTxt.textContent = statusLabel(task.status);

  const actions = card.querySelector('.task-actions');
  if (actions) {
    actions.innerHTML = taskActionsHTML(task);
    bindTaskActions(actions, task);
  }
}

function taskCardHTML(task) {
  const sizeStr = task.size ? formatBytes(task.size) : '—';
  const fmt = safeFormat(task.format);
  return `
    <div class="task-top">
      <div class="task-title">
        <div class="task-name">${esc(task.title)}</div>
        <div class="task-meta">${esc(task.artist)} · ${esc(task.album || '未知专辑')} · ${sizeStr}</div>
      </div>
      <span class="fmt-tag fmt-${fmt} task-fmt-tag">${esc(task.format)}</span>
      <span class="task-status-text">${statusLabel(task.status)}</span>
    </div>
    <div class="task-progress-wrap">
      <div class="task-prog-row">
        <span class="task-pct">${task.progress}%</span>
        <span class="task-spd">${task.status === 'downloading' ? formatSpeed(task.speed) : ''}</span>
      </div>
      <div class="task-prog-bar"><div class="task-prog-fill" style="width:${task.progress}%"></div></div>
    </div>
    <div class="task-actions">${taskActionsHTML(task)}</div>`;
}

function taskActionsHTML(task) {
  const btns = [];
  if (task.status === 'downloading') {
    btns.push(`<button class="task-btn" data-action="pause">暂停</button>`);
  }
  if (task.status === 'paused') {
    btns.push(`<button class="task-btn" data-action="resume">继续</button>`);
  }
  if (task.status === 'failed') {
    btns.push(`<button class="task-btn retry" data-action="retry">重试</button>`);
  }
  if (task.status === 'done' && task.savePath) {
    btns.push(`<button class="task-btn open-file" data-action="reveal">在文件夹中显示</button>`);
  }
  if (['downloading', 'queued', 'paused'].includes(task.status)) {
    btns.push(`<button class="task-btn danger" data-action="cancel">取消</button>`);
  }
  return btns.join('');
}

function bindTaskActions(container, task) {
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (action === 'pause') {
        await downloadPause(task.id);
        tasksStore.update(task.id, { status: 'paused' });
      }
      if (action === 'resume') {
        await downloadResume(task.id);
        tasksStore.update(task.id, { status: 'downloading' });
      }
      if (action === 'cancel') {
        await downloadCancel(task.id);
        tasksStore.remove(task.id);
        refreshDownloadList();
        return;
      }
      if (action === 'reveal') {
        revealFile(task.savePath);
        return;
      }
      if (action === 'retry') {
        const original = {
          ...task,
          status: 'queued',
          progress: 0,
          speed: 0,
          downloaded: 0,
          error: ''
        };
        await downloadAdd([original]);
        tasksStore.remove(task.id);
        refreshDownloadList();
        return;
      }
      refreshDownloadList();
    });
  });
}

function pauseAll() {
  state.tasks.forEach((task, id) => {
    if (task.status === 'downloading') {
      downloadPause(id);
      task.status = 'paused';
    }
  });
  refreshDownloadList();
  showToast('已暂停所有任务', 'info');
}

function resumeAll() {
  state.tasks.forEach((task, id) => {
    if (task.status === 'paused') {
      downloadResume(id);
      task.status = 'downloading';
    }
  });
  refreshDownloadList();
  showToast('已恢复所有任务', 'info');
}

function clearDone() {
  tasksStore.clearDone();
  refreshDownloadList();
}

function updateStats(active, queued, done, failed) {
  $('stat-active').textContent = active.length;
  $('stat-queued').textContent = queued.length;
  $('stat-done').textContent = done.length;
  $('stat-failed').textContent = failed.length;

  const totalSpeed = active.reduce((s, t) => s + (t.speed || 0), 0);
  $('stat-speed').textContent = formatSpeed(totalSpeed);
  updateDlBadge();
}

function updateDlBadge() {
  const activeCount = [...state.tasks.values()].filter((t) =>
    ['downloading', 'queued', 'paused'].includes(t.status)
  ).length;
  const badge = $('dl-badge');
  if (!badge) return;
  if (activeCount > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = activeCount;
  } else {
    badge.style.display = 'none';
  }
}

/** 渲染进程启动时拉一次主进程任务列表, 修正本地缓存 */
export async function refreshTasksFromMain() {
  try {
    const tasks = await downloadList();
    tasksStore.replaceAll(tasks);
    if (state.currentPage === 'downloads') refreshDownloadList();
    updateDlBadge();
    updateGlobalSpeed();
  } catch (_) {}
}

export function updateGlobalSpeed() {
  const totalSpeed = [...state.tasks.values()]
    .filter((t) => t.status === 'downloading')
    .reduce((s, t) => s + (t.speed || 0), 0);
  state.globalSpeed = totalSpeed;
  $('global-speed').textContent = formatSpeed(totalSpeed);
  const maxSpeed = 20 * 1024 * 1024; // 20 MB/s 为 100%
  const pct = Math.min((totalSpeed / maxSpeed) * 100, 100);
  $('global-fill').style.width = pct + '%';
}
