# 多言語の基盤（i18n architecture）— 2026-10-06

TeamAIXI v1.0 は日本語・English の 2 言語。この文書は、ほかの言語を安全に追加するための契約・現状の監査・
未完の範囲を記録する。関連: `terminology-glossary.md`（用語）・`translation-management.md`（翻訳の管理）・
`locale-status.json`（言語ごとの状態）・`coverage.md`（自動生成の coverage）。

## 1. 現状の監査（2026-10-06）

| 項目 | 状態 |
|---|---|
| 辞書の型 | `Dictionary`（`dictionaries/ja.ts` の interface）。100 名前空間・4,495 キー |
| 日本語 | 核（`ja.ts`: common・pageError・nav・header・language・footer・homePage・category）+ 画面ごとの 92 名前空間（`ja-ns/*.ts`。画面が import して登録）。SSR・hydration は常に日本語 |
| English | `en.ts`（約 315 KB のソース）。English を選んだ利用者のときだけ後から読み込む別 chunk |
| ja・en のキーの一致 | `scripts/audit-i18n-keys.mjs`（verify） |
| 表示層の文章 | 計算ライブラリが作る日本語の文章を、表示の直前に English へ置き換える（`lib-text-en.ts`・`compare-text-en.ts`・`squad-text-en.ts`・`squad-diagnosis-text-en.ts`・`diagnosis-perspectives-text-en.ts`。漏れのテストあり） |
| 言語の分岐 | `locale === "en"` の分岐が 133 か所（表示層の文章・日付・数値） |
| 数値・日付 | `format.ts`（Intl）。日時は日本時間に固定し時間帯名を付ける（サーバーとブラウザーの時間帯の違いで React #418 が出たため・2026-09-24） |
| 言語の保存 | localStorage `efootball-team-ai:locale:v1`（値は言語のコード）。新しいキーは作らない |
| 言語の選択 | ヘッダーのボタン（日本語 / English。`aria-pressed`） |

## 2. Locale の契約（`src/lib/i18n/locale-registry.ts`）

- **コード**: BCP 47。`ja`・`en`・`es`・`pt-BR`・`fr`・`de`・`it`・`ko`・`zh-CN`・`zh-TW`・`id`・`tr`・`ar`・`th`・`vi`・`nl`・`pl`・`ru`。
  疑似: `en-XA`（長文化・アクセント）・`ar-XB`（疑似 RTL）。
- **表示の名前**: その言語自身の表記（日本語・English・Español・Português (Brasil)・Français・Deutsch・Italiano・한국어・简体中文・
  繁體中文・Bahasa Indonesia・Türkçe・العربية・ไทย・Tiếng Việt・Nederlands・Polski・Русский）。国旗は使わない。
- **解決の順**（`resolveLanguageTag`・`negotiateDisplayLocale`）:
  1. 完全一致（大文字・小文字・`_` を正規化）
  2. 同じ言語の対応する形（`en-US`・`en-GB` → `en`、`es-ES`・`es-MX`・`es-419` → `es`、`pt`・`pt-PT` → `pt-BR`、`de-AT` → `de`、古い `in` → `id`）
  3. 中国語は文字・地域で分ける（`zh-Hans`・`zh-CN`・`zh-SG` → `zh-CN`、`zh-Hant`・`zh-TW`・`zh-HK`・`zh-MO` → `zh-TW`）。**`zh` だけは曖昧なので解決しない**
  4. ブラウザーの言語の一覧の次の候補へ
  5. どれも無ければ **English**（日本語は日本語の利用者のときだけ。世界向けの最後の代わりにしない）
- **選べる言語**: `PUBLISHED` だけ（現在は ja・en）。ほかの状態の言語は内部の確認（`areInternalPagesVisible()`: 開発、または
  `NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled` の build。Production・Vercel Preview では偽）だけ。
- **保存値**: 選べる言語の正式な表記だけを読む。不正・壊れた値・選べない値（例: Production で `es`）は無視してブラウザーの言語へ戻る。
  古い値 `ja`・`en` はそのまま有効（移行は不要）。
- **URL**: v1.0 は言語を URL に入れない（query・共有 URL を壊さない）。noindex を解除する場合の案は §8。
- **言語ごとの停止**: registry の `state` を `SUSPENDED` にすると、その言語だけが選べなくなる（日本語・English は止まらない）。
  保存値がその言語の利用者は、次の表示でブラウザーの言語（多くは English）へ戻る。

