'use strict';

/**
 * csp-report 单元测试
 * 验证: 拦截器能正确提取请求 body 并调用 log
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 临时 userData
let tmpDir;
const fakeApp = {
  getPath: () => tmpDir,
  getVersion: () => '2.4.1',
  isPackaged: false
};
require.cache[require.resolve('electron')] = {
  exports: {
    app: fakeApp,
    session: { defaultSession: null },
    contextBridge: {},
    ipcRenderer: {}
  }
};

function freshLogger() {
  delete require.cache[require.resolve('../../src/main/logger.js')];
  delete require.cache[require.resolve('../../src/main/csp-report.js')];
  return require('../../src/main/logger.js');
}

function freshCspReport() {
  delete require.cache[require.resolve('../../src/main/csp-report.js')];
  return require('../../src/main/csp-report.js');
}

describe('csp-report', () => {
  test('attach 接受 null session 不抛错', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-test-'));
    const log = freshLogger();
    const csp = freshCspReport();
    assert.doesNotThrow(() => csp.attach(null));
  });

  test('attach 注册 onBeforeRequest 拦截器', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-test-'));
    const log = freshLogger();
    const csp = freshCspReport();
    const registered = [];
    const fakeSession = {
      webRequest: {
        onBeforeRequest: (filter, callback) => {
          registered.push({ urls: filter.urls, hasCallback: typeof callback === 'function' });
        }
      }
    };
    csp.attach(fakeSession);
    assert.equal(registered.length, 1);
    assert.ok(registered[0].urls.some((u) => u.includes('csp-report')));
    assert.ok(registered[0].hasCallback);
  });

  test('attach 接受缺少 webRequest 的 session 不抛错', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-test-'));
    const log = freshLogger();
    const csp = freshCspReport();
    assert.doesNotThrow(() => csp.attach({}));
  });

  test('回调内解析违规 JSON 并调用 log.warn', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-test-'));
    const log = freshLogger();
    const csp = freshCspReport();
    const warnings = [];
    const origWarn = log.warn;
    log.warn = (msg) => warnings.push(msg);

    let registeredCallback = null;
    const fakeSession = {
      webRequest: {
        onBeforeRequest: (filter, callback) => { registeredCallback = callback; }
      }
    };
    csp.attach(fakeSession);

    // 模拟 CSP 违规上报
    const violationPayload = JSON.stringify({
      'csp-report': {
        'violated-directive': 'script-src',
        'blocked-uri': 'inline',
        'source-file': 'app.js',
        'line-number': 42
      }
    });
    let cancelled = null;
    registeredCallback(
      {
        url: 'file:///csp-report',
        uploadData: [{ bytes: Buffer.from(violationPayload, 'utf8') }]
      },
      (resp) => { cancelled = resp.cancel; }
    );
    // 等待 log 内部 promise 完成
    await log.flush();
    log.warn = origWarn;
    assert.equal(cancelled, false, '不应阻断 CSP 报告请求');
    assert.ok(warnings.some((w) => w.includes('CSP-VIOLATION')));
    assert.ok(warnings.some((w) => w.includes('script-src')));
  });

  test('回调容忍非 JSON body', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-test-'));
    const log = freshLogger();
    const csp = freshCspReport();
    const warnings = [];
    const origWarn = log.warn;
    log.warn = (msg) => warnings.push(msg);

    let cb = null;
    csp.attach({
      webRequest: {
        onBeforeRequest: (filter, callback) => { cb = callback; }
      }
    });

    cb(
      { url: 'file:///csp-report', uploadData: [{ string: 'not-json-body' }] },
      () => {}
    );
    await log.flush();
    log.warn = origWarn;
    assert.ok(warnings.some((w) => w.includes('CSP-VIOLATION')));
  });

  test('回调容忍空 uploadData', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-test-'));
    const log = freshLogger();
    const csp = freshCspReport();
    let cb = null;
    csp.attach({
      webRequest: {
        onBeforeRequest: (filter, callback) => { cb = callback; }
      }
    });
    let cancelled = null;
    cb(
      { url: 'file:///csp-report', uploadData: [] },
      (resp) => { cancelled = resp.cancel; }
    );
    assert.equal(cancelled, false);
  });
});
