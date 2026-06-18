'use strict';

/**
 * 错误边界 (renderer/core/errors.js) 单元测试
 * 重点验证: API 契约正确 + 不抛错
 *
 * 注: DOM 行为靠浏览器/集成测试验证; 单元测试聚焦于
 *      - 函数签名稳定
 *      - 不抛错 (即使在缺少真实 DOM 时)
 *      - 注册了正确的全局监听器
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── DOM 桩 (最小化, 只跟踪事件) ────────────────────────
const listeners = {};
const bodyChildren = [];

function resetStubs() {
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  bodyChildren.length = 0;
}

global.window = {
  addEventListener: (ev, fn, opts) => {
    if (opts && opts.once) listeners[ev] = (listeners[ev] || []).concat([fn]);
    else listeners[ev] = (listeners[ev] || []).concat([fn]);
  },
  removeEventListener: (ev, fn) => {
    if (listeners[ev]) listeners[ev] = listeners[ev].filter((f) => f !== fn);
  },
  dispatchEvent: (ev) => { (listeners[ev.type] || []).slice().forEach((fn) => fn(ev)); },
  location: { reload: () => {} },
  flacMusic: { forceQuit: () => {} }
};

let idCounter = 0;
function makeElement() {
  const el = {
    id: '',
    style: { set cssText(v) { this._cssText = v; }, get cssText() { return this._cssText || ''; } },
    dataset: {},
    _listeners: {},
    _textContent: '',
    set textContent(v) { this._textContent = v; },
    get textContent() { return this._textContent; },
    setAttribute(k, v) { this[k] = v; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); }
  };
  return el;
}

global.document = {
  body: { appendChild: (c) => bodyChildren.push(c), prepend: (c) => bodyChildren.unshift(c) },
  getElementById: (id) => bodyChildren.find((c) => c.id === id) || null,
  createElement: () => {
    idCounter += 1;
    return makeElement();
  }
};

global.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; Object.assign(this, init || {}); }
};

// 加载被测模块 (异步)
const errorsPromise = import('../../src/renderer/core/errors.js');

describe('errors.js API', () => {
  test('模块导出必要函数', async () => {
    const m = await errorsPromise;
    assert.equal(typeof m.setupGlobalErrorHandler, 'function');
    assert.equal(typeof m.showConnectionError, 'function');
    assert.equal(typeof m.showFallbackUI, 'function');
  });

  test('setupGlobalErrorHandler 不抛错且注册 error/unhandledrejection 监听', async () => {
    resetStubs();
    const m = await errorsPromise;
    assert.doesNotThrow(() => m.setupGlobalErrorHandler());
    assert.ok(listeners.error, '应注册 error 监听器');
    assert.ok(listeners.unhandledrejection, '应注册 unhandledrejection 监听器');
  });

  test('showConnectionError 不抛错', async () => {
    resetStubs();
    const m = await errorsPromise;
    assert.doesNotThrow(() => m.showConnectionError());
  });

  test('showFallbackUI 不抛错', async () => {
    resetStubs();
    const m = await errorsPromise;
    assert.doesNotThrow(() => m.showFallbackUI('test detail'));
  });

  test('setupGlobalErrorHandler 多次调用安全', async () => {
    resetStubs();
    const m = await errorsPromise;
    m.setupGlobalErrorHandler();
    m.setupGlobalErrorHandler();
    // 监听器应累加
    assert.ok(listeners.error.length >= 1);
    assert.ok(listeners.unhandledrejection.length >= 1);
  });
});
