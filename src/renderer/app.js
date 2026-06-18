'use strict';

/**
 * 渲染进程入口
 * 职责: 顺序初始化各模块, 不包含业务逻辑
 *
 * 加载顺序:
 *   1. 全局错误处理
 *   2. 拉取 config + sysInfo
 *   3. 平台适配 + 应用设置
 *   4. 注册各 page 的 DOM 事件
 *   5. 订阅 IPC 事件
 *   6. 拉取主进程任务列表
 */

import { configGet, systemInfo } from './core/api.js';
import { state, DEFAULT_CONFIG, FALLBACK_SYS_INFO } from './core/state.js';
import { setupGlobalErrorHandler, showConnectionError } from './core/errors.js';
import { applyPlatform } from './core/platform.js';
import { setupEvents } from './core/events.js';
import { initTheme, mountToggleButton } from './core/theme.js';
import { setupNav } from './pages/nav.js';
import { setupTitlebar } from './pages/titlebar.js';
import { setupModals } from './components/modal.js';
import { setupSearch } from './pages/search.js';
import { setupDownloadsPage, refreshDownloadList } from './pages/downloads.js';
import { setupSettingsPage, applySettings } from './pages/settings.js';
import { setupLibraryPage } from './pages/library.js';

async function init() {
  // 主题: 在所有 UI 渲染前先应用, 避免深浅闪烁
  initTheme();
  setupGlobalErrorHandler();

  try {
    [state.config, state.sysInfo] = await Promise.all([configGet(), systemInfo()]);
  } catch (err) {
    state.config = { ...DEFAULT_CONFIG };
    state.sysInfo = { ...FALLBACK_SYS_INFO };
    console.error('[Init] 与主进程通信失败, 使用默认配置:', err);
    showConnectionError();
  }

  applyPlatform();
  applySettings();

  setupNav();
  setupTitlebar();
  setupModals();
  setupSearch();
  setupDownloadsPage();
  setupSettingsPage();
  setupLibraryPage();

  setupEvents();
  refreshDownloadList();

  // 通知错误边界: init 已完成
  window.dispatchEvent(new CustomEvent('flac:init-done'));
}

document.addEventListener('DOMContentLoaded', init);
