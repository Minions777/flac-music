'use strict';

/**
 * 搜索历史 + 防抖
 * - 200ms debounce: 连续输入不会反复触发搜索
 * - 最近 10 条搜索记录持久化到 localStorage
 * - 关键词高亮工具
 */

const STORAGE_KEY = 'flac-music:search-history';
const MAX_HISTORY = 10;
const DEBOUNCE_MS = 200;

/** 读取历史 (最新在前) */
export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch (_) {
    return [];
  }
}

/** 追加一条历史 (去重, 移到队首, 截断到 MAX) */
export function addHistory(keyword) {
  const kw = String(keyword || '').trim();
  if (!kw) return;
  const list = getHistory().filter((x) => x !== kw);
  list.unshift(kw);
  if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (_) {
    // localStorage 满 / 关闭, 静默
  }
}

/** 清空历史 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

/** 防抖工厂: 返回包装函数, 等待 idle ms 后才真正执行 */
export function debounce(fn, idle = DEBOUNCE_MS) {
  let t = null;
  const wrapped = function (...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn.apply(this, args);
    }, idle);
  };
  wrapped.cancel = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
  };
  wrapped.flush = (...args) => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
    fn.apply(wrapped, args);
  };
  return wrapped;
}

/** 关键词高亮: 在 text 中找到 kw (不区分大小写), 替换为 <mark> 包裹 */
export function highlight(text, kw) {
  if (!text || !kw) return String(text || '');
  const escaped = String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
  const safeKw = String(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(safeKw, 'gi');
  return escaped.replace(re, (m) => `<mark>${m}</mark>`);
}

export const SEARCH_DEBOUNCE_MS = DEBOUNCE_MS;
export const SEARCH_HISTORY_MAX = MAX_HISTORY;
