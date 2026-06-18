'use strict';

/**
 * Toast 通知
 * 自动淡出, 多种类型 (success/error/info)
 *
 * a11y:
 * - container role="status" aria-live="polite" 让屏幕阅读器自动播报
 * - error 类型用 role="alert" aria-live="assertive" 立即播报
 */

import { $, esc } from '../core/dom.js';

const ICONS = Object.freeze({ success: '✓', error: '✕', info: '→' });

export function showToast(msg, type = 'info', duration = 3500) {
  const container = $('toast-container');
  if (!container) {
    console.warn('[Toast] container not found');
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  // error 用 assertive 让屏幕阅读器立即打断当前播报
  if (type === 'error') {
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
  } else {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
  }
  // 用 DOM API 构造, 避免 innerHTML 模板 (虽然 esc 已防御)
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[type] || '';
  const text = document.createElement('span');
  text.textContent = String(msg);
  toast.append(icon, text);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
