# 参照データ自動更新 Production セキュリティモデル(設計のみ、未接続・未適用)

作成日: 2026-09-19。**このセッションでは実Supabase・実Productionへ一切接続していない。
Production apply・rollback・DDL実行・Secret設定は一切行っていない。**

## 1. 現状のProduction参照データ構造(リポジトリ内SQLからの監査、実DB未接続)

`docs/production-readiness/sql/create-reference-data-schema.sql`・
`extend-reference-data-detail-schema.sql`・`extend-name-sort-key-schema.sql`・
`extend-player-card-analysis-name-schema.sql`から確認できる、確定済み参照データの構造:

| 項目 | 内容 |
|---|---|
| スキーマ | `reference_data`(`public`・`auth`とは別) |
| テーブル | `world_player_cards`(13,009件想定)・`managers`(66件)・`player_card_analysis`(19件)・`import_batches`(投入管理) |
| 選手能力値・スキル | `world_player_cards.stats`(jsonb)・`skills`(text[])、別テーブルには分解していない |
| appearance/AI styles/efhub連携 | `world_player_cards`への列追加(`efhub_card_id`・`ai_styles`・`appearance`・`efhub_conflicts`) |
| 監督ブースター/Link-Up Play | `managers.boosters`(jsonb配列)・`managers.link_up_plays`(jsonb配列)、別テーブルには分解していない |
| ソート用派生値 | `world_player_cards.name_sort_key`・`managers.name_sort_key`(collate "C") |
| 選手カード分析の英語名 | `player_card_analysis.efhub_name_en` |
| facets | 保存されたテーブル/列ではなく、実行時にアプリ側で集計(実DB未接続のためクエリ実装の詳細は本書の範囲外) |
| 主キー | `world_card_id`(text、数字文字列チェック)・`internal_manager_id`(integer)・`player_card_analysis.world_card_id`(FK) |
| RLS | 全テーブルでRLS有効+FORCE、`anon`/`authenticated`にSELECTポリシーのみ(INSERT/UPDATE/DELETEポリシーなし) |
| GRANT | `anon`/`authenticated`にUSAGE + SELECTのみ、`import_batches`はGRANTなし(不可視) |
| **実DB接続でしか確認できない事項** | 実際にこのDDLが適用済みかどうかの最終確認、実際の行数、Exposed schemasの設定状態、実際の権限一覧の目視確認 — これらは「実DB preflightで確認が必要」に分類する(推測で断定しない) |

## 2. 最小権限設計: Production適用主体の比較

| 候補 | 権限範囲 | RLS bypass | Secret漏洩時の影響 | rotation | 監査 | ネットワーク制限 | Vercel Hobby適合 | Supabase Free適合 | 運用負担 | 費用 |
|---|---|---|---|---|---|---|---|---|---|---|
| A. service role keyを持つサーバー処理 | 全テーブル(RLSを完全bypass) | あり(最大) | 極めて大きい(全データ読み書き可能) | 手動、Supabase Dashboardから | Supabase側ログのみ | 制限しにくい(APIキーベース) | 可 | 可 | 低(実装は容易) | 無料 |
| B. Supabase secret key(新方式)を持つサーバー処理 | service role keyとほぼ同等 | あり | 極めて大きい | 手動 | 同上 | 同上 | 可 | 可 | 低 | 無料 |
| C. 直接PostgreSQL接続する専用ロール(RLS対象、`reference_data_ops`だけにGRANT) | `reference_data_ops`のみ(GRANT次第で最小化可能) | **なし**(RLSは適用される、または専用ロールにBYPASSRLS属性を意図的に付与しない限り) | 限定的(範囲をGRANTで絞れる) | パスワード変更で対応、Session pooler経由 | pg統計・監査ログテーブル併用可 | Session pooler経由、IP制限も検討可 | 可(接続情報の管理は自前) | 可 | 中(接続プール管理が必要) | 無料 |
| D. SECURITY DEFINER functionによる限定RPC | 関数内で許可した操作のみ | 関数内だけ限定的にbypass | 関数の入力検証次第、鍵の直接漏洩は関数呼び出し権限漏洩と別問題 | 関数の再定義 | 関数呼び出しログ | PostgRESTの`.rpc()`経由、network制限は弱い | 可 | 可 | 中〜高(関数設計・監査が複雑) | 無料 |
| E. Supabase Edge Function | Edge Function内の資格情報次第(通常はservice role key保持) | あり得る | 大きい(Edge Function環境変数漏洩時) | Supabase側で管理 | Edge Function実行ログ | Supabase内部ネットワーク | 可(Vercelとは別) | 可(実行時間制限あり) | 中 | 無料枠あり、超過時課金 |
| F. GitHub Actionsからの直接接続 | Cと同様(専用ロール次第) | 専用ロール設計次第 | GitHub Actions Secrets漏洩時 | GitHub Secrets更新 | GitHub Actionsログ + DB側監査 | Actions runnerのIPは動的(allowlist困難) | 影響なし(Vercelを経由しない) | 可 | 中 | 無料枠内(GitHub Actions) |

