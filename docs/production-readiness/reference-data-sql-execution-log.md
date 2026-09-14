# reference_data 実SQL実行ログ(実測記録)

本書は`reference-data-hybrid-migration-design.md`等の**設計**とは別に、実際にSupabaseダッシュボード上で実行・確認した結果のみを記録する実測ログである。Claude Codeは実Supabaseへ接続できないため、すべて上杉さん自身の操作・報告に基づく記録。

対象プロジェクト: `efootball-team-ai-dev`(Preview・開発専用)。

---

## 停止1: `create-reference-data-schema.sql`の手動実行 — 完了(2026-09-14)

- 実行者: 上杉さん(Supabase Dashboard SQL Editor)。
- 実行対象: `docs/production-readiness/sql/create-reference-data-schema.sql`(実行前に静的最終確認済み。insert文0件・DROP DATABASE/DROP SCHEMA public/TRUNCATE/GRANT ALLなし・秘密情報記載なしを`grep`で直接再確認)。
- 結果: **成功**。

## 停止2: 構造・RLS・権限・既存データ非影響の確認 — 完了(2026-09-14、Table Editorでの確認ベース)

上杉さんがSupabase Table Editorで確認した内容:

| 確認項目 | 結果 |
|---|---|
| `reference_data.world_player_cards` | 存在、0件 |
| `reference_data.managers` | 存在、0件 |
| `reference_data.player_card_analysis` | 存在、0件 |
| `reference_data.import_batches` | 存在、0件 |
| Table Editor上の表示 | "No data from any table in this schema will be selectable via Supabase APIs" |
| 手動INSERT | 行っていない |
| Exposed schemas変更 | 行っていない |
| RLS変更 | 行っていない |
| ポリシー編集 | 行っていない |

**"No data from any table in this schema will be selectable via Supabase APIs"という表示について**: これはエラーではなく、`reference_data`スキーマがまだExposed schemasに登録されていないために表示される、Supabase Dashboardの標準的な案内文である。`reference-data-hybrid-migration-design.md`の「Exposed schemas設定の要否」節で事前に導出していた「Exposed schemasに未登録のスキーマはData APIから読めない」という結論と一致する、想定どおりの結果として記録する。

DDLの静的監査(`reference-data-sql-audit.ts`、26テストpass、実DDLファイルでissue 0件)により、実行されたSQLが以下を満たすことは実行前に確認済み。今回の実行結果(4テーブル0件・エラーなし)はこの設計どおりにSQLが適用されたことと整合する。

- RLS: `world_player_cards`・`managers`・`player_card_analysis`で有効化(`enable + force`)、SELECTポリシーのみ(`to anon, authenticated using (true)`)、INSERT/UPDATE/DELETEポリシーなし。
- `import_batches`: RLS有効・ポリシー0件(既定拒否)、GRANTなし。
- 権限: `anon`・`authenticated`に`usage`(スキーマ)+`select`(3テーブル)のみ。

## 停止3: Exposed schemasへの`reference_data`追加 — 完了(2026-09-14)

- 実行者: 上杉さん(Supabase Dashboard → Project Settings → Data API)。
- 結果: `graphql_public`・`public`・`reference_data`の3 of 3 schemas exposed。`Automatically expose new tables`はオフのまま、Extra search path・Exposed tables/functionsは未変更。

## 停止4: Data API経由のSELECT可否・書込み拒否の検証 — 完了(2026-09-14、論理的同値性+静的監査により完了扱い、上杉さん承認)

対象: `efootball-team-ai-dev`のREST API(`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`のみ使用。`service_role`・DBパスワード・接続文字列は不使用。値は画面・ログに非表示)。

**判断**: 使い捨てテストユーザーは新規作成しない(`auth.users`に新規行を追加しない)。`authenticated`ロールの実地確認は、A(実地確認済み)・B(構造/静的監査で確認済み)・C(今回未実施)を明確に区別した上で、C=今回未実施のまま停止4を完了扱いとする(上杉さん承認、判断理由は本ログ末尾に記載)。

### A. 実Data APIで確認済み(Claude Codeが`anon`鍵のみで実行)

