import { buildSecurityHeaders } from "./src/lib/security/security-headers.mjs";

const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 画面・内部APIは外部サイトを直接呼ばない方針のため、
  // 現時点でリモート画像の許可は設定しない（必要になった段階で images.remotePatterns を追加）。
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
