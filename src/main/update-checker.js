'use strict';

/**
 * 更新检查模块
 * 调用 GitHub Releases API 拉取最新版本, 与当前版本号比较
 *
 * 返回统一结构 { ok, upToDate, version, latestVersion?, releaseUrl?, error? }
 * 任意环节失败都返回 ok: false + upToDate: true (不打扰用户)
 */

const https = require('https');
const log = require('./logger');
const { getUserAgent, DOWNLOAD } = require('./constants');

const REPO = 'Minions777/flac-music';

function check() {
  // 惰性 require: 避免测试环境触发 electron 二进制下载
  const { app } = require('electron');
  const currentVersion = app.getVersion();
  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases/latest`,
        headers: {
          'User-Agent': getUserAgent(),
          Accept: 'application/vnd.github+json'
        },
        timeout: DOWNLOAD.UPDATE_TIMEOUT_MS
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(fail(currentVersion, `HTTP ${res.statusCode}`));
        }
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const latestVersion = (data.tag_name || '').replace(/^v/, '');
            if (!latestVersion) {
              return resolve({ ok: true, upToDate: true, version: currentVersion });
            }
            const isOutdated = compareVersions(currentVersion, latestVersion) < 0;
            log.info(
              `[Update] 当前: ${currentVersion}, 最新: ${latestVersion}, 需更新: ${isOutdated}`
            );
            resolve({
              ok: true,
              upToDate: !isOutdated,
              version: currentVersion,
              latestVersion,
              releaseUrl: data.html_url || `https://github.com/${REPO}/releases/latest`,
              releaseNotes: data.body || '',
              publishedAt: data.published_at || ''
            });
          } catch (e) {
            resolve(fail(currentVersion, e.message));
          }
        });
      }
    );
    req.on('error', (err) => resolve(fail(currentVersion, err.message)));
    req.on('timeout', () => {
      req.destroy();
      resolve(fail(currentVersion, 'timeout'));
    });
  });
}

function fail(version, error) {
  log.warn(`[Update] 检查失败: ${error}`);
  return { ok: false, upToDate: true, version, error };
}

/** 语义化版本比较; 1.2.10 > 1.2.9 (避免字符串比较陷阱) */
function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

module.exports = { check, compareVersions };
