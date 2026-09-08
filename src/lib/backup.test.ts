import { describe, expect, it } from "vitest";
import { BackupValidationError, validateBackup } from "./backup";

/**
 * 构造一份最小合法备份。
 *
 * 各用例通过 mutate 回调改坏其中一处，从而验证校验器是否精确定位到该字段——
 * 这样能同时防住「漏校验」和「误报其它字段」两类回归。
 */
function makeBackup(mutate?: (backup: Record<string, unknown>) => void) {
  const backup: Record<string, unknown> = {
    app: "opencanvas",
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    conversations: [
      {
        id: "c1",
        title: "会话一",
        mode: "chat",
        model: "gpt-4o",
        deck: null,
        images: [],
        report: null,
        doc: null,
        archived: false,
        pinned: false,
        createdAt: 1767225600000,
        updatedAt: 1767225600000,
        messages: [
          {
            id: "m1",
            conversationId: "c1",
            role: "user",
            content: "你好",
            error: false,
            createdAt: 1767225600000,
          },
        ],
      },
    ],
  };
  mutate?.(backup);
  return backup;
}

/** 取出第一个会话，供各用例改坏字段 */
function firstConvo(backup: Record<string, unknown>) {
  return (backup.conversations as Record<string, unknown>[])[0];
}

describe("validateBackup 合法输入", () => {
  it("接受最小合法备份并原样返回", () => {
    const input = makeBackup();
    expect(validateBackup(input)).toBe(input);
  });

  it("允许可选字段为 null", () => {
    const input = makeBackup((b) => {
      Object.assign(firstConvo(b), { modelProvider: null, personaId: null, deckStatus: null });
    });
    expect(() => validateBackup(input)).not.toThrow();
  });

  it("允许可选字段整体缺失（旧版本导出的备份没有这些键）", () => {
    const input = makeBackup((b) => {
      const c = firstConvo(b);
      delete c.modelProvider;
      delete c.personaId;
      delete c.deckStatus;
    });
    expect(() => validateBackup(input)).not.toThrow();
  });

  it("接受完整的 deck 与 report 结构", () => {
    const input = makeBackup((b) => {
      Object.assign(firstConvo(b), {
        deck: {
          title: "标题",
          theme: "violet",
          slides: [
            { layout: "cover", title: "封面" },
            { layout: "stats", stats: [{ value: "99%", label: "满意度" }] },
          ],
        },
        report: {
          topic: "主题",
          summary: "摘要",
          createdAt: 1767225600000,
          takeaways: ["要点"],
          sections: [{ heading: "小节", body: "正文" }],
          sources: [{ title: "来源", url: "https://example.com", snippet: "片段" }],
        },
      });
    });
    expect(() => validateBackup(input)).not.toThrow();
  });
});

describe("validateBackup 顶层字段", () => {
  it("拒绝非对象输入", () => {
    for (const bad of [null, undefined, 42, "x", [], true]) {
      expect(() => validateBackup(bad)).toThrow(BackupValidationError);
    }
  });

  it("拒绝非 opencanvas 备份", () => {
    expect(() => validateBackup(makeBackup((b) => (b.app = "other")))).toThrow(/不是 OpenCanvas 备份/);
  });

  it("拒绝不支持的版本号", () => {
    expect(() => validateBackup(makeBackup((b) => (b.version = 2)))).toThrow(/仅支持版本 1/);
  });

  it("拒绝非法的 exportedAt 日期", () => {
    expect(() => validateBackup(makeBackup((b) => (b.exportedAt = "不是日期")))).toThrow(
      /必须是有效日期/
    );
  });

  it("拒绝 conversations 不是数组", () => {
    expect(() => validateBackup(makeBackup((b) => (b.conversations = {})))).toThrow(/必须是数组/);
  });

  it("接受空 conversations 数组", () => {
    expect(() => validateBackup(makeBackup((b) => (b.conversations = [])))).not.toThrow();
  });
});

