/**
 * 招待制アルファ公開に向けた最低限の安全なセキュリティヘッダー群。
 *
 * - 外部通信の実態(Supabase Auth/RESTのみ。選手・監督画像は自ドメインのAPI Route経由の
 *   プロキシで配信し、外部ホストへ直接アクセスしない。analytics・広告・外部フォントCDN・
 *   GitHub連携は未使用。Supabase Realtime(WebSocket)も未使用)に基づいて設計している。
 * - 開発時(`next dev`)はFast Refresh(eval)とHMR用WebSocketが必要なため、
 *   本番とは異なるCSPを返す。
 * - `next.config.mjs`はNode.jsが直接読み込むため、TypeScriptへ変換せずプレーンな
 *   ESモジュールとして実装する(Vitestからは`.test.ts`経由でそのままimportしてテストする)。
 * - nonceベースの厳格なCSP(`script-src 'self'`のみ)は、App Routerのストリーミング用
 *   インラインスクリプトとの整合を本番環境で個別に検証してから次段階で導入する候補とし、
 *   今回は互換性を優先して`script-src`/`style-src`に`'unsafe-inline'`を含める。
 */

const SUPABASE_CONNECT_SRC = "https://*.supabase.co";

/** @param {boolean} isDev */
export function buildContentSecurityPolicy(isDev) {
  const directives = [
    "default-src 'self'",
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    isDev
      ? `connect-src 'self' ${SUPABASE_CONNECT_SRC} ws://localhost:* wss://localhost:*`
      : `connect-src 'self' ${SUPABASE_CONNECT_SRC}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  return directives.join("; ");
}

/**
 * 全ルートへ適用する最低限のセキュリティヘッダー(`next.config.mjs`の`headers()`から使う)。
 * @param {boolean} isDev
 * @returns {{key: string, value: string}[]}
 */
export function buildSecurityHeaders(isDev) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(isDev) },
    // 招待制ベータの間は、HTMLのmeta robotsが届かないAPI(JSON)・画像を含む全応答を検索対象外にする。
    // 解除は一般公開の本人承認事項(search-indexing.tsのSITE_ROBOTS_METADATA・robots.tsと同時に変更する)。
    { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ];
}
