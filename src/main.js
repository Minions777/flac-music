'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── Dev 模式检测 ──────────────────────────────────────────
const isDev = process.argv.includes('--dev') || !app.isPackaged;

// ── 单实例锁 ──────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

// ── 全局变量 ──────────────────────────────────────────────
let mainWindow = null;
let tray       = null;

// ── 简易持久化存储 ──────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) { console.error('[Config] Failed to load, using defaults:', err.message); }
  return {
    downloadDir: app.getPath('music'),
    maxConcurrent: 3,
    defaultFormat: 'FLAC',
    defaultQuality: '24bit/96kHz',
    autoWriteMetadata: false,
    autoOrganize: true,
    windowBounds: { width: 1160, height: 780 }
  };
}

let _saveTimer = null;
function saveConfig(data) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[Config] Failed to save:', err.message);
    }
  }, 250);
}

let config = loadConfig();

// ── 下载任务队列 ──────────────────────────────────────────
class DownloadManager {
  constructor() {
    this.queue   = [];
    this.active  = [];
    this.done    = [];
    this.failed  = [];
    this.idCtr   = 1;
    this.maxConcurrent = config.maxConcurrent || 3;
    this._handles = new Map();
  }

  add(tracks) {
    const newTasks = tracks.map(t => ({
      id:       this.idCtr++,
      title:    t.title || '未知歌曲',
      artist:   t.artist || '未知艺人',
      album:    t.album || '未知专辑',
      year:     t.year || '',
      cover:    t.cover || '',
      format:   t.format || config.defaultFormat,
      quality:  t.quality || config.defaultQuality,
      url:      t.url || '',
      size:     t.size || 0,
      status:   'queued',
      progress: 0,
      speed:    0,
      downloaded: 0,
      savePath: '',
      error:    ''
    }));
    this.queue.push(...newTasks);
    this._flush();
    return newTasks;
  }

  _flush() {
    while (this.active.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.active.push(task);
      this._download(task);
    }
  }

