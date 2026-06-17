'use strict';

/**
 * 格式化工具 - 字节/速度/时长/状态文案
 */

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB';
  const kb = bytes / 1024;
  if (kb >= 1) return kb.toFixed(0) + ' KB';
  return bytes + ' B';
}

export function formatSpeed(bps) {
  if (!bps || bps <= 0) return '0 KB/s';
  const mb = bps / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB/s';
  return Math.round(bps / 1024) + ' KB/s';
}

export function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const STATUS_LABELS = Object.freeze({
  downloading: '下载中',
  queued: '等待中',
  done: '已完成',
  failed: '失败',
  paused: '已暂停'
});

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

const SAFE_FORMATS = new Set(['FLAC', 'WAV', 'MP3', 'AAC', 'APE', 'DSD']);
export function safeFormat(format) {
  return SAFE_FORMATS.has(format) ? format : 'FLAC';
}
