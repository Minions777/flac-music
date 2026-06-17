'use strict';

/**
 * 拖拽排序工具 (HTML5 Drag and Drop API)
 *
 * 用法:
 *   const sorter = new DragSorter(container, {
 *     itemSelector: '.task-card',
 *     handleSelector: '.task-drag-handle',  // 可选
 *     onReorder: (orderedIds) => { ... }
 *   });
 *   sorter.destroy();
 */

export class DragSorter {
  constructor(container, opts = {}) {
    if (!container) throw new Error('DragSorter: container is required');
    this.container = container;
    this.itemSelector = opts.itemSelector || '[draggable]';
    this.handleSelector = opts.handleSelector || null;
    this.onReorder = opts.onReorder || (() => {});
    this.placeholderClass = opts.placeholderClass || 'drag-placeholder';
    this.draggingClass = opts.draggingClass || 'dragging';

    this._dragged = null;
    this._placeholder = null;
    this._onDragStart = this._onDragStart.bind(this);
    this._onDragOver = this._onDragOver.bind(this);
    this._onDrop = this._onDrop.bind(this);
    this._onDragEnd = this._onDragEnd.bind(this);

    this.container.addEventListener('dragstart', this._onDragStart);
    this.container.addEventListener('dragover', this._onDragOver);
    this.container.addEventListener('drop', this._onDrop);
    this.container.addEventListener('dragend', this._onDragEnd);
  }

  _findItem(target) {
    if (this.handleSelector) {
      const handle = target.closest(this.handleSelector);
      if (!handle) return null;
      return handle.closest(this.itemSelector);
    }
    return target.closest(this.itemSelector);
  }

  _onDragStart(e) {
    const item = this._findItem(e.target);
    if (!item) return;
    this._dragged = item;
    item.classList.add(this.draggingClass);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', item.dataset.id || '');
      } catch (_) {}
    }
    // 拖拽时禁用 pointer-events, 避免 hover 抖动
    requestAnimationFrame(() => {
      if (this._dragged) this._dragged.style.opacity = '0.4';
    });
  }

  _onDragOver(e) {
    if (!this._dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const overItem = this._findItem(e.target);
    if (!overItem || overItem === this._dragged) return;

    const rect = overItem.getBoundingClientRect();
    const isAbove = e.clientY - rect.top < rect.height / 2;
    if (isAbove) {
      overItem.parentNode.insertBefore(this._dragged, overItem);
    } else {
      overItem.parentNode.insertBefore(this._dragged, overItem.nextSibling);
    }
  }

  _onDrop(e) {
    e.preventDefault();
    this._cleanup();
    // 通知回调: 返回当前 DOM 顺序的 id 列表
    const items = this.container.querySelectorAll(this.itemSelector);
    const orderedIds = Array.from(items)
      .map((el) => el.dataset.id)
      .filter(Boolean);
    this.onReorder(orderedIds);
  }

  _onDragEnd() {
    this._cleanup();
  }

  _cleanup() {
    if (this._dragged) {
      this._dragged.classList.remove(this.draggingClass);
      this._dragged.style.opacity = '';
      this._dragged = null;
    }
  }

  destroy() {
    this.container.removeEventListener('dragstart', this._onDragStart);
    this.container.removeEventListener('dragover', this._onDragOver);
    this.container.removeEventListener('drop', this._onDrop);
    this.container.removeEventListener('dragend', this._onDragEnd);
    this._cleanup();
  }
}

/** 按状态分组任务 */
export function groupByStatus(tasks) {
  const groups = { downloading: [], queued: [], paused: [], failed: [], done: [] };
  for (const t of tasks) {
    const status = t.status || 'queued';
    if (groups[status]) groups[status].push(t);
    else groups.queued.push(t);
  }
  return groups;
}
