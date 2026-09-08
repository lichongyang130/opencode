# OpenCanvas 改进清单（重整版 · 218 条）

> **本版说明**：旧版标题写「500 条」但实际仅 169 条，且勾选状态与代码已脱节
> （经逐条比对，至少 7 条标为待办的功能其实已落地）。本版按真实代码状态重整，
> 只保留**互不重复、有工程价值**的改进点，不为凑数拆分同质项。
>
> 状态：`[ ]` 待办 · `[x]` 已完成 · `[~]` 半成品（有部分实现但不可用）
> 优先级：**P0** 基建欠账（阻塞后续所有改动）· **P1** 核心能力缺口 · **P2** 体验打磨
>
> 已完成的历史批次（模板体系 / 提示词进阶 / Persona 系统 / 安全审查 22 项）见文末附录。

---

# 第一部分 · P0 工程基建

这四章是**当前项目最大的欠账**：测试与可观测性起点均为零，
数据层缺分页与迁移版本管理，前端无错误边界。它们是后续一切改动的安全网。

**进度：T 章（测试体系与 CI）18/18、R 章（健壮性与错误处理）16/16、O 章（可观测性与运维）14/14 已完成，安全网与观测体系已建好；DB 一章待办。**

## T. 测试体系与 CI（18 条）✅ 全部完成

> 起点：`0` 个测试文件、无 vitest/jest 配置、无 `.github/workflows`，
> `package.json` 仅有 dev/build/start/lint 四个 script。
>
> 现状：**12 个测试文件 / 565 个用例全绿**，CI 与按文件覆盖率门禁已上线。
> 过程中抓出并修掉 4 个真实缺陷（见本节末）。

- [x] T1 引入 vitest + @vitest/coverage-v8，配置 `vitest.config.ts`（路径别名对齐 tsconfig 的 `@/*`）
- [x] T2 新增 script：`test` / `test:watch` / `test:coverage` / `typecheck`
- [x] T3 `src/lib/backup.test.ts`：validateBackup 的合法/畸形/缺字段/ID 重复四类用例（21 项）
- [x] T4 `src/lib/db/repo.test.ts`：importBackup 的导入、幂等跳过、消息 ID 冲突回滚（用临时库文件）
- [x] T5 repo 层 CRUD 测试：upsert/patch/delete 级联、archived 过滤、pinned 排序（T4+T5 共 28 项）
- [x] T6 `src/lib/net-guard.test.ts`：内网 IP、云元数据 169.254.169.254、IPv6 `::1`、`::ffff:` 映射全拦截
- [x] T7 net-guard 重定向测试：mock 一个 302 跳内网的响应，断言逐跳校验生效（T6+T7 共 40 项）
- [x] T8 `src/middleware.test.ts`：无来源头 401、跨站 Origin 401、同源 200、Bearer 令牌放行（49 项）
- [x] T9 `src/lib/http.test.ts`：readJsonBody 对畸形 JSON / 数组 / null / 空体均返回 null（18 项）
- [x] T10 `src/lib/gateway/credits.test.ts`：estimateTokens 与成本换算边界（空串、超长文本）（21 项）
- [x] T11 `src/lib/case-share.test.ts`：分享码编解码往返一致性（26 项）
- [x] T12 store 测试：`patchMessages` 在会话已删除时静默跳过，不抛异常（`chat.send.test.ts` 45 项）
- [x] T13 store 测试：`hydrate()` 并发调用只执行一次（验证 hydrating 防重入）（`chat.hydrate.test.ts` 18 项）
- [x] T14 API 路由集成测试：15 个 POST 接口 × 8 种畸形请求体均返回 400 而非 500（`routes.test.ts` 178 项）
- [x] T15 引入 @testing-library/react + jsdom，为 ChatPanel（72 项）与自研 Markdown 渲染器（49 项）写交互测试
- [x] T16 `.github/workflows/ci.yml`：Node 22，跑 typecheck + lint + test:coverage + build，并发取消 + 报告上传
- [x] T17 覆盖率门禁：按**文件维度**配 `thresholds`（全局平均值只能设到 30% 上下，起不到防回退作用），只卡已建好防护网的 11 个模块
- [x] T18 补 `AGENTS.md`：命令表 + 运行环境 + 结构说明 + 编码/测试约定 + 两处高危区提醒

### 本节顺带修掉的真实缺陷

1. **`net-guard.ts` 环回绕过**：`isBlockedV6()` 原正则匹配 `::ffff:127.0.0.1` 点分写法，
   但 `new URL()` 会规范化成 `[::ffff:7f00:1]` 导致漏判。改为 `parseV6()` 数值化展开成 8 组 16 位后按段判定。
