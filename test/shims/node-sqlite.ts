import { createRequire } from "node:module";

/**
 * node:sqlite 在测试环境下的加载垫片。
 *
 * Node 22 起 node:sqlite 只能带 `node:` 前缀导入，Node 的 builtinModules 里
 * 记录的名字也是 `node:sqlite`；但 vite-node 判定内建模块时会先剥掉 `node:`
 * 前缀再查表（查 `sqlite`），因此判定失败，转而当成第三方包解析并报
 * 「Failed to load url sqlite」。
 *
 * 这里用 Node 原生 require 直接取真实模块，绕开打包器的解析链。
 * 仅在 vitest.config.ts 的 alias 中生效，不影响 next build。
 */
const nodeRequire = createRequire(import.meta.url);
const sqlite = nodeRequire("node:sqlite") as typeof import("node:sqlite");

export const { DatabaseSync } = sqlite;