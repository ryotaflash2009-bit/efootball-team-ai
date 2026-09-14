# アプリ本体のSQLite→ハイブリッド構成 切り替え実装計画(2026-09-14)

**本書は計画のみ。実装・コミット・push・ブランチ作成のいずれもまだ行っていない。** `reference_data`スキーマへの実データ投入(13,009/66/19件、Database Size 0.049 GB)が完了し、PASS判定が出たことを受けて、次の段階として作成する。

対象採用構成(ユーザー指定、確認済み):

| 機能 | 移行後の参照先 |
|---|---|
| 選手検索 | (下記「重要な発見」参照。当面はPostgresへの直接クエリを推奨) |
| 選手詳細 | `reference_data.world_player_cards` |
| 監督 | `reference_data.managers` |
| カード分析(eFHUB由来19件) | `reference_data.player_card_analysis` |
| ユーザー個人データ | 既存`public`スキーマ+RLS(無変更) |
| 元SQLite | ローカルの取得・検証・更新・バックアップ用途(アプリ本体の読み取り元からは外す) |

---

## 0. 重要な発見: 静的検索索引は現状のライブ機能に不要

`src/app/api/world/players/route.ts`(選手検索・一覧API)は、`player_index_entries`(47,479件)ではなく**`world_player_cards`(13,009件、今回Supabaseへ投入済み)を`src/lib/world/queries.ts`のSQL `WHERE`句で直接検索**している。`player_index_entries`はeFHUBとの照合処理(`reconcile-world-efhub.mjs`等)で使われる内部データであり、ユーザー向けの検索UIからは参照されていない。

**結論**: 今回のアプリ切り替えでは、`static-search-index-design.md`で設計した索引(`src/lib/reference-data/search-index.ts`)の組み込みは**不要**。`world_player_cards`は既にPostgres側にGINインデックス(`world_player_cards_name_search_idx`)付きで投入済みのため、Postgresへの直接クエリ(`ilike`/全文検索)で現行と同等以上の検索性能が得られる。静的索引は、将来Postgres読み取り負荷が問題になった場合の最適化候補として保留し、今回のスコープからは外すことを推奨する(ユーザーの意向次第で復活可能)。

---

## 1. 影響範囲

### 1-1. 変更が必要なファイル(データアクセス層のみ)

| ファイル | 現状 | 変更内容 |
|---|---|---|
| `src/lib/world/repository.ts` | SQLite(`src/lib/world/db.ts`)を直接クエリ | `WORLD_DATA_SOURCE`環境変数で分岐。Supabase側実装を追加、SQLite側実装は温存 |
| `src/lib/world/queries.ts` | SQLiteの`WHERE`句組み立て(`buildWhere`/`orderByClause`) | 同等のPostgresクエリ組み立てロジックを追加(供給側関数のシグネチャ・戻り値は不変) |
| `src/lib/managers/repository.ts` | SQLiteを直接クエリ | 同上のSupabase版実装を追加 |
| `src/lib/world/analysis-repository.ts` | SQLite`player_cards`+3補助テーブルを4回SELECT | Supabase版は`reference_data.player_card_analysis`への1回のSELECTのみ(**旧実装より単純化される**、jsonb/text[]に既に構造化済みのため) |
| `src/lib/world/player-image.ts` | 画像URL取得元はSQLite(`getWorldImageUrls`) | Supabase版の`image_url`/`mobile_image_url`取得を追加。画像バイト自体の自前プロキシ方式は無変更 |
| NEW `src/lib/supabase/reference-data-client.ts` | なし | `reference_data`スキーマ専用のSupabaseクライアント(既存の`NEXT_PUBLIC_SUPABASE_URL`/`PUBLISHABLE_KEY`を再利用。個人データ用クライアントとは別インスタンス) |
| NEW `src/lib/world/env.ts`(または既存ファイルへ追記) | なし | `WORLD_DATA_SOURCE`(`"sqlite" \| "supabase"`、既定`"sqlite"`)を読み取る小さな検証関数(`src/lib/supabase/env.ts`の`validateSupabaseEnv`と同じ設計パターン) |

