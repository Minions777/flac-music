'use strict';

/**
 * 搜索页 - 搜索框 + 快捷标签 + 结果表格 + 批量下载
 *
 * 性能要点:
 * - 增量渲染: 当结果集 ID 未变时, 只切换选中态 class, 不重建 DOM
 * - 全量重建只在搜索结果变化时触发
 */

import { $, $$, esc } from '../core/dom.js';
import { search as apiSearch, downloadAdd } from '../core/api.js';
import { state, tasksStore } from '../core/state.js';
import { safeFormat } from '../core/format.js';
import { showToast } from '../components/toast.js';
import { debounce, addHistory, getHistory } from '../core/search-history.js';

export function setupSearch() {
  const input = $('search-input');
  const btn = $('search-btn');
  const clear = $('search-clear');

  // 防抖搜索: 输入停止 200ms 后才真正发请求
  const debouncedSearch = debounce(() => doSearch(), 200);

  input?.addEventListener('input', () => {
    clear.style.display = input.value ? 'flex' : 'none';
    debouncedSearch();
  });
  clear?.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    input.focus();
  });
  btn?.addEventListener('click', () => {
    debouncedSearch.cancel();
    doSearch();
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      debouncedSearch.cancel();
      doSearch();
    }
  });

  $$('.quick-tag').forEach((tag) => {
    tag.addEventListener('click', () => {
      input.value = tag.dataset.q;
      clear.style.display = 'flex';
      debouncedSearch.cancel();
      doSearch();
    });
  });

  // 渲染历史下拉 (点击外部关闭)
  renderHistoryDropdown();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-input') && !e.target.closest('#search-history')) {
      const panel = $('search-history');
      if (panel) panel.style.display = 'none';
    }
  });

  $('th-check-all')?.addEventListener('change', (e) => {
    state.selectedTracks.clear();
    if (e.target.checked) state.searchResults.forEach((t) => state.selectedTracks.add(t.id));
    renderTrackRows();
    updateBatchBtn();
  });

  $('select-all-btn')?.addEventListener('click', () => {
    state.searchResults.forEach((t) => state.selectedTracks.add(t.id));
    renderTrackRows();
    updateBatchBtn();
  });
  $('deselect-btn')?.addEventListener('click', () => {
    state.selectedTracks.clear();
    renderTrackRows();
    updateBatchBtn();
  });
  $('batch-dl-btn')?.addEventListener('click', () => {
    const tracks = state.searchResults.filter((t) => state.selectedTracks.has(t.id));
    if (tracks.length === 0) return;
    startBatchDownload(tracks);
  });
}

async function doSearch() {
  const kw = $('search-input').value.trim();
  if (!kw) return;

  // 记录到历史
  addHistory(kw);

  // 显示 loading, 隐藏其他状态
  $('search-placeholder').style.display = 'none';
  $('search-loading').style.display = 'flex';
  $('track-list').style.display = 'none';
  $('result-toolbar').style.display = 'none';
  $('quick-tags').style.display = 'none';
  state.selectedTracks.clear();
  // 清除行缓存, 强制下次 renderTrackRows 全量重建
  const cont = $('track-rows');
  if (cont) delete cont.dataset.cachedIds;

  try {
    const res = await apiSearch(kw, 1);
    state.searchResults = res.results || [];
    state.lastQuery = kw;
    renderTrackRows();
    $('search-loading').style.display = 'none';
    $('track-list').style.display = 'block';
    $('result-toolbar').style.display = 'flex';
    $('result-count').textContent = state.searchResults.length;
    const srcBadge = $('source-badge');
    srcBadge.textContent = res.source === 'demo' ? '演示数据' : '在线搜索';
    srcBadge.style.display = 'inline-block';
    if (res.warning) showToast(res.warning, 'error', 5000);
    updateBatchBtn();
  } catch (err) {
    $('search-loading').style.display = 'none';
    $('search-placeholder').style.display = 'flex';
    showToast('搜索失败：' + err.message, 'error');
  }
}

/** 渲染历史下拉面板 (focus 时显示) */
function renderHistoryDropdown() {
  const input = $('search-input');
  if (!input) return;
  const panel = document.createElement('div');
  panel.id = 'search-history';
  panel.className = 'search-history-panel';
  panel.style.cssText =
    'display:none;position:absolute;top:100%;left:0;right:0;' +
    'z-index:100;background:var(--bg-card);border:1px solid var(--border);' +
    'border-radius:8px;margin-top:4px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,0.4);' +
    'max-height:280px;overflow-y:auto;';

  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(panel);

  const refresh = () => {
    const list = getHistory();
    if (list.length === 0) {
      panel.innerHTML =
        '<div style="padding:10px 12px;color:var(--text-3);font-size:12px;">暂无搜索历史</div>';
      return;
    }
    panel.innerHTML =
      list
        .map(
          (kw) =>
            `<div class="search-history-item" data-q="${esc(kw)}"
            style="padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;
                   display:flex;justify-content:space-between;align-items:center;">
         <span>${esc(kw)}</span>
         <span class="search-history-del" data-del="${esc(kw)}"
               style="color:var(--text-3);font-size:14px;padding:0 4px;">×</span>
       </div>`
        )
        .join('') +
      `<div class="search-history-clear"
            style="padding:6px 12px;text-align:center;cursor:pointer;
                   color:var(--text-3);font-size:12px;border-top:1px solid var(--border);margin-top:4px;">
         清空历史
       </div>`;
  };

  input.addEventListener('focus', () => {
    refresh();
    panel.style.display = 'block';
  });
  input.addEventListener('blur', () => {
    // 延迟关闭, 让 click 能注册
    setTimeout(() => {
      panel.style.display = 'none';
    }, 200);
  });

  panel.addEventListener('click', (e) => {
    const del = e.target.closest('.search-history-del');
    if (del) {
      e.stopPropagation();
      const kw = del.dataset.del;
      const list = getHistory().filter((x) => x !== kw);
      try {
        localStorage.setItem('flac-music:search-history', JSON.stringify(list));
      } catch (_) {}
      refresh();
      return;
    }
    const clear = e.target.closest('.search-history-clear');
    if (clear) {
      try {
        localStorage.removeItem('flac-music:search-history');
      } catch (_) {}
      refresh();
      return;
    }
    const item = e.target.closest('.search-history-item');
    if (item) {
      input.value = item.dataset.q;
      input.focus();
      panel.style.display = 'none';
      doSearch();
    }
  });
}

