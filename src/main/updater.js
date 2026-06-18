'use strict';

/**
 * 自动更新模块
 *
 * 职责:
 * 1. 包装 Electron 内置 autoUpdater
 * 2. dev 模式 / 非 GitHub 环境 graceful fallback
 * 3. 进度事件转发给渲染进程 (toast + 进度条)
 *
 * 注意: autoUpdater 只在打包后可用
 *      (process.env.NODE_ENV !== 'development' && app.isPackaged)
 *      dev 模式调用 checkAndDownload 会返回 { ok: false, reason: 'dev-mode' }
 */

const { app, autoUpdater, BrowserWindow } = require('electron');
const log = require('./logger');

const GITHUB_OWNER = 'Minions777';
const GITHUB_REPO = 'flac-music';

let initialized = false;
const listeners = {};

/**
 * 初始化 (幂等): 设置 feed + 注册事件转发
 * 必须在 app.whenReady() 之后调用
 */
function init() {
  if (initialized) return;
  initialized = true;

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO
  });

  // dev 模式禁用自动下载 (签名/feed 不匹配)
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const forward = (channel, payload) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking-for-update');
    forward('update-status', { phase: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[updater] update-available ${info.version}`);
    forward('update-status', { phase: 'available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    forward('update-status', {
      phase: 'downloading',
      percent: Math.round(progress.percent),
      speed: progress.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] update-downloaded ${info.version}`);
    forward('update-status', { phase: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    log.warn(`[updater] error: ${err.message}`);
    forward('update-status', { phase: 'error', error: err.message });
  });
}

/**
 * 仅检查 (不下载)
 * - dev 模式: 返回 { ok: false, reason: 'dev-mode' }
 * - 已是最新: 返回 { ok: true, upToDate: true }
 * - 有新版本: 返回 { ok: true, upToDate: false, version }
 */
async function check() {
  if (!app.isPackaged) {
    return { ok: false, reason: 'dev-mode', message: '开发模式不检查更新' };
  }
  if (!initialized) init();
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result) return { ok: false, reason: 'no-result' };
    return {
      ok: true,
      upToDate: !result.updateInfo || result.updateInfo.version === app.getVersion(),
      version: result.updateInfo ? result.updateInfo.version : null
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 检查 + 下载 (不安装)
 * 安装由用户在"已下载"状态时点击确认, 触发 quitAndInstall
 */
async function checkAndDownload() {
  if (!app.isPackaged) {
    return { ok: false, reason: 'dev-mode', message: '开发模式不能下载更新' };
  }
  if (!initialized) init();
  try {
    await autoUpdater.checkForUpdates();
    if (autoUpdater.updateAvailable) {
      await autoUpdater.downloadUpdate();
      return { ok: true, phase: 'downloaded' };
    }
    return { ok: true, phase: 'up-to-date' };
  } catch (err) {
    log.warn(`[updater] checkAndDownload 失败: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** 退出并安装 (用户已确认) */
function quitAndInstall() {
  if (!initialized) init();
  autoUpdater.quitAndInstall();
}

module.exports = { init, check, checkAndDownload, quitAndInstall };
