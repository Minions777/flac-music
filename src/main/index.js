'use strict';

/**
 * 应用入口
 * 职责:
 * 1. 单实例锁 (失败时弹 dialog 友好提示, 不静默退出)
 * 2. 创建 DownloadManager 实例, 注入依赖
 * 3. 注册窗口、菜单、IPC
 * 4. 监听 app 生命周期
 *
 * 此文件是唯一直接 import electron.app 的主进程模块
 */

const { app, BrowserWindow, dialog } = require('electron');
const log = require('./logger');
const config = require('./config');
const telemetry = require('./telemetry');
const { DownloadManager } = require('./download-manager');
const window = require('./window');
const menu = require('./menu');
const ipc = require('./ipc');
const updater = require('./updater');
const cspReport = require('./csp-report');

// ── 单实例锁 ─────────────────────────────────────────────
// 失败时不应静默退出, 用户会以为是应用崩溃
// 弹出友好提示后退出
if (!app.requestSingleInstanceLock()) {
  try {
    dialog.showMessageBoxSync({
      type: 'info',
      title: 'FLAC Music',
      message: 'FLAC Music 已在运行',
      detail: '请前往现有窗口继续使用, 无需重复启动。',
      buttons: ['好'],
      defaultId: 0,
      noLink: true
    });
  } catch (_) {
    // dialog 不可用 (例如 headless), 退而求其次用 console
    log.warn('[single-instance] 已有一个 FLAC Music 在运行, 本次启动退出。');
  }
  app.quit();
  process.exit(0);
}

// ── DownloadManager 实例 (注入依赖, 便于测试和替换) ────────
let downloadManager;

function buildDownloadManager() {
  return new DownloadManager({
    logger: log,
    getConfig: config.get,
    notify: (task) => {
      const win = window.get();
      if (win && !win.isDestroyed()) {
        win.webContents.send('task-progress', task);
        if (task.status === 'done' || task.status === 'failed') {
          win.webContents.send('task-finished', {
            id: task.id,
            status: task.status,
            savePath: task.savePath,
            error: task.error || ''
          });
        }
      }
    },
    maxConcurrent: config.get().maxConcurrent
  });
}

// ── 生命周期 ─────────────────────────────────────────────
app.whenReady().then(() => {
  // 启动 telemetry (默认禁用, 通过 config 显式开启)
  telemetry.init({
    enabled: config.get().telemetry === true,
    endpoint: config.get().telemetryEndpoint,
    appVersion: app.getVersion()
  });

  downloadManager = buildDownloadManager();
  window.create();
  window.attachCloseGuard(() => downloadManager.active.length > 0);
  menu.build();
  ipc.register({ downloadManager });

  // CSP 违规报告: 拦截 csp-report POST, 写入本地日志
  cspReport.attach(app.session || require('electron').session.defaultSession);

  // 初始化更新器 (必须在 app ready 后; 内部幂等)
  updater.init();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      window.create();
    } else {
      window.get()?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  const win = window.get();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('before-quit', () => {
  // 同步落盘: 用户退出时确保 config 写入
  config.flush();
  if (downloadManager) downloadManager.shutdown();
});
