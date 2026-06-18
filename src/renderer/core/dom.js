'use strict';

/**
 * DOM 操作与转义工具
 */

export const $ = (id) => document.getElementById(id);
export const $$ = (sel) => document.querySelectorAll(sel);

/** HTML 转义 (防止 XSS; 注意 track.title / artist 等都来自网络) */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}
