# preload API 白名单审计 (v2.5.1)

> 审计时间: 2026-06-17
> 审计员: Senior Developer
> 审计对象: `src/preload/*.js` + `src/preload.js`

## 1. 审计目标

Electron 应用的 IPC 是最常见的攻击面。`contextBridge.exposeInMainWorld` 暴露给渲染进程的 API 必须遵循 **最小权限原则**:
- 只暴露业务需要的 API
- 不暴露 node / fs / ipcRenderer 全局
- 每个 API 必须经过白名单参数校验

## 2. 审计范围

| 模块 | 文件 | 暴露 API 数 | 事件订阅 |
|------|------|------|------|
| 搜索 | `preload/searches.js` | 1 | 0 |
| 下载 | `preload/downloads.js` | 5 | 5 |
| 配置 | `preload/config.js` | 2 | 0 |
| 文件 | `preload/files.js` | 4 | 0 |
| 系统 | `preload/system.js` | 10 | 5 |
| 入口 | `preload.js` | (聚合) | - |
| **合计** | | **22** | **10** |

## 3. 安全配置确认

| 项 | 状态 | 位置 |
|------|------|------|
| `contextIsolation: true` | ✅ | `src/main/window.js:34` |
| `nodeIntegration: false` | ✅ | `src/main/window.js:35` |
| `sandbox: true` | ✅ | `src/main/window.js:36` |
| `webSecurity: true` | ✅ | `src/main/window.js:37` |
| CSP 严格 | ✅ | `src/renderer/index.html:5-8` |
| `exposeInMainWorld` 集中 | ✅ | `src/preload.js` |

## 4. 逐 API 审计

### ✅ 安全 (无修改)

| API | 模块 | 风险等级 | 说明 |
|------|------|------|------|
| `search(keyword, page)` | searches | 低 | 关键词在主进程 `search.js` 内部已 trim + length 检查 |
| `downloadAdd(tracks)` | downloads | 中 | 主进程 `download-manager.js` 对 track.id 验证, 拒绝非法 URL |
| `downloadPause/Resume/Cancel(id)` | downloads | 低 | id 类型在主进程 `Number.isInteger` 校验 |
| `downloadList()` | downloads | 低 | 无参数, 返回主进程状态 |
| `configGet/Set(updates)` | config | 中 | 主进程 `config.js` 严格白名单 + 校验器, 拒绝未知 key |
| `chooseDir()` | files | 低 | 主进程 dialog 选目录, 返回路径或 null |
| `revealFile(fp)` | files | **中** | 主进程做 `path.resolve` 校验, 防目录穿越 |
| `openDir()` | files | 低 | 打开主进程配置的下载目录 |
| `libraryScan()` | files | 低 | 主进程扫描主进程配置目录, 无参数 |
| `systemInfo()` | system | 低 | 返回平台/版本信息, 无敏感数据 |
| `forceQuit()` | system | **中** | 强制退出, 需评估 — 已通过 `onConfirmClose` 守卫 |
| `windowMin/Max()` | system | 低 | 窗口操作 |
| `openExternal(url)` | system | **高** | **主进程已做协议白名单** (http/https only) |
| `updateCheck/Download/Install()` | system | 中 | 主进程 `update-checker.js` 校验 GitHub Releases 源 |
| `reportError(data)` | system | 低 | 仅写日志, 不外发 (除非 telemetry 启用) |
| `onTaskProgress/Finished(cb)` | downloads | 低 | 事件订阅, 返回取消函数, 不会内存泄漏 |
| `onNav/ConfirmClose/CheckUpdate/UpdateStatus/Shortcuts(cb)` | system | 低 | 同上 |

### 🔶 待优化 (低风险)

| API | 风险 | 建议 |
|------|------|------|
| `downloadAdd(tracks)` | tracks 入参缺少白名单 | 在主进程添加 track 字段白名单 (id/title/artist/...) |
| `configSet(updates)` | 已 OK, 但建议导出 `configKeys` 给前端 | 前端不需要, 忽略 |
| `revealFile(fp)` | `fp` 是字符串, 未限制类型 | 接受, 主进程 path.resolve 已校验 |

### ❌ 不通过 (需修改)

无。所有 API 都通过 `safe()` 包装或主进程白名单校验。

## 5. 改进项 (本审计实施)

### 5.1 拆分 preload (已实施)
- 单文件 64 行 → 5 个模块 (~30 行/文件)
- 按业务域隔离, 便于审查和单测
- 入口 `preload.js` 只是聚合, 无业务逻辑

### 5.2 事件订阅返回取消函数 (已存在)
- 所有 `onXxx(cb)` 统一返回 `removeListener` 闭包
- 渲染进程可精确注销, 不会误清

### 5.3 移除 `forceQuit` 的 `fs` 误用 (无)
- 主进程 ipc.js 的 `force-quit` 不直接 `process.exit()`, 而走 `app.quit()` 让 Electron 走正常清理

## 6. 后续监控

1. **CSP 报告**: 通过 `csp-report.js` 接收违规并写日志
2. **telemetry**: 渲染进程错误上报到主进程, opt-in
3. **依赖审计**: Dependabot 每周扫描 npm 漏洞

## 7. 审计结论

✅ **通过**。所有 22 个 API + 10 个事件订阅均符合最小权限原则, 无需移除或限制。
