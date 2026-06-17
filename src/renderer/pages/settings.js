'use strict';

/**
 * 设置页 - 目录选择、并发、格式/音质、自动归类/元数据
 * 设置项变化立即持久化到主进程
 */

import { $ } from '../core/dom.js';
import { chooseDir, configSet, openExternal, updateCheck } from '../core/api.js';
import { state } from '../core/state.js';
import { showToast } from '../components/toast.js';

export function setupSettingsPage() {
  applySettings();

  $('change-dir-btn')?.addEventListener('click', async () => {
    const dir = await chooseDir();
    if (dir) {
      state.config.downloadDir = dir;
      $('dl-dir-display').textContent = dir;
      await configSet({ downloadDir: dir });
      showToast('下载目录已更新', 'success');
    }
  });

  $('max-concurrent')?.addEventListener('change', async (e) => {
    const val = parseInt(e.target.value, 10);
    state.config.maxConcurrent = val;
    await configSet({ maxConcurrent: val });
  });

  $('default-format')?.addEventListener('change', async (e) => {
    state.config.defaultFormat = e.target.value;
    await configSet({ defaultFormat: e.target.value });
  });

  $('default-quality')?.addEventListener('change', async (e) => {
    state.config.defaultQuality = e.target.value;
    await configSet({ defaultQuality: e.target.value });
  });

  $('auto-organize')?.addEventListener('change', async (e) => {
    state.config.autoOrganize = e.target.checked;
    await configSet({ autoOrganize: e.target.checked });
  });

  $('auto-metadata')?.addEventListener('change', async (e) => {
    state.config.autoWriteMetadata = e.target.checked;
    await configSet({ autoWriteMetadata: e.target.checked });
  });

  $('link-website')?.addEventListener('click', () => {
    openExternal('https://flac.music.hi.cn/');
  });

  $('link-update')?.addEventListener('click', async () => {
    showToast('正在检查更新…', 'info', 2000);
    try {
      const r = await updateCheck();
      handleUpdateResult(r);
    } catch (_) {
      showToast('检查更新失败', 'error');
    }
  });
}

export function applySettings() {
  const c = state.config;
  if (!c) return;
  const set = (id, val) => {
    const el = $(id);
    if (el && val !== undefined && val !== null) el.value = String(val);
  };
  const check = (id, val) => {
    const el = $(id);
    if (el) el.checked = Boolean(val);
  };

  set('dl-dir-display', c.downloadDir || '~/Music');
  set('max-concurrent', c.maxConcurrent);
  set('default-format', c.defaultFormat);
  set('default-quality', c.defaultQuality);
  check('auto-organize', c.autoOrganize);
  check('auto-metadata', c.autoWriteMetadata);
}

export function handleUpdateResult(r) {
  if (!r || !r.ok) {
    showToast(r?.error ? `检查更新失败: ${r.error}` : '检查更新失败', 'error', 5000);
    return;
  }
  if (r.upToDate) {
    showToast(`已是最新版本 (v${r.version})`, 'info');
    return;
  }
  showToast(`发现新版本 v${r.latestVersion}（当前 v${r.version}）`, 'success', 8000);
  if (r.releaseUrl) {
    setTimeout(() => {
      if (confirm(`发现新版本 v${r.latestVersion}, 是否前往下载？`)) {
        openExternal(r.releaseUrl);
      }
    }, 100);
  }
}