2. **`chat.ts` 的 `editLastUserMessage()` 下标 off-by-one**：`reverse().findIndex()` 换算时少减 1，
   结果把 AI 回复当成原文填回输入框、用户消息反而没被撤回。改为直接倒序循环找真实下标。
3. **`case-share.ts` 的 `decodeCaseShare` 空值穿透**：`typeof obj.values !== "object"` 放过了 `null` 和数组，
   `null` 会让下游 `applyVariables` 抛 TypeError。已补 `!obj.values` / `Array.isArray` 判断。
4. **`Markdown.tsx` 列表收尾 flush 位置错误**：`flushList` 写在行循环体内，导致每行都结算一次，
   连续列表项被拆成一串单项 `<ul>`，且 React key 恒为 `l-{i}-end` 而重复告警。已移到循环外，
   并在表格分支前补一次 flush 避免节点顺序错乱。

### 关键技术障碍与解法（避免后续重走弯路）

- **`node:sqlite` 在 vitest 里解析不了**：`vite-node` 的 `isNodeBuiltin()` 先剥掉 `node:` 前缀再查
  `builtinModules`，而 Node 22 的 `node:sqlite` 在表里存的名字带前缀，判定失败后被当第三方包解析，
  报 `Failed to load url sqlite`。`server.deps.external` 正则和自定义 `resolveId` 插件都无效；
  最终用 `test/shims/node-sqlite.ts` 走 `createRequire` 取真实模块 + `resolve.alias` 重定向。
- **tsconfig 的 `jsx: "preserve"`** 是给 Next 编译器用的，vitest 走 esbuild 必须显式配
  `esbuild: { jsx: "automatic" }`，否则 tsx 走 classic 转换报 `React is not defined`。
- **testing-library 的自动 cleanup 只在检测到全局 `afterEach` 时注册**（即 `globals: true`）。
  本项目用显式 import 风格，必须在 `test/setup.ts` 手挂 `afterEach(cleanup)`，
  否则多次 `render` 会叠加到同一个 body，让 `getByRole` 报「找到多个元素」。
- **数据库测试隔离**：`sqlite.ts` 支持 `OC_DATA_DIR` + 导出 `closeDb()`，
  每个用例 `mkdtempSync` 建独立临时目录 + `vi.resetModules()` 重置模块级单例。
- **中间件测试断言放行**看 `x-middleware-next: 1` 响应头，而非 status；
  且 HTTP 头只接受 ByteString，构造 `NextRequest` 时不能带非 ASCII 字符。

## O. 可观测性与运维（14 条）✅ 全部完成

> 起点：全库 grep 无 requestId/traceId、无结构化日志、无健康检查、无限流；
> 错误处理只有零散的 `console.error`。
>
> 现状：**28 个测试文件 / 1025 个用例全绿**。
> 新增完整结构化 JSON 日志、敏感信息自动脱敏、AsyncLocalStorage 驱动的 requestId 链路贯穿、
> 内存滑动窗口限流、SSE 连接数硬防护与超时兜底、健康/版本探活接口及存储目录用量告警。

- [x] O1 新建 `src/lib/logger.ts`：结构化 JSON 日志，字段含 level/time/msg/requestId/route
- [x] O2 日志分级与环境开关：生产只出 info 及以上，开发保留 debug
- [x] O3 中间件生成 requestId（crypto.randomUUID）并写入响应头 `x-request-id`
- [x] O4 requestId 用 AsyncLocalStorage 贯穿请求，logger 自动附加，无需逐层传参
- [x] O5 把 14 个 API 路由里的裸 `console.error` 统一替换为 logger.error
- [x] O6 日志脱敏：apiKey / Authorization / base64 图片体一律不落日志
- [x] O7 新增 `GET /api/health`：返回 DB 可连通性、WAL 大小、进程 uptime、版本号
- [x] O8 新增 `GET /api/version`：暴露构建时注入的 commit sha 与构建时间
- [x] O9 API 限流：`src/lib/rate-limit.ts` 内存滑动窗口，按 IP + 路由维度
- [x] O10 对 AI 调用类路由（chat/research/slides/images/ocr）单独设更严限额并返回 429 + Retry-After
- [x] O11 慢请求告警：超过阈值（如 5s）的请求单独打 warn 日志并记录耗时分布
- [x] O12 SSE 连接数上限与超时兜底，防止流式连接泄漏累积
- [x] O13 未捕获异常与 unhandledRejection 全局兜底钩子，保证进程不静默退出
- [x] O14 `data/` 目录磁盘占用检查与告警（DB + WAL 超阈值时提示）

## DB. 数据层能力（16 条）✅ 全部完成

