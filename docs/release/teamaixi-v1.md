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

## 3. 素材と権利

| 素材 | 分類 | v1.0 | 根拠 |
|---|---|---|---|
| アプリのアイコン（`src/app/icon.svg`・「27」の文字） | 独自作成 | 使用 | リポジトリ内で作成 |
| 選手のプレースホルダー（`public/player-placeholder.svg`） | 独自作成 | 使用 | 同上 |
| UI のアイコン（`Icon.tsx`・ブースターの六角形） | 独自作成（SVG） | 使用 | 第三者のロゴを複製しない（`BoosterIcon.tsx` の注記） |
| フォント | OS の標準フォント（system-ui 等） | 使用 | Web フォントを読み込まない |
| 共有画像の背景・レイアウト | 独自作成（Canvas 描画） | 使用 | 外部画像を含まない |
| **選手カード画像**（efimg.com から中継して表示） | ゲーム由来・**利用許諾報告あり（範囲は文書で未確認）** | 表示中 | `data-distribution-rights-audit.md` §0: プロジェクト責任者が許諾取得済みと報告。許諾原文は非公開で、範囲・公開用途はリポジトリ内で確認できない → **公開ゲートの手動確認** |
| 選手・監督・カード・クラブの名称・能力値 | 第三者のデータ・利用許諾報告あり | 表示中 | 同上 §0 |
| 監督の画像 | ゲーム由来 | **表示しない**（UI に存在しない） | — |
| KONAMI・eFootball™ のロゴ | 第三者のロゴ | **使用しない** | — |

**勝手に法的許諾済みと断定しない。** 選手カード画像と参照データの許諾の範囲は、本人の最終確認の項目にする。

## 4. 既知の問題

| ID | 利用者向けの説明 | 運営向け | リリースの障害か |
|---|---|---|---|
| React #418（断続的） | 「一部の環境で初回表示時に画面が再読み込みされる場合があります。通常は自動的に復旧します。」 / "On some devices, the page may refresh once during the initial load. It normally recovers automatically." | 判定 **NOT_REPRODUCIBLE_WITH_DEFINED_LIMITS**。最終の観測は 2026-10-03（本番 8 viewport の 1 回で 1 件・`/players/world/<id>`・cold・MISS・`$RS`）。2026-10-04 に CPU 1×・4×・6×（+ 遅い 3G）× 4 画面 × 6 回 = 72 回の cold load で 0 件（CPU の遅さによる hydration と遅れた segment の競合の仮説を否定）。観測項目は `react-418-observation-contract.md` で自動記録。 | **障害ではない**（自動で復旧・データの損失なし・発生頻度は 568 ステップに 1 回程度） |
| データの遅れ | 週 1 回の自動検出のため、ゲームより遅れる場合がある | 自動更新の契約どおり | いいえ |
| 端末間の同期なし | ブラウザー内に保存。書き出し・読み込みで移す | 設計どおり | いいえ |
| npm audit（high 8・moderate 1、2026-10-04 時点） | （利用者への影響なし） | すべて build / dev の依存（tailwindcss → chokidar / fast-glob → micromatch → braces、eslint-config-next、next 内部の postcss）。本番の配信経路では実行されない。非破壊の修正では解消しない。Next 16 と Tailwind の更新で解消する見込み（`next16-migration-plan.md`）。この PR では依存を変えていない | いいえ（実行時の露出なし・レビュー済み） |
| AI ベスト 11 の重複判定 | 同じ実在選手の別カードを重複として扱わない | 既知の制約 | いいえ |

## 5. noindex

- `X-Robots-Tag: noindex, nofollow, noarchive`・`robots.txt` の `Disallow: /`・metadata の robots を維持する。
- sitemap・canonical・Open Graph は出さない（noindex を打ち消さないため。公開 black-box の security で確認）。title・description・applicationName は TeamAIXI。
- noindex の解除は本人の別の判断。

## 6. 本人の最終確認（リリースの手動確認の項目）

1. 選手カード画像・参照データの許諾の範囲（公開用途・再配布・画像）。
2. 利用規約・プライバシーポリシー・免責事項の最終確認（専門家レビューを推奨）。
3. サービス名「TeamAIXI」の確定。
4. 問い合わせ窓口（現在の連絡先）。
5. 公開する URL（既存の Vercel Production URL）と、Git tag `v1.0.0` / GitHub Release の作成。
