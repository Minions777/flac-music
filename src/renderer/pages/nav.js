'use strict';

/**
 * 左侧导航 + 快捷键
 * 菜单驱动的快捷键通过 IPC 频道 "nav-shortcut:*" 接收
 */

import { $$ } from '../core/dom.js';
import { onNav, onShortcuts } from '../core/api.js';
import { state } from '../core/state.js';
import { refreshDownloadList } from './downloads.js';
import { refreshLibrary } from './library.js';

/** 监听 IPC 快捷键事件 */
function setupShortcuts() {
  // 主进程菜单通过 webContents.send('shortcut', { type, value }) 派发
  onShortcuts((payload) => {
    const { type, value } = payload || {};
    if (type === 'nav') navigateTo(value);
    if (type === 'focus-search') {
      const input = document.getElementById('search-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
    if (type === 'batch-download') {
      document.getElementById('batch-dl-btn')?.click();
    }
    if (type === 'clear-done') {
      document.getElementById('clear-done-btn')?.click();
    }
  });
}

export function setupNav() {
  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
  onNav((page) => navigateTo(page));
  setupShortcuts();
}

export function navigateTo(page) {
  if (state.currentPage === page) return;
  state.currentPage = page;

  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`));

  if (page === 'downloads') refreshDownloadList();
  if (page === 'library') refreshLibrary();
}
