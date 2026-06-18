'use strict';

/**
 * DownloadManager - 下载任务队列管理器
 *
 * 核心能力:
 * - 任务排队 + 并发控制 (maxConcurrent)
 * - 断点续传 (Range 头)
 * - 文件魔数校验 (防止下载到错误格式)
 * - 指数退避自动重试
 * - 暂停超时自动取消 (5 分钟)
 * - demo:// 协议模拟下载
 *
 * 设计原则:
 * - 副作用通过构造函数注入: fs / https / logger / notify / configGetter
 *   → 业务逻辑可被单测, 不依赖真实 IO 与 Electron 全局对象
 * - 任务状态机: queued → downloading → (done | failed | paused)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { MAGIC_BYTES, DOWNLOAD } = require('./constants');

/**
 * @param {Object} deps
 * @param {Object} [deps.fs] - 文件系统 (默认 require('fs'), 用于测试桩)
 * @param {Object} [deps.https] - https 客户端 (默认 require('https'), 用于测试桩)
 * @param {Object} [deps.logger] - 日志对象 { info, warn, error }
 * @param {(task: object) => void} [deps.notify] - 任务进度变化时的回调 (UI 推送)
 * @param {() => object} [deps.getConfig] - 读取当前配置 (用于自动归类路径)
 * @param {number} [deps.maxConcurrent]
 */
class DownloadManager {
  constructor(deps = {}) {
    this.fs = deps.fs || fs;
    this.https = deps.https || https;
    this.log = deps.logger || console;
    this.notify = deps.notify || (() => {});
    this.getConfig = deps.getConfig || (() => ({}));
    this.maxConcurrent = deps.maxConcurrent || this.getConfig().maxConcurrent || 3;

    this.queue = [];
    this.active = [];
    this.done = [];
    this.failed = [];
    this.idCtr = 1;
    this._handles = new Map();
    this._pauseTimers = new Map();
  }

  /** 添加新任务, 返回新创建的任务对象数组 (供 UI 即时显示) */
  add(tracks) {
    const config = this.getConfig();
    const newTasks = tracks.map((t) => ({
      id: this.idCtr++,
      title: t.title || '未知歌曲',
      artist: t.artist || '未知艺人',
      album: t.album || '未知专辑',
      year: t.year || '',
      cover: t.cover || '',
      format: t.format || config.defaultFormat || 'FLAC',
      quality: t.quality || config.defaultQuality || '24bit/96kHz',
      url: t.url || '',
      size: t.size || 0,
      status: 'queued',
      progress: 0,
      speed: 0,
      downloaded: 0,
      savePath: '',
      error: '',
      retries: 0
    }));
    this.queue.push(...newTasks);
    this.flush();
    return newTasks;
  }

  /** 把队列任务启动到 active 列表, 直到达到并发上限 */
  flush() {
    while (this.active.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.active.push(task);
      this._download(task);
    }
  }

  /** 计算下载保存路径, 必要时建目录 (含 artist/album 自动归类) */
  ensureSavePath(task) {
    if (task.savePath) return;
    const config = this.getConfig();
    const safeTitle = sanitize(task.title);
    const safeArtist = sanitize(task.artist);
    const safeAlbum = sanitize(task.album);
    let dir = config.downloadDir;
    if (config.autoOrganize) {
      dir = path.join(dir, safeArtist, safeAlbum);
    }
    this.fs.mkdirSync(dir, { recursive: true });
    const ext = task.format.toLowerCase();
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin';
    task.savePath = path.join(dir, `${safeTitle}.${safeExt}`);
  }

  /** 续传支持: 读取 .part 文件的已有大小 */
  getPartSize(task) {
    const tmpPath = task.savePath + '.part';
    try {
      if (this.fs.existsSync(tmpPath)) return this.fs.statSync(tmpPath).size;
    } catch (_) {}
    return 0;
  }

  // ── 任务控制 API ─────────────────────────────────────────

  pause(id) {
    const task = this._find(id);
    if (!task || task.status !== 'downloading') return;
    task.status = 'paused';
    const handle = this._handles.get(id);
    if (handle) {
      handle.paused = true;
      handle.abort();
    }
    this._notify(task);
    this.log.info(`[Download] 已暂停: ${task.title} (${id})`);

    // 暂停超时: 5 分钟后自动取消
    const timer = setTimeout(() => {
      const t = this._find(id);
      if (t && t.status === 'paused') {
        this.log.warn(`[Download] 暂停超时自动取消: ${task.title} (${id})`);
        this.cancel(id);
        this.notify({ ...task, status: 'failed', error: '暂停超时自动取消' });
      }
    }, DOWNLOAD.PAUSE_TIMEOUT_MS);
    this._pauseTimers.set(`pause_${id}`, timer);
  }

