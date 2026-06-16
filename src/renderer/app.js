'use strict';

/* ══════════════════════════════════════════════════════════
   FLAC Music Client — 渲染进程核心逻辑
   ══════════════════════════════════════════════════════════ */

const api = window.flacMusic;

// ── 全局状态 ─────────────────────────────────────────────────
const state = {
  currentPage: 'search',
  searchResults: [],
  selectedTracks: new Set(),   // track.id
  tasks: new Map(),            // taskId → task data
  config: {},
  sysInfo: {},
  globalSpeed: 0
};

// ── DOM 引用 ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── 初始化 ──────────────────────────────────────────────────
async function init() {
  try {
    [state.config, state.sysInfo] = await Promise.all([api.configGet(), api.systemInfo()]);
  } catch (err) {
    state.config  = { downloadDir: '~/Music', maxConcurrent: 3, defaultFormat: 'FLAC', defaultQuality: '24bit/96kHz', autoWriteMetadata: false, autoOrganize: true };
    state.sysInfo = { platform: 'win32', version: '2.4.1' };
    console.error('[Init] 与主进程通信失败，使用默认配置:', err);
    showConnectionError();
  }

  setupGlobalErrorHandler();
  applyPlatform();
  applySettings();
  setupNav();
  setupSearch();
  setupDownloadsPage();
  setupSettingsPage();
  setupLibraryPage();
  setupTitlebar();
  setupIPC();
  setupModals();
  refreshDownloadList();
  refreshTasksFromMain();
}

// ── 全局错误边界 ─────────────────────────────────────────────
function setupGlobalErrorHandler() {
  // 捕获未处理的 Promise 异常
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Rejection]', event.reason);
    showToast('发生未处理异常，请查看日志', 'error', 4000);
  });

  // 捕获同步异常
  window.addEventListener('error', (event) => {
    console.error('[Error]', event.error || event.message);
    showToast('发生错误，请查看日志', 'error', 4000);
    event.preventDefault();
  });
}

function showConnectionError() {
  const banner = document.createElement('div');
  banner.id = 'conn-error-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 20px;background:#d93025;color:#fff;font-size:13px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  banner.innerHTML = '<strong>⚠ 与主进程通信断开</strong> — 部分功能可能不可用，请重启应用';
  if (!document.getElementById('conn-error-banner')) {
    document.body.prepend(banner);
  }
}

// ── 平台适配 ─────────────────────────────────────────────────
function applyPlatform() {
  const p = state.sysInfo.platform || 'win32';
  document.body.classList.add(`platform-${p}`);

  // 平台徽章
  const badge = $('platform-badge');
  const icon  = $('platform-icon');
  const name  = $('platform-name');

  if (p === 'darwin') {
    badge.className = 'platform-badge mac';
    name.textContent = 'macOS';
    icon.innerHTML = `<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>`;
  } else {
    badge.className = 'platform-badge win';
    name.textContent = 'Windows';
  }

  const ver = state.sysInfo.version || '2.4.1';
  $('version-info').textContent = `v${ver}`;
  $('about-version').textContent = `v${ver}`;
}

// ── 导航 ─────────────────────────────────────────────────────
function setupNav() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
  api.onNav(page => navigateTo(page));
}

function navigateTo(page) {
  if (state.currentPage === page) return;
  state.currentPage = page;

  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));

  if (page === 'downloads') refreshDownloadList();
  if (page === 'library')   refreshLibrary();
}

// ── Windows 标题栏 ────────────────────────────────────────────
function setupTitlebar() {
  $('tb-min')?.addEventListener('click', () => { api.windowMin(); });
  $('tb-max')?.addEventListener('click', () => { api.windowMax(); });
  $('tb-close')?.addEventListener('click', () => {
    if (state.tasks.size > 0) showCloseModal();
    else api.forceQuit();
  });
}

