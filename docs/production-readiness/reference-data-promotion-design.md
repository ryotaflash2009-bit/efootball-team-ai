# 参照データ自動更新 Promotion設計(stagingから確定相当テーブルへの昇格)

作成日: 2026-09-20。**この文書が説明するpromotion処理は、隔離PostgreSQL(GitHub Actions
service container、`reference_data_ops_test`/`reference_data_test`)専用に設計・実装・
検証したものであり、Production(実Supabase・実`reference_data`/`reference_data_ops`)へは
一切接続・適用していない。**

## 1. 目的

`reference_data_ops`(staging)に投入された承認済みデータセットを、`reference_data`相当の
確定テーブルへ、単一transaction内で安全に昇格する処理の設計・実装・隔離環境での実証。

## 2. 対象スキーマ(隔離テスト専用)

- staging: `reference_data_ops_test`(`postgres-staging.ts`)
- 確定相当: `reference_data_test`(`postgres-final-schema.ts`、実`reference_data`の
  `world_player_cards`/`managers`/`player_card_analysis`の列構造を忠実に再現。RLS・
  GRANT・トリガーは省略、詳細は同ファイルのコメント参照)

## 3. PromotionPlan(`promotion.ts`)

```ts
interface PromotionPlan {
  jobId: string;
  schemaVersion: string;
  sourceIdentifier: string;
  sourceTable: string;       // 例: staging_world_player_cards
  targetTable: string;       // 例: world_player_cards
  datasetChecksum: string;
  diffChecksum: string;
  beforeChecksum: string;        // 更新される行の昇格前状態(updated_at除く)
  expectedAfterChecksum: string; // 昇格後の期待状態全体
  expectedCounts: { added; updated; unchanged; removedCandidate };
  allowedSourceTables: readonly string[];
  allowedTargetTables: readonly string[];
  promotionOrder: readonly string[]; // world_player_cards -> managers -> player_card_analysis
  snapshotRequired: true;
  rollbackPlanId: string;     // jobIdから決定的に導出
  approvalArtifactId: string; // ApprovalArtifactの内容から決定的に計算
  generatedAt: string;
  expiresAt: string;
}
```

既存の`job.ts`/`approval.ts`/`diff.ts`が「1ジョブ=1テーブル」というモデルであることに
合わせ、PromotionPlanも1テーブル単位とした(3テーブルへの対応は、このオーケストレーターを
3回呼び出すことで実現する)。

**PromotionPlanとApprovalArtifactが完全一致しなければ拒否する**
(`validatePromotionPlanAgainstApproval`): jobId・datasetChecksum・diffChecksum・
schemaVersion・approvalArtifactId(承認内容からの再計算値)のすべてが一致しない限り、
昇格は開始されない。単純な`--yes`/`--force`のようなフラグだけでの昇格は、この一致検証
そのものが存在しない設計であり構造的に不可能。

## 4. promotion処理(`promotion-orchestrator.ts`、25手順・単一transaction)

事前ゲート(BEGIN前、純関数のみ): 直前ジョブ実行中でないこと、datasetChecksum未適用
(冪等性)、staging checksum不変、PromotionPlan未失効、対象テーブルallowlist、
PromotionPlanとApprovalArtifactの一致、承認内容の妥当性、diff安全ゲート、削除候補件数
上限、bypassフラグ不在。1件でも不合格ならBEGINへ到達しない。

トランザクション内(すべて単一transaction、失敗時は必ずROLLBACK):

1. BEGIN
2. `set local statement_timeout`
3. `set local lock_timeout`
4. `set transaction isolation level serializable`
5. `pg_try_advisory_xact_lock`(取得失敗なら待機せず即中止)
6. `update_jobs`を`running`へ更新
7-10. 承認・PromotionPlan・staging checksum・safety gateの再検証(多層防御)
11. 対象テーブルのrow count確認(promotion前の期待件数と一致するか)
12. removed candidate件数確認(上限超過は事前ゲートで既に拒否)
13. before snapshot作成(`promotion_before_snapshots`、insert/update区別・beforeChecksum付き)
14. source metadata snapshot作成(`source_metadata_test`、job単位の履歴)
15. added records insert
16. updated records update
17. unchanged records不変確認(行が消失していないか)
18. removed candidate非削除確認(行が消失していないか、物理削除の早期検出)
19. source metadata更新(確定テーブル側`source_metadata`、上書き前に`promotion_source_metadata_before`へ退避)
20. readback
21. shadow comparison(`compareAppliedResult`、差分1件でも不合格)
22. expectedAfterChecksum確認
23. applied checksum記録
24. audit記録(秘密情報を含まない件数情報のみ)
25. jobを`completed`へ更新
26. COMMIT

## 5. promotion SQL(`promotion-sql.ts`)

- schema・table・column名はすべて固定定数(`PROMOTION_TABLE_SPECS`)からのみ選択し、
  外部入力から動的に組み立てない。
- `SELECT *`を使わない(全SQLで列を明示)。
- `INSERT ... ON CONFLICT DO UPDATE`(UPSERT)以外の物理削除・DDL・GRANT・動的SQLは
  一切生成しない(DELETEは明示rollback専用の2関数だけに限定し、いずれも主キー等価条件の
  WHERE句を必須とする)。
- 静的監査(`promotion-sql-audit.ts`)で上記をすべて機械的に検証済み。

## 6. removed candidate(非削除の保証)

外部取得結果から消えた行は物理削除しない。`removedCandidateIds`として扱い、promotion
transaction内では「行が消失していないか」だけを確認する(内容変更もしない)。tombstone化
(無効化)・valid_to更新等の状態変更は、今回のpromotion処理には一切含まれない(将来、
人間承認を経た別処理の責務)。

## 7. shadow comparison

`compareAppliedResult`(既存のPhase 2実装を再利用)で、added・updated・unchanged・
removedCandidateすべてのIDについて、期待した内容と実際の読み戻し結果を突き合わせる。
1件でも不一致ならROLLBACKし、promotion成功として扱わない。jsonb列(`stats`/`appearance`/
`efhub_conflicts`/`boosters`/`link_up_plays`/`player_model`/`positions`)はJSON文字列化
した状態で比較する(node-postgresがJSのobjectを自動でjsonb化しないため、書込み時と
読み戻し後の表現を一致させる必要がある。`mapFieldsToParams`で統一)。

## 8. 検証状況

- ローカル(合成fakeクライアント、`promotion-orchestrator.test.ts`): 28件、正常系・
  失敗注入マトリクス・明示rollback・二重rollback拒否を含めすべて成功。
- GitHub Actions実PostgreSQL(`promotion-orchestrator.postgres.test.ts`): **このセッション
  では未実行**(ローカルWindows環境にPostgreSQLが存在しないため)。ワークフロー変更は
  不要(既存`vitest.postgres.config.ts`の`include`がglobパターンのため、新規ファイルは
  追加設定なしで対象に含まれる)。

## 9. Production未対応の明示

- promotion対象は`reference_data_ops_test`/`reference_data_test`のみ。実`reference_data`・
  実`reference_data_ops`への昇格SQLは一切実装していない。
- Production向けの`createProductionAdapter()`は引き続き常に例外を投げる(意図的な未実装)。
- 専用roleの作成・Production credentials設定・GitHub Secrets・Vercel Environment
  Variables変更は今回一切行っていない。
- Production applyへ進むには、このpromotion設計を別PRでレビューしたうえで、実DB
  read-only preflight・backup確認・staging適用・専用role・credentialsについて個別の
  承認が必要(`reference-data-production-apply-runbook.md`参照)。