### 1-2. 変更が不要なファイル(契約を維持するため無変更)

- **API Routes**: `src/app/api/world/players/route.ts`・`[worldCardId]/route.ts`・`by-ids/route.ts`・`player-image/[worldCardId]/route.ts`、`src/app/api/managers/route.ts`・`[managerId]/route.ts` — リポジトリ関数のシグネチャ・戻り値型・エラークラス(`WorldDataUnavailableError`/`WorldQueryError`)を完全に維持するため、これらのルートは**1行も変更しない**。
- **サーバーコンポーネント**: `src/app/page.tsx`・`src/app/players/page.tsx`・`src/app/players/world/[worldCardId]/page.tsx`・`src/app/managers/page.tsx`・`src/app/managers/[managerId]/page.tsx`・`src/app/compare/page.tsx` — 同上の理由で無変更。
- **クライアントコンポーネント**(`AddPlayerSearch`・`PlayerSearchPanel`・`SquadEditor`・`ManagerPicker`等、全10ファイル以上) — API Routeを呼ぶだけなので無変更。

**設計原則**: データアクセス層(リポジトリ3ファイル+クエリ組み立て1ファイル+新規クライアント)だけを差し替え、それより上位(API Route・ページ・コンポーネント)の契約(関数シグネチャ・レスポンス形状・エラー種別)を1バイトも変えないことで、影響範囲を最小化し、切り替えを外部から不可視にする。

### 1-3. 変更しないもの(明示)

- `src/lib/world/db.ts`(SQLite接続)は**削除しない**。`scripts/`配下の取得・移行・検証ツールは引き続きこれを使う。
- 正本SQLite(`data/efootball.db`)自体は無変更。
- 既存`public`スキーマ・RLS・ユーザー個人データ(My Team等)は無変更。
- `player_booster_definitions`は今回も対象外(`src/lib/progression/booster-catalog.ts`がコード内正本のまま、調査で「ライブなSQLite読み取り経路なし」を再確認済み)。

---

## 2. 段階実装(2026-09-14確定、次ブランチ`feat/supabase-reference-data-switch`で採用する順序)

**前提**: 本監査ブランチ(`chore/vercel-readiness-audit`)を先にコミット・push・PR作成・GitHub Checks/CodeQL確認・mainマージまで完了させ、その後の最新`main`から次ブランチを分岐する(10章参照)。監査ブランチから直接分岐しない。

```
Phase A: 抽象化基盤(既定挙動は無変更)
  - src/lib/supabase/reference-data-client.ts を追加
    (reference_dataスキーマ専用クライアント。anon鍵のみ、service_role不使用)
  - データソース抽象化層(WorldRepository等のインターフェース定義)を追加
  - WORLD_DATA_SOURCE 環境変数の読み取りを追加(既定値"sqlite"、本番挙動は無変更)
  - テストダブル(FakeReferenceDataClient相当のSupabase版)を整備

Phase B: managers / player_card_analysis リポジトリへSupabase経路を追加
  - src/lib/managers/repository.ts にSupabase経路を追加(既定sqlite維持)
  - src/lib/world/analysis-repository.ts にSupabase経路を追加(既定sqlite維持)
  - 対応するテストダブルベースのUnit Testを追加

Phase C: world_player_cards検索・詳細・フィルタ・ソート・ページング
  - src/lib/world/queries.ts のPostgres版フィルタ/ソート組み立てを追加
  - src/lib/world/repository.ts にSupabase経路を追加(既定sqlite維持)
  - hasBooster互換性(6章の完了条件)をこの段階で満たす
  - 既定はsqliteのまま維持

Phase D: SQLiteとSupabaseの全件シャドー比較
  - 主キー集合の完全一致確認(world_player_cards 13,009件・managers 66件・
    player_card_analysis 19件)
  - 全正式フィールド・配列(skills/com_skills/player_skills)・
    JSONB(stats/player_model/positions)・null・Unicode・並び順・ページング・
    検索条件・全フィルター(hasBooster含む)・全ソートキーの差分レポートを作成
  - 1件でも予期しない差分があれば、Phase Eへ進まない

Phase E: 既定値の切り替え(差分0件の場合のみ)
  - WORLD_DATA_SOURCEの既定値を"supabase"へ変更するPRを、Phase B〜Dのマージとは
    分離して作成する(切り戻しやすくするため)
  - SQLiteが存在しない隔離環境(例: data/efootball.dbを一時的に退避した状態)で
    全主要機能(検索・詳細・監督・分析・お気に入り・比較・Best XI・My Team編成)を確認し、
    SQLiteへの暗黙フォールバックが存在しないことを確認する
  - Supabase障害時に安全なエラー(現行のWorldDataUnavailableError相当)を返し、
    無言でSQLiteへフォールバックしないことを確認する

Phase F(本タスクの範囲外、将来の判断): Vercel Preview接続の準備
  - SQLiteをVercelへ同梱しないことの確認(すでにdry-runで確認済みの設計を踏襲)
  - 環境変数(WORLD_DATA_SOURCE=supabase等)のVercel側設定
  - Supabase Redirect URLの追加設定(Vercel接続は本人操作、今回のタスクでは未実施)
```

