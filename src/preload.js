'use strict';

/**
 * preload 入口 - contextBridge 暴露给渲染进程的统一 API
 *
 * 设计:
 * - 按业务域拆分到 ./preload/*.js
 * - 本文件只是组装 + 暴露, 不含业务逻辑
 * - 渲染进程通过 window.flacMusic 访问
 *
 * API 分类 (按业务域):
 *   search   - 搜索 (searches.js)
 *   download - 下载管理 + 进度/完成/批量控制事件 (downloads.js)
 *   config   - 配置读写 (config.js)
 *   file     - 文件系统 (目录选择/显示/库扫描) (files.js)
 *   system   - 系统/窗口/更新/遥测/导航事件 (system.js)
 */

const { contextBridge } = require('electron');
const searches = require('./preload/searches');
const downloads = require('./preload/downloads');
const config = require('./preload/config');
const files = require('./preload/files');
const system = require('./preload/system');

contextBridge.exposeInMainWorld('flacMusic', {
  // 搜索域
  search: searches.search,

  // 下载域 (API + 事件)
  ...downloads,

  // 配置域
  ...config,

  // 文件域
  ...files,

  // 系统域 (API + 导航/更新/关闭事件)
  ...system
});
