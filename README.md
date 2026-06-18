<div align="center">

# 🎵 FLAC Music

**高品质音乐批量下载客户端**

[![CI](https://github.com/Minions777/flac-music/actions/workflows/ci.yml/badge.svg)](https://github.com/Minions777/flac-music/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-42-blueviolet.svg)](https://www.electronjs.org/)

一个基于 Electron 构建的跨平台桌面应用，支持批量搜索和下载高品质 FLAC 音乐。

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [开发指南](#-开发指南) · [架构概览](#-架构概览) · [贡献指南](#-贡献指南)

</div>

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🔍 **智能搜索** | 关键词搜索音乐，支持防抖输入和搜索历史 |
| 📥 **批量下载** | 并发下载队列，支持暂停/恢复/取消，实时进度显示 |
| 🎶 **音乐库** | 本地音乐文件扫描与管理 |
| 🎨 **主题切换** | 亮色 / 暗色 / 跟随系统，一键切换 |
| 🖱️ **拖拽排序** | 下载任务支持拖拽排序和状态分组视图 |
| ⌨️ **快捷键** | 丰富的键盘快捷键，提升操作效率 |
| 📋 **虚拟列表** | 1000+ 项流畅滚动，60fps 不卡顿 |
| 🌐 **跨平台** | 支持 Windows (x64) 和 macOS (x64 / arm64) |
| 🔒 **安全** | CSP 内容安全策略、日志轮转、最小权限 preload |

## 📸 界面预览

<div align="center">

```
┌─────────────────────────────────────────────────────────┐
│  🎵 FLAC Music                              ☀️ ─ □ ✕   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  🔍 搜索音乐...                          [搜索]  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ♪ 歌曲名称 - 歌手名                    [下载]  │    │
│  │  ♪ 歌曲名称 - 歌手名                    [下载]  │    │
│  │  ♪ 歌曲名称 - 歌手名                    [下载]  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [搜索]  [下载]  [音乐库]  [设置]                      │
└─────────────────────────────────────────────────────────┘
```

</div>

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 20.0.0
- **npm** ≥ 9.0.0
- **Git**

### 安装

```bash
# 克隆仓库
git clone https://github.com/Minions777/flac-music.git
cd flac-music

# 安装依赖
npm install
```

### 运行

```bash
# 开发模式（带 DevTools）
npm run dev

# 生产模式
npm start
```

### 构建

```bash
# 构建 Windows 安装包 (NSIS + Portable)
npm run build:win

# 构建 macOS 安装包 (DMG + ZIP)
npm run build:mac

# 构建全部平台
npm run build:all
```

构建产物输出到 `dist/` 目录。

## 🛠️ 开发指南

### 项目脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 启动应用 |
| `npm run dev` | 开发模式启动 |
| `npm test` | 运行单元测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | 检查代码格式 |
| `npm run size` | 包体积检查 |
| `npm run release` | 发布新版本 (release-it) |

### 测试

```bash
# 运行所有单元测试
npm test

# 生成 HTML 覆盖率报告
npm run test:coverage:html

# 查看覆盖率报告
open coverage/index.html
```

当前测试状态：
- **17 个测试文件，137 个测试用例**
- **行覆盖率** 73.78% / **分支覆盖率** 79.72%
- **Lint**: 0 error / 15 warn (console 语句，预期行为)

### 代码规范

项目使用以下工具保证代码质量：

- **ESLint** — 代码静态分析 (Standard 配置)
- **Prettier** — 代码格式化
- **EditorConfig** — 编辑器统一配置
- **commitlint** — Git 提交信息规范 (Conventional Commits)
- **Husky** — Git hooks 自动化

提交信息格式：
```
<type>(<scope>): <subject>

# 示例
feat(search): 添加搜索防抖功能
fix(download): 修复并发下载进度显示错误
docs(readme): 更新项目文档
```

## 🏗️ 架构概览

FLAC Music 采用 Electron 标准的三进程架构：

```
┌──────────────────────────────────────────────────────────┐
│                   渲染进程 (Renderer)                      │
│   pages/* (search, downloads, library, settings)          │
│   core/*  (state, api, format, dom, errors, events)       │
│   components/* (toast, modal)                             │
└─────────────────────────┬────────────────────────────────┘
                          │ window.flacMusic (preload bridge)
┌─────────────────────────▼────────────────────────────────┐
│                   预加载脚本 (Preload)                     │
│   contextBridge.exposeInMainWorld('flacMusic', { ... })  │
│   5 个业务域: searches / downloads / config / files / sys │
└─────────────────────────┬────────────────────────────────┘
                          │ ipcMain.handle / webContents.send
┌─────────────────────────▼────────────────────────────────┐
│                   主进程 (Main)                            │
│   index.js (生命周期)  config.js  logger.js               │
│   download-manager.js  search.js  library.js              │
│   update-checker.js  window.js  menu.js  ipc.js           │
└──────────────────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── main.js                  # 主进程入口
├── preload.js               # 预加载脚本 (5 域聚合)
├── main/                    # 主进程模块 (14 个)
│   ├── index.js             # app 生命周期
│   ├── config.js            # 配置读写
│   ├── logger.js            # 日志 (5MB×10 轮转)
│   ├── download-manager.js  # 下载队列 (核心)
│   ├── search.js            # 搜索 (HTTPS + HTML 解析)
│   └── ...
└── renderer/                # 渲染进程 (ES Modules)
    ├── app.js               # 入口
    ├── core/                # 共享层 (14 个模块)
    ├── pages/               # 页面 (6 个)
    ├── components/          # UI 组件
    ├── index.html           # 入口 HTML
    └── style.css            # 全局样式
```

更多架构细节请参阅 [docs/architecture.md](docs/architecture.md)。

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 42 |
| 主进程 | Node.js (CommonJS) |
| 渲染进程 | Vanilla JS (ES Modules) |
| 构建 | electron-builder |
| 测试 | node:test + c8 |
| CI/CD | GitHub Actions |
| 包管理 | npm |

## 📁 文档

| 文档 | 说明 |
|------|------|
| [architecture.md](docs/architecture.md) | 整体架构详解 |
| [main-process.md](docs/main-process.md) | 主进程模块说明 |
| [renderer-process.md](docs/renderer-process.md) | 渲染进程模块说明 |
| [preload-audit.md](docs/preload-audit.md) | Preload API 安全审计 |
| [project-health-audit.md](docs/project-health-audit.md) | 项目健康度审计 |
| [team-tech-elevation-playbook.md](docs/team-tech-elevation-playbook.md) | 团队技术提升手册 |
| [tauri-evaluation.md](docs/tauri-evaluation.md) | Tauri 迁移评估 |
| [multi-window-architecture.md](docs/multi-window-architecture.md) | 多窗口架构方案 |

## 🤝 贡献指南

欢迎贡献代码！请遵循以下流程：

1. **Fork** 本仓库
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 提交代码：`git commit -m "feat: add your feature"`
4. 推送分支：`git push origin feat/your-feature`
5. 创建 **Pull Request**

### 开发规范

- 遵循 Conventional Commits 提交规范
- 新功能需附带单元测试
- 确保 `npm test` 和 `npm run lint` 通过
- PR 描述中说明改动原因和方案

## 📄 许可证

[MIT](LICENSE) © 2025 FLAC Music Team

---

<div align="center">

**[⬆ 回到顶部](#-flac-music)**

</div>
