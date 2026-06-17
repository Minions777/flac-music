'use strict';

/**
 * preload/system.js - 系统/窗口/更新/遥测 API
 */

const { ipcRenderer } = require('electron');

const API = {
  systemInfo: () => ipcRenderer.invoke('system-info'),
  forceQuit: () => ipcRenderer.invoke('force-quit'),
  windowMin: () => ipcRenderer.invoke('window-min'),
  windowMax: () => ipcRenderer.invoke('window-max'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  updateDownload: () => ipcRenderer.invoke('update-download'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
  reportError: (data) => ipcRenderer.invoke('telemetry-error', data)
};

const EVENTS = {
  onNav: (cb) => {
    const h = (_, p) => cb(p);
    ipcRenderer.on('nav', h);
    return () => ipcRenderer.removeListener('nav', h);
  },
  onConfirmClose: (cb) => ipcRenderer.on('confirm-close', (_, d) => cb(d)),
  onCheckUpdate: (cb) => ipcRenderer.on('check-update', () => cb()),
  onUpdateStatus: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('update-status', h);
    return () => ipcRenderer.removeListener('update-status', h);
  },
  /** 监听主进程菜单派发的快捷键 (channel: 'shortcut') */
  onShortcuts: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('shortcut', h);
    return () => ipcRenderer.removeListener('shortcut', h);
  }
};

module.exports = { ...API, ...EVENTS };
