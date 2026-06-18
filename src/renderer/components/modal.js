'use strict';

/**
 * 模态框 - 当前只有"退出确认"一种
 * 集中放置 DOM 引用, 避免散落
 *
 * 实现要点:
 * - 文案中数字用 textContent 注入, 不用 innerHTML 模板, 杜绝 XSS 模式
 * - 元素构造走 DOM API, 不依赖 HTML 字符串拼接
 * - a11y: role="dialog" + aria-modal + focus trap + ESC 关闭
 */

import { $ } from '../core/dom.js';
import { forceQuit } from '../core/api.js';
import { trapFocus } from '../core/a11y.js';

let activeFocusTrap = null;

export function setupModals() {
  $('modal-cancel-btn')?.addEventListener('click', hideCloseModal);
  $('modal-quit-btn')?.addEventListener('click', () => {
    hideCloseModal();
    forceQuit();
  });

  // ESC 关闭 (a11y)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('modal-close').style.display !== 'none') {
      hideCloseModal();
    }
  });
}

export function showCloseModal(activeTasks) {
  const msg = $('modal-close-msg');
  if (!msg) return;

  msg.textContent = '';
  const label = document.createTextNode('仍有 ');
  const strong = document.createElement('strong');
  strong.textContent =
    activeTasks === 0 || activeTasks === null || activeTasks === undefined
      ? '部分'
      : String(activeTasks);
  const tail = document.createTextNode(' 个下载任务正在进行, 退出后任务将中断。');
  msg.append(label, strong, tail);

  const overlay = $('modal-close');
  overlay.style.display = 'flex';

  // a11y: 焦点 trap + 把焦点移到 modal
  activeFocusTrap = trapFocus(overlay);
  $('modal-cancel-btn')?.focus();
}

function hideCloseModal() {
  $('modal-close').style.display = 'none';
  if (activeFocusTrap) {
    activeFocusTrap();
    activeFocusTrap = null;
  }
}
