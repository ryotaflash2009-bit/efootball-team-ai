# 参照データ自動更新 Production Apply ランブック(将来の本人操作向け、今回は未実施)

作成日: 2026-09-19。**このランブックは将来Production適用を行う場合の手順案であり、
今回のセッションでは一切実行していない。** GitHub ActionsやCLIが本人承認を代替することはない
(承認artifactの`approvedBy`・`nonce`は必ず本人が明示的に用意する)。

## 手順

1. **Git状態確認**: `main`/`origin/main`が一致し、作業ツリーがクリーンであることを確認する。
2. **Production Deployment状態確認**: Vercel Dashboardで現在のProduction DeploymentがReadyで
   あることを確認する。
3. **Supabase Project状態確認**: Supabase DashboardでProjectがhealthy・一時停止されていないこと
   を確認する。
4. **Advisor確認**: Security Advisor・Performance Advisorの警告件数を記録する(Leaked Password
   Protection以外に新規警告が無いことを確認)。
5. **backup確認**: `reference-data-production-security-model.md`3章のbackup方式(未確定、
   独立した承認事項)に基づき、直近のbackupが存在し復元可能であることを確認する。
6. **read-only preflight**: `preflight-reference-data-ops.sql`の各クエリを、本人が
   Supabase SQL Editor(読み取り専用のSELECT/SHOWだけ)で実行し、`production-readonly-queries.ts`
   の検証関数へ結果を渡して`ready`判定になることを確認する。
7. **dry-run**: `scripts/migration/reference-data-auto-update-dry-run.mjs`(Phase 1)で
   最新の取得結果を検証し、`decision: apply-candidate`であることを確認する。
8. **diff確認**: dry-runが出した差分(追加/更新/削除候補件数)を本人が目視確認する。
9. **approval artifact生成**: jobId・datasetChecksum・diffChecksum・schemaVersion・期待件数を
   dry-run結果から機械的に埋め、`approvedBy`・`nonce`・`approvedAt`・`expiresAt`は本人が
   明示的に入力する(自動生成しない)。
10. **本人による明示承認**: 生成したapproval artifactの内容を本人が読み、意図と一致することを
    確認したうえで承認する。
11. **transaction開始**: Production adapter(未実装、独立実装が必要)が`BEGIN`する。
12. **advisory lock**: `pg_try_advisory_xact_lock`を取得する(取得できなければ即座に中止、
    待機しない)。
13. **staging投入**: `reference_data_ops.staging_*`テーブルへ取得結果を投入する。
14. **validation**: schema validation・safety gate(件数増減率・NULL率・未知フィールド・
    大量削除候補reject)を再実行する。
15. **apply**: `reference_data_ops.before_snapshots`へ適用前スナップショットを保存したうえで、
    `reference_data.*`(確定済み参照データ)へ反映する(このステップの具体的なSQLは今回設計して
    いない、staging→確定テーブルへの昇格は将来の独立実装事項)。
16. **shadow comparison**: 適用後に読み戻した結果と期待値が完全一致することを確認する
    (1件でも不一致ならROLLBACK)。
17. **commitまたはrollback**: 15-16がすべて成功すれば`COMMIT`、1つでも失敗すれば`ROLLBACK`。
18. **Productionページ確認**: `/`・`/players`・`/managers`・選手詳細・監督詳細を実際に開き、
    表示が壊れていないことを確認する。
19. **Advisor再確認**: Security/Performance Advisorに新規警告が出ていないことを確認する。
20. **監査記録**: `reference_data_ops.audit_events`に記録された内容(秘密情報を含まないこと)を
    確認し、`reference-data-auto-update-rollback-test.md`の形式に準じた実施記録を文書化する。
21. **rollback発動条件**: 18-19で異常を検知した場合、または22の完了判定を満たさない場合は、
    `reference-data-production-rollback-runbook.md`に従って直ちにrollbackする。
22. **完了判定**: 18-20がすべて問題なければ完了とする。

## 前提(今回のセッションで未実装のため、実行できない)

- Production向け接続処理(`createProductionAdapter()`は意図的に未実装)。
- staging→確定テーブルへの昇格SQL。
- backup方式の確定。
- `reference_data_ops`専用ロールの作成・付与(独立した承認事項)。

これらが揃うまで、本ランブックは**手順の設計案**であり、実行可能な状態ではない。
