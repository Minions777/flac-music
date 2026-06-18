'use strict';

/**
 * 轻量级 i18n
 *
 * 设计原则:
 * 1. 零依赖
 * 2. 文案集中在 locales/{zh-CN,en-US}.json
 * 3. 嵌套 key 用 dot path: t('search.placeholder')
 * 4. 缺失 key 走 fallback (zh-CN), 不抛错
 * 5. 启动时根据 navigator.language 自动选语言, 用户可在设置页切换
 *
 * 迁移策略 (渐进):
 * - 不要求一次性把所有中文提取出来
 * - 业务代码可以混用 t('key') 和硬编码中文
 * - 当 hardcoded 文本被 t() 覆盖后, 后续可全文检索未迁移的硬编码
 */

import zhCN from '../locales/zh-CN.json';
import enUS from '../locales/en-US.json';

const LOCALES = {
  'zh-CN': zhCN,
  'en-US': enUS
};

let currentLocale = 'zh-CN';

/**
 * 设置当前语言; 立即生效, 不需要刷新
 * @param {string} locale - e.g. 'zh-CN' | 'en-US'
 */
export function setLocale(locale) {
  if (LOCALES[locale]) currentLocale = locale;
  // 触发 DOM 重新翻译 (data-i18n 属性)
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = currentLocale;
  return currentLocale;
}

export function getLocale() {
  return currentLocale;
}

/** 探测浏览器语言 → zh-CN / en-US */
export function detectLocale() {
  const lang = (navigator.language || 'zh-CN').toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

/**
 * 取文案
 * @param {string} key - dot-separated, e.g. 'search.placeholder'
 * @param {object} [vars] - 模板变量, e.g. {name: 'Bob'} 会替换 {name}
 * @returns {string}
 */
export function t(key, vars) {
  const value = getNested(LOCALES[currentLocale], key);
  const fallback = getNested(LOCALES['zh-CN'], key);
  const text = value || fallback || key; // 都没找到就回显 key, 方便发现缺失
  return interpolate(text, vars);
}

function getNested(obj, path) {
  if (!obj) return null;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return null;
    cur = cur[p];
  }
  return cur;
}

function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`
  );
}

/** 支持的语言列表 (给设置页用) */
export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' }
];
