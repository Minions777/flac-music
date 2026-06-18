'use strict';

/**
 * search 模块单元测试
 * 重点测试纯函数: parseSearchResults, buildTrack, getDemoResults
 * 网络层 searchMusic 不在单测范围 (需要 nock/mock)
 */

const test = require('node:test');
const assert = require('node:assert');
const { parseSearchResults, buildTrack, getDemoResults } = require('../../src/main/search');

test('parseSearchResults 从含 song class 的 HTML 抽取条目', () => {
  const html = `
    <html><body>
      <ul>
        <li class="song-item"><h3 class="title" data-title="夜曲">周杰伦</h3></li>
        <li class="track-row"><a href="#">晴天</a></li>
        <li class="music-card"><span class="song-title" data-title="稻香">周杰伦</span><span class="artist">周杰伦</span></li>
      </ul>
    </body></html>`;
  const r = parseSearchResults(html, '周杰伦');
  assert.ok(r.length >= 3, '应该抽取到 3 首');
  assert.strictEqual(r[0].title, '夜曲');
  assert.strictEqual(r[1].title, '晴天');
});

test('parseSearchResults 没有匹配项时返回空数组', () => {
  const html = '<html><body><div>no match here</div></body></html>';
  const r = parseSearchResults(html, 'test');
  assert.ok(Array.isArray(r));
});

test('parseSearchResults 限制最大 20 条', () => {
  let html = '<ul>';
  for (let i = 0; i < 50; i++) {
    html += `<li class="song-item"><span class="title">歌${i}</span></li>`;
  }
  html += '</ul>';
  const r = parseSearchResults(html, 'test');
  assert.ok(r.length <= 20, '最多 20 条');
});

test('buildTrack 归一化缺失字段', () => {
  const t = buildTrack({}, 0);
  assert.strictEqual(t.title, '未知歌曲');
  assert.strictEqual(t.artist, '未知艺人');
  assert.strictEqual(t.album, '未知专辑');
  assert.strictEqual(t.format, 'FLAC');
  assert.ok(t.id.includes('track_'));
  assert.ok(t.url.startsWith('demo://'));
});

test('buildTrack 保留显式传入的字段', () => {
  const t = buildTrack({ title: 'A', artist: 'B', format: 'MP3', url: 'https://x/y.flac' }, 5);
  assert.strictEqual(t.title, 'A');
  assert.strictEqual(t.artist, 'B');
  assert.strictEqual(t.format, 'MP3');
  assert.strictEqual(t.url, 'https://x/y.flac');
});

test('getDemoResults 始终返回 10 条, 包含关键词', () => {
  const kw = '稻香';
  const r = getDemoResults(kw);
  assert.strictEqual(r.length, 10);
  assert.ok(r.some((t) => t.title.includes(kw)));
});

test('getDemoResults 每条都有 id / url / duration', () => {
  const r = getDemoResults('test');
  for (const t of r) {
    assert.ok(t.id);
    assert.ok(t.url);
    assert.match(t.duration, /^\d+:\d{2}$/);
  }
});
