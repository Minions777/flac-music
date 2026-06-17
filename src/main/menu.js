'use strict';

/**
 * 应用菜单
 * 集中管理菜单项; 回调都通过 send-to-renderer, 不直接操作业务
 */

const { app, Menu, shell } = require('electron');
const window = require('./window');
const config = require('./config');

function build() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: '关于 FLAC Music' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: '退出' }
            ]
          }
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '打开下载目录',
          accelerator: 'CmdOrCtrl+O',
          click: () => shell.openPath(config.get().downloadDir)
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => window.get()?.webContents.send('nav', 'settings')
        },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit', label: '退出' }] : [])
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '下载',
      submenu: [
        {
          label: '全部暂停',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: sendToRenderer('dl-pause-all')
        },
        {
          label: '全部恢复',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: sendToRenderer('dl-resume-all')
        },
        { type: 'separator' },
        { label: '清空已完成', click: sendToRenderer('dl-clear-done') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { type: 'separator' },
        // ── 自定义快捷键: 页面切换 ──
        {
          label: '搜索',
          accelerator: 'CmdOrCtrl+1',
          click: dispatchShortcut('nav', 'search')
        },
        {
          label: '下载',
          accelerator: 'CmdOrCtrl+2',
          click: dispatchShortcut('nav', 'downloads')
        },
        {
          label: '音乐库',
          accelerator: 'CmdOrCtrl+3',
          click: dispatchShortcut('nav', 'library')
        },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+4',
          click: dispatchShortcut('nav', 'settings')
        }
      ]
    },
    {
      label: '播放',
      submenu: [
        {
          label: '聚焦搜索框',
          accelerator: 'CmdOrCtrl+F',
          click: dispatchShortcut('focus-search')
        },
        {
          label: '批量下载 (已选)',
          accelerator: 'CmdOrCtrl+D',
          click: dispatchShortcut('batch-download')
        },
        {
          label: '清空已完成下载',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: dispatchShortcut('clear-done')
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '访问官网', click: () => shell.openExternal('https://flac.music.hi.cn/') },
        { label: '检查更新', click: sendToRenderer('check-update') },
        ...(!isMac ? [{ type: 'separator' }, { role: 'about', label: '关于' }] : [])
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sendToRenderer(channel) {
  return () => window.get()?.webContents.send(channel);
}

/** 派发快捷键事件: 统一 channel 'shortcut', payload { type, value } */
function dispatchShortcut(type, value) {
  return () => window.get()?.webContents.send('shortcut', { type, value });
}

module.exports = { build, dispatchShortcut, sendToRenderer };