---

## 3. フォールバック設計

- 切り替えの主フォールバックは**`WORLD_DATA_SOURCE`環境変数**そのもの。`"supabase"`→`"sqlite"`へ戻すだけで、コードロールバックなしに即座に旧経路へ復帰できる。
- SQLite側の実装・データ・接続コードは**削除しない**(Phase Fまで保留)。両実装が共存する期間を意図的に長く取ることで、フォールバックの信頼性を確保する。
- Supabase側で障害・レイテンシ悪化・想定外のデータ不整合が起きた場合、環境変数の変更(+再デプロイ、またはローカルはdevサーバー再起動)だけで復旧できる設計とする。
- APIルート・コンポーネント層を変更しないため、フォールバック時にこれらへの影響も一切ない。

---

## 4. テスト計画

### 4-1. 単体テスト(新規)

- `src/lib/world/queries.test.ts`(既存)と対になる新規テストで、Postgres版フィルタ/ソート組み立てが、`real-import-orchestrator.test.ts`の`FakeReferenceDataClient`と同様の**テストダブル**(呼び出されたクエリ条件を記録するフェイクSupabaseクライアント)に対して、正しい`ilike`/`eq`/`range`呼び出しを行うことを確認する。実Supabase接続は行わない。
- `src/lib/world/repository.test.ts`(Supabase実装部分)・`src/lib/managers/repository.test.ts`(同)・`src/lib/world/analysis-repository.test.ts`(同)を新規作成し、テストダブル経由で以下を確認:
  - ページング境界(先頭・最終ページ)
  - 0件時の空配列/nullの扱い(現行のtry/catchで例外を握りつぶす挙動を維持しているか)
  - `getPlayersByWorldIds`の500件上限
  - `hasBooster`のOR条件(boost1/boost2いずれかが0でない)が正しく組み立てられるか
  - `getEfhubAnalysisDetail`が該当行なしで`null`を返すか(現行のbest-effort設計を維持)

### 4-2. 契約(型)整合性

- SQLite実装とSupabase実装が**同一のTypeScriptインターフェース**を実装するよう明示的に型定義し(例: `WorldRepository`インターフェース)、コンパイル時に戻り値の形状不一致を検出できるようにする。

### 4-3. シャドー差分比較(ローカル専用スクリプト、実行はPhase D)

- 正本SQLiteとSupabaseの両方から同一条件で取得し、`listPlayers`/`getPlayerByWorldId`/`getManagerById`/`getEfhubAnalysisDetail`の結果を突き合わせる。
- 対象: 全13,009件のworld_player_cards(詳細取得)、全66件のmanagers、全19件のplayer_card_analysis、および検索・フィルタの代表的な組み合わせ数十パターン。
- 完全一致(または既知の差異、例: タイムスタンプ精度)のみ許容し、1件でも予期しない不一致があれば有効化(Phase E)を進めない。

### 4-4. 既存テストへの影響

