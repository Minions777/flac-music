'use strict';

/**
 * 音乐库扫描模块
 * 递归遍历下载目录, 收集音频文件元数据
 * 限制: 深度 ≤ 4, 返回前 500 个, 按修改时间倒序
 */

const fs = require('fs');
const path = require('path');
const log = require('./logger');
const { AUDIO_EXTENSIONS } = require('./constants');

/** 扫描根目录, 返回音频文件列表 */
function scan(rootDir) {
  const files = [];
  walk(rootDir, 0, files);
  files.sort((a, b) => b.modified - a.modified);
  log.info(`[Library] 扫描到 ${files.length} 个音频文件`);
  return files.slice(0, 500);
}

/** 递归遍历; depth > 4 时停止 (防止软链/挂载导致的死循环) */
function walk(currentDir, depth, out) {
  if (depth > 4) return;
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (_) {
    return; // 目录不可读, 跳过
  }
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, depth + 1, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        try {
          const stat = fs.statSync(fullPath);
          out.push({
            name: path.basename(entry.name, ext),
            ext: ext.slice(1).toUpperCase(),
            path: fullPath,
            size: stat.size,
            modified: stat.mtimeMs
          });
        } catch (_) {
          // 单个文件 stat 失败, 跳过不影响整体
        }
      }
    }
  }
}

module.exports = { scan };
