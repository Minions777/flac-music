# CLAUDE.md

## 项目概述

- **项目名称**: FLAC Music
- **版本**: 2.5.0 (模块化重构)
- **类型**: Electron 桌面应用（Windows/macOS）
- **描述**: 高品质音乐批量下载客户端，支持 FLAC/MP3/WAV 等格式
- **主入口**: `src/main.js` (薄包装) → `src/main/index.js` (主进程) + `src/renderer/app.js` (渲染进程)
- **预加载**: `src/preload.js`

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 31.0.0 |
| 构建工具 | electron-builder 24.13.0 |
| 主进程语言 | CommonJS (require/module.exports) |
| 渲染进程语言 | ES Modules (import/export) |
| HTTP 客户端 | Node.js 原生 `https` 模块（无第三方依赖） |
| HTML 解析 | 正则表达式（结构化解析为回退方案） |
| 测试 | node:test (内置) |
| Lint | ESLint Standard + Prettier |
| CI | GitHub Actions (Node 20/22) |

> **重要**: 主进程用 CommonJS, 渲染进程用 ES Modules。不要混用。

## 架构 (v2.5+)

```
src/
├── main.js                  # 主进程入口 (薄包装, 转发到 ./main/index.js)
├── preload.js               # 预加载 (contextBridge)
├── main/                    # 主进程模块 (CommonJS)
│   ├── index.js             # app 生命周期 + 模块装配
│   ├── constants.js         # 路径 / 魔数 / schema / 下载参数
│   ├── config.js            # 配置读写 (防抖)
│   ├── logger.js            # 文件日志 (5MB 轮转)
│   ├── download-manager.js  # 下载队列 (断点续传/魔数/重试)
│   ├── search.js            # 搜索 (HTTPS + HTML 解析 + demo 回退)
│   ├── library.js           # 音乐库扫描
│   ├── update-checker.js    # GitHub Releases
│   ├── window.js            # 窗口创建 + 关闭守卫
│   ├── menu.js              # 应用菜单
│   └── ipc.js               # IPC handler 集中注册
└── renderer/                # 渲染进程 (ES Modules)
    ├── app.js               # 入口 (init 编排)
    ├── core/                # 共享工具
    │   ├── api.js           # preload bridge 包装
    │   ├── state.js         # 全局 state (单一数据源)
    │   ├── dom.js           # $ / esc
    │   ├── format.js        # bytes/speed/size/label
    │   ├── platform.js      # 平台适配
    │   ├── errors.js        # 全局错误边界
    │   └── events.js        # IPC 事件订阅
    ├── components/          # UI 组件
    │   ├── toast.js
    │   └── modal.js
    ├── pages/               # 页面模块
    │   ├── nav.js
    │   ├── titlebar.js
    │   ├── search.js
    │   ├── downloads.js
    │   ├── settings.js
    │   └── library.js
    ├── index.html           # 入口 HTML
    ├── style.css
    └── assets/
```

### 主进程职责

- 窗口管理 (`window.js`)
- 下载任务队列 (`download-manager.js`)
- 搜索 (`search.js`): HTTPS + HTML 解析 + 失败回退演示数据
- 配置持久化 (`config.js`): 防抖保存 250ms
- 文件系统扫描 (`library.js`)
- 日志系统 (`logger.js`): 5MB 轮转
- IPC handler (`ipc.js`): 集中注册, 统一 safe() 包装
- 菜单 (`menu.js`)
- 更新检查 (`update-checker.js`)

### 预加载 API (`window.flacMusic`)

所有方法在 `src/renderer/core/api.js` 中有 ES Module 包装, 业务代码只 import 该文件。

| 类别 | API |
|------|-----|
| 搜索 | `search(keyword, page)` |
| 下载 | `downloadAdd`, `downloadPause`, `downloadResume`, `downloadCancel`, `downloadList` |
| 配置 | `configGet`, `configSet` |
| 文件 | `chooseDir`, `revealFile`, `openDir`, `libraryScan` |
| 系统 | `systemInfo`, `updateCheck`, `openExternal` |
| 窗口 | `windowMin`, `windowMax`, `forceQuit` |
| 事件 | `onTaskProgress`, `onTaskFinished`, `onNav`, `onPauseAll`, `onResumeAll`, `onClearDone`, `onConfirmClose`, `onCheckUpdate` |

事件订阅返回 `removeListener` 取消函数, 精确移除, 不误清。

## 开发命令

