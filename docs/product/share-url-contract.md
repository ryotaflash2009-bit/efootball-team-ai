# F-042 Diagnosis share URL — payload contract, threat model, privacy review

実装: `src/lib/squad/squad-diagnosis-share-url.ts`（純関数・tests: `squad-diagnosis-share-url.test.ts`）、
作成UI `src/components/squad/SquadDiagnosisShareUrlButton.tsx`、表示 `src/app/share/diagnosis/page.tsx` +
`src/components/squad/SharedDiagnosisView.tsx`。

## 1. 方式

- URL: `/share/diagnosis#sd1.<base64url(JSON)>.<fnv1a32>`
- 共有データは **fragment（`#` 以降）だけ** に置く。fragment はブラウザーからサーバーへ送られないので、サーバーには保存も記録もされない。
- 表示ページは静的ページで、ブラウザー内で復元するだけ（Production write 0、外部 API なし、レート制限不要）。
- ページには noindex（meta と `X-Robots-Tag`）と `referrer: no-referrer` を付ける。

## 2. payload v1

| key | 型 | 内容 |
|---|---|---|
| `v` | `1` | payload の版 |
| `k` | `"sd"` | 種別（squad diagnosis） |
| `r` | string | 診断規則の版（`squad-diagnosis/YYYY-MM-DD.vN` のみ） |
| `d` | string | 診断日 `YYYY-MM-DD`（時刻は含めない） |
| `f` | string（省略可） | フォーメーション（`4-3-3` 形式のみ） |
| `o` | `[score\|null, tier\|null]` | 総合 |
| `c` | 8 カテゴリちょうど | `attack` `defense` `aerial` `speed` `passBuildUp` `dribblePossession` `pressResistance` `counterAttack` の各 `[score, tier]` |
| `s` / `w` | `[kind, categoryId\|null] \| null` | 主な強み / 弱点の**種類だけ**（文章・選手名は含めない） |

**含めないもの:**
- スカッド名・選手名
- カード ID・監督 ID・保存ビルド ID・スカッド ID
- user / profile / account ID、公開 ID、メール、認証情報
- batch ID、object key、診断の根拠データ、自由記述

自由記述のフィールドは存在しない。

## 3. 検証（表示ページ・`decodeShareToken`）

| 項目 | 内容 |
|---|---|
| 長さの上限 | token 1,500 文字、JSON 1,024 bytes（v1 の最大でも約 0.4KB） |
| 形式 | `sd<版>.<base64url>.<8hex>` |
| 未知の版 | 「対応していない形式」として拒否 |
| checksum | FNV-1a 32bit。**破損の検出用**で、秘密鍵を持たないため改ざんの証明にはならない |
| 符号化 | base64url の文字集合を検査し、UTF-8 は fatal で復号 |
| JSON の検証 | 未知・欠損フィールドを拒否。型・値域（0〜100 の整数）を検査。点数とランクの整合（閾値から決まるランクと一致すること）。カテゴリ集合は8つちょうど。強み・弱点の種類とカテゴリの組み合わせを検査 |
| 失敗時の表示 | 理由の種類だけを表示し、URL の内容は画面に出さない |

表示ページは「共有した人の端末で計算された結果で、形式と整合性だけを確認している」と明示する。

## 4. 互換性

- 版は `v`（と接頭辞 `sd1`）。将来 v2 を作っても **v1 の復元は維持する**。
- v1 より新しい版を見たら「対応していない形式」と表示する（推測で読まない）。
- 診断規則（`r`）が現行と違う場合も表示はするが、「点数の基準が異なる場合がある」と注記する。

## 5. 脅威モデル

| 脅威 | 対策 |
|---|---|
| XSS（script・HTML の混入） | 自由記述を持たず、値は列挙値と数値だけ。表示は React でエスケープ |
| 個人情報・内部 ID の漏えい | 共有データの抽出を種類と点数に限定。未知フィールドを拒否。テストで選手名・ID が含まれないことを確認 |
| 改ざん（点数を盛る） | 共有者の端末の結果であると明示。整合しない値は拒否。**真正性は保証しない**（署名しない理由：ブラウザーだけで完結する設計では鍵を秘密にできないため） |
| サーバーへの負荷・DoS | サーバー処理がない（fragment はクライアントで処理）。token の長さに上限 |
| 検索への露出 | noindex、sitemap なし。ただし URL を知る人は見られるため「秘密の共有用ではない」と明示 |
| Referer からの漏えい | fragment は Referer に含まれない。加えて `no-referrer` を指定 |
| 元のアカウントの推測 | アカウント・端末・時刻の情報を含めない（日付だけ）。同じ診断からは同じ URL になる |

## 6. プライバシーレビュー

共有前のプレビューで、次を明示してから URL を作る。
- 含まれる項目
- 含まれない項目
- サーバーに保存されないこと
- URL を知る人は閲覧できること
- 秘密の共有用ではないこと

コピーは Clipboard API を使い、使えない場合は手動コピーを案内する。Web Share API があれば共有ボタンも出す。
