# 架构总览

> **版本**: 适用于重构后的 v2.5.0+
> **目标读者**: 新加入的开发者、code review 时的参照

## 1. 分层模型

FLAC Music 是 Electron 应用, 天然分两个进程, 通过 IPC 通信:

```
┌──────────────────────────────────────────────────────────────────┐
│                      渲染进程 (Renderer)                          │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Search  │  │Downloads│  │ Settings │  │  Library │  ← UI 页面  │
│  └────┬────┘  └────┬────┘  └─────┬────┘  └────┬─────┘            │
│       │            │             │            │                   │
│  ┌────▼────────────▼─────────────▼────────────▼─────┐            │
│  │  core/* (state, api, format, dom, errors, ...)    │ ← 共享层  │
│  └────────────────────┬─────────────────────────────┘            │
│                       │  通过 window.flacMusic (preload bridge)   │
└───────────────────────┼──────────────────────────────────────────┘
                        │  ipcRenderer.invoke / .on
┌───────────────────────▼──────────────────────────────────────────┐
│                      预加载 (Preload)                              │
│   contextBridge.exposeInMainWorld('flacMusic', { ... })          │
└───────────────────────┬──────────────────────────────────────────┘
                        │  ipcMain.handle / webContents.send
┌───────────────────────▼──────────────────────────────────────────┐
│                      主进程 (Main)                                 │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌────────────┐         │
│  │   ipc.js │  │ window │  │   menu   │  │  search /  │         │
│  │ handlers │  │  .js   │  │   .js    │  │  library / │         │
│  └────┬─────┘  └────────┘  └──────────┘  │  update-   │         │
│       │                                  │  checker   │         │
│  ┌────▼─────────────┐  ┌─────────────────▼──────────┐            │
│  │ DownloadManager  │  │  config.js  +  logger.js   │            │
│  │ (依赖注入)        │  │  (持久化 + 日志)            │            │
│  └──────────────────┘  └────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │  操作系统 / 文件系统  │
              │  / Network (HTTPS)   │
              └──────────────────────┘
```

## 2. 目录结构

```
src/
├── main.js                  # 主进程入口 (薄包装)
├── preload.js               # 预加载脚本 (contextBridge)
├── main/                    # 主进程模块
│   ├── index.js             # app 生命周期编排
│   ├── constants.js         # 共享常量
│   ├── config.js            # 配置读写
│   ├── logger.js            # 文件日志
│   ├── download-manager.js  # 下载队列 (核心)
│   ├── search.js            # 搜索 (HTTPS + HTML 解析)
│   ├── library.js           # 音乐库扫描
│   ├── update-checker.js    # GitHub 更新检查
│   ├── window.js            # 窗口创建
│   ├── menu.js              # 应用菜单
│   └── ipc.js               # IPC handler 注册
└── renderer/                # 渲染进程 (ES Modules)
    ├── app.js               # 入口 (顺序初始化)
    ├── core/                # 共享层
    │   ├── api.js           # preload bridge 包装
    │   ├── state.js         # 全局 state
    │   ├── dom.js           # DOM 工具 ($, esc)
    │   ├── format.js        # 格式化 (bytes/speed/size/label)
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
    └── style.css            # 全局样式
```

## 3. 通信协议

### 3.1 渲染 → 主进程 (request/response)

```js
// renderer (通过 preload 暴露的 API)
const tasks = await window.flacMusic.downloadAdd(tracks);

// preload.js
contextBridge.exposeInMainWorld('flacMusic', {
  downloadAdd: (tracks) => ipcRenderer.invoke('download-add', tracks),
});

// main/ipc.js
ipcMain.handle('download-add', safe((_e, tracks) => {
  const tasks = downloadManager.add(tracks);
  return { ok: true, tasks };
}));
```

**规范**:
- 通道名用 `kebab-case`
- 参数: 标量或纯 JSON (无函数、Buffer)
- 返回: `{ ok, ...data }` 或 `{ ok: false, error: string }`
- handler 内部必须 `try-catch`, 通过 `safe()` 包装统一捕获

### 3.2 主 → 渲染 (push event)

```js
// main
mainWindow.webContents.send('task-progress', { id, progress, ... });

// preload
const h = (_, d) => cb(d);
ipcRenderer.on('task-progress', h);
return () => ipcRenderer.removeListener('task-progress', h); // 精确取消

// renderer
const off = onTaskProgress((data) => { ... });
off(); // 取消订阅
```

**规范**:
- 事件名用 `kebab-case`
- 必须用具名 handler + `removeListener`, 不要用一次性匿名 (会误清)

## 4. 依赖注入 (测试性的关键)

主进程模块, 特别是 `DownloadManager`, 通过构造函数注入副作用:

```js
// production
new DownloadManager({
  logger: log,
  getConfig: config.get,
  notify: (task) => mainWindow.webContents.send('task-progress', task),
});

// test
new DownloadManager({
  logger: { info: spy, warn: spy, error: spy },
  getConfig: () => ({ maxConcurrent: 5 }),
  notify: spy,
});
```

这样业务逻辑能脱离 Electron / 真实 IO 跑测试。

## 5. 数据流

### 5.1 用户搜索

```
UI 输入
  → search.js: doSearch()
  → api.search(kw)
  → preload 转发
  → ipc.js: search handler
  → main/search.js: searchMusic()
  → HTTPS GET → 解析 HTML/JSON
  → 失败时回退 demo 数据 + warning
  → results 返回 UI
  → renderTrackRows() 增量渲染
```

### 5.2 用户下载

```
UI 点击 ↓ 下载
  → search.js: startBatchDownload()
  → api.downloadAdd(tracks)
  → main: DownloadManager.add() 分配 id, 入队
  → DownloadManager.flush() 启动 concurrent 个
  → 每个任务: https.get + Range 头
  → 进度回调 → webContents.send('task-progress')
  → renderer events.js: 更新卡片 (增量)
  → 完成 → webContents.send('task-finished')
  → UI Toast 提示
```

## 6. 测试策略

| 类型 | 工具 | 覆盖 |
|------|------|------|
| 单元 | node:test | config, logger, search 解析, format, dom, update-checker, DownloadManager 辅助函数 |
| 集成 | node:test | (规划中) DownloadManager 端到端 + 真实 HTTPS |
| 静态 | ESLint Standard | 所有 src/ |
| 风格 | Prettier | 所有 src/ |

## 7. 演进方向

- **集成测试**: 用临时目录 + nock stub 网络, 跑 DownloadManager 真实 IO
- **TypeScript**: 渐进式, 先给 main/ 加 JSDoc + @type
- **打包优化**: 主进程和渲染进程分别打 bundle, 减小体积
- **日志分级**: logger 加 DEBUG/INFO/WARN/ERROR, 配置文件控制