describe("validateBackup 会话字段", () => {
  it("拒绝空白 id", () => {
    expect(() => validateBackup(makeBackup((b) => (firstConvo(b).id = "   ")))).toThrow(
      /conversations\[0\]\.id/
    );
  });

  it("拒绝未知 mode", () => {
    expect(() => validateBackup(makeBackup((b) => (firstConvo(b).mode = "unknown")))).toThrow(
      /conversations\[0\]\.mode/
    );
  });

  it("拒绝未知 deckStatus", () => {
    expect(() => validateBackup(makeBackup((b) => (firstConvo(b).deckStatus = "running")))).toThrow(
      /deckStatus/
    );
  });

  it("拒绝非布尔的 archived / pinned", () => {
    expect(() => validateBackup(makeBackup((b) => (firstConvo(b).archived = 1)))).toThrow(
      /必须是布尔值/
    );
    expect(() => validateBackup(makeBackup((b) => (firstConvo(b).pinned = "true")))).toThrow(
      /必须是布尔值/
    );
  });

  it("拒绝非法时间戳（NaN / 负数 / 超范围 / 字符串）", () => {
    for (const bad of [Number.NaN, -1, 8640000000000001, "1767225600000"]) {
      expect(() => validateBackup(makeBackup((b) => (firstConvo(b).createdAt = bad)))).toThrow(
        /必须是有效的毫秒时间戳/
      );
    }
  });

  it("拒绝备份内会话 ID 重复", () => {
    const input = makeBackup((b) => {
      const list = b.conversations as Record<string, unknown>[];
      list.push({ ...list[0], messages: [] });
    });
    expect(() => validateBackup(input)).toThrow(/备份内会话 ID 重复/);
  });

  it("拒绝会话内图片 ID 重复", () => {
    const image = {
      id: "img1",
      prompt: "p",
      model: "m",
      url: "u",
      createdAt: 1767225600000,
    };
    const input = makeBackup((b) => (firstConvo(b).images = [image, { ...image }]));
    expect(() => validateBackup(input)).toThrow(/会话内图片 ID 重复/);
  });
});

describe("validateBackup 消息字段", () => {
  it("拒绝消息 conversationId 与所属会话不一致（防止张冠李戴）", () => {
    const input = makeBackup((b) => {
      const messages = firstConvo(b).messages as Record<string, unknown>[];
      messages[0].conversationId = "other";
    });
    expect(() => validateBackup(input)).toThrow(/消息不属于所在会话/);
  });

  it("拒绝未知 role", () => {
    const input = makeBackup((b) => {
      const messages = firstConvo(b).messages as Record<string, unknown>[];
      messages[0].role = "system";
    });
    expect(() => validateBackup(input)).toThrow(/role/);
  });

  it("拒绝跨会话的消息 ID 重复", () => {
    const input = makeBackup((b) => {
      const list = b.conversations as Record<string, unknown>[];
      list.push({
        ...list[0],
        id: "c2",
        messages: [{ ...(list[0].messages as Record<string, unknown>[])[0], conversationId: "c2" }],
      });
    });
    expect(() => validateBackup(input)).toThrow(/备份内消息 ID 重复/);
  });

  it("拒绝 messages 不是数组", () => {
    expect(() => validateBackup(makeBackup((b) => (firstConvo(b).messages = null)))).toThrow(
      /必须是数组/
    );
  });
});

/** V3：video 分镜校验。合法骨架一次过，再逐字段改坏验证报错路径 */
function makeStoryboard(): Record<string, unknown> {
  return {
    title: "产品宣传片",
    targetSec: 60,
    style: "商业感",
    shots: [
      {
        id: "shot-1",
        scene: "开场",
        visual: "城市天际线航拍",
        narration: "全新一代",
        subtitle: "重磅登场",
        imagePrompt: "城市天际线，航拍",
        imageUrl: "https://example.com/a.png",
        audioUrl: null,
        durationSec: 5,
        transition: "fade",
      },
    ],
  };
}

