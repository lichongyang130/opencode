import { execSync } from "node:child_process";

/** 构建时固化 commit sha 与时间，供 /api/version 与 BUILD_ID 使用（O8） */
function commitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    // 不在 git 仓库里（CI 的源码包）时回退，不至于让构建失败
    return "unknown";
  }
}

const BUILD_TIME = new Date().toISOString();
const COMMIT = commitSha();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 版本信息注入：BUILD_TIME 参与静态替换，version 路由直接读 process.env
  env: { BUILD_TIME },
  generateBuildId: async () => `${COMMIT}-${BUILD_TIME.replace(/[:.]/g, "-")}`,
  reactStrictMode: true,
  // 允许 Arena 预览代理域（e2b.app）访问开发服务器资源，避免跨域警告
  allowedDevOrigins: ["*.e2b.app", "localhost:3000", "127.0.0.1:3000", "[::1]:3000"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "openai.com" },
      { protocol: "https", hostname: "www.openai.com" },
      { protocol: "https", hostname: "anthropic.com" },
      { protocol: "https", hostname: "www.anthropic.com" },
      { protocol: "https", hostname: "deepseek.com" },
      { protocol: "https", hostname: "www.deepseek.com" },
      { protocol: "https", hostname: "dashscope.aliyun.com" },
      { protocol: "https", hostname: "tongyi.com" },
      { protocol: "https", hostname: "www.tongyi.com" },
    ],
  },
};

export default nextConfig;
