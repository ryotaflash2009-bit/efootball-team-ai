import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";

export const metadata: Metadata = {
  title: "eFootball Team AI",
  description:
    "eFootball の選手データを検索・比較できる非公式ツール（最初の動作版）。データ基準は eFHUB。",
  // アプリ自身が日本語/英語の表示切替を提供するため、ブラウザーの自動翻訳（Google翻訳等）による
  // 二重翻訳・表示の混乱を避ける（言語切り替えUI自体の文言まで翻訳されてしまうことを防ぐ）。
  other: { google: "notranslate" },
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
