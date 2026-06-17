'use strict';

/**
 * IPC 处理器注册
 *
 * 单一 register() 入口, 避免散落的 ipcMain.handle 调用
 * 每个 handler 内部 try-catch, 失败返回 { ok: false, error } 而不是抛异常
 *  (渲染进程使用 invoke, 异常会被 promise reject, 体验差)
 */

const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { searchMusic } = require('./search');
const { scan: libraryScan } = require('./library');
const { check: updateCheck } = require('./update-checker');
const updater = require('./updater');
const telemetry = require('./telemetry');
const window = require('./window');
const config = require('./config');
const log = require('./logger');

/** 包裹一层: 把异常翻译成 { ok: false, error } */
function safe(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      log.error(`[IPC] handler 异常: ${err.message}`);
      return { ok: false, error: err.message };
    }
  };
}

function register({ downloadManager }) {
  // ── 搜索 ────────────────────────────────────────────────
  ipcMain.handle(
    'search',
    safe(async (_e, { keyword, page }) => {
      return await searchMusic(keyword, page);
    })
  );

  // ── 下载管理 ────────────────────────────────────────────
  ipcMain.handle(
    'download-add',
    safe((_e, tracks) => {
      const tasks = downloadManager.add(tracks);
      return { ok: true, tasks };
    })
  );
  ipcMain.handle(
    'download-pause',
    safe((_e, id) => {
      downloadManager.pause(id);
      return { ok: true };
    })
  );
  ipcMain.handle(
    'download-resume',
    safe((_e, id) => {
      downloadManager.resume(id);
      return { ok: true };
    })
  );
  ipcMain.handle(
    'download-cancel',
    safe((_e, id) => {
      downloadManager.cancel(id);
      return { ok: true };
    })
  );
  ipcMain.handle('download-list', () => downloadManager.allTasks());

  // ── 配置读写 ────────────────────────────────────────────
  ipcMain.handle('config-get', () => config.get());
  ipcMain.handle(
    'config-set',
    safe((_e, updates) => {
      const result = config.applyUpdates(updates);
      if (result.ok && typeof updates.maxConcurrent === 'number') {
        downloadManager.maxConcurrent = updates.maxConcurrent;
      }
      return result;
    })
  );

  // ── 文件系统 ────────────────────────────────────────────
  ipcMain.handle(
    'choose-dir',
    safe(async () => {
      const result = await dialog.showOpenDialog(window.get(), {
        title: '选择下载目录',
        defaultPath: config.get().downloadDir,
        properties: ['openDirectory', 'createDirectory']
      });
      return result.canceled ? null : result.filePaths[0];
    })
  );

  ipcMain.handle(
    'reveal-file',
    safe((_e, filePath) => {
      const allowed = path.resolve(config.get().downloadDir);
      const resolved = path.resolve(filePath);
      // 防止目录穿越: 必须落在下载目录内
      if (!resolved.startsWith(allowed + path.sep) && resolved !== allowed) {
        return { ok: false, error: 'Path not under download directory' };
      }
      shell.showItemInFolder(filePath);
      return { ok: true };
    })
  );

  ipcMain.handle(
    'open-dir',
    safe(() => {
      shell.openPath(config.get().downloadDir);
      return { ok: true };
    })
  );

  ipcMain.handle(
    'library-scan',
    safe(() => {
      const dir = config.get().downloadDir;
      return { ok: true, files: libraryScan(dir) };
    })
  );

  // ── 系统 / 窗口 ─────────────────────────────────────────
  ipcMain.handle('system-info', () => {
    const { app } = require('electron');
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node
    };
  });

  ipcMain.handle('window-min', () => {
    window.get()?.minimize();
    return { ok: true };
  });
  ipcMain.handle('window-max', () => {
    const w = window.get();
    if (!w) return { ok: false };
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
    return { ok: true };
  });
  ipcMain.handle('force-quit', () => {
    window.get()?.destroy();
    require('electron').app.quit();
  });

  ipcMain.handle(
    'open-external',
    safe((_e, url) => {
      if (!url || typeof url !== 'string') return { ok: false, error: 'Invalid URL' };
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { ok: false, error: 'Only http/https allowed' };
      }
      shell.openExternal(url);
      return { ok: true };
    })
  );

  ipcMain.handle(
    'update-check',
    safe(async () => {
      return await updateCheck();
    })
  );

  ipcMain.handle(
    'update-download',
    safe(async () => {
      return await updater.checkAndDownload();
    })
  );

  ipcMain.handle(
    'update-install',
    safe(() => {
      updater.quitAndInstall();
      return { ok: true };
    })
  );

  // ── Telemetry (渲染进程上报错误) ────────────────────────
  ipcMain.handle(
    'telemetry-error',
    safe((_e, { message, stack, context }) => {
      telemetry.captureError(
        Object.assign(new Error(message || 'Unknown error'), { stack }),
        context || {}
      );
      return { ok: true };
    })
  );
}

module.exports = { register };
