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

## 8. 初回workflow run(#1)の失敗記録(2026-09-21、秘密情報なし)

**本人が`production-backup-approval` Environmentを承認し、`backup_category=pre-apply`・
`confirm=backup`で初回のworkflow_dispatchを実行した。runは`failure`で終了した。**

### 8.1 停止地点

`confirm`検証・`backup_category`検証(いずれも合格)・6 Secret存在確認(合格)・
checkout・Node.jsセットアップ・依存関係インストール・`age`インストール・
compileはすべて成功した。**「Run Production backup」ステップの、`main()`実行より
前のmodule読み込みの時点**で、以下のエラーにより失敗した:

```
ReferenceError: exports is not defined in ES module scope
```

対象: `dist-backup-execution/reference-data/auto-update/run-production-backup-cli.js`。

「Final cleanup verification」ステップ(`if: always()`)は成功しており、平文一時
ファイルは1件も生成されていなかったことを確認済み。

### 8.2 到達しなかった処理(確認可能な範囲)

`main()`関数自体が一度も呼び出されていないため、以下はいずれも実行されていない:

- `readRequiredEnv`/`readCategory`によるSecret値・category値の読み取り
- Production `reference_data`への接続・export(SELECT)
- `age`の実行(暗号化)
- 隔離Restore検証
- R2への接続・upload
- 平文一時ファイルの生成(そもそも作られていない)

Production Backupは作成されず、Production Restoreも実行されていない。

### 8.3 根本原因

このリポジトリの`package.json`は`"type": "module"`を宣言している。
`tsconfig.backup-execution.json`(`module: "CommonJS"`)がコンパイルする
`.js`ファイルには、Node.jsのモジュール判定規則により、**最も近い祖先の
package.jsonの`type`を参照する**という既定動作がある。`dist-backup-execution/`
配下には(compile直後の時点では)package.jsonが存在しないため、Node.jsは
リポジトリrootの`package.json`(`type: module`)まで遡り、CommonJS構文
(`Object.defineProperty(exports, ...)`)を含むcompile済みファイルを誤って
ES Moduleとして解釈し、上記エラーで停止した。

このセッションでは、開発中に`dist-backup-execution/package.json`
(`{"type":"commonjs"}`)を手動で1回だけ作成しており、それがローカルの
作業ディレクトリに残り続けたため、それ以降の同一セッション内でのローカル
検証はすべてこの手動ファイルの存在に依存してしまい、問題を検出できなかった
(まっさらなGitHub Actions checkoutで初めて発覚した)。誠実な開示として、
当時の「ローカル検証済み」という報告は、実際のCI実行環境を正確に再現した
ものではなかった。

### 8.4 修正

`scripts/run-production-backup-entry.mjs`自身が、compile済みmoduleを
importする直前に、毎回`dist-backup-execution/package.json`
(`{"type":"commonjs"}`)を書き出すよう変更した。これにより、
「compileされた出力の実行方法」がこのファイル1つに一元化され、
workflow YAML側の別ステップとの食い違いによる再発を構造的に防ぐ。
加えて、`ci.yml`(通常のPRごとのCI)と`reference-data-production-backup.yml`
(承認制Backup workflow自身)の両方に、実Secretを使わずに
compile→node実行までを行い、module読み込みの成功と「Secret不足でblocked」
という想定どおりの挙動を確認する回帰テストを追加した。この回帰テストは、
修正前のコードに戻すと確実に失敗することを、このセッションで実際に
検証済み。

### 8.5 今後の対応

このrun #1の失敗はコード側の問題であり、Secret・role・Environment・R2設定
いずれにも変更は不要と判断した。修正のマージ後、**新しいworkflow runとして
本人が改めて`production-backup-approval`の承認を行う**(このrunの失敗を
理由に自動でrerun・再承認が行われることはない)。

## 9. 2回目のworkflow run(#2)の失敗記録(2026-09-21、秘密情報なし)

**run #1の修正(module-system不一致の解消)をmainへマージした後、本人が改めて
`production-backup-approval` Environmentを承認し、`backup_category=pre-apply`・
`confirm=backup`で2回目のworkflow_dispatchを実行した。runは`failure`で終了した。
このrunをrerunすることはせず、このセクションに記録した上で、修正を別のPRとして
提出する運用とした。**

### 9.1 停止地点