> 起点：`listConversations` 全量返回（全库无 `LIMIT`/`OFFSET`）；
> 迁移是 `sqlite.ts:72-90` 六段手写 `if (!cols.some(...))`，无版本机制；
> 无全文搜索、无软删除。
>
> 现状：**`migrations.ts` v1-v5 版本化迁移 + 事务回滚；keyset 游标分页贯通到侧栏无限滚动；
> FTS5 全文搜索（自研 CJK 单字切词解决中文分词）接通搜索框；软删除 + 回收站 + 标签 +
> 文件夹分组 + 复合索引 + 定期 optimize 与手动压缩全部落地**。新增 6 个测试文件，
> 全仓 1072 用例全绿，覆盖率门禁已把 repo/sqlite/db-maintenance 锁进阈值。

- [x] DB1 `listConversations` 改为分页：`limit`/`cursor`（按 updatedAt 游标），保留 pinned 置顶语义
- [x] DB2 `GET /api/conversations` 支持分页参数并返回 `nextCursor`
- [x] DB3 侧栏历史改为滚动到底自动加载下一页
- [x] DB4 消息列表分页：超长会话只加载最近 N 条，向上滚动补拉历史
- [x] DB5 迁移机制改用 `PRAGMA user_version`：`src/lib/db/migrations.ts` 按版本号顺序执行
- [x] DB6 把现有 6 段列补齐逻辑改写为 v1 迁移脚本，新增列只需追加一个版本
- [x] DB7 迁移执行加事务与失败回滚，启动失败时给出明确错误而非静默带病运行
- [x] DB8 FTS5 虚拟表 `messages_fts`，触发器同步 insert/update/delete
- [x] DB9 新增 `GET /api/search?q=`：全文搜索会话标题与消息正文，返回高亮片段
- [x] DB10 侧栏搜索框接入全文搜索，替换当前的前端字符串过滤
- [x] DB11 软删除：conversations 增 `deletedAt`，删除改为标记
- [x] DB12 回收站视图 + 恢复 + 彻底删除 + 30 天自动清理
- [x] DB13 标签体系：`tags` 表 + `conversation_tags` 关联表，支持多标签筛选
- [x] DB14 文件夹/项目分组：conversations 增 `folderId`，侧栏按文件夹折叠展示
- [x] DB15 补索引：`messages(conversationId, createdAt)` 复合索引、`conversations(pinned, updatedAt, id)`
- [x] DB16 定期 `PRAGMA optimize` 与手动「压缩数据库」入口（VACUUM + wal_checkpoint）

## R. 健壮性与错误处理（16 条）✅ 全部完成

> 起点：`ErrorBoundary` 实测为 0（仅有 Next 路由级 `app/error.tsx`）；
> 无 `global-error.tsx`、无 `not-found.tsx`、无 `loading.tsx`；
> 19 个文件直接裸访问 localStorage。
>
> 现状：**23 个测试文件 / 1006 个用例全绿**（本章新增 11 个文件 441 项），
> 覆盖率门禁从 11 个模块扩到 17 个。过程中抓出并修掉 3 个真实缺陷（见本节末）。

- [x] R1 新增 `src/components/ErrorBoundary.tsx`（React 类组件 + componentDidCatch），包裹工作台三栏（`Workspace.tsx` 五分区各自独立包边界，一栏崩不拖垮整页）
- [x] R2 新增 `src/app/global-error.tsx`：兜住 layout 级崩溃
- [x] R3 新增 `src/app/not-found.tsx`：404 页面带返回工作台入口
- [x] R4 各路由段补 `loading.tsx`（11 个）+ 复用 `PageSkeleton.tsx`，消除白屏
- [x] R5 `src/lib/safe-storage.ts`：包装 localStorage 的读写，处理禁用/配额满/JSON 解析失败（探针结果缓存 + 内存桶降级 + 自动清脏键）
- [x] R6 把 19 处裸 localStorage 访问统一切到 safe-storage
- [x] R7 所有前端 fetch 统一超时：封装 `src/lib/fetcher.ts`，默认 `AbortSignal.timeout`
- [x] R8 SSE 中断的统一处理：区分用户主动停止、网络断开、服务端错误三种文案（`newAbort()` 用 `AbortSignal.reason` 区分 timeout / user）
- [x] R9 SSE 断线自动重连（有限次数 + 指数退避），已收到的内容不丢弃（仅在 `received === 0` 时重发，且只重试 502/503/504，避免重复计费与内容错位）
- [x] R10 模型返回非法 JSON 的降级：`json-loose.ts` 四级修复 → `slides/parse.ts` 三级降级 → `research/engine.ts` 的 `reportFromText()` 保留原始文本
- [x] R11 网络离线检测（`navigator.onLine` + online/offline 事件），顶栏显示离线条（初值固定 true 规避 hydration 不匹配）
- [x] R12 并发发送锁：模块级 `taskLock` + `acquireTask()` / `releaseTask()`，7 个入口接入（含快捷键与斜杠命令路径）
- [x] R13 图片 data URI 入库前体积校验，超阈值转存文件并只存路径（256KB 内联阈值 / 16MB 硬上限 / 落盘失败退回内联 / 白名单正则防路径穿越 / 删会话时清理孤儿文件）
- [x] R14 未知模型 id 的兜底路由：`ResolvedModel.fallback` + `safeModel()` 落回默认模型并 toast 提示，而非静默失败
- [x] R15 DB 损坏自愈：启动时 `PRAGMA integrity_check(1)`，损坏时 `quarantine()` 归档原库再重建
- [x] R16 替换最后 1 处原生 `confirm`，统一走 `ConfirmDialog.tsx`