// ── 搜索 ─────────────────────────────────────────────────────
function setupSearch() {
  const input  = $('search-input');
  const btn    = $('search-btn');
  const clear  = $('search-clear');

  input.addEventListener('input', () => {
    clear.style.display = input.value ? 'flex' : 'none';
  });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    input.focus();
  });
  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  $$('.quick-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      input.value = tag.dataset.q;
      clear.style.display = 'flex';
      doSearch();
    });
  });

  $('th-check-all').addEventListener('change', e => {
    const checked = e.target.checked;
    state.selectedTracks.clear();
    if (checked) state.searchResults.forEach(t => state.selectedTracks.add(t.id));
    renderTrackRows();
    updateBatchBtn();
  });

  $('select-all-btn').addEventListener('click', () => {
    state.searchResults.forEach(t => state.selectedTracks.add(t.id));
    renderTrackRows();
    updateBatchBtn();
  });
  $('deselect-btn').addEventListener('click', () => {
    state.selectedTracks.clear();
    renderTrackRows();
    updateBatchBtn();
  });
  $('batch-dl-btn').addEventListener('click', () => {
    const tracks = state.searchResults.filter(t => state.selectedTracks.has(t.id));
    if (tracks.length === 0) return;
    startBatchDownload(tracks);
  });
}

async function doSearch() {
  const kw = $('search-input').value.trim();
  if (!kw) return;

  $('search-placeholder').style.display = 'none';
  $('search-loading').style.display     = 'flex';
  $('track-list').style.display         = 'none';
  $('result-toolbar').style.display     = 'none';
  $('quick-tags').style.display         = 'none';
  state.selectedTracks.clear();
  // 清除行缓存，强制下次 renderTrackRows 全量重建
  const cont = $('track-rows');
  if (cont) delete cont.dataset.cachedIds;

  try {
    const res = await api.search(kw, 1);
    state.searchResults = res.results || [];
    renderTrackRows();
    $('search-loading').style.display = 'none';
    $('track-list').style.display     = 'block';
    $('result-toolbar').style.display = 'flex';
    $('result-count').textContent      = state.searchResults.length;
    const srcBadge = $('source-badge');
    srcBadge.textContent = res.source === 'demo' ? '演示数据' : '在线搜索';
    srcBadge.style.display = 'inline-block';
    if (res.warning) {
      showToast(res.warning, 'error', 5000);
    }
    updateBatchBtn();
  } catch (err) {
    $('search-loading').style.display     = 'none';
    $('search-placeholder').style.display = 'flex';
    showToast('搜索失败：' + err.message, 'error');
  }
}

function renderTrackRows() {
  const container = $('track-rows');
  if (!container) return;

  // 增量更新：如果结果集未变化，仅更新选择态，避免全量重建
  const currentIds = state.searchResults.map(t => String(t.id)).join(',');
  const cachedIds  = container.dataset.cachedIds || '';
  if (currentIds === cachedIds && container.children.length === state.searchResults.length) {
    // 仅切换选中态
    Array.from(container.children).forEach(row => {
      const id = row.dataset.id;
      const track = state.searchResults.find(t => String(t.id) === id);
      if (!track) return;
      const isSelected = state.selectedTracks.has(track.id);
      row.classList.toggle('selected', isSelected);
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = isSelected;
    });
    const allChecked = state.searchResults.length > 0 && state.searchResults.every(t => state.selectedTracks.has(t.id));
    $('th-check-all').checked = allChecked;
    return;
  }

  container.innerHTML = '';
  container.dataset.cachedIds = currentIds;

  state.searchResults.forEach((track, idx) => {
    const isSelected = state.selectedTracks.has(track.id);
    const row = document.createElement('div');
    row.className = `track-row${isSelected ? ' selected' : ''}`;
    row.dataset.id = track.id;

    const sizeStr = track.size ? `${track.size.toFixed(1)} MB` : '—';
    const safeFormat = ['FLAC','WAV','MP3','AAC','APE','DSD'].includes(track.format) ? track.format : 'FLAC';
    row.innerHTML = `
      <div class="tr-check"><input type="checkbox" ${isSelected ? 'checked' : ''} /></div>
      <div class="tr-num">${idx + 1}</div>
      <div class="tr-title-wrap">
        <div class="tr-name" title="${esc(track.title)}">${esc(track.title)}</div>
        <div class="tr-artist">${esc(track.artist)}${track.album ? ' · ' + esc(track.album) : ''}</div>
      </div>
      <div><span class="fmt-tag fmt-${safeFormat}">${esc(track.format)}</span></div>
      <div class="tr-quality">${esc(track.quality)}</div>
      <div class="tr-size">${sizeStr}</div>
      <div class="tr-dur">${esc(track.duration || '—')}</div>
      <div class="tr-actions">
        <button class="tr-dl-btn" data-id="${esc(track.id)}" title="立即下载">↓ 下载</button>
      </div>`;

    // 行点击 → 选中
    row.addEventListener('click', (e) => {
      if (e.target.closest('.tr-dl-btn') || e.target.tagName === 'INPUT') return;
      const cb = row.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      toggleTrackSelect(track.id, cb.checked);
    });

    // checkbox 变化
    row.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      toggleTrackSelect(track.id, e.target.checked);
    });

    // 单首下载
    row.querySelector('.tr-dl-btn').addEventListener('click', () => {
      startBatchDownload([track]);
    });

    container.appendChild(row);
  });

  // 更新全选框
  const allChecked = state.searchResults.length > 0 && state.searchResults.every(t => state.selectedTracks.has(t.id));
  $('th-check-all').checked = allChecked;
}

