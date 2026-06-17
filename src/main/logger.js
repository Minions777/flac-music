'use strict';

/**
 * 文件日志 + 控制台双写 (带轮转)
 *
 * 用法: log.info('下载完成: xxx')
 *
 * 设计要点:
 * - 单行格式化, 方便 grep
 * - 日志体积超过 MAX_LOG_SIZE 时, 触发轮转:
 *   app.log.9 → 删除
 *   app.log.8 → app.log.9
 *   ...
 *   app.log   → app.log.1
 * - 写文件失败不抛异常, 保证日志不影响主流程
 * - 异步写入 (不阻塞主流程)
 */

const fs = require('fs');
const { getLogPath, MAX_LOG_SIZE } = require('./constants');

const MAX_ARCHIVES = 10; // 保留 10 个归档 (app.log.1 ... app.log.10)

/**
 * 轮转日志:
 * - 删除最老的归档 (.10)
 * - 将所有归档编号 +1 (.1 → .2, .2 → .3, ...)
 * - 当前日志 → app.log.1
 */
function rotate() {
  const logPath = getLogPath();
  try {
    // 1) 先删除最老的归档
    const oldest = `${logPath}.${MAX_ARCHIVES}`;
    if (fs.existsSync(oldest)) {
      try {
        fs.unlinkSync(oldest);
      } catch (_) {}
    }
    // 2) 倒序: .N → .N+1 (从大到小, 避免覆盖)
    for (let i = MAX_ARCHIVES - 1; i >= 1; i -= 1) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      if (fs.existsSync(src)) {
        try {
          fs.renameSync(src, dst);
        } catch (_) {}
      }
    }
    // 3) 把当前 log → .1
    if (fs.existsSync(logPath)) {
      try {
        fs.renameSync(logPath, `${logPath}.1`);
      } catch (_) {}
    }
  } catch (_) {
    // 轮转失败不抛
  }
}

let _writeQueue = Promise.resolve();
let _pendingBytes = 0;
const FLUSH_THRESHOLD = 64 * 1024; // 64KB 或 200ms 触发一次 flush

/**
 * 异步写入: 串行化写队列, 避免并发 IO
 * 每条 log 排队, 上一次完成后再写
 */
function write(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}\n`;
  // 控制台立即输出
  const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[consoleMethod](`[${level}] ${msg}`);

  _pendingBytes += Buffer.byteLength(line, 'utf8');
  _writeQueue = _writeQueue.then(async () => {
    try {
      const logPath = getLogPath();
      // 检查是否需要轮转
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_SIZE) {
        rotate();
      }
      await fs.promises.appendFile(logPath, line, 'utf8');
    } catch (_) {
      // 写失败不抛, 业务优先
    }
  });

  // 大量日志堆积时, 强制 flush
  if (_pendingBytes > FLUSH_THRESHOLD) {
    _pendingBytes = 0;
    return _writeQueue; // 调用方可 await
  }
}

/** 等待所有待写入日志落盘 (用于退出时) */
async function flush() {
  await _writeQueue;
  _pendingBytes = 0;
}

/**
 * 同步紧急写入: 用于 app 退出前 last-resort 抢救
 * (不依赖轮转, 直接追加)
 */
function writeSync(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}\n`;
  const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[consoleMethod](`[${level}] ${msg}`);
  try {
    fs.appendFileSync(getLogPath(), line, 'utf8');
  } catch (_) {}
}

module.exports = {
  info: (msg) => write('INFO', msg),
  warn: (msg) => write('WARN', msg),
  error: (msg) => write('ERROR', msg),
  flush,
  writeSync,
  rotate
};
