'use strict';

/**
 * DragSorter + groupByStatus 单元测试
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const dsPromise = import('../../src/renderer/core/drag-sort.js');

describe('DragSorter / groupByStatus', () => {
  test('groupByStatus 按 5 个状态分组', async () => {
    const { groupByStatus } = await dsPromise;
    const tasks = [
      { id: 1, status: 'downloading' },
      { id: 2, status: 'queued' },
      { id: 3, status: 'paused' },
      { id: 4, status: 'done' },
      { id: 5, status: 'failed' },
      { id: 6, status: 'downloading' }
    ];
    const g = groupByStatus(tasks);
    assert.equal(g.downloading.length, 2);
    assert.equal(g.queued.length, 1);
    assert.equal(g.paused.length, 1);
    assert.equal(g.done.length, 1);
    assert.equal(g.failed.length, 1);
  });

  test('groupByStatus 未知状态归到 queued', async () => {
    const { groupByStatus } = await dsPromise;
    const g = groupByStatus([{ id: 1, status: 'unknown' }]);
    assert.equal(g.queued.length, 1);
  });

  test('groupByStatus 空数组返回空分组', async () => {
    const { groupByStatus } = await dsPromise;
    const g = groupByStatus([]);
    assert.equal(g.downloading.length, 0);
    assert.equal(g.queued.length, 0);
  });

  test('DragSorter 构造时校验', async () => {
    const { DragSorter } = await dsPromise;
    assert.throws(() => new DragSorter(null), /container/);
  });

  test('DragSorter 注册 4 个事件监听', async () => {
    const { DragSorter } = await dsPromise;
    const events = [];
    const fakeContainer = {
      addEventListener: (ev) => events.push(ev),
      removeEventListener: () => {}
    };
    new DragSorter(fakeContainer, { itemSelector: '.x' });
    assert.deepEqual([...events].sort(), ['dragend', 'dragover', 'dragstart', 'drop']);
  });

  test('DragSorter.destroy 注销事件', async () => {
    const { DragSorter } = await dsPromise;
    const events = [];
    const fakeContainer = {
      addEventListener: (ev) => events.push(ev),
      removeEventListener: (ev) => events.push('off:' + ev)
    };
    const s = new DragSorter(fakeContainer, { itemSelector: '.x' });
    s.destroy();
    assert.ok(events.some((e) => e.startsWith('off:')));
  });

  test('DragSorter 模拟 drop 触发 onReorder', async () => {
    const { DragSorter } = await dsPromise;
    let ordered = null;
    const items = [
      { dataset: { id: 'a' } },
      { dataset: { id: 'b' } },
      { dataset: { id: 'c' } }
    ];
    const listeners = {};
    const container = {
      addEventListener: (ev, fn) => { listeners[ev] = fn; },
      removeEventListener: () => {},
      querySelectorAll: (sel) => {
        if (sel === '.x') return items;
        return [];
      }
    };
    const sorter = new DragSorter(container, {
      itemSelector: '.x',
      onReorder: (ids) => { ordered = ids; }
    });
    // 模拟 drop
    listeners.drop({ preventDefault: () => {} });
    assert.deepEqual(ordered, ['a', 'b', 'c']);
  });
});