/** 往第一个会话挂上分镜并返回第 0 镜，供用例改坏镜头级字段（避免对 unknown 链式取值） */
function firstShot(b: Record<string, unknown>): Record<string, unknown> {
  const sb = makeStoryboard();
  firstConvo(b).video = sb;
  return (sb.shots as Record<string, unknown>[])[0];
}

describe("validateBackup video 分镜（V3）", () => {
  it("接受完整的 video 分镜结构", () => {
    const input = makeBackup((b) => {
      Object.assign(firstConvo(b), { video: makeStoryboard(), videoStatus: "done" });
    });
    expect(() => validateBackup(input)).not.toThrow();
  });

  it("video 为 null 或缺失时跳过校验（旧版本备份没有该键）", () => {
    for (const video of [null, undefined]) {
      const input = makeBackup((b) => {
        Object.assign(firstConvo(b), { video, videoStatus: null });
      });
      expect(() => validateBackup(input)).not.toThrow();
    }
  });

  it("拒绝 video 不是对象", () => {
    const input = makeBackup((b) => (firstConvo(b).video = 42));
    expect(() => validateBackup(input)).toThrow(/conversations\[0\]\.video/);
  });

  it("拒绝非法 title 与非法 targetSec / style", () => {
    // title 允许空串（与 deck.title 一致），只有非字符串才拒
    expect(() =>
      validateBackup(makeBackup((b) => ((firstConvo(b).video = makeStoryboard()).title = 42)))
    ).toThrow(/title/);
    for (const targetSec of [0, -5, "60", Number.POSITIVE_INFINITY]) {
      const input = makeBackup((b) => ((firstConvo(b).video = makeStoryboard()).targetSec = targetSec));
      expect(() => validateBackup(input)).toThrow(/targetSec/);
    }
    const badStyle = makeBackup((b) => ((firstConvo(b).video = makeStoryboard()).style = 42));
    expect(() => validateBackup(badStyle)).toThrow(/style/);
  });

  it("targetSec 为 null 视为未设置，不报错", () => {
    const input = makeBackup((b) => ((firstConvo(b).video = makeStoryboard()).targetSec = null));
    expect(() => validateBackup(input)).not.toThrow();
  });

  it("拒绝 shots 非数组与镜头骨架缺失", () => {
    const badShots = makeBackup((b) => ((firstConvo(b).video = makeStoryboard()).shots = "x"));
    expect(() => validateBackup(badShots)).toThrow(/shots/);

    const missingVisual = makeBackup((b) => {
      const sb = firstConvo(b).video = makeStoryboard();
      delete (sb.shots as Record<string, unknown>[])[0].visual;
    });
    expect(() => validateBackup(missingVisual)).toThrow(/shots\[0\]\.visual/);

    const badId = makeBackup((b) => (firstShot(b).id = ""));
    expect(() => validateBackup(badId)).toThrow(/id/);
  });

  it("拒绝可选字段传非字符串（narration 等）", () => {
    const input = makeBackup((b) => (firstShot(b).narration = 42));
    expect(() => validateBackup(input)).toThrow(/narration/);
  });

  it("拒绝非法 durationSec（非数字 / 非正数 / 超 60）", () => {
    for (const durationSec of [0, -1, "5", 61, Number.NaN]) {
      const input = makeBackup((b) => (firstShot(b).durationSec = durationSec));
      expect(() => validateBackup(input)).toThrow(/durationSec/);
    }
  });

  it("拒绝未知转场类型", () => {
    const input = makeBackup((b) => (firstShot(b).transition = "flash"));
    expect(() => validateBackup(input)).toThrow(/transition/);
  });

  it("拒绝未知 videoStatus", () => {
    const input = makeBackup((b) => (firstConvo(b).videoStatus = "loading "));
    expect(() => validateBackup(input)).toThrow(/videoStatus/);
  });
});