### 本节顺带修掉的真实缺陷

1. **`json-loose.ts` 的 `extractObjectText` 用 `lastIndexOf("}")` 截取**：模型输出被截断、
   而已生成内容里出现过 `}` 时，会停在内部括号上把后面内容一起裁掉（实测让一份截断的 deck 少掉整整一页）。
   改为 `matchingBraceEnd()` 逐字符扫描配对，并跳过字符串字面量里的括号。
2. **`safe-storage.ts` 的 `readRaw` 先读 localStorage 再回退内存桶**：配额写满时 `writeRaw`
   已把值落到内存桶，但 `readRaw` 永远读不到，等于降级形同虚设、当次改动照旧丢失。
   改为**内存桶优先**；同时 `writeRaw` 成功落盘后必须 `memory.delete(key)`，否则旧降级值会盖掉新值。
3. **`image-store.ts` 的 `normalizeImagesPayload` 只用 `typeof item[field]` 判类型**：
   `Object.create({ url: "x" })` 这类原型链取值也能过关，脏数据被写进库。改为先 `hasOwnProperty` 校验。

### 关键技术障碍与解法（避免后续重走弯路）

- **`afterEach` 里 `vi.useRealTimers()` 必须先于 `vi.restoreAllMocks()`**。反序会把「假的、
  已停用的 setTimeout」还原成全局实现，导致后续所有用例的定时器都不触发（`fetcher.test.ts` 一度 5 个用例超时）。
- **mock fetch 必须先判 `init?.signal?.aborted`**：已中断的 signal 不会再派发 abort 事件，不判就永不 settle。
- **测「流中途中断」时，mock fetch 要把 signal 绑到响应体流上**
  （`signal.addEventListener("abort", () => controller.error(AbortError))`），
  否则 `streamSSE` 的 reader 永远读不到错误，测不出 user-abort / timeout 语义。
  `sse.test.ts` 的 `controlledSse()` 提供 `bind()` 就是为此。
- **`node:fs` 的 ESM 命名空间只读**，`vi.spyOn(fs, "writeFileSync")` 报 `Cannot redefine property`。
  改用 `vi.mock("node:fs", ...)` 整模块 mock + 模块级 `failing: Set<string>` 开关：
  默认走真实实现，需要复现磁盘满 / 只读时再往 set 里塞函数名。
- **ErrorBoundary 重试测试的顺序**：必须先 `rerender` 把修好的 children 交给边界，**再**点重试。
  反过来 reset 会重新渲染上一份仍会抛错的 children，立刻落回 fallback。
- **坏库被 `new DatabaseSync()` 打开时 sqlite 自己就删掉了旧 `-wal`/`-shm`**，
  所以 `quarantine()` 里的 WAL rename 只是兜底，测试不能断言归档目录里有 `-wal`，
  只能断言新库 WAL 不含旧内容。制造「合法 sqlite 头但页损坏」的库时也必须把 `-wal`/`-shm` 一起删掉，
  否则 WAL 里完好的页会掩盖损坏。

---

# 第二部分 · P1 核心能力缺口

## AI. 模型调用韧性与计费（15 条）

> 现状：3 处 SSE 流式（chat/research/slides）已通；
> 但全库无重试/退避逻辑；`gateway/credits.ts:2` 自述「纯函数 + 内存模拟」，用量未落库。

- [x] AI1 `src/lib/gateway/retry.ts`：可配置重试次数与指数退避 + 抖动
- [x] AI2 只对可重试错误重试（429 / 5xx / 网络超时），4xx 参数错误直接失败
- [x] AI3 尊重上游 `Retry-After` 响应头
- [x] AI4 服务端 AI 调用统一超时（当前仅 import/url 有 AbortController）
- [x] AI5 客户端断开时中止上游请求（监听 `req.signal`），避免白烧 token
- [x] AI6 流式首字节超时单独设阈值，卡住时快速失败而非干等
- [x] AI7 多供应商故障转移：主供应商连续失败时自动降级到备用
- [x] AI8 `usage` 表落库：记录会话/模型/输入输出 token/成本/耗时/是否成功
- [x] AI9 从流式响应真实 usage 字段取 token 数，取不到再退回 estimateTokens
- [x] AI10 用量看板：按天/按模型聚合的调用次数、token、成本曲线
- [x] AI11 积分预扣与结算落库（当前是内存模拟），失败自动回滚
- [x] AI12 单次请求成本上限保护，超限拒绝并提示
- [x] AI13 响应缓存：相同 prompt + 模型 + 参数在短 TTL 内复用（可开关）
- [x] AI14 SSE 事件协议统一：定义 `delta` / `usage` / `error` / `done` 四类事件并集中解析
- [x] AI15 把 3 处重复的 SSE 读取逻辑（ChatPanel / TemplatesModal / ToolRunnerModal）抽成 `useSseStream` hook