| 検証 | 結果 |
|---|---|
| `world_player_cards` SELECT(anon) | 初回504(一過性、Exposed schemas変更直後のPostgRESTスキーマキャッシュ更新中と推定)→再試行3回とも200・0件で安定 |
| `managers` SELECT(anon) | 200・0件 |
| `player_card_analysis` SELECT(anon) | 200・0件 |
| `import_batches` SELECT(anon) | **401 `42501 permission denied for table import_batches`**(GRANTなしのため不可視) |
| `world_player_cards` INSERT(anon、架空ID`90000000000000000001`) | **401 `42501 permission denied`**(行は作成されず) |
| `world_player_cards` UPDATE(anon) | **401 `42501 permission denied`** |
| `world_player_cards` DELETE(anon) | **401 `42501 permission denied`** |
| `managers` INSERT(anon) | **401 `42501 permission denied`** |
| `player_card_analysis` INSERT(anon) | **401 `42501 permission denied`** |
| 検証後の件数再確認 | `world_player_cards`・`managers`・`player_card_analysis`いずれも0件を維持。`import_batches`は非公開のため件数確認不可(想定通り) |

書込み拒否テストはすべてPostgreSQLの権限エラー(`42501`、GRANT不足)で即座に拒否されており、RLSポリシー評価より前の権限チェック段階で止まっている。実データは一切残っていない。

### B. SQL構造・静的監査で確認済み(`reference-data-sql-audit.ts`、26テストpass、実DDLでissue 0件)

- `authenticated`ロールのSELECT権限: `grant select on ... to anon, authenticated`により`anon`と完全同一の文で付与(DDL 6章)。
- `authenticated`のINSERT/UPDATE/DELETE拒否: 3公開テーブルとも書込み用GRANT・書込み用RLSポリシーが1件も存在しない(ポリシー不在=既定拒否は`anon`/`authenticated`を区別しない)。
- `authenticated`と`anon`の権限定義が同一であること: DDL全体を通じて`anon`のみ・`authenticated`のみに異なる権限を与える文は1つも存在しない(`to anon, authenticated`の複合ロール指定のみ)。
- 書込み用RLSポリシーが存在しないこと: `create policy`は3件とも`for select`のみ(DDL 5章)。

### C. 今回未実施

- `authenticated`セッションを使用した実Data APIでの直接CRUD確認。
- **今後の対応方針**: アプリを`reference_data`へ実接続する統合フェーズで、既存ユーザーAの通常セッション(本人操作)を使った非破壊SELECT確認として実施する。新規使い捨てユーザーは作成しない。既存ユーザーのパスワード・Token・Cookie・UUIDは要求・表示しない。

### 判断理由(上杉さん提示、記録)

- anonとauthenticatedには、reference_dataスキーマのUSAGEと、公開参照3テーブルのSELECTだけが同一条件で付与されている。
- anonにもauthenticatedにもINSERT/UPDATE/DELETE権限を付与していない。
- 公開参照3テーブルにはSELECTポリシーだけがあり、書込みポリシーは存在しない。
- anonでSELECT成功・書込み拒否・import_batches不可視を実Data APIで確認済み。
- SQL静的監査でanonとauthenticatedの権限構造が同一であることを確認済み。
- 検証後も全4テーブルが0件。
- 既存ユーザー・publicスキーマ・authスキーマ・クラウドMy Teamへ影響なし。

### 手順逸脱の記録: `/tmp`への一時ファイル書込み

- 検証中、レスポンス確認用の一時ファイルをプロジェクト外の`/tmp`(Windows環境のGit Bash上のシステム一時ディレクトリ)へ書き込んだ。`CLAUDE.md`の「ワークスペース限定」ルールからの逸脱。
- 一時レスポンスファイルは検証直後に削除済み。実データ・秘密情報は残っていない(内容はHTTPステータスと権限エラーメッセージのみで、鍵の値そのものは含まれていなかった)。
- 今後、一時ファイルはプロジェクト内のGit非追跡ディレクトリ(例: `data/`配下)だけに作成し、`/tmp`やプロジェクト外へ新しい成果物を作成しない。

## 停止5: 実データ投入前の最終確認・投入手段の比較 — 報告完了(2026-09-14)、実データ投入は未実施

詳細は`docs/production-readiness/reference-data-import-readiness-check.md`を参照。要点:

