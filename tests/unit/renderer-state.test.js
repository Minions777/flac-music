'use strict';

/**
 * 渲染进程 state/tasksStore 单测
 * 通过动态 import() 加载 ES Modules
 */

const test = require('node:test');
const assert = require('node:assert');

const statePromise = import('../../src/renderer/core/state.js');

test('state: 初始状态正确', async () => {
  const { state } = await statePromise;
  assert.strictEqual(state.currentPage, 'search');
  assert.deepStrictEqual(state.searchResults, []);
  assert.ok(state.selectedTracks instanceof Set);
  assert.ok(state.tasks instanceof Map);
  assert.strictEqual(state.tasks.size, 0);
});

test('DEFAULT_CONFIG: 不可变', async () => {
  const { DEFAULT_CONFIG } = await statePromise;
  assert.strictEqual(DEFAULT_CONFIG.maxConcurrent, 3);
  assert.strictEqual(DEFAULT_CONFIG.defaultFormat, 'FLAC');
  assert.throws(() => {
    DEFAULT_CONFIG.maxConcurrent = 10;
  });
});

test('tasksStore.add: 加入任务', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add({ id: 'a', title: 'A' });
  assert.strictEqual(state.tasks.size, 1);
  assert.strictEqual(state.tasks.get('a').title, 'A');
});

test('tasksStore.add: 非法输入静默忽略', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add(null);
  tasksStore.add(undefined);
  tasksStore.add({});
  tasksStore.add({ id: null });
  assert.strictEqual(state.tasks.size, 0);
});

test('tasksStore.update: 合并 patch', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add({ id: 'a', progress: 0, status: 'queued' });
  tasksStore.update('a', { progress: 50 });
  assert.strictEqual(state.tasks.get('a').progress, 50);
  assert.strictEqual(state.tasks.get('a').status, 'queued');
});

test('tasksStore.update: 不存在的 id 静默忽略', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.update('nonexistent', { progress: 99 });
  assert.strictEqual(state.tasks.size, 0);
});

test('tasksStore.mergeProgress: 已存在则合并, 不存在则插入', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add({ id: 'a', progress: 0 });
  tasksStore.mergeProgress({ id: 'a', progress: 30, speed: 100 });
  assert.strictEqual(state.tasks.size, 1);
  assert.strictEqual(state.tasks.get('a').progress, 30);
  assert.strictEqual(state.tasks.get('a').speed, 100);
  tasksStore.mergeProgress({ id: 'b', progress: 50 });
  assert.strictEqual(state.tasks.size, 2);
});

test('tasksStore.mergeProgress: 非法输入静默忽略', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.mergeProgress(null);
  tasksStore.mergeProgress({});
  tasksStore.mergeProgress({ id: null });
  assert.strictEqual(state.tasks.size, 0);
});

test('tasksStore.remove: 删除任务', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add({ id: 'a' });
  tasksStore.add({ id: 'b' });
  tasksStore.remove('a');
  assert.strictEqual(state.tasks.size, 1);
  assert.ok(!state.tasks.has('a'));
  assert.ok(state.tasks.has('b'));
});

test('tasksStore.clear: 清空所有', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add({ id: 'a' });
  tasksStore.add({ id: 'b' });
  tasksStore.add({ id: 'c' });
  tasksStore.clear();
  assert.strictEqual(state.tasks.size, 0);
});

test('tasksStore.replaceAll: 删本地多余的, 覆盖/插入剩下的', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add({ id: 'a', title: 'A' });
  tasksStore.add({ id: 'b', title: 'B' });
  tasksStore.add({ id: 'c', title: 'C' });
  tasksStore.replaceAll([
    { id: 'b', title: 'B-new' },
    { id: 'd', title: 'D' }
  ]);
  assert.strictEqual(state.tasks.size, 2);
  assert.ok(!state.tasks.has('a'));
  assert.ok(!state.tasks.has('c'));
  assert.strictEqual(state.tasks.get('b').title, 'B-new');
  assert.strictEqual(state.tasks.get('d').title, 'D');
});

test('tasksStore.clearDone: 只删 done 状态', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  tasksStore.add({ id: 'a', status: 'done' });
  tasksStore.add({ id: 'b', status: 'downloading' });
  tasksStore.add({ id: 'c', status: 'done' });
  tasksStore.add({ id: 'd', status: 'failed' });
  tasksStore.clearDone();
  assert.strictEqual(state.tasks.size, 2);
  assert.ok(state.tasks.has('b'));
  assert.ok(state.tasks.has('d'));
});

test('state.tasks 引用稳定: tasksStore 操作不替换 Map 实例', async () => {
  const { state, tasksStore } = await statePromise;
  state.tasks.clear();
  const ref = state.tasks;
  tasksStore.add({ id: 'a' });
  tasksStore.remove('a');
  tasksStore.clear();
  tasksStore.replaceAll([{ id: 'x' }]);
  assert.strictEqual(state.tasks, ref, 'Map 实例必须稳定, 旧代码读 state.tasks 才能继续生效');
});
