import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { SITE_ROBOTS_METADATA } from "@/lib/public-info/search-indexing";

export const metadata: Metadata = {
  title: "TeamAIXI",
  description: "TeamAIXI v1.0 — 非公式の eFootball™ スカッド分析ツール。無料・ログイン不要。KONAMI および eFootball™ の公式サービスではありません。",
  applicationName: "TeamAIXI",
  openGraph: {
    title: "TeamAIXI",
    description: "An unofficial squad analysis tool for eFootball™ — free, no sign-in. Not an official KONAMI or eFootball™ service.",
    siteName: "TeamAIXI",
    type: "website",
  },
  // アプリ自身が日本語/英語の表示切替を提供するため、ブラウザーの自動翻訳（Google翻訳等）による
  // 二重翻訳・表示の混乱を避ける（言語切り替えUI自体の文言まで翻訳されてしまうことを防ぐ）。
  other: { google: "notranslate" },
  // TeamAIXI v1.0 の初回正式リリースでも全ページ noindex を維持する（robots.ts でも全体を disallow）。解除は本人の別の判断。
  robots: { ...SITE_ROBOTS_METADATA },
};

export const viewport: Viewport = {
  themeColor: "#0b0f12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
