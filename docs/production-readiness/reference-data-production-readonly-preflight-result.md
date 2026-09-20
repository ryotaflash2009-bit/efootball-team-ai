# Production reference_data read-only preflight 実施記録

実施日: 2026-09-20
対象SQL: `docs/production-readiness/sql/preflight-reference-data-ops.sql`(静的監査済み、
issues: []。安全宣言バナー・WITH/SELECT限定・DDL/DML/GRANT/REVOKE非包含・利用者データ非参照・
`reference_data_ops`直接FROM非使用・秘密情報非出力を確認済み)
関連設計文書: [[reference-data-production-preflight.md]]
作業ブランチ: `feat/reference-data-production-readonly-preflight`

このファイルには、Project ID・Supabase URL・Dashboard URL・接続文字列・password・token・key・
メールアドレス・実ユーザーID・`current_database`/`current_user`/`session_user`の生値・
実行結果JSON全文のいずれも記載していない。

---

## 1. 実施方法

本人がSupabase Dashboard → SQL Editorで、静的監査済みのread-only preflight SQLを**1回だけ**
手動実行した。Claude Codeはこのセッションで実Production Supabaseへ一切接続していない。

実行に使用したSQLファイルのSHA-256(`c7de038cabac96275567bd71cd8ca3d30c2e5f950650f5a3779e5d265664a6b5`、
192行)を、本人が実行した時点と本記録作成時点の双方で確認し、一致することを確認済み
(コミット対象のSQLファイルは、本人が実際に実行したものと同一)。

## 2. 確認できた事項(A: 想定どおり)

| 項目 | 結果 |
|---|---|
| database identity | verified(生値は非保存) |
| execution role category | database owner / administrative SQL Editor role |
| PostgreSQL major version | 17 |
| SSL | enabled |
| `reference_data`スキーマ | 存在する |
| `reference_data_ops`スキーマ | 存在しない(未適用、設計どおり) |
| `world_player_cards`件数 | 13,009 |
| `managers`件数 | 66 |
| `player_card_analysis`件数 | 19 |
| `import_batches`件数 | 8 |
| 対象4テーブルの所有者 | いずれも`postgres` |
| RLS enabled(4テーブルすべて) | true |
| FORCE RLS(4テーブルすべて) | true |
| 公開SELECTポリシー | `world_player_cards`・`managers`・`player_card_analysis`の3テーブルに、`anon`/`authenticated`向けSELECTポリシー(USING: true、WITH CHECK: null)が存在 |
| `import_batches`の公開状態 | `anon`/`authenticated`向けポリシー・テーブル権限のいずれも無し(非公開のまま、設計どおり) |
| `anon`/`authenticated`のテーブル権限 | 公開3テーブルとも SELECT のみ。INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCESは確認されず |
| 主キー・外部キー・unique制約・check制約・想定インデックス | 存在を確認(`efhub_card_id`のunique index、`name_sort_key`系index、`player_card_analysis`→`world_player_cards`のFK、`import_batch_id`系FKを含む) |

これらはすべて、`classifyProductionPreflightResult`(`production-readonly-preflight-result.ts`)による
機械分類でも**Aバケット(想定どおり)のみ**となり、C/Dバケット(修正必要・Production applyをblock)の
差異は0件だった。

## 3. 確認できていない事項(E: 情報不足、独立確認が必要)

- **PostgRESTのExposed schemas設定**(Supabase Dashboard側の設定でありDBカタログ外のため、
  今回のSQLでは確認不能)。`reference_data`は現在のProduction API読み取りに必要であり、
  将来`reference_data_ops`を作成しても、Exposed schemasへは追加しない方針。`auth`を新たに
  追加する必要もない。この設定自体の変更は独立した承認事項であり、今回は変更していない
  (目視確認だけであれば書き込み操作は不要)。
- `information_schema.usage_privileges`だけでは、ロール継承によって実効的に成立する
  schema権限を完全には表現できない(`has_schema_privilege`等による直接確認は今回実施していない)。
- Supabaseのplatform backup状態。
- 実行専用のdedicated PostgreSQLロール(未作成)。
- staging schema(`reference_data_ops`)自体(未適用)。
- Production credentials(このセッションでは一切保持・記録していない)。

## 4. 総合判定

Production上の`reference_data`構造は、このリポジトリの設計(RLS・FORCE RLS・SELECT-onlyの
公開ポリシー・`import_batches`の非公開・主キー/外部キー/インデックス)と一致している(A)。
一方で、Dashboard側の設定(Exposed schemas)を含む一部の項目は、このSQLだけでは確認できない
情報不足(E)として残っている。

**Production applyは、Exposed schemasの目視確認・staging schema適用・dedicated role作成・
backup運用設計のいずれも未完了のため、引き続きblocked状態である。** 「Production適用可能」
「完全に安全」「自動更新が完成した」という判断はこの記録からは導けない。

## 5. 未実施事項

- Exposed schemas設定の目視確認(本人がSupabase Dashboardで別途確認する必要がある)
- `reference_data_ops` schema作成・適用
- 専用PostgreSQLロールの作成
- Secret設定
- Production apply / rollback
- Cron登録
- 追加のProduction SQL実行
