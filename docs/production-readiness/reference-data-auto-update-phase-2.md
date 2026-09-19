# 参照データ自動更新 Phase 2(staging・承認付き適用・rollback)実装記録

実装日: 2026-09-19。**本書が記録するすべての適用・rollback実証は、ローカルの一時SQLiteファイル
(`node:sqlite`)だけを対象に行った。実Supabase・実Postgres・実ネットワークへは一切接続していない。**

## 1. 目的

Phase 1(dry-run限定、書込み0件)を拡張し、「人間の明示承認がある場合だけ、安全ゲートを
全通過した更新候補をトランザクション内で適用し、失敗時は必ずロールバックする」という
Phase 2基盤を実装・ローカル実証すること。**実Production Supabaseへの適用は今回一切行っていない。**

## 2. 実装した部品(すべて`src/lib/reference-data/auto-update/`配下)

| ファイル | 役割 | 状態 |
|---|---|---|
| `job.ts` | 更新ジョブの状態モデル(pending→running→completed/failed→rolled_back)、許可された遷移だけを行う純関数 | 実装済み・テスト済み |
| `approval.ts` | 承認artifactの検証(jobId・datasetChecksum・diffChecksum・schemaVersion・期限・期待件数がすべて一致しない限り拒否) | 実装済み・テスト済み |
| `lock.ts` | advisory lock設計(`lockKeyForTable`、Production向けのkey導出)+ テスト用`InMemoryLockAdapter` | 実装済み・テスト済み |
| `tombstone.ts` | 削除候補の連続不在カウント・大量削除即reject・物理削除の静的検出(`assertNoPhysicalDeletion`) | 実装済み・テスト済み |
| `shadow-comparison.ts` | 適用後に読み戻した実データと期待値の完全一致検証(差分1件でも不合格) | 実装済み・テスト済み |
| `staging.ts` | ローカル合成SQLite専用のstagingスキーマDDL(`update_jobs`・`applied_checksums`・`audit_events`・`advisory_locks`・`target_records`)。**実行コードなし、DDL文字列のみ** | 設計のみ(合成環境向け) |
| `apply-orchestrator.ts` | 事前ゲート(許可テーブル・lock・二重実行・冪等性・plan判定・承認)全通過後だけBEGINし、UPSERT→shadow comparison→COMMIT/ROLLBACKを行う`applyUpdateJob()` | 実装済み・テスト済み(フェイクアダプター+実SQLite両方) |
| `rollback.ts` | 成功commit後の明示的なundo(`executeRollback()`、before-snapshotへの復元) | 実装済み・テスト済み(実SQLite) |
| `sqlite-adapter.ts` | `node:sqlite`の`DatabaseSync`を`QueryClient`インターフェースへ適合させるアダプター(ローカル合成環境専用) | 実装済み |

CLI: `scripts/migration/reference-data-auto-update-apply.mjs`(下記4章)。

## 3. 承認artifact(人間の明示承認)

`--yes`のような単純フラグでの適用は実装していない。承認artifactは次のすべてが現在の
ジョブ・差分内容と一致しない限り拒否される(`approval.ts`の`validateApproval`):

- `jobId`
- `datasetChecksum`(承認後にデータが変わっていないか)
- `diffChecksum`(承認後に差分内容が変わっていないか、`computeDiffChecksum`で算出)
- `schemaVersion`
- `expectedCounts`(added/updated/removedCandidate)
- `expiresAt`(期限切れなら拒否)
- `approvedBy`・`nonce`が空でないこと(空フラグだけでの承認を防ぐ)

承認artifact自体の生成(実ユーザー認証・電子署名)は今回の範囲外。第一段階として、
ローカルCLIへ明示的なJSONファイルとして渡す設計とした(タスクの明示的な許容範囲)。

## 4. apply CLI(`scripts/migration/reference-data-auto-update-apply.mjs`)

```
node scripts/migration/reference-data-auto-update-apply.mjs \
  --sqlite-db <ローカル一時SQLiteファイル> \
  --staging <取得結果JSON> --previous <前回スナップショットJSON> --schema <スキーマ設定JSON> \
  --job <ジョブメタデータJSON> --approval <承認artifact JSON>
```