- API Route・ページ・コンポーネントは無変更のため、既存の関連テスト(ルートのレスポンス形状テスト等)はそのままSupabase実装に対しても有効(モック対象がリポジトリ関数である限り、実装の差し替えはテストに影響しない)。
- 既存2741件は削除・skip・弱体化しない。

### 4-5. 手動ブラックボックス

- ローカルで`WORLD_DATA_SOURCE=supabase`に切り替えたdevサーバーで、選手検索・選手詳細(eFHUB分析欄含む)・監督一覧・監督詳細・お気に入り・比較・Best XI・My Team編成の各画面を目視確認する。

---

## 5. ロールバック計画

| 段階 | ロールバック方法 |
|---|---|
| Phase B(実装PRマージ後、フラグ既定sqliteのまま) | 通常のコードロールバック(revert)で十分。本番挙動への影響なし |
| Phase E(既定値をsupabaseへ変更した後) | `WORLD_DATA_SOURCE`を`sqlite`へ戻すだけ(コード変更不要、環境変数の変更+再デプロイのみ) |
| Supabase側の障害時 | 同上。アプリ側のコード・データともに変更不要 |
| データ不整合が発覚した場合 | `reference_data`スキーマ側は`reference-data-supabase-update-flow.md`のロールバック設計(import_batch単位)に従う。アプリ側は上記の環境変数切り戻しで即座に旧経路へ復帰できるため、データ側の復旧を待つ間もサービスは継続できる |
| Phase F(将来、SQLite経路削除後) | この段階に進む前提として、Supabase経路の長期安定稼働が確認済みであることを要件とする。削除前にコードロールバック用のタグ/ブランチを残す(具体的な運用は将来の判断) |

---

## 6. hasBoosterの正式方針(2026-09-14、実データ調査済み。推測による確定は行わない)

### 6-1. 現在のSQLiteクエリの条件(`src/lib/world/queries.ts`、確認済み)

```
hasBooster === true  → (COALESCE(c.boost1, 0) <> 0 OR COALESCE(c.boost2, 0) <> 0)
hasBooster === false → COALESCE(c.boost1, 0) = 0 AND COALESCE(c.boost2, 0) = 0
hasBooster未指定     → 条件を付与しない(全件対象)
```

### 6-2. 対象テーブル・カラムの実データ調査結果(`data/efootball.db`、2026-09-14実測)

| 項目 | 結果 |
|---|---|
| 対象テーブル・カラム | `world_player_cards.boost1`・`boost2` |
| SQLite宣言型 | 両方とも`INTEGER` |
| NULL件数 | boost1: 0件、boost2: 0件(**NULLは実データに存在しない**) |
| 空文字・空配列 | 該当なし(スカラーINTEGER列であり配列ではない) |
| 型不整合行 | `typeof(boost1)`/`typeof(boost2)`が`integer`/`null`以外の行: 0件 |
| 不正値(負数等) | boost1<0・boost2<0ともに0件 |
| 値の範囲 | boost1: 0〜162(distinct 107種)、boost2: 0〜77(distinct 28種) |
| 通常ブースターの表現 | 0 = ブースターなし、0以外 = ブースターカタログのID |
| 複数ブースター | `boost1`と`boost2`の2枠。実データでは**boost1=0かつboost2≠0の行が0件**(boost1が常に先に埋まる。ただしコードの条件式はboost1/boost2いずれかが非0であればtrue扱いとする設計であり、この実データの偏りに依存しない) |
| 暫定値・特殊ブースター | 実データ上、booster-catalog.tsの`evidenceLevel`が低い暫定値も含め、すべて上記の整数範囲に収まっており、`hasBooster`条件の解釈に影響する特殊値(NULL・負数・文字列)は確認されなかった |
| `hasBooster=true`相当件数 | 2,314件(実測) |
| `hasBooster=false`相当件数 | 10,695件(実測) |
| 合計 | 13,009件(一致) |

### 6-3. 重要な発見: Postgres DDLの型不一致(推測で埋めず、事実として記録)