- dataset_version・import_batch_id・manifest・payload_hashを最新dry-run実行(2026-09-14T12:16:59.274Z)で再確認。
- 件数: `world_player_cards` 13,009件・`managers` 66件・`player_card_analysis` 19件。重複0件・孤立参照0件・必須項目欠損0件・Unicode保持確認済み・画像URL検証済み。
- 投入手段5方式を比較し、**方式3(一時的な管理用インポートスクリプト、直接Postgres接続)を第一推奨**として提示。
- 本人の資格情報入力・接続が必要になる直前で停止。実データ投入(停止6)はまだ案内していない。

## 停止6準備: 安全な管理用インポートツールの実装完了(2026-09-14)、実投入は未実施

実データ投入(停止6)は行っていない。以下のツール一式を実装・テストしたのみ。

- `src/lib/reference-data/real-import-guards.ts`(純関数: 秘密情報マスキング・件数/重複/孤立/ハッシュ検証・冪等性ガード・SQL文組み立て。39テスト)
- `src/lib/reference-data/real-import-orchestrator.ts`(単一トランザクションでのオーケストレーション。テストダブルで8テスト)
- `scripts/migration/pg-real-import.mjs`(実CLI。既定dry-run、`--execute`時のみ接続。実CLI起動で5テスト)
- `scripts/migration/secure-connect.ps1`(接続文字列の非表示入力ラッパー。構文検証済み、UTF-8 BOM付きで日本語コメントが正しく解釈されることを確認済み)
- 全既存テストへの影響なし。合計2674テストpass(既存2622+新規52)。
- 訂正記録: テストのダミー接続文字列に、実プロジェクト参照IDの先頭4文字と偶然一致する断片を使っていたことに気付き、無関係なダミー文字列へ差し替えた(実際の値の漏洩ではなく、テストコード内のダミー値の話)。

## 停止6 第1回試行: SSL証明書検証エラーで終了(2026-09-14)

- 実行者: 上杉さん(`secure-connect.ps1`経由)。
- 結果: `secure-connect.ps1`の入力形式検証(`--validate-only`)は成功。実接続(`--execute`)開始後、SSL証明書チェーン検証で失敗(`self-signed certificate in certificate chain`)。**投入ツールはこの時点でROLLBACK/エラー終了しており、いかなる行もreference_dataスキーマへ書き込まれていない**(`client.connect()`失敗時点ではまだトランザクションを開始していないため、`runRealImport`自体が呼び出されていない)。
- 事後確認(Claude Codeが`anon`鍵のみでData API経由により実施): `world_player_cards`・`managers`・`player_card_analysis`は200・0件、`import_batches`は401 permission denied(想定通り不可視)。**データは一切残っていない**ことを確認。
- 接続情報(接続文字列テンプレート・DBパスワード)は環境変数・メモリから削除済み。チャット・ログ・Git・ファイルのいずれにも保存していない。
- 原因調査と修正(SSL証明書検証、`rejectUnauthorized`は常にtrue維持): 詳細は本ログ末尾の完了報告を参照。`src/lib/reference-data/pg-ssl-config.ts`を新規実装し、Supabase公式CA証明書を明示的に指定できるようにした(`MIGRATION_PG_CA_CERT_PATH`環境変数、任意)。
- 追加テスト: `pg-ssl-config.test.ts`(10件、設定組み立ての単体テスト)・`pg-ssl-config.tls.test.ts`(5件、127.0.0.1のみを使った実TLSハンドシェイク検証。正しいCA/誤ったCA/CA未指定/期限切れ証明書/ホスト名不一致の5パターンを実際のTLS層で確認)。
- 実Supabaseへの再接続は行っていない。データ投入の再実行も行っていない。

## 停止6: 実データ投入試行 → ROLLBACK(2026-09-14、上杉さん実施)

- CA証明書を指定してSSL接続に成功し、`--execute`を実行。
- 事前検証(SQLite integrity_check ok、13,009/66/19件、必須項目欠損0・不正値0・重複0・孤立参照0)はすべて通過。
- **投入中に`malformed array literal`エラーで失敗し、ROLLBACK(終了コード1)**。原因は`real-import-orchestrator.ts`の配列/JSONBカラムのシリアライズ不具合(下記参照)。
- 副次的に`Calling client.query() when the client is already executing a query is deprecated`という警告も発生(同一クライアントでの並行クエリ実行、下記で修正)。
- 接続情報は環境変数・メモリから削除済み(上杉さん確認)。