## V. video 模式补完（10 条）

> 现状：**空壳**。`src/app/api` 下无任何 video 路由，
> 只有 `chat.ts:69` 一句 system prompt 走通用对话产出分镜文本。

- [x] V1 定义分镜数据结构 `Storyboard`（场景 / 画面描述 / 旁白 / 时长 / 转场）
- [x] V2 新增 `POST /api/video/storyboard`：流式产出结构化分镜 JSON 而非纯文本
- [x] V3 conversations 增 `video` 列持久化分镜，补迁移
- [x] V4 `StoryboardView` 组件：分镜卡片列表，支持编辑单镜、增删、拖拽排序
- [x] V5 每个分镜「生成画面」按钮，复用 images 通道出参考图
- [x] V6 旁白一键转 TTS（预留供应商适配位，无密钥时禁用并说明）
- [x] V7 分镜导出：Markdown 脚本 + CSV 拍摄清单
- [x] V8 分镜转 PPT（复用 slides 导出链路做故事板样片）
- [x] V9 总时长自动汇总与超时长提醒
- [x] V10 video 模式空状态给 3 个真实可点的示例（宣传片 / 短视频 / 教程）

## DOC. docs 模式与文档编辑器（12 条）

> 现状：`generateDocs` 已接模型（`chat.ts:1278`），产物是纯 Markdown 存 `conversations.doc`；
> 但只能整篇重新生成，没有编辑器能力。

- [x] DOC1 文档正文改为可编辑（contenteditable 或轻量富文本），失焦自动保存
- [x] DOC2 自动保存状态指示（保存中 / 已保存 / 保存失败可重试）
- [x] DOC3 选中段落「AI 改写 / 扩写 / 精简 / 润色」浮动工具条
- [x] DOC4 文档大纲侧栏，按标题层级跳转
- [x] DOC5 版本历史：`doc_versions` 表，每次保存留快照，可对比与回滚
- [x] DOC6 导出 Markdown / HTML / docx
- [x] DOC7 字数与预计阅读时长统计
- [x] DOC8 图片插入：复用 images 通道生成配图并插入光标处
- [x] DOC9 表格插入与编辑
- [x] DOC10 Markdown 与富文本双向切换不丢格式
- [x] DOC11 研究报告一键转文档（reportToDoc 既有实现，ReportView「转文档」按钮）
- [x] DOC12 文档模板：周报 / 竞品分析 / PRD / 复盘四套起始骨架

## PPT. 幻灯片工作台（14 条）

> 现状：增删复制单页已有（`chat.ts:1488-1516`）；PPTX 导出与文件名清洗已完成。
> 缺口集中在大纲先行、单页重写、配图与 PDF。

- [x] PPT1 大纲先行：先流式出可编辑大纲，确认后再生成成稿
- [x] PPT2 单页 AI 重写：选中页重新生成，保留主题与上下文
- [x] PPT3 配图位接 AI 绘图自动填图
- [x] PPT4 缩略图拖拽排序
- [x] PPT5 新增版式：时间轴 / 左右对比 / 流程 / 引用 / 团队介绍
- [x] PPT6 演讲者备注字段 + 导出到 PPTX 备注区
- [x] PPT7 导出 PDF（打印样式或服务端渲染）
- [x] PPT8 主题扩充为主题市场（配色 + 字体 + 版式组合）
- [x] PPT9 封面副标题与日期自动填充
- [x] PPT10 全屏演示模式（方向键翻页、ESC 退出、演讲者视图）
- [x] PPT11 单页文字溢出检测与自动缩排提示
- [x] PPT12 导出前预览确认弹窗
- [x] PPT13 幻灯片缩略图 memo 化，减少全量重渲染
- [x] PPT14 导出 PPTX 进度反馈（大文件生成时的 loading 与失败重试）

## RS. 深度研究（11 条）

> 现状：SSE 流式研究已通，报告可复制/导出 Markdown（`ReportView.tsx:42-97`）、
> 可一键转 PPT。缺口在过程可见性与来源交互。

