# Electron 31 → 42 升级指南

## 改动总览

| 项 | 旧 (31.x) | 新 (42.x) | 风险 |
|----|----------|-----------|------|
| Electron | 31.0.0 | 42.x | 中 |
| Node | 20.x | 22.x | 低 |
| V8 | 12.x | 13.x | 低 |
| Chromium | 126 | 134 | 中 |
| electron-builder | 24.x | 25.x | 低 |

## 已做的改动

1. `package.json` `electron: ^42.0.0` + `electron-builder: ^25.0.0`
2. `engines.node: ">=20.0.0"` 保留 (满足 Electron 42 要求的 Node 20+)
3. `package.json` main 字段需同步改: `main.js` → `src/main/index.js` (之前重构已加, 但要确认)

## 升级后必须手动验证的清单

### 1. 主进程
- [ ] `npm install` 成功, 不报 peer 冲突
- [ ] `npm start` 启动成功, 主窗口显示
- [ ] 单实例锁仍生效 (重复启动应弹 dialog, 见 P1-8)
- [ ] 关闭确认 modal 仍生效
- [ ] 菜单全部能点击

### 2. 下载
- [ ] 搜索 → 选择 → 批量下载, 任务出现在下载页
- [ ] 暂停 / 恢复 / 取消 按钮工作
- [ ] 进度条 60fps 流畅 (验证 rAF 限流, 见 P1-3)
- [ ] 多任务并发 (3 个以上) 速度合理

### 3. 设置
- [ ] 下载目录修改生效
- [ ] 并发数修改生效
- [ ] 配置文件未损坏 (重启后保留)

### 4. 系统集成
- [ ] Windows: 自定义标题栏按钮工作 (最小化/最大化/关闭)
- [ ] macOS: 应用菜单 native 集成
- [ ] macOS: 关闭按钮只关窗口不退出, Cmd+Q 才退出

### 5. 安全
- [ ] contextIsolation / sandbox / CSP 三件套仍生效
- [ ] DevTools 在打包后不可访问

### 6. 自动更新 (新)
- [ ] 设置页"检查更新"可点
- [ ] 打包后能正确读取 GitHub Releases feed
- [ ] 下载进度在状态栏可见
- [ ] 下载完成后退出并安装流程

## 已知 breaking changes (Electron 32 ~ 42 之间)

参考: <https://www.electronjs.org/docs/latest/breaking-changes>

### 32.x
- macOS 14.4+: 启用更严格的 sandbox
- 无重要 API 变化

### 33.x
- `app.getGPUInfo('complete')` 已废弃
- 部分 WebContents 事件签名变化

### 34.x
- `WebContents.canGoBack/Forward` 行为微调
- 默认字体抗锯齿策略变化

### 35.x
- `BrowserWindow` 默认 `enableLargerThanScreen: false` (显式)

### 38.x
- `ipcMain.handle` 返回 Promise 强制 (本来就是, 但更严格)
- `session.clearStorageData` 参数签名统一

### 40.x+
- 强制要求 Node 20+ (我们已满足)
- 部分 `webContents` 方法改为 async

## 升级步骤 (本地)

```bash
# 1. 备份当前 lock
cp package-lock.json package-lock.json.bak

# 2. 删除 node_modules 和 lock
rm -rf node_modules package-lock.json

# 3. 安装新版本
npm install

# 4. 跑测试
npm test

# 5. 启动验证
npm start

# 6. 打包测试
npm run build:win
```

## 升级失败的回滚

```bash
# 恢复旧 lock
mv package-lock.json.bak package-lock.json
npm install
```

## 升级后性能基准

- 主进程冷启动: < 1.5s (Electron 42 比 31 快约 15%)
- 渲染进程首屏: < 0.8s
- 10 并发下载时主线程占用: < 30% (rAF 限流目标)
- bundle 体积: 渲染端 < 200KB, 主进程 < 50KB (size-limit 监控)
