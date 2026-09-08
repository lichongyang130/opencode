/**
 * 绘图提示词预设（IMG3 / IMG4）。
 *
 * 风格与负向词从 ChatPanel 的本地常量抽到这里，理由有二：
 * 1. 风格要作为「生成参数」独立透传到服务端（不再文本追加进提示词），
 *    需要稳定的英文后缀供真实模型使用，本地散落的字符串没法复用；
 * 2. 负向词只有通义万相等支持负向语义的模型才消费，需要结构化字段区分。
 */

export interface ImageStyle {
  id: string;
  label: string;
  /** 英文提示词后缀：真实模型吃英文效果更好，演示模式则拼进占位图文本 */
  en: string;
}

export const IMAGE_STYLES: ImageStyle[] = [
  { id: "cinematic", label: "电影感海报", en: "cinematic movie poster, dramatic lighting" },
  { id: "3d", label: "3D 渲染", en: "3D render, octane, high detail" },
  { id: "watercolor", label: "水彩手绘", en: "watercolor painting, hand-drawn illustration" },
  { id: "cyberpunk", label: "赛博朋克", en: "cyberpunk, neon lights, futuristic city" },
  { id: "minimal", label: "极简扁平", en: "minimalist flat design, clean composition" },
  { id: "realistic", label: "写实摄影", en: "photorealistic, 8k, sharp focus" },
  { id: "illustration", label: "插画", en: "storybook illustration, warm colors" },
  { id: "product", label: "产品摄影", en: "product photography, studio lighting" },
];

export function imageStyleById(id: string | undefined): ImageStyle | undefined {
  if (!id) return undefined;
  return IMAGE_STYLES.find((s) => s.id === id);
}

/** 负向词快捷预设（IMG4）：一键填充，也可手动编辑 */
export const NEGATIVE_PRESETS = [
  "低质量，模糊，变形，多余的手指，肢体扭曲",
  "文字，水印，logo，签名",
  "过曝，噪点，色偏",
];

/**
 * 组合最终提示词（IMG3）。
 * 风格词放在最前：多数文生图模型对「风格限定词靠前」的响应更稳定。
 * style 未选时原样返回用户输入，保证旧行为（只传 prompt）完全不变。
 */
export function buildImagePrompt(prompt: string, style?: ImageStyle): string {
  if (!style) return prompt;
  return `${style.en}, ${prompt}`;
}