**第一候補**: **案C(直接PostgreSQL接続する`reference_data_ops`専用の最小権限ロール)を、GitHub ActionsのCLI実行(案Fの実行環境)から使う組み合わせ**。
理由:
- service role key/secret key(案A・B)はRLSを完全にbypassし、漏洩時の影響が最大になる。今回のPhase 2設計(承認・checksum・lock・rollbackを多層に積む)の思想と相性が悪い(強い鍵に頼らず、狭い権限+多層ゲートで守る方針に合致するのはC)。
- SECURITY DEFINER RPC(案D)は関数内ロジックの監査が複雑になり、Phase 2の「トランザクション・advisory lock・shadow comparison」という手続き的な多段検証と相性が悪い。
- Edge Function(案E)は実行時間制限・Supabase側の別途学習コストがあり、今回のCLI中心の設計(ローカル/GitHub Actionsで検証済み)からの移行コストが大きい。
- 実行環境はGitHub Actions(案F)を推奨する理由は`reference-data-auto-update-postgres-validation.md`と同じ(Vercel runtimeとの分離、`concurrency`による二重実行防止、Secretsの管理実績)。

**代替案**: 将来的にSupabaseがreference_data_ops専用ロールへの直接接続を運用上扱いにくいと判断した場合、案D(SECURITY DEFINER RPC、呼び出し元をservice role keyではなくJWT検証付きの管理者限定RPCにする)を再検討する。

## 3. Secret管理方針(今回は何も生成・設定しない)

- 案Cを採用する場合に必要になるのは「`reference_data_ops`専用ロールのパスワード」1つだけであり、これはservice role key/secret keyとは異なる、権限が狭い専用資格情報である。
- 保存先候補: GitHub Actions Secrets(実行環境がGitHub Actionsのため)。Vercel Environment Variablesには**保存しない**(Vercelランタイムからのapply自体を許可しない設計のため、Vercel側にProduction書込み資格情報を置く必要が無い)。
- 今回のセッションでは、上記のいずれも生成・設定していない。

## 4. アプリ実行経路からの隔離(既存Phase 2と同じ原則)

- `production-preflight.ts`・`production-readonly-queries.ts`は`src/app`・`src/components`のいずれからもimportされない設計を維持する(Phase 1/2と同じ検証方法で確認可能)。
- `checkCalledFromAllowedContext`が`"cli"`以外(`vercel-runtime`・`client`・`public-endpoint`・`cron`)を構造的に拒否するため、仮にこのモジュールが誤ってアプリコードへ紐づいても、Production apply自体は起動しない。
- `createProductionAdapter()`は呼び出すと必ず例外を投げる(意図的な未実装)。