  _download(task) {
    task.status = 'downloading';
    this._notify(task);

    const safeTitle  = task.title.replace(/[/\\:*?"<>|]/g, '_').replace(/[\x00-\x1f]/g, '');
    const safeArtist = task.artist.replace(/[/\\:*?"<>|]/g, '_').replace(/[\x00-\x1f]/g, '');
    const safeAlbum  = task.album.replace(/[/\\:*?"<>|]/g, '_').replace(/[\x00-\x1f]/g, '');
    let dir = config.downloadDir;
    if (config.autoOrganize) {
      dir = path.join(dir, safeArtist, safeAlbum);
    }
    fs.mkdirSync(dir, { recursive: true });
    const ext = task.format.toLowerCase();
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin';
    task.savePath = path.join(dir, `${safeTitle}.${safeExt}`);

    if (!task.url || task.url.startsWith('demo://')) {
      this._simulateDownload(task);
      return;
    }

    try {
      const parsedUrl = new URL(task.url);
      if (parsedUrl.protocol !== 'https:') {
        task.status = 'failed';
        task.error  = 'Only HTTPS URLs are supported';
        this._finish(task);
        return;
      }
      const req = https.get(task.url, { timeout: 30000 }, (res) => {
        if (res.statusCode !== 200) {
          task.status = 'failed';
          task.error  = `HTTP ${res.statusCode}`;
          this._finish(task);
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        task.size = total;
        let received = 0;
        const startTime = Date.now();
        const tmpPath = task.savePath + '.part';
        const file = fs.createWriteStream(tmpPath);

        const MAGIC_BYTES = {
          flac: [0x66, 0x4C, 0x61, 0x43],
          wav:  [0x52, 0x49, 0x46, 0x46],
          mp3:  [0xFF, 0xFB, 0x90],
          aac:  [0xFF, 0xF1],
          ape:  [0x4D, 0x41, 0x43],
          dsd:  [0x44, 0x53, 0x44, 0x5F],
        };

        const verifyMagic = (fp, fmt) => {
          const sig = MAGIC_BYTES[fmt.toLowerCase()];
          if (!sig) return true;
          try {
            const buf = Buffer.alloc(sig.length);
            const fd = fs.openSync(fp, 'r');
            fs.readSync(fd, buf, 0, sig.length, 0);
            fs.closeSync(fd);
            return sig.every((b, i) => buf[i] === b);
          } catch (_) { return false; }
        };

        res.on('data', (chunk) => {
          received += chunk.length;
          task.downloaded = received;
          task.progress   = total > 0 ? Math.round((received / total) * 100) : 0;
          const elapsed   = (Date.now() - startTime) / 1000;
          task.speed      = elapsed > 0 ? Math.round(received / elapsed) : 0;
          this._notify(task);
        });
        res.pipe(file);

        file.on('finish', () => {
          if (!verifyMagic(tmpPath, task.format)) {
            try { fs.unlink(tmpPath, () => {}); } catch (_) {}
            task.status = 'failed';
            task.error  = '文件格式校验失败';
            this._finish(task);
            return;
          }
          fs.rename(tmpPath, task.savePath, (err) => {
            if (err) {
              try { fs.unlink(tmpPath, () => {}); } catch (_) {}
              task.status = 'failed';
              task.error  = err.message;
            }
            this._finish(task);
          });
        });
        file.on('error', (err) => {
          try { fs.unlink(tmpPath, () => {}); } catch (_) {}
          task.status = 'failed';
          task.error  = err.message;
          this._finish(task);
        });

        this._handles.set(task.id, { req, res, file, abort: () => { req.destroy(); file.destroy(); } });
      });

      req.on('error', (err) => {
        task.status = 'failed';
        task.error  = err.message;
        this._finish(task);
      });
      req.on('timeout', () => {
        task.status = 'failed';
        task.error  = '连接超时';
        req.destroy();
        this._finish(task);
      });
    } catch (err) {
      task.status = 'failed';
      task.error  = err.message;
      this._finish(task);
    }
  }

  _simulateDownload(task) {
    const totalSize = Math.round((20 + Math.random() * 50) * 1024 * 1024);
    task.size = totalSize;
    let progress = 0;
    const speed  = Math.round((3 + Math.random() * 6) * 1024 * 1024);

    const tick = setInterval(() => {
      if (task.status === 'paused') return;
      if (task.status === 'failed' || task.status === 'done') {
        clearInterval(tick);
        return;
      }
      const inc     = Math.round(speed * 0.4 * (0.8 + Math.random() * 0.4));
      progress      = Math.min(progress + inc, totalSize);
      task.downloaded = progress;
      task.progress = Math.round((progress / totalSize) * 100);
      task.speed    = Math.round(speed * (0.85 + Math.random() * 0.3));
      this._notify(task);

      if (task.progress >= 100) {
        clearInterval(tick);
        task.status   = 'done';
        task.progress = 100;
        this._finish(task);
      }
    }, 400);

    this._handles.set(task.id, { req: null, file: null, abort: () => clearInterval(tick) });
  }

  pause(id) {
    const task = this._find(id);
    if (task && task.status === 'downloading') {
      task.status = 'paused';
      const handle = this._handles.get(id);
      if (handle) {
        if (handle.res && typeof handle.res.pause === 'function') handle.res.pause();
        if (handle.file && typeof handle.file.pause === 'function') handle.file.pause();
      }
      this._notify(task);
    }
  }

  resume(id) {
    const task = this._find(id);
    if (task && task.status === 'paused') {
      task.status = 'downloading';
      const handle = this._handles.get(id);
      if (handle) {
        if (handle.res && typeof handle.res.resume === 'function') handle.res.resume();
        if (handle.file && typeof handle.file.resume === 'function') handle.file.resume();
      }
      this._notify(task);
    }
  }

  cancel(id) {
    const handle = this._handles.get(id);
    if (handle && handle.abort) handle.abort();
    this._handles.delete(id);

    // Clean up any .part file
    const task = this._find(id);
    if (task && task.savePath) {
      try { fs.unlink(task.savePath + '.part', () => {}); } catch (_) {}
    }

    const inActive = this.active.findIndex(t => t.id === id);
    if (inActive !== -1) {
      this.active.splice(inActive, 1);
      this._flush();
    }
    const inQueue = this.queue.findIndex(t => t.id === id);
    if (inQueue !== -1) this.queue.splice(inQueue, 1);
  }

  _finish(task) {
    const handle = this._handles.get(task.id);
    if (handle && handle.abort) handle.abort();
    this._handles.delete(task.id);

    const idx = this.active.findIndex(t => t.id === task.id);
    if (idx !== -1) this.active.splice(idx, 1);

    if (task.status === 'done') this.done.push(task);
    else this.failed.push(task);

    this._notify(task);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task-finished', { id: task.id, status: task.status, savePath: task.savePath, error: task.error || '' });
    }
    this._flush();
  }

  _notify(task) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task-progress', {
        id: task.id, status: task.status, progress: task.progress,
        speed: task.speed, downloaded: task.downloaded,
        size: task.size, savePath: task.savePath, error: task.error
      });
    }
  }

  _find(id) {
    return this.active.find(t => t.id === id) || this.queue.find(t => t.id === id);
  }

  allTasks() {
    return [...this.active, ...this.queue, ...this.done.slice(-50), ...this.failed.slice(-20)];
  }
}

const dlManager = new DownloadManager();

// ── 搜索模块 ──────────────────────────────────────────────
async function searchMusic(keyword, page = 1) {
  const baseUrl = 'https://flac.music.hi.cn';
  const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(keyword)}&page=${page}`;

  return new Promise((resolve) => {
    const req = https.get(searchUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.headers['content-type']?.includes('application/json')) {
            resolve({ success: true, results: JSON.parse(data), source: 'api' });
          } else {
            const results = parseSearchResults(data, keyword);
            resolve({ success: true, results, source: 'html' });
          }
        } catch (e) {
          resolve({ success: false, error: e.message, results: getDemoResults(keyword) });
        }
      });
    });
    req.on('error', () => resolve({ success: true, results: getDemoResults(keyword), source: 'demo' }));
    req.on('timeout', () => { req.destroy(); resolve({ success: true, results: getDemoResults(keyword), source: 'demo' }); });
  });
}

function parseSearchResults(html, keyword) {
  const results = [];
  const itemRe = /<(?:li|tr|div)[^>]*class="[^"]*(?:song|track|item|music)[^"]*"[^>]*>([\s\S]*?)<\/(?:li|tr|div)>/gi;
  let m, i = 0;
  while ((m = itemRe.exec(html)) !== null && i < 20) {
    const block = m[1];
    const titleM  = /(?:title|data-title)="([^"]+)"/i.exec(block) || /<a[^>]*>([^<]{2,40})<\/a>/i.exec(block);
    const artistM = /(?:artist|singer)[^>]*>([^<]{2,30})<\//i.exec(block);
    if (titleM) {
      results.push(buildTrack({ title: titleM[1].trim(), artist: artistM?.[1]?.trim() || '未知艺人' }, i));
      i++;
    }
  }
  if (results.length === 0) return getDemoResults(keyword);
  return results;
}

function getDemoResults(keyword) {
  const songs = [
    { title: `${keyword} - 热门单曲`, artist: '周杰伦', album: '精选集', year: '2024', format: 'FLAC', quality: '24bit/96kHz', size: 38.2 },
    { title: `${keyword} (Live)`, artist: '邓紫棋', album: '演唱会', year: '2023', format: 'FLAC', quality: '16bit/44.1kHz', size: 29.1 },
    { title: `${keyword} Remix`, artist: '薛之谦', album: '单曲', year: '2024', format: 'MP3', quality: '320kbps', size: 12.4 },
    { title: `${keyword} 完整版`, artist: '陈奕迅', album: '精选', year: '2022', format: 'FLAC', quality: '24bit/192kHz', size: 72.6 },
    { title: `${keyword} 钢琴版`, artist: '钢琴君', album: '纯音乐', year: '2023', format: 'WAV', quality: '24bit/96kHz', size: 55.3 },
    { title: `${keyword} OST`, artist: '影视原声', album: '影视音乐', year: '2024', format: 'FLAC', quality: '16bit/44.1kHz', size: 33.7 },
    { title: `${keyword} 国语版`, artist: '五月天', album: '专辑', year: '2023', format: 'AAC', quality: '256kbps', size: 9.8 },
    { title: `${keyword} 经典老歌`, artist: '邓丽君', album: '经典', year: '1985', format: 'APE', quality: '无损', size: 44.1 },
    { title: `${keyword} 2024新版`, artist: '毛不易', album: 'EP', year: '2024', format: 'FLAC', quality: '24bit/96kHz', size: 41.2 },
    { title: `最美${keyword}`, artist: '林俊杰', album: '新歌', year: '2024', format: 'FLAC', quality: '24bit/96kHz', size: 36.8 },
  ];
  return songs.map((s, i) => buildTrack(s, i));
}

function buildTrack(s, i) {
  return {
    id: `track_${Date.now()}_${i}`,
    title: s.title || '未知歌曲', artist: s.artist || '未知艺人',
    album: s.album || '未知专辑', year: s.year || '',
    cover: s.cover || '', format: s.format || 'FLAC',
    quality: s.quality || '24bit/96kHz', size: s.size || 0,
    url: s.url || `demo://${i}`,
    duration: s.duration || `${3 + Math.floor(Math.random()*3)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}`
  };
}

