import { ImageResponse } from "next/og";

/**
 * Open Graph / Twitter カードの既定の画像（1200×630・2026-10-08）。検索への登録を許可したときだけ meta から参照する。
 * 文字は英数字だけ（フォントの読み込みを不要にする）。外部の画像・ロゴは使わない。
 */
export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b0f12",
          color: "#e8eef2",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>TeamAIXI</div>
        <div style={{ fontSize: 40, marginTop: 24, color: "#9fb3c0" }}>eFootball squad diagnosis, player comparison and progression</div>
        <div style={{ fontSize: 28, marginTop: 48, color: "#6b8394" }}>Unofficial fan tool. Not affiliated with KONAMI.</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
