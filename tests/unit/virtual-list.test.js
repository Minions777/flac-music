'use strict';

/**
 * VirtualList 单元测试
 * 验证: 池子复用、范围计算、setItems / refresh / destroy
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// DOM 桩
function makeEl() {
  return {
    style: {},
    className: '',
    children: [],
    innerHTML: '',
    title: '',
    dataset: {},
    appendChild(c) { this.children.push(c); return c; },
    remove() { /* 标记从父移除 */ this._removed = true; },
    replaceChildren(...kids) { this.children = kids; },
    addEventListener() {}
  };
}

const docRoot = { _children: [] };
global.document = {
  createElement: (tag) => {
    const el = makeEl();
    el.tagName = tag.toUpperCase();
    return el;
  }
};
global.requestAnimationFrame = (fn) => setImmediate(fn);

// 加载被测模块
const vlistPromise = import('../../src/renderer/core/virtual-list.js');

describe('VirtualList', () => {
  test('构造时校验参数', async () => {
    const { VirtualList } = await vlistPromise;
    assert.throws(() => new VirtualList({}), /container is required/);
    assert.throws(() => new VirtualList({ container: {} }), /itemHeight/);
    assert.throws(() => new VirtualList({ container: {}, itemHeight: 50 }), /updateItem/);
  });

  test('setItems 后 spacer 高度 = items.length * itemHeight', async () => {
    const { VirtualList } = await vlistPromise;
    const container = makeEl();
    const list = new VirtualList({
      container,
      itemHeight: 50,
      updateItem: () => {}
    });
    list.scrollWrap.clientHeight = 400;
    list.setItems([1, 2, 3, 4, 5]);
    // 5 items × 50 = 250px
    const spacer = list.spacer;
    assert.equal(spacer.style.height, '250px');
  });

  test('setItems 触发 updateItem 调用', async () => {
    const { VirtualList } = await vlistPromise;
    const container = makeEl();
    const calls = [];
    const list = new VirtualList({
      container,
      itemHeight: 50,
      updateItem: (el, item, idx) => { calls.push({ item, idx }); }
    });
    list.scrollWrap.clientHeight = 400;
    list.setItems(['a', 'b', 'c']);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map((c) => c.item), ['a', 'b', 'c']);
    assert.deepEqual(calls.map((c) => c.idx), [0, 1, 2]);
  });

  test('refresh 强制重新调用 updateItem', async () => {
    const { VirtualList } = await vlistPromise;
    const container = makeEl();
    let count = 0;
    const list = new VirtualList({
      container,
      itemHeight: 50,
      updateItem: () => { count += 1; }
    });
    list.scrollWrap.clientHeight = 400;
    list.setItems([1, 2, 3]);
    const after1 = count;
    list.refresh();
    assert.ok(count > after1, 'refresh 后 updateItem 应再被调用');
  });

  test('destroy 清理池子', async () => {
    const { VirtualList } = await vlistPromise;
    const container = makeEl();
    const list = new VirtualList({
      container,
      itemHeight: 50,
      updateItem: () => {}
    });
    list.scrollWrap.clientHeight = 400;
    list.setItems([1, 2, 3, 4, 5]);
    assert.ok(list.pool.length > 0);
    list.destroy();
    assert.equal(list.pool.length, 0);
    assert.equal(list.items.length, 0);
  });

  test('scrollToIndex 设置 scrollTop', async () => {
    const { VirtualList } = await vlistPromise;
    const container = makeEl();
    const list = new VirtualList({
      container,
      itemHeight: 50,
      updateItem: () => {}
    });
    list.scrollWrap.clientHeight = 400;
    list.setItems([1, 2, 3, 4, 5]);
    list.scrollToIndex(3);
    assert.equal(list.scrollWrap.scrollTop, 150);
  });

  test('大列表 (1000+ items) 池子大小有界', async () => {
    const { VirtualList } = await vlistPromise;
    const container = makeEl();
    const list = new VirtualList({
      container,
      itemHeight: 50,
      overscan: 3,
      updateItem: () => {}
    });
    list.scrollWrap.clientHeight = 600; // 12 行可见
    const items = new Array(2000).fill(0).map((_, i) => i);
    list.setItems(items);
    // 池子大小 ≈ 视口行 + overscan*2, 最多 12 + 6 = 18
    assert.ok(list.pool.length <= 24, `pool should be bounded, got ${list.pool.length}`);
  });
});
