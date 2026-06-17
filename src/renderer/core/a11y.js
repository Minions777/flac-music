'use strict';

/**
 * 无障碍 (a11y) 工具
 *
 * 目标: WCAG 2.1 AA
 * - 焦点管理 (modal focus trap)
 * - 键盘导航 (ESC 关闭 modal)
 * - 屏幕阅读器标签 (aria-live, aria-label)
 */

/**
 * Focus Trap: 把 Tab 键限制在容器内循环
 * 必须在 modal 显示时调用, 关闭时调用 deactivate()
 */
export function trapFocus(container) {
  if (!container) return () => {};

  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

/**
 * 简单 a11y 公告: 在 ARIA live region 注入文字, 屏幕阅读器会读出
 * 用法: announce('已暂停所有任务', 'polite')
 * @param {string} message
 * @param {'polite'|'assertive'} [priority]
 */
let liveRegion = null;
export function announce(message, priority = 'polite') {
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'a11y-live';
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    document.body.appendChild(liveRegion);
  }
  // 必须先清空再赋值, 否则相同内容不会重读
  liveRegion.textContent = '';
  // 浏览器需要 microtask 来识别变化
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 50);
}

/**
 * 状态码 → 屏幕阅读器友好的状态描述
 */
export const STATUS_A11Y = Object.freeze({
  downloading: '正在下载',
  queued: '等待下载',
  done: '已完成',
  failed: '下载失败',
  paused: '已暂停'
});

/**
 * 给 nav 项加 aria-current
 * 用法: syncNavAria('search')
 */
export function syncNavAria(currentPage) {
  document.querySelectorAll('.nav-item').forEach((el) => {
    if (el.dataset.page === currentPage) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}
