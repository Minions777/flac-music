'use strict';

/**
 * DownloadManager 辅助函数测试
 * - sanitize: 文件名非法字符
 * - verifyMagic: 文件头魔数校验
 *
 * 主流程 (add/pause/resume/cancel) 的端到端测试见 download-manager.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// electron 桩
require.cache[require.resolve('electron')] = {
  exports: { app: { getPath: () => os.tmpdir(), getVersion: () => '0.0.0' } },
};

const { sanitize, verifyMagic, DownloadManager } = require('../../src/main/download-manager');

test('sanitize 替换文件系统非法字符', () => {
  assert.strictEqual(sanitize('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j');
});

test('sanitize 去除控制字符', () => {
  assert.strictEqual(sanitize('hello\x00\x01\x1fworld'), 'helloworld');
});

test('sanitize 接受空/非字符串', () => {
  assert.strictEqual(sanitize(''), '');
  assert.strictEqual(sanitize(null), '');
  assert.strictEqual(sanitize(undefined), '');
  assert.strictEqual(sanitize(42), '42'); // 数字会转字符串
});

test('verifyMagic 通过合法的 FLAC 文件头', () => {
  const tmp = path.join(os.tmpdir(), `vm-flac-${Date.now()}.flac`);
  // 写入 FLAC 魔数 "fLaC"
  fs.writeFileSync(tmp, Buffer.from([0x66, 0x4C, 0x61, 0x43, 0x00, 0x00]));
  assert.strictEqual(verifyMagic(tmp, 'FLAC'), true);
  assert.strictEqual(verifyMagic(tmp, 'flac'), true); // 大小写不敏感
  fs.unlinkSync(tmp);
});

test('verifyMagic 拒绝错误格式的文件', () => {
  const tmp = path.join(os.tmpdir(), `vm-bad-${Date.now()}.flac`);
  fs.writeFileSync(tmp, Buffer.from('not a flac file'));
  assert.strictEqual(verifyMagic(tmp, 'FLAC'), false);
  fs.unlinkSync(tmp);
});

test('verifyMagic 对未知格式返回 true (放行)', () => {
  const tmp = path.join(os.tmpdir(), `vm-unk-${Date.now()}.xyz`);
  fs.writeFileSync(tmp, 'whatever');
  assert.strictEqual(verifyMagic(tmp, 'XYZ'), true);
  fs.unlinkSync(tmp);
});

test('verifyMagic 文件不存在返回 false', () => {
  assert.strictEqual(verifyMagic('/nonexistent/path.flac', 'FLAC'), false);
});

test('DownloadManager 构造函数接受依赖注入', () => {
  const calls = [];
  const dm = new DownloadManager({
    logger: { info: (m) => calls.push(['info', m]), warn: () => {}, error: () => {} },
    getConfig: () => ({ maxConcurrent: 5, defaultFormat: 'FLAC', downloadDir: os.tmpdir(), autoOrganize: false }),
    notify: (task) => calls.push(['notify', task.id]),
    maxConcurrent: 5,
  });
  assert.strictEqual(dm.maxConcurrent, 5);
  assert.strictEqual(dm.queue.length, 0);

  const tasks = dm.add([{ title: 'A' }]);
  assert.strictEqual(tasks.length, 1);
  // 同步调用 _download, 但 demo 协议会走 _simulateDownload
  // 不验证 finish (因为 setInterval 是异步), 只验证注入是否生效
  setTimeout(() => {
    dm.cancel(tasks[0].id);
  }, 100);
});
