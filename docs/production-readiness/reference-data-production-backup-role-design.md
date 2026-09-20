# Production Backup専用read-only role 設計・独立監査(design only、role未作成)

作成日: 2026-09-21。**この文書は設計・監査結果であり、実role作成・実password設定は
このセッションでは一切行っていない。Claude Code自身はProduction Supabaseへ一切接続していない。**

関連: [[reference-data-production-backup-credentials.md]]・[[reference-data-production-backup-security-model.md]]・
[[reference-data-production-backup-role-runbook.md]]・[[reference-data-production-backup-role-revocation.md]]

実SQLファイル: `docs/production-readiness/sql/create-reference-data-backup-role.sql`・
`verify-reference-data-backup-role.sql`・`rollback-reference-data-backup-role.sql`
(すべてDO NOT RUN、未実行)。静的監査実装: `src/lib/reference-data/auto-update/backup-role-sql-audit.ts`
(`backup-role-sql-audit.test.ts`で実ファイルに対しissues: []を確認済み)。

## 1. role設計

対象role: `reference_data_backup_reader`

| 権限 | 付与 | 理由 |
|---|---|---|
| LOGIN | あり | Backup workflowが接続するために必要 |
| `reference_data` schemaへのUSAGE | あり | 対象4テーブルを参照するために必要 |
| 対象4テーブルへのSELECT | あり(4テーブルのみ) | Backupの目的そのもの |
| SUPERUSER | なし | 過剰権限を避ける |
| CREATEDB | なし | 同上 |
| CREATEROLE | なし | 同上(role管理権限を持たせない) |
| REPLICATION | なし | Backupはreplicationを必要としない |
| BYPASSRLS | なし | RLSを迂回する必要はない(read-only roleとして明示的なGRANTだけで完結する) |
| INSERT/UPDATE/DELETE/TRUNCATE/MERGE | なし | read-onlyという設計目的そのもの |
| REFERENCES/TRIGGER | なし | 構造変更に関わる権限は一切不要 |
| CREATE/ALTER/DROP/GRANT | なし | DDL・権限管理は一切不要 |
| `reference_data_ops`・`auth`・`public`利用者テーブルへのアクセス | なし | schema usageすら付与しないため構造的にアクセス不能 |
| Vault・Storageへのアクセス | なし | 同上 |

apply用role・`postgres`管理者・`service_role` keyとの共有は行わない。
`checkBackupCredentialSeparateFromApply`(`backup-production-security-gate.ts`、既存実装)が
role名の同一性・危険な命名パターンを機械的に確認する。

## 2. role作成SQL独立監査

`create-reference-data-backup-role.sql`に対して`auditCreateRoleSql()`(10項目)を実行し、
**issues: []**を確認した:

1. 安全宣言バナー(DO NOT RUN/DESIGN ONLY/REQUIRES SEPARATE APPROVAL/PRODUCTION NOT APPLIED)
2. role作成SQL専用の追加宣言(DOES NOT CREATE OR STORE A PASSWORD/DOES NOT GRANT USER-DATA ACCESS)
3. password句(literal)が含まれていない
4. 接続文字列・Project ID・メールアドレス・token・API keyらしき文字列が含まれていない
5. 利用者データテーブル・`reference_data_ops`権限付与・`public` schema全体権限付与が含まれていない
6. SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLSが、NOの否定形以外で出現していない
7. GRANT文がSELECT/USAGE以外の権限(INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/ALL/GRANT OPTION)を含まない
8. 動的SQL(DO/EXECUTE)を含まない
9. role名が固定の`reference_data_backup_reader`のみ(文字列連結・動的識別子なし)
10. GRANT対象が対象4テーブルと過不足なく一致する

**独立監査で発見した問題(この文書の旧版で確認済み)**: 当初、[[reference-data-production-backup-credentials.md]]に
直接埋め込んでいたSQL案は`create role reference_data_backup_reader login password
'<本人が別途生成する強力なパスワード>';`という、`password '...'`構文(プレースホルダーであっても
password句そのもの)を含んでいた。今回のSQLは、password句を一切使わない設計へ変更した
(3章参照)。

## 3. password方式比較

| 方式 | 概要 | 評価 |
|---|---|---|
| A. role作成後、本人がSupabase Dashboard/SQL Editorで別操作としてpassword設定 | Claude Codeはpasswordを一切生成・保持・出力しない。本人が1回だけ手動操作 | **第一候補**(最も安全、Claude側の露出経路がゼロ) |
| B. 一時的な安全な対話経路でpassword設定 | パスワードマネージャー連携等 | このプロジェクトには該当する既存基盤が無く、今回は比較対象に留める |
| C. passwordをGitHub Secretへ直接生成・保存 | 自動化されたプロセスがpasswordを生成する | 不採用(生成プロセス自体がpasswordを一度は扱うことになり、露出経路が増える) |
| D. Supabase Vaultを利用 | DB内で秘密情報を管理 | 不採用(GitHub ActionsからDB接続する際、結局接続文字列にpasswordが必要になり、Vault利用だけでは解決しない) |

