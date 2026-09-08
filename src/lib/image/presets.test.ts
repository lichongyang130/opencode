import { describe, expect, it } from "vitest";

/**
 * IMG3/IMG4 预设层测试：风格结构化参数是本批改动的核心契约 ——
 * buildImagePrompt 的拼接顺序（风格在前）与「未选风格时原样透传」
 * 直接决定服务端收到的提示词，必须锁死。
 */

import { buildImagePrompt, imageStyleById, IMAGE_STYLES, NEGATIVE_PRESETS } from "./presets";

describe("IMG3 风格预设", () => {
  it("八种风格 id 唯一且带英文后缀", () => {
    expect(IMAGE_STYLES).toHaveLength(8);
    const ids = new Set(IMAGE_STYLES.map((s) => s.id));
    expect(ids.size).toBe(IMAGE_STYLES.length);
    for (const s of IMAGE_STYLES) {
      expect(s.label).toBeTruthy();
      expect(s.en).toMatch(/[a-z]/);
    }
  });

  it("imageStyleById 命中返回对象，未传/未命中返回 undefined", () => {
    expect(imageStyleById("3d")?.label).toBe("3D 渲染");
    expect(imageStyleById(undefined)).toBeUndefined();
    expect(imageStyleById("nope")).toBeUndefined();
    expect(imageStyleById("")).toBeUndefined();
  });

  it("buildImagePrompt 把英文风格词前置拼接", () => {
    const style = imageStyleById("cinematic")!;
    expect(buildImagePrompt("一只猫", style)).toBe(
      "cinematic movie poster, dramatic lighting, 一只猫"
    );
  });

  it("未选风格时原样透传（旧行为不变）", () => {
    expect(buildImagePrompt("一只猫", undefined)).toBe("一只猫");
    expect(buildImagePrompt("一只猫", imageStyleById("nope"))).toBe("一只猫");
  });
});

describe("IMG4 负向预设", () => {
  it("提供至少三条可直接填充的快捷负向词", () => {
    expect(NEGATIVE_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const p of NEGATIVE_PRESETS) expect(p.length).toBeGreaterThan(0);
  });
});