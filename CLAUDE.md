# CLAUDE.md

## 项目概述

- **项目名称**: FLAC Music
- **版本**: 2.4.1
- **类型**: Electron 桌面应用（Windows/macOS）
- **描述**: 高品质音乐批量下载客户端，支持 FLAC/MP3/WAV 等格式
- **主入口**: `src/main.js`
- **渲染进程**: `src/renderer/`（HTML + 原生 JS）

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 31.0.0 |
| 构建工具 | electron-builder 24.13.0 |
| HTTP 客户端 | Node.js 原生 `https` 模块（无第三方依赖） |
| HTML 解析 | 正则表达式（结构化解析为回退方案） |
| 平台 | Node.js（主进程）, 原生 JS（渲染进程） |

> **注意**: 项目**无运行时依赖**（`dependencies: {}`），所有 HTTP 请求与 HTML 解析均使用 Node.js 原生能力，不使用 axios/cheerio。

## 架构

```
src/
├── main.js          # Electron 主进程（窗口、下载队列、IPC、菜单、日志）
├── preload.js       # 预加载脚本（contextBridge API 暴露）
└── renderer/
    ├── index.html   # 主页面
    ├── app.js       # 渲染进程逻辑
    ├── style.css    # 样式
    └── assets/      # 静态资源
```

### 主进程职责
- 窗口管理与生命周期
- 下载任务队列（`DownloadManager` 类，支持暂停/恢复/取消、断点续传、自动重试）
- 搜索模块（HTTP 请求 + HTML 解析，失败时回退演示数据并提示）
- 配置持久化（JSON 文件存储于 `app.getPath('userData')`，防抖保存）
- 文件系统扫描（音乐库页扫描真实下载目录）
- 日志系统（写入 `app.getPath('userData')/app.log`，自动轮转 5MB）
- IPC 处理器（search, download-*, config-*, choose-dir, library-scan 等）
- 菜单

### 预加载 API（`window.flacMusic`）
- `search(keyword, page)` → 搜索音乐
- `downloadAdd(tracks)`, `downloadPause(id)`, `downloadResume(id)`, `downloadCancel(id)`, `downloadList()` → 下载管理
- `configGet()`, `configSet(updates)` → 配置读写
- `chooseDir()`, `revealFile(fp)`, `openDir()`, `libraryScan()` → 文件操作
- `systemInfo()` → 系统信息
- 事件: `onTaskProgress`, `onTaskFinished`, `onNav`, `onPauseAll`, `onResumeAll`, `onClearDone`, `onConfirmClose`, `onCheckUpdate`

> 事件取消函数使用 `removeListener` 精确移除具名 handler，不会误清除其他监听器。

## 开发命令

```bash
npm start        # 启动开发模式（含 DevTools）
npm run dev      # 同上
npm run build:win    # 构建 Windows 安装包
npm run build:mac    # 构建 macOS DMG/ZIP
npm run build:all    # 构建全平台
```

## 构建产物

- Windows: `dist/FLAC Music Setup-x.x.x.exe` (NSIS) + 便携版
- macOS: `dist/FLAC Music-x.x.x.dmg` + `.zip`

## 编码规范

- **语言**: 原生 JavaScript（无 TypeScript），遵循 Electron 惯例
- **严格模式**: 所有 `.js` 文件启用 `'use strict'`
- **上下文隔离**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **安全性**: 生产模式启用完整 CSP 策略；URL 协议白名单（http/https）；路径校验防止目录穿越
- **不可变性**: 优先创建新对象，避免直接修改输入数据
- **错误处理**: 所有 IPC handler 和异步操作均有 try-catch；渲染进程有全局错误边界
- **文件路径**: 使用 `path.join()` 跨平台拼接，避免硬编码分隔符
- **窗口大小**: 最小 900×640，默认 1160×780

## 下载目录结构

当 `autoOrganize: true` 时，文件按 `{artist}/{album}/` 模式存储。

## 配置项（存储于 `config.json`，`CONFIG_KEYS` 白名单校验）

| 键 | 默认值 | 说明 |
|----|--------|------|
| `downloadDir` | `music` | 下载目录 |
| `maxConcurrent` | `3` | 最大并发下载数 |
| `defaultFormat` | `FLAC` | 默认格式 |
| `defaultQuality` | `24bit/96kHz` | 默认音质 |
| `autoWriteMetadata` | `false` | 自动写入元数据 |
| `autoOrganize` | `true` | 自动归类 |
| `windowBounds` | `{width:1160,height:780}` | 窗口尺寸 |

> 注：`theme`、`language`、`organizePattern` 等键在当前代码中**未实现**，仅保留在概念文档中。配置项严格通过 `CONFIG_KEYS` 白名单校验，未知键会被忽略。

## 下载机制

- **断点续传**: 检查 `.part` 临时文件大小，使用 `Range: bytes=N-` 请求头续传；服务器返回 206 时追加写入，返回 200 时覆盖重传
- **魔数验证**: 下载完成后校验文件头魔数（FLAC/WAV/MP3/AAC/APE/DSD），失败则删除并标记错误
- **自动重试**: 网络错误或超时自动重试最多 3 次，指数退避（2s/5s/15s）
- **暂停超时**: 暂停超过 5 分钟自动取消任务，避免内核缓冲区堆积
- **演示模式**: `demo://` URL 触发模拟下载，方便无 API 时调试

## CI/CD

- 位于 `.nezha/config.toml`，nezha 自动化配置

## 注意事项

- 本项目为中文 UI
- 搜索默认回退到模拟数据（`demo://` 协议），无真实 API 时不影响调试；回退时会通过 toast 提示用户
- 下载任务在窗口关闭时若仍有进行中任务，会弹出确认对话框
- 单实例锁：同时只允许运行一个实例
- 日志文件位于 `app.getPath('userData')/app.log`，超过 5MB 自动清空轮转
