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
| 2 | ゲームの画面での確認 3 件 → **すべて完了**（上限 25 なし＝変更なし・テストで確認／同じ選手の 2 枚は不可＝実装済み `same-player-rule.md`／個別指示は確認不要＝対象外） | 完了 | — | — |
| 3 | Search Console の経過の確認 | 数日〜数週間後 | 公開の画面の予期しない除外だけを調べる（非公開の除外は想定内） | Search Console の操作は本人 |
| 4 | Vercel Firewall の回数の制限・eFHUB への OVR の重みの表の利用の許可 | 任意・保留 | 実施しない | — |

## §2 同じ選手の別のカードの規則 → 実装済み（2026-10-10）

「同じ選手」を名前ではなくカード ID の下位 20 ビットで判定できることを実データで確かめ（本番 13,372 枚で食い違い 0）、
全経路に適用した。詳細は `docs/product/same-player-rule.md`。以前の提案（英語名＋国籍）は同名・同国籍の別人 25 組を誤るため採らない。

## 停止の理由

本人の指示（2026-10-10）: 検索への公開は完了とし、追加の SEO の修正・再デプロイ・環境変数の変更・Search Console の操作・新しい機能の追加はしない。
上の残りの作業は、日付の到来（#1・#3）を待つ。#4 は任意。全体の棚卸しは `remaining-work-inventory-2026-10-10.md`。

## 文書の反映について

この文書は 2026-10-10 の夜の作業のブランチ `feat/owner-answers-2026-10-10` で PR → 通常のマージ（本人の許可: 残りの作業の自動実行）。