// ── 创建主窗口 ─────────────────────────────────────────────
function createWindow() {
  const { width, height } = config.windowBounds || { width: 1160, height: 780 };

  mainWindow = new BrowserWindow({
    width:  Math.max(width, 900),
    height: Math.max(height, 640),
    minWidth: 900, minHeight: 640,
    title: 'FLAC Music',
    backgroundColor: '#0d0f14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('close', (e) => {
    if (dlManager.active.length > 0) {
      e.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('confirm-close', { activeTasks: dlManager.active.length });
      }
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [w, h] = mainWindow.getSize();
      config.windowBounds = { width: w, height: h };
      saveConfig(config);
    }
  });
}

// ── 菜单 ───────────────────────────────────────────────────
function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 FLAC Music' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    }] : []),
    {
      label: '文件',
      submenu: [
        { label: '打开下载目录', accelerator: 'CmdOrCtrl+O', click: () => shell.openPath(config.downloadDir) },
        { type: 'separator' },
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('nav', 'settings') },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit', label: '退出' }] : [])
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '下载',
      submenu: [
        { label: '全部暂停', accelerator: 'CmdOrCtrl+Shift+P', click: () => mainWindow?.webContents.send('dl-pause-all') },
        { label: '全部恢复', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.send('dl-resume-all') },
        { type: 'separator' },
        { label: '清空已完成', click: () => mainWindow?.webContents.send('dl-clear-done') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' }, { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' }, { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' }, { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '访问官网', click: () => shell.openExternal('https://flac.music.hi.cn/') },
        { label: '检查更新', click: () => mainWindow?.webContents.send('check-update') },
        ...(!isMac ? [{ type: 'separator' }, { role: 'about', label: '关于' }] : [])
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC 处理 ───────────────────────────────────────────────
function registerIPC() {
  ipcMain.handle('search', async (_, { keyword, page }) => await searchMusic(keyword, page));

  ipcMain.handle('download-add', (_, tracks) => {
    const tasks = dlManager.add(tracks);
    return { ok: true, tasks };
  });
  ipcMain.handle('download-pause',  (_, id) => { dlManager.pause(id); return { ok: true }; });
  ipcMain.handle('download-resume', (_, id) => { dlManager.resume(id); return { ok: true }; });
  ipcMain.handle('download-cancel', (_, id) => { dlManager.cancel(id); return { ok: true }; });
  ipcMain.handle('download-list',   () => dlManager.allTasks());

  const CONFIG_KEYS = {
    downloadDir: v => typeof v === 'string' && v.length > 0,
    maxConcurrent: v => Number.isInteger(v) && v >= 1 && v <= 8,
    defaultFormat: v => ['FLAC','WAV','MP3','AAC','APE','DSD'].includes(v),
    defaultQuality: v => typeof v === 'string' && v.length > 0 && v.length <= 32,
    autoWriteMetadata: v => typeof v === 'boolean',
    autoOrganize: v => typeof v === 'boolean',
  };

  ipcMain.handle('config-get', () => config);
  ipcMain.handle('config-set', (_, updates) => {
    if (!updates || typeof updates !== 'object') return { ok: false, error: 'Invalid updates' };
    for (const [key, val] of Object.entries(updates)) {
      if (!CONFIG_KEYS[key]) return { ok: false, error: `Unknown config key: ${key}` };
      if (!CONFIG_KEYS[key](val)) return { ok: false, error: `Invalid value for ${key}` };
    }
    config = { ...config, ...updates };
    dlManager.maxConcurrent = config.maxConcurrent;
    saveConfig(config);
    return { ok: true };
  });

  ipcMain.handle('choose-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择下载目录', defaultPath: config.downloadDir,
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('reveal-file', (_, filePath) => {
    const allowed = path.resolve(config.downloadDir);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(allowed + path.sep) && resolved !== allowed) {
      return { ok: false, error: 'Path not under download directory' };
    }
    shell.showItemInFolder(filePath);
    return { ok: true };
  });
  ipcMain.handle('open-dir', () => { shell.openPath(config.downloadDir); return { ok: true }; });

  ipcMain.handle('system-info', () => ({
    platform: process.platform, arch: process.arch,
    version: app.getVersion(), electron: process.versions.electron, node: process.versions.node
  }));

  ipcMain.handle('force-quit', () => { mainWindow?.destroy(); app.quit(); });

  ipcMain.handle('window-min', () => {
    mainWindow?.minimize();
    return { ok: true };
  });
  ipcMain.handle('window-max', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
    return { ok: true };
  });
  ipcMain.handle('open-external', (_, url) => {
    if (!url || typeof url !== 'string') return { ok: false, error: 'Invalid URL' };
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, error: 'Only http/https allowed' };
    shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('update-check', () => {
    // Placeholder: report current version as up-to-date
    return { ok: true, upToDate: true, version: app.getVersion() };
  });
}

// ── App 生命周期 ───────────────────────────────────────────
app.whenReady().then(() => {
  createMenu();
  createWindow();
  registerIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('before-quit', () => { saveConfig(config); });
