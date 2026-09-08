import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 测试配置。
 *
 * 默认用 node 环境：大部分测试聚焦服务端逻辑（数据库、备份校验、SSRF 防护、
 * 中间件鉴权），不需要 DOM。组件测试按目录切到 jsdom。
 */
export default defineConfig({
  // tsconfig 的 jsx 是 "preserve"（交给 Next 编译），但 vitest 直接用 esbuild
  // 转译，必须显式指定 automatic，否则 tsx 会走 classic 转换要求作用域内有 React
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // 组件测试需要 DOM；服务端测试留在 node 环境，避免无谓的 jsdom 启动开销
    environmentMatchGlobs: [
      ["src/components/**", "jsdom"],
      ["src/hooks/**", "jsdom"],
      ["src/app/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./test/setup.ts"],
    // 数据库测试各自创建独立的临时库文件，但同一文件内的用例串行执行，
    // 避免共享 sqlite 单例句柄互相干扰
    sequence: { concurrent: false },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "json-summary"],
      include: ["src/lib/**/*.ts", "src/middleware.ts"],
      // 纯数据/文案模块没有分支逻辑，纳入统计只会稀释真实覆盖率
      exclude: [
        "src/lib/template-cases*.ts",
        "src/lib/templates.ts",
        "src/lib/personas.ts",
        "src/lib/capabilities.ts",
        "src/lib/packs.ts",
        "src/lib/agents.ts",
        "src/lib/i18n.ts",
        "src/lib/**/*.test.ts",
      ],
      /**
       * 覆盖率门禁只卡「已经建好测试防护网」的模块，按文件维度锁死。
       *
       * 不设全局阈值：项目里还有大量尚未补测的模块（tools/knowledge/research 等），
       * 拿全局平均值当门禁只能设到 30% 上下，起不到防回退的作用。改成逐模块卡线后，
       * 任何改动让这些模块覆盖率掉下来都会直接让 CI 失败。
       * 阈值取实测值下调几个点，给重构留余量；后续批次补测新模块时同步往这里加条目。
       */
      thresholds: {
        "src/middleware.ts": { statements: 95, branches: 95, functions: 100, lines: 95 },
        "src/lib/{case-share,http,utils,slash,json-loose}.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "src/lib/backup.ts": { statements: 90, branches: 90, functions: 100, lines: 90 },
        "src/lib/net-guard.ts": { statements: 90, branches: 78, functions: 100, lines: 90 },
        "src/lib/fetcher.ts": { statements: 95, branches: 90, functions: 100, lines: 95 },
        "src/lib/sse.ts": { statements: 92, branches: 85, functions: 100, lines: 92 },
        "src/lib/safe-storage.ts": { statements: 95, branches: 90, functions: 100, lines: 95 },
        // UX19：时间/数字/体积格式化（12 用例锁边界行为）
        "src/lib/format.ts": { statements: 100, branches: 95, functions: 100, lines: 100 },
        // THEME 章：三态主题模块（10 用例锁 storage 口径与系统跟随语义）
        "src/lib/theme.ts": { statements: 95, branches: 85, functions: 100, lines: 95 },
        "src/lib/gateway/credits.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        // 只卡 gateway 根目录的模型目录；image/models.ts 还没补测，不能一起纳入
        "src/lib/gateway/models.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        // AI 章：重试包装与网关入口（韧性链路核心）
        "src/lib/gateway/retry.ts": { statements: 95, branches: 95, functions: 100, lines: 95 },
        "src/lib/gateway/index.ts": { statements: 95, branches: 90, functions: 100, lines: 95 },
        // AI14：SSE 事件协议编解码唯一入口
        "src/lib/sse-events.ts": { statements: 100, branches: 85, functions: 100, lines: 100 },
        "src/lib/slides/parse.ts": { statements: 95, branches: 88, functions: 100, lines: 95 },
        // V 章：video 领域纯逻辑模块（download.ts 是 DOM 副作用封装，jsdom 才能测，不纳入）
        "src/lib/video/types.ts": { statements: 95, branches: 90, functions: 100, lines: 95 },
        "src/lib/video/prompt.ts": { statements: 95, branches: 90, functions: 100, lines: 95 },
        "src/lib/video/parse.ts": { statements: 85, branches: 75, functions: 100, lines: 85 },
        "src/lib/video/export.ts": { statements: 85, branches: 80, functions: 60, lines: 85 },
        "src/lib/video/to-deck.ts": { statements: 95, branches: 95, functions: 100, lines: 95 },
        "src/lib/video/sample.ts": { statements: 95, branches: 70, functions: 100, lines: 95 },
        // DOC 章：文档领域模块（export.ts 的 download* 是 DOM 副作用，node 环境测不到，函数阈值放宽）
        "src/lib/docs/export.ts": { statements: 75, branches: 80, functions: 55, lines: 75 },
        "src/lib/docs/outline.ts": { statements: 95, branches: 90, functions: 100, lines: 95 },
        "src/lib/docs/stats.ts": { statements: 95, branches: 95, functions: 100, lines: 95 },
        // PPT 章：大纲先行与溢出检测纯逻辑模块
        "src/lib/slides/outline.ts": { statements: 95, branches: 90, functions: 100, lines: 95 },
        "src/lib/slides/overflow.ts": { statements: 85, branches: 55, functions: 100, lines: 85 },
        // RS 章：深度研究领域（engine 含 Tavily 检索与综述降级链路；sample-report 是纯数据组装；
        // url.ts 是客户端组件也会引用的零依赖工具，必须锁死）
        "src/lib/research/engine.ts": { statements: 95, branches: 80, functions: 100, lines: 95 },
        "src/lib/research/url.ts": { statements: 100, branches: 90, functions: 100, lines: 100 },
        "src/lib/research/sample-report.ts": { statements: 95, branches: 45, functions: 100, lines: 95 },
        // IMG 章：绘图领域纯逻辑（预设/MIME/历史三个新模块本批补齐测试后锁死）
        "src/lib/image/presets.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/lib/image/mime.ts": { statements: 100, branches: 90, functions: 100, lines: 100 },
        "src/lib/image/history.ts": { statements: 100, branches: 75, functions: 100, lines: 100 },
        "src/lib/db/repo.ts": { statements: 95, branches: 72, functions: 100, lines: 95 },
        "src/lib/db/sqlite.ts": { statements: 88, branches: 85, functions: 100, lines: 88 },
        "src/lib/db/db-maintenance.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/lib/db/image-store.ts": { statements: 98, branches: 95, functions: 100, lines: 98 },
        "src/lib/store/toast.ts": { statements: 90, branches: 100, functions: 60, lines: 90 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // node:sqlite 是 Node 22 新增的内建模块，vite-node 判定内建模块时会先剥掉
      // `node:` 前缀再查表（查 `sqlite`），对这个模块判定失败后当成第三方包解析，
      // 报「Failed to load url sqlite」。用垫片走 Node 原生 require 绕开解析链。
      "node:sqlite": path.resolve(__dirname, "./test/shims/node-sqlite.ts"),
    },
  },
});
