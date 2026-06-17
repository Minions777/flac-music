'use strict';

/**
 * 配置模块 - 负责加载、保存、校验、合并用户配置
 *
 * 设计原则:
 * - 集中: 所有 config.json IO 只走这里
 * - 安全: 未知 key 直接拒绝, 不静默丢弃
 * - 防抖: 修改后 250ms 落盘, 避免频繁 IO
 * - 不可变: 提供 reset() / replace() 显式管理生命周期
 */

const fs = require('fs');
const { getConfigPath, getDefaultConfig, CONFIG_VALIDATORS } = require('./constants');

let _state = load();
let _saveTimer = null;

/** 从磁盘加载; 文件不存在/解析失败/IO 失败时回退默认值 */
function load() {
  const defaults = getDefaultConfig();
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaults, ...parsed };
    }
  } catch (err) {
    console.error('[Config] 加载失败, 使用默认值:', err.message);
  }
  return { ...defaults };
}

/**
 * 应用更新; 返回 { ok, error? }
 * - 拒绝未知 key
 * - 逐个 key 校验, 第一个非法立刻返回
 */
function applyUpdates(updates) {
  if (!updates || typeof updates !== 'object') {
    return { ok: false, error: 'Invalid updates' };
  }
  for (const [key, val] of Object.entries(updates)) {
    const validator = CONFIG_VALIDATORS[key];
    if (!validator) return { ok: false, error: `Unknown config key: ${key}` };
    if (!validator(val)) return { ok: false, error: `Invalid value for ${key}` };
  }
  _state = { ..._state, ...updates };
  scheduleSave();
  return { ok: true };
}

/** 获取当前配置 (返回新对象, 防止外部意外修改) */
function get() {
  return { ..._state };
}

/** 防抖落盘 (250ms 合并多次写) */
function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(getConfigPath(), JSON.stringify(_state, null, 2));
    } catch (err) {
      console.error('[Config] 保存失败:', err.message);
    }
  }, 250);
}

/** 立即同步落盘 (用于 before-quit) */
function flush() {
  clearTimeout(_saveTimer);
  _saveTimer = null;
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(_state, null, 2));
  } catch (err) {
    console.error('[Config] flush 失败:', err.message);
  }
}

module.exports = { get, applyUpdates, flush, load };