function toggleTrackSelect(id, checked) {
  if (checked) state.selectedTracks.add(id);
  else state.selectedTracks.delete(id);

  const row = document.querySelector(`.track-row[data-id="${id}"]`);
  if (row) row.classList.toggle('selected', checked);

  const allChecked = state.searchResults.length > 0 && state.searchResults.every(t => state.selectedTracks.has(t.id));
  $('th-check-all').checked = allChecked;
  updateBatchBtn();
}

function updateBatchBtn() {
  const n = state.selectedTracks.size;
  const btn = $('batch-dl-btn');
  btn.disabled = n === 0;
  $('selected-count').textContent = n;
}

// ── 下载操作 ─────────────────────────────────────────────────
async function startBatchDownload(tracks) {
  if (tracks.length === 0) return;
  try {
    const result = await api.downloadAdd(tracks);
    if (result.ok) {
      result.tasks.forEach(task => state.tasks.set(task.id, task));
      updateDlBadge();
      showToast(`已添加 ${tracks.length} 首到下载队列`, 'success');
      // 标记已加入队列的按钮
      tracks.forEach(t => {
        const btn = document.querySelector(`.tr-dl-btn[data-id="${t.id}"]`);
        if (btn) { btn.textContent = '已加入'; btn.className = 'tr-dl-btn queued'; }
      });
    }
  } catch (err) {
    showToast('添加下载失败：' + err.message, 'error');
  }
}

// ── 下载页 ────────────────────────────────────────────────────
function setupDownloadsPage() {
  $('pause-all-btn').addEventListener('click',  pauseAll);
  $('resume-all-btn').addEventListener('click', resumeAll);
  $('clear-done-btn').addEventListener('click', clearDone);
  $('open-dir-btn').addEventListener('click',   () => api.openDir());
}

function pauseAll() {
  state.tasks.forEach((task, id) => {
    if (task.status === 'downloading') { api.downloadPause(id); task.status = 'paused'; }
  });
  refreshDownloadList();
  showToast('已暂停所有任务', 'info');
}

function resumeAll() {
  state.tasks.forEach((task, id) => {
    if (task.status === 'paused') { api.downloadResume(id); task.status = 'downloading'; }
  });
  refreshDownloadList();
  showToast('已恢复所有任务', 'info');
}

function clearDone() {
  state.tasks.forEach((task, id) => {
    if (task.status === 'done') state.tasks.delete(id);
  });
  refreshDownloadList();
}

async function refreshTasksFromMain() {
  try {
    const tasks = await api.downloadList();
    const incomingIds = new Set(tasks.map(t => t.id));
    // Remove tasks that no longer exist in main process
    for (const id of state.tasks.keys()) {
      if (!incomingIds.has(id)) state.tasks.delete(id);
    }
    tasks.forEach(t => state.tasks.set(t.id, t));
    if (state.currentPage === 'downloads') refreshDownloadList();
    updateDlBadge();
    updateGlobalSpeed();
  } catch (_) {}
}

function refreshDownloadList() {
  const list = $('dl-task-list');
  const placeholder = $('dl-placeholder');
  if (!list) return;

  const tasks = [...state.tasks.values()].reverse();
  if (tasks.length === 0) {
    list.style.display        = 'none';
    placeholder.style.display = 'flex';
    updateStats([], [], [], []);
    return;
  }

  list.style.display        = 'flex';
  placeholder.style.display = 'none';

  const active  = tasks.filter(t => t.status === 'downloading');
  const queued  = tasks.filter(t => t.status === 'queued');
  const done    = tasks.filter(t => t.status === 'done');
  const failed  = tasks.filter(t => t.status === 'failed');
  updateStats(active, queued, done, failed);

  // 仅更新已存在卡片，不做全量重建（减少闪烁）
  const existing = new Set([...list.querySelectorAll('.task-card')].map(c => c.dataset.id));
  const current  = new Set(tasks.map(t => String(t.id)));

  // 删除不存在的
  list.querySelectorAll('.task-card').forEach(c => {
    if (!current.has(c.dataset.id)) c.remove();
  });

  // 更新或插入
  tasks.forEach(task => {
    const sid = String(task.id);
    let card = list.querySelector(`.task-card[data-id="${sid}"]`);
    if (!card) {
      card = buildTaskCard(task);
      list.prepend(card);
    } else {
      updateTaskCard(card, task);
    }
  });
}

function buildTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card status-${task.status}`;
  card.dataset.id = String(task.id);
  card.innerHTML = taskCardHTML(task);
  bindTaskCardEvents(card, task);
  return card;
}

function updateTaskCard(card, task) {
  card.className = `task-card status-${task.status}`;
  // 只更新动态部分，避免重新绑定事件
  const pct   = card.querySelector('.task-pct');
  const spd   = card.querySelector('.task-spd');
  const fill  = card.querySelector('.task-prog-fill');
  const stTxt = card.querySelector('.task-status-text');

  if (pct)  pct.textContent  = task.progress + '%';
  if (fill) fill.style.width = task.progress + '%';
  if (spd)  spd.textContent  = task.status === 'downloading' ? formatSpeed(task.speed) : '';
  if (stTxt) stTxt.textContent = statusLabel(task.status);

  // 操作按钮区更新
  const actions = card.querySelector('.task-actions');
  if (actions) {
    actions.innerHTML = taskActionsHTML(task);
    bindTaskActions(actions, task);
  }
}

function taskCardHTML(task) {
  const sizeStr = task.size ? formatBytes(task.size) : '—';
  const safeFormat = ['FLAC','WAV','MP3','AAC','APE','DSD'].includes(task.format) ? task.format : 'FLAC';
  return `
    <div class="task-top">
      <div class="task-title">
        <div class="task-name">${esc(task.title)}</div>
        <div class="task-meta">${esc(task.artist)} · ${esc(task.album || '未知专辑')} · ${sizeStr}</div>
      </div>
      <span class="fmt-tag fmt-${safeFormat} task-fmt-tag">${esc(task.format)}</span>
      <span class="task-status-text">${statusLabel(task.status)}</span>
    </div>
    <div class="task-progress-wrap">
      <div class="task-prog-row">
        <span class="task-pct">${task.progress}%</span>
        <span class="task-spd">${task.status === 'downloading' ? formatSpeed(task.speed) : ''}</span>
      </div>
      <div class="task-prog-bar"><div class="task-prog-fill" style="width:${task.progress}%"></div></div>
    </div>
    <div class="task-actions">${taskActionsHTML(task)}</div>`;
}

function taskActionsHTML(task) {
  const btns = [];
  if (task.status === 'downloading') btns.push(`<button class="task-btn" data-action="pause">暂停</button>`);
  if (task.status === 'paused')      btns.push(`<button class="task-btn" data-action="resume">继续</button>`);
  if (task.status === 'failed')      btns.push(`<button class="task-btn retry" data-action="retry">重试</button>`);
  if (task.status === 'done' && task.savePath) {
    btns.push(`<button class="task-btn open-file" data-action="reveal">在文件夹中显示</button>`);
  }
  if (['downloading','queued','paused'].includes(task.status)) {
    btns.push(`<button class="task-btn danger" data-action="cancel">取消</button>`);
  }
  return btns.join('');
}

function bindTaskActions(container, task) {
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (action === 'pause')  { await api.downloadPause(task.id);  task.status = 'paused'; }
      if (action === 'resume') { await api.downloadResume(task.id); task.status = 'downloading'; }
      if (action === 'cancel') {
        await api.downloadCancel(task.id);
        state.tasks.delete(task.id);
        refreshDownloadList();
        return;
      }
      if (action === 'reveal') { api.revealFile(task.savePath); return; }
      if (action === 'retry')  {
        const original = { ...task, url: task.url || `demo://${task.id}`, status: 'queued', progress: 0, speed: 0, downloaded: 0, error: '' };
        await api.downloadAdd([original]);
        state.tasks.delete(task.id);
        refreshDownloadList();
        return;
      }
      refreshDownloadList();
    });
  });
}

