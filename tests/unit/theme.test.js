'use strict';

/**
 * theme 模块测试
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const lsStore = {};
global.localStorage = {
  getItem: (k) => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; }
};

const htmlAttrs = {};
global.document = {
  documentElement: {
    set dataset(v) { if (v) htmlAttrs.theme = v; else delete htmlAttrs.theme; },
    get dataset() { return htmlAttrs; },
    removeAttribute(k) { delete htmlAttrs[k.replace('data-', '')]; },
    setAttribute(k, v) { htmlAttrs[k.replace('data-', '')] = v; }
  }
};

const themePromise = import('../../src/renderer/core/theme.js');

describe('theme', () => {
  beforeEach(() => {
    Object.keys(lsStore).forEach((k) => delete lsStore[k]);
    Object.keys(htmlAttrs).forEach((k) => delete htmlAttrs[k]);
  });

  test('loadTheme 默认 system', async () => {
    const m = await themePromise;
    assert.equal(m.loadTheme(), 'system');
  });

  test('loadTheme 读取 localStorage', async () => {
    lsStore['flac-music:theme'] = 'dark';
    const m = await themePromise;
    assert.equal(m.loadTheme(), 'dark');
  });

  test('loadTheme 拒绝非法值, 回退 system', async () => {
    lsStore['flac-music:theme'] = 'pink';
    const m = await themePromise;
    assert.equal(m.loadTheme(), 'system');
  });

  test('applyTheme 设置 html[data-theme]', async () => {
    const m = await themePromise;
    m.applyTheme('dark');
    assert.equal(htmlAttrs.theme, 'dark');
    assert.equal(lsStore['flac-music:theme'], 'dark');
  });

  test('applyTheme system 移除 data-theme', async () => {
    const m = await themePromise;
    m.applyTheme('light');
    m.applyTheme('system');
    assert.equal(htmlAttrs.theme, undefined);
  });

  test('applyTheme 拒绝非法值, 视为 system', async () => {
    const m = await themePromise;
    m.applyTheme('invalid-theme');
    assert.equal(htmlAttrs.theme, undefined);
  });

  test('cycleTheme 在三个值之间循环', async () => {
    const m = await themePromise;
    m.applyTheme('system');
    assert.equal(m.cycleTheme(), 'light');
    assert.equal(m.cycleTheme(), 'dark');
    assert.equal(m.cycleTheme(), 'system');
  });

  test('onThemeChange 订阅生效', async () => {
    const m = await themePromise;
    const calls = [];
    const unsub = m.onThemeChange((t) => calls.push(t));
    m.applyTheme('light');
    m.applyTheme('dark');
    assert.deepEqual(calls, ['light', 'dark']);
    unsub();
    m.applyTheme('system');
    assert.deepEqual(calls, ['light', 'dark'], '取消订阅后不应再收到');
  });

  test('getCurrentTheme 返回当前主题', async () => {
    const m = await themePromise;
    m.applyTheme('dark');
    assert.equal(m.getCurrentTheme(), 'dark');
  });
});
