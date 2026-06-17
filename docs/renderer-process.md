# 渲染进程开发指南

> 渲染进程是浏览器上下文, 不能直接 require Node 模块。所有数据通过 `window.flacMusic` 桥接。

## ES Modules 加载约定

`index.html` 末尾:

```html
<script type="module" src="app.js"></script>
```

**重要**:
- 用 `import` / `export` 而非 `<script>` 链式加载
- 所有 renderer 模块用相对路径 `../core/api.js` 等
- CSP `script-src 'self'` 已经支持同源模块, 无需额外配置

## 模块分层

```
app.js (入口, 仅做 init 编排)
  ├── core/*      (无 DOM 副作用的工具与状态)
  ├── components/* (UI 组件, 可被 page 复用)
  └── pages/*     (具体页面, 包含事件绑定和业务)
```

**依赖方向**:
- `pages/*` 可以依赖 `core/*` 和 `components/*`
- `components/*` 可以依赖 `core/*`
- `core/*` 不依赖其他层
- 任何模块都不要反向依赖 (例如 core 不 import page)

## state 模式

`core/state.js` 导出唯一 `state` 对象, 整个应用共享:

```js
import { state } from '../core/state.js';

// 读
if (state.currentPage === 'downloads') { ... }

// 写 (直接 mutate, 简化数据流)
state.selectedTracks.add(trackId);
state.tasks.set(taskId, task);
```

**约定**:
- `state` 是可变对象, 业务模块直接修改字段
- 不要把派生数据放 `state` (如 `totalSpeed` 应该每次算)
- 大型对象用 `Map` / `Set` 而非 plain object (避免 key 冲突)

## IPC 事件订阅

每个 page 模块只订阅自己关心的事件, 放在 setup 函数中:

```js
import { onTaskProgress } from '../core/api.js';

export function setupMyPage() {
  onTaskProgress((data) => {
    if (data.id !== myTaskId) return; // 过滤
    // 更新 UI
  });
}
```

事件清理: preload 返回 `removeListener` 函数, 但通常页面生命周期等于应用生命周期, 不需要手动取消。

## 性能要点

### 增量更新

列表渲染采用 "diff + patch" 策略, 避免全量重建:

```js
// search.js: renderTrackRows
// 当结果集 ID 未变化时, 只切换选中态 class
if (currentIds === cachedIds) {
  // 增量: 只改 class
  rows.forEach(toggleSelected);
  return;
}
// 否则全量重建
```

### 事件委托

任务卡片的事件绑定到父容器:

```js
// downloads.js: refreshDownloadList
list.querySelectorAll('.task-card').forEach((card) => {
  // 只绑定一次, 后续 updateTaskCard 不重新绑定
  bindTaskActions(card, task);
});
```

## XSS 防护

所有插入 HTML 的字符串必须先 `esc()`:

```js
import { esc } from '../core/dom.js';

row.innerHTML = `<div title="${esc(track.title)}">${esc(track.artist)}</div>`;
```

**警告**: track.title / artist 来自网络, 绝不能直接拼接。

## Toast / Modal

复用 `components/toast.js` 和 `components/modal.js`:

```js
import { showToast } from '../components/toast.js';
import { showCloseModal } from '../components/modal.js';

showToast('下载完成', 'success', 3000);
showCloseModal(activeCount);
```

## 添加新页面

1. 在 `renderer/pages/` 创建 `mypage.js`
2. 导出 `setupMyPage()` 做事件绑定
3. 在 `renderer/app.js` 的 `init()` 中按顺序调用
4. 如果有 IPC 事件, 在 `renderer/core/events.js` 注册
5. 如果有独立样式, 集中到 `renderer/style.css` (避免散落)
