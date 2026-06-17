'use strict';

/**
 * preload/files.js - 文件系统域 API (目录选择/文件显示/库扫描)
 */

const { ipcRenderer } = require('electron');

module.exports = {
  chooseDir: () => ipcRenderer.invoke('choose-dir'),
  revealFile: (fp) => ipcRenderer.invoke('reveal-file', fp),
  openDir: () => ipcRenderer.invoke('open-dir'),
  libraryScan: () => ipcRenderer.invoke('library-scan')
};
