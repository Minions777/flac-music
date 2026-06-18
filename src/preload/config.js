'use strict';

/**
 * preload/config.js - 配置域 API
 */

const { ipcRenderer } = require('electron');

module.exports = {
  configGet: () => ipcRenderer.invoke('config-get'),
  configSet: (updates) => ipcRenderer.invoke('config-set', updates)
};
