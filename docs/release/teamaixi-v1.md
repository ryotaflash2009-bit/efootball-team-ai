# TeamAIXI v1.0 — 公開範囲・素材・既知の問題（2026-10-04）

本人の決定（2026-10-04）: ログイン不要・無料・非公式の正式製品版「TeamAIXI v1.0」を、既存の Vercel Production URL で先行公開する。
noindex は維持する（URL を知っている利用者は利用できる。検索エンジンへの掲載だけを止める）。

## 1. 公開範囲

| v1.0 で公開 | 画面 |
|---|---|
| 選手検索・選手詳細 | `/players`・`/players/world/[id]` |
| 監督検索・監督詳細 | `/managers`・`/managers/[id]` |
| 育成（能力値を直接タップ・スライダー） | 選手詳細 |
| 選手比較 | `/compare` |
| My Team・My Builds（ブラウザー内） | `/my-team`・`/my-builds`・`/build-inventory`・`/favorites` |
| Build Analysis・スカッド診断・AI ベスト 11 | 選手詳細・`/squads`・`/best-xi` |
| パーセンタイル・称号・バッジ・「あなたの一番」・成長プロフィール | 選手詳細・スカッド・診断履歴 |
| 診断履歴・改善前後・共有 URL・共有画像 | `/diagnosis-history`・`/share/*` |
| データの書き出し・読み込み・削除・全データの Backup | `/data-management` |
| 日本語・英語 | 全画面 |
| 案内 | `/about`・`/terms`・`/privacy`・`/disclaimer`・`/support` |

| v1.0 で公開しない | 状態 |
|---|---|
| 新規登録・認証メール・一般のパスワード再設定 | `ACCOUNT_SIGNUP_MODE = "limited"`（ローカル開発以外では登録画面を出さない）。既存のログインは壊さない |
| 公開 ID・友達・ライバル・公開プロフィール | 内部の試作だけ（本番 404） |
| 写真投稿・コミュニティ・コメント・返信・リアクション | 内部の試作だけ（本番 404）・段階 2 は提案と使い捨て PostgreSQL の検証まで |
| 公開ランキング・利用統計 | 未実装 |
| 課金・定期購入・広告 | 未実装 |
| Tier・Pack（権利未確認のデータ） | 合成データの試作だけ（本番 404）・ナビから外した |
| Best XI の監督補正（F-070） | **v1.1 の候補**（現行の Best XI を維持。監督ごとの評価式は本人の判断） |

ナビゲーション: v1.0 では「準備中」の項目（ティアリスト・パック・コミュニティ）もナビに出さない（`Sidebar.tsx`）。
内部ページ（`INTERNAL_PAGE_PATHS` の 5 件）は本番で 404（middleware と `notFound` の二重）。

## 2. ブランド

- 主表示: **TeamAIXI**。説明: 「非公式の eFootball™ スカッド分析ツール」 / "An unofficial squad analysis tool for eFootball™"。
- 非公式の表記（フッター・免責事項・利用規約・サービス概要・Home）:
  - KONAMI および eFootball™ の公式サービスではない
  - KONAMI による公認・提携・運営ではない
  - 商標・製品名は各権利者に帰属する
  - データ・分析・診断には誤りや遅延の可能性があり、ゲーム内の最終判断を保証しない
- 互換のため変えないもの:
  - 保存データのキー（`efootball-team-ai:*`）
  - 全データ Backup の `app: "efootball-team-ai"`
  - 保存ビルドの書き出しファイルの `app` 識別子（既存ファイルの読み込みのため）
  - 共有 URL の形式・Feature ID・DB の identity・リポジトリ名

## 3. 素材と権利（2026-10-04 再監査・本人指定の分類）

| 素材 | 分類 | v1.0 | 根拠・許諾の範囲と公開用途 |
|---|---|---|---|
| アプリのアイコン（`src/app/icon.svg`） | Original | 使用 | リポジトリ内で作成 |
| 選手のプレースホルダー（`public/player-placeholder.svg`） | Original | 使用 | 同上 |
| UI のアイコン（`Icon.tsx`・ブースターの六角形） | Original | 使用 | SVG を自作。第三者のロゴを複製しない |
| 共有画像（Canvas で端末内に描画） | Original | 使用 | 背景・レイアウト・文字は自作。外部画像を含まない |
| Metadata の画像（OG 画像） | — | **なし** | noindex の間は Open Graph・canonical を出さない |
| 背景 | Original（CSS） | 使用 | 画像ファイルなし |
| フォント | OS の標準フォント | 使用 | Web フォントを読み込まない |
| **選手カード画像**（efimg.com を自前の proxy 経由で表示） | **Game-derived / Permission documented（本人の報告）** | 表示中 | `data-distribution-rights-audit.md` §0: プロジェクト責任者が「公開・再配布・データ利用・画像利用・更新連携・将来の商用利用」に必要な許諾を取得済みと報告。許諾の原文は非公開でリポジトリに無い（契約書の存在・条項は推測しない）。公開用途: 選手の識別のための縮小表示（一覧・詳細・スカッド・比較）|
| 選手・監督・カード・クラブの名称・能力値 | Source data only / Permission documented（同上） | 表示中 | 同上 §0。取得日時を画面に表示 |
| 監督の画像 | Game-derived | **表示しない** | UI に存在しない |
| KONAMI・eFootball™ のロゴ | Third-party | **使用しない** | — |
| Tier・Pack の外部データ | Rights unclear | **使用しない** | 合成データの試作だけ（本番 404・ナビになし） |
| 利用者の投稿・写真 | User-generated | **v1.0 になし** | 写真投稿・コミュニティは未公開 |

