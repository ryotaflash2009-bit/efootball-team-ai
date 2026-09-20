# 参照データ自動更新 Production Preflight 設計(未接続・未適用)

作成日: 2026-09-19。**このセッションでは実Supabase・実Productionへ一切接続していない。**
実装コード: `src/lib/reference-data/auto-update/production-preflight.ts`・
`production-readonly-queries.ts`(いずれも純関数、fake fixtureでテスト済み、実DB接続コードなし)。

## 1. Production adapterの安全境界

`createProductionAdapter()`は**呼び出すと必ず例外を投げる**(意図的な未実装)。実装されているのは
「接続する前に拒否できるかどうか」の判定ロジックだけである。

`ProductionAdapterConfig`型が持つ値はすべて次の性質を満たす:
- 生のホスト名・接続文字列・パスワードを保持しない(`databaseFingerprint`はSHA-256の先頭16文字に
  短縮したfingerprintのみ)。
- `calledFrom`フィールドで呼び出し元を明示させ、`"cli"`以外(`vercel-runtime`・`client`・
  `public-endpoint`・`cron`)を`checkCalledFromAllowedContext()`が拒否する。

## 2. 接続前preflight(`evaluateProductionPreApplyGates`)

次のいずれか1件でも不合格なら、接続処理自体に到達しない(現状は接続コード自体が存在しないため、
これは将来実装する場合の必須ゲートとして設計している):

1. Production modeが明示的に有効化されている(`productionModeExplicitlyEnabled`)
2. 呼び出し元が`cli`である
3. 対象schemaが`reference_data_ops`と一致する
4. 接続先データベースのfingerprintが期待値と一致する
5. SSLが有効
6. certificate validationが有効
7. 対象テーブルが`reference_data_ops`の許可リスト内(`update_jobs`・`approvals`・
   `applied_checksums`・`audit_events`・`staging_world_player_cards`・`staging_managers`・
   `staging_player_card_analysis`・`before_snapshots`・`rollback_jobs`・
   `source_metadata_snapshots`)であり、`auth.users`・`my_team_snapshots`・
   `rls_probe_records`を含まない
8. 承認artifactが存在し、jobId・datasetChecksum・diffChecksum・schemaVersion・期待件数・
   有効期限のすべてが一致する(Phase 2の`approval.ts`をそのまま再利用)
9. rollback planが準備済み
10. backupが確認済み
11. shadow comparison planが準備済み
12. 直前のジョブが実行中でない
13. lockが利用可能と確認されている(`"unknown"`も不合格として扱う、確認できていない状態を
    「安全」とみなさない)
14. bypass/force系フラグが検出されていない

## 3. Preflightレポート形式(`buildProductionPreflightReport`)

```ts
{
  environment: "production",
  targetSchemaFingerprint: string,   // schema名のfingerprint(生の値は含まない)
  databaseFingerprint: string,
  schemaVersion: string,
  expectedSchema: "reference_data_ops",
  requiredTables: string[],
  forbiddenUserDataTables: ["auth.users", "my_team_snapshots", "rls_probe_records"],
  allowedWriteTables: string[],
  currentJobStatus: "idle" | "running" | "completed" | "failed",
  lockAvailable: boolean | "unknown",
  checksumStatus: "matched" | "mismatched-or-missing",
  approvalStatus: "present" | "missing",
  backupStatus: "confirmed" | "unconfirmed",
  rollbackReadiness: "ready" | "not-ready",
  shadowComparisonReadiness: "ready" | "not-ready",
  decision: "ready" | "blocked",
  blockingReasons: string[],   // sanitizeErrorMessage済み、秘密情報を含まない
}
```

ホスト名・URL・パスワード・トークン・接続文字列は、このレポートのいかなるフィールドにも
含まれない設計(fingerprintまたは列挙型の状態値だけを持つ)。

`backupConfirmed`(2章の必須項目8)は、`reference-data-production-backup-design.md`の
Production Backup gate(`backup-gate.ts`、17項目)の`decision === "ready"`を
`deriveBackupConfirmedFromGate`で変換した値を渡すことを想定している。詳細は
[[reference-data-production-backup-design.md]]を参照。

## 4. 接続後read-only preflight(設計のみ、クエリ案と検証コードだけ)

対応するSQL案: `docs/production-readiness/sql/preflight-reference-data-ops.sql`
(SELECT/SHOW専用、DDL/DML/GRANT/REVOKEを一切含まない、静的監査済み)。

対応する検証関数(`production-readonly-queries.ts`、すべて合成データでテスト済み、
実クエリ結果の取得コードはこのセッションでは実装していない):

| 確認項目 | クエリ | 検証関数 |
|---|---|---|
| schema存在確認 | `schemaExists` | (呼び出し側で件数確認) |
| テーブル一覧の完全一致 | `tableList` | `validateTableList` |
| anon/authenticatedへの権限が0件 | `forbiddenTableGrants`・`forbiddenSchemaUsage` | `validateNoForbiddenGrants` |
| 全テーブルでRLS有効+FORCE | `rlsStatus` | `validateRlsEnabledAndForced` |
| 実行中ジョブが0件 | `runningJobs` | `validateNoRunningJobs` |
| SSL接続確認 | `sslStatus` | `validateSslActive` |

## 5. 誠実な限界の開示

- ここまでの設計・実装は、実DBへ一度も接続せずに行った(合成fixtureとfake adapterだけで
  検証済み)。実際にSupabase Postgresへ接続した場合の挙動(pooler経由の制約、実際の
  `information_schema`の応答形式の細部等)は未検証。
- `reference_data_ops`スキーマが実際にどのような権限モデルで運用されるか(2章「最小権限設計」の
  結論である案C)は、本人の判断と、Supabase側での専用ロール作成という独立した承認事項を
  経てから初めて確定する。
- Production preflightの「ready」判定は、あくまで「このセッションで設計したゲートをすべて
  満たしている」ことを意味するのみであり、Production適用そのものの安全性を保証するものではない
  (接続処理自体が未実装のため、実地検証はまだ一切行われていない)。