function bindTaskCardEvents(card, task) {
  const actions = card.querySelector('.task-actions');
  if (actions) bindTaskActions(actions, task);
}

function updateStats(active, queued, done, failed) {
  $('stat-active').textContent = active.length;
  $('stat-queued').textContent = queued.length;
  $('stat-done').textContent   = done.length;
  $('stat-failed').textContent = failed.length;

  const totalSpeed = active.reduce((s, t) => s + (t.speed || 0), 0);
  $('stat-speed').textContent = formatSpeed(totalSpeed);
  updateDlBadge();
}

function updateDlBadge() {
  const activeCount = [...state.tasks.values()].filter(t => ['downloading','queued','paused'].includes(t.status)).length;
  const badge = $('dl-badge');
  if (activeCount > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = activeCount;
  } else {
    badge.style.display = 'none';
  }
}

function updateGlobalSpeed() {
  const totalSpeed = [...state.tasks.values()]
    .filter(t => t.status === 'downloading')
    .reduce((s, t) => s + (t.speed || 0), 0);
  state.globalSpeed = totalSpeed;
  $('global-speed').textContent = formatSpeed(totalSpeed);
  const maxSpeed = 20 * 1024 * 1024; // 20 MB/s 为 100%
  const pct = Math.min((totalSpeed / maxSpeed) * 100, 100);
  $('global-fill').style.width = pct + '%';
}

// ── IPC 事件 ──────────────────────────────────────────────────
function setupIPC() {
  api.onTaskProgress(data => {
    const task = state.tasks.get(data.id);
    if (task) Object.assign(task, data);
    else state.tasks.set(data.id, data);

    if (state.currentPage === 'downloads') {
      const card = document.querySelector(`.task-card[data-id="${data.id}"]`);
      if (card) updateTaskCard(card, data);
    }
    updateGlobalSpeed();
    updateDlBadge();
  });

  api.onTaskFinished(data => {
    const task = state.tasks.get(data.id);
    if (task) Object.assign(task, data);
    if (data.status === 'done') {
      const title = task?.title || '音乐';
      showToast(`「${title}」下载完成`, 'success');
    }
    if (state.currentPage === 'downloads') refreshDownloadList();
  });

  api.onPauseAll(pauseAll);
  api.onResumeAll(resumeAll);
  api.onClearDone(clearDone);
  api.onConfirmClose(({ activeTasks }) => showCloseModal(activeTasks));
  api.onCheckUpdate(async () => {
    try {
      const result = window.flacMusic.updateCheck ? await window.flacMusic.updateCheck() : null;
      handleUpdateResult(result);
    } catch (_) {}
  });
}

// ── 设置页 ────────────────────────────────────────────────────
function setupSettingsPage() {
  applySettings();

  $('change-dir-btn').addEventListener('click', async () => {
    const dir = await api.chooseDir();
    if (dir) {
      state.config.downloadDir = dir;
      $('dl-dir-display').textContent = dir;
      await api.configSet({ downloadDir: dir });
      showToast('下载目录已更新', 'success');
    }
  });

  $('max-concurrent').addEventListener('change', async e => {
    const val = parseInt(e.target.value, 10);
    state.config.maxConcurrent = val;
    await api.configSet({ maxConcurrent: val });
  });

  $('default-format').addEventListener('change', async e => {
    state.config.defaultFormat = e.target.value;
    await api.configSet({ defaultFormat: e.target.value });
  });

  $('default-quality').addEventListener('change', async e => {
    state.config.defaultQuality = e.target.value;
    await api.configSet({ defaultQuality: e.target.value });
  });

  $('auto-organize').addEventListener('change', async e => {
    state.config.autoOrganize = e.target.checked;
    await api.configSet({ autoOrganize: e.target.checked });
  });

  $('auto-metadata').addEventListener('change', async e => {
    state.config.autoWriteMetadata = e.target.checked;
    await api.configSet({ autoWriteMetadata: e.target.checked });
  });

  $('link-website').addEventListener('click', () => {
    api.openExternal('https://flac.music.hi.cn/');
  });
  $('link-update')?.addEventListener('click', async () => {
    showToast('正在检查更新…', 'info', 2000);
    try {
      const r = await api.updateCheck();
      handleUpdateResult(r);
    } catch (_) { showToast('检查更新失败', 'error'); }
  });
}

