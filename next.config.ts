import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/** 每次部署的版本號：Vercel 用 Git commit，本地建置用時間 */
function gitSha() {
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}
// 必須在每個建置程序中得出相同結果（next.config 會被載入多次），所以不可用時間
const BUILD_ID = process.env.READYGO_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? gitSha();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  async headers() {
    return [
      {
        source: "/api/version",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
