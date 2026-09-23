# 参照データ自動更新 アーキテクチャ v2(Phase A: 契約固定、2026-09-23)

本書は`reference-data-auto-update-design.md`(2026-09-19)を、Production Backup基盤の完成
(Run #7)と、その過程で判明した事実を踏まえて更新した設計の正本である。Phase Aでは契約を
文書・TypeScript型・定数・純関数・テストで固定するだけであり、**Production・R2・外部source
への接続、Workflow・Cron・Schedulerの追加、Secretの作成は一切行っていない(Production影響0)**。

契約コード(単一の真実源):

| ファイル | 内容 |
|---|---|
| `src/lib/reference-data/auto-update/update-contract.ts` | table契約・identity・canonicalization/checksum・diff category・idempotency/concurrency・Secret境界・Evidence |
| `src/lib/reference-data/auto-update/update-batch-state.ts` | update batch状態機械・retry policy |
| `src/lib/reference-data/auto-update/update-policy.ts` | safety policy閾値・評価・Production apply前提条件 |

## 1. Purpose

外部sourceの更新を、Production参照データへ**安全に・監査可能に・人の承認付きで**反映する
仕組みの契約を定める。自動化するのは「検出・取得・正規化・差分・policy評価・隔離dry run」
までであり、Production書込み(apply)・rollbackは常に人の明示承認を必要とする。

## 2. Current State

- 参照データの公開経路はSupabase `reference_data`(`WORLD_DATA_SOURCE`未設定・空は`supabase`、
  `sqlite`で即座に旧経路へ戻せる。不正値は例外、暗黙のfallbackなし、runtimeで解決)。
- 外部取得スクリプト(`scripts/sync-world-players-{initial,incremental}.mjs`・
  `scripts/sync-managers.mjs`)は動作するが、書込み先は本人PCのローカルSQLite(gitignore対象)。
- Supabaseへの投入は一回限りのimportスクリプトで行われており、一般的な更新経路は未実装。
- `auto-update/`配下にdiff・safety gate・承認・lock・tombstone・shadow comparison・
  apply/rollback・promotionの純関数/隔離検証済みmoduleが存在する(Production未接続)。
- Workflowは`ci.yml`と`reference-data-production-backup.yml`(workflow_dispatchのみ)だけで、
  scheduleは存在しない。

## 3. Proven Backup Boundary

- **Run #7が有効なpre-apply baseline Backup**(4 tableのrow count・table checksum・total
  checksum・source metadata checksumが、R2実ファイルのメモリ内復号→使い捨てPostgreSQL 16への
  隔離Restoreで完全一致。JSONB・text[]保持、平文のディスク書込みなし)。
- **Run #6は無効な空Backup(全4 table 0行)で、Evidenceとしてだけ保持する。Run #6を
  restore pointやbaselineとして使わない。** 削除は別承認。
- Backup件数(13009/66/19/8)は自動更新のbaselineとして直接使わない(Backup件数と
  更新対象件数は別物で、import_batchesは累積する)。baselineは最初の有効なdry runで作る。

## 4. Data Sources

| table | source | 取得方式(既存スクリプト) |
|---|---|---|
| `world_player_cards` | eFootball World players search API | UPDATED_AT降順・appearance.updatedAt比較・早期停止・先頭page content hashで無変化判定、間隔3秒・同時1・20秒timeout・429/403/CAPTCHA即停止・Cookie/認証なし・UA偽装なし |
| `managers` | GitHub上の公開`managers.json` | GET 1回・redirect非追跡・20秒・再試行なし |
| `player_card_analysis` | なし(固定の手動収集19件) | 自動取得しない |
| eFHUB | 自動取得対象外 | World cardとのリンク(`efhub_card_id`・`efhub_conflicts`)はローカル計算のみ |

## 5. Source Permissions and Constraints

- `data-distribution-rights-audit.md` 0章に、公開・再配布・データ利用・画像利用・**更新連携**・
  将来の商用利用に必要な許諾をプロジェクト責任者が取得済みと記録されている(原文は非公開保管。
  リポジトリからは範囲を検証できない)。
- 自動化でも既存のレート制限・停止条件を維持し、ログイン・Cookie・有料/会員限定コンテンツ・
  アクセス制御の回避・個人データの取得を行わない。eFootball Worldの利用規約全文レビューは
  未実施(停止条件ではないが、Phase B着手前の確認事項)。

