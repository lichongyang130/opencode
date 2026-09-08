import { describe, expect, it } from "vitest";
import { parseStoryboard } from "./parse";
import { formatDuration, totalDuration, durationWarning, type Storyboard } from "./types";
import { storyboardToMarkdown, storyboardToCsv } from "./export";
import { storyboardToDeck } from "./to-deck";
import { buildStoryboardPrompt, transitionOrDefault } from "./prompt";
import { buildSampleStoryboard } from "./sample";

/** V1/V2/V7/V8/V9 领域逻辑锁定 */

const sbOf = (shots: Partial<Storyboard["shots"][number]>[], targetSec = 30): Storyboard => ({
  title: "测试脚本",
  targetSec,
  shots: shots.map((s, i) => ({
    id: `s${i}`,
    scene: "场景",
    visual: "画面",
    durationSec: 5,
    transition: "cut",
    ...s,
  })),
});

describe("V1 类型与时长", () => {
  it("formatDuration 分钟:秒格式", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-3)).toBe("0:00");
    expect(formatDuration(600)).toBe("10:00");
  });

  it("totalDuration 汇总所有镜头，跳过非法负时长", () => {
    expect(totalDuration(sbOf([{ durationSec: 5 }, { durationSec: 3 }, { durationSec: -1 }]))).toBe(8);
  });

  it("V9 durationWarning：超 20% 提醒删减、不足 80% 提醒补充、范围内静默", () => {
    const target = 60;
    // 空分镜视为「不足目标」——刚建任务还没镜头时的提示同样成立
    expect(durationWarning(sbOf([], target)) as string).toContain("不足目标");
    expect(durationWarning(sbOf(new Array(15).fill({ durationSec: 5 }), target)) as string).toContain("超出目标");
    expect(durationWarning(sbOf(new Array(4).fill({ durationSec: 5 }), target)) as string).toContain("不足目标");
    // 60s 目标、10 镜 × 6s = 60s：范围内
    expect(durationWarning(sbOf(new Array(10).fill({ durationSec: 6 }), target))).toBeNull();
    // 未设目标：不提醒
    expect(durationWarning({ ...sbOf(new Array(14).fill({ durationSec: 5 })), targetSec: undefined })).toBeNull();
  });
});

describe("V2 解析", () => {
  it("合法 JSON 解析为分镜，时长钳制与转场归一", () => {
    const raw = JSON.stringify({
      title: "新品发布",
      targetSec: 30,
      style: "科技感",
      shots: [
        { scene: "外景", visual: "航拍城市", durationSec: 4, transition: "fade" },
        { scene: "室内", visual: "产品特写", durationSec: 0, transition: "unknown" },
      ],
    });
    const r = parseStoryboard(raw);
    expect(r.degraded).toBe(false);
    expect(r.storyboard.shots).toHaveLength(2);
    // durationSec=0 钳到 1；未知转场降级 cut
    expect(r.storyboard.shots[1].durationSec).toBe(1);
    expect(r.storyboard.shots[1].transition).toBe("cut");
    // 自动补 id
    expect(r.storyboard.shots[0].id).toBeTruthy();
  });

  it("缺 visual 的镜头被丢弃", () => {
    const raw = JSON.stringify({
      shots: [{ scene: "a", visual: "ok" }, { scene: "b", durationSec: 3 }],
    });
    const r = parseStoryboard(raw);
    expect(r.storyboard.shots).toHaveLength(1);
  });

  it("纯文本兜底：镜头编号 + 标签行归类（degraded 标记）", () => {
    const raw = [
      "镜头 1 城市清晨",
      "画面：航拍大远景，晨光穿过楼宇",
      "旁白：每一天都从这里开始",
      "时长 5 秒",
      "镜头 2 工作室",
      "画面：主角打磨作品",
    ].join("\n");
    const r = parseStoryboard(raw, "兜底");
    expect(r.degraded).toBe(true);
    expect(r.storyboard.shots).toHaveLength(2);
    expect(r.storyboard.shots[0].visual).toBe("航拍大远景，晨光穿过楼宇");
    expect(r.storyboard.shots[0].narration).toBe("每一天都从这里开始");
    expect(r.storyboard.shots[0].durationSec).toBe(5);
  });

  it("完全无结构的文本按行成镜，不抛错", () => {
    const r = parseStoryboard("就是一段普通文字");
    expect(r.degraded).toBe(true);
    expect(r.storyboard.shots.length).toBeGreaterThan(0);
  });

  it("transitionOrDefault 白名单外全部降级 cut", () => {
    expect(transitionOrDefault("fade")).toBe("fade");
    expect(transitionOrDefault("spin")).toBe("cut");
    expect(transitionOrDefault(undefined)).toBe("cut");
  });

  it("buildStoryboardPrompt 带时长与风格偏好", () => {
    const { system, user } = buildStoryboardPrompt("奶茶店宣传片", { targetSec: 45, style: "快节奏" });
    expect(system).toContain("只输出一个 JSON 对象");
    expect(user).toContain("45 秒");
    expect(user).toContain("快节奏");
  });
});

