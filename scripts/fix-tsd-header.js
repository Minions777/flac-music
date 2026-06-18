#!/usr/bin/env node
/**
 * 修复 NTFS TSD-Header 透明加密导致的文件损坏
 * 
 * 问题: 某些 Windows 环境下 git checkout 写入的文件会被 NTFS 透明层
 *       添加 TSD-Header 前缀，导致 Node.js 无法正确读取。
 * 
 * 解决: 使用 git cat-file 读取正确的 blob 内容，然后用 Node.js 重写文件。
 * 
 * 用法: node scripts/fix-tsd-header.js
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = ['.js', '.json', '.html', '.css', '.cjs', '.mjs'];

function main() {
  const files = execSync('git ls-files', { cwd: REPO_ROOT })
    .toString().trim().split('\n')
    .filter(f => EXTENSIONS.some(ext => f.endsWith(ext)));

  let fixed = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const fullPath = path.join(REPO_ROOT, file);
      const content = execSync(`git cat-file -p HEAD:${file}`, {
        cwd: REPO_ROOT,
        maxBuffer: 10 * 1024 * 1024
      });

      if (!fs.existsSync(fullPath)) {
        skipped++;
        continue;
      }

      const current = fs.readFileSync(fullPath);
      
      // 检查文件是否被 TSD-Header 感染 (大小膨胀且前几字节不匹配)
      if (current.length !== content.length || 
          (content.length > 0 && !current.slice(0, Math.min(20, content.length)).equals(content.slice(0, Math.min(20, content.length))))) {
        fs.writeFileSync(fullPath, content);
        fixed++;
      }
    } catch (e) {
      // 跳过无法处理的文件
    }
  }

  if (fixed > 0) {
    console.log(`[fix-tsd-header] Fixed ${fixed} / ${files.length} files`);
  }
}

main();