## 6. Target Tables

| table | class | 自動操作 | 削除 |
|---|---|---|---|
| `world_player_cards` | upstream_direct_with_local_computed_fields | insert / update | 物理削除禁止、removedはtombstone候補→人のreview |
| `managers` | upstream_direct | insert / update | 同上 |
| `import_batches` | audit_metadata | append(当該batchの行のstatusだけpending→verified/rolled_back) | 禁止、既存行はimmutable |

- World cardのlocally computed fields(`efhub_card_id`・`efhub_conflicts`・`name_sort_key`)は
  preserveまたはrecomputeし、黙って空にしない。`ai_styles`・`appearance`はupstream対応を
  Phase Bで確認するまで既存値を保持する。
- managersの`internal_manager_id`・`name_ja`・`team_name`・`nationality`・`age`・
  `manager_rating`・`coaching_affinity`・`formation`は、既存syncと同じく更新時に保持する
  (insert時のみ設定)。

## 7. Excluded Tables

- `player_card_analysis`: frozen_internal_manual_dataset(参考: 現在19件)。自動のinsert/
  update/deleteは禁止。World cardの削除は`on delete cascade`でこのtableへ波及するため、
  World cardの物理削除自体を禁止する。
- `auth.*`・`public.my_team_snapshots`・`rls_probe_records`・すべてのuser dataは絶対除外。
  契約table以外・reference_data以外のschemaはfail closed。

## 8. Identity Model

| table | identity | 備考 |
|---|---|---|
| `world_player_cards` | `world_card_id`(数字だけの文字列) | trim・fallbackなし |
| `managers` | `source`+`source_manager_id`をJSON配列でcanonical encode | 区切り文字の曖昧性なし。`internal_manager_id`は主キーでありupstream identityではない |
| `import_batches` | `batch_id`(小文字正規形UUID) | append only |
| `player_card_analysis` | `world_card_id` | 自動更新対象外 |

行番号・表示名・manager名だけをidentityにしない。null/undefinedは空文字へ変換せずblocked。

## 9. Canonicalization and Checksums

