# 残りの作業と停止の理由（2026-10-10 時点）

## 今の成果（2026-10-09〜10）

- PR #206〜#228 をすべて通常マージ（main d75ed30）。内容は `feature-ledger.md` §9 の 2026-10-09。
- 検索への公開: **完了**（2026-10-10・`docs/production-readiness/seo-indexing.md` §7・Evidence `evidence/search-indexing-enabled-2026-10-10.json`）。
- 主な Evidence: `docs/product/progression-efhub-crosscheck-2026-10-09.md`（eFHUB基準の照合・全カードの不変条件）・
  `evidence/efhub-progression-crosscheck-2026-10-09.json`・`evidence/hourly-detection-observation-2026-10-09.json`・
  `api-abuse-assessment-2026-10-09.md`・本番の black-box（総合 576/576・保存データありの hydration 95/95・base-percentile 115/115）。

## 残りの作業（保持）

| # | 作業 | 状態 | 進めてよい範囲 | 停止する点 |
|---|---|---|---|---|
| 1 | 2026-10-13 の毎時の検出の判断の整理（最終の記録・費用・権限・失敗の通知・停止の方法・ロールバック・Production への影響） | 未着手（10/13 の後） | 調査・Dry run・実行の計画の作成（`hourly-detection-decision-package.md` を更新） | 外部の起動（External Cron 等）・Production の設定の変更の直前 |
| 2 | ゲームの画面での確認 3 件（`game-evidence-requests-2026-10-09.md`） | 本人の確認待ち | 本人の記録を受けてからの反映 | — |
| 3 | Search Console の経過の確認 | 数日〜数週間後 | 公開の画面の予期しない除外だけを調べる（非公開の除外は想定内） | Search Console の操作は本人 |
| 4 | Vercel Firewall の回数の制限・eFHUB への OVR の重みの表の利用の許可 | 任意・保留 | 実施しない | — |

## 停止の理由

本人の指示（2026-10-10）: 検索への公開は完了とし、追加の SEO の修正・再デプロイ・環境変数の変更・Search Console の操作・新しい機能の追加はしない。
上の残りの作業は、日付の到来（#1・#3）か本人の確認・判断（#2・#4）を待つ。

## 文書の反映について

この文書と §7・Evidence は **ローカルのブランチ `docs/search-indexing-complete-2026-10-10` にコミットだけ**している。
Vercel に「変更の無い build を飛ばす」設定（Ignored Build Step）が無く、main へマージすると文書だけの変更でも Production が再デプロイされ、
push すると Preview が作られるため、「再デプロイしない」の指示に従って push・マージしていない。反映してよい時点で push → PR → 通常のマージ。