## 3. 辞書の解決の順と読み込み

- `translate(displayLocale, ns, key)`: **その言語 → English → 日本語**。生のキー・空白は出さない。
  ja・en 以外の言語の未翻訳は English で出し、欠落として記録する（`missingKeysSeen()`。内部の確認・テスト用）。
- 計算ライブラリ・表示層の文章は `useLocale().locale`（基本の言語: ja / en）で分岐する。**日本語以外の言語はすべて en** のため、
  133 か所の分岐は変更不要で、新しい言語で日本語の文章が出ることは無い（未翻訳の部分は English）。
- 辞書の読み込み: ja・en 以外の言語は `dictionaries/locales/<code>.ts`（一部のキーだけを持つ `PartialDictionary`）を言語ごとの
  別 chunk で読み込み、English の辞書もそろってから切り替える（English と日本語が混ざった中間の表示を出さない）。
  疑似ロケールは English の辞書から機械的に作る（`pseudo-locale.ts`・別 chunk）。
- **初回 JS**: 殻（`LocaleContext`・`translate.ts`・`locale-registry.ts`）は English・ほかの言語・疑似ロケールの辞書を静的に
  import しない（テストで確認）。registry は約 2 KB のデータだけ。
- `<html lang>` は表示言語のコード、`dir` は registry の方向（`rtl` の言語だけ `dir="rtl"`）。
- Intl: 基本の言語が en の表示言語では、数値・日付の書式だけその言語（`setFormatDisplayLocale`。例: de → `1.234`）。
  時間帯は日本時間に固定し時間帯名を付ける（hydration の一致のため。各利用者の時間帯での表示は v1.1 の課題: 描画の後だけの
  相対時間など、hydration に影響しない方法で）。

## 4. 翻訳してはいけないもの

利用者が入力したスカッド名・ビルド名・メモ・タグ、メールアドレス、公開 ID・内部 ID、URL、エラーコード、checksum、ファイル形式、
製品の固有の表記（TeamAIXI・eFootball™・KONAMI）、権利者名、データ元の正式名称。

## 5. 選手名・監督名・カード名・プレースタイル名

優先の順: 1) データ元にその言語の正式名称がある → 2) 既存の正式な英語名称 → 3) 既存の日本語名称 → 4) 安全な代わり（英語名称）→
5) 内部 ID は表示しない。現在のデータ元（World・Managers）が持つのは英語名と一部の日本語名だけのため、**ja 以外の言語は英語名**。
独自の翻訳・音訳はしない（自動翻訳の結果を正式名称として保存しない）。将来、データ元に各言語の名称が入った場合は、
その言語の列を追加して 1) を使う。

## 6. 表示層の文章（計算ライブラリが作る文章）

診断のコメント（通常・辛口）・弱点・改善・比較の説明・育成の説明・スカッドの説明は、計算ライブラリが日本語で作り、
English だけ表示層で置き換えている。ほかの言語へ広げるには、各モジュールの「日本語 → English」の対応表を
「キー → 言語ごとの文」へ作り直す必要がある（v1.1 以降の作業。言語ごとの漏れのテストを English と同じ形で用意する）。
それまでは、ほかの言語でもこれらの文章は English で表示する（coverage の報告に明記）。

## 7. 法務文書・サポート

- 利用規約・プライバシー・免責事項の基準は日本語（運営者が作成）。English は v1.0 の画面の訳（運営者の確認）。
- ほかの言語の法務文書は **公開しない**（`Not published`）。将来公開する場合は「便宜のための翻訳」であることを明記し、
  どの言語を優先するか（矛盾したとき）は本人と専門家の確認の前に決めない。準拠法・裁判管轄は未確定のまま（`docs/release/legal-review-checklist.md`）。
- サポート: 運営者が対応できる言語は日本語・English（本人の確認待ち）。ほかの言語での問い合わせに迅速な返信を約束しない。

## 8. noindex を解除する場合の URL・hreflang の案（設計だけ・未実装）

