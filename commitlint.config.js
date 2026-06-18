'use strict';

/**
 * Commit message 规范
 *
 * 格式: <type>(<scope>): <subject>
 * 例: feat(search): 支持按 bitrate 过滤
 *
 * 规则 (基于 conventional commits, 简化版):
 * - type 必须在白名单
 * - subject 不超过 72 字符
 * - 不允许空 subject
 * - body 段落换行用空行分隔
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修 bug
        'perf',     // 性能优化
        'refactor', // 重构 (无新功能/无 bug 修复)
        'style',    // 格式 (空格/分号等)
        'test',     // 测试
        'docs',     // 文档
        'build',    // 构建系统/依赖
        'ci',       // CI 配置
        'chore',    // 其他杂项
        'revert'    // 回滚
      ]
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72]
  }
};