- [x] RS1 研究进度分步时间线（规划 → 检索 → 阅读 → 写作），当前只有笼统 loading
- [x] RS2 引用角标点击滚动并高亮对应来源
- [x] RS3 来源列表显示 favicon 与域名可信度提示
- [x] RS4 来源可勾选后「基于选中来源重写」
- [x] RS5 研究深度可调（来源数量 / 检索轮次）
- [x] RS6 研究失败时保留已获得的来源与半成品报告，不整体丢弃
- [x] RS7 报告内联追问：选中段落基于报告上下文继续提问
- [x] RS8 报告输出语言选择
- [x] RS9 来源去重与同源合并
- [x] RS10 长报告分段渲染，避免一次性挂载卡顿
- [x] RS11 报告导出 docx（当前只有 Markdown）

## IMG. AI 绘图（11 条）

> 现状：`POST /api/images` 单张生成，参数只有 model / prompt / size（`route.ts:10`）。
> 风格预设实测为 0，图像模型选择器不存在。

- [x] IMG1 独立的图像模型选择器（与对话模型解耦）
- [x] IMG2 一次生成 4 张供挑选
- [x] IMG3 风格预设 chips（水彩 / 赛博 / 极简 / 写实 / 插画 / 3D）
- [x] IMG4 负向提示词输入
- [x] IMG5 图生图 / 风格参考图上传
- [x] IMG6 提示词历史与「用此参数再生成」
- [x] IMG7 画廊网格 / 大图两种视图切换
- [x] IMG8 单图删除与批量管理
- [x] IMG9 下载扩展名按真实 MIME 推断（当前 svg/png 混淆）
- [x] IMG10 生成中骨架屏占位
- [x] IMG11 生成图一键插入 PPT 配图位或文档光标处

---

# 第三部分 · P2 体验与质量打磨

## UX. 交互与界面（20 条）

> 现状：`Suspense` / skeleton / 虚拟滚动 / `useTransition` 实测均为 0；
> 响应式断点仅 71 处；深色模式是半成品（见 THEME 章）。

- [x] UX1 侧栏可折叠为纯图标条（正式壳层缺失，mockup 里已有参考实现）
- [x] UX2 历史列表按时间分组标题（今天 / 昨天 / 7 天内 / 更早）
- [x] UX3 历史项拖拽排序（手动置顶之外的自由排序）
- [x] UX4 空历史引导插画 + 首个模板直达入口
- [x] UX5 顶栏显示当前任务标题，点击就地重命名
- [x] UX6 全局生成中进度态（顶栏细进度条）
- [x] UX7 模式切换按钮窄屏只显图标 + tooltip
- [x] UX8 模型切换后 toast 提示当前模型与供应商
- [x] UX9 用户消息支持编辑后重发（实测缺失，仅助手侧有 regenerate）
- [x] UX10 输入框 ↑ 键召回上一条输入
- [x] UX11 输入草稿按会话自动保存，切换不丢失
- [x] UX12 输入框 token / 字数估算实时提示
- [x] UX13 流式输出时「暂停自动滚动」，允许回看
- [x] UX14 长任务阶段提示（思考 / 生成 / 渲染）
- [x] UX15 统一 loading skeleton 组件并铺到各列表与画布
- [x] UX16 统一空状态组件（插画 + 一句引导 + 一个主行动）
- [x] UX17 统一确认弹窗组件，替换散落的原生 confirm 与自定义实现
- [x] UX18 按钮禁用态统一 tooltip 说明原因
- [x] UX19 时间与数字格式化统一工具（相对时间 / 千分位 / 文件体积）
- [x] UX20 移动端适配：三栏在窄屏折叠为抽屉 + 底部切换栏

## KB. 快捷键与命令面板（8 条）

> 现状：13 个文件各自处理 keydown，有 `CommandPalette` 组件但快捷键分散、无统一注册。

- [ ] KB1 `src/lib/hotkeys.ts` 统一注册中心，避免各组件重复绑定与冲突
- [ ] KB2 `⌘/Ctrl+N` 新建任务并聚焦输入框
- [ ] KB3 `⌘/Ctrl+K` 唤起命令面板（核对现有绑定并纳入统一注册）
- [ ] KB4 `⌘/Ctrl+/` 或 `?` 弹出快捷键帮助面板
- [ ] KB5 `⌘/Ctrl+Enter` 发送、`Esc` 停止生成
- [ ] KB6 数字键 1-6 快速切换六个工作模式
- [ ] KB7 命令面板支持模糊搜索 + 最近使用排序
- [ ] KB8 输入框内屏蔽全局快捷键，避免误触

## PF. 性能（12 条）

> 现状：17 处 `useChatStore()` 全量订阅 vs 仅 8 处 selector 写法，
> 任一字段变更触发全树重渲染；`chat.ts` 单文件 1552 行。