  resume(id) {
    const task = this._find(id);
    if (!task || task.status !== 'paused') return;
    const pauseTimer = this._pauseTimers.get(`pause_${id}`);
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      this._pauseTimers.delete(`pause_${id}`);
    }
    task.status = 'downloading';
    task.speed = 0;
    this._notify(task);
    this.log.info(`[Download] 恢复下载: ${task.title} (${id})`);
    // 从 active 移除后重新下载 (支持断点续传)
    this.active = this.active.filter((t) => t.id !== id);
    this.active.push(task);
    this._download(task);
  }

  cancel(id) {
    const handle = this._handles.get(id);
    if (handle && handle.abort) handle.abort();
    this._handles.delete(id);

    this._clearTimer(`pause_${id}`);
    this._clearTimer(id); // 重试 timer

    const task = this._find(id);
    if (task && task.savePath) {
      try {
        this.fs.unlink(task.savePath + '.part', () => {});
      } catch (_) {}
    }

    const inActive = this.active.findIndex((t) => t.id === id);
    if (inActive !== -1) {
      this.active.splice(inActive, 1);
      this.flush();
    }
    const inQueue = this.queue.findIndex((t) => t.id === id);
    if (inQueue !== -1) this.queue.splice(inQueue, 1);

    this.log.info(`[Download] 已取消: ${task ? task.title : id} (${id})`);
  }

  /** 渲染进程拉取当前所有任务 (active+queue+最近 done+最近 failed) */
  allTasks() {
    return [...this.active, ...this.queue, ...this.done.slice(-50), ...this.failed.slice(-20)];
  }

  /** 进程退出前同步等待中的 IO (尽力而为) */
  shutdown() {
    for (const handle of this._handles.values()) {
      if (handle && handle.abort) handle.abort();
    }
    for (const timer of this._pauseTimers.values()) {
      clearTimeout(timer);
    }
    this._handles.clear();
    this._pauseTimers.clear();
  }

  // ── 内部实现 ─────────────────────────────────────────────

  _download(task) {
    task.status = 'downloading';
    this.ensureSavePath(task);
    this._notify(task);
    this.log.info(`[Download] 开始下载: ${task.title} (${task.id})`);

    if (!task.url || task.url.startsWith(DOWNLOAD.DEMO_PROTOCOL)) {
      this._simulateDownload(task);
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(task.url);
    } catch (e) {
      task.status = 'failed';
      task.error = 'Invalid URL';
      this._finish(task);
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      task.status = 'failed';
      task.error = 'Only HTTPS URLs are supported';
      this.log.error(`[Download] 非 HTTPS URL: ${task.url}`);
      this._finish(task);
      return;
    }

    const tmpPath = task.savePath + '.part';
    let existingSize = this.getPartSize(task);

    const options = {
      timeout: DOWNLOAD.REQUEST_TIMEOUT_MS,
      headers: { 'User-Agent': 'FLAC-Music/2.4.1' }
    };
    if (existingSize > 0) {
      options.headers.Range = `bytes=${existingSize}-`;
      this.log.info(`[Download] 断点续传: ${task.title}, 已有 ${existingSize} 字节`);
    }

    const req = this.https.get(task.url, options, (res) => {
      let total = 0;
      if (res.statusCode === 206) {
        const contentRange = res.headers['content-range'];
        if (contentRange) {
          const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
          if (match) {
            // match[1] 是已下载字节, 仅用于记录, 无需 startByte 变量
            total = parseInt(match[3], 10);
          }
        }
        task.size = total;
      } else if (res.statusCode === 200) {
        total = parseInt(res.headers['content-length'] || '0', 10);
        task.size = total;
        task.downloaded = 0;
        existingSize = 0;
      } else {
        task.status = 'failed';
        task.error = `HTTP ${res.statusCode}`;
        this.log.error(`[Download] HTTP 错误 ${res.statusCode}: ${task.title}`);
        this._finish(task);
        return;
      }

      let received = existingSize;
      const startTime = Date.now();
      const file = this.fs.createWriteStream(tmpPath, existingSize > 0 ? { flags: 'a' } : {});

      let paused = false;
      res.on('data', (chunk) => {
        if (paused) return;
        received += chunk.length;
        task.downloaded = received;
        task.progress = total > 0 ? Math.round((received / total) * 100) : 0;
        const elapsed = (Date.now() - startTime) / 1000;
        task.speed = elapsed > 0 ? Math.round((received - existingSize) / elapsed) : 0;
        this._notify(task);
      });
      res.pipe(file);

      file.on('finish', () => {
        if (received === total || total === 0) {
          if (!verifyMagic(tmpPath, task.format)) {
            try {
              this.fs.unlink(tmpPath, () => {});
            } catch (_) {}
            task.status = 'failed';
            task.error = '文件格式校验失败';
            this.log.error(`[Download] 格式校验失败: ${task.title}`);
            this._finish(task);
            return;
          }
          this.fs.rename(tmpPath, task.savePath, (err) => {
            if (err) {
              try {
                this.fs.unlink(tmpPath, () => {});
              } catch (_) {}
              task.status = 'failed';
              task.error = err.message;
              this.log.error(`[Download] 重命名失败: ${task.title} - ${err.message}`);
            } else {
              this.log.info(`[Download] 完成: ${task.title} -> ${task.savePath}`);
            }
            this._finish(task);
          });
        } else {
          task.downloaded = received;
          this.log.info(`[Download] 部分下载: ${task.title} (${received}/${total})`);
          this._notify(task);
        }
      });
      file.on('error', (err) => {
        this.log.error(`[Download] 文件写入错误: ${task.title} - ${err.message}`);
        task.status = 'failed';
        task.error = err.message;
        this._finish(task);
      });

      this._handles.set(task.id, {
        req,
        res,
        file,
        paused: false,
        abort: () => {
          paused = true;
          req.destroy();
          file.destroy();
        }
      });
    });

    req.on('error', (err) => {
      this.log.error(`[Download] 请求错误: ${task.title} - ${err.message}`);
      this._handleRetryOrFail(task, err.message);
    });
    req.on('timeout', () => {
      this.log.error(`[Download] 连接超时: ${task.title}`);
      req.destroy();
      this._handleRetryOrFail(task, '连接超时');
    });
  }

  _handleRetryOrFail(task, errorMsg) {
    const isDemo = task.url && task.url.startsWith(DOWNLOAD.DEMO_PROTOCOL);
    if (task.retries < DOWNLOAD.MAX_RETRIES && !isDemo) {
      task.retries++;
      const delay =
        DOWNLOAD.RETRY_DELAYS_MS[Math.min(task.retries - 1, DOWNLOAD.RETRY_DELAYS_MS.length - 1)];
      this.log.info(
        `[Download] 自动重试 ${task.retries}/${DOWNLOAD.MAX_RETRIES}: ${task.title}, ${delay}ms 后重试`
      );
      task.status = 'queued';
      task.error = `第 ${task.retries} 次重试中...`;
      this._notify(task);

      const idx = this.active.findIndex((t) => t.id === task.id);
      if (idx !== -1) this.active.splice(idx, 1);

      this._pauseTimers.set(
        task.id,
        setTimeout(() => {
          this._pauseTimers.delete(task.id);
          task.error = '';
          task.progress = 0;
          task.downloaded = 0;
          task.speed = 0;
          this.queue.push(task);
          this.flush();
        }, delay)
      );
    } else {
      task.status = 'failed';
      task.error = errorMsg;
      this._finish(task);
    }
  }

  _simulateDownload(task) {
    const totalSize = Math.round((20 + Math.random() * 50) * 1024 * 1024);
    task.size = totalSize;
    let progress = 0;
    const speed = Math.round((3 + Math.random() * 6) * 1024 * 1024);

    const tick = setInterval(() => {
      if (task.status === 'paused') return;
      if (task.status === 'failed' || task.status === 'done') {
        clearInterval(tick);
        return;
      }
      const inc = Math.round(speed * 0.4 * (0.8 + Math.random() * 0.4));
      progress = Math.min(progress + inc, totalSize);
      task.downloaded = progress;
      task.progress = Math.round((progress / totalSize) * 100);
      task.speed = Math.round(speed * (0.85 + Math.random() * 0.3));
      this._notify(task);

      if (task.progress >= 100) {
        clearInterval(tick);
        task.status = 'done';
        task.progress = 100;
        this.log.info(`[Download] 演示下载完成: ${task.title}`);
        this._finish(task);
      }
    }, 400);

    this._handles.set(task.id, {
      req: null,
      file: null,
      abort: () => clearInterval(tick)
    });
  }

  _finish(task) {
    const handle = this._handles.get(task.id);
    if (handle && handle.abort) handle.abort();
    this._handles.delete(task.id);

    this.active = this.active.filter((t) => t.id !== task.id);

    if (task.status === 'done') this.done.push(task);
    else this.failed.push(task);

    this._notify(task);
    this.flush();
  }

  _notify(task) {
    this.notify({
      id: task.id,
      status: task.status,
      progress: task.progress,
      speed: task.speed,
      downloaded: task.downloaded,
      size: task.size,
      savePath: task.savePath,
      error: task.error
    });
  }

  _find(id) {
    return this.active.find((t) => t.id === id) || this.queue.find((t) => t.id === id);
  }

  _clearTimer(key) {
    const timer = this._pauseTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this._pauseTimers.delete(key);
    }
  }
}

/* eslint-disable no-control-regex */
/** 去除文件名非法字符 (含控制字符, 跨平台都需要) */
function sanitize(s) {
  return String(s || '')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/[\x00-\x1f]/g, '');
}
/* eslint-enable no-control-regex */

/** 校验文件头 N 字节是否匹配指定格式的魔数 */
function verifyMagic(filePath, format) {
  const sig = MAGIC_BYTES[String(format).toLowerCase()];
  if (!sig) return true; // 未知格式不校验
  try {
    const buf = Buffer.alloc(sig.length);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, sig.length, 0);
    fs.closeSync(fd);
    return sig.every((b, i) => buf[i] === b);
  } catch (_) {
    return false;
  }
}

module.exports = { DownloadManager, sanitize, verifyMagic };
