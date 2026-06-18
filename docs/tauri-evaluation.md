# Tauri vs Electron — 跨平台方案评估

> 评估时间: 2026-06-17
> 评估员: Senior Developer
> 现状: Electron 31/42 桌面应用 (Windows + macOS)

## 1. 为什么评估 Tauri

用户群持续增长, 客户反馈:
- 安装包 100MB+ (Chromium 内嵌), 移动带宽差的环境下下载痛苦
- 启动慢 (冷启动 2-3s)
- 内存占用高 (空闲 200-300MB)

需要评估: **Tauri 2.0** 能否作为下一代跨平台方案。

## 2. Tauri 核心优势

| 维度 | Tauri 2.0 | Electron (现状) | 差距 |
|------|-----------|-----------------|------|
| 安装包体积 | 2-10 MB | 80-150 MB | **10-15x** |
| 冷启动 | 0.3-0.8s | 1.5-3s | **3-4x** |
| 空闲内存 | 30-80 MB | 200-300 MB | **4-6x** |
| 渲染引擎 | 系统 WebView (Edge/WebKit2) | Chromium 内嵌 | 不需要打包 |
| 后端 | Rust | Node.js | Rust 性能 + 安全 |
| 移动端 | Tauri 2.0 已稳定支持 iOS/Android | 不支持 | **关键优势** |

## 3. 关键挑战

### 3.1 WebView 兼容性

- **Windows**: Edge WebView2 (>= Win10 1809) — 覆盖 95%+ 用户
- **macOS**: WebKit (>= 10.15) — 覆盖 99% 用户
- **Linux**: webkit2gtk (发行版碎片化, 体验差)
- **iOS/Android**: WKWebView / WebView — 需 Tauri 2.0+

**风险**: 不同 WebView 对 CSS/JS 标准的支持差异, 必须做端到端测试。

### 3.2 项目改造成本

**必须重写**:
- 主进程 (Electron → Rust)
- IPC 协议 (ipcRenderer/invoke → Tauri commands)
- preload (contextBridge → Tauri JS API)
- 更新器 (electron-updater → Tauri updater)
- 自动更新 + 代码签名

**可复用**:
- 渲染进程 100% (HTML/CSS/JS 不变)
- 业务逻辑 (搜索 / 下载 / 库) — 移到 Rust crate
- 测试 (单元测试 + 集成测试)

**预计工时**: 4-6 周 (1 个 Rust 熟手 + 1 个前端)

### 3.3 团队技能缺口

| 技能 | 现状 | Tauri 所需 | 差距 |
|------|------|-----------|------|
| Rust | 0 人 | ≥1 人熟练 | **大** |
| 系统级 WebView | 0 | 经验 | 中 |
| Cargo 生态 | 0 | 熟悉 | 中 |
| Tauri plugin 开发 | 0 | 了解 | 小 |

## 4. POC 计划 (1-2 周)

### 4.1 阶段 1: 验证基础 (1 周)

- [ ] **Day 1-2**: 创建 tauri-music-poc 项目, 跑通 helloworld
- [ ] **Day 3-4**: 把现有 renderer (HTML/CSS/JS) 跑在 Tauri WebView 中
- [ ] **Day 5**: 验证 IPC 通信 (search → 后端 → 返回)
- [ ] **Day 6-7**: 写一份对比报告: 启动时间 / 内存 / 体积

### 4.2 阶段 2: 核心功能迁移 (1 周)

- [ ] 移植 download-manager (Rust 实现 HTTP 下载 + 断点续传)
- [ ] 移植 search (Rust + reqwest + scraper)
- [ ] 移植 config (Rust + serde)
- [ ] 移植 logger (Rust + tracing)
- [ ] 端到端测试: 搜索 → 下载 → 完成

### 4.3 决策点 (Week 2 末)

- [ ] 性能数据是否达预期?
- [ ] 团队是否能快速上手?
- [ ] 跨平台 (iOS/Android) 是否真有必要?

## 5. 决策矩阵

| 方案 | 启动 | 体积 | 内存 | 开发成本 | 跨平台 | 风险 |
|------|------|------|------|----------|--------|------|
| **保持 Electron** | 慢 | 大 | 高 | 低 (现状) | 桌面 | 无 |
| **Tauri 2.0 迁移** | 快 | 小 | 低 | 中 (4-6 周) | 全平台 | WebView 差异 |
| **Tauri + Web 渐进** | 快 | 小 | 低 | 中 (4-6 周) | 全平台 | 同上 |
| **PWA 渐进增强** | 取决于浏览器 | 0 | 中 | 低 (1-2 周) | 全平台 | 桌面集成弱 |

## 6. 推荐路径

### 短期 (本季度, 已完成)
- ✅ 维持 Electron, 持续优化 (本次执行 30 项优化)
- ✅ 加 Dependabot, 跟 Electron 主版本升级

### 中期 (Q3)
- 启动 **Tauri POC** (1-2 周), 不动产线
- 决策: 是否用 Tauri 做 v3.0

### 长期 (Q4 视 POC 结果)
- **若 POC 通过**: 用 Tauri 重写 v3.0, 支持移动端
- **若 POC 失败**: 持续优化 Electron, 评估 Web 版本

## 7. 不要做的事

- ❌ **不要立即迁移** — 没有验证数据前, 4-6 周投入是高风险赌博
- ❌ **不要用 webview2 polyfill 假装 WebView 一致** — 用户体验会出微妙 bug
- ❌ **不要放弃 Electron** — 业务成熟期不应承担迁移风险
- ❌ **不要低估 Rust 学习曲线** — 团队需要 1-2 月培训才能产出代码

## 8. 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Tauri WebView 与 Chromium CSS 差异 | 高 | 中 | POC 阶段覆盖所有 UI 路径 |
| Rust 招聘困难 | 中 | 高 | 培训现有后端转 Rust, 或外包 |
| Tauri 2.0 移动端稳定性 | 中 | 中 | 推迟移动端, 先桌面 |
| 迁移中断业务 | 中 | 高 | 分阶段迁移, 灰度发布 |

## 9. 结论

✅ **不立即迁移**, 但启动 POC 验证。
本季度交付 30 项 Electron 优化 (本次执行)。
下季度用 1-2 周做 Tauri POC, 决策 v3.0 技术栈。

执行人: Senior Developer
状态: 已文档化, 待排期