### ロールバック結果の確認(Claude Codeがanon Data API経由のSELECTのみで実施、2026-09-14)

| テーブル | 結果 |
|---|---|
| `world_player_cards` | `Content-Range: */0` → **0件** |
| `managers` | `Content-Range: */0` → **0件** |
| `player_card_analysis` | `Content-Range: */0` → **0件** |
| `import_batches` | 401(anonから引き続き不可視、想定通り) |

**ROLLBACKは正しく機能し、部分データは一切残っていない。**

### 原因調査: malformed array literal

`real-import-orchestrator.ts`の`rowToParams`が、**JS配列とプレーンオブジェクトを区別せず**`typeof value === "object"`だけで判定し、両方に`JSON.stringify`を適用していたことが原因。

- `world_player_cards.skills`(DDL上`text[]`)にJS配列(例:`["Chop Turn","Pinpoint Crossing","Fighting Spirit"]`)を渡す際、`JSON.stringify`により`["Chop Turn","Pinpoint Crossing","Fighting Spirit"]`という**JSON形式の文字列1個**になってしまい、Postgresの`text[]`パーサーがこれを`{...}`形式のPostgres配列リテラルとして解釈できず失敗していた(node-postgres本来はJS配列を渡せば自動的に正しい`{...}`形式へシリアライズする)。
- 同様の問題が`player_card_analysis.com_skills`/`player_skills`(ともに`text[]`)にも該当していた。
- 逆に`player_card_analysis.positions`(DDL上`jsonb`、JSON配列を格納)は、JS配列をJSON.stringifyせずpgへ渡すと、pgが誤って`text[]`と同じ配列リテラル形式へシリアライズしてしまい、jsonb列としては不正な値になる問題も併せて特定した(実際のエラーには出ていないが、同じ原因の潜在バグ)。

### 修正内容

- `real-import-orchestrator.ts`に列ごとの型情報(`WORLD_COLUMN_TYPES`/`MANAGER_COLUMN_TYPES`/`ANALYSIS_COLUMN_TYPES`)を追加し、`"jsonb"`列だけを明示的に`JSON.stringify`、`"array"`列(`skills`/`com_skills`/`player_skills`)はJS配列のままpgへ渡すよう修正。
- `client.query()`の並行実行(空テーブル確認4件の`Promise.all`)を、同一クライアントでの直列`await`へ修正(`client.query()`の非推奨警告の原因)。
- ROLLBACK自体が失敗した場合に元エラーを握りつぶさず、両方の内容を含む形で報告するよう修正。
- パラメーター化クエリ(`$1`/`$2`...)は元から維持しており、SQL文字列への値の手動連結は一切行っていない(この点は今回の不具合の原因ではなかった)。

### 追加テスト(実Supabase接続なし、テストダブルのみ)

- `skills`/`com_skills`/`player_skills`にカンマ・アポストロフィ・引用符・バックスラッシュ・日本語/Unicode・括弧・改行・重複値・空配列を含めても、JS配列のままpgへ渡ることを確認。
- `stats`/`player_model`(jsonbオブジェクト)・`positions`(jsonb配列)がJSON文字列化されて渡ることを確認。
- 同一クライアントでの`query()`並行実行が発生しないことを確認(計装済みテストダブルで検出)。
- ROLLBACK失敗時に元エラー(FK違反)とROLLBACKエラーの両方がメッセージに含まれることを確認。
- 追加19件、Unit Test合計**2741件**、全てpass(既存2622件は無変更)。Production Buildも成功。

### 現在の状態

- Unit Test 2741件・Production Build成功済み。**実Supabaseへの再接続・再投入はまだ行っていない。**

## 停止6再実行: 実データ投入 → COMMIT成功(2026-09-14、上杉さん実施)

- CA証明書(`data/tls/prod-ca-2021.crt`、Git非追跡)を指定し、修正版ツールで再実行。
- **結果: COMMIT成功**。`world_player_cards` 13,009件・`managers` 66件・`player_card_analysis` 19件を投入。malformed array literalは再発せず。
- 接続情報は環境変数・メモリから削除済み(上杉さん確認)。

## 停止7: 投入後検証 — 完了(2026-09-14、Claude Codeがanon Data API経由のSELECTのみで実施)

