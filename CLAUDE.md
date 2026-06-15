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
| HTTP 客户端 | axios 1.7.0 |
| HTML 解析 | cheerio 1.0.0 |
| 平台 | Node.js（主进程）, 原生 JS（渲染进程） |

## 架构

```
src/
├── main.js          # Electron 主进程（窗口、下载队列、IPC、菜单）
├── preload.js       # 预加载脚本（contextBridge API 暴露）
└── renderer/
    ├── index.html   # 主页面
    ├── app.js       # 渲染进程逻辑
    └── style.css    # 样式
```

### 主进程职责
- 窗口管理与生命周期
- 下载任务队列（`DownloadManager` 类，支持暂停/恢复/取消）
- 搜索模块（HTTP 请求 + HTML 解析）
- 配置持久化（JSON 文件存储于 `app.getPath('userData')`）
- IPC 处理器（search, download-*, config-*, choose-dir 等）
- 系统托盘与菜单

### 预加载 API（`window.flacMusic`）
- `search(keyword, page)` → 搜索音乐
- `downloadAdd/tracks)`, `downloadPause(id)`, `downloadResume(id)`, `downloadCancel(id)`, `downloadList()` → 下载管理
- `configGet()`, `configSet(updates)` → 配置读写
- `chooseDir()`, `revealFile(fp)`, `openDir()` → 文件操作
- `systemInfo()` → 系统信息
- 事件: `onTaskProgress`, `onTaskFinished`, `onNav`, `onPauseAll`, `onResumeAll`, `onClearDone`, `onConfirmClose`, `onCheckUpdate`

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
- **上下文隔离**: `contextIsolation: true`, `nodeIntegration: false`
- **安全性**: 生产模式禁用 `webSecurity: false`，仅开发模式启用 DevTools
- **不可变性**: 优先创建新对象，避免直接修改输入数据
- **错误处理**: 所有 IPC handler 和异步操作均有 try-catch
- **文件路径**: 使用 `path.join()` 跨平台拼接，避免硬编码分隔符
- **窗口大小**: 最小 900×640，默认 1160×780

## 下载目录结构

当 `autoOrganize: true` 时，文件按 `{artist}/{album}/` 模式存储。

## 配置项（存储于 `config.json`）

| 键 | 默认值 | 说明 |
|----|--------|------|
| `downloadDir` | `music` | 下载目录 |
| `maxConcurrent` | `3` | 最大并发下载数 |
| `defaultFormat` | `FLAC` | 默认格式 |
| `defaultQuality` | `24bit/96kHz` | 默认音质 |
| `autoWriteMetadata` | `true` | 自动写入元数据 |
| `autoOrganize` | `true` | 自动归类 |
| `organizePattern` | `{artist}/{album}` | 归类模式 |
| `theme` | `dark` | 主题 |
| `language` | `zh-CN` | 语言 |
| `windowBounds` | `{width:1160,height:780}` | 窗口尺寸 |

## CI/CD

- 位于 `.nezha/config.toml`，nezha 自动化配置

## 注意事项

- 本项目为中文 UI
- 搜索默认回退到模拟数据（`demo://` 协议），无真实 API 时不影响调试
- 下载任务在窗口关闭时若仍有进行中任务，会弹出确认对话框
- 单实例锁：同时只允许运行一个实例