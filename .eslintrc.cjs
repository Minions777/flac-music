/**
 * FLAC Music · ESLint 配置
 * 渐进式策略: 从 warn 开始, 等团队适应后逐步升级到 error
 */
'use strict';

module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true
  },
  extends: ['standard', 'prettier'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script'
  },
  rules: {
    // ── 已开启 ────────────────────────────────
    'no-var': 'error',
    'prefer-const': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'multi-line'],  // 多行 if 必须加 {}, 单行可选
    'no-else-return': ['error', { allowElseIf: false }],
    'no-undef': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // ── 渐进式开启 (warn) ────────────────────
    'no-console': 'warn',                          // 主进程允许 console
    'no-shadow': 'warn',
    'no-param-reassign': 'warn',
    'complexity': ['warn', 15],                    // 圈复杂度上限 15 (保守起步)
    'max-depth': ['warn', 4],
    'max-lines-per-function': ['warn', 150],      // 单函数 150 行
    'no-magic-numbers': 'off',                     // 业务常量太多, 暂不强制
    'one-var': 'off',                              // 允许组合声明
    'dot-notation': 'warn',                        // 允许 ['Range'] 等动态键

    // ── Electron 特定 ────────────────────────
    'no-process-exit': 'off',                      // 单实例锁需要
    'no-sync': 'off'                                // Electron 主进程顶层同步 IO 是合理用法

  },
  overrides: [
    {
      // 渲染进程: ES Modules, 无 Node
      files: ['src/renderer/**/*.js'],
      env: { browser: true, node: false },
      parserOptions: { sourceType: 'module' }
    },
    {
      // 预加载: 浏览器 + Node 双上下文
      files: ['src/preload.js'],
      env: { browser: true, node: true }
    },
    {
      // 测试: 允许 console
      files: ['tests/**/*.js'],
      env: { node: true, browser: false },
      parserOptions: { sourceType: 'script' },
      rules: {
        'no-console': 'off',
        'no-unused-vars': 'off',                  // 测试里允许引入后未直接使用
      }
    }
  ],
  ignorePatterns: ['node_modules/', 'dist/', '*.min.js']
};