| 検証 | 結果 |
|---|---|
| `world_player_cards`件数 | `Content-Range: */13009` |
| `managers`件数 | `Content-Range: */66` |
| `player_card_analysis`件数 | `Content-Range: */19` |
| ページング(先頭0-4) | `Content-Range: 0-4/*` |
| ページング(最終13004-13008) | `Content-Range: 13004-13008/*` |
| `import_batches` | 401(anonから引き続き不可視) |
| Unicode保持(既知ID`88043608522894`) | `name_ja`が「バーチャット」と完全一致 |
| `skills`(text[]) | 配列型で取得(サンプル10要素) |
| `stats`(jsonb) | オブジェクト型で取得(26キー) |
| `positions`(jsonb配列) | 配列型で取得、要素が`code`/`familiarity`/`isRegistered`を持つオブジェクト |
| `com_skills`/`player_skills`(text[]) | いずれも配列型で取得 |
| `image_url`ホスト | 許可ホスト(`d1zxa6glxh8sq9.cloudfront.net`)と一致 |
| `skills is null`件数 | 0件(NOT NULL制約どおり) |
| `name_ja is null`件数 | 0件(全件に日本語名あり) |

**malformed array literalは再発していない**。配列/JSONB型変換の修正が実データでも正しく機能していることを確認した。

### 読み取り権限・書込み拒否

- anonでの公開3テーブルSELECTは上記の通り成功。`authenticated`の実地SELECTは、アプリ統合フェーズで既存ユーザーの通常セッションを使って確認する方針を維持(新規テストユーザーは作成しない)。
- 書込み拒否テストは実データを危険にさらすため今回実施せず、空テーブル段階(停止4)での実測(`42501 permission denied`、anon INSERT/UPDATE/DELETEすべて)と、DDL/`reference-data-sql-audit.ts`(26テストpass)の静的確認で代替した。GRANT・RLSポリシーの構成(anon/authenticated同一のUSAGE+SELECTのみ、書込みポリシー0件、import_batches権限なし)は投入後も変更していない。

### 容量

- 投入前のDatabase Size記録: **0.026 GB**(2026-09-14、上杉さん確認済み)。投入後の実測は上杉さん本人がSupabase Dashboardで確認する(次の1操作として案内)。

### 既存データ非影響

- `public.my_team_snapshots`・`public.rls_probe_records`・`auth.users`・既存ユーザーA/Bへは、投入処理のSQL自体が`reference_data`スキーマ以外を一切参照しないため、コード上の構造として影響しない(今回、実ユーザーデータへの新規アクセスは行っていない)。

### 冪等性・再実行拒否

- 実投入は再実行していない。`checkAllTablesEmpty`(既存行があれば中止)・`checkIdempotencyGuard`(同一batch_id/dataset_versionを拒否)は`real-import-guards.test.ts`/`real-import-orchestrator.test.ts`でテスト済み。

### 品質ゲート

- `npm run verify`(ja-labels監査+i18n-keys監査+typecheck+lint+Unit Test)成功。Unit Test **2741件**全てpass。
- Production Build成功(devサーバーを検証済みPIDで安全に停止→ビルド→復旧)。
- ブラックボックス: `/`・`/players/world`・`/api/data-status`が200応答(アプリはまだSQLite参照のままで無変更)。
- SQLite integrity_check: ok。主要テーブル件数(world_player_cards 13,009/managers 66/player_cards 19/player_index_entries 47,479)は投入前と変化なし。
- `npm audit`: 4件(vitest/@vitest/mocker中程度1件、next同梱postcss高2件+関連1件)。いずれも本セッションの変更に起因しない既存の依存関係の脆弱性で、修正には`vitest@5`/`next@16`へのメジャーアップグレードが必要(破壊的変更のため今回は実施しない)。
- 秘密情報監査: 追跡・未追跡ファイル全体を検索し、実接続文字列・パスワードの埋め込みなしを確認。`.env.local`はGit非追跡。CA証明書(`data/tls/prod-ca-2021.crt`)もGit非追跡(`/data`配下)。dry-run成果物もGit非追跡。

## 容量確認(投入後、2026-09-14、上杉さん実施)

| 項目 | 値 |
|---|---|
| 投入前 Database Size | 0.026 GB |
| 投入後 Database Size | **0.049 GB** |
| 増加量 | 0.023 GB(約23 MB) |
| 保守的見積り(`supabase-capacity-verification-procedure.md`2章) | 約81 MB(累計) |
| 実測との差 | 実測が見積りより約32 MB少ない(見積りは安全側に大きく振れていた) |
| 停止基準400 MB | 下回っている(使用率約9.8%) |
| 判定 | **PASS** |

