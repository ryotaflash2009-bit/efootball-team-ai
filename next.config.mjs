import { buildSecurityHeaders } from "./src/lib/security/security-headers.mjs";

const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 画面・内部APIは外部サイトを直接呼ばない方針のため、
  // 現時点でリモート画像の許可は設定しない（必要になった段階で images.remotePatterns を追加）。
  // /tier と /tier?position=XX は /tier/XX へ（2026-10-24: ポジションごとのページに分けた・308 で検索エンジンにも伝える）
  async redirects() {
    const positions = "GK|CB|LB|RB|DMF|CMF|LMF|RMF|AMF|LWF|RWF|SS|CF";
    return [
      { source: "/tier", has: [{ type: "query", key: "position", value: `(?<pos>${positions})` }], destination: "/tier/:pos", permanent: true },
      { source: "/tier", destination: "/tier/CF", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(isDev),
      },
    ];
  },
};

export default nextConfig;
