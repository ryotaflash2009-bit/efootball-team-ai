# 参照データ自動更新 Phase 2: PostgreSQL隔離検証(GitHub Actions service container)

実装日: 2026-09-19。**すべてGitHub ActionsのGitHub-hosted Ubuntuランナー上で、当該ジョブの間だけ
存在しジョブ終了後に破棄されるPostgreSQL service containerに対する検証である。実Supabase・
実Production PostgreSQLへは一切接続していない。**

## 1. 経緯

ローカルWindows環境にDocker・WSL・PostgreSQLがいずれも未インストールであることを確認済み
(`reference-data-auto-update-phase-2.md`参照時点の状態)。WindowsへのDocker Desktop/WSLの
新規導入は採用せず、GitHub Actionsが標準で提供する[service containers](https://docs.github.com/actions/using-containerized-services/about-service-containers)
機能を使い、ジョブ実行中だけ存在する一時PostgreSQLコンテナで検証する方式へ変更した。

## 2. 使用した既存依存関係(新規パッケージ追加なし)

`pg`(^8.23.0)・`@types/pg`(^8.23.1)は、このタスク開始時点で既に`package.json`の
`devDependencies`および`package-lock.json`に存在していた(過去のセッションで導入済みだが
未使用のまま残っていたもの)。**今回、新しい依存関係の追加・`package.json`/
`package-lock.json`の変更は一切行っていない。**

## 3. workflow設計(`.github/workflows/ci.yml`)

既存の`build-and-test`ジョブとは独立した`reference-data-postgres-validation`ジョブを追加した。

- trigger: workflowファイル全体の`on:`(`pull_request`・`push: branches: [main]`)をそのまま
  継承する。**`schedule:`は追加していない**(定期自動更新ではない)。
- `permissions: contents: read`(workflow全体、既存のまま変更なし)。
- GitHub Secretsは一切参照していない。PostgreSQLの資格情報(`phase2_test_user`/
  `phase2_test_password_ci_only`/`phase2_test_db`)は、このジョブの使い捨て値として
  workflowファイルに直接、平文で記載している(実Secretではなく、ジョブ終了後に破棄される
  一時コンテナの認証情報であるため、Secrets化する必要がない)。
- service container: 公式`postgres:16`イメージ、`127.0.0.1:5432`へのポートマッピング、
  `pg_isready`によるhealth check。Volumeの永続化なし、ジョブ終了と同時に破棄される。
- ステップは`npx vitest run --config vitest.postgres.config.ts`のみ(専用configで
  PostgreSQL統合試験ファイルだけを実行する)。

## 4. 通常Unit TestとPostgreSQL統合試験の分離

- 通常の`vitest.config.ts`は`**/*.postgres.test.ts`を明示的に除外するよう変更した
  (`configDefaults.exclude`に追加する形、既存の除外設定は保持)。これにより、
  **PostgreSQLが存在しない環境(ローカルWindows含む)でも`npx vitest run`は従来どおり
  成功する**(実際にローカルで確認済み: 170ファイル・3,307件成功)。
- PostgreSQL統合試験専用に`vitest.postgres.config.ts`を新設し、
  `src/lib/reference-data/auto-update/apply-orchestrator.postgres.test.ts`だけを対象にする。
- `postgres-adapter.ts`の接続安全性検証(`assertSafeTestConnectionTarget`)・
  プレースホルダー変換ロジックは、実PostgreSQLへ接続せずに検証できるため、
  `postgres-adapter.test.ts`として**通常のUnit Test側**に置いている(14件、
  ローカルでも常に実行・成功する)。

## 5. 接続安全性(構造的な強制)

`postgres-adapter.ts`の`assertSafeTestConnectionTarget`が、次を接続前に強制する:

- ホストは`localhost`・`127.0.0.1`のみ許可。それ以外(Supabaseを含むあらゆる外部ホスト)は拒否。
- ホスト名・データベース名に`supabase`という語を含む場合は拒否。
- データベース名は`phase2_test_db`または`reference_data_ops_test`のホワイトリストのみ許可。
- 接続設定は`PHASE2_TEST_PG_*`という専用環境変数だけから読む
  (`NEXT_PUBLIC_SUPABASE_*`・`DATABASE_URL`等の既存Production系環境変数は一切参照しない)。
- 接続文字列・パスワードをログへ出力する処理は存在しない。

## 6. PostgreSQL DDL(`postgres-staging.ts`)

`reference_data_ops_test`スキーマ配下に、`update_jobs`・`applied_checksums`・`audit_events`・
`staging_records`・`before_snapshots`・`rollback_jobs`・`source_metadata_test`・
`target_records`を作成する。`public`スキーマ・`auth`スキーマへは一切触れない。拡張機能追加・
ロール変更・GRANT・RLS変更・SECURITY DEFINER・Event Trigger・Cronはいずれも含まない。

`update_jobs.status`のCHECK制約は、実装済みの`job.ts`の状態機械(`pending`→`running`→
`completed`/`failed`→(`completed`のみ)`rolled_back`)と一致させた。タスクで例示された
`validated`/`approved`/`applying`/`applied`という中間状態は、現時点のコードに存在しないため
採用していない(将来の拡張時に別途migrationとして追加する想定)。

`staging_records`・`before_snapshots`・`rollback_jobs`・`source_metadata_test`は、
DDLとしては用意したが、**現時点の`apply-orchestrator.ts`/`rollback.ts`(SQLite Phase 2から
変更していない、実証済みのコード)は`update_jobs`・`applied_checksums`・`target_records`
だけを操作する**。これらの追加テーブルは将来の拡張(監査の詳細化等)のための予約であり、
今回のテストでは直接検証していない。

## 7. アダプター設計(`postgres-adapter.ts`)

`apply-orchestrator.ts`・`rollback.ts`のSQL文字列(SQLite方言、`?`プレースホルダー、
非修飾テーブル名)を**一切変更せず**にPostgreSQLへ流すため、アダプター側で次を行う:

- `?`を`$1,$2,...`へ変換する。
- 初回クエリ時に`set search_path to reference_data_ops_test, public`を一度だけ実行し、
  非修飾テーブル名を隔離schemaへ解決させる。
- node-postgresが`jsonb`列を自動的にJS objectへパースする挙動を、SQLite adapter
  (`fields_json`を文字列のまま返す)と契約を揃えるため、object値をJSON文字列へ
  戻してから返す(`normalizeRow`)。

この設計により、Phase 1/2のコア実装(`apply-orchestrator.ts`・`rollback.ts`・`job.ts`・
`approval.ts`・`safety-gates.ts`等)は**SQLiteとPostgreSQLの両方に対して1行も変更せずに
動作する**ことを実証した。

## 8. PostgreSQL固有の実証(SQLiteでは証明できなかった事項)

`apply-orchestrator.postgres.test.ts`で、SQLiteの模擬(テーブルベースのlock)とは異なる、
**本物の`pg_try_advisory_xact_lock`**を、2つの独立した`pg.Client`接続を使って検証した:

- 同一lock keyへの取得は、片方の接続だけが成功し、もう片方は待機せず即座に`false`を返す。
- `COMMIT`後、同一keyを別接続から再取得できる(トランザクションスコープでの自動解放)。
- `ROLLBACK`後も同様に自動解放される。
- 異なるkeyは競合しない。

これに加え、実PostgreSQL上でのBEGIN/UPSERT/shadow comparison/COMMITの正常系、
トランザクション途中の失敗によるROLLBACK(一部だけcommitされないこと)、成功commit後の
明示的なrollback(before-snapshotへの復元・無関係行への非干渉)を、SQLiteのときと同じ
シナリオで実証した。

## 8.1 Promotion検証の追加(2026-09-20追記)

同じGitHub Actions PostgreSQL service containerの仕組みを使って、`promotion-orchestrator.postgres.test.ts`
(stagingから確定相当テーブル`reference_data_test`への昇格・自動/明示rollback)を追加した。
`vitest.postgres.config.ts`の`include`が`src/lib/reference-data/auto-update/*.postgres.test.ts`
というglobパターンのため、workflow自体の変更は不要で自動的に対象へ含まれる。**このファイルは
このセッションでは未実行**(ローカルWindows環境にPostgreSQLが無いため)。詳細は
`reference-data-promotion-design.md`・`reference-data-promotion-rollback-validation.md`参照。

## 9. 誠実な限界の開示(まだ検証していない事項)

- **これはProduction完成ではない**。実Supabase・実Production PostgreSQLへの接続、
  Production向けstaging schemaの作成、Production資格情報の管理方式は今回も未着手。
- GitHub ActionsのUbuntuランナーというクリーンな単一ジョブ環境での検証であり、
  実際のネットワーク分断・実際の同時多重実行環境・実際のSupabase接続プーラー
  (Session pooler等)経由での挙動は検証していない。
- `staging_records`・`before_snapshots`・`rollback_jobs`・`source_metadata_test`テーブルは
  DDLとして存在するが、実際のデータ読み書きでは検証していない(6章参照)。
- CI実行結果(success/failure)は、このセッションの完了後にGitHub Actions上で確認する
  (本書執筆時点ではまだpush前)。

## 10. 今回のセッションで実施していないこと(明確化)

- Windowsローカル環境へのDocker/WSL/PostgreSQLのインストール・設定変更は一切行っていない。
- 実Supabase・実Production PostgreSQLへの接続は0回。
- `schedule:`トリガーの追加、Vercel Cron、Supabase Cron、Edge Functionのデプロイはいずれも行っていない。
- GitHub Secretsの追加・Vercel環境変数の変更は行っていない。
- Production applyは行っていない。
- 他人へのProduction URL共有は行っていない。
