# 残りの作業と本人の操作（2026-10-11 夜間の作業の後）

## 今夜の結果

- **完全自動更新: 完成。** 検出 → 計画 → Backup → Dry run → 自動の Apply（方針 v2）→ 記録の同期（applied-state・Evidence・F-071 の分布）まで人の操作なし。
  - 初回の実運用: apply 38082513282（World 13,372 → 13,455・更新 3,310・承認者 `auto-apply-policy`・applied_verified）。公開サイトで 13,455 を確認。
  - その後の手動の検出（run 38086984848・full）は `no_change`。同期した記録で同じ更新を二度適用しないことを確認。同期は workflow_run で自動に起動（run 38088673964）。
  - 同期の push は CI を起動しないため、push の前に契約のテストを通す（#251）。初回の同期の Evidence の不足は #246 で修正済み。
- 新機能（すべて main にマージ済み）: スカッドの同じ選手の入れ替えの提案（#239）・読み込み中の骨組み（#240）・ゲストのデータのまとめてコピー（#241）・
  選手の詳細の同じ選手の別のカード（#242）・検索結果の同じ選手の注記（#243）・AI ベスト11 の同じ選手で選ばなかったカードの説明（#244）・
  選手一覧の国籍・リーグ（#245）・チーム（#249）の絞り込み・AI ベスト11 の縛り（国籍・リーグ・チーム・#247）・詳細の値から絞り込みへのリンク（#250）・
  スカッドの先発の所属の内訳（#253）・AI ベスト11 のフォーメーションの選択（#255）・AI ベスト11 をスカッドとして保存（#256）。
- 品質: main 392d773 で全 13 レール 726/726・機能別 5 レール 138/138。以降の PR もそれぞれ関係するレールと `npm run verify` を通した。

## 注意: 本番の反映が止まっている（Vercel の 1 日のデプロイの上限）

2026-10-10 20:35Z ごろに Vercel（Hobby）の 1 日のデプロイの上限に達した（`Deployment rate limited — retry in 24 hours`）。
本番は 166638d のまま。#240 以降の画面の変更は、上限の解除の後に main へ次の push があったときに反映される（データの更新は Supabase のため反映済み）。

- 本人の操作（任意）: 上限の解除の後に Vercel の画面で最新の main（0532244 以降）を Redeploy するか、次のマージを待つ。
- 再発の防止の案（本人の判断）: PR ごとの Preview のデプロイを減らす（Vercel の Ignored Build Step 等）。Claude Code は Vercel の設定を変えていない。

## 本人の操作が必要なもの（変わらず）

| 項目 | 内容 |
|---|---|
| Google ログインの限定テスト | iPhone・Android の実機・キャンセル・同じメールの既存のアカウント（`observedLinking` を記録）・A/B の RLS（`google-oauth-release-gate.md` §6〜7） |
| 一般公開の前 | 同意画面のサポートのメールを Google Group へ・独自ドメインと名義（`google-oauth-owner-steps.md`） |
| アカウントの削除の関数 | Production への SQL の適用（`account-deletion-apply-package.md`） |
| Google Cloud の整理 | 誤って My First Project に作った OAuth Client の削除（本人の判断） |
| 一時ファイルの削除 | `data/work/efhub-tmp`（11 ファイル）・`data/work/wt-head`（junction に注意・手順は `remaining-work-inventory-2026-10-10.md`） |
| 2026-10-13 の観測の締め | 読み取りだけで実行できる（`hourly-detection-decision-package.md` §7・§9） |

## 見送ったもの

- AI ベスト11 のフォーメーションの記憶: `project-baseline.md` の「localStorage キーの新規追加禁止」に当たるため実装しない。

---

## 続き（2026-10-11 午後・本人の指示「開発予定のものを僕なしでどんどん進めて」）

- **Google ログインの一般公開**（#262）: 同意画面を本番環境へ（本人が「アプリを公開」）・サポートのメールを Google グループ `teamaixi-support@googlegroups.com` へ・
  プライバシーポリシーを一般公開版へ。限定テスト 12/12（PC Chrome・Android 実機・iPhone・キャンセル・同じメールの統合・本番の A/B の RLS）。
- **クラウド同期の続き（F-052）**: 保存ビルド（#263）・保存スカッド（#264）の手動のクラウド保存を実装。**本番の表は未作成**のため、
  画面は「準備中」（`BUILDS_CLOUD_MODE` / `SQUADS_CLOUD_MODE` = disabled）。アカウントの削除の SQL の下書きにも 2 つの表を追加（#265）。
- ブラックボックス: 全レールを main で実行（内部ページの前提のレールは内部ページを有効にしたビルドで合格）。`public-signup-limited` を一般公開の期待値に（#266）。

### 本人の承認が必要なもの（Supabase の SQL Editor・それぞれ 1〜2 分）

| 順 | SQL | 有効になる機能 | 手順 |
|---|---|---|---|
| 1 | `docs/production-readiness/sql/create-builds-cloud-schema.sql` | 保存ビルドのクラウド保存 | `builds-cloud-apply-package.md` §2 |
| 2 | `docs/production-readiness/sql/create-squads-cloud-schema.sql` | 保存スカッドのクラウド保存 | `squads-cloud-apply-package.md` §2 |
| 3 | `docs/production-readiness/sql/create-account-deletion.sql` | アカウント画面からの自分での削除 | `account-deletion-apply-package.md` |

適用した後に「適用した」と伝えてもらえれば、Claude Code が有効化の PR と本番での A/B の確認（Android の実機）を行う。

本番の総合 black-box（2026-10-11 午後・ログアウトの状態・8 viewport・World 13,455・監督 69）: **576/576**・性能 14/14・セキュリティ 20/20。
1 回目の実行の最初の照会（`/api/world/players?pageSize=4`）で一度だけ HTTP 500 が返った（直後の再照会はすべて 200・既知の一時的な照会の失敗と同じ型）。

本番の反映（2026-10-12 21:23 JST・Vercel のデプロイ上限の解除の後）: #266〜#269（クラウド保存・アカウントの削除の有効化・F-070）を本番へ反映するための記録。
