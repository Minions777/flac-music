'use strict';

/**
 * logger.js 单元测试
 * 覆盖: 控制台双写、轮转、flush、writeSync
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 临时目录
let tmpDir;
const logPath = () => path.join(tmpDir, 'app.log');

// mock electron
const logMessages = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
beforeEach(() => {
  logMessages.length = 0;
  console.log = (...a) => logMessages.push(['log', ...a]);
  console.warn = (...a) => logMessages.push(['warn', ...a]);
  console.error = (...a) => logMessages.push(['error', ...a]);
});

// 在 require logger 之前 mock electron
const fakeApp = {
  getPath: () => tmpDir,
  getVersion: () => '2.4.1',
  isPackaged: false
};
require.cache[require.resolve('electron')] = {
  exports: {
    app: fakeApp,
    contextBridge: {},
    ipcRenderer: {}
  }
};

function freshLogger() {
  // 清掉缓存, 让 constants 重新读 mock app
  delete require.cache[require.resolve('../../src/main/constants.js')];
  delete require.cache[require.resolve('../../src/main/logger.js')];
  return require('../../src/main/logger.js');
}

describe('logger', () => {
  test('info 同时写控制台和文件', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    log.info('test message');
    await log.flush();
    assert.equal(logMessages.length, 1);
    assert.equal(logMessages[0][0], 'log');
    assert.ok(logMessages[0][1].includes('test message'));
    const content = fs.readFileSync(logPath(), 'utf8');
    assert.ok(content.includes('test message'));
    assert.ok(content.includes('[INFO]'));
  });

  test('warn 走 console.warn', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    log.warn('warning test');
    await log.flush();
    assert.equal(logMessages[0][0], 'warn');
  });

  test('error 走 console.error', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    log.error('error test');
    await log.flush();
    assert.equal(logMessages[0][0], 'error');
    assert.ok(logMessages[0][1].includes('error test'));
  });

  test('log 行带 ISO 时间戳', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    log.info('timestamp test');
    await log.flush();
    const content = fs.readFileSync(logPath(), 'utf8');
    assert.match(content, /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('writeSync 立即落盘', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    log.writeSync('INFO', 'sync test');
    const content = fs.readFileSync(logPath(), 'utf8');
    assert.ok(content.includes('sync test'));
  });

  test('writeSync 错误也写', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    log.writeSync('ERROR', 'sync error test');
    const content = fs.readFileSync(logPath(), 'utf8');
    assert.ok(content.includes('[ERROR]'));
  });

  test('轮转: 大文件触发 rotate', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    // 预填一个超大文件
    fs.writeFileSync(logPath(), 'x'.repeat(6 * 1024 * 1024));
    const log = freshLogger();
    log.info('after rotate');
    await log.flush();
    // 归档 app.log.1 应存在
    assert.ok(fs.existsSync(logPath() + '.1'), '轮转应生成 app.log.1');
    const archived = fs.readFileSync(logPath() + '.1', 'utf8');
    assert.ok(archived.includes('x'.repeat(100)), '归档应包含原始大文件内容');
  });

  test('轮转: 多次触发形成 .1, .2, .3 序列', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    for (let i = 0; i < 3; i += 1) {
      fs.writeFileSync(logPath(), 'y'.repeat(6 * 1024 * 1024));
      const log = freshLogger();
      log.info('rotation ' + i);
      await log.flush();
    }
    assert.ok(fs.existsSync(logPath() + '.1'), '应存在 .1');
    assert.ok(fs.existsSync(logPath() + '.2'), '应存在 .2');
    assert.ok(fs.existsSync(logPath() + '.3'), '应存在 .3');
  });

  test('轮转: 达到 MAX_ARCHIVES 后最老的被淘汰', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    // 预填 10 个归档 (到 MAX_ARCHIVES)
    for (let i = 1; i <= 10; i += 1) {
      fs.writeFileSync(logPath() + '.' + i, 'old-' + i);
    }
    fs.writeFileSync(logPath(), 'z'.repeat(6 * 1024 * 1024));
    const log = freshLogger();
    log.info('trigger');
    await log.flush();
    // 轮转后, .10 应是 "old-9" 的内容 (原 .10 即 "old-10" 已淘汰)
    const ten = fs.readFileSync(logPath() + '.10', 'utf8');
    assert.equal(ten, 'old-9', '原 .9 已移至 .10, 原 .10 已淘汰');
    // 原 .2 ("old-2") 现在应在 .3
    const three = fs.readFileSync(logPath() + '.3', 'utf8');
    assert.equal(three, 'old-2', '原 .2 已移至 .3');
    // 当前日志 (轮转后新建) 应含 'trigger'
    const current = fs.readFileSync(logPath(), 'utf8');
    assert.ok(current.includes('trigger'), '当前日志应含 trigger');
  });

  test('flush 等待所有 pending 写完成', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    log.info('a');
    log.info('b');
    log.info('c');
    await log.flush();
    const content = fs.readFileSync(logPath(), 'utf8');
    assert.ok(content.includes('a'));
    assert.ok(content.includes('b'));
    assert.ok(content.includes('c'));
  });

  test('flush 在空队列也安全', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    await log.flush();
    assert.ok(true);
  });

  test('rotate() 单独调用不抛', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    assert.doesNotThrow(() => log.rotate());
  });

  test('rotate() 在空目录也不抛', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    const log = freshLogger();
    assert.doesNotThrow(() => log.rotate());
  });
});
