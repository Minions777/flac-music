'use strict';

/**
 * preload/downloads.js - 下载域 API + 事件
 */

const { ipcRenderer } = require('electron');

const API = {
  downloadAdd: (tracks) => ipcRenderer.invoke('download-add', tracks),
  downloadPause: (id) => ipcRenderer.invoke('download-pause', id),
  downloadResume: (id) => ipcRenderer.invoke('download-resume', id),
  downloadCancel: (id) => ipcRenderer.invoke('download-cancel', id),
  downloadList: () => ipcRenderer.invoke('download-list')
};

const EVENTS = {
  onTaskProgress: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('task-progress', h);
    return () => ipcRenderer.removeListener('task-progress', h);
  },
  onTaskFinished: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('task-finished', h);
    return () => ipcRenderer.removeListener('task-finished', h);
  },
  onPauseAll: (cb) => ipcRenderer.on('dl-pause-all', () => cb()),
  onResumeAll: (cb) => ipcRenderer.on('dl-resume-all', () => cb()),
  onClearDone: (cb) => ipcRenderer.on('dl-clear-done', () => cb())
};

module.exports = { ...API, ...EVENTS };
