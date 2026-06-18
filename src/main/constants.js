'use strict';

/**
 * 主进程共享常量
 * 集中放置路径、配置校验、白名单、魔数等"魔法值"
 *
 * 注意: 路径相关常量需要等 app ready 后才能计算,
 *       所以导出 getter 函数而非字符串, 避免测试时初始化失败
 */

const path = require('path');

/** 配置文件与日志文件的绝对路径 (惰性计算, 因为 app.getPath 需要 ready 之后) */
let _userDataDir = null;
function getUserDataDir() {
  if (_userDataDir) return _userDataDir;
  const { app } = require('electron');
  _userDataDir = app.getPath('userData');
  return _userDataDir;
}
function getConfigPath() {
  return path.join(getUserDataDir(), 'config.json');
}
function getLogPath() {
  return path.join(getUserDataDir(), 'app.log');
}

/** 用户请求字符串 (延迟到调用时再读 app.getVersion) */
function getUserAgent() {
  const { app } = require('electron');
  return `FLAC-Music/${app.getVersion()}`;
}

/** 日志文件最大体积 (5MB), 超过后轮转清空 */
const MAX_LOG_SIZE = 5 * 1024 * 1024;

/** 配置项白名单 + 校验函数 (未知 key 或非法 value 会被拒) */
const CONFIG_VALIDATORS = Object.freeze({
  downloadDir: (v) => typeof v === 'string' && v.length > 0,
  maxConcurrent: (v) => Number.isInteger(v) && v >= 1 && v <= 8,
  defaultFormat: (v) => ['FLAC', 'WAV', 'MP3', 'AAC', 'APE', 'DSD'].includes(v),
  defaultQuality: (v) => typeof v === 'string' && v.length > 0 && v.length <= 32,
  autoWriteMetadata: (v) => typeof v === 'boolean',
  autoOrganize: (v) => typeof v === 'boolean'
});

/** 配置默认值 (downloadDir 动态计算, 避免在测试环境初始化时崩溃) */
function getDefaultConfig() {
  return Object.freeze({
    downloadDir: getDefaultDownloadDir(),
    maxConcurrent: 3,
    defaultFormat: 'FLAC',
    defaultQuality: '24bit/96kHz',
    autoWriteMetadata: false,
    autoOrganize: true,
    windowBounds: { width: 1160, height: 780 }
  });
}

/** 音乐库扫描支持的音频扩展名 */
const AUDIO_EXTENSIONS = new Set([
  '.flac',
  '.wav',
  '.mp3',
  '.aac',
  '.ape',
  '.dsd',
  '.ogg',
  '.wma',
  '.m4a'
]);

/** 各格式文件头魔数, 用于下载完成后验证文件 */
const MAGIC_BYTES = Object.freeze({
  flac: [0x66, 0x4c, 0x61, 0x43],
  wav: [0x52, 0x49, 0x46, 0x46],
  mp3: [0xff, 0xfb, 0x90],
  aac: [0xff, 0xf1],
  ape: [0x4d, 0x41, 0x43],
  dsd: [0x44, 0x53, 0x44, 0x5f]
});

/** 下载管理器调优参数 */
const DOWNLOAD = Object.freeze({
  PAUSE_TIMEOUT_MS: 5 * 60 * 1000, // 暂停 5 分钟后自动取消
  MAX_RETRIES: 3, // 最多重试 3 次
  RETRY_DELAYS_MS: [2000, 5000, 15000], // 指数退避
  REQUEST_TIMEOUT_MS: 30000, // 单次请求超时
  SEARCH_TIMEOUT_MS: 15000, // 搜索请求超时
  UPDATE_TIMEOUT_MS: 10000, // 更新检查超时
  DEMO_PROTOCOL: 'demo://' // 模拟下载协议
});

/** 默认下载目录 (用 music 而非 userData 子目录) */
function getDefaultDownloadDir() {
  const { app } = require('electron');
  return app.getPath('music');
}

module.exports = {
  getUserDataDir,
  getConfigPath,
  getLogPath,
  getUserAgent,
  getDefaultDownloadDir,
  getDefaultConfig,
  MAX_LOG_SIZE,
  CONFIG_VALIDATORS,
  AUDIO_EXTENSIONS,
  MAGIC_BYTES,
  DOWNLOAD
};
