import type { ImageModelInfo } from "./types";

export const IMAGE_MODELS: ImageModelInfo[] = [
  {
    id: "demo-image",
    label: "演示绘图（免费）",
    provider: "demo",
    providerLabel: "Built-in",
    region: "builtin",
    pricePerImage: 0,
    creditsPerImage: 0,
  },
  {
    id: "dall-e-3",
    label: "DALL·E 3",
    provider: "openai",
    providerLabel: "OpenAI",
    region: "global",
    pricePerImage: 0.04,
    creditsPerImage: 3,
  },
  {
    id: "wan2.7-t2i-flash",
    label: "通义万相 2.7 Flash",
    provider: "dashscope",
    providerLabel: "阿里云百炼",
    region: "china",
    pricePerImage: 0.02,
    creditsPerImage: 2,
  },
];

export function getImageModel(id: string): ImageModelInfo {
  return IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0];
}
