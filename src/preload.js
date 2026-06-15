'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flacMusic', {
  search:        (keyword, page = 1) => ipcRenderer.invoke('search', { keyword, page }),
  downloadAdd:   (tracks)  => ipcRenderer.invoke('download-add', tracks),
  downloadPause: (id)      => ipcRenderer.invoke('download-pause', id),
  downloadResume:(id)      => ipcRenderer.invoke('download-resume', id),
  downloadCancel:(id)      => ipcRenderer.invoke('download-cancel', id),
  downloadList:  ()        => ipcRenderer.invoke('download-list'),
  configGet:     ()        => ipcRenderer.invoke('config-get'),
  configSet:     (updates) => ipcRenderer.invoke('config-set', updates),
  chooseDir:     ()        => ipcRenderer.invoke('choose-dir'),
  revealFile:    (fp)      => ipcRenderer.invoke('reveal-file', fp),
  openDir:       ()        => ipcRenderer.invoke('open-dir'),
  systemInfo:    ()        => ipcRenderer.invoke('system-info'),
  forceQuit:     ()        => ipcRenderer.invoke('force-quit'),
  windowMin:     ()        => ipcRenderer.invoke('window-min'),
  windowMax:     ()        => ipcRenderer.invoke('window-max'),
  openExternal:  (url)     => ipcRenderer.invoke('open-external', url),
  updateCheck:   ()        => ipcRenderer.invoke('update-check'),

  onTaskProgress: (cb)  => { ipcRenderer.on('task-progress', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('task-progress'); },
  onTaskFinished: (cb)  => { ipcRenderer.on('task-finished', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('task-finished'); },
  onNav:          (cb)  => { ipcRenderer.on('nav', (_, p) => cb(p)); return () => ipcRenderer.removeAllListeners('nav'); },
  onPauseAll:     (cb)  => { ipcRenderer.on('dl-pause-all',  () => cb()); },
  onResumeAll:    (cb)  => { ipcRenderer.on('dl-resume-all', () => cb()); },
  onClearDone:    (cb)  => { ipcRenderer.on('dl-clear-done', () => cb()); },
  onConfirmClose: (cb)  => { ipcRenderer.on('confirm-close', (_, d) => cb(d)); },
  onCheckUpdate:  (cb)  => { ipcRenderer.on('check-update',  () => cb()); }
});