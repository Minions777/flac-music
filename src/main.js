'use strict';

/**
 * 主进程入口（兼容层）
 *
 * 实际逻辑拆分到 src/main/* 目录下的模块
 * 本文件仅作为 Electron 的 main 入口, 转发到 ./main/index.js
 */

require('./main/index.js');
