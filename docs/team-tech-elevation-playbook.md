# 资深开发工程师 · 团队技术能力提升 Playbook

> **适用范围**: FLAC Music 团队 (Electron 31 + 原生 JS)  
> **角色定位**: 高级开发工程师 (Senior Developer) — 全栈视角，工程化与质量守门人  
> **核心信念**: 卓越不是天赋，是纪律。代码质量不是终点，是过程。

---

## 目录

- [一、当前项目技术现状评估](#一当前项目技术现状评估)
- [二、资深开发工程师的工作哲学](#二资深开发工程师的工作哲学)
- [三、能力提升四象限模型](#三能力提升四象限模型)
- [四、30 天速赢计划（Quick Wins）](#四30-天速赢计划quick-wins)
- [五、90 天进阶计划（Deep Improvements）](#五90-天进阶计划deep-improvements)
- [六、180 天体系建设（Foundations）](#六180-天体系建设foundations)
- [七、代码质量标准（落地到本项目）](#七代码质量标准落地到本项目)
- [八、代码评审 Checklist](#八代码评审-checklist)
- [九、测试体系建设](#九测试体系建设)
- [十、架构演进蓝图](#十架构演进蓝图)
- [十一、工程化工具链](#十一工程化工具链)
- [十二、团队协作流程](#十二团队协作流程)
- [十三、学习资源清单](#十三学习资源清单)
- [附录 A: 编码规范细则](#附录-a-编码规范细则)
- [附录 B: Pull Request 模板](#附录-b-pull-request-模板)

---

## 一、当前项目技术现状评估

> 资深工程师的第一原则：**先诊断，再开方**。不要带着偏见去"推翻重做"。

### 1.1 已做到的（值得肯定）

| 维度 | 现状 | 评价 |
|------|------|------|
| 安全基线 | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP 完整 | ★★★★★ 远超平均水平 |
| 进程隔离 | 严格的主/preload/renderer 分离 | ★★★★★ 标准教科书级 |
| IPC 设计 | `contextBridge` 白名单 + 精确 `removeListener` | ★★★★☆ 多数团队会踩的坑都避开了 |
| 错误处理 | 全局 `unhandledrejection`/`error` 监听 + IPC try-catch | ★★★★☆ 有兜底意识 |
| 边界校验 | 路径校验防穿越 + URL 协议白名单 | ★★★★☆ 安全意识强 |
| 不可变性 | 优先返回新对象，避免直接修改输入 | ★★★★☆ 函数式思维已具备 |
| 跨平台 | `path.join()` 统一路径 | ★★★☆☆ 基础到位 |

### 1.2 待改进的（按优先级）

| 序号 | 问题 | 严重度 | 影响 | 当前证据 |
|------|------|--------|------|----------|
| P0 | **零自动化测试** | 🔴 高 | 重构恐惧、回归风险 | `test/` 目录不存在 |
| P0 | **无 Lint/Format 工具** | 🔴 高 | 风格漂移、PR 噪音 | `package.json` 无 `lint` 脚本 |
| P1 | **main.js 890 行单体** | 🟠 中 | 模块边界模糊、协作冲突 | 单文件含配置/日志/下载/搜索/IPC/菜单 |
| P1 | **renderer/app.js 812 行** | 🟠 中 | 同样的"上帝文件" | 状态/UI/事件/网络混杂 |
| P1 | **无 JSDoc 类型提示** | 🟠 中 | IDE 提示弱、协作理解成本 | 全文无 `@param`/`@returns` |
| P2 | **日志仅本地文件** | 🟡 低 | 远程诊断困难 | 无结构化日志、无级别可配 |
| P2 | **下载魔数校验失败兜底模糊** | 🟡 低 | 错误信息不够可操作 | 失败只"标记错误"，未引导用户 |
| P3 | **构建产物无哈希** | 🟢 极低 | 增量更新困难 | `package.json` 未配置 `fileHash` |

### 1.3 一句话总结

> **安全基线已超越 80% 的 Electron 应用，工程质量处于"能跑但脆弱"的状态——核心瓶颈是工程化基础设施和模块化纪律。**

---

## 二、资深开发工程师的工作哲学

### 2.1 五个核心信念

```text
┌────────────────────────────────────────────────────────────┐
│  1.  代码是写给人看的，恰好能让机器执行                    │
│  2.  显式优于隐式，简单优于聪明                            │
│  3.  可逆的决策快做，不可逆的决策慢做                       │
│  4.  90% 的代码"足够好"就够了，剩下 10% 决定生死            │
│  5.  你写的每一行代码都是给未来的你（或同事）的一封信        │
└────────────────────────────────────────────────────────────┘
```

### 2.2 资深 vs 初级的 7 个分水岭

| 维度 | 初级工程师 | 资深工程师 |
|------|-----------|-----------|
| **关注点** | "功能实现没？" | "5 年后还能维护吗？" |
| **命名** | `data1`, `temp`, `a` | `incomingTracks`, `dedupedTaskQueue` |
| **函数** | 一个函数 200 行 | 一个函数 < 30 行，单一职责 |
| **错误处理** | 吞掉异常继续跑 | 显式上抛 + 结构化日志 + 用户可读提示 |
| **测试** | "我手动测过了" | 测试金字塔：单测覆盖核心逻辑，集成测试覆盖关键路径 |
| **代码评审** | 只看格式 | 看架构边界、可测试性、安全、性能、可观测性 |
| **决策** | "用最新最酷的" | "用团队 3 年后还愿意维护的" |

### 2.3 资深工程师的日常节奏

```text
每天 ────────────────────────────────────────────
  ☀️ 早晨  10min   看昨夜的监控/异常
  💻 上午  2-3h    深度编码（不被打断的整块时间）
  🔍 下午  1-2h    代码评审 / 设计评审
  🤝 傍晚  30min   1:1 / 技术问答
  🌙 晚上  30min   写技术笔记 / 读源码

每周 ────────────────────────────────────────────
  📋 周一  30min   团队周会 + 本周技术风险点
  🎯 周三  1h      Tech Talk 或架构讨论
  📦 周五  1h      复盘 / 分享 / 总结
```

---

## 三、能力提升四象限模型

团队能力提升的四个核心维度——**缺一不可**：

```
                业务深度
                   ▲
                   │
        III 业务  │  II 工程
        专家     │   专家
        (理解领域)│   (造好轮子)
                   │
    ◄──────────────┼──────────────►
                   │
        I 通用     │  IV 软技能
        工程能力   │   协作力
        (写好代码) │   (带好团队)
                   │
                   ▼
                技术广度
```

### 3.1 四个维度的具体训练内容

#### 维度 I：通用工程能力（占比 40%）

- **代码整洁**: 命名、函数、注释、格式（附录 A 有细则）
- **Git 进阶**: rebase vs merge, cherry-pick, bisect, worktree
- **调试能力**: 二分定位、打印策略、断点技巧、火焰图
- **测试意识**: 单测、集成测、契约测试、E2E
- **性能基础**: Big O、内存模型、I/O 模型、缓存策略
- **安全意识**: XSS/CSRF/路径穿越/注入/SSRF

#### 维度 II：工程专家能力（占比 25%）

- **模块化设计**: 单一职责、依赖倒置、关注分离
- **设计模式应用**: 不为模式而模式，能识别何时**不**用模式
- **可观测性**: 结构化日志、指标、链路追踪
- **CI/CD**: 自动化是质量的底线
- **文档能力**: ADR（架构决策记录）、README、API 文档

#### 维度 III：业务专家能力（占比 20%）

- **领域建模**: 把业务规则变成代码结构
- **用户视角**: "用户为什么需要这个？"
- **取舍能力**: 完美是过程的敌人

#### 维度 IV：软技能（占比 15%）

- **代码评审**: 给建设性反馈（不是"我觉得不行"）
- **技术分享**: 讲清楚一个概念
- **冲突管理**: 意见分歧时如何对齐
- **向上向下沟通**: TL;DR 文化

---

## 四、30 天速赢计划（Quick Wins）

> 目标：**让团队立刻感受到"质量提升"的红利，建立信心。**

### 4.1 第 1 周：工程化基础设施

#### 任务 1.1: 接入 ESLint + Prettier（半天）

**为什么是它**: 没有 Lint，所有代码规范都是空话。Lint 是质量门槛的地基。

```bash
# 安装
npm i -D eslint@^9 prettier@^3
npm i -D eslint-config-prettier eslint-config-standard
```

`.eslintrc.cjs`（最小可用配置）:

```javascript
module.exports = {
  root: true,
  env: { node: true, browser: true, es2022: true },
  extends: ['standard', 'prettier'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
  rules: {
    // 渐进式开启，不要一次到位
    'no-console': 'warn',              // 后续可改 'error'
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    // Electron 特定
    'no-process-exit': 'off'            // 单实例锁需要
  },
  overrides: [
    {
      files: ['src/preload.js', 'src/renderer/**/*.js'],
      env: { browser: true, node: false }
    }
  ]
};
```

`.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

`package.json` 增加脚本:

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write \"src/**/*.{js,css,html}\"",
    "format:check": "prettier --check \"src/**/*.{js,css,html}\""
  }
}
```

**完成标准**: `npm run lint` 通过，`npm run format` 后无变化。

#### 任务 1.2: 添加 `lint-staged` + Husky（半天）

```bash
npm i -D husky lint-staged
npx husky init
```

`.husky/pre-commit`:

```bash
npx lint-staged
```

`package.json`:

```json
{
  "lint-staged": {
    "src/**/*.{js,css,html}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**效果**: 每次 commit 自动格式化+检查，PR 噪音下降 80%。

#### 任务 1.3: 开启 VSCode 工作区配置（1 小时）

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["javascript"],
  "files.eol": "\n",
  "javascript.implicitProjectConfig.eol": "\n"
}
```

`.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "EditorConfig.EditorConfig"
  ]
}
```

**效果**: 团队成员打开项目即获得一致的 IDE 体验。

### 4.2 第 2 周：关键 Bug 防御

#### 任务 2.1: 为 DownloadManager 写第一批单测（2 天）

**目标**: 覆盖核心 5 个方法: `add` / `_flush` / `pause` / `resume` / `cancel`。

新建 `tests/unit/download-manager.test.js`:

```javascript
'use strict';

const { test, describe, mock } = require('node:test');
const assert = require('node:assert');

// 用纯逻辑版（剥离 Electron 依赖）来测
// 关键原则：把 IO/副作用隔离到边界，主逻辑可测
class DownloadManager {
  constructor({ maxConcurrent = 3, retryDelays = [2000, 5000, 15000] } = {}) {
    this.queue = [];
    this.active = [];
    this.done = [];
    this.failed = [];
    this.idCtr = 1;
    this.maxConcurrent = maxConcurrent;
    this.retryDelays = retryDelays;
    this._executor = async () => {};  // 注入副作用
  }

  add(tracks) {
    const newTasks = tracks.map(t => ({
      id: this.idCtr++,
      title: t.title || '未知歌曲',
      status: 'queued',
      retries: 0,
      ...t
    }));
    this.queue.push(...newTasks);
    return newTasks;
  }

  _flush() {
    while (this.active.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.active.push(task);
      this._executor(task).then(
        () => this._markDone(task),
        (err) => this._markFailed(task, err)
      );
    }
  }

  _markDone(task) {
    this.active = this.active.filter(t => t.id !== task.id);
    task.status = 'done';
    this.done.push(task);
  }

  _markFailed(task, err) {
    this.active = this.active.filter(t => t.id !== task.id);
    task.status = 'failed';
    task.error = err.message;
    this.failed.push(task);
  }
}

describe('DownloadManager', () => {
  test('add() 分配唯一递增的 id', () => {
    const dm = new DownloadManager();
    const t1 = dm.add([{ title: 'A' }])[0];
    const t2 = dm.add([{ title: 'B' }])[0];
    assert.strictEqual(t1.id, 1);
    assert.strictEqual(t2.id, 2);
    assert.strictEqual(t1.status, 'queued');
  });

  test('_flush() 不会超过 maxConcurrent', async () => {
    let concurrent = 0;
    let maxObserved = 0;
    const dm = new DownloadManager({ maxConcurrent: 2 });
    dm._executor = async (task) => {
      concurrent++;
      maxObserved = Math.max(maxObserved, concurrent);
      await new Promise(r => setTimeout(r, 20));
      concurrent--;
    };
    dm.add([{}, {}, {}, {}, {}]);
    dm._flush();
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(maxObserved, 2, '并发数不应超过 maxConcurrent');
    assert.strictEqual(dm.done.length + dm.failed.length, 5, '所有任务应完成');
  });

  test('失败任务进入 failed 列表，错误信息保留', async () => {
    const dm = new DownloadManager();
    dm._executor = async () => { throw new Error('网络超时'); };
    dm.add([{ title: 'Bad' }]);
    dm._flush();
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(dm.failed.length, 1);
    assert.strictEqual(dm.failed[0].error, '网络超时');
    assert.strictEqual(dm.active.length, 0);
  });

  test('空入参不崩溃', () => {
    const dm = new DownloadManager();
    assert.deepStrictEqual(dm.add([]), []);
  });
});
```

**运行**:

```json
{
  "scripts": {
    "test": "node --test tests/unit/**/*.test.js"
  }
}
```

> **进阶技巧**: 用 `_executor` 注入依赖，让核心逻辑可纯测，副作用（真实下载）只在集成测试中验证。

#### 任务 2.2: 配置持久化的原子性修复（半天）

**现状风险**: `saveConfig` 用 `writeFileSync` 直接覆盖，写入中途崩溃会损坏 `config.json`。

**修复** (`src/main/config-store.js`):

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

class ConfigStore {
  constructor(filePath, defaults) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.data = this._load();
    this._saveTimer = null;
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return { ...this.defaults, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('[Config] Load failed, using defaults:', err.message);
    }
    return { ...this.defaults };
  }

  get(key) {
    return key ? this.data[key] : this.data;
  }

  set(updates) {
    // 浅合并，深值不递归
    Object.assign(this.data, updates);
    this._scheduleSave();
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flush(), 250);
  }

  _flush() {
    const tmp = this.filePath + '.tmp';
    try {
      // 原子写入：先写临时文件，再 rename
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[Config] Save failed:', err.message);
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
  }
}

module.exports = { ConfigStore };
```

**收益**: 一次原子 rename，杜绝半写状态。这个修复 30 行代码，但消除了一个潜在 P0 故障。

### 4.3 第 3 周：可观测性升级

#### 任务 3.1: 结构化日志（1 天）

**现状**: 文本日志，无法机器解析。

`src/main/logger.js`:

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

class Logger {
  constructor({ filePath, maxSize = 5 * 1024 * 1024, level = 'info' } = {}) {
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.level = level;
    this.levels = { debug: 10, info: 20, warn: 30, error: 40 };
    this._stream = null;
  }

  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  _write(level, msg, meta = {}) {
    if (!this._shouldLog(level)) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...meta
    };
    const line = JSON.stringify(entry) + '\n';
    // 控制台彩色
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    // 文件（带大小轮转）
    try {
      if (fs.existsSync(this.filePath) && fs.statSync(this.filePath).size > this.maxSize) {
        fs.renameSync(this.filePath, this.filePath + '.1');
      }
      fs.appendFileSync(this.filePath, line, 'utf8');
    } catch (_) {}
  }

  debug(msg, meta) { this._write('debug', msg, meta); }
  info(msg, meta)  { this._write('info', msg, meta); }
  warn(msg, meta)  { this._write('warn', msg, meta); }
  error(msg, meta) { this._write('error', msg, meta); }
}

module.exports = { Logger };
```

**使用**:

```javascript
log.info('download_start', { taskId, url: task.url, size: task.size });
log.error('download_failed', { taskId, retries: task.retries, err: err.message });
```

**收益**: 后续接入 Sentry/自建日志平台零成本。

### 4.4 第 4 周：模块化重构（部分）

#### 任务 4.1: 拆出 `src/main/` 子目录

**目标**: 把 890 行的 main.js 拆成 6 个职责清晰的文件。

```
src/
├── main/
│   ├── index.js          # 入口（仅做 wiring）
│   ├── config-store.js   # ConfigStore 类
│   ├── logger.js         # Logger 类
│   ├── download-manager.js
│   ├── search-service.js
│   ├── ipc-handlers.js
│   └── menu.js
├── preload.js
└── renderer/
    ├── index.html
    ├── app.js            # 入口
    ├── core/             # 新增：拆分状态/UI/事件
    │   ├── state.js
    │   ├── ui.js
    │   └── events.js
    └── pages/
        ├── search.js
        ├── downloads.js
        ├── library.js
        └── settings.js
```

**重构原则（关键）**:

1. **不要重写，只搬移**。先把代码按行搬过去，跑通测试，再考虑优化。
2. **保持公共 API 不变**。preload.js 暴露的 `window.flacMusic` 接口一字不改。
3. **每搬一个文件跑一次冒烟**。npm start 启动 → 搜索 → 下载 → 暂停 → 取消 → 退出，全流程 OK 才算完成。
4. **避免诱惑**。不要顺手"优化"——那是另一张工单。

**示例**：`src/main/download-manager.js`

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { Logger } = require('./logger');

const log = new Logger({ filePath: path.join(/*...*/) });

class DownloadManager {
  // ... 原有逻辑搬过来
  // 但用构造函数注入 logger，避免硬编码
  constructor({ config, logger, onProgress, onFinish }) {
    this.config = config;
    this.logger = logger;
    this.onProgress = onProgress;
    this.onFinish = onFinish;
    // ...
  }
}

module.exports = { DownloadManager };
```

**完成标准**:
- main.js < 200 行（只做依赖注入和事件注册）
- 所有现有功能 100% 行为不变
- 测试全部通过
- 团队 3 人分别 review 一遍（防止"只有作者能看懂"）

---

## 五、90 天进阶计划（Deep Improvements）

### 5.1 第 5-8 周：测试体系成熟

#### 5.1.1 测试金字塔

```
                 ╱╲
                ╱  ╲           E2E 测试 (5%)
               ╱ 跨页╲          — Playwright/Spectron
              ╱──────╲
             ╱  集成  ╲        集成测试 (25%)
            ╱  多模块  ╲       — 真实 IPC, 真实文件
           ╱──────────╲
          ╱   单元测试  ╲      单元测试 (70%)
         ╱  纯逻辑, 快速  ╲    — node:test / 注入依赖
        ╱──────────────────╲
```

#### 5.1.2 必须覆盖的核心模块

| 模块 | 单测目标覆盖率 | 集成测试 |
|------|----------------|----------|
| `ConfigStore` | 100% | 持久化往返 |
| `DownloadManager` | 90% | 真实断点续传（小文件）|
| `Logger` | 90% | 跨进程日志写入 |
| `search-service` | 80% | 真实 API（限流场景）|
| `renderer/state` | 80% | DOM 交互 |

#### 5.1.3 覆盖率门禁

`package.json`:

```json
{
  "scripts": {
    "test": "node --test --experimental-test-coverage tests/unit/**/*.test.js",
    "test:coverage": "c8 --check-coverage --branches 80 --functions 80 --lines 80 npm test"
  }
}
```

**纪律**: 覆盖率 < 80% 的 PR 必须先补测试再合入。

### 5.2 第 9-12 周：CI/CD 流水线

#### 5.2.1 GitHub Actions 最小化流水线

`.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
      - run: npm run test:coverage

  build:
    needs: quality
    strategy:
      matrix: { os: [windows-latest, macos-latest] }
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build:${{ matrix.os == 'windows-latest' && 'win' || 'mac' }}
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.os }}
          path: dist/*
```

**收益**:
- PR 一目了然知道合入是否安全
- 跨平台构建产物自动归档
- 解决"在我机器上能跑"问题

#### 5.2.2 Conventional Commits + 自动 CHANGELOG

```bash
npm i -D @commitlint/cli @commitlint/config-conventional standard-version
```

`commitlint.config.js`:

```javascript
module.exports = { extends: ['@commitlint/config-conventional'] };
```

`package.json`:

```json
{
  "scripts": {
    "release": "standard-version"
  }
}
```

**收益**: `git log` 一目了然，自动生成 CHANGELOG，发布版本号不再"猜"。

### 5.3 第 11-12 周：性能基线

#### 5.3.1 关键性能指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 冷启动时间 | 待测量 | < 1.5s |
| 搜索响应 (100 条) | 待测量 | < 800ms |
| 内存占用 (空闲) | 待测量 | < 200MB |
| 下载吞吐 (单任务) | 待测量 | 网络带宽 80%+ |

#### 5.3.2 性能测量三步法

1. **测量**（不猜）: 用 `electron --enable-logging` + 关键路径打点
2. **定位**（不喷）: 火焰图 + 内存快照，找到真正的瓶颈
3. **优化**（不预）: 一次只改一个变量，对比前后数据

---

## 六、180 天体系建设（Foundations）

### 6.1 知识管理体系

#### 6.1.1 ADR（架构决策记录）

**何时写 ADR**:
- 引入新的依赖
- 改变模块边界
- 选择 A 还是 B 框架
- 重构超过 100 行

`docs/adr/0001-use-electron-31.md`:

```markdown
# ADR-0001: 使用 Electron 31 而非更低版本

## 状态
已采纳 (2026-06-17)

## 背景
需要支持 macOS 14 Sonoma 的最新系统 API。

## 决策
升级到 Electron 31。

## 后果
- ✅ 获得新平台能力
- ⚠️ 必须 Node.js 18+
- ⚠️ 升级需回归测试全部 IPC

## 替代方案
- 保持 Electron 27: 失去新平台特性
- 切换 Tauri: 重写成本不可接受
```

#### 6.1.2 团队 Wiki 结构

```
docs/
├── architecture/
│   ├── overview.md          # 系统全貌
│   ├── main-process.md      # 主进程详解
│   ├── ipc-contract.md      # IPC 接口契约
│   └── data-flow.md         # 数据流图
├── adr/                     # 架构决策记录
├── runbooks/                # 故障应对手册
│   ├── download-failure.md
│   └── high-memory.md
├── onboarding/
│   ├── day-1.md
│   └── week-1.md
└── team-tech-elevation-playbook.md  # 本文档
```

### 6.2 Onboarding 体系

**目标**: 新成员 3 天能上手小需求，1 周能独立修 Bug。

#### 6.2.1 Day 1: 环境与全景
- [ ] 拉代码、跑起来、看到 DevTools
- [ ] 通读 `CLAUDE.md` + `docs/architecture/overview.md`
- [ ] 配 IDE（VSCode 工作区设置已就位）
- [ ] 走通"搜索 → 下载 → 暂停 → 取消 → 重启"全流程

#### 6.2.2 Day 2-3: 第一次提交
- [ ] 挑一个 `good first issue`
- [ ] 跟着 PR 模板提交第一个 PR
- [ ] 接受 2 轮 Code Review
- [ ] 合入

#### 6.2.3 Week 1: 第一次值班
- [ ] 阅读所有 `docs/runbooks/`
- [ ] 跟随值班同学处理一次用户反馈
- [ ] 写一篇 1 页的学习笔记

### 6.3 故障复盘文化

#### 6.3.1 复盘模板（无指责）

```markdown
## 事故复盘: [标题]

**时间**: 2026-06-XX HH:MM ~ HH:MM
**影响**: N 个用户无法使用 X 功能 / 数据丢失 / 性能下降
**等级**: P0 / P1 / P2

### 时间线
- HH:MM 触发原因
- HH:MM 首次告警
- HH:MM 人工介入
- HH:MM 恢复

### 根因
不是"人"的错，是"系统"的错。
- 直接原因:
- 深层原因:
- 系统原因:

### 改进措施
| 措施 | 负责人 | 截止 |
|------|--------|------|
| 添加单测覆盖此场景 | @xxx | 周五 |
| 增加告警 | @yyy | 下周 |
| 文档补充 | @zzz | 本周 |
```

**原则**:
- ✅ 对事不对人
- ✅ 假设每个决定在当时是合理的
- ❌ 不追责、不羞辱
- ✅ 重点是"系统让我们失败"，不是"某人让我们失败"

---

## 七、代码质量标准（落地到本项目）

### 7.1 命名规范

```javascript
// ✅ 好：见名知意
const incomingSearchResults = await searchService.query(keyword);
const dedupedTaskList = removeDuplicatesById(rawTaskList);
function calculateTotalSizeInBytes(tasks) { ... }

// ❌ 差：意义不明
const data = await searchService.query(keyword);
const list = removeDuplicatesById(rawTaskList);
function calc(tasks) { ... }
```

**规则速查**:

| 类型 | 风格 | 示例 |
|------|------|------|
| 变量/函数 | camelCase | `searchResults`, `calculateTotal` |
| 类 | PascalCase | `DownloadManager` |
| 常量 | UPPER_SNAKE | `MAX_LOG_SIZE`, `RETRY_DELAYS` |
| 私有方法/字段 | `_` 前缀 | `_flush`, `_handles` |
| 布尔 | `is/has/should/can` 前缀 | `isDev`, `hasError`, `shouldRetry` |
| 异步函数 | 不强制 `async` 前缀 | `search()` 比 `asyncSearch()` 好 |
| 文件名 | kebab-case | `download-manager.js` |

### 7.2 函数设计

**函数应该做的**:
- 单一职责
- < 30 行（理想），50 行（上限）
- 0-3 个参数（多了就传对象）
- 无副作用（或副作用显式声明）

**反面教材**（在 main.js 现状中找）:

```javascript
// ❌ 一个函数 200 行，做了 5 件事
function _download(task) {
  // 1. 计算保存路径
  // 2. 检查磁盘空间
  // 3. 发起 HTTP 请求
  // 4. 写入文件
  // 5. 校验魔数
  // 6. 更新进度
  // 7. 处理错误
  // 8. 通知 UI
}
```

**重构方向**:

```javascript
// ✅ 拆成 5 个小函数，主函数只做编排
async function _download(task) {
  const savePath = this._ensureSavePath(task);
  this._checkDiskSpace(savePath);          // 失败抛
  const stream = await this._openStream(task, savePath);
  await this._writeToFile(task, stream);
  await this._validateMagicNumber(savePath, task.format);
  this._markDone(task);
}

// 每个子函数 < 20 行，可独立单测
```

### 7.3 错误处理

**三级错误处理**:

```javascript
// 1. 边界处：捕获 + 转换
async function fetchTrackMeta(id) {
  try {
    return await externalApi.getTrack(id);
  } catch (err) {
    // 转换为业务错误
    throw new TrackNotFoundError(id, { cause: err });
  }
}

// 2. 业务层：捕获 + 处理（重试 / 降级）
async function _download(task) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await this._attemptDownload(task);
    } catch (err) {
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) throw err;
      await sleep(this.RETRY_DELAYS[attempt]);
    }
  }
}

// 3. 顶层：捕获 + 上报 + 兜底
ipcMain.handle('search', async (_, { keyword }) => {
  try {
    return { ok: true, data: await searchService.query(keyword) };
  } catch (err) {
    log.error('search_failed', { keyword, err: err.message });
    return { ok: false, error: '搜索服务暂时不可用', fallback: true };
  }
});
```

### 7.4 注释哲学

**好注释**解释**为什么**:

```javascript
// ✅ 为什么
// 服务器返回 206 表示支持断点续传；返回 200 时必须从头开始
if (response.statusCode === 206) {
  stream = fs.createWriteStream(savePath, { flags: 'a' });
} else {
  stream = fs.createWriteStream(savePath, { flags: 'w' });
}

// ❌ 废话注释（重述代码）
// 创建一个新数组
const newArray = [];
// 遍历所有任务
for (const task of tasks) { ... }
```

**规则**: 删掉所有"翻译代码"的注释，保留解释"为什么"的注释。

### 7.5 不可变性

```javascript
// ✅ 函数返回新对象，不修改入参
function addTaskToQueue(queue, task) {
  return [...queue, task];
}

// ❌ 直接 push 修改入参
function addTaskToQueue(queue, task) {
  queue.push(task);
  return queue;
}
```

**收益**: 时间旅行调试、并发安全、React/Vue 友好。

---

## 八、代码评审 Checklist

> **评审的目的不是"挑刺"，是"守护质量和知识共享"。**

### 8.1 评审者的 5 个核心问题

对每个 PR，问自己：

1. **正确性**: 这段代码做的是它声称要做的事吗？边界条件处理了吗？
2. **安全性**: 有没有注入风险？路径穿越？XSS？信息泄露？
3. **可读性**: 3 个月后的我能 5 分钟看懂吗？命名是否清晰？
4. **可测试性**: 核心逻辑能脱离 IO 测吗？有没有不可达的分支？
5. **一致性**: 跟项目其他地方风格一致吗？是否复用了已有工具？

### 8.2 评审清单

#### 8.2.1 功能性
- [ ] 满足需求描述中的所有验收点
- [ ] 边界情况已处理（空数组、null、超大值、特殊字符）
- [ ] 错误路径有合理处理（非静默吞错）
- [ ] 没有引入新的依赖（或已说明理由）

#### 8.2.2 安全性
- [ ] 用户输入已校验
- [ ] 文件路径无穿越风险
- [ ] 渲染进程无 `innerHTML` 直接使用未转义内容
- [ ] URL 协议白名单
- [ ] 敏感信息未硬编码或写入日志

#### 8.2.3 可维护性
- [ ] 函数 < 50 行（理想 30）
- [ ] 命名清晰（无缩写黑话）
- [ ] 没有"魔法数字"（提取为常量）
- [ ] 复杂逻辑有解释"为什么"的注释
- [ ] 没有大段重复代码（可抽象）

#### 8.2.4 测试
- [ ] 新功能有单测
- [ ] Bug 修复有回归测试
- [ ] 边界情况有覆盖
- [ ] CI 全绿

#### 8.2.5 性能
- [ ] 无明显 N² 循环
- [ ] 大数据场景有分页/虚拟滚动
- [ ] 无内存泄漏（事件监听器、定时器、文件句柄）
- [ ] 无阻塞主线程的同步 IO

### 8.3 反馈的艺术

#### ❌ 差评
> "这个命名太烂了，重写。"
> "性能肯定有问题。"

#### ✅ 好评
> "这个函数做了 4 件事，建议拆成 `parseUrl` / `fetchContent` / `extractTracks` 三个函数，
> 这样 `extractTracks` 还可以独立单测。改起来不复杂，~10 分钟。"
>
> "这里有个潜在性能问题：N² 的复杂度。如果 typical case 是 100 条没问题，
> 但如果未来到 1 万条需要重新设计。是否要加一个注释说明假设？"

**原则**:
- ✅ 提建议 + 解释原因 + 给替代方案
- ✅ 区分"必须改"和"建议改"
- ✅ 肯定好的部分
- ❌ 不带情绪、不人身攻击
- ❌ 不一次性要求完美（PR 不是艺术品）

---

## 九、测试体系建设

### 9.1 写测试的"不情愿"到"自然"

**心法转变**:
- 写测试不是"额外工作"，是"减少未来工作"
- 一次写测试，省下 10 次手动回归
- 测试就是文档——比注释更可信的文档

### 9.2 测试设计模式：Given-When-Then

```javascript
test('用户点击暂停，正在下载的任务状态变为 paused', async () => {
  // Given: 一个正在下载的任务
  const dm = new DownloadManager();
  const task = dm.add([{ url: 'demo://' }])[0];
  dm._markActive(task);
  assert.strictEqual(task.status, 'active');

  // When: 用户暂停
  dm.pause(task.id);

  // Then: 任务状态正确变更
  assert.strictEqual(task.status, 'paused');
  assert.strictEqual(dm.active.length, 0);
});
```

### 9.3 测试替身（Test Doubles）

| 类型 | 用途 | 例子 |
|------|------|------|
| **Stub** | 返回固定值 | `fs.readFile = () => '{"x":1}'` |
| **Mock** | 验证调用 | `expect(api.send).toHaveBeenCalledWith(...)` |
| **Fake** | 简化实现 | 内存版的 `fs` |
| **Spy** | 记录调用 | 包装原函数，记录参数 |

**原则**:
- 优先用 Stub 和 Fake（简单）
- Mock 谨慎使用（容易过测试）
- 永远不要 mock 自己写的类型

### 9.4 集成测试示例（IPC + 真实文件）

```javascript
// tests/integration/config-persistence.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ConfigStore } = require('../../src/main/config-store');

test('ConfigStore 原子写入：崩溃后不损坏', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
  const file = path.join(tmpDir, 'config.json');

  const store = new ConfigStore(file, { maxConcurrent: 3 });
  store.set({ maxConcurrent: 5 });
  store._flush();  // 立即落盘（不等待防抖）

  // 模拟崩溃中：写入 .tmp 后未 rename
  fs.writeFileSync(file + '.tmp', '{ malformed json');
  // 原文件应该保持完整
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(data.maxConcurrent, 5);
});

test('默认值 + 用户覆盖合并正确', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
  const file = path.join(tmpDir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ maxConcurrent: 10 }));

  const store = new ConfigStore(file, {
    downloadDir: 'music',
    maxConcurrent: 3,
    defaultFormat: 'FLAC'
  });

  assert.strictEqual(store.get('maxConcurrent'), 10);  // 用户值
  assert.strictEqual(store.get('defaultFormat'), 'FLAC');  // 默认值
});
```

---

## 十、架构演进蓝图

### 10.1 当前架构

```
┌──────────────────────────────────────────────────┐
│                Electron Process                  │
│                                                  │
│  ┌────────────┐  IPC  ┌──────────────────────┐  │
│  │  Renderer  │◄─────►│  Main Process        │  │
│  │  (app.js)  │       │  - window mgmt       │  │
│  │  812 行    │       │  - DownloadManager   │  │
│  └────────────┘       │  - search service    │  │
│                        │  - config store      │  │
│                        │  - ipc handlers      │  │
│                        │  890 行              │  │
│                        └──────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 10.2 目标架构（6 个月后）

```
┌─────────────────────────────────────────────────────────┐
│                     Electron Process                    │
│                                                         │
│  ┌────────────┐  IPC  ┌──────────────────────────────┐ │
│  │  Renderer  │◄─────►│       Main Process           │ │
│  │            │       │  ┌──────────────────────┐   │ │
│  │  - state   │       │  │   IPC Handlers        │   │ │
│  │  - ui      │       │  │   (契约层)             │   │ │
│  │  - pages   │       │  └──────────┬───────────┘   │ │
│  │  拆模块    │       │             │               │ │
│  └────────────┘       │  ┌──────────▼───────────┐   │ │
│                        │  │   Domain Services    │   │ │
│                        │  │   - DownloadService  │   │ │
│                        │  │   - SearchService    │   │ │
│                        │  │   - ConfigService    │   │ │
│                        │  │   - LibraryService   │   │ │
│                        │  └──────────┬───────────┘   │ │
│                        │             │               │ │
│                        │  ┌──────────▼───────────┐   │ │
│                        │  │  Infrastructure      │   │ │
│                        │  │  - HTTP client       │   │ │
│                        │  │  - File store        │   │ │
│                        │  │  - Logger            │   │ │
│                        │  │  - EventBus          │   │ │
│                        │  └──────────────────────┘   │ │
│                        └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 10.3 演进路径

| 阶段 | 时机 | 改动 |
|------|------|------|
| **v0** | 当前 | main.js 890 行，耦合 |
| **v1** | 30 天 | 按文件职责拆目录（横向拆） |
| **v2** | 90 天 | 引入"服务层"概念（纵向拆） |
| **v3** | 180 天 | 引入事件总线解耦 IPC |
| **v4** | 1 年 | 评估是否引入 TypeScript 或迁移 Tauri |

**原则**: 每一步都不破坏前一步的可运行性。不做"大爆炸"重写。

---

## 十一、工程化工具链

### 11.1 推荐配置

```json
{
  "devDependencies": {
    "eslint": "^9",
    "prettier": "^3",
    "husky": "^9",
    "lint-staged": "^15",
    "@commitlint/cli": "^19",
    "@commitlint/config-conventional": "^19",
    "standard-version": "^9",
    "c8": "^10",
    "electron-builder": "^24.13.0"
  },
  "scripts": {
    "start": "electron .",
    "dev": "electron . --dev",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write \"src/**/*.{js,css,html}\"",
    "format:check": "prettier --check \"src/**/*.{js,css,html}\"",
    "test": "node --test tests/unit/**/*.test.js",
    "test:coverage": "c8 --check-coverage --branches 80 --functions 80 --lines 80 npm test",
    "test:integration": "node --test tests/integration/**/*.test.js",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:all": "electron-builder --win --mac",
    "release": "standard-version"
  }
}
```

### 11.2 编辑器配置

- VSCode 工作区设置（已在 §4.1.3）
- EditorConfig 统一换行符

`.editorconfig`:

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

### 11.3 Git 配置

`.gitattributes`:

```text
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
*.icns binary
```

`.gitignore`（建议补充）:

```gitignore
# Editor
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# OS
.DS_Store
Thumbs.db

# Build
dist/
*.log
*.tmp
```

---

## 十二、团队协作流程

### 12.1 分支策略：Trunk-Based + 短特性分支

```
main (稳定)
 │
 ├── feature/search-v2        (1-3 天合入)
 ├── feature/fix-pause-bug    (半天)
 └── release/v2.5.0           (发版前整合)
```

**原则**:
- 主干永远可发布
- 特性分支 < 3 天
- 大改动用 Feature Flag
- 每天 rebase 一次主干

### 12.2 Issue 模板

`.github/ISSUE_TEMPLATE/bug.md`:

```markdown
## Bug 报告

**环境**:
- OS: [e.g. Windows 11]
- App 版本: [e.g. 2.4.1]
- 安装方式: [e.g. NSIS / Portable / DMG]

**复现步骤**:
1.
2.
3.

**预期**:
**实际**:
**日志**: （`~/Library/Application Support/cn.music.hi.flac/app.log` 关键片段）
```

### 12.3 PR 模板

见 **附录 B**。

### 12.4 站会（10 分钟上限）

每个人 3 个问题：
1. 昨天完成了什么？
2. 今天计划做什么？
3. 有什么 blocker？

**红线**:
- 站会不是技术讨论会——会后约
- 站会不是状态汇报给领导——是同步给团队
- 站会不是吐槽会——聚焦在事

### 12.5 Retro（每两周 1 次）

模板：
- 🟢 继续做: [事项]
- 🟡 改进: [事项 + 具体行动]
- 🔴 停止: [事项]
- 💡 尝试: [新做法]

---

## 十三、学习资源清单

### 13.1 必读书籍（按优先级）

1. **《代码整洁之道》(Clean Code)** — Robert C. Martin
2. **《代码大全》(Code Complete)** — Steve McConnell  
3. **《重构》(Refactoring)** — Martin Fowler
4. **《设计数据密集型应用》(DDIA)** — Martin Kleppmann
5. **《系统设计面试》** — Alex Xu（系统思维）
6. **《程序员修炼之道》** — Hunt & Thomas

### 13.2 必看源码（精读）

| 项目 | 学什么 | 时间 |
|------|--------|------|
| Electron 自身 | 主/preload/renderer 通信 | 1 周 |
| VSCode | 大型 Electron 应用的模块化 | 2 周 |
| Playwright | E2E 测试的设计 | 3 天 |
| `node:fs` 源码 | Node 异步 IO 模式 | 1 天 |

### 13.3 必读博客/Newsletter

- **Martin Fowler** (martinfowler.com)
- **Julia Evans** (jvns.ca) — 调试与系统
- **Hillel Wayne** (hillelwayne.com) — 形式化方法
- **Electron 官方博客** (electronjs.org/blog)

### 13.4 每周技术分享主题（建议 6 个月排期）

| 周次 | 主题 | 负责人 |
|------|------|--------|
| W1 | ESLint 规则全解 | @xxx |
| W2 | Electron 安全模型 | @yyy |
| W3 | 单测设计模式 | @zzz |
| W4 | 性能调优实战 | @aaa |
| W5 | Git 进阶 (rebase, bisect) | @bbb |
| W6 | 错误处理最佳实践 | @ccc |
| ... | ... | ... |

---

## 附录 A: 编码规范细则

### A.1 导入顺序

```javascript
// 1. Node 内置
const fs = require('fs');
const path = require('path');

// 2. 第三方
const electron = require('electron');

// 3. 内部模块（用相对路径）
const { Logger } = require('./logger');
const { ConfigStore } = require('./config-store');
```

### A.2 异步模式

```javascript
// ✅ 优先 async/await
async function fetchData() {
  const a = await getA();
  const b = await getB(a);
  return { a, b };
}

// ⚠️ 必要时并发
async function fetchData() {
  const [a, b] = await Promise.all([getA(), getB()]);
  return { a, b };
}

// ❌ 避免 .then 链（除非兼容性需要）
```

### A.3 布尔陷阱

```javascript
// ❌ 反直觉
if (downloads.length) { ... }    // 0 是 falsy, 但语义上不是"没下载"

// ✅ 显式
if (downloads.length > 0) { ... }

// ❌ 双重否定难懂
if (!isNotReady) { ... }

// ✅ 命名正向
if (isReady) { ... }
```

### A.4 解构 vs 属性访问

```javascript
// ✅ 多于 2 个属性时用解构
function renderTask({ id, title, status, progress }) { ... }

// ⚠️ 1-2 个属性时直接访问
function getTitle(task) {
  return task.title;
}
```

### A.5 默认值

```javascript
// ✅ ES6 默认值
function search(keyword, { page = 1, pageSize = 20 } = {}) { ... }

// ❌ 老式
function search(keyword, options) {
  const page = options && options.page || 1;
}
```

---

## 附录 B: Pull Request 模板

`.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档
- [ ] 性能优化
- [ ] 测试

## 变更说明
<!-- 一句话说清楚这个 PR 解决什么问题 -->

## 关联 Issue
<!-- 关联 issue 编号: Fixes #123, Closes #456 -->

## 测试
- [ ] 已添加单测
- [ ] 已添加集成测试
- [ ] 已手动测试（描述步骤）
- [ ] 测试覆盖率 ≥ 80%

## 截图/录屏
<!-- UI 改动必填 -->

## Checklist
- [ ] 代码遵循项目编码规范
- [ ] 已运行 `npm run lint` 无错误
- [ ] 已运行 `npm run format:check` 无错误
- [ ] 已运行 `npm test` 全部通过
- [ ] 无新增的 Lint 警告
- [ ] 涉及安全的改动已额外评审
- [ ] CHANGELOG 已更新（如适用）

## 评审重点
<!-- 告知评审者应该重点关注哪里 -->
```

---

## 写在最后

> **"代码被读的次数远多于被写的次数。"**
>
> 你现在写的每一行代码，都在和未来的同事（可能是 3 个月后的你自己）对话。
> 写好这段对话，是资深工程师的核心能力。

**Playbook 维护**:
- 本文档每季度 review 一次
- 鼓励所有人提 PR 改进
- 任何写进这里的标准，都要先在团队达成共识

**最后一条原则**: 完美是过程的敌人，**持续改进**才是目标。

---

*文档版本: 1.0 · 2026-06-17 · Senior Developer Playbook*  
*下一步: 与团队负责人对齐 30 天计划的优先级 → 启动 Quick Wins。*
