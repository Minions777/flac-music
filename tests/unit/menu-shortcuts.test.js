'use strict';

/**
 * menu.js 快捷键派发测试
 * 验证 dispatchShortcut 生成正确的 webContents.send payload
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// 模拟 electron
const sentMessages = [];
const fakeWebContents = {
  send: (channel, payload) => { sentMessages.push({ channel, payload }); }
};
const fakeWindow = { get: () => ({ webContents: fakeWebContents }) };

// Mock Menu 记录最后一次 buildFromTemplate 的 tpl
let _lastTemplate = null;
require.cache[require.resolve('electron')] = {
  exports: {
    app: {
      name: 'FLAC Music',
      isPackaged: false,
      getPath: () => '/tmp',
      getVersion: () => '2.4.1'
    },
    Menu: {
      buildFromTemplate: (tpl) => { _lastTemplate = tpl; return { _tpl: tpl }; },
      setApplicationMenu: () => {}
    },
    shell: { openPath: () => {}, openExternal: () => {} }
  }
};

function getTemplate() {
  return _lastTemplate;
}

// 加载 window mock
require.cache[require.resolve('../../src/main/window.js')] = {
  exports: fakeWindow
};

// 加载被测模块
const menu = require('../../src/main/menu.js');

describe('menu.js dispatchShortcut', () => {
  test('dispatchShortcut 返回派发器函数', () => {
    sentMessages.length = 0;
    const fn = menu.dispatchShortcut('nav', 'search');
    assert.equal(typeof fn, 'function');
    fn();
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].channel, 'shortcut');
    assert.deepEqual(sentMessages[0].payload, { type: 'nav', value: 'search' });
  });

  test('build() 生成包含播放子菜单的菜单模板', () => {
    menu.build();
    const appMenu = getTemplate();
    const playback = appMenu.find((m) => m.label === '播放');
    assert.ok(playback, '应存在"播放"菜单');
    const focusSearch = playback.submenu.find((i) => i.label && i.label.includes('搜索框'));
    assert.ok(focusSearch, '应包含"聚焦搜索框"项');
    assert.equal(focusSearch.accelerator, 'CmdOrCtrl+F');
  });

  test('build() 视图菜单含 Cmd+1..4 页面切换', () => {
    menu.build();
    const view = getTemplate().find((m) => m.label === '视图');
    const navItems = view.submenu.filter((i) => i.accelerator && i.accelerator.match(/CmdOrCtrl\+\d/));
    assert.equal(navItems.length, 4, '应有 4 个数字键导航项');
  });

  test('build() Cmd+1 = 搜索 / Cmd+2 = 下载 / Cmd+3 = 音乐库 / Cmd+4 = 设置', () => {
    menu.build();
    const view = getTemplate().find((m) => m.label === '视图');
    const map = {};
    view.submenu.forEach((i) => {
      if (i.accelerator && i.accelerator.match(/CmdOrCtrl\+\d/)) {
        map[i.accelerator] = i.label;
      }
    });
    assert.equal(map['CmdOrCtrl+1'], '搜索');
    assert.equal(map['CmdOrCtrl+2'], '下载');
    assert.equal(map['CmdOrCtrl+3'], '音乐库');
    assert.equal(map['CmdOrCtrl+4'], '设置');
  });
});