`confirm`検証・`backup_category`検証(いずれも合格)・6 Secret存在確認(合格、
この時点ではまだ7個目のSecretは存在しない)・checkout・Node.jsセットアップ・
依存関係インストール・`age`インストール・compile・**新設した「Runtime smoke test
(module load check)」ステップ(run #1の修正の回帰テスト)も成功した**。

「Run Production backup」ステップの、`main()`実行中、**Production PostgreSQLへの
`prodPgClient.connect()`(TLSハンドシェイク)の時点**で、以下のエラーにより
失敗した:

```
self-signed certificate in certificate chain
```

「Final cleanup verification」ステップ(`if: always()`)は成功しており、平文一時
ファイルは1件も生成されていなかったことを確認済み。

### 9.2 到達しなかった処理(確認可能な範囲)

`prodPgClient.connect()`がreject(失敗)した時点で`main()`の`try`ブロックは
直ちに`catch`ブロックへ制御を渡すため、以下はいずれも実行されていない:

- Production `reference_data`へのSQL実行(export/SELECT) — 0件
- 平文データのexport・一時ファイル生成 — 未到達(生成されていない)
- `age`による暗号化 — 未到達
- 隔離Restore検証(ephemeral鍵による再暗号化・service containerへのrestore) — 未到達
- R2への接続・upload・remote checksum検証 — 0件

Production Backupは作成されず、Production Restoreも実行されていない。
Secretの値・DB URL・pooler hostname・Project Refはログに一切出力されていない。

### 9.3 根本原因

`run-production-backup-cli.ts`は`new Client({ connectionString, ssl: {
rejectUnauthorized: true } })`という設定でProduction PostgreSQLへ接続していた。
`ssl.rejectUnauthorized: true`は証明書検証を要求する正しい設定だが、`ssl.ca`
(信頼するroot CA)を一切指定していなかったため、Node.jsのTLSスタックはOS/Node
既定の信頼済みCAストアだけで証明書チェーンを検証しようとした。Supabaseの
PostgreSQLエンドポイント(session pooler含む)が提示する証明書チェーンのroot CAは
この既定の信頼済みCAストアに含まれていないため、検証に失敗し、上記のエラーで
接続が拒否された。**これはTLS検証が正しく機能した結果であり、検証ロジック自体の
不具合ではない。単に、信頼すべきroot CAが渡されていなかっただけである。**

### 9.4 修正方針(TLS検証を弱めない)

`rejectUnauthorized: false`・`NODE_TLS_REJECT_UNAUTHORIZED=0`・独自の
`checkServerIdentity`によるhostname検証の迂回など、検証を弱める変更は一切
行わない。代わりに、Supabase Dashboardから本人が取得したServer root
certificate(PEM形式)を新規Secret`REFERENCE_DATA_BACKUP_DB_CA_CERT`として
登録し、`ssl.ca`として明示的に渡すことで、証明書チェーンを正しく検証できる
ようにした(hostname検証・チェーン検証はいずれも維持したまま)。

あわせて、`REFERENCE_DATA_BACKUP_DB_URL`(接続文字列)自体にTLS設定を上書き
し得るquery parameter(`sslmode`/`sslrootcert`/`sslcert`/`sslkey`等)が
含まれていた場合は接続前にblockedとし、`connectionString`をpgへ直接渡す
のをやめ、host/port/database/user/passwordを個別に渡す設計に変更した
(`ssl`オブジェクトだけがTLS設定の単一の真実源になる。詳細は
`src/lib/reference-data/auto-update/backup-db-connection.ts`を参照)。

CA証明書の内容は、PEM形式であること・秘密鍵やage秘密鍵や接続文字列らしき
文字列を含まないこと等を接続前に検証し、不正な場合はDB接続を一切試みずに
blockedとする。ローカルの自己署名CA・TLSサーバー(このテストの中だけに
存在する使い捨てのもの、Production/Supabaseの証明書とは一切無関係)を使い、
正しいCAでは接続に成功し、誤ったCA・信頼されていない自己署名証明書・
hostname不一致ではいずれも接続が失敗することを、実際のTLSハンドシェイクで
検証済み。

### 9.5 Secret契約の変更

Secretは6個から7個になった。新規追加:

- `REFERENCE_DATA_BACKUP_DB_CA_CERT`(Supabase Server root certificate、PEM形式)

workflow側の「Check required secrets are configured」ステップ・
「Runtime smoke test」ステップ(実Secretではなく空文字を使う既存方針は
変更していない)・`REQUIRED_ENV_NAMES`(コード側)のいずれも7項目へ
更新済み。Environment承認・workflow_dispatch専用トリガー・
`permissions: contents: read`・自動retryなし・`schedule:`なしは
いずれも変更していない。

### 9.6 今後の対応

このrun #2の失敗はコード側の問題(CA未指定)であり、role・Environment・
R2設定に変更は不要と判断した。**このrun #2はrerunしない。** 修正は新しい
PRとして提出し、マージ後、本人が新規Secret`REFERENCE_DATA_BACKUP_DB_CA_CERT`
にSupabase Dashboardから取得した実際のServer root certificateを登録した
上で、**次回は新しい、別途承認されたworkflow run(run #3)として**改めて
`production-backup-approval`の承認を行う(このrunの失敗を理由に自動で
rerun・再承認が行われることはない)。
