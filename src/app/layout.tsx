import type { Metadata, Viewport } from "next";
import "./globals.css";
// サーバーの描画では、日本語の辞書のすべての名前空間を登録しておく（server component の import なので client の JS には入らない）。
import "@/lib/i18n/dictionaries/ja-ns/all";
import { AppShell } from "@/components/AppShell";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n/locale";

const LOCALE_PENDING_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});var l=(navigator.language||"").toLowerCase().split("-")[0];if(s==="en"||(!s&&l&&l!=="ja")){var d=document.documentElement;d.setAttribute("data-locale-pending","");setTimeout(function(){d.removeAttribute("data-locale-pending")},2000)}}catch(e){}})();`;
import { SITE_ROBOTS_METADATA } from "@/lib/public-info/search-indexing";

export const metadata: Metadata = {
  title: "TeamAIXI",
  description: "TeamAIXI v1.0 — 非公式の eFootball™ スカッド分析ツール。無料・ログイン不要。KONAMI および eFootball™ の公式サービスではありません。",
  applicationName: "TeamAIXI",
  // noindex の間は canonical・Open Graph を出さない（検索・SNS のプレビューで noindex を打ち消さないため。公開 black-box の security で確認）。
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
    // suppressHydrationWarning: 下の head の script が描画前に data-locale-pending を付けるため（html の属性だけ）。
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* 英語の利用者（保存した言語が英語、または未設定でブラウザーの言語が日本語以外）: 英語の辞書を適用するまで本文を隠す。
            日本語の一瞬の表示と、文字の入れ替わりによるレイアウトのずれ（CLS）を防ぐ。最大 2 秒で必ず表示する（LocaleProvider が先に外す）。 */}
        <script dangerouslySetInnerHTML={{ __html: LOCALE_PENDING_SCRIPT }} />
      </head>
      <body>
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