- [ ] PF1 把 17 处全量订阅改为细粒度 selector + `useShallow`
- [ ] PF2 `chat.ts`（1552 行）按域拆分为 conversations / messages / slides / docs / images 多个 slice
- [ ] PF3 消息列表虚拟滚动（长会话）
- [ ] PF4 侧栏历史列表虚拟滚动
- [ ] PF5 图片 `loading="lazy"` + 宽高占位防抖动
- [ ] PF6 SSE 状态更新按帧批处理，避免每个 token 触发一次 render
- [ ] PF7 大 Markdown 分段渲染 + 增量解析
- [ ] PF8 重组件按需 `dynamic import`（PPTX 导出、Markdown 渲染器、图表）
- [ ] PF9 搜索与自动保存统一防抖工具
- [ ] PF10 `React.memo` 覆盖消息气泡与缩略图等高频重渲染组件
- [ ] PF11 6 处裸 `<img>` 评估替换为 `next/image`
- [ ] PF12 首屏 bundle 体积审计（`@next/bundle-analyzer`）并给出优化项

## THEME. 深色模式（6 条）

> 现状：**半成品**。`layout.tsx:17` 有 dark class 初始化脚本，
> 但切换开关只存在于 `mockup/ShellSidebar.tsx:42`，
> 且 `components/workspace/` 下 `dark:` 变体使用量为 **0**。

- [x] THEME1 正式壳层加入主题切换入口（浅色 / 深色 / 跟随系统三态）
- [x] THEME2 主题偏好持久化并与首屏脚本约定同一 storage key
- [x] THEME3 给 `components/workspace/` 全部组件补 `dark:` 变体（当前 0 处）
- [x] THEME4 CSS 变量化配色，避免逐个组件硬写 dark 类
- [x] THEME5 深色下代码块、Markdown 正文、幻灯片画布的对比度校准
- [x] THEME6 `prefers-reduced-motion` 时关闭非必要动画

## A11Y. 无障碍（10 条）

> 现状：`aria-*` 仅出现在 9 个文件，无焦点陷阱管理，弹窗未声明语义角色。

- [ ] A11Y1 所有弹窗补 `role="dialog"` + `aria-modal` + `aria-labelledby`
- [ ] A11Y2 弹窗焦点陷阱与关闭后焦点归还触发元素
- [ ] A11Y3 图标按钮补 `aria-label`（大量纯图标按钮当前无可读名称）
- [ ] A11Y4 全局可见焦点环样式，键盘导航可追踪
- [ ] A11Y5 流式输出区域 `aria-live="polite"`，屏幕阅读器可感知新内容
- [ ] A11Y6 表单错误与 `aria-describedby` 关联
- [ ] A11Y7 列表与选项卡补 `role` / `aria-selected`
- [ ] A11Y8 跳到主内容的 skip link
- [ ] A11Y9 配色对比度校验至 WCAG AA
- [ ] A11Y10 图片补有意义的 alt（装饰性图标显式置空）

## I18N. 国际化（8 条）

> 现状：`i18n.ts` DICT 约 60 key，但 **49 个 tsx 文件含硬编码中文**，覆盖率极低。

- [ ] I18N1 抽取脚本：扫描硬编码中文字面量并生成待翻译清单
- [ ] I18N2 按模块拆分词典命名空间（common / workspace / slides / research / settings）
- [ ] I18N3 分批替换 49 个文件的硬编码中文为 `t()` 调用
- [ ] I18N4 补齐英文文案（当前 en 词条大量缺失）
- [ ] I18N5 语言切换入口 + 偏好持久化
- [ ] I18N6 复数与插值支持（当前是简单键值映射）
- [ ] I18N7 日期时间与数字按 locale 格式化
- [ ] I18N8 CI 检查：新增硬编码中文时告警，防止覆盖率回退

## PG. 半成品页面与按钮核对（12 条）

> 现状：`apps` 页仅 9 处 onClick、`mockup` 页 **0 处 onClick**（纯静态原型）；
> `agents` 36 处、`knowledge` 27 处需逐一验证是否真有行为。

- [ ] PG1 `mockup/page.tsx` 定位：明确是设计原型还是待接线页面，决定接线或移出主路由
- [ ] PG2 `apps/page.tsx` 逐个卡片核对是否有真实跳转与功能
- [ ] PG3 `agents/page.tsx` 36 个交互点逐一核对（素材包串行任务的进度与失败处理）
- [ ] PG4 `knowledge/page.tsx` 27 个交互点核对（导入 / 检索 / 删除是否落库）
- [ ] PG5 知识库检索接入真实向量或全文检索，替换占位逻辑
- [ ] PG6 `s/[code]` 分享页：失效码、过期、加载中三态完善
- [ ] PG7 `membership/page.tsx` 支付链路明确「演示模式」标识，避免误解为真实支付
- [ ] PG8 `templates/page.tsx` 与 `TemplatesModal` 的重复逻辑合并
- [ ] PG9 `tools/page.tsx` 各工具的失败态与空结果态补齐
- [ ] PG10 落地页移动端适配与 FAQ 折叠区
- [ ] PG11 页脚补条款 / 隐私 / 联系方式
- [ ] PG12 全站 42 处 TODO / mock 标记逐条判定：落地、降级为演示标识、或删除

