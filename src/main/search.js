'use strict';

/**
 * 搜索模块
 *
 * 策略:
 * 1. 调用上游搜索接口 (HTTPS, 15s 超时)
 * 2. 响应是 JSON 直接解析
 * 3. 响应是 HTML 用正则抽取 (规则: 含 song|track|item|music class 的 li/tr/div)
 * 4. 任意环节失败 → 演示数据 + warning, 让 UI 正常渲染
 *
 * 设计原则: "永远不要让搜索失败冒泡到 UI 层"
 * - 网络错误/超时/HTML 解析失败 全部静默降级
 * - 通过 source: 'api' | 'html' | 'demo' 让 UI 区分
 */

const https = require('https');
const log = require('./logger');
const { DOWNLOAD } = require('./constants');

const SEARCH_BASE = 'https://flac.music.hi.cn';

/**
 * @param {string} keyword
 * @param {number} [page=1]
 * @returns {Promise<{success: boolean, results: Track[], source: 'api'|'html'|'demo', warning?: string, error?: string}>}
 */
function searchMusic(keyword, page = 1) {
  const searchUrl = `${SEARCH_BASE}/search?q=${encodeURIComponent(keyword)}&page=${page}`;

  return new Promise((resolve) => {
    const req = https.get(
      searchUrl,
      {
        timeout: DOWNLOAD.SEARCH_TIMEOUT_MS,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const contentType = res.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
              return resolve({ success: true, results: JSON.parse(data), source: 'api' });
            }
            const results = parseSearchResults(data, keyword);
            if (results.length === 0) {
              return resolve({
                success: true,
                results: getDemoResults(keyword),
                source: 'demo',
                warning: '搜索源暂不可用, 当前显示演示数据'
              });
            }
            resolve({ success: true, results, source: 'html' });
          } catch (e) {
            resolve({
              success: false,
              error: e.message,
              results: getDemoResults(keyword),
              source: 'demo',
              warning: '解析失败, 当前显示演示数据'
            });
          }
        });
      }
    );
    req.on('error', () => {
      log.warn(`[Search] 搜索失败, 回退演示数据: ${keyword}`);
      resolve({
        success: true,
        results: getDemoResults(keyword),
        source: 'demo',
        warning: '搜索源暂不可用, 当前显示演示数据'
      });
    });
    req.on('timeout', () => {
      req.destroy();
      log.warn(`[Search] 搜索超时, 回退演示数据: ${keyword}`);
      resolve({
        success: true,
        results: getDemoResults(keyword),
        source: 'demo',
        warning: '搜索源连接超时, 当前显示演示数据'
      });
    });
  });
}

/** 从 HTML 字符串中提取歌曲条目 (最多 20 条) */
function parseSearchResults(html, keyword) {
  const itemRe =
    /<(?:li|tr|div)[^>]*class="[^"]*(?:song|track|item|music)[^"]*"[^>]*>([\s\S]*?)<\/(?:li|tr|div)>/gi;
  const results = [];
  let m,
    i = 0;
  while ((m = itemRe.exec(html)) !== null && i < 20) {
    const block = m[1];
    const titleM =
      /(?:title|data-title)="([^"]+)"/i.exec(block) || /<a[^>]*>([^<]{2,40})<\/a>/i.exec(block);
    const artistM = /(?:artist|singer)[^>]*>([^<]{2,30})<\//i.exec(block);
    if (titleM) {
      results.push(
        buildTrack({ title: titleM[1].trim(), artist: artistM?.[1]?.trim() || '未知艺人' }, i)
      );
      i++;
    }
  }
  if (results.length === 0) {
    log.warn(`[Search] HTML 解析无结果, 回退演示数据: ${keyword}`);
    return getDemoResults(keyword).map((r) => ({ ...r, _demoWarning: true }));
  }
  return results;
}

/** 离线/网络不可用时的兜底数据 */
function getDemoResults(keyword) {
  const songs = [
    {
      title: `${keyword} - 热门单曲`,
      artist: '周杰伦',
      album: '精选集',
      year: '2024',
      format: 'FLAC',
      quality: '24bit/96kHz',
      size: 38.2
    },
    {
      title: `${keyword} (Live)`,
      artist: '邓紫棋',
      album: '演唱会',
      year: '2023',
      format: 'FLAC',
      quality: '16bit/44.1kHz',
      size: 29.1
    },
    {
      title: `${keyword} Remix`,
      artist: '薛之谦',
      album: '单曲',
      year: '2024',
      format: 'MP3',
      quality: '320kbps',
      size: 12.4
    },
    {
      title: `${keyword} 完整版`,
      artist: '陈奕迅',
      album: '精选',
      year: '2022',
      format: 'FLAC',
      quality: '24bit/192kHz',
      size: 72.6
    },
    {
      title: `${keyword} 钢琴版`,
      artist: '钢琴君',
      album: '纯音乐',
      year: '2023',
      format: 'WAV',
      quality: '24bit/96kHz',
      size: 55.3
    },
    {
      title: `${keyword} OST`,
      artist: '影视原声',
      album: '影视音乐',
      year: '2024',
      format: 'FLAC',
      quality: '16bit/44.1kHz',
      size: 33.7
    },
    {
      title: `${keyword} 国语版`,
      artist: '五月天',
      album: '专辑',
      year: '2023',
      format: 'AAC',
      quality: '256kbps',
      size: 9.8
    },
    {
      title: `${keyword} 经典老歌`,
      artist: '邓丽君',
      album: '经典',
      year: '1985',
      format: 'APE',
      quality: '无损',
      size: 44.1
    },
    {
      title: `${keyword} 2024新版`,
      artist: '毛不易',
      album: 'EP',
      year: '2024',
      format: 'FLAC',
      quality: '24bit/96kHz',
      size: 41.2
    },
    {
      title: `最美${keyword}`,
      artist: '林俊杰',
      album: '新歌',
      year: '2024',
      format: 'FLAC',
      quality: '24bit/96kHz',
      size: 36.8
    }
  ];
  return songs.map((s, i) => buildTrack(s, i));
}

/** 把任意来源的 song 数据归一化成 Track 结构 */
function buildTrack(s, i) {
  return {
    id: `track_${Date.now()}_${i}`,
    title: s.title || '未知歌曲',
    artist: s.artist || '未知艺人',
    album: s.album || '未知专辑',
    year: s.year || '',
    cover: s.cover || '',
    format: s.format || 'FLAC',
    quality: s.quality || '24bit/96kHz',
    size: s.size || 0,
    url: s.url || `${DOWNLOAD.DEMO_PROTOCOL}${i}`,
    duration:
      s.duration ||
      `${3 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
  };
}

module.exports = { searchMusic, parseSearchResults, getDemoResults, buildTrack };
