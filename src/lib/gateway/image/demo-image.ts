import type { ImageAdapter, ImageResult } from "./types";

/**
 * 演示绘图：无密钥时用 SVG 生成一张带渐变与提示词文字的占位图，
 * 返回 data URI，让绘图工作台零配置可完整体验。
 */
export const demoImageAdapter: ImageAdapter = {
  id: "demo",
  isConfigured() {
    return true;
  },
  async generate(prompt: string): Promise<ImageResult> {
    // 由提示词字符散列出两组色相，保证每张图不同
    let h = 0;
    for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) % 360;
    const h2 = (h + 60) % 360;
    const safe = prompt.replace(/[<>&]/g, (c) =>
      c === "<" ? "＜" : c === ">" ? "＞" : "＆"
    );
    const lines = wrap(safe, 18).slice(0, 3);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${h},70%,55%)"/>
      <stop offset="100%" stop-color="hsl(${h2},70%,45%)"/>
    </linearGradient>
    <radialGradient id="r" cx="30%" cy="25%" r="80%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" fill="url(#r)"/>
  <circle cx="820" cy="180" r="120" fill="rgba(255,255,255,0.12)"/>
  <circle cx="180" cy="860" r="180" fill="rgba(0,0,0,0.08)"/>
  <text x="64" y="120" font-family="sans-serif" font-size="40" font-weight="bold" fill="rgba(255,255,255,0.9)">AI 演示绘图</text>
  <text x="64" y="480" font-family="sans-serif" font-size="46" font-weight="bold" fill="#fff">${lines
    .map((l, i) => `<tspan x="64" dy="${i === 0 ? 0 : 64}">${l}</tspan>`)
    .join("")}</text>
  <text x="64" y="940" font-family="sans-serif" font-size="26" fill="rgba(255,255,255,0.75)">配置 OPENAI_API_KEY / DASHSCOPE_API_KEY 后生成真实图像</text>
</svg>`;

    return {
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      model: "demo-image",
    };
  },
};

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of text) {
    line += ch;
    if (line.length >= max) {
      out.push(line);
      line = "";
    }
  }
  if (line) out.push(line);
  return out;
}
