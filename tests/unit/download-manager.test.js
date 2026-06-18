'use strict';

/**
 * DownloadManager 单元测试 (示例)
 *
 * 教学目标: 展示"如何把不可测的代码变成可测的"
 * 关键技巧: 副作用通过构造函数注入 (依赖倒置)
 *
 * 运行: npm test
 */

const test = require('node:test');
const assert = require('node:assert');

// ── SUT (System Under Test) ────────────────────────────────
// 极简版 DownloadManager, 只保留可测的核心逻辑
class DownloadManager {
  constructor({ maxConcurrent = 3, executor, logger = console } = {}) {
    this.queue = [];
    this.active = [];
    this.done = [];
    this.failed = [];
    this.idCtr = 1;
    this.maxConcurrent = maxConcurrent;
    this.executor = executor || (async () => {});
    this.logger = logger;
  }

  add(tracks) {
    const newTasks = tracks.map((t) => ({
      id: this.idCtr++,
      title: t.title || '未知歌曲',
      status: 'queued',
      retries: 0,
      ...t
    }));
    this.queue.push(...newTasks);
    return newTasks;
  }

  _flush() {
    while (this.active.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.active.push(task);
      this.executor(task).then(
        () => { this._markDone(task); this._flush(); },
        (err) => { this._markFailed(task, err); this._flush(); }
      );
    }
  }

  pause(id) {
    const task = this.active.find((t) => t.id === id);
    if (!task) return false;
    task.status = 'paused';
    this.active = this.active.filter((t) => t.id !== id);
    return true;
  }

  cancel(id) {
    let task = this.active.find((t) => t.id === id) ||
               this.queue.find((t) => t.id === id);
    if (!task) return false;
    task.status = 'cancelled';
    this.active = this.active.filter((t) => t.id !== id);
    this.queue = this.queue.filter((t) => t.id !== id);
    return true;
  }

  _markDone(task) {
    this.active = this.active.filter((t) => t.id !== task.id);
    task.status = 'done';
    this.done.push(task);
  }

  _markFailed(task, err) {
    this.active = this.active.filter((t) => t.id !== task.id);
    task.status = 'failed';
    task.error = err.message;
    this.failed.push(task);
    this.logger.error?.('download_failed', { taskId: task.id, err: err.message });
  }
}

// ── Test Helpers ──────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Tests ─────────────────────────────────────────────────
test('add() 分配唯一递增 id, 默认 status=queued', () => {
  const dm = new DownloadManager();
  const tasks = dm.add([{ title: 'A' }, { title: 'B' }]);
  assert.strictEqual(tasks.length, 2);
  assert.strictEqual(tasks[0].id, 1);
  assert.strictEqual(tasks[1].id, 2);
  assert.strictEqual(tasks[0].status, 'queued');
});

test('add() 接受空数组, 不崩溃', () => {
  const dm = new DownloadManager();
  assert.deepStrictEqual(dm.add([]), []);
  assert.strictEqual(dm.queue.length, 0);
});

test('_flush() 启动任务到 active 列表', () => {
  const dm = new DownloadManager({ maxConcurrent: 3, executor: async () => {} });
  dm.add([{ title: 'A' }, { title: 'B' }]);
  dm._flush();
  assert.strictEqual(dm.active.length, 2);
  assert.strictEqual(dm.queue.length, 0);
});

test('并发数受 maxConcurrent 限制', async () => {
  let concurrent = 0;
  let maxObserved = 0;
  const dm = new DownloadManager({
    maxConcurrent: 2,
    executor: async () => {
      concurrent++;
      maxObserved = Math.max(maxObserved, concurrent);
      await wait(20);
      concurrent--;
    }
  });
  dm.add([{}, {}, {}, {}, {}]);
  dm._flush();
  await wait(100);
  assert.strictEqual(maxObserved, 2, '并发数不应超过 maxConcurrent');
  assert.strictEqual(dm.done.length, 5);
});

test('执行器抛错时任务进入 failed 列表, 错误信息保留', async () => {
  const dm = new DownloadManager({
    executor: async () => { throw new Error('网络超时'); }
  });
  dm.add([{ title: 'Bad' }]);
  dm._flush();
  await wait(50);
  assert.strictEqual(dm.failed.length, 1);
  assert.strictEqual(dm.failed[0].error, '网络超时');
  assert.strictEqual(dm.active.length, 0);
});

test('pause() 把 active 任务移出并标记 paused', () => {
  const dm = new DownloadManager({ executor: async () => {} });
  const t = dm.add([{ title: 'A' }])[0];
  dm._flush();
  const ok = dm.pause(t.id);
  assert.strictEqual(ok, true);
  assert.strictEqual(dm.active.length, 0);
  assert.strictEqual(t.status, 'paused');
});

test('pause() 对未知 id 返回 false', () => {
  const dm = new DownloadManager();
  assert.strictEqual(dm.pause(999), false);
});

test('cancel() 从 active 和 queue 都能移除', () => {
  const dm = new DownloadManager({ maxConcurrent: 1, executor: async () => {} });
  const t1 = dm.add([{ title: 'A' }])[0];  // 进 active
  const t2 = dm.add([{ title: 'B' }])[0];  // 进 queue
  dm._flush();

  dm.cancel(t1.id);
  assert.strictEqual(dm.active.length, 0);

  dm.cancel(t2.id);
  assert.strictEqual(dm.queue.length, 0);
  assert.strictEqual(t2.status, 'cancelled');
});

test('多个 add 调用不互相干扰 idCtr', () => {
  const dm = new DownloadManager();
  dm.add([{}]);
  dm.add([{}]);
  dm.add([{}]);
  assert.strictEqual(dm.queue[0].id, 1);
  assert.strictEqual(dm.queue[1].id, 2);
  assert.strictEqual(dm.queue[2].id, 3);
});