`docs/production-readiness/sql/create-reference-data-schema.sql`は`boost1 text, boost2 text`と宣言しているが、SQLite側の実際の型は`INTEGER`である。実投入時、`migration-transform.ts`は`boost1`/`boost2`を無変換で渡しており、`real-import-orchestrator.ts`の列型マップ(`WORLD_COLUMN_TYPES`)にも`boost1`/`boost2`の特別扱いはない(既定の"scalar"としてそのまま渡している)。そのため、既に投入済みの`reference_data.world_player_cards.boost1`/`boost2`は、**Postgres側ではTEXT型の数字文字列(例: `"0"`・`"83"`)として保存されている**(実測データでは"0"/"83"等の整数のみで、小数・前ゼロ・空白混入等の表記ゆれは無いと推測されるが、次ブランチでのシャドー比較時にPostgres側の実値も直接確認すること)。

**次ブランチでの必須確認事項(推測で確定しない)**:
1. Postgres側で実際に格納されている`boost1`/`boost2`の値を直接SELECTし、期待通り"0"〜"162"の数字文字列のみであることを確認する。
2. `hasBooster`のPostgres側条件は、テキスト比較(`boost1 <> '0' OR boost2 <> '0'`)と数値キャスト比較(`(boost1::int) <> 0 OR (boost2::int) <> 0`)のどちらを採用するか、上記1の確認結果を踏まえて決定する(NULLが存在しないため`COALESCE`は不要になる可能性が高いが、これも次ブランチでの実測で確認する)。
3. スキーマ設計自体を`text`から`integer`へ修正するか(既存データの型変換を伴う)、`text`のまま運用するかも、次ブランチの判断事項とする。

### 6-4. 完了条件(次ブランチ、今回は未実施)

SQLiteとSupabaseへ**同一の意味を持つ**`hasBooster=true`/`hasBooster=false`/未指定の3条件をそれぞれ適用し、**返される主キー(`world_card_id`)集合が完全一致すること**を完了条件とする。1件でも差分があれば、Supabase経路をhasBoosterフィルタについて既定にしない(3章のシャドー差分比較の一部として実施)。

---

## 7. 静的検索索引の扱い(今回は設計・PoCのみ維持、アプリへの組み込みは行わない)

- `src/lib/reference-data/search-index.ts`(実装・テスト11件)と`docs/production-readiness/static-search-index-design.md`(設計)は、**このまま監査ブランチに保持する**(削除しない)。
- 生成される索引JSON(`data/poc-hybrid-migration/migration-dry-run/search-index.json`等)はGitへ追加しない(既存のとおり`/data`配下でGit非追跡)。
- 今回のアプリ切り替え(次ブランチ)では、この索引をアプリへ組み込まない。理由:
  1. 現在のライブ検索は`world_player_cards`(13,009件、投入済み)を直接検索しており、`player_index_entries`(47,479件)を経由していない。
  2. Supabase側に検索用のGINインデックス(`world_player_cards_name_search_idx`)が作成済みで、Postgres直接検索がそのまま使える。
  3. まずPostgres直接検索方式単体で互換性・性能を検証し、不要な同時変更(索引導入+DB切替を同時に行うこと)を避ける。
  4. 検索結果集合を、今回の切り替えで変えないことを優先する。

### 将来の再検討条件(参考、今回は着手しない)

- Postgres直接検索(`ilike`/全文検索)の実測レイテンシがユーザー体験上の問題になった場合。
- Supabase側のAPIリクエスト数/転送量が無料枠を圧迫する規模までアクセスが増えた場合。
- `player_index_entries`(47,479件)自体をアプリの検索対象に含める新要件が生じた場合(現状は対象外)。

---

## 8. 未決定・要判断事項(実装着手前にユーザー判断が必要)

1. `reference_data.world_player_cards.boost1`/`boost2`のPostgres型を`text`のまま運用するか`integer`へ修正するか(6-3節)。
2. Vercel Preview接続・新ブランチ作成のタイミング(本書■10〜■11の順序どおり、監査PRのmainマージ後に着手する)。

**本書の提示をもって停止する。実装・ブランチ作成・コミット・pushはまだ行っていない。**