```bash
npm start              # 启动 Electron (含 DevTools)
npm run dev            # 同上
npm run lint           # ESLint
npm run lint:fix       # ESLint --fix
npm run format         # Prettier --write
npm run format:check   # Prettier --check
npm test               # node:test 跑所有 tests/unit/*.test.js
npm run test:integration  # tests/integration/* (含网络)
npm run build:win      # 构建 Windows
npm run build:mac      # 构建 macOS
npm run build:all      # 全平台
```

## 编码规范

### 通用
- **主进程**: CommonJS (`require` / `module.exports`)
- **渲染进程**: ES Modules (`import` / `export`)
- **严格模式**: 所有 `.js` 文件启用 `'use strict'`
- **变量命名**: camelCase, 常量 UPPER_SNAKE_CASE

### 安全性 (Electron)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- 生产模式启用完整 CSP
- URL 协议白名单 (http/https)
- 路径校验防止目录穿越 (`ipc.js` reveal-file)

### 错误处理
- IPC handler 必须包 `safe()`, 异常自动翻译 `{ ok: false, error }`
- 渲染进程有全局错误边界 (`core/errors.js`)
- 所有 IO 失败不抛, 降级 (如搜索回退 demo 数据)

### 不可变性
- 优先创建新对象 (`config.js` 的 applyUpdates 总是返回新对象)
- 避免直接修改入参

### 路径
- 使用 `path.join()` 跨平台
- 绝对路径基于 `app.getPath('userData')`

### 依赖注入
- `DownloadManager` 通过构造函数注入 logger / notify / getConfig
- 业务逻辑不直接访问 `electron` / `fs` / `https` 全局

## 下载目录结构

当 `autoOrganize: true` 时, 文件按 `{artist}/{album}/` 模式存储。

## 配置项 (存储于 `config.json`, `CONFIG_VALIDATORS` 白名单校验)

| 键 | 默认值 | 说明 |
|----|--------|------|
| `downloadDir` | `music` | 下载目录 |
| `maxConcurrent` | `3` | 最大并发下载数 (1-8) |
| `defaultFormat` | `FLAC` | 默认格式 (FLAC/WAV/MP3/AAC/APE/DSD) |
| `defaultQuality` | `24bit/96kHz` | 默认音质 |
| `autoWriteMetadata` | `false` | 自动写入元数据 |
| `autoOrganize` | `true` | 自动归类 |
| `windowBounds` | `{width:1160,height:780}` | 窗口尺寸 |

未知 key 或非法 value 会被 `config.applyUpdates` 拒绝, 不会静默丢弃。

## 下载机制

- **断点续传**: 检查 `.part` 文件, 使用 `Range: bytes=N-` 续传
- **魔数验证**: FLAC/WAV/MP3/AAC/APE/DSD 文件头校验
- **自动重试**: 最多 3 次, 指数退避 (2s/5s/15s)
- **暂停超时**: 5 分钟未恢复自动取消
- **演示模式**: `demo://` URL 触发模拟下载

## 测试

```
tests/
├── unit/                   # 单元测试, 不依赖 Electron / 网络
│   ├── config.test.js
│   ├── download-manager.test.js
│   ├── download-manager-helpers.test.js
│   ├── search.test.js
│   ├── update-checker.test.js
│   └── renderer-format.test.js
└── integration/            # 集成测试, 可含网络
```

### 覆盖目标
- **主进程纯函数**: 100% (config, search 解析, format, compareVersions)
- **DownloadManager 辅助函数**: 100% (sanitize, verifyMagic)
- **关键 IPC handler**: 集成测试覆盖
- **渲染进程纯函数**: 通过动态 `import()` 测

## CI/CD

`.github/workflows/ci.yml` 在 push / PR 时:
- 多 Node 版本 (20, 22)
- 跑 `format:check` + `lint` + `test` + `test:integration`

## 文档

- `docs/architecture.md` — 整体架构与通信协议
- `docs/main-process.md` — 主进程开发指南
- `docs/renderer-process.md` — 渲染进程开发指南
- `docs/team-tech-elevation-playbook.md` — 团队技术能力提升 Playbook

## 注意事项

- 本项目为中文 UI
- 搜索默认回退到 `demo://` 数据, 无真实 API 时不影响调试
- 窗口关闭时若有进行中任务, 弹确认对话框
- 单实例锁
- 日志文件位于 `app.getPath('userData')/app.log`, 5MB 轮转
- 添加新功能时: 先看 `docs/architecture.md` 确认通信协议, 再写代码
