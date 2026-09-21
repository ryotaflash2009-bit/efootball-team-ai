# Production Backup role 作成・確認 実行手順・実施記録

作成日: 2026-09-21。**この文書のうち1〜4章は元々の実施手順であり、記載された操作は
このセッションでは一切実行していない(Claude Codeは一貫してProduction Supabaseへ
未接続)。6章は、本人が独立してこの手順を実施した結果の記録(2026-09-21、metadata値のみ)。**

関連: [[reference-data-production-backup-role-design.md]]・[[reference-data-production-backup-credentials.md]]・
[[reference-data-production-backup-approval-runbook.md]]

## 1. 前提条件

1. [[reference-data-production-backup-role-design.md]]の設計・独立監査結果を本人が確認済み。
2. `docs/production-readiness/sql/create-reference-data-backup-role.sql`の内容を本人が
   目視確認済み(DO NOT RUNバナー・password句が無いこと・GRANT対象が4テーブルだけで
   あることを含む)。
3. role作成という単独の判断について、本人が独立して承認済み(他の操作の承認と
   まとめない)。

## 2. role作成手順

1. Supabase Dashboardを開く。
2. 対象Productionプロジェクトを選択する。
3. SQL Editorを開く。
4. New queryを作成する。
5. エディタの内容をクリアする。
6. `create-reference-data-backup-role.sql`の内容を貼り付ける。
7. 冒頭の安全宣言(DO NOT RUN/DESIGN ONLY/REQUIRES SEPARATE APPROVAL/PRODUCTION NOT
   APPLIED/DOES NOT CREATE OR STORE A PASSWORD/DOES NOT GRANT USER-DATA ACCESS)を
   確認する。
8. **本人が明示的に承認した場合だけ**Runをクリックする(Claude Codeはこの操作を
   実行しない)。
9. 実行結果にエラーが無いことを確認する。

## 3. password設定手順(role作成とは別操作)

1. 強力なランダムパスワードを、本人が信頼する方法で生成する(Claude Codeへ
   生成を依頼しない、チャットへ貼り付けない)。
2. Supabase DashboardのDatabase → Roles画面、または`alter role
   reference_data_backup_reader password '<生成したパスワード>';`を本人が
   SQL Editorへ直接入力して実行する(この文言をClaude Codeとの会話やコミットへ
   含めない)。
3. 生成した接続文字列(role名・password・接続先を含む)を、本人が直接
   GitHub Secretsの`REFERENCE_DATA_BACKUP_DB_URL`へ登録する(GitHub Web UI経由、
   Claude Codeを介さない)。

## 4. 作成後確認手順

1. SQL Editorで`verify-reference-data-backup-role.sql`を実行する。
2. 結果のJSONを本人が目視確認する:
   - `role_exists: true`
   - `login: true`
   - `superuser`/`createdb`/`createrole`/`replication`/`bypassrls`がすべて`false`
   - `schema_usage.reference_data_usage: true`、他3項目は`false`
   - `table_privileges`の4件すべてで`can_select: true`、他の権限はすべて`false`
3. 想定と異なる結果が1件でもあれば、role作成SQLを見直し、[[reference-data-production-backup-role-revocation.md]]の
   手順で一旦停止してから再作成を検討する。
4. 結果のJSONをそのまま外部やClaude Codeへ共有する場合、内容がmetadataだけ
   (role名・boolean値・数値・timeout設定文字列)であり、password・接続文字列・
   Project ID等を含まないことを確認してから共有する。

## 5. 誠実な限界の開示

この手順書は設計段階のものであり、実際にこの手順どおりに実行して成功したことを示す
記録はまだ存在しない。

## 6. Production実施記録(2026-09-21、本人実施・本人確認)

**role作成SQL(`create-reference-data-backup-role.sql`)は無変更のまま、本人がProductionで
実行した。role名・boolean値・数値・timeout設定文字列以外の情報(password・接続文字列・
Project ID等)はこの記録に一切含まない。**