- 行checksumは既存`computeRecordChecksum`(SHA-256、列名ソート)をそのまま使う。Backup
  (Run #7を含む)のchecksumがこの関数に依存するため、関数自体は変更しない。
- 自動更新では、checksumの**前に**`canonicalizeUpdateRow`で値を正規化する:
  - jsonb: 再帰的に正規化し、objectのkeyをPostgreSQL jsonbと同じ順序
    (UTF-8バイト長が短い順、同じ長さはバイト順)へ並べる。Run #7隔離Restoreのdry run中に、
    この順序が違うとchecksumが一致しないことを実際に確認している。
  - text[]: 要素の順序を保持する(並べ替えない)。要素は文字列のみ。
  - timestamp: UTC・ミリ秒付きISO 8601。タイムゾーンの無い文字列・不正値はblocked。
  - 数値: 有限値のみ(NaN・Infinityはblocked)。負のゼロは0へ正規化。
  - SQL NULLはnull。undefined・欠落列・契約外の列(schema drift)はblocked。NUL文字はblocked。
  - encodingはUTF-8。
- 比較から除外するvolatile columns(world/managers): `fetched_at`・`created_at`・
  `updated_at`・`dataset_version`・`import_batch_id`。**`appearance_updated_at`はupstreamの
  更新シグナルなので比較対象に残す。** locally computed fieldsも除外しない。
  import_batchesには同じ除外契約を適用しない(table全体がappend-only監査メタデータ)。
- row順序はidentityのUTF-8バイト順、table順序は契約の固定順(world→managers→import_batches)。
- Evidence・ログのchecksumは12桁の短縮表示。完全値は内部artifactだけに持つ。

## 10. Diff Model

| category | 意味 | 既定の扱い |
|---|---|---|
| added | upstreamに新しく現れたidentity | table別policy |
| changed | 比較列のchecksumが変化 | table別policy |
| unchanged | 比較列のchecksumが同一 | pass |
| removed | Productionにあるがupstreamに無い。**物理削除を意味しない**(tombstone候補) | manual_review |
| resurrected | tombstone履歴のidentityが再出現 | manual_review |
| duplicate | 同一snapshot内の重複identity | hard_block |
| invalid | schema/value validation失敗 | hard_block |
| schema_drift | 未知・欠落列、非互換な型 | hard_block |
| source_missing | page・table・sourceの一部取得失敗 | hard_block |

既存`diff.ts`の`updated`/`removedCandidate`はそれぞれ`changed`/`removed`に対応する。
diff reportはtable・件数・checksum・sample identifier(最大20件)・変更列名だけを持ち、
行全体・変更値・Secret・user/auth data・外部コンテンツ全文を含めない。

## 11. Safety Policy

重大度は`hard_block > manual_review > warning > pass`の優先順で集約する。閾値は
`UPDATE_POLICY_THRESHOLDS`(凍結されたコード定数)だけが持ち、環境変数・設定・引数では
変更できない。変更はテスト付きPRのレビューで行う。数値は**推奨初期値**であり、最初の
有効なdry run以降にcalibrateする。

- hard block: source取得/解析失敗、schema drift、必須列欠落、重複identity、更新後0件、
  契約外table、user/auth data混入、checksum生成失敗、不正な数値/jsonb/text[]、source missing、
  identity再利用衝突、source時刻の逆行、適用済みsource checksum、既存import_batches行の変更、
  物理削除、player_card_analysisの変更、World card件数の2%超の減少、manager件数の10%超の減少。
- manual review: 未承認のremoved、resurrected、World card件数の減少(0より大)、World cardの
  added+changedが7500超(既存incremental syncの既定上限500件×15page)、managerのあらゆる変更、
  payload sizeのbaseline比50%以上の変化、直前のapplyから24時間未満、baseline無し(初回)。
- warning: World cardの追加、件数増加率2%超、added+changedが閾値の80%以上。

## 12. Batch State Machine

正規経路: `detected → source_fetched → normalized → diff_generated → awaiting_review →
backup_requested → backup_verified → dry_run_started → dry_run_verified →
awaiting_production_approval → applying → applied → completed`

- block: `diff_generated → policy_blocked`(以後は中止のみ)
- dry run失敗: `dry_run_started → dry_run_failed`(以後は中止のみ)
- apply失敗・post verify失敗: `applying → rollback_required`、`applied → post_verify_failed →
  rollback_required → rolled_back`
- apply前の状態からだけ`cancelled`/`superseded`へ進める。apply開始後は不可。
- 終端: `completed`・`rolled_back`・`cancelled`・`superseded`。
- `backup_verified`・`dry_run_verified`・`awaiting_production_approval`は、applyingへ至る
  どの経路でも省略できない(テストでグラフ全体を検証)。二重applyは構造的に不可能。
- 人の明示承認が必要な遷移: review解決(`awaiting_review → backup_requested`)、
  Production apply(`awaiting_production_approval → applying`)、rollback実行
  (`rollback_required → rolled_back`)。後2者だけがProduction書込み遷移。
- 既存`job.ts`の5状態は変更せず、`toLegacyJobStatus`で対応付ける。

## 13. Retry Policy

- 自動retryは更新検出とsource取得だけ(network error・5xx・timeoutのみ、最大2回の再試行)。
  sourceのレート制限を守る固定間隔。
- 429は既存Fetcherの方針どおり即停止を優先(Retry-Afterによる待機は後続Phaseで個別承認)。
  403・CAPTCHA・schema driftは即停止。
- parse・normalize・diff・policy・Backup・dry run・承認・apply・post-apply検証・rollback・
  Restoreは自動retryしない。retryの記録(stage・attempt・reason・時刻)はEvidenceへ残す。

## 14. Idempotency and Concurrency

- update idempotency key = SHA-256(canonical JSON: contract version・source snapshot
  checksum・契約順へ正規化したtarget table集合・updater version)。区切り文字連結は使わない。
- Backup key・apply keyはupdate keyから種別付きで導出する(apply keyはBackup run IDも含む)。
- concurrency: 検出は並列可(`reference-data-update-detection`)、source取得はsource単位、
  dry runはcandidate単位、Backup・apply・rollbackは`reference-data-production-write`で
  global直列。DB側はadvisory lockと適用済みchecksumの一意性で二重適用を防ぐ。
  古いcandidate・superseded candidateはapplyしない。Phase AではWorkflowへ追加しない。

## 15. Backup Integration

- Backupは既存のapproval付き`workflow_dispatch`のまま本人が起動する(scheduleしない)。
- apply時に、Backup run IDについて次をすべて確認する: main上・success・category pre-apply・
  restoreVerified・storageVerified・既存の内容妥当性policy合格(Run #6相当の空Backupを拒否)・
  dry run開始より前に完了・apply時点で24時間以内。
- Backupとapplyを同じjobやworkflow_callで連結しない(読み取り専用のBackup資格情報と
  書込み資格情報を混ぜないため)。

## 16. Isolated Dry Run

- CIのPostgreSQL 16 service container(使い捨て、Production資格情報・R2書込みなし)で行う。
- 現状はサイトと同じ公開anonのData API経由で読む(新しい権限不要。import_batchesは読めず不要)。
- candidateを適用→行数・checksum・JSONB/text[]保持・shadow comparison→rollbackを模擬し、
  元のchecksumへ戻ることを確認する。結果は行データ・Secret・Production識別子を含まない
  JSONとして残す。

## 17. Approval-Gated Production Apply

- 方式: staging経由のupsert+tombstone(物理削除なし)。1 transaction・advisory lock・触れる
  行のbefore snapshot・import_batches行の追加。staging swap・versioned table・pointer切替は、
  RLS policy・grant・外部キー・既存のBackup/reader policyを毎回再構成する必要があるため採用しない。
- apply前提条件は`evaluateApplyPrerequisites`が列挙型のfailure codeで全件判定する
  (1件でも不足ならapply不可、入力値をfailureへ含めない)。
- apply後: 行数・checksum・source metadata checksum・公開API/pageのsmoke・import_batchesの確定。

## 18. Rollback Strategy

- 第一: 失敗時のtransaction rollback(DBエンジンが同一transaction内で取り消す)。
- commit後: before snapshotからの明示undo(本人承認)。rollback SQLはdry runで事前生成する。
- 最終手段: 有効なR2 Backup(Run #7以降、Run #6は絶対に使わない)からの全体Restore。手動のみ・
  高リスクであり、Backupの列欠落(24章)を解消するまで完全なrollback手段にならない。
- 自動rollback・自動Restoreは禁止。rollback後は再検証し、失敗Evidenceを保持する。

## 19. Secret Boundaries

| component | Secret | Environment | DB role |
|---|---|---|---|
| detection | なし | なし | なし |
| dry run | なし | なし | なし(使い捨てPostgreSQLの一時資格情報のみ) |
| backup | 既存の7件(変更なし) | `production-backup-approval` | `reference_data_backup_reader` |
| production apply(候補、未作成) | `REFERENCE_DATA_APPLY_DB_URL`・`REFERENCE_DATA_APPLY_DB_CA_CERT` | `reference-data-production-apply`(候補) | `reference_data_updater`(候補) |
| notification | `GITHUB_TOKEN`のみ | なし | なし |

- Backup資格情報とapply資格情報は相互に禁止し、両方を必要とするcomponentを作らない。
- apply roleはNOBYPASSRLS・非owner・Backup roleと分離・auth/user dataへのアクセスなし・
  player_card_analysisへの書込みなし。Secret値はログへ出さない。rotation・revocationは本人。
- 公開anon keyはSecretではなく読み取り専用の公開設定として扱う。

## 20. Evidence and Notifications

- Evidence(`UpdateEvidence`)は許可されたfieldだけ(batch ID・idempotency key・source checksum・
  時刻・version・commit・table別件数・diff件数・短縮checksum・policy結果・Backup run ID・
  dry run/approval/apply/post-verify結果・最終状態)。行データ・変更値・Secret・DB URL・
  Project Ref・private endpoint・完全なobject key・age秘密鍵・auth/user data・外部payload全文は
  含めない。sample identifierはtable毎に最大20件のidentityだけ。
- 保存先(後続Phase): Actions job summary・非秘密JSON artifact・import_batches・適用した
  batchだけrunbookへ記録。通知は初期はGitHub Issue(`GITHUB_TOKEN`、追加Secretなし)。

## 21. Scheduler Decision

- 第一候補: GitHub Actions `schedule`(検出とdry runだけ、Secretなし・Environmentなし)。
- 第二候補: 手動`workflow_dispatch`(Backup・applyは常にこちら)。
- 不採用: Vercel Cron(実行時間制限・公開endpoint)、Supabase pg_cron(Production DB内で動く)、
  Cloudflare Workers Cron(新しいGitHub token・別基盤)、本人PCのTask Scheduler、専用VM。
- **Backupとapplyはscheduleしない。** Phase AではWorkflow・scheduleを追加しない。

## 22. Automation Levels

- **初期はLevel 2**(検出〜dry runを自動、Backupは本人起動、Production applyは本人承認、
  post-verifyは自動、rollbackは手動)。
- Level 3(applyも自動、異常時のみ停止)の条件: 連続10 batch以上・8週間以上の問題なし、
  見逃し0、誤block率10%未満、schema drift対応1回以上、Backup成功率100%、rollback rehearsal
  1回、alert 24時間以内対応、source挙動と費用が安定。対象もadded/changedだけに限る。
- Level 4(自動rollback)は推奨しない(Production Restoreが最高リスク操作で、Backupの列
  欠落も未解消のため)。

## 23. Phase Roadmap

| Phase | 内容 | Production影響 |
|---|---|---|
| A | 本書・契約・状態機械・policy・テスト | なし |
| B | Fetcher/normalizerのlibrary化、snapshot JSON、manager identity mapping | なし |
| C | deterministic diff(canonical jsonb・volatile除外・tombstone) | なし |
| D | policy engineの結線 | なし |
| E | CI隔離dry run | なし |
| F | Backupの列追加・summary artifact・apply時の検証 | なし |
| G | updater role/policy SQL・reference_data_opsのapply/rollback/verify SQL・apply workflow | あり(各段階を別承認) |
| H | post-apply検証・通知 | 読み取りのみ |
| I | 検出・dry runのschedule | なし |
| J | 1 batchの半自動E2E rehearsal | あり(承認) |
| K | Level 2の限定本番運用 | あり(承認) |

## 24. Known Gaps

1. **Backupの列欠落**: `world_player_cards.appearance_updated_at`・
   `world_player_cards.import_batch_id`・`managers.import_batch_id`・
   `player_card_analysis.import_batch_id`がBackup specに無い(`KNOWN_BACKUP_COLUMN_GAPS`。
   テストがDDL基準の列とBackup specの差を固定しており、Phase Fで解消すると知らせる)。
2. **managerのunique constraint**: `(source, source_manager_id)`にDBの一意制約が無い
   (Phase Gまたは別のProduction migrationで対応、それまではコードで強制)。
3. **SQLiteのdrift**: 自動更新後、`WORLD_DATA_SOURCE=sqlite`の旧経路は古いデータを返す。
   凍結するかSupabaseから再生成するかは未決定。
4. **物理削除**: 初期フェーズでは禁止。tombstoneの閾値・非表示方式は未決定。
5. **reference_data_ops**: Production未作成(staging・job・承認・before snapshotの置き場)。
6. `ai_styles`・`appearance`のupstream対応(Phase B)。
7. Production実schemaとリポジトリ内DDLの一致(read-onlyでの確認は別承認)。

## 25. Phase A Scope

契約文書・`update-contract.ts`・`update-batch-state.ts`・`update-policy.ts`と、その単体
テストだけ。既存moduleの動作・Backup・Workflow・UI・API・migrationは変更していない。

## 26. Out of Scope

Fetcher抽出、外部取得、Production adapter/接続、Production apply、Workflow・Cron・Scheduler、
Secret・Environment・role作成、reference_data_opsのProduction作成、managerの一意制約migration、
Backupの列追加、SQLite同期、物理削除、tombstoneの自動適用、自動rollback。

## 27. Release Gates

- 各Phase末尾: 型チェック・全テスト・Build・Backup compile/runtime smoke・PostgreSQL
  validation・npm audit・Secret scan・Git差分監査。
- Production影響のある操作(Phase G以降)は、それぞれ事前のmetadata-only確認・本人の明示承認・
  事後のmetadata-only確認を経る。apply・rollbackはEnvironment承認付きで、自動retryしない。
- 新しいProduction Backupは常に別承認。Run #6は削除・Restoreしない。