describe("V7 导出", () => {
  it("Markdown 脚本含镜号、场景、画面、旁白、总时长", () => {
    const md = storyboardToMarkdown(sbOf([{ scene: "外景", visual: "航拍", narration: "开场白" }]));
    expect(md).toContain("# 测试脚本");
    expect(md).toContain("镜头 1（外景·5s）");
    expect(md).toContain("**画面**：航拍");
    expect(md).toContain("**旁白**：开场白");
    expect(md).toContain("共 1 镜");
  });

  it("CSV 按 RFC 4180 转义逗号与引号", () => {
    const csv = storyboardToCsv(sbOf([{ visual: "产品,参数对比", narration: '说"重点"' }]));
    expect(csv).toContain('"产品,参数对比"');
    expect(csv).toContain('"说""重点"""');
    expect(csv.split("\r\n")[0]).toContain("镜号,场景,画面描述");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("可选字段缺失时 Markdown 仍可导出且不出现空旁白/字幕行", () => {
    // targetSec 传 0 表达「未设定」分支
    const md = storyboardToMarkdown(sbOf([{}], 0));
    expect(md).toContain("**目标时长**：未设定");
    expect(md).toContain("**转场**：cut");
    expect(md).not.toContain("**旁白**");
    expect(md).not.toContain("**字幕**");
  });

  it("带风格与目标时长的完整 Markdown 头部", () => {
    const sb = sbOf([{ scene: "内景", visual: "特写" }], 15);
    sb.style = "纪录片质感";
    const md = storyboardToMarkdown(sb);
    expect(md).toContain("> 风格：纪录片质感");
    expect(md).toContain("**目标时长**：0:15");
  });

  it("CSV 空行字段输出空串而非 undefined", () => {
    const csv = storyboardToCsv(sbOf([{}]));
    const row = csv.split("\r\n")[1];
    expect(row).toContain("未拍");
    expect(row).not.toContain("undefined");
  });
});

describe("V8 分镜转 PPT", () => {
  it("映射为 SlideDeck：cover + 每镜 content + end", () => {
    const deck = storyboardToDeck(buildSampleStoryboard("测试"));
    expect(deck.title).toContain("测试");
    expect(deck.slides[0].layout).toBe("cover");
    expect(deck.slides[deck.slides.length - 1].layout).toBe("end");
    // 示例分镜 5 镜 → 7 页（cover + 5 + end）
    expect(deck.slides).toHaveLength(7);
    const shotSlide = deck.slides[1];
    expect(shotSlide.title).toContain("镜头 1");
    expect(shotSlide.bullets?.[0]).toContain("画面：");
  });

  it("无旁白/字幕的镜头省略对应要点，无风格时省略副标题", () => {
    const deck = storyboardToDeck(sbOf([{}]));
    expect(deck.subtitle).toBeUndefined();
    const bullets = deck.slides[1].bullets ?? [];
    expect(bullets.join("\n")).not.toContain("旁白：");
    expect(bullets.join("\n")).not.toContain("字幕：");
    expect(bullets.join("\n")).toContain("转场：cut");
  });
});

describe("V2 示例分镜", () => {
  it("buildSampleStoryboard 结构完整可直接渲染", () => {
    const sb = buildSampleStoryboard("降噪耳机", 20, "科技感");
    expect(sb.shots.length).toBeGreaterThanOrEqual(4);
    expect(sb.targetSec).toBe(20);
    for (const s of sb.shots) {
      expect(s.visual).toBeTruthy();
      expect(s.durationSec).toBeGreaterThan(0);
      expect(["cut", "fade", "dissolve", "wipe", "zoom"]).toContain(s.transition);
    }
  });
});