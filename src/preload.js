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
  libraryScan:   ()        => ipcRenderer.invoke('library-scan'),
  systemInfo:    ()        => ipcRenderer.invoke('system-info'),
  forceQuit:     ()        => ipcRenderer.invoke('force-quit'),
  windowMin:     ()        => ipcRenderer.invoke('window-min'),
  windowMax:     ()        => ipcRenderer.invoke('window-max'),
  openExternal:  (url)     => ipcRenderer.invoke('open-external', url),
  updateCheck:   ()        => ipcRenderer.invoke('update-check'),

  onTaskProgress: (cb)  => { const h = (_, d) => cb(d); ipcRenderer.on('task-progress', h); return () => ipcRenderer.removeListener('task-progress', h); },
  onTaskFinished: (cb)  => { const h = (_, d) => cb(d); ipcRenderer.on('task-finished', h); return () => ipcRenderer.removeListener('task-finished', h); },
  onNav:          (cb)  => { const h = (_, p) => cb(p); ipcRenderer.on('nav', h); return () => ipcRenderer.removeListener('nav', h); },
  onPauseAll:     (cb)  => { ipcRenderer.on('dl-pause-all',  () => cb()); },
  onResumeAll:    (cb)  => { ipcRenderer.on('dl-resume-all', () => cb()); },
  onClearDone:    (cb)  => { ipcRenderer.on('dl-clear-done', () => cb()); },
  onConfirmClose: (cb)  => { ipcRenderer.on('confirm-close', (_, d) => cb(d)); },
  onCheckUpdate:  (cb)  => { ipcRenderer.on('check-update',  () => cb()); }
});