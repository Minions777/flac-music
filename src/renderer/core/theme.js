'use strict';

/**
 * 主题切换模块
 * - 持久化到 localStorage (key: 'flac-music:theme')
 * - 三个值: 'light' | 'dark' | 'system'
 * - 应用: 切换 html[data-theme] 属性 + CSS 变量
 *
 * CSS 约定:
 *   html[data-theme="light"] { --bg: #fff; ... }
 *   html[data-theme="dark"]  { --bg: #0d0f14; ... }
 *   不设置时跟随系统 (CSS prefers-color-scheme)
 */

const STORAGE_KEY = 'flac-music:theme';

export const THEMES = Object.freeze({
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark'
});

let _currentTheme = THEMES.SYSTEM;
const _listeners = new Set();

/** 读取已保存主题 (默认 system) */
export function loadTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && Object.values(THEMES).includes(v)) return v;
  } catch (_) {}
  return THEMES.SYSTEM;
}

/** 应用主题到 <html> 元素 + 通知监听器 */
export function applyTheme(theme) {
  let resolved = theme;
  if (!Object.values(THEMES).includes(resolved)) resolved = THEMES.SYSTEM;
  _currentTheme = resolved;
  const html = document.documentElement;
  if (resolved === THEMES.SYSTEM) {
    delete html.dataset.theme;
  } else {
    html.dataset.theme = resolved;
  }
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch (_) {}
  _listeners.forEach((fn) => {
    try {
      fn(resolved);
    } catch (_) {}
  });
}

/** 切换到下一个主题 (system → light → dark → system) */
export function cycleTheme() {
  const order = [THEMES.SYSTEM, THEMES.LIGHT, THEMES.DARK];
  const idx = order.indexOf(_currentTheme);
  const next = order[(idx + 1) % order.length];
  applyTheme(next);
  return next;
}

export function getCurrentTheme() {
  return _currentTheme;
}

/** 订阅主题变化 */
export function onThemeChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** 注入主题切换按钮到指定容器 (id: 'theme-toggle') */
export function mountToggleButton(host) {
  if (!host) return;
  host.innerHTML = `
    <button id="theme-btn"
            class="theme-toggle"
            title="切换主题 (浅色/深色/跟随系统)"
            aria-label="切换主题"
            style="display:inline-flex;align-items:center;gap:6px;
                   padding:6px 12px;background:transparent;
                   border:1px solid var(--border-2);border-radius:6px;
                   color:var(--text-1);cursor:pointer;font-size:12px;
                   transition:background 0.18s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <span id="theme-btn-label">跟随系统</span>
    </button>
  `;
  const btn = host.querySelector('#theme-btn');
  const label = host.querySelector('#theme-btn-label');
  const updateLabel = () => {
    if (label) {
      label.textContent =
        {
          [THEMES.LIGHT]: '浅色',
          [THEMES.DARK]: '深色',
          [THEMES.SYSTEM]: '跟随系统'
        }[_currentTheme] || '跟随系统';
    }
  };
  updateLabel();
  btn?.addEventListener('click', () => {
    cycleTheme();
    updateLabel();
  });
  onThemeChange(updateLabel);
}

/** 启动时初始化: 读取存储 + 应用 */
export function initTheme() {
  applyTheme(loadTheme());
}
