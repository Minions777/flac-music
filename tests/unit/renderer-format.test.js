'use strict';

/**
 * 渲染进程纯函数测试 (format / dom)
 * 通过动态 import() 加载 ES Modules
 */

const test = require('node:test');
const assert = require('node:assert');

// 预加载 ESM 模块 (node --test 支持动态 import)
const fmtPromise = import('../../src/renderer/core/format.js');
const domPromise = import('../../src/renderer/core/dom.js');

test('formatBytes: 0 / null / undefined 返回 "0 B"', async () => {
  const { formatBytes } = await fmtPromise;
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(null), '0 B');
  assert.strictEqual(formatBytes(undefined), '0 B');
});

test('formatBytes: B / KB / MB 单位换算', async () => {
  const { formatBytes } = await fmtPromise;
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(1024), '1 KB');
  assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
  assert.strictEqual(formatBytes(Math.round(38.2 * 1024 * 1024)), '38.2 MB');
});

test('formatSpeed: 0 / 负数 返回 "0 KB/s"', async () => {
  const { formatSpeed } = await fmtPromise;
  assert.strictEqual(formatSpeed(0), '0 KB/s');
  assert.strictEqual(formatSpeed(-1), '0 KB/s');
});

test('formatSpeed: KB/s / MB/s 单位换算', async () => {
  const { formatSpeed } = await fmtPromise;
  assert.strictEqual(formatSpeed(1024 * 500), '500 KB/s');
  assert.strictEqual(formatSpeed(1024 * 1024 * 3), '3.0 MB/s');
});

test('formatSize: 任意字节的智能单位', async () => {
  const { formatSize } = await fmtPromise;
  assert.strictEqual(formatSize(0), '0 B');
  assert.strictEqual(formatSize(100), '100 B');
  assert.strictEqual(formatSize(1024), '1.0 KB');
  assert.strictEqual(formatSize(1024 * 1024 * 1.5), '1.5 MB');
  assert.strictEqual(formatSize(1024 * 1024 * 1024 * 2), '2.0 GB');
});

test('statusLabel: 状态码翻译成中文', async () => {
  const { statusLabel } = await fmtPromise;
  assert.strictEqual(statusLabel('downloading'), '下载中');
  assert.strictEqual(statusLabel('queued'), '等待中');
  assert.strictEqual(statusLabel('done'), '已完成');
  assert.strictEqual(statusLabel('failed'), '失败');
  assert.strictEqual(statusLabel('paused'), '已暂停');
  assert.strictEqual(statusLabel('unknown_status'), 'unknown_status');
});

test('safeFormat: 接受白名单格式, 其他回退 FLAC', async () => {
  const { safeFormat } = await fmtPromise;
  assert.strictEqual(safeFormat('FLAC'), 'FLAC');
  assert.strictEqual(safeFormat('MP3'), 'MP3');
  assert.strictEqual(safeFormat('garbage'), 'FLAC');
  assert.strictEqual(safeFormat(null), 'FLAC');
});

test('esc: 转义 HTML 特殊字符 (XSS 防护)', async () => {
  const { esc } = await domPromise;
  assert.strictEqual(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.strictEqual(esc('a & b'), 'a &amp; b');
  assert.strictEqual(esc(`"x" 'y' \`z\``), '&quot;x&quot; &#39;y&#39; &#96;z&#96;');
  assert.strictEqual(esc(null), '');
  assert.strictEqual(esc(undefined), '');
  assert.strictEqual(esc(42), '42');
});