/** 渲染搜索结果表格; 增量更新策略见文件头 */
export function renderTrackRows() {
  const container = $('track-rows');
  if (!container) return;

  const currentIds = state.searchResults.map((t) => String(t.id)).join(',');
  const cachedIds = container.dataset.cachedIds || '';
  if (currentIds === cachedIds && container.children.length === state.searchResults.length) {
    // 增量: 只切换选中态
    Array.from(container.children).forEach((row) => {
      const id = row.dataset.id;
      const track = state.searchResults.find((t) => String(t.id) === id);
      if (!track) return;
      const isSelected = state.selectedTracks.has(track.id);
      row.classList.toggle('selected', isSelected);
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = isSelected;
    });
    $('th-check-all').checked = isAllSelected();
    return;
  }

  // 全量重建
  container.innerHTML = '';
  container.dataset.cachedIds = currentIds;

  state.searchResults.forEach((track, idx) => {
    container.appendChild(buildRow(track, idx));
  });

  $('th-check-all').checked = isAllSelected();
}

function buildRow(track, idx) {
  const isSelected = state.selectedTracks.has(track.id);
  const sizeStr = track.size ? `${track.size.toFixed(1)} MB` : '—';
  const fmt = safeFormat(track.format);

  const row = document.createElement('div');
  row.className = `track-row${isSelected ? ' selected' : ''}`;
  row.dataset.id = track.id;
  row.innerHTML = `
    <div class="tr-check"><input type="checkbox" ${isSelected ? 'checked' : ''} /></div>
    <div class="tr-num">${idx + 1}</div>
    <div class="tr-title-wrap">
      <div class="tr-name" title="${esc(track.title)}">${esc(track.title)}</div>
      <div class="tr-artist">${esc(track.artist)}${track.album ? ' · ' + esc(track.album) : ''}</div>
    </div>
    <div><span class="fmt-tag fmt-${fmt}">${esc(track.format)}</span></div>
    <div class="tr-quality">${esc(track.quality)}</div>
    <div class="tr-size">${sizeStr}</div>
    <div class="tr-dur">${esc(track.duration || '—')}</div>
    <div class="tr-actions">
      <button class="tr-dl-btn" data-id="${esc(track.id)}" title="立即下载">↓ 下载</button>
    </div>`;

  // 行点击 → 切换选中
  row.addEventListener('click', (e) => {
    if (e.target.closest('.tr-dl-btn') || e.target.tagName === 'INPUT') return;
    const cb = row.querySelector('input[type="checkbox"]');
    cb.checked = !cb.checked;
    toggleTrackSelect(track.id, cb.checked);
  });
  row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
    toggleTrackSelect(track.id, e.target.checked);
  });
  row.querySelector('.tr-dl-btn').addEventListener('click', () => {
    startBatchDownload([track]);
  });

  return row;
}

function toggleTrackSelect(id, checked) {
  if (checked) state.selectedTracks.add(id);
  else state.selectedTracks.delete(id);

  const row = document.querySelector(`.track-row[data-id="${id}"]`);
  if (row) row.classList.toggle('selected', checked);

  $('th-check-all').checked = isAllSelected();
  updateBatchBtn();
}

function isAllSelected() {
  return (
    state.searchResults.length > 0 &&
    state.searchResults.every((t) => state.selectedTracks.has(t.id))
  );
}

function updateBatchBtn() {
  const n = state.selectedTracks.size;
  const btn = $('batch-dl-btn');
  if (btn) btn.disabled = n === 0;
  const cnt = $('selected-count');
  if (cnt) cnt.textContent = n;
}

async function startBatchDownload(tracks) {
  if (tracks.length === 0) return;
  try {
    const result = await downloadAdd(tracks);
    if (result.ok) {
      result.tasks.forEach((task) => tasksStore.add(task));
      // 标记"已加入"状态
      tracks.forEach((t) => {
        const btn = document.querySelector(`.tr-dl-btn[data-id="${t.id}"]`);
        if (btn) {
          btn.textContent = '已加入';
          btn.className = 'tr-dl-btn queued';
        }
      });
      showToast(`已添加 ${tracks.length} 首到下载队列`, 'success');
      // 通知 downloads 页刷新 badge (简单做法: 由 downloads.js 自己订阅 IPC)
    }
  } catch (err) {
    showToast('添加下载失败：' + err.message, 'error');
  }
}