noindex は維持する。解除する場合の案: 言語ごとの path（`/es/players` 等）または subdomain は使わず、**言語を URL に入れない現状を
維持し、hreflang は出さない**（ページの内容は言語の切り替えで変わり、URL は同じ）のが最小。検索エンジンに言語別のページを
出す必要が出た場合だけ、path の接頭辞と `alternate hreflang`・`x-default`（English）を設計する（middleware・共有 URL・保存した
リンクの互換の確認が必要）。

## 9. RTL（アラビア語）の準備状況

- `dir="rtl"` の切り替え・疑似 RTL（`ar-XB`）は実装済み。
- 物理的な左右の指定（Tailwind の `ml-`/`mr-` 88・`pl-`/`pr-` 97・`left-`/`right-` 43・`text-left`/`text-right` 61・
  `border-l`/`r` 4・`rounded-l`/`r` 5・`translate-x` 9。79 ファイル）に対し、論理プロパティ（`ms-`・`me-`・`ps-`・`pe-`・`start-`・`end-`）は 5。
  RTL で崩れる。アラビア語は `INTERNAL_DRAFT` のまま公開しない。
- **2026-10-06 に置き換えた**: 余白・文字の揃え・枠線・角丸の 255 か所（72 ファイル）を論理プロパティへ（`ms-`・`me-`・`ps-`・`pe-`・
  `text-start`・`text-end`・`border-s/e`・`rounded-s/e/ss/se/es/ee`）。LTR の表示の確認: 日本語・English × 390・1280 × 13 画面の
  スクリーンショットで 47/52 がバイト単位で一致、残りは目視で同じ（画像の描画の揺れ・内部 build だけのボタンの端）。
  見つかった 1 件: 表の見出しの行（`<tr>`・`<thead>`）の `text-start` は、`<th>` の既定の `-internal-center` が継承の start を
  center に戻すため、`[:where(&)_th]:text-start`（詳細度 0・th 自身の揃えのクラスより弱い）で th に直接付けた。
  物理的な指定が戻らないことをテストで確認（`src/lib/i18n/rtl-logical-properties.test.ts`）。疑似 RTL（`ar-XB`）で、ヘッダー・
  見出し・カードの並び・セレクトの矢印が左右反転することを確認。
- 残り: 位置の指定 52（`left-`/`right-` 43・`translate-x` 9）と inline style 11。2026-10-06 に分類した
  （`docs/i18n/rtl-position-utilities.md`・`node scripts/i18n-rtl-position-audit.mjs` が生成）: そのまま 26（ピッチの座標・中央寄せ・
  左右対称の帯）・論理プロパティへ 24（バッジ・閉じるボタン・ドロワー・表の固定列・入力欄のアイコン）・要決定 1（育成のスライダーの向き）・
  装飾 1。ほかに矢印のアイコンの反転・共有カード（canvas）の RTL。アラビア語は `INTERNAL_DRAFT` のまま公開しない。

## 10. 検索

選手・監督の検索はサーバー側（Supabase）の部分一致。正規化（Unicode NFKC・大文字・小文字・アクセントの除去・トルコ語の i・
ドイツ語の ß）は、言語を公開する段階で、別名（データ元の公式の別名だけ）と合わせて設計する。根拠のない別名は作らない。

## 11. CJK・共有カード

- フォントはシステムのフォントの順（日本語は既存の指定）。韓国語・簡体字・繁体字は OS のフォントに依存する。
- 共有カードの画像（canvas）は、描いた文字をすべて記録し、端末のフォントで描けない文字（欠けた字形）があれば画像を作らない
  （`src/lib/i18n/font-coverage.ts`。保存は `font_unavailable`、比率を選ぶカードは作成の失敗として案内）。計測できない環境では止めない。
- 共有カードの文言（2026-10-06）: ja・en は従来の固定の表（`IMAGE_TEXT`）。それ以外の表示言語は、画面が辞書（`shareCard.img*`）・
  カテゴリ名・日付の書式・生成文の表から作って渡す（`SquadImageLocalization`）。es・pt-BR は 4 比率（3:4・1:1・9:16・16:9）を
  ブラックボックスで保存して確認。既知: 折り返しは文字単位のため、英字の長い文は語の途中で折れることがある（en と同じ。要改善）。
- 簡体字・繁体字は自動の変換で作らない（語彙の違いがある。用語集で別々に管理）。
