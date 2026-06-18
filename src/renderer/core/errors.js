'use strict';

/**
 * 全局错误边界
 * - 同步异常 + Promise 异常  → Toast 提示
 * - 主进程通信断开         → 顶部红色横幅
 * - 启动期白屏             → 兜底 UI 提供「重载 / 重启」按钮
 *
 * 错误同时上报到主进程 telemetry (opt-in)
 */

import { showToast } from '../components/toast.js';
import { reportError } from './api.js';

function safeReport(payload) {
  try {
    reportError(payload.message, payload.stack, payload.context);
  } catch (_) {
    // 上报失败绝不影响主流程
  }
}

/** 启动期兜底 DOM: 插入"应急界面" — 防止 init 阶段崩溃导致白屏 */
function installFallbackDOM() {
  if (document.getElementById('flac-fallback')) return;

  const fallback = document.createElement('div');
  fallback.id = 'flac-fallback';
  fallback.setAttribute('role', 'alertdialog');
  fallback.setAttribute('aria-label', '启动失败提示');
  fallback.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:20px',
    'background:#0d0f14',
    'color:#f0f2f8',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'text-align:center',
    'padding:24px'
  ].join(';');

  fallback.innerHTML = `
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
         stroke="#ef4444" stroke-width="1.5" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    <div>
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">应用启动失败</h2>
      <p style="margin:0 0 16px;color:#9ca3b8;font-size:13px;line-height:1.6;">
        渲染进程在初始化阶段遇到问题。请尝试以下操作：<br>
        1) 点击"重载窗口"重新加载界面<br>
        2) 若反复失败, 点击"强制退出"并重启应用
      </p>
      <div id="flac-fallback-detail"
           style="margin:0 auto 16px;max-width:560px;padding:12px;
                  background:rgba(255,255,255,0.04);border-radius:8px;
                  font-size:11px;color:#9ca3b8;font-family:Menlo,Monaco,monospace;
                  text-align:left;max-height:120px;overflow:auto;display:none;
                  white-space:pre-wrap;word-break:break-all;"></div>
    </div>
    <div style="display:flex;gap:12px;">
      <button id="flac-fallback-reload"
              style="padding:10px 20px;background:#6c63ff;color:#fff;
                     border:none;border-radius:8px;cursor:pointer;font-size:13px;">
        重载窗口
      </button>
      <button id="flac-fallback-quit"
              style="padding:10px 20px;background:transparent;color:#f0f2f8;
                     border:1px solid rgba(255,255,255,0.14);border-radius:8px;
                     cursor:pointer;font-size:13px;">
        强制退出
      </button>
    </div>
  `;

  document.body
    ? document.body.appendChild(fallback)
    : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(fallback), {
        once: true
      });

  // 绑定按钮
  document.getElementById('flac-fallback-reload')?.addEventListener('click', () => {
    window.location.reload();
  });
  document.getElementById('flac-fallback-quit')?.addEventListener('click', () => {
    window.flacMusic?.forceQuit?.();
  });
}

/** 暴露兜底 UI 显示入口 (供 init 失败/uncaught 异常调用) */
export function showFallbackUI(detail) {
  installFallbackDOM();
  const detailEl = document.getElementById('flac-fallback-detail');
  if (detailEl && detail) {
    detailEl.style.display = 'block';
    detailEl.textContent = detail;
  }
}

export function setupGlobalErrorHandler() {
  // ── 启动超时守护: 5 秒未进入 init 完成态, 主动显示兜底 ──
  let initFinished = false;
  window.addEventListener(
    'flac:init-done',
    () => {
      initFinished = true;
    },
    { once: true }
  );
  setTimeout(() => {
    if (!initFinished) {
      showFallbackUI('应用启动超时 (>5s)\n可能是主进程通信阻塞或脚本错误。');
      safeReport({
        message: 'App init timeout',
        stack: 'setupGlobalErrorHandler() → 5s timeout',
        context: { source: 'init-timeout' }
      });
    }
  }, 5000);

  // ── 未处理的 Promise 拒绝 ──
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    console.error('[Unhandled Rejection]', err);
    showToast('发生未处理异常, 请查看日志', 'error', 4000);
    safeReport({
      message: err.message,
      stack: err.stack || '',
      context: { source: 'unhandledrejection' }
    });
    // init 阶段连续异常 → 兜底
    if (!initFinished && event.reason?.isFatal) showFallbackUI(err.stack || err.message);
  });

  // ── 同步错误 (未捕获 throw) ──
  window.addEventListener('error', (event) => {
    const err = event.error || new Error(event.message || 'Unknown error');
    console.error('[Error]', err);
    showToast('发生错误, 请查看日志', 'error', 4000);
    safeReport({
      message: err.message,
      stack: err.stack || '',
      context: { source: 'window.error', filename: event.filename, lineno: event.lineno }
    });
    event.preventDefault();
    // init 阶段致命错误 → 兜底
    if (
      !initFinished &&
      (event.filename?.includes('app.js') || event.filename?.includes('core/'))
    ) {
      showFallbackUI(err.stack || err.message);
    }
  });
}

/** 与主进程通信失败时显示顶部红色横幅 */
export function showConnectionError() {
  if (document.getElementById('conn-error-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'conn-error-banner';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'assertive');
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 20px;' +
    'background:#d93025;color:#fff;font-size:13px;text-align:center;' +
    'box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  banner.textContent = '⚠ 与主进程通信断开 — 部分功能可能不可用, 请重启应用';
  document.body.prepend(banner);
}
