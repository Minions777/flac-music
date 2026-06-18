'use strict';

/**
 * config 模块单元测试
 *
 * 覆盖:
 * - 默认值加载
 * - applyUpdates 接受合法更新
 * - applyUpdates 拒绝未知 key
 * - applyUpdates 拒绝非法 value
 * - flush 立即写盘
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 隔离的临时 userData
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'flac-config-test-'));

// 重写 app.getPath (main 进程的 app 不可直接 require)
require.cache[require.resolve('electron')] = {
  exports: {
    app: { getPath: () => TMP, getVersion: () => '0.0.0' },
  },
};

const config = require('../../src/main/config');
const { getDefaultConfig } = require('../../src/main/constants');

test('get() 返回的默认值与 schema 一致', () => {
  const c = config.get();
  const defaults = getDefaultConfig();
  assert.strictEqual(c.maxConcurrent, defaults.maxConcurrent);
  assert.strictEqual(c.defaultFormat, 'FLAC');
  assert.ok(typeof c.downloadDir === 'string' && c.downloadDir.length > 0);
});

test('get() 返回的是新对象, 外部修改不污染内部', () => {
  const a = config.get();
  a.maxConcurrent = 999;
  const b = config.get();
  assert.notStrictEqual(a.maxConcurrent, b.maxConcurrent);
});

test('applyUpdates 接受合法更新并返回 ok:true', () => {
  const r = config.applyUpdates({ maxConcurrent: 5, defaultFormat: 'MP3' });
  assert.strictEqual(r.ok, true);
  const c = config.get();
  assert.strictEqual(c.maxConcurrent, 5);
  assert.strictEqual(c.defaultFormat, 'MP3');
});

test('applyUpdates 拒绝未知 key', () => {
  const r = config.applyUpdates({ evilKey: 'x' });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /Unknown config key/);
});

test('applyUpdates 拒绝非法 value 类型', () => {
  assert.strictEqual(config.applyUpdates({ maxConcurrent: 'abc' }).ok, false);
  assert.strictEqual(config.applyUpdates({ maxConcurrent: 0 }).ok, false);
  assert.strictEqual(config.applyUpdates({ maxConcurrent: 100 }).ok, false);
  assert.strictEqual(config.applyUpdates({ defaultFormat: 'NOTREAL' }).ok, false);
  assert.strictEqual(config.applyUpdates({ autoOrganize: 'yes' }).ok, false);
  assert.strictEqual(config.applyUpdates({}).ok, true); // 空对象合法
});

test('applyUpdates 拒绝 null/非对象入参', () => {
  assert.strictEqual(config.applyUpdates(null).ok, false);
  assert.strictEqual(config.applyUpdates('str').ok, false);
  assert.strictEqual(config.applyUpdates(42).ok, false);
});

test('flush() 同步写盘, 文件可被读回', (t, done) => {
  // 立即改一个值, 然后 flush
  config.applyUpdates({ defaultQuality: 'TEST_QUALITY' });
  config.flush();
  // 文件应该被同步写入
  const written = JSON.parse(fs.readFileSync(path.join(TMP, 'config.json'), 'utf8'));
  assert.strictEqual(written.defaultQuality, 'TEST_QUALITY');
  done();
});

test.after(async () => {
  // 清理临时目录
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
});
