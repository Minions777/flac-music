'use strict';

/**
 * CSP 违规报告接收端
 *
 * 渲染进程通过 fetch('csp-report', ...) 上报违规, 主进程 session 拦截
 * 写入本地日志, 便于安全审计
 *
 * 注: 浏览器不会跨页面跳转执行 report-uri, 我们用 session.webRequest
 *     拦截 /csp-report 的 POST 请求, 取出 body 写入日志
 */

const log = require('./logger');

/**
 * 注册 CSP 报告接收器
 * @param {Electron.Session} session - app defaultSession
 */
function attach(session) {
  if (!session) return;
  // 拦截 csp-report 路径的 POST
  try {
    session.webRequest.onBeforeRequest(
      { urls: ['http://*/csp-report', 'https://*/csp-report', 'file://*/csp-report'] },
      (details, callback) => {
        try {
          // details.uploadData 包含请求 body
          const data = extractBody(details);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              const violation = parsed['csp-report'] || parsed;
              log.warn(
                `[CSP-VIOLATION] ${violation['violated-directive'] || '?'} ` +
                  `blocked: ${violation['blocked-uri'] || '?'} ` +
                  `at ${violation['source-file'] || '?'}:${violation['line-number'] || '?'}`
              );
            } catch (_) {
              // 非 JSON 格式, 原始记录
              log.warn('[CSP-VIOLATION] (raw) ' + data.slice(0, 200));
            }
          }
        } catch (err) {
          log.error('[CSP] 解析报告失败: ' + err.message);
        }
        // 不阻断, 返回空响应 (CSP report-only 模式)
        callback({ cancel: false });
      }
    );
  } catch (err) {
    // 部分 Electron 版本 API 路径不同, 静默
    log.warn('[CSP] 报告接收注册失败: ' + err.message);
  }
}

function extractBody(details) {
  if (!details.uploadData || details.uploadData.length === 0) return null;
  const part = details.uploadData[0];
  if (typeof part.bytes !== 'undefined') {
    return Buffer.from(part.bytes).toString('utf8');
  }
  if (typeof part.string === 'string') return part.string;
  return null;
}

module.exports = { attach };