## 参照データ投入フェーズ 最終判定: PASS(2026-09-14)

| 項目 | 結果 |
|---|---|
| `world_player_cards`件数 | 13,009件(一致) |
| `managers`件数 | 66件(一致) |
| `player_card_analysis`件数 | 19件(一致) |
| 配列型(`skills`/`com_skills`/`player_skills`) | 正常(malformed array literal再発なし) |
| JSONB(`stats`/`player_model`/`positions`) | 正常 |
| Unicode/日本語 | 保持確認済み |
| ページング | 先頭・最終ページとも正常 |
| `import_batches` | anonから不可視(401) |
| 公開3テーブルのSELECT | anonから成功 |
| 通常利用者の書込み | 拒否(空テーブル段階で実測、投入後は静的監査で確認) |
| Database Size | 0.049 GB(上限の9.8%、PASS) |
| SQLite integrity_check | ok |
| Unit Test | 2741件PASS |
| Production Build | PASS |
| 実接続情報・DBパスワードの保存 | なし |

**すべての基準を満たしたため、参照データ投入フェーズを完了とする。**

## 実手動確認・自動確認・未確認事項の分離

### A. 上杉さん本人が手動確認した事項

- SQL実行(停止1)・Table Editorでの構造確認(停止2)・Exposed schemas追加(停止3)・接続文字列/パスワードの入力と実投入実行(停止6)・投入前後のDatabase Size(容量確認)。

### B. Claude Codeが自動確認した事項(anon Data APIのSELECT、テストダブル、ローカルSQLite読み取りのみ)

- Data API経由の件数・Content-Range・ページング・配列型・JSONB構造・Unicode・null制約(停止4・停止7)。
- SQL静的監査(`reference-data-sql-audit.ts`、26テスト)・移行ロジック/investorオーケストレーターのUnit Test(2741件)。
- SQLite integrity_check・主要テーブル件数の投入前後比較。
- Production Build・`npm run verify`・`npm audit`・秘密情報のgrep監査。

### C. 未確認事項(今回のスコープ外、今後必要になった時点で対応)

- `authenticated`ロールでの実地SELECT(新規テストユーザーを作らない方針のため、アプリ統合フェーズで既存ユーザーの通常セッションを使って確認予定)。
- 投入後の書込み拒否の実地再テスト(実データ保護のため意図的に省略、静的監査で代替)。
- Postgres内部のディスク使用量内訳(インデックス/TOAST/行オーバーヘッドそれぞれの実際の寄与度)。

## 未コミット変更・未追跡ファイルの整理(2026-09-14時点)

`git status`で確認済み。追跡対象への変更は`package.json`/`package-lock.json`(`pg`/`@types/pg`のdevDependency追加、承認済み)のみ。それ以外はすべて未追跡:

- `docs/production-readiness/*.md`・`sql/*.sql`(設計・監査・実行ログ)
- `src/lib/reference-data/`・`src/lib/testing/reference-data-sql-audit.*`(実装・テスト)
- `scripts/migration/`・`scripts/poc/`・`scripts/lib/ts-extension-resolve-hook.mjs`(ツール類)

**コミット・push・main変更はまだ一切行っていない。**

## 秘密情報・機密ファイルのGit対象外の再確認

| 対象 | 状態 |
|---|---|
| 実接続文字列・DBパスワード | 追跡・未追跡いずれのファイルにも埋め込みなし(grep監査済み) |
| CA証明書(`data/tls/prod-ca-2021.crt`) | `/data`配下、Git非追跡 |
| 正本SQLite(`data/efootball.db`) | `/data`配下、Git非追跡 |
| dry-run成果物(`data/poc-hybrid-migration/`) | `/data`配下、Git非追跡 |
| `.env.local` | `.env.*`パターンでGit非追跡 |

## 現在の状態

`reference_data`スキーマへの初回実データ投入が完了し、投入後検証(停止7)・容量確認・最終判定(PASS)まで完了。次のマイルストーンは、アプリ本体をSQLiteからハイブリッド構成へ切り替える実装計画の提示(実装はまだ開始しない)。
