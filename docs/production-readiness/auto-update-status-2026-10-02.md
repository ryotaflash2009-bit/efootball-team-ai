# 参照データ自動更新の到達状態（2026-10-02 再監査）

根拠: `.github/workflows/reference-data-*.yml`・`src/lib/reference-data/auto-update/*`・`automated-update-pipeline.md`・Evidence。Production への接続・Apply・Secret の設定はしていない。

| 項目 | 状態 | 根拠 |
|---|---|---|
| 定期検出（週1回） | **本番で稼働**。2026-09-27 の定期実行は `no_change`（445 リクエスト・403/429 なし） | run 36340696128、`evidence/f071-artifact-2026-10-01.json` |
| 手動検出 | 稼働（confirm `detect`） | 2026-09-25 run |
| 差分・Plan | 実装・テスト済み。自動進行での本番実行は未実施 | `update-orchestrator*.ts`・テスト |
| Backup（R2・暗号化） | 実装・本番で実行済み（2026-09-24・09-26、手動の承認つき）。自動進行モードは未実施 | backup workflow・Evidence |
| Dry run（使い捨て PostgreSQL・Production の資格情報なし） | 実装・テスト済み。自動進行では未実施 | apply workflow `dry-run` |
| Apply | 実装済み。2026-09-26 に旧手順（4承認）で本番適用・事後検証 `applied_verified` | `evidence/world-update-2026-09-26.json` |
| 事後検証 | Apply の中で実行（`applied_verified` / `rollback_required`） | `stage4-world.ts` |
| applied-state | Apply 後の Evidence PR で Claude Code が更新（設計どおり手動） | `automated-update-pipeline.md` |
| F-071 分布の成果物 | 候補は検出で自動生成。取り込みは `npm run import:world-distribution`（VALID のときだけ書き込む）。現在 VALID | PR #95・#97 |
| 通知（GitHub Issue） | **追加済み**（更新あり・要確認・失敗で1件の Issue を作成または追記。`no_change` は何もしない）。`GITHUB_TOKEN` だけ | PR #97 |
| タイムアウト | 最悪 165 分に対し job の上限 180 分（テストで固定） | PR #97 |
| ロールバック | 取り消し計画を生成。本番での実行モード・リハーサルは無い（Level 3 の条件） | apply workflow |
| 失敗時の停止 | 各段階で `stopped`（Apply の run を作らない）。テスト済み・本番未経験 | `update-orchestrator-cli.ts` |
| 再実行の安全性 | 再実行（re-run）された run は停止。main の commit が途中で変わったら停止 | 同上 |
| 二重実行の防止 | concurrency group（取り消しなし）・advisory lock（Apply） | workflow・apply |
| 削除の検出 | removed > 0 で Plan が停止（自動では削除しない） | 停止条件表 |
| 構造の変更 | schema drift・不完全なスナップショットで停止 | 同上 |
| Managers | 1回の自動進行で1データセット（World が先、Managers は次回） | orchestrator |
| `player_card_analysis` | Apply は書き込まない（権限・コードの両方） | apply role 設計 |
| Secret の数 | 自動進行用の Environment `reference-data-automation` に 9 件（Plan 2・Backup 7）。Apply の 2 件は既存の承認つき Environment | `automated-update-pipeline.md` §2・§5 |
| Environment の保護 | `reference-data-automation`: main だけ・レビューなし（読み取り専用の資格情報だけ）。`reference-data-production-apply`: 必須レビュー | 同上 |

## 「完成」の条件と残り

1. 本人: Environment `reference-data-automation` の作成、Secret 9 件の登録（値は Claude Code に渡さない）、変数 `REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED=true`。
2. 次に `update_available` が出たとき（または手動の `orchestrate`）、Plan → Backup → Dry run が承認なしで1回ずつ成功し、Apply の run が `waiting` になる。
3. 本人の Approve 1回で Apply が `applied_verified`。
4. Evidence・applied-state・F-071 の成果物の PR → 公開サイトで VALID。

それまで F-124（本人だけで検証・他人に試してもらわない・新規登録とコミュニティを公開しない）を続ける。
