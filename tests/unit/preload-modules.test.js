'use strict';

/**
 * preload 模块拆分测试
 * 验证各业务域的 preload 模块正确暴露 API
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// 模拟 electron (在测试环境下不真正 invoke)
const calls = [];
const listeners = {};
const ipcRenderer = {
  invoke: (channel, ...args) => { calls.push({ channel, args }); return Promise.resolve({ ok: true, _channel: channel }); },
  on: (channel, fn) => { (listeners[channel] = listeners[channel] || []).push(fn); },
  removeListener: (channel, fn) => {
    if (listeners[channel]) listeners[channel] = listeners[channel].filter((f) => f !== fn);
  }
};
const contextBridge = {
  exposeInMainWorld: (key, api) => { global._exposed = { key, api }; }
};

require.cache[require.resolve('electron')] = {
  exports: { contextBridge, ipcRenderer, app: { getVersion: () => '2.4.1' } }
};

describe('preload 模块拆分', () => {
  test('searches 模块暴露 search', () => {
    const m = require('../../src/preload/searches');
    assert.equal(typeof m.search, 'function');
  });

  test('downloads 模块暴露下载 API + 事件订阅', () => {
    const m = require('../../src/preload/downloads');
    assert.equal(typeof m.downloadAdd, 'function');
    assert.equal(typeof m.downloadPause, 'function');
    assert.equal(typeof m.downloadResume, 'function');
    assert.equal(typeof m.downloadCancel, 'function');
    assert.equal(typeof m.downloadList, 'function');
    assert.equal(typeof m.onTaskProgress, 'function');
    assert.equal(typeof m.onTaskFinished, 'function');
    assert.equal(typeof m.onPauseAll, 'function');
    assert.equal(typeof m.onResumeAll, 'function');
    assert.equal(typeof m.onClearDone, 'function');
  });

  test('config 模块暴露 configGet / configSet', () => {
    const m = require('../../src/preload/config');
    assert.equal(typeof m.configGet, 'function');
    assert.equal(typeof m.configSet, 'function');
  });

  test('files 模块暴露目录与库 API', () => {
    const m = require('../../src/preload/files');
    assert.equal(typeof m.chooseDir, 'function');
    assert.equal(typeof m.revealFile, 'function');
    assert.equal(typeof m.openDir, 'function');
    assert.equal(typeof m.libraryScan, 'function');
  });

  test('system 模块暴露系统/窗口/更新/遥测 API + 事件', () => {
    const m = require('../../src/preload/system');
    assert.equal(typeof m.systemInfo, 'function');
    assert.equal(typeof m.windowMin, 'function');
    assert.equal(typeof m.windowMax, 'function');
    assert.equal(typeof m.forceQuit, 'function');
    assert.equal(typeof m.openExternal, 'function');
    assert.equal(typeof m.updateCheck, 'function');
    assert.equal(typeof m.updateDownload, 'function');
    assert.equal(typeof m.updateInstall, 'function');
    assert.equal(typeof m.reportError, 'function');
    assert.equal(typeof m.onNav, 'function');
    assert.equal(typeof m.onConfirmClose, 'function');
    assert.equal(typeof m.onCheckUpdate, 'function');
    assert.equal(typeof m.onUpdateStatus, 'function');
  });

  test('preload 入口暴露统一 API', () => {
    require('../../src/preload.js');
    assert.equal(global._exposed.key, 'flacMusic');
    const api = global._exposed.api;
    // 应包含所有业务域的 API
    ['search', 'downloadAdd', 'downloadList', 'configGet', 'chooseDir',
     'systemInfo', 'windowMin', 'updateCheck', 'reportError'].forEach((k) => {
      assert.equal(typeof api[k], 'function', `${k} 应是函数`);
    });
  });

  test('onTaskProgress 返回的取消函数能精确移除监听', () => {
    const m = require('../../src/preload/downloads');
    const cb = () => {};
    const remove = m.onTaskProgress(cb);
    assert.equal(listeners['task-progress'].length, 1);
    remove();
    assert.equal(listeners['task-progress'].length, 0);
  });

  test('调用 downloadAdd 触发 ipcRenderer.invoke', () => {
    calls.length = 0;
    const m = require('../../src/preload/downloads');
    m.downloadAdd([{ id: 1 }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].channel, 'download-add');
    assert.deepEqual(calls[0].args, [[{ id: 1 }]]);
  });

  test('调用 configSet 传递更新对象', () => {
    calls.length = 0;
    const m = require('../../src/preload/config');
    m.configSet({ maxConcurrent: 5 });
    assert.equal(calls[0].channel, 'config-set');
    assert.deepEqual(calls[0].args, [{ maxConcurrent: 5 }]);
  });
});
