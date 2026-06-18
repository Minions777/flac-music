'use strict';

/**
 * 主窗口创建
 * 把窗口的所有配置集中到一处, 避免散落在 main 入口
 */

const path = require('path');
const { BrowserWindow } = require('electron');
const config = require('./config');

const isDev = process.argv.includes('--dev') || !require('electron').app.isPackaged;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 640;
const DEFAULT_BG = '#0d0f14';

let mainWindow = null;

function create() {
  const { width, height } = config.get().windowBounds || { width: 1160, height: 780 };

  mainWindow = new BrowserWindow({
    width: Math.max(width, MIN_WIDTH),
    height: Math.max(height, MIN_HEIGHT),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'FLAC Music',
    backgroundColor: DEFAULT_BG,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [w, h] = mainWindow.getSize();
      config.applyUpdates({ windowBounds: { width: w, height: h } });
    }
  });
}

/** 窗口关闭时若有进行中任务, 通知渲染进程弹确认框 */
function attachCloseGuard(hasActiveTasks) {
  if (!mainWindow) return;
  mainWindow.on('close', (e) => {
    if (hasActiveTasks()) {
      e.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('confirm-close', { activeTasks: hasActiveTasks() });
      }
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function get() {
  return mainWindow;
}

module.exports = { create, attachCloseGuard, get };