- `--sqlite-db`は必須。このCLIにSupabase/Postgresへの接続コードは一切含まれていない
  (接続文字列・APIキーを読み取る処理が存在しない)。
- 次のフラグは実装しておらず、指定すると即座にエラー終了する:
  `--production`・`--force`・`--skip-validation`・`--no-lock`・`--no-rollback`・
  `--execute`・`--yes`。
- lockは対象テーブル名から導出したkeyで、同じSQLiteファイル内の`advisory_locks`テーブルを
  使って取得・解放する(取得済みなら即座に失敗、待機しない)。
- 二重実行防止は`update_jobs`テーブルの`status='running'`行の有無で判定する。
- 冪等性は`applied_checksums`テーブルに記録された`dataset_checksum`で判定する。
- 明示rollback: `--rollback-plan <plan.json>`を指定すると、適用モードではなくrollbackモードで
  動作する(`{jobId, beforeSnapshot, addedIds}`形式のJSONを受け取り、`rollback.ts`の
  `executeRollback`を実行する)。

## 5. ローカル実証結果(すべてローカル一時SQLite、実Supabase接続0件)

`apply-orchestrator.sqlite.test.ts`(6件)・`apply-cli.test.ts`(6件)で以下を実地確認済み:

1. 正常系: 事前ゲート全通過 → BEGIN → UPSERT → shadow comparison合格 → COMMIT。
   実際にSQLiteの`target_records`テーブルへ反映され、`update_jobs.status`が`completed`に、
   `applied_checksums`にも記録されることを、テスト内で直接SQLiteへクエリして確認した。
2. トランザクション途中の失敗(合成的にSELECT読み戻しで例外を発生させた): ROLLBACKが実行され、
   `target_records`に該当行が一切残らない(1件もcommitされない)ことを直接SQLiteへクエリして確認した。
   `update_jobs.status`も`completed`へ更新されていないことを確認した。
3. 事前ゲート失敗(承認artifact不正): BEGIN自体に到達せず、DBが一切変更されないことを確認した。
4. 成功適用後の明示rollback(undo): 新規追加された行の削除、更新された既存行のbefore-snapshot値への
   復元、無関係な既存行が影響を受けないこと、`update_jobs.status`が`rolled_back`になること、
   `applied_checksums`からエントリーが除去されることを確認した(詳細は
   `reference-data-auto-update-rollback-test.md`)。
5. advisory lock: 未取得のlockは取得でき、取得済みのlockへの二重取得は即座に(待機せず)失敗し、
   解放後は再取得できることを、SQLiteの`advisory_locks`テーブルへの直接UPDATE文で確認した。
6. 利用者データテーブル(`auth.users`・`my_team_snapshots`・`rls_probe_records`)を対象にした場合、
   `apply-orchestrator.ts`の許可テーブルチェック(`real-import-guards.ts`の既存許可リストを再利用)
   により、事前ゲートの時点で構造的に拒否されることを確認した。

## 6. 今回のセッションで実施していないこと(明確化)

- 実Supabaseへの接続・読み取り・書き込みは0回。
- Production向けのstaging schema作成・DDL実行は一切行っていない(`staging.ts`はDDL文字列を
  保持するだけで、実行対象は常にローカルの一時SQLiteファイル)。
- `CRON_SECRET`・service role key・その他Secretの生成・設定は行っていない。
- Vercel Cron・GitHub Actions schedule・Supabase Cron・Edge Functionの登録・デプロイは行っていない。
- commit・push・PR作成は行っていない(次回セッションでの判断事項)。
- Production Deploymentへの反映は行っていない。

## 7. Phase 3(定期実行)との関係

Phase 2は「人間の明示承認を経た手動apply」までを実装した。Phase 3(定期的なdry-run実行、
さらにその先の限定的な自動適用)は今回も一切実装・有効化していない(`reference-data-auto-update-design.md`
4章のPhase 3方針は変更なし)。
