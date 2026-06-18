'use strict';

/**
 * 音乐库页
 * - 优先扫描真实文件系统, 为空时回退到本次会话完成的任务
 * - 大列表 (>100 项) 走虚拟列表, 1000+ 也不卡
 */

import { $, esc } from '../core/dom.js';
import { libraryScan, openDir } from '../core/api.js';
import { state } from '../core/state.js';
import { formatSize } from '../core/format.js';
import { navigateTo } from './nav.js';
import { VirtualList } from '../core/virtual-list.js';

const COVER_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
  </svg>`;

const ITEM_HEIGHT = 80;
const VIRTUAL_THRESHOLD = 100;

let _virtualList = null;

function disposeVirtualList() {
  if (_virtualList) {
    _virtualList.destroy();
    _virtualList = null;
  }
}

/** 文件系统项: 原地更新 (无重建) */
function updateFileEl(el, f) {
  if (!f) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.className = 'lib-item';
  el.title = f.path || '';
  el.innerHTML = `
    <div class="lib-cover">${COVER_SVG}</div>
    <div class="lib-name">${esc(f.name || '')}</div>
    <div class="lib-artist">${esc(f.ext || '')} · ${formatSize(f.size || 0)}</div>
  `;
}

/** 任务项: 原地更新 */
function updateTaskEl(el, item) {
  if (!item) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.className = 'lib-item';
  el.innerHTML = `
    <div class="lib-cover">${COVER_SVG}</div>
    <div class="lib-name" title="${esc(item.title || '')}">${esc(item.title || '')}</div>
    <div class="lib-artist">${esc(item.artist || '')}</div>
  `;
}

export function setupLibraryPage() {
  $('lib-open-dir')?.addEventListener('click', () => openDir());
  $('lib-go-search')?.addEventListener('click', () => navigateTo('search'));
  $('lib-placeholder')?.addEventListener('click', (e) => {
    if (e.target === $('lib-go-search')) navigateTo('search');
  });
}

/** 渲染到 DOM — 自动选择虚拟列表或批量插入 */
function renderItems(grid, items, type) {
  if (items.length > VIRTUAL_THRESHOLD) {
    disposeVirtualList();
    _virtualList = new VirtualList({
      container: grid,
      itemHeight: ITEM_HEIGHT,
      overscan: 5,
      updateItem: type === 'file' ? (el, f) => updateFileEl(el, f) : (el, t) => updateTaskEl(el, t)
    });
    _virtualList.setItems(items);
  } else {
    disposeVirtualList();
    const frag = document.createDocumentFragment();
    const updater = type === 'file' ? updateFileEl : updateTaskEl;
    for (const item of items) {
      const el = document.createElement('div');
      frag.appendChild(el);
      updater(el, item);
    }
    grid.replaceChildren(frag);
  }
}

export async function refreshLibrary() {
  const placeholder = $('lib-placeholder');
  const grid = $('lib-grid');
  if (!grid) return;

  let files = [];
  try {
    const res = await libraryScan();
    if (res && res.ok) files = res.files || [];
  } catch (_) {}

  if (files.length === 0) {
    renderFromTasks(grid, placeholder);
    return;
  }
  placeholder.style.display = 'none';
  grid.style.display = 'block';
  renderItems(grid, files, 'file');
}

function renderFromTasks(grid, placeholder) {
  const doneItems = [...state.tasks.values()].filter((t) => t.status === 'done');
  if (doneItems.length === 0) {
    placeholder.style.display = 'flex';
    grid.style.display = 'none';
    disposeVirtualList();
    return;
  }
  placeholder.style.display = 'none';
  grid.style.display = 'block';
  renderItems(grid, doneItems, 'task');
}
