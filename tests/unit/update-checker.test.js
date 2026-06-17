'use strict';

/**
 * update-checker 模块单元测试
 * 重点测试纯函数: compareVersions
 * 网络层 check() 在集成测试中覆盖
 */

const test = require('node:test');
const assert = require('node:assert');
const { compareVersions } = require('../../src/main/update-checker');

test('compareVersions: 相等版本返回 0', () => {
  assert.strictEqual(compareVersions('1.0.0', '1.0.0'), 0);
  assert.strictEqual(compareVersions('2.4.1', '2.4.1'), 0);
});

test('compareVersions: 数字逐段比较 (1.2.10 > 1.2.9)', () => {
  // 关键: 必须用数字比较, 不能用字符串 (字符串 "10" < "9")
  assert.ok(compareVersions('1.2.10', '1.2.9') > 0, '1.2.10 应大于 1.2.9');
  assert.ok(compareVersions('1.2.9', '1.2.10') < 0);
});

test('compareVersions: 缺失段补 0', () => {
  assert.strictEqual(compareVersions('1.0', '1.0.0'), 0);
  assert.ok(compareVersions('1.0.1', '1.0') > 0);
  assert.ok(compareVersions('1.0', '1.0.1') < 0);
});

test('compareVersions: 跨多位比较', () => {
  assert.ok(compareVersions('2.0.0', '1.99.99') > 0);
  assert.ok(compareVersions('1.99.99', '2.0.0') < 0);
});

test('compareVersions: 非法数字被当 0', () => {
  assert.strictEqual(compareVersions('1.0.0', '1.0.bad'), 0);
  assert.strictEqual(compareVersions('abc', '1.0.0'), -1);
});

test('compareVersions: 实际升级场景', () => {
  // 当前 2.4.1, 最新 2.5.0 → 需要更新
  assert.ok(compareVersions('2.4.1', '2.5.0') < 0);
  // 当前 2.5.0, 最新 2.4.1 → 已是最新
  assert.ok(compareVersions('2.5.0', '2.4.1') > 0);
});
