# 主进程开发指南

> 主进程负责所有"有副作用"的事: 窗口、IO、网络、菜单、IPC。

## 模块职责

| 模块 | 职责 | 关键导出 |
|------|------|---------|
| `index.js` | app 生命周期、单实例锁、模块装配 | (入口) |
| `constants.js` | 路径、魔数、配置 schema、下载参数 | 所有常量 |
| `config.js` | config.json 加载/防抖保存/校验 | `get`, `applyUpdates`, `flush` |
| `logger.js` | 控制台 + 文件双写 + 体积轮转 | `info`, `warn`, `error` |
| `download-manager.js` | 任务队列、断点续传、魔数校验、重试 | `DownloadManager` |
| `search.js` | HTTPS 搜索 + HTML 解析 + demo 回退 | `searchMusic` |
| `library.js` | 递归扫描下载目录 | `scan` |
| `update-checker.js` | GitHub Releases API + 版本比较 | `check`, `compareVersions` |
| `window.js` | 窗口创建 + 关闭守卫 | `create`, `attachCloseGuard`, `get` |
| `menu.js` | 菜单模板 | `build` |
| `ipc.js` | 全部 IPC handler 集中注册 | `register` |

## 添加新 IPC handler

```js
// 1. main/ipc.js 中加 handler
ipcMain.handle('my-new-action', safe(async (_e, arg) => {
  // 业务逻辑...
  return { ok: true, data: result };
}));

// 2. preload.js 中暴露
contextBridge.exposeInMainWorld('flacMusic', {
  myNewAction: (arg) => ipcRenderer.invoke('my-new-action', arg),
});

// 3. renderer/core/api.js 中包装
export const myNewAction = (arg) => api?.myNewAction(arg);

// 4. 业务模块使用
import { myNewAction } from '../core/api.js';
const r = await myNewAction({ foo: 'bar' });
```

**约定**:
- handler 必须包 `safe()`, 异常自动翻译成 `{ ok: false, error }`
- 通道名用 `kebab-case` (与现有 `download-add` 等一致)
- 返回值统一带 `ok: boolean`, 错误带 `error: string`

## 添加新配置项

```js
// 1. main/constants.js 加 schema
const CONFIG_VALIDATORS = Object.freeze({
  // ...existing...
  myNewKey: (v) => typeof v === 'string' && v.length <= 100,
});
const DEFAULT_CONFIG = Object.freeze({
  // ...existing...
  myNewKey: 'default-value',
});

// 2. UI 中: renderer 调用
await configSet({ myNewKey: 'new-value' });
// → 走 applyUpdates → 校验 → 防抖落盘

// 3. 主进程读取
const c = config.get();
console.log(c.myNewKey);
```

## 添加新下载状态

`DownloadManager` 的状态机是字符串: `queued | downloading | paused | done | failed`

如需新增状态, 同步修改:
1. `download-manager.js` 中所有相关分支
2. `renderer/pages/downloads.js` 中 `taskActionsHTML()` 的按钮渲染
3. `renderer/core/format.js` 中 `STATUS_LABELS` 文案
4. `renderer/pages/downloads.js` 中 `events.js` 的进度事件翻译

## DownloadManager 依赖注入约定

```js
new DownloadManager({
  // 必须: 通知 UI 任务变化
  notify: (task) => mainWindow.webContents.send('task-progress', task),

  // 必须: 读取最新配置 (用于 autoOrganize 路径)
  getConfig: () => config.get(),

  // 可选: 日志 (默认 console)
  logger: log,

  // 可选: 自定义 fs/https (测试桩)
  // fs: ..., https: ...,

  // 可选: 并发数 (默认从 getConfig().maxConcurrent)
  maxConcurrent: 3,
});
```

**警告**: 不要在 `DownloadManager` 内部直接 require `electron` 或读全局变量, 否则无法测试。

## 错误处理约定

- IO / 网络错误: 静默降级 + 写日志 (例如搜索失败 → demo 数据)
- 用户操作错误: 弹 Toast (通过 IPC 推送到渲染进程)
- 配置错误: `config.applyUpdates` 立即拒绝, 返回 `{ ok: false, error }`
- 下载错误: 任务标记 `failed` + 错误信息, 写入日志
