import { describe, expect, it } from "vitest";
import { MODELS, getModel, inferProvider, isKnownModel, resolveModel } from "./models";

/**
 * 模型解析测试（R14）。
 *
 * fallback 语义是这里的核心：模型下线或 id 拼错时会悄悄换成内置 demo，
 * 用户会把演示用的假回答当成真实模型输出。所以 resolveModel 必须准确回报
 * 「这次是否发生了兜底」，chat.ts 的 safeModel 才能弹提示并把请求体一起改掉。
 */

describe("MODELS 目录", () => {
  it("首项是演示模型（兜底时取 MODELS[0]）", () => {
    expect(MODELS[0].id).toBe("demo");
    expect(MODELS[0].provider).toBe("demo");
  });

  it("演示模型免费", () => {
    expect(MODELS[0].inputPricePerMtok).toBe(0);
    expect(MODELS[0].outputPricePerMtok).toBe(0);
  });

  it("模型 id 不重复", () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个模型都有完整的价格与地区信息", () => {
    for (const m of MODELS) {
      expect(typeof m.inputPricePerMtok).toBe("number");
      expect(typeof m.outputPricePerMtok).toBe("number");
      expect(["builtin", "china", "global"]).toContain(m.region);
      expect(m.capabilities.length).toBeGreaterThan(0);
    }
  });
});

describe("getModel", () => {
  it("命中时返回对应模型", () => {
    expect(getModel("qwen-plus").provider).toBe("dashscope");
  });

  it("未命中时回落到演示模型", () => {
    expect(getModel("不存在").id).toBe("demo");
    expect(getModel("").id).toBe("demo");
  });
});

describe("isKnownModel", () => {
  it.each(MODELS.map((m) => m.id))("%s 在静态目录里", (id) => {
    expect(isKnownModel(id)).toBe(true);
  });

  it.each([["gpt-5"], ["qwen3-next"], [""], ["DEMO"]])("%s 不在静态目录里", (id) => {
    expect(isKnownModel(id)).toBe(false);
  });
});

describe("inferProvider", () => {
  it.each([
    ["gpt-4.1", "openai"],
    ["gpt-5-mini", "openai"],
    ["o1-preview", "openai"],
    ["o3-mini", "openai"],
    ["o4-mini", "openai"],
    ["chatgpt-4o-latest", "openai"],
    ["claude-4-opus", "anthropic"],
    ["deepseek-reasoner", "deepseek"],
    ["qwen3-max", "dashscope"],
    ["wan2.5-t2i", "dashscope"],
  ] as const)("%s 推断为 %s", (id, provider) => {
    expect(inferProvider(id)).toBe(provider);
  });

  it("大小写不敏感", () => {
    expect(inferProvider("GPT-4O")).toBe("openai");
    expect(inferProvider("Claude-X")).toBe("anthropic");
  });

  it.each([[""], ["mistral-large"], ["llama-3"], ["glm-4"], ["未知模型"]])(
    "%s 推断不出供应商",
    (id) => {
      expect(inferProvider(id)).toBeNull();
    }
  );
});

describe("resolveModel 静态目录命中", () => {
  it("返回目录里的模型与其供应商，不算兜底", () => {
    const r = resolveModel("qwen-plus");
    expect(r.model.id).toBe("qwen-plus");
    expect(r.providerId).toBe("dashscope");
    expect(r.fallback).toBe(false);
  });

  it("静态目录优先于显式传入的 provider", () => {
    const r = resolveModel("qwen-plus", "openai");
    expect(r.providerId).toBe("dashscope");
    expect(r.fallback).toBe(false);
  });

  it("demo 自身不算兜底（否则每次用演示模型都会弹提示）", () => {
    const r = resolveModel("demo");
    expect(r.model.id).toBe("demo");
    expect(r.providerId).toBe("demo");
    expect(r.fallback).toBe(false);
  });
});

describe("resolveModel 动态模型", () => {
  it("显式 provider 时按它构造模型信息", () => {
    const r = resolveModel("gpt-5-turbo", "openai");
    expect(r.providerId).toBe("openai");
    expect(r.model).toMatchObject({ id: "gpt-5-turbo", label: "gpt-5-turbo", region: "global" });
    expect(r.fallback).toBe(false);
  });

  it("没给 provider 时按前缀推断", () => {
    const r = resolveModel("qwen3-max");
    expect(r.providerId).toBe("dashscope");
    expect(r.fallback).toBe(false);
  });

  it("国内供应商标记 china 地区", () => {
    expect(resolveModel("deepseek-v4").model.region).toBe("china");
    expect(resolveModel("qwen3-plus").model.region).toBe("china");
  });

  it("海外供应商标记 global 地区", () => {
    expect(resolveModel("gpt-9").model.region).toBe("global");
    expect(resolveModel("claude-5").model.region).toBe("global");
  });

  it("未知模型按低成本档计价", () => {
    const r = resolveModel("gpt-9");
    expect(r.model.inputPricePerMtok).toBe(0.5);
    expect(r.model.outputPricePerMtok).toBe(1.5);
  });

  it("显式 provider 能覆盖前缀推断（中转站把 qwen 挂在 openai 兼容口上）", () => {
    expect(resolveModel("qwen3-max", "openai").providerId).toBe("openai");
  });
});

describe("resolveModel 兜底", () => {
  it.each([
    ["空 id", ""],
    ["拼错的 id", "gtp-4o"],
    ["已下线的中转模型", "some-removed-model"],
    ["纯中文 id", "未知模型"],
  ])("%s 回退演示模型并标记 fallback", (_label, id) => {
    const r = resolveModel(id);
    expect(r.model.id).toBe("demo");
    expect(r.providerId).toBe("demo");
    expect(r.fallback).toBe(true);
  });

  it("显式传 demo 作为 provider 时也走兜底（demo 不接受自定义模型名）", () => {
    const r = resolveModel("random-model", "demo");
    expect(r.providerId).toBe("demo");
    expect(r.fallback).toBe(true);
  });

  it("provider 传 null 时按推断处理", () => {
    expect(resolveModel("gpt-9", null).providerId).toBe("openai");
    expect(resolveModel("未知", null).fallback).toBe(true);
  });

  it("兜底返回的是目录里的 demo 对象本身", () => {
    expect(resolveModel("不存在").model).toBe(MODELS[0]);
  });
});