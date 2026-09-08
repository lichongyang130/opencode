import { describe, expect, it } from "vitest";

/**
 * IMG9 MIME 推断测试：下载扩展名必须与真实内容一致 ——
 * data URI 声明什么就是什么，外链按路径扩展名反查，认不出来保守回落 png。
 */

import { downloadImageName, extensionForMime, extensionFromUrl, mimeFromUrl } from "./mime";

describe("mimeFromUrl", () => {
  it("data URI 按声明解析", () => {
    expect(mimeFromUrl("data:image/svg+xml;base64,PHN2Zw==")).toBe("image/svg+xml");
    expect(mimeFromUrl("data:image/png;base64,iVBOR")).toBe("image/png");
    expect(mimeFromUrl("data:image/jpeg;base64,x")).toBe("image/jpeg");
  });

  it("http URL 按路径扩展名反查", () => {
    expect(mimeFromUrl("https://cdn.example.com/a.jpg")).toBe("image/jpeg");
    expect(mimeFromUrl("https://cdn.example.com/a.webp?x=1")).toBe("image/webp");
    expect(mimeFromUrl("https://cdn.example.com/a.png#frag")).toBe("image/png");
    expect(mimeFromUrl("/api/files/xyz.svg")).toBe("image/svg+xml");
  });

  it("无扩展名/未知扩展名保守回落 png", () => {
    expect(mimeFromUrl("https://cdn.example.com/raw")).toBe("image/png");
    expect(mimeFromUrl("https://cdn.example.com/a.tiff")).toBe("image/png");
  });
});

describe("extensionForMime / extensionFromUrl", () => {
  it("已知 MIME 映射到扩展名", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/svg+xml")).toBe("svg");
    expect(extensionForMime("image/webp")).toBe("webp");
  });

  it("大小写不敏感，未知回落 png", () => {
    expect(extensionForMime("IMAGE/PNG")).toBe("png");
    expect(extensionForMime("image/heic")).toBe("png");
  });

  it("组合推断：SVG data URI 出 .svg，jpg 外链出 .jpg", () => {
    expect(extensionFromUrl("data:image/svg+xml;base64,PHN2Zw==")).toBe("svg");
    expect(extensionFromUrl("https://cdn.example.com/a.jpg")).toBe("jpg");
    expect(extensionFromUrl("https://cdn.example.com/noext")).toBe("png");
  });
});

describe("IMG9 downloadImageName", () => {
  it("标题 + 正确扩展名", () => {
    expect(downloadImageName("赛博朋克城市", "data:image/png;base64,x")).toBe("赛博朋克城市.png");
    expect(downloadImageName("cat", "https://a.com/x.jpg")).toBe("cat.jpg");
  });

  it("非法文件名字符逐个替换为下划线并截断到 40 字符", () => {
    expect(downloadImageName('a/b:c*d?"<>|e', "data:image/png;base64,x")).toBe("a_b_c_d_____e.png");
    const long = "x".repeat(60);
    const name = downloadImageName(long, "data:image/png;base64,x");
    expect(name).toBe(`${"x".repeat(40)}.png`);
  });

  it("空标题回落 image", () => {
    expect(downloadImageName("", "https://a.com/x.jpg")).toBe("image.jpg");
  });
});