### 6.1 検証SQLの不具合修正

1回目の`verify-reference-data-backup-role.sql`実行時、`ERROR: 3F000: schema
"reference_data_ops" does not exist`でProductionが停止した(`reference_data_ops`が
未適用のため)。原因は`has_schema_privilege`へschema名の文字列リテラルを直接渡す
「名前」引数版が、対象schemaが存在しない場合に例外を送出すること。`to_regnamespace`/
`to_regclass`でOIDを安全に解決してから渡す形へ修正し(修正版SQLファイル・
静的監査コード(`backup-role-sql-audit.ts`)・Unit Testを更新)、修正版を本人が
再実行して成功した。

### 6.2 修正版SQLの実行結果(本人確認済み)

| 項目 | 結果 |
|---|---|
| `role_exists` | `true` |
| `login` | `true` |
| `inherit` | `false` |
| `superuser`/`createdb`/`createrole`/`replication`/`bypassrls` | すべて`false` |
| `connection_limit` | `2` |
| `default_transaction_read_only` | `on` |
| `statement_timeout` | `120s` |
| `lock_timeout` | `5s` |
| `search_path` | `reference_data` |
| `reference_data` USAGE | `true` |
| 対象4テーブル(`world_player_cards`/`managers`/`player_card_analysis`/`import_batches`) | いずれも`table_exists: true`・`can_select: true` |
| 対象4テーブルの`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`REFERENCES`/`TRIGGER` | すべて`false` |
| `auth.users` SELECT(`user_data_table_privileges`) | `false` |
| `public.my_team_snapshots` SELECT(`user_data_table_privileges`) | `false` |
| `reference_data_ops` 存在(`reference_data_ops_exists`) | `false` |
| `reference_data_ops` USAGE | `false` |
| `reference_data_ops_table_count_visible` | `0` |

Production reference_dataの行データ読み取り・変更は一切行われていない
(metadataだけを参照する`verify-reference-data-backup-role.sql`の実行のみ)。

### 6.3 `public_usage`の扱いに関する注記

`schema_usage.public_usage`が`true`であることは、`public`schemaへの`USAGE`権限
(schema内のオブジェクトを名前解決できる権限)を意味するに過ぎず、
`public.my_team_snapshots`テーブルへの`SELECT`権限を意味しない。両者は別の権限
(`USAGE` vs `SELECT`)であり、別のカタログ関数(`has_schema_privilege` vs
`has_table_privilege`)で確認する。本人が実際に`user_data_table_privileges`の
`public.my_team_snapshots`行で`can_select: false`であることを直接確認しており、
この役割(role)は`public.my_team_snapshots`の行データを読み取れない。

**この確認結果を理由に、`PUBLIC`schema全体の権限設計(役割自体のUSAGE権限や、
`public`schemaのデフォルト権限設定)を変更する必要はないと判断し、変更していない。**

## 7. 初回Production Backup実行手順(2026-09-21追記、design only・未実行)

**この章に記載された`Run workflow`操作は、このセッションでは一切実行していない
(workflow_dispatch 0件を維持)。**

### 7.1 category(prefix自由入力は廃止)

`reference-data-production-backup.yml`のworkflow_dispatchには、`backup_category`
というchoice input(`pre-apply`/`daily`/`weekly`/`monthly`の4値だけ、既定値
`pre-apply`)がある。**prefixを直接入力する欄は無い**(`REFERENCE_DATA_BACKUP_PREFIX`
という自由指定は廃止済み)。categoryからprefix・manifestのretentionCategory・
retentionDaysは`src/lib/reference-data/auto-update/backup-category.ts`の固定mapping
だけが一意に決定する:

| category | prefix | retentionCategory | retentionDays | R2 Lifecycle Rule(本人が設定済みの実値) |
|---|---|---|---|---|
| `pre-apply` | `pre-apply/` | `production-pre-apply` | `null`(期限なし) | 自動削除なし |
| `daily` | `daily/` | `production-daily` | `8` | 8日で自動削除 |
| `weekly` | `weekly/` | `production-weekly` | `35` | 35日で自動削除 |
| `monthly` | `monthly/` | `production-monthly` | `100` | 100日で自動削除 |

### 7.2 初回Production Backupは`pre-apply`を選択する

**初回のProduction Backup(重要な基準点)は、必ず`backup_category`で`pre-apply`を
選択すること。** `daily`を選ぶと、R2 Lifecycle Ruleにより8日後にこの基準点が
自動削除される。`pre-apply`はR2側で自動削除の対象外に設定済みであり、manifest側の
`retentionDays`/`expiresAt`も`null`(0や遠い未来の日付での偽装ではなく、
「期限が無い」ことをそのまま記録する)になる。

### 7.3 実行手順

1. GitHubリポジトリのActionsタブを開く。
2. 「Reference data Production backup (manual, approval-gated)」workflowを選ぶ。
3. 「Run workflow」を開き、branchが`main`であることを確認する。
4. `backup_category`で **`pre-apply`** を選択する(既定値がpre-applyになっているが、
   本人が目視で選択し直し、確定させること。既定値に無自覚に任せない)。
5. `confirm`欄に **`backup`**(小文字、完全一致)と入力する。
6. 「Run workflow」を実行する。
7. `production-backup-approval` GitHub Environmentの承認待ちが表示されたら、
   本人がreviewerとして承認する(self-review可、他の人の承認は不要な設定)。
8. 承認後にjobが実行される。

### 7.4 実行前に必ず理解しておくこと

- **age秘密鍵を失うと、アップロードされたBackupは誰にも復号できなくなる。**
  秘密鍵は本人のPCだけに保管されており、GitHub側には公開鍵(recipient)しか
  存在しない。秘密鍵の紛失に備えたバックアップ保管は、このBackup機能とは
  別に本人が判断すること。
- **workflow自体の成功(`storageVerified: true`)は、「隔離Restore検証(ephemeral鍵による、
  実データと同一checksumの別artifactを使った検証)に成功した」ことを意味するのであって、
  「本人が実際にage秘密鍵で復号してRestoreできることを確認した」ことは意味しない。**
  本人による実秘密鍵を使った隔離Restore試験(このrunbookの範囲外、別途実施)が
  完了するまでは、このBackupを「完全に検証済み」として扱わないこと。
- Backup workflow自体はProduction`reference_data`への書込み・Production Restoreを
  一切行わない(read-only roleがSELECTしか許可されていない構造上、実行不可能)。

### 7.5 孤立した暗号化payloadの既知の低リスク限界

`putEncryptedBackup`(`backup-r2-adapter.ts`)は、暗号化payloadのPUTに成功した後、
manifestのPUTまたはupload後checksum検証が(ネットワーク瞬断等で)失敗した場合、
自動でロールバック(削除)を行わない設計になっている。この場合、R2上に
「暗号化payloadだけ存在しmanifestが無い」不完全なobjectが残る可能性がある
(暗号化済みのため平文露出のリスクは無い)。object keyには`jobId`
(workflow run単位で毎回新規発行)が含まれるため、次回の実行が別keyになり、
この残存objectが将来の再実行をブロックすることはない。**この不完全な状態を
「成功したBackup」として扱ってはならない**(`putEncryptedBackup`の戻り値`ok`が
`false`の場合、job全体も失敗として終了する設計)。

### 7.6 duplicate/overwrite・size/checksum不一致時の扱い

同一checksumのobject keyが既に存在する場合、upload自体を行わない(重複・上書き拒否)。
upload後のremote size/checksum検証が不一致の場合、`storageVerified: false`を返すのみで、
自動削除・自動再upload・自動上書きは一切行わない(本人による手動調査を前提とする)。