## SEC. 安全与合规续做（5 条）

> 上一轮已完成 22 项安全审查修复（见附录）。以下是明确留下的后续项。

- [ ] SEC1 真实身份认证与多用户数据隔离（当前中间件只做同源校验，非身份认证）
- [ ] SEC2 conversations 等表增 `userId` 维度并全链路带上
- [ ] SEC3 分享链接的访问控制与有效期（当前分享码永久有效且无权限校验）
- [ ] SEC4 敏感配置从 localStorage 迁至服务端加密存储（API Key 当前存前端）
- [ ] SEC5 依赖漏洞扫描纳入 CI（`npm audit` 或 Dependabot），并清理 prisma 卸载残留

---

# 附录 · 已完成的历史批次

## 安全与质量审查（22 项 · 已完成）

中间件来源校验（`src/middleware.ts`）、SSRF 防护（`src/lib/net-guard.ts`，含云元数据地址与逐跳重定向校验）、
JSON 解析统一收口（`src/lib/http.ts`，覆盖 15 个路由）、SQL 参数化、
`chat.ts` 22 处非空断言清零（改用 `patchMessages` / `findConvo`）、
`membershipRepo.get()` 递归栈溢出、hydrate 竞态、备份导入 undefined→null 归一化、
PDF base64 校验、导出文件名清洗、provider 白名单、原型链键绕过、
Prisma 死代码层移除、tailwind darkMode 配置、WAL autocheckpoint 等。

## 模板与提示词体系（N / O 批次 · 已完成）

模板库 80 个 / 10 分类、分类收纳导航、关键词搜索、`{{变量}}` 填空、收藏与最近使用、
自建提示词、斜杠命令、语气 / 长度 / 受众参数、一键素材包 6 套预设、
AI 提示词生成器、提示词导入导出与分享码。

## Persona 专家系统（P 批次 · 已完成）

17 个角色 / 6 大分组、system prompt 注入、会话级绑定（`conversations.personaId`）、
PersonaPicker 组件、两处入口与开场白试用。

## 早期界面重构（A / N 部分 · 已完成）

左栏图标宫格、模板库弹窗化、搜索与筛选收纳、侧栏宽度调整、底栏合并、图标 tooltip 统一等 35 项。

---

## 推进顺序建议

1. ~~**T 章测试体系 + CI**（18 条）— 后续所有改动的安全网，最先做~~ ✅
2. ~~**R 章健壮性**（16 条）— ErrorBoundary 与 storage 兜底，成本低收益高~~ ✅
3. ~~**O 章可观测性**（14 条）— 出问题时能定位~~ ✅
4. ~~**DB 章数据层**（16 条）— 分页、迁移与 FTS5~~ ✅
5. ~~**AI 章调用韧性**（15 条）— 重试/熔断/超时/计费落库/用量看板/SSE 协议统一~~ ✅
6. ~~**V 章 video 模式补完**（10 条）— 分镜结构化、故事板编辑器~~ ✅
7. ~~**DOC 章 docs 模式与文档编辑器**（12 条）— 富文本编辑、版本历史、导出~~ ✅
8. ~~**PPT 章幻灯片工作台**（14 条）— 大纲先行、单页重写、新版式、打印导出~~ ✅
9. ~~**RS 章研究模式**（11 条）— 分步时间线、来源勾选重写、失败保留半成品、去重与导出~~ ✅
10. ~~**IMG 章图像增强**（11 条）— 模型选择器、多张并发、风格/负向参数、图生图、历史、画廊管理与跨模式插入~~ ✅
11. ~~**UX 章交互与界面**（20 条）— /chat 切正式壳层、拖拽排序落库、时间分组、召回/草稿/滚动体验、统一空态与弹窗、移动端抽屉~~ ✅
12. ~~**THEME 章深色模式补完**（6 条）— 三态主题模块、首屏脚本口径统一、正式壳层切换入口、对比度校准、reduced-motion~~ ✅
13. **PF / A11Y / I18N / PG 打磨层** ← 下一批（P2 余量，建议从 A11Y 无障碍开始）

> 统计：P0 共 64 条 · P1 共 73 条 · P2 共 81 条 · **合计 218 条**（已完成 192 条）
