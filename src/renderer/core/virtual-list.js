'use strict';

/**
 * 虚拟列表 (Virtual Scroller)
 *
 * 性能原理:
 * - 固定 DOM 节点数 (viewport + overscan)
 * - 滚动时只变换 translateY, 不创建/销毁元素
 * - 10000+ 项依旧 60fps
 *
 * 重要约定:
 * - renderItem(el, item, index)  复用传入的 el, 原地更新其内容
 *   返回 el (链式) 或新 el (会替换)
 * - 不返回新节点时, 复用池, 不触发 DOM 重建
 *
 * 用法:
 *   const list = new VirtualList({
 *     container: domNode,
 *     itemHeight: 80,
 *     overscan: 5,
 *     updateItem: (el, item, index) => { el.textContent = item.name; }
 *   });
 *   list.setItems([...]);
 *   list.destroy();
 */

const DEFAULT_OVERSCAN = 5;

export class VirtualList {
  constructor({ container, itemHeight, overscan = DEFAULT_OVERSCAN, updateItem }) {
    if (!container) throw new Error('VirtualList: container is required');
    if (typeof itemHeight !== 'number' || itemHeight <= 0) {
      throw new Error('VirtualList: itemHeight must be positive number');
    }
    if (typeof updateItem !== 'function') {
      throw new Error('VirtualList: updateItem must be function');
    }

    this.container = container;
    this.itemHeight = itemHeight;
    this.overscan = overscan;
    this.updateItem = updateItem;

    this.items = [];
    this.pool = []; // 复用的 DOM 节点池
    this._lastRange = { start: -1, end: -1 };

    // ── 容器结构: scrollWrap (滚动) > spacer (撑高) > viewport (固定高度, 容纳池子) ──
    this.scrollWrap = document.createElement('div');
    this.scrollWrap.className = 'vl-scroll-wrap';
    Object.assign(this.scrollWrap.style, {
      position: 'relative',
      overflowY: 'auto',
      overflowX: 'hidden',
      height: '100%',
      width: '100%',
      WebkitOverflowScrolling: 'touch'
    });

    this.spacer = document.createElement('div');
    Object.assign(this.spacer.style, {
      position: 'relative',
      width: '100%',
      height: '0px',
      pointerEvents: 'none'
    });

    this.viewport = document.createElement('div');
    Object.assign(this.viewport.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      willChange: 'transform'
    });

    this.scrollWrap.appendChild(this.spacer);
    this.scrollWrap.appendChild(this.viewport);

    // 替换原内容
    container.innerHTML = '';
    container.appendChild(this.scrollWrap);

    // 滚动节流 (rAF)
    let rafId = null;
    this.scrollWrap.addEventListener('scroll', () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        this._render();
      });
    });
  }

  setItems(items) {
    this.items = Array.isArray(items) ? items : [];
    this.spacer.style.height = this.items.length * this.itemHeight + 'px';
    this.scrollWrap.scrollTop = 0;
    this._lastRange = { start: -1, end: -1 };
    this._render();
  }

  /** 强制全量刷新 (数据项内容变化, 比如下载进度更新) */
  refresh() {
    this._lastRange = { start: -1, end: -1 };
    this._render();
  }

  _render() {
    const wrap = this.scrollWrap;
    const scrollTop = wrap.scrollTop;
    const viewH = wrap.clientHeight;
    const startIdx = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const endIdx = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewH) / this.itemHeight) + this.overscan
    );

    // 池子尺寸自适应
    const need = Math.max(0, endIdx - startIdx);
    while (this.pool.length < need) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        height: this.itemHeight + 'px',
        contain: 'layout style'
      });
      this.viewport.appendChild(el);
      this.pool.push(el);
    }
    if (this.pool.length > need && this.pool.length > need * 2) {
      const toRemove = this.pool.splice(need);
      toRemove.forEach((el) => el.remove());
    }

    // 同一 range: 只更新数据, 不动 transform
    if (this._lastRange.start === startIdx && this._lastRange.end === endIdx) {
      for (let i = 0; i < need; i += 1) {
        this.updateItem(this.pool[i], this.items[startIdx + i], startIdx + i);
      }
      return;
    }

    // 新 range: 更新数据 + transform
    for (let i = 0; i < need; i += 1) {
      const itemIdx = startIdx + i;
      const el = this.pool[i];
      el.style.transform = `translateY(${itemIdx * this.itemHeight}px)`;
      el.dataset.index = String(itemIdx);
      this.updateItem(el, this.items[itemIdx], itemIdx);
    }
    this._lastRange = { start: startIdx, end: endIdx };
  }

  scrollToIndex(idx) {
    this.scrollWrap.scrollTop = idx * this.itemHeight;
  }

  destroy() {
    this.pool.forEach((el) => el.remove());
    this.pool = [];
    this.items = [];
    this.container.innerHTML = '';
  }
}