**第一候補: A。** `create-reference-data-backup-role.sql`はLOGIN権限だけを付与し、passwordを
一切設定しない設計にしている(password未設定のロールは、別途設定されるまでパスワード
認証でログインできない=作成直後は実質ログイン不能な安全側の状態)。password設定後、
本人が接続文字列を組み立て、GitHub Secretsの`REFERENCE_DATA_BACKUP_DB_URL`へ**本人が
直接**貼り付ける(Claude Codeはこのpasswordをいかなる時点でも見ない・扱わない)。

**禁止事項の再確認**: passwordをGitへ保存しない、チャットへ表示しない、SQL結果へ出力しない、
shell historyへ残さない、apply資格情報・管理者passwordと共有しない。今回、passwordは
生成・設定していない。

## 4. 作成後確認用read-only SQL

`verify-reference-data-backup-role.sql`は、role作成後に本人が手動実行する想定の、
metadataだけを参照するSQL。`auditVerifyRoleSql()`(7項目)で**issues: []**を確認済み。

確認内容: role存在・LOGIN・SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLSがすべて
false・INHERIT設定・connection limit・valid until・role単位のsession設定
(`default_transaction_read_only`/`statement_timeout`/`lock_timeout`/`search_path`)・
`reference_data`へのschema usage・対象4テーブルへのSELECT可否・INSERT/UPDATE/DELETE/
TRUNCATE/REFERENCES/TRIGGERがすべてfalse・`reference_data_ops`/`public`/`auth`への
schema usageがすべてfalse。

**行データは一切取得しない**(`has_schema_privilege`/`has_table_privilege`/`pg_roles`/
`pg_db_role_setting`/`information_schema.tables`のカタログ関数・ビューだけを使用し、
`SELECT ... FROM reference_data.<table>`のような実データへのFROM参照を一切含まない
ことを`assertVerifySqlIsMetadataOnly`で機械的に確認済み)。

## 5. negative privilege検証(実行せずmetadataで確認する方法)

対象roleが以下を行えないことを、実際に試行せず`has_table_privilege`/`has_schema_privilege`の
返り値(true/false)だけで確認する:

| 確認したい制約 | 確認方法 |
|---|---|
| INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER不可 | `has_table_privilege(role, table, '<privilege>')`が対象4テーブルすべてでfalse |
| CREATE/ALTER/DROP不可 | `rolcreatedb`/`rolcreaterole`が共にfalse(DDL相当の権限を持たないことの間接証明。厳密なCREATE TABLE可否はschema所有者権限にも依存するため、`has_schema_privilege(role, 'reference_data', 'create')`もあわせて確認する) |
| GRANT不可 | roleが`WITH GRANT OPTION`付きの権限を一切持たない設計(そもそも付与していないため確認不要、監査で保証) |
| role作成権限なし | `rolcreaterole`がfalse |
| user data SELECT不可 | `has_schema_privilege(role, 'public', 'usage')`/`has_schema_privilege(role, 'auth', 'usage')`が共にfalse(schema usageが無ければテーブル参照自体が構文的に失敗する) |
| `reference_data_ops` SELECT不可 | `has_schema_privilege(role, 'reference_data_ops', 'usage')`がfalse |

**実際に破壊的なクエリ(INSERT文等)を試行して失敗することを確認する方式は採用しない**
(意図せずデータを変更するリスクがあるため、常にmetadata関数だけで判定する)。

## 6. 接続経路との整合

roleは接続方式(direct connection/session pooler/transaction pooler)そのものには依存しない
(PostgreSQLのroleレベルの権限は接続経路を問わず同一に適用される)。ただし以下は
**未確認**として記録する:

- GitHub-hosted runnerからSupabaseへの実際の到達性
- session pooler/transaction pooler経由での`default_transaction_read_only`等の
  role単位session設定が意図どおり適用されるか(poolerの実装によっては、接続ごとに
  roleのデフォルト設定が引き継がれない可能性がある)
- SSL必須設定・証明書検証の実際の挙動
- IPv4/IPv6の availability
- Supabase Network Restrictionsの設定可否

これらは[[reference-data-production-backup-security-model.md]]3章の既存の未確認事項と
同一であり、実接続を伴う確認が必要(このセッションでは実施していない)。

## 7. 誠実な限界の開示

- role作成SQL・確認SQL・rollback SQLはいずれも静的監査(`backup-role-sql-audit.test.ts`、
  実ファイル監査+合成の悪いSQLでの検出力確認をあわせて21件)で検証したが、実PostgreSQLに
  対して実行して動作確認したことはこのセッションでは一度もない。
- `verify-reference-data-backup-role.sql`の`pg_db_role_setting`結合クエリは、
  PostgreSQLのバージョンによって列構成が異なる可能性があり、Supabaseの実PostgreSQL
  バージョン(既存preflightで確認済みの`reference_data`側とは別に、確認が必要)での
  動作は未検証。
- password方式(4章)の「第一候補A」は設計判断であり、実際に本人が実施して問題が
  無かったことを確認したものではない。
