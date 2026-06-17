'use strict';

/**
 * preload/searches.js - 搜索域 API
 */

const { ipcRenderer } = require('electron');

module.exports = {
  search: (keyword, page = 1) => ipcRenderer.invoke('search', { keyword, page })
};
