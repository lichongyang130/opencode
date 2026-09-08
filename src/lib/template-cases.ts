import type { TemplateCase } from "./templates";
import { TEXT_CASES_A } from "./template-cases-text-a";
import { TEXT_CASES_A2 } from "./template-cases-text-a2";
import { TEXT_CASES_B } from "./template-cases-text-b";
import { TEXT_CASES_B2 } from "./template-cases-text-b2";
import { IMAGE_CASES_2 } from "./template-cases-image2";

/**
 * 内置真实案例库。
 *
 * 原则：只收「真实跑过」的案例。
 * - 绘图类 10 条：效果图由真实图像模型按模板原句 prompt（变量填入下方真实值）生成，
 *   即「这句话 → 这张图」，可在 public/cases/ 下核对原图。
 * - 文字类 60 条：等接入真实模型密钥后逐条跑真实产物再补，不造假。
 *
 * values 的 key 必须与模板里 {{变量}} 的名称一致（见 extractVariables）。
 */
const IMAGE_CASES: Record<string, TemplateCase[]> = {
  "m-brand-poster": [
    {
      label: "云栖茶事 · 清新水彩",
      values: { 品牌或产品: "云栖茶事", "风格，如清新水彩": "清新水彩" },
      image: "/cases/m-brand-poster.jpg",
      source: "真实图像模型生成",
    },
  ],
  "ec-product-img": [
    {
      label: "不锈钢保温杯 · 白底主图",
      values: { 商品: "不锈钢真空保温杯" },
      image: "/cases/ec-product-img.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-corgi": [
    {
      label: "月球柯基 · 电影感",
      values: {},
      image: "/cases/d-corgi.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-cyber": [
    {
      label: "赛博朋克 · 雨夜霓虹",
      values: {},
      image: "/cases/d-cyber.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-mascot": [
    {
      label: "科技蓝机器人 IP",
      values: { 主色调: "科技蓝与银白主色调" },
      image: "/cases/d-mascot.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-logo": [
    {
      label: "沐光 · 智能家居 Logo",
      values: { 品牌名: "沐光", 行业: "智能家居" },
      image: "/cases/d-logo.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-watercolor": [
    {
      label: "江南水乡 · 清晨水彩",
      values: { 画面主题: "江南水乡的清晨" },
      image: "/cases/d-watercolor.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-product": [
    {
      label: "降噪耳机 · 原木桌面",
      values: { 产品: "无线降噪耳机", "场景，如极简办公桌": "极简原木办公桌" },
      image: "/cases/d-product.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-avatar": [
    {
      label: "写实 · 职业头像",
      values: { "风格，如动漫/写实": "写实", 性别年龄外貌描述: "三十岁亚洲女性，齐肩黑发，浅色针织衫" },
      image: "/cases/d-avatar.jpg",
      source: "真实图像模型生成",
    },
  ],
  "d-cover": [
    {
      label: "《AI 时代的工作方式》封面",
      values: { 主题: "AI 时代的工作方式", 风格: "极简几何风格" },
      image: "/cases/d-cover.jpg",
      source: "真实图像模型生成",
    },
  ],
};

function mergeCases(
  ...sources: Record<string, TemplateCase[]>[]
): Record<string, TemplateCase[]> {
  const out: Record<string, TemplateCase[]> = {};
  for (const src of sources) {
    for (const [id, arr] of Object.entries(src)) {
      out[id] = [...(out[id] ?? []), ...arr];
    }
  }
  return out;
}

/** 全量案例 = 绘图真实效果图 + 文字真实输出（每模板多例拼接） */
export const TEMPLATE_CASES: Record<string, TemplateCase[]> = mergeCases(
  TEXT_CASES_A,
  TEXT_CASES_A2,
  TEXT_CASES_B,
  TEXT_CASES_B2,
  IMAGE_CASES,
  IMAGE_CASES_2
);

export function getTemplateCases(id: string): TemplateCase[] {
  return TEMPLATE_CASES[id] ?? [];
}

/** 统计已配真实案例的模板数 / 案例总数 */
export function caseStats(): { templates: number; cases: number } {
  const ids = Object.keys(TEMPLATE_CASES);
  return { templates: ids.length, cases: ids.reduce((n, id) => n + TEMPLATE_CASES[id].length, 0) };
}
