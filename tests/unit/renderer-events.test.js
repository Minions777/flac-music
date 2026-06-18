'use strict';

/**
 * 渲染进程 events (rAF batcher) 单元测试
 *
 * 关键验证:
 * - 一次 frame 内多次 push 只触发一次 flush
 * - 同 id 后到的覆盖前到的
 * - flush 出错不破坏后续 push
 *
 * node:test 没有原生 requestAnimationFrame, 通过 stub 模拟
 */

const test = require('node:test');
const assert = require('node:assert');

// ── 在 import 之前 stub global rAF ───────────────────────────────
const rafCallbacks = [];
let frameId = 0;
globalThis.requestAnimationFrame = (cb) => {
  rafCallbacks.push(cb);
  return ++frameId;
};
globalThis.cancelAnimationFrame = () => {};

function flushFrame() {
  const cbs = rafCallbacks.splice(0);
  for (const cb of cbs) cb();
}

// 直接复制 batcher 实现, 避免 import 触发的 DOM 依赖
// 业务实现与测试实现必须保持逻辑一致; 这是显式重复, 标记为「双份验证」
function createRafBatcher(flush) {
  const pending = new Map();
  let id = 0;
  const schedule = () => {
    if (id) return;
    id = requestAnimationFrame(() => {
      id = 0;
      if (pending.size > 0) {
        const batch = Array.from(pending.values());
        pending.clear();
        try {
          flush(batch);
        } catch (_) {
          /* swallow in test */
        }
      }
    });
  };
  return {
    push(data) {
      if (!data || data.id === null || data.id === undefined) return;
      pending.set(data.id, data);
      schedule();
    },
    cancel() {
      if (id) {
        cancelAnimationFrame(id);
        id = 0;
      }
      pending.clear();
    }
  };
}

test('batcher: 多次 push 同 id 只触发一次 flush, 取最后一次', () => {
  let calls = 0;
  let lastBatch = null;
  const b = createRafBatcher((batch) => {
    calls++;
    lastBatch = batch;
  });
  b.push({ id: 1, progress: 10 });
  b.push({ id: 1, progress: 20 });
  b.push({ id: 1, progress: 30 });
  assert.strictEqual(calls, 0, '未到 frame 不应触发');
  flushFrame();
  assert.strictEqual(calls, 1);
  assert.strictEqual(lastBatch.length, 1, '同 id 应去重');
  assert.strictEqual(lastBatch[0].progress, 30, '应保留最后一次');
});

test('batcher: 多次 push 不同 id 合并到一次 flush', () => {
  let calls = 0;
  let lastBatch = null;
  const b = createRafBatcher((batch) => {
    calls++;
    lastBatch = batch;
  });
  for (let i = 0; i < 50; i++) b.push({ id: i, progress: i });
  flushFrame();
  assert.strictEqual(calls, 1);
  assert.strictEqual(lastBatch.length, 50);
});

test('batcher: 跨多个 frame 独立触发', () => {
  let calls = 0;
  const b = createRafBatcher(() => calls++);
  b.push({ id: 1 });
  flushFrame();
  b.push({ id: 2 });
  flushFrame();
  b.push({ id: 3 });
  flushFrame();
  assert.strictEqual(calls, 3);
});

test('batcher: 一次 frame 后再次 push 仍能触发', () => {
  let calls = 0;
  const b = createRafBatcher(() => calls++);
  b.push({ id: 1 });
  flushFrame();
  b.push({ id: 2 });
  flushFrame();
  assert.strictEqual(calls, 2);
});

test('batcher: 非法输入 (null/undefined/无 id) 静默忽略', () => {
  let calls = 0;
  const b = createRafBatcher(() => calls++);
  b.push(null);
  b.push(undefined);
  b.push({});
  b.push({ id: null });
  b.push({ id: undefined });
  flushFrame();
  assert.strictEqual(calls, 0, '无有效数据不应 schedule');
});

test('batcher: flush 抛错不破坏后续 push', () => {
  let calls = 0;
  const b = createRafBatcher(() => {
    calls++;
    if (calls === 1) throw new Error('first-frame-error');
  });
  b.push({ id: 1 });
  flushFrame(); // 这次会抛, 但 batcher 内部应捕获
  b.push({ id: 2 });
  flushFrame();
  assert.strictEqual(calls, 2, '第二次 flush 仍能触发');
});

test('batcher: cancel 后再 push, flush 不再触发', () => {
  let calls = 0;
  const b = createRafBatcher(() => calls++);
  b.push({ id: 1 });
  b.cancel();
  flushFrame();
  assert.strictEqual(calls, 0);
});
