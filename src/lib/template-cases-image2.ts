import type { TemplateCase } from "./templates";

/** 绘图类第 2 个真实案例（不同参数生成的真实效果图）。变量名与模板一致。 */
export const IMAGE_CASES_2: Record<string, TemplateCase[]> = {
  "m-brand-poster": [{ label: "暮山咖啡海报", values: { 品牌或产品: "暮山咖啡", "风格，如清新水彩": "深棕极简" }, image: "/cases/m-brand-poster-2.jpg", source: "真实模型生成" }],
  "ec-product-img": [{ label: "帆布鞋白底主图", values: { 商品: "帆布鞋，纯白背景，柔光无阴影" }, image: "/cases/ec-product-img-2.jpg", source: "真实模型生成" }],
  "d-corgi": [{ label: "南瓜田柯基", values: { "场景，如阳光草地": "秋日南瓜田，午后阳光" }, image: "/cases/d-corgi-2.jpg", source: "真实模型生成" }],
  "d-cyber": [{ label: "赛博女性角色", values: { "角色性别/年龄": "年轻女性", "服装/配饰": "紫粉霓虹机能服", 背景场景: "未来都市夜雨街头" }, image: "/cases/d-cyber-2.jpg", source: "真实模型生成" }],
  "d-mascot": [{ label: "熊猫环保吉祥物", values: { "品牌形象，如科技蓝机器人": "憨态可掬的熊猫", 主色调: "环保绿与白" }, image: "/cases/d-mascot-2.jpg", source: "真实模型生成" }],
  "d-logo": [{ label: "花间花店 logo", values: { 品牌名: "花间", 行业: "花店" }, image: "/cases/d-logo-2.jpg", source: "真实模型生成" }],
  "d-watercolor": [{ label: "秋日森林水彩", values: { 画面主题: "秋日森林小路", "色调，如清新淡雅": "暖金柔和" }, image: "/cases/d-watercolor-2.jpg", source: "真实模型生成" }],
  "d-product": [{ label: "香水产品摄影", values: { 产品: "香水瓶", "场景，如极简办公桌": "大理石台面，柔和侧光" }, image: "/cases/d-product-2.jpg", source: "真实模型生成" }],
  "d-avatar": [{ label: "阳光男孩卡通头像", values: { "风格，如动漫/写实": "扁平卡通", 性别年龄外貌描述: "阳光男孩，短发，浅色T恤" }, image: "/cases/d-avatar-2.jpg", source: "真实模型生成" }],
  "d-cover": [{ label: "时间管理封面", values: { 主题: "时间管理", 风格: "简洁几何色块" }, image: "/cases/d-cover-2.jpg", source: "真实模型生成" }],
};