「非公式」と書くことは権利の確認の代わりにしない。選手カード画像と参照データは、本人の報告にもとづく許諾（範囲は上の表）として扱い、
**法的に許諾済みと断定しない**（`legal-review-checklist.md` §1）。

### 3.1 選手カード画像の軽量化（2026-10-04 の判断）

実測（本番・cold・desktop）: Home と /players で 25 枚・約 3.97 MB（1 枚 77〜255 KB の 960×1360 を約 48〜150 px で表示）。

| 案 | 内容 | 判断 |
|---|---|---|
| A | 現状維持 | 不採用（転送量が大きい） |
| B | 既存の依存だけで静的サムネイルを事前生成 | 不採用: 13,000 枚超の取得（約 2 GB）とリポジトリの肥大（約 100 MB）が必要 |
| C | 既存の build で小さい画像を生成 | 不採用: 画像の変換には sharp 等が必要（既存の宣言済み依存に無い） |
| **D** | **画面の近くに来た画像だけを読み込む・最初の数枚だけ即時（fetchpriority=high）・3:4 の枠で CLS 0** | **採用（PR #136）**: Home 25 → 5 枚（3.97 → 0.8 MB）、/players mobile 11 → 5 枚 |
| E | Vercel Image Optimization | **v1.1 の候補**（利用枠の消費・費用の確認が必要） |
| F | sharp の新規導入（proxy で縮小） | **v1.1 の候補**（依存の追加・Vercel の互換・保守の確認が必要） |

上流の小さい画像の URL は推測しない（固定のテンプレートだけを使う）。Card thumbnail は v1.0 の release blocker にしない。

## 4. 既知の問題

| ID | 利用者向けの説明 | 運営向け | リリースの障害か |
|---|---|---|---|
| React #418（断続的） | 「一部の環境で初回表示時に画面が再読み込みされる場合があります。通常は自動的に復旧します。」 / "On some devices, the page may refresh once during the initial load. It normally recovers automatically." | 判定 **NOT_REPRODUCIBLE_WITH_DEFINED_LIMITS**。最終の観測は 2026-10-03（本番 8 viewport の 1 回で 1 件・`/players/world/<id>`・cold・MISS・`$RS`）。2026-10-04 に CPU 1×・4×・6×（+ 遅い 3G）× 4 画面 × 6 回 = 72 回の cold load で 0 件（CPU の遅さによる hydration と遅れた segment の競合の仮説を否定）。2026-10-04 の v1.0 公開後の本番 8 viewport でも 1 件（mobile-390x844・`/squads`・cold・MISS・args `HTML`・568 ステップ中 1 回）。**2026-10-04 に原因を特定して対策**（殻の `<main>` で segment を Suspense で囲む。ローカルの再現で 11/110 → 0/480。`react-418-observation-contract.md` §5）。本番の 3 回連続 0 件で「解決」にする。観測項目は自動記録。 | **障害ではない**（自動で復旧・データの損失なし・発生頻度は 568 ステップに 1 回程度） |
| データの遅れ | 1 時間おきの自動検出（World の全件の比較は 6 時間ごと・新しいカードは 1 時間）のため、ゲームより遅れる場合がある | `hourly-detection.md` | いいえ |
| 端末間の同期なし | ブラウザー内に保存。書き出し・読み込みで移す | 設計どおり | いいえ |
| npm audit（high 8・moderate 1、2026-10-04 時点） | （利用者への影響なし） | すべて build / dev の依存（tailwindcss → chokidar / fast-glob → micromatch → braces、eslint-config-next、next 内部の postcss）。本番の配信経路では実行されない。非破壊の修正では解消しない。Next 16 と Tailwind の更新で解消する見込み（`next16-migration-plan.md`）。この PR では依存を変えていない | いいえ（実行時の露出なし・レビュー済み） |
| AI ベスト 11 の重複判定 | 同じ実在選手の別カードを重複として扱わない | 既知の制約 | いいえ |

## 5. noindex

- `X-Robots-Tag: noindex, nofollow, noarchive`・`robots.txt` の `Disallow: /`・metadata の robots を維持する。
- sitemap・canonical・Open Graph は出さない（noindex を打ち消さないため。公開 black-box の security で確認）。title・description・applicationName は TeamAIXI。
- noindex の解除は本人の別の判断。

## 6. 本人の最終確認（2026-10-04 の本人の決定を反映）

| 項目 | 状態 | 根拠 |
|---|---|---|
| サービス名 | **確定**: TeamAIXI（日本語の説明「非公式のeFootball™スカッド分析ツール」・英語 "An unofficial squad analysis tool for eFootball™"） | 本人の決定 2026-10-04 |
| 法務文書 | **方針確定**: 確定している内容だけを掲載し、未確定の事項は内部の `legal-review-checklist.md` へ。専門家のレビューを推奨（法律上の最終保証はしない） | 同上 |
| 問い合わせ窓口 | **確定**: サイト内の「問い合わせ」ページ。個人のメール・独自ドメインのメールは表示しない（専用の outlook.jp の窓口を表示） | 同上 |
| 公開 URL | **確定**: 現在の Vercel Production URL `https://efootball-team-ai.vercel.app`（GitHub の Production deployment・リポジトリの homepage と一致。Preview URL は使わない。独自ドメインの取得後に置き換え可能） | 同上・deployment の記録 |
| 素材の権利 | **本人の報告にもとづく許諾として記録**（§3。範囲と公開用途を記録・契約書の存在は推測しない） | `data-distribution-rights-audit.md` §0 |
