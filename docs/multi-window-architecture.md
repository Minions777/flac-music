# 多窗口 / 工作区支持 — 架构评估

> 评估时间: 2026-06-17
> 评估员: Senior Developer
> 目标场景: 支持"多任务并行 + 独立音乐库"工作区

## 1. 业务需求

| 场景 | 描述 | 优先级 |
|------|------|------|
| 任务并行 | 用户同时下载 3 张专辑, 每张专辑用独立窗口追踪 | P1 |
| 库隔离 | 古典 / 流行 / 工作用 3 个独立库目录 | P2 |
| 状态独立 | A 窗口暂停不影响 B 窗口 | P1 |
| 资源限制 | 整体并发仍受 maxConcurrent 限制 (如 3 个) | P0 |

## 2. 现状分析

**单窗口架构** (`src/main/window.js`):
- 单 `BrowserWindow` 实例
- `state.tasks` 是渲染进程单例, 不支持多窗口共享
- `DownloadManager` 在主进程, 跨窗口可见 (单实例)

**问题**:
- 渲染进程 state 单例 → 第二个窗口会共享同一份 state, 不隔离
- IPC channel 不分窗口 → task-progress 广播到所有窗口, 可能干扰

## 3. 候选方案

### 方案 A: 独立窗口 + 独立 renderer state ⭐ 推荐

```
Main Process
  ├─ DownloadManager (单例, 跨窗口共享任务)
  └─ 多个 BrowserWindow
       ├─ Window A (renderer state A)
       ├─ Window B (renderer state B)
       └─ Window C (renderer state C)
```

**实现**:
- 主进程 `DownloadManager` 改造: 每任务带 `windowId`
- IPC channel 改用 `task-progress:<windowId>` 限定窗口
- 渲染进程 state 按 windowId 隔离
- `webContents.id` 作为 windowId

**优势**: 改动小, 复用现有 90% 代码
**劣势**: state 隔离需要谨慎, 不能用 module-level singleton

**预计工时**: 5-7 天

### 方案 B: WebContentsView 嵌入式

```
Main Window (主窗口)
  ├─ Sidebar / Nav
  └─ ContentArea: 多个 WebContentsView (工作区)
       ├─ View 1 (search/downloads/library)
       ├─ View 2
       └─ View 3
```

**优势**: 共享 chrome, 内存占用小
**劣势**: 复杂的视觉切换, 移动 / 拖拽工作区困难

**预计工时**: 10-14 天

### 方案 C: 多 BrowserWindow 跨标签 (浏览器风格)

```
Main Window
  ├─ TabBar
  └─ BrowserWindow (隐藏, 用于渲染)
       ├─ Tab 1 → BWindow A
       └─ Tab 2 → BWindow B
```

**优势**: 用户体验接近 Chrome
**劣势**: 实现复杂, 内存开销大 (隐藏窗口仍占内存)

**预计工时**: 14-21 天

## 4. 推荐方案: A (独立窗口 + 隔离 state)

### 4.1 改造点

| 文件 | 改造内容 |
|------|------|
| `src/main/window.js` | 支持创建多个 BrowserWindow, 每个带 `windowId` |
| `src/main/download-manager.js` | `add()` 接收 `windowId` 参数, 任务带 `windowId` 字段 |
| `src/main/ipc.js` | IPC 携带 `event.sender.id` (webContentsId) 识别来源窗口 |
| `src/preload/system.js` | 暴露 `getWindowId()` 给渲染进程 |
| `src/renderer/core/state.js` | 移除 module-level singleton, 改为 IIFE / 工厂 |
| `src/renderer/core/dom.js` | 同上, 工具模块避免全局污染 |

### 4.2 兼容性策略

- 保留 `state` 作为默认 window 的"主 state"
- 新增 `stateMap: Map<windowId, state>`
- 单窗口用户无感升级
- 多窗口用户走 `stateMap.get(windowId)`

### 4.3 风险与缓解

| 风险 | 缓解 |
|------|------|
| state 隔离漏掉 | 写一份 integration test 验证 2 窗口的 state 不互相影响 |
| 任务串扰 (A 取消 B 的任务) | 主进程 IPC handler 校验 `task.windowId === event.sender.id` |
| 内存膨胀 (多窗口) | webPreferences 加 `backgroundThrottling: true` |
| 关闭协调 | 最后一个窗口关闭才 `app.quit()` |

## 5. 实施路径 (5-7 天)

- [ ] D1: 文档 + 设计 review
- [ ] D2: 主进程 `windowId` 注入 + IPC 隔离
- [ ] D3: DownloadManager 任务带 windowId
- [ ] D4: 渲染进程 state 工厂化
- [ ] D5: 多窗口 lifecycle (menu / close guard / second-instance)
- [ ] D6: integration test 覆盖 2 窗口场景
- [ ] D7: 文档更新 + 团队 Code Review

## 6. 不实施 (本季度)

本季度聚焦 P0/P1 性能与安全, 多窗口作为 **下季度** 路线图项目。
本评估仅作技术预研, 不进入实际开发排期。

## 7. 结论

✅ **方案 A 是最优**, 但推迟到下季度。
本周可先在 issue tracker 创建 epic, 列入 backlog。
