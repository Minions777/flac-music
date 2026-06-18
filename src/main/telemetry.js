'use strict';

/**
 * 轻量级 telemetry / 错误上报
 *
 * 设计原则:
 * 1. 零外部依赖, 自实现 HTTP POST
 * 2. 默认禁用, opt-in 配置: telemetry.enabled = true
 * 3. 自动脱敏: 文件路径只保留尾段, 不上报完整用户目录
 * 4. 队列+批量: 错误累积到 N 条或 N 秒后批量发送
 * 5. 网络失败不影响主流程 (catch 吞掉)
 *
 * 替代品: 若团队需要 Sentry, 把 send() 实现替换为 Sentry SDK 调用即可
 */

const https = require('https');
const { URL } = require('url');
const os = require('os');
const log = require('./logger');

let config = {
  enabled: false,
  endpoint: 'https://telemetry.example.com/ingest',
  appVersion: 'unknown',
  flushIntervalMs: 30000,
  maxQueueSize: 50
};

const queue = [];
let timer = null;

/**
 * 初始化
 * @param {object} opts
 * @param {boolean} [opts.enabled=false]
 * @param {string} [opts.endpoint]
 * @param {string} [opts.appVersion]
 */
function init(opts = {}) {
  config = { ...config, ...opts };
  if (!config.enabled) {
    log.info('[telemetry] 未启用, 所有事件将被丢弃');
    return;
  }
  scheduleFlush();
  installGlobalHandlers();
  log.info(`[telemetry] 启用, endpoint=${config.endpoint}`);
}

/** 捕获异常 (主进程用) */
function captureError(err, context = {}) {
  if (!err) return;
  push({
    type: 'error',
    timestamp: Date.now(),
    message: String(err.message || err),
    stack: err.stack ? sanitize(err.stack) : '',
    context: sanitizeContext(context)
  });
}

/** 捕获消息 (信息事件) */
function captureMessage(msg, level = 'info', context = {}) {
  push({
    type: 'message',
    level,
    timestamp: Date.now(),
    message: String(msg),
    context: sanitizeContext(context)
  });
}

function push(event) {
  if (!config.enabled) return;
  queue.push(event);
  if (queue.length >= config.maxQueueSize) flush();
}

function scheduleFlush() {
  if (timer) return;
  timer = setInterval(() => flush(), config.flushIntervalMs);
  if (timer.unref) timer.unref(); // 不阻止进程退出
}

async function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  const payload = JSON.stringify({
    app: 'flac-music',
    version: config.appVersion,
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    events: batch
  });
  try {
    const u = new URL(config.endpoint);
    await postJSON(u, payload);
    log.debug(`[telemetry] 已发送 ${batch.length} 条事件`);
  } catch (err) {
    log.warn(`[telemetry] 发送失败 (${err.message}), ${batch.length} 条事件已丢弃`);
  }
}

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 5000
    };
    const req = https.request(opts, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(body);
    req.end();
  });
}

/* ── 脱敏 ──────────────────────────────────────────────── */

const HOME = os.homedir();

function sanitize(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(new RegExp(escapeRegExp(HOME), 'g'), '~')
    .replace(/[A-Z]:\\Users\\[^\\]+/gi, '~');
}

function sanitizeContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string') out[k] = sanitize(v);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── 全局未捕获异常 ──────────────────────────────────────── */

function installGlobalHandlers() {
  process.on('uncaughtException', (err) => {
    captureError(err, { source: 'uncaughtException' });
    flush();
  });
  process.on('unhandledRejection', (reason) => {
    captureError(reason instanceof Error ? reason : new Error(String(reason)), {
      source: 'unhandledRejection'
    });
    flush();
  });
}

module.exports = { init, captureError, captureMessage, flush };
