# Changelog

本项目所有重要变更都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 性能
- 任务进度事件改用 rAF 批处理, 10+ 并发下载时不再卡主线程
- 音乐库 / 搜索结果改用 DocumentFragment 批量插入, 1000+ 结果集不阻塞渲染

### 安全
- `showCloseModal` 改用 DOM API 构造, 杜绝 `innerHTML` 模板注入模式
- 全部 `state.tasks` mutate 集中到 `tasksStore`, 避免散落写入

### 重构
- 拆分 `src/main.js` 为 11 个模块
- 拆分渲染进程为 16 个 ES Modules
- `events.js` 引入 `createRafBatcher` 工具, 业务与限流解耦

### 测试
- 渲染进程单测从 0 → 20 (state/tasksStore 11 个, events/batcher 7 个, format/dom 12 个)
- 总测试数 45 → 65, 全部通过

### 工具链
- 添加 ESLint 8.57 + Prettier 3 + EditorConfig
- 添加 GitHub Actions CI (Node 20/22 matrix)
- 添加 commitlint + husky (commit-msg / pre-commit)
- 添加 release-it 自动生成 CHANGELOG

## [2.4.1] - 2025-XX-XX

### 修复
- 初次发布重构基线

[Unreleased]: https://github.com/Minions777/flac-music/compare/v2.4.1...HEAD
[2.4.1]: https://github.com/Minions777/flac-music/releases/tag/v2.4.1