function handleUpdateResult(r) {
  if (!r || !r.ok) {
    showToast(r?.error ? `检查更新失败: ${r.error}` : '检查更新失败', 'error', 5000);
    return;
  }
  if (r.upToDate) {
    showToast(`已是最新版本 (v${r.version})`, 'info');
    return;
  }
  // 发现新版本：提示并可选打开下载页
  const msg = `发现新版本 v${r.latestVersion}（当前 v${r.version}）`;
  showToast(msg, 'success', 8000);
  // 5 秒后自动打开发布页（用户可立即关闭 toast 跳过）
  if (r.releaseUrl) {
    setTimeout(() => {
      if (confirm(`发现新版本 v${r.latestVersion}，是否前往下载？`)) {
        api.openExternal(r.releaseUrl);
      }
    }, 100);
  }
}

function applySettings() {
  const c = state.config;
  if (!c) return;

  const dlDir = $('dl-dir-display');
  if (dlDir) dlDir.textContent = c.downloadDir || '~/Music';

  const mc = $('max-concurrent');
  if (mc && c.maxConcurrent) mc.value = String(c.maxConcurrent);

  const df = $('default-format');
  if (df && c.defaultFormat) df.value = c.defaultFormat;

  const dq = $('default-quality');
  if (dq && c.defaultQuality) dq.value = c.defaultQuality;

  const ao = $('auto-organize');
  if (ao) ao.checked = c.autoOrganize !== false;

  const am = $('auto-metadata');
  if (am) am.checked = c.autoWriteMetadata !== false;
}

// ── 音乐库页 ──────────────────────────────────────────────────
function setupLibraryPage() {
  $('lib-open-dir').addEventListener('click', () => api.openDir());
  $('lib-go-search').addEventListener('click', () => navigateTo('search'));
  $('lib-placeholder')?.addEventListener('click', e => {
    if (e.target === $('lib-go-search')) navigateTo('search');
  });
}

async function refreshLibrary() {
  const placeholder = $('lib-placeholder');
  const grid = $('lib-grid');
  if (!grid) return;

  // 优先扫描真实文件系统
  let files = [];
  try {
    const res = await api.libraryScan();
    if (res && res.ok) files = res.files || [];
  } catch (_) {
    // 扫描失败时回退到内存任务
  }

  // 如果扫描为空，回退到本次会话完成的任务
  if (files.length === 0) {
    const doneItems = [...state.tasks.values()].filter(t => t.status === 'done');
    if (doneItems.length === 0) {
      placeholder.style.display = 'flex';
      grid.style.display        = 'none';
      return;
    }
    placeholder.style.display = 'none';
    grid.style.display        = 'grid';
    grid.innerHTML = doneItems.map(item => `
      <div class="lib-item">
        <div class="lib-cover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <div class="lib-name" title="${esc(item.title)}">${esc(item.title)}</div>
        <div class="lib-artist">${esc(item.artist)}</div>
      </div>
    `).join('');
    return;
  }

  placeholder.style.display = 'none';
  grid.style.display        = 'grid';
  grid.innerHTML = files.map(f => `
    <div class="lib-item" title="${esc(f.path)}">
      <div class="lib-cover">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="lib-name">${esc(f.name)}</div>
      <div class="lib-artist">${esc(f.ext)} · ${formatSize(f.size)}</div>
    </div>
  `).join('');
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ── 模态框 ────────────────────────────────────────────────────
function setupModals() {
  $('modal-cancel-btn').addEventListener('click', () => {
    $('modal-close').style.display = 'none';
  });
  $('modal-quit-btn').addEventListener('click', () => {
    api.forceQuit();
  });
}

function showCloseModal(activeTasks) {
  $('modal-close-msg').innerHTML = `仍有 <strong>${activeTasks || '部分'}</strong> 个下载任务正在进行，退出后任务将中断。`;
  $('modal-close').style.display = 'flex';
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const container = $('toast-container');
  const icons = { success: '✓', error: '✕', info: '→' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${esc(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── 工具函数 ─────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB';
  const kb = bytes / 1024;
  if (kb >= 1) return kb.toFixed(0) + ' KB';
  return bytes + ' B';
}

function formatSpeed(bps) {
  if (!bps || bps <= 0) return '0 KB/s';
  const mb = bps / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB/s';
  return Math.round(bps / 1024) + ' KB/s';
}

function statusLabel(status) {
  const map = { downloading: '下载中', queued: '等待中', done: '已完成', failed: '失败', paused: '已暂停' };
  return map[status] || status;
}

// ── 启动 ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
