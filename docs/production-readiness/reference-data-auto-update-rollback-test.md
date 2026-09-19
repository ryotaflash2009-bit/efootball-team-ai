# 参照データ自動更新 Phase 2 rollback実地検証記録

実施日: 2026-09-19。**すべてローカルの一時SQLiteファイル(`node:sqlite`)に対する実地検証であり、
実Supabase・実Postgresへは一切接続していない。** 検証コード: `src/lib/reference-data/auto-update/
apply-orchestrator.sqlite.test.ts`・`apply-cli.test.ts`(いずれも自動テストとして`npx vitest run`で
再現可能)。

## 1. 検証方法の内訳(2種類のrollbackを区別する)

タスクの要求どおり、「トランザクション内失敗時の自動ROLLBACK」と「成功commit後の人間判断による
明示的なundo」を明確に区別して、それぞれ別に実地検証した。

### A. トランザクション内失敗時の自動ROLLBACK

`apply-orchestrator.sqlite.test.ts`の「トランザクション途中の失敗はROLLBACKし、一部だけcommitされない」で検証。

手順:
1. ローカル一時SQLiteに`update_jobs`へジョブ行(status='running')を用意。
2. `applyUpdateJob()`を、UPSERT自体は実SQLiteへ実行するが、直後の読み戻し(SELECT)で
   意図的に例外を投げる合成クライアント経由で実行。
3. 結果を確認。

確認した事実(いずれも実SQLiteへの直接クエリで確認、モックの戻り値ではない):

| # | 確認項目 | 結果 |
|---|---|---|
| 1 | `applyUpdateJob()`の戻り値が`decision: "rollback"` | 確認済み |
| 2 | `target_records`テーブルに、適用しようとした行が1件も存在しない | 確認済み(1件もcommitされていない) |
| 3 | `update_jobs.status`が`completed`へ更新されていない(`running`のまま) | 確認済み |
| 4 | `applied_checksums`にエントリーが追加されていない | 確認済み |

### B. 成功commit後の明示的なundo(rollback.ts)

`apply-orchestrator.sqlite.test.ts`の2件(新規追加行のundo・更新行の復元)、および
`apply-cli.test.ts`の「--rollback-planで成功適用後の明示rollbackができる」で検証。

#### B-1. 新規追加された行のundo

手順: 既存行(`wc-0`)がある状態で、新規行(`wc-1`)を追加するジョブを実際にcommitさせ、
その後`buildRollbackPlan(jobId, beforeSnapshot=[], addedIds=["wc-1"])`でrollbackを実行。

| # | 確認項目 | 結果 |
|---|---|---|
| 1 | rollback実行後、`wc-1`が`target_records`から削除されている | 確認済み |
| 2 | このジョブと無関係だった`wc-0`は一切変更されていない(元の値のまま) | 確認済み |
| 3 | `update_jobs.status`が`rolled_back`になる | 確認済み |
| 4 | `applied_checksums`から該当エントリーが除去される | 確認済み |

#### B-2. 既存行の更新をbefore-snapshotへ復元

手順: `wc-1`が`ovrMax=79`で既に存在する状態で、`ovrMax=80`へ更新するジョブを実際にcommitさせ
(適用後に`ovrMax=80`になっていることを確認)、その後`buildRollbackPlan(jobId,
beforeSnapshot=[{id:"wc-1", fields:{ovrMax:79,...}}], addedIds=[])`でrollbackを実行。

| # | 確認項目 | 結果 |
|---|---|---|
| 1 | 適用直後、`wc-1.ovrMax`が`80`になっている | 確認済み |
| 2 | rollback実行後、`wc-1.ovrMax`が`79`(元の値)へ正確に復元されている | 確認済み |

#### B-3. CLI経由での明示rollback(実プロセス起動)

`scripts/migration/reference-data-auto-update-apply.mjs`を実際に子プロセスとして起動し、
`--rollback-plan <plan.json>`モードで実行。適用時とは別のプロセス実行でも、同じSQLiteファイルに
対して正しくrollbackが機能し、終了コード0・`ok: true`が出力されることを確認した。

## 2. 誠実な限界の開示(推測で元状態を作らない)

- 本検証はすべて**ローカルの一時SQLite**に対するものであり、実Postgresのトランザクション分離
  レベル・実際のネットワーク断・実際の同時実行環境下での挙動までは検証していない。
- `beforeSnapshot`は呼び出し側が正確に保持している前提であり、`rollback.ts`自体は
  「保持されているbeforeSnapshotへ正確に復元する」ことだけを保証する。beforeSnapshot自体の
  取得漏れ・破損があれば、正確な復元はできない(これは今回のコードの限界として明記する。
  推測で元状態を作ることはしていない)。
- Production環境でのadvisory lock(`pg_try_advisory_xact_lock`)への実接続、Production
  staging schemaでの実行、実際のネットワーク分断時の挙動は、今回はいずれも検証していない
  (ローカルSQLiteでの`advisory_locks`テーブルによる模擬検証のみ)。

## 2.5 PostgreSQLでの追加実証(2026-09-19)

本書が記録する検証はSQLiteに対するものだったが、その後GitHub ActionsのPostgreSQL
service container上で、同じ正常系・トランザクション途中失敗・明示rollbackのシナリオを
実PostgreSQLに対しても実行し、同様の結果(一部だけcommitされない・before-snapshotへの
正確な復元)を確認した。詳細は`reference-data-auto-update-postgres-validation.md`を参照。

## 3. 結論

トランザクション内失敗時の自動ROLLBACKと、成功commit後の明示的なundoの両方について、
ローカルの一時SQLiteという実際のトランザクションエンジンを使い、モックではなく本物のSQL実行
結果を直接クエリして確認した。**実Supabase/Production環境での同等の検証は、まだ実施していない。**
