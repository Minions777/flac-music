'use strict';

/**
 * search-history 模块测试
 * 覆盖: 持久化、防抖、高亮转义
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// localStorage stub
const lsStore = {};
global.localStorage = {
  getItem: (k) => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; }
};

const sh = (() => {
  let p;
  return async () => (p = p || import('../../src/renderer/core/search-history.js'));
})();

describe('search-history', () => {
  beforeEach(() => {
    Object.keys(lsStore).forEach((k) => delete lsStore[k]);
  });

  test('getHistory 返回空数组 (无历史)', async () => {
    const m = await sh();
    assert.deepEqual(m.getHistory(), []);
  });

  test('addHistory 追加并去重', async () => {
    const m = await sh();
    m.addHistory('周杰伦');
    m.addHistory('邓紫棋');
    m.addHistory('周杰伦'); // 重复, 应移到队首
    const list = m.getHistory();
    assert.deepEqual(list, ['周杰伦', '邓紫棋']);
  });

  test('addHistory 超过 MAX 自动截断', async () => {
    const m = await sh();
    for (let i = 0; i < 15; i += 1) m.addHistory('kw' + i);
    const list = m.getHistory();
    assert.equal(list.length, 10);
    assert.equal(list[0], 'kw14');
  });

  test('addHistory 忽略空字符串', async () => {
    const m = await sh();
    m.addHistory('');
    m.addHistory('   ');
    m.addHistory(null);
    assert.equal(m.getHistory().length, 0);
  });

  test('clearHistory 清空', async () => {
    const m = await sh();
    m.addHistory('a');
    m.clearHistory();
    assert.equal(m.getHistory().length, 0);
  });

  test('highlight 包裹 <mark>', async () => {
    const m = await sh();
    const out = m.highlight('Hello World', 'world');
    assert.ok(out.includes('<mark>World</mark>'));
  });

  test('highlight 转义 HTML 特殊字符', async () => {
    const m = await sh();
    // 关键词不含 HTML 特殊字符, 验证主体被转义
    const out = m.highlight('<script>alert</script>', 'alert');
    assert.ok(out.includes('&lt;script&gt;<mark>alert</mark>&lt;/script&gt;'));
    assert.ok(!out.includes('<script>'));
  });

  test('highlight 不区分大小写', async () => {
    const m = await sh();
    const out = m.highlight('FLAC Music', 'flac');
    assert.ok(out.includes('<mark>FLAC</mark>'));
  });

  test('highlight 关键词包含正则特殊字符安全', async () => {
    const m = await sh();
    const out = m.highlight('a.b.c', 'a.b');
    // 应当字面匹配, 不被 . 解释为通配
    assert.ok(out.includes('<mark>a.b</mark>'));
  });

  test('debounce 合并连续调用', async () => {
    const m = await sh();
    let count = 0;
    const fn = m.debounce(() => { count += 1; }, 30);
    fn();
    fn();
    fn();
    assert.equal(count, 0, 'debounce 不应立即触发');
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(count, 1, '应只触发一次');
  });

  test('debounce.cancel 取消待执行调用', async () => {
    const m = await sh();
    let count = 0;
    const fn = m.debounce(() => { count += 1; }, 30);
    fn();
    fn.cancel();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(count, 0);
  });

  test('debounce.flush 立即触发', async () => {
    const m = await sh();
    let count = 0;
    const fn = m.debounce(() => { count += 1; }, 1000);
    fn();
    fn.flush();
    assert.equal(count, 1, 'flush 应立即触发, 不等待 idle');
  });
});
