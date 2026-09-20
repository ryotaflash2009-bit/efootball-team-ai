# 参照データ自動更新 Production Rollback ランブック(将来の本人操作向け、今回は未実施)

作成日: 2026-09-19。**このランブックは将来の手順案であり、今回のセッションでは一切実行していない。**

**2026-09-20追記**: この手順の元になった明示rollback処理(before snapshotからの復元、
このjob追加行だけの削除、二重rollback拒否)は、隔離PostgreSQL(`reference_data_ops_test`/
`reference_data_test`)専用として設計・実装・実証済み(`reference-data-promotion-design.md`・
`reference-data-promotion-rollback-validation.md`参照)。Production向けへはまだ移植していない。

## 発動条件(いずれか1つでも該当したら発動を検討する)

- shadow comparisonで1件でも差分が検出された(適用直後に検出された場合はtransaction内で
  自動ROLLBACKされ、このランブックの対象外)
- 適用後、対象テーブルの行数が想定から大きく外れている
- Production上のページ(`/players`・`/managers`・選手詳細・監督詳細)がHTTP 500を返す
- 検索・ソート結果が適用前と比べて明らかに異常
- 選手/監督の詳細情報が異常(欠損・文字化け・値の破損)
- `source_metadata`相当の情報が不整合
- 大量のNULL値が新たに出現している
- 参照整合性違反(orphan)が検出された
- advisory lockの異常な挙動(解放されない、想定外の競合)
- transactionの不整合(一部だけ反映されている疑いがある)
- 重大な性能劣化(クエリが著しく遅くなった)

## 手順

1. **新規applyの停止**: 進行中の新しいapply操作があれば、承認前の段階で止める
   (実行中のtransactionへ割り込まない、advisory lockが自然に解放されるのを待つ)。
2. **job ID特定**: `reference_data_ops.update_jobs`から対象のjob_idを特定する。
3. **applied checksum確認**: `reference_data_ops.applied_checksums`で該当job_idのchecksumが
   記録されていることを確認する。
4. **before snapshot確認**: `reference_data_ops.before_snapshots`に対象job_idの行が存在し、
   復元に必要な内容(欠落なし)であることを確認する。存在しない場合、正確な復元はできない
   (推測で元状態を作らない。この場合はbackup方式からの復元を検討する)。
5. **rollback承認**: 本人がrollback実行を明示的に承認する(applyと同様、単純なフラグでの
   実行は許可しない設計とする)。
6. **lock取得**: 対象テーブルのadvisory lockを取得する(取得できなければ待機せず中止し、
   状況をエスカレーションする)。
7. **transaction開始**: `BEGIN`。
8. **inverse apply**: `before_snapshots`の内容へ、対象テーブルの該当行を復元する。このjobが
   新規追加した行(before_snapshotに存在しない行)は削除する。
9. **source metadata復元**: `reference_data_ops.source_metadata_snapshots`から復元する。
10. **shadow comparison**: 復元後の状態が、適用前のchecksumと一致することを確認する。
11. **Production UI確認**: 対象ページを実際に開き、rollback前の状態に戻っていることを確認する。
12. **commit**: 10-11が成功すれば`COMMIT`、失敗すれば`ROLLBACK`(rollback自体の失敗)。
13. **監査記録**: `reference_data_ops.rollback_jobs`・`audit_events`に記録し、
    `reference-data-auto-update-rollback-test.md`と同様の形式で実施記録を残す。

## rollback失敗時の対応

- 8-10のいずれかが失敗した場合、rollback自体をtransaction内でROLLBACKし(部分的な復元を
  残さない)、**直ちに作業を停止する**。
- before snapshotの内容に疑義がある場合、推測で復元を続けない。
- 復旧が困難な場合は、Supabase platform backup(方式が確定していれば)からの復元を検討し、
  この判断自体を本人が行う(自動でbackup復元まで進めない)。
- 対象テーブルへの新規apply操作は、原因究明と再発防止策の確認が完了するまで再開しない。

## 二重rollback防止

`reference_data_ops.rollback_jobs`に`target_job_id`ごとの一意制約(`status <> 'failed'`の
行に対して)を設けており、同じjobへ複数回rollbackを試みることを構造的に防ぐ設計とする
(`create-reference-data-ops-schema.sql`参照)。
