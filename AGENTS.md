# AGENTS.md

给 AI 编码助手看的项目须知。人类可读的功能介绍见 `README.md`，待办清单见 `docs/IMPROVEMENTS.md`。

## 常用命令

| 目的 | 命令 |
| --- | --- |
| 本地开发 | `npm run dev` |
| 类型检查 | `npm run typecheck` |
| 代码规范 | `npm run lint` |
| 单元测试 | `npm test` |
| 测试（watch） | `npm run test:watch` |
| 覆盖率 + 门禁 | `npm run test:coverage` |
| 生产构建 | `npm run build` |

**改完代码必须按顺序跑完这四条，全部零错误才算完成：**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

CI（`.github/workflows/ci.yml`）跑的就是这套，外加覆盖率门禁。

## 运行环境

- **Node 22+ 是硬要求**：数据层直接用了内置的 `node:sqlite`（`src/lib/db/sqlite.ts`），低版本起不来。
- 不配任何密钥也能跑：模型网关会自动落到内置 demo 供应商，对话/PPT/绘图全链路都能走通。密钥项见 `.env.example`。

## 技术栈与结构

Next.js 14 App Router + TypeScript + Tailwind + Zustand + `node:sqlite`。

```
src/app/            页面与 API 路由（route.ts 为服务端入口）
src/components/     React 组件，workspace/ 是六大工作台的主战场
src/lib/            业务逻辑
  db/               sqlite.ts 建表与迁移、repo.ts 数据访问
  gateway/          模型网关：providers/ 对话、image/ 绘图、credits.ts 计费
  slides/ research/ docs/  各模式的领域逻辑
  store/chat.ts     全局状态与全部业务 action（最核心的文件）
src/middleware.ts   写接口的同源 / Bearer 令牌校验
test/               vitest 全局 setup 与垫片
```

六种工作模式由 `WorkspaceMode` 统一驱动：`chat` / `research` / `slides` / `image` / `video` / `docs`。

## 编码约定

- 注释写「为什么这么改」，不写「改了什么」；一律中文。标识符用英文。
- 不要引入新依赖来解决小问题 —— 项目刻意保持零重依赖（Markdown 渲染、SSE 解析都是自研的）。要加依赖必须钉死版本号（`npm i --save-exact`），不留 `^`。
- 新增写接口时，`src/middleware.ts` 的同源校验会自动覆盖，但仍要在路由内做参数校验：所有畸形输入必须返回 400，不允许冒 500。
- 对外发起请求前必须过 `src/lib/net-guard.ts`（SSRF 防护），且拦截要发生在 `fetch` 之前。

## 测试约定

测试文件与被测文件同目录，命名 `*.test.ts` / `*.test.tsx`。

- 默认 node 环境；`src/components/**` 自动切到 jsdom（见 `vitest.config.ts` 的 `environmentMatchGlobs`）。
- **数据库测试必须隔离**：用 `mkdtempSync` 建临时目录赋给 `OC_DATA_DIR`，配合 `closeDb()` 与 `vi.resetModules()` 重置模块级单例。绝不能碰开发库 `data/dev.db`。
- `node:sqlite` 在 vitest 里解析不了（`vite-node` 判定内建模块时会剥掉 `node:` 前缀导致查表失败），已用 `test/shims/node-sqlite.ts` 垫片 + `resolve.alias` 绕开，不要动这段配置。
- store 测试用 `vi.stubGlobal("fetch", fn)` 打桩，`vi.resetModules()` 后再 `await import`。SSE 场景手工构造 `ReadableStream`，保留 `push`/`close` 句柄以便精确编排流中断。
- 组件测试自动 cleanup 已在 `test/setup.ts` 里手挂（本项目用显式 import 风格，testing-library 不会自动注册），`jsdom` 缺失的 `scrollTo` / `clipboard` / `ResizeObserver` 也在那里补齐。
- 覆盖率门禁按文件维度配在 `vitest.config.ts` 的 `thresholds`，只卡已建好防护网的模块。给模块补完测试后，把它加进 `thresholds` 锁住成果。

## 注意事项

- `src/lib/store/chat.ts` 有 1500+ 行且是所有模式的枢纽，改动前先读清 `patchMessages` / `findConvo` / `activeAbort` 三处的既有约定（会话可能在流式生成中途被删除，所有写入都要能静默跳过）。
- 数据库迁移目前是手写的 `if (!cols.some(...))` 判断，加字段时照着 `sqlite.ts` 末尾的模式补，别忘了同步 `repo.ts` 的读写与 `backup.ts` 的校验。