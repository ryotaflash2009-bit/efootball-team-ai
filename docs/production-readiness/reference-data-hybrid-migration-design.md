# 参照データ移行方式の技術設計(2026-09-14)

調査日: 2026-09-14。本書は技術設計とローカルPoCの記録であり、**実Supabaseへの接続・データ送信・Vercel接続はいずれも行っていない**。ライセンス面は`data-distribution-rights-audit.md`0章のとおり解決済みのため、本書では技術判断にのみ集中する。

ローカルPoCの詳細な実測値(サイズ・速度・整合性)は`reference-data-migration-poc-results.md`を参照。本書はその結果を踏まえた設計・比較・結論を記載する。

---

## 1. 候補比較(A〜F)

比較対象データ: `world_player_cards`13,009件、`player_index_entries`47,479件、`managers`66件、`player_cards`19件(レガシー)、`player_booster_definitions`44件。

| 項目 | A. SQLite同梱(現状) | B. Supabase全面移行 | C. 索引は静的JSON+詳細はSupabase | D. オブジェクトストレージ実行時取得 | E. Vercel以外のコンテナホスティング | F. LibSQL/外部SQLite互換 |
|---|---|---|---|---|---|---|
| 選手検索 | SQL(高速、索引次第) | SQL(Postgresの索引・全文検索が使える) | クライアント側索引(軽量JSON 3.51 MiB、gzip 1.03 MiB)+サーバー側詳細 | 取得後はメモリ内検索(索引ファイル次第) | SQL(高速) | SQL相当(高速、ネットワーク越し) |
| 絞り込み・並べ替え | SQL | SQL(柔軟) | 索引側は簡易フィルタ、複雑な条件は詳細取得後にサーバー側で絞り込み | 索引ファイル次第 | SQL | SQL相当 |
| 選手詳細 | SQLクエリ1回(ローカルファイル) | Postgresクエリ1回 | Postgresクエリ1回(PoC実測: 1件2,279バイト) | ストレージから1件取得(未実測) | SQLクエリ1回 | ネットワーク越しクエリ1回 |
| 監督詳細 | SQLクエリ1回 | Postgresクエリ1回 | Postgresクエリ1回(PoC実測: 66件で40 KB) | ストレージから取得 | SQLクエリ1回 | ネットワーク越しクエリ1回 |
| 画像URL | DB内にURL文字列のみ(現状維持) | 同左(URLカラムのみ) | 同左 | 同左 | 同左 | 同左 |
| ページ表示速度 | 高速(ローカルファイル) | ネットワーク往復が発生(Supavisor等のプーリングで緩和可) | 索引部分はクライアント配信のため高速、詳細取得時のみAPI往復 | 初回取得後はキャッシュで高速 | 高速(コンテナ内ローカルファイル) | ネットワーク往復あり |
| 初回読込量 | 0(サーバー内で完結) | 0(クライアントはAPI応答のみ受信) | 索引ファイル自体をクライアントへ配信する設計なら3.51 MiB(gzip 1.03 MiB)。サーバー配信に留めれば0 | 初回のみストレージ取得コスト | 0 | 0 |
| サーバー転送量 | APIレスポンス分のみ(PoC実測: 100件検索結果=30 KB、詳細1件=2.3 KB) | 同左 | 同左(索引をサーバー内に留める場合) | ストレージ↔サーバー間の転送が追加 | 同左 | 同左+ネットワーク越しDB通信 |
| クライアントへの全量流出 | なし(APIが必要分だけ返す設計を維持) | なし | 索引を**クライアントへ直接配信する設計にすると発生**(3.51 MiB。ただし選手個人情報ではなく公開ゲームデータなので情報漏洩の性質ではない) | 設計次第 | なし | なし |
| cold start | 未検証(本書の前提課題) | Postgres接続のコールドスタートは既知の特性(プーリングで緩和) | 索引=静的アセットのため懸念なし。詳細取得=Postgres同様 | ストレージ応答時間に依存(未検証) | コンテナ起動時間に依存 | サービス側のコールドスタート特性に依存(未検証) |
| Vercelとの互換性 | **公式非推奨(2026-09-14確認)** | 良好(実績豊富) | 良好(静的アセット+Postgresいずれも標準サポート) | 良好(Vercel Blob等の統合あり) | 該当なし(Vercel以外) | 個別確認要 |
| Supabase Free枠への負荷 | 該当なし | データ量次第で圧迫(下記2章) | 詳細データのみ(索引を除く)なので負荷は限定的 | 該当なし | 該当なし | 該当なし |
| クエリ回数 | 1接続内で完結 | 一覧・詳細で複数回(通常のWeb API設計と同様) | 索引はクエリ不要(静的配信)、詳細のみクエリ | ストレージ取得+必要ならクエリ | 同左 | 同左 |
| データ容量(gzip後・PoC実測) | 91.6 MiB(DB全体) | 索引除く全データで約2.21 MiB(world_player_cardsフル) | 索引1.03 MiB+詳細2.21 MiB | 変換後データ量に依存(概ねB/Cと同等) | 91.6 MiB(コンテナイメージ内) | 91.6 MiB相当(サービス側) |
| 更新速度 | サイト再デプロイに結合(既知の課題) | SQL `INSERT`/`UPSERT`で独立更新可能 | 索引ファイルの再生成+アップロード、詳細はSQL更新(いずれもサイトデプロイと分離可能) | ストレージへのアップロードのみ(サイトデプロイと分離) | サイト再デプロイに結合(Aと同様) | 該当サービスのAPI経由で独立更新可能 |
| 一括更新・差分更新 | 全件洗い替えが基本(現状の同期スクリプトの設計) | SQLの`UPSERT`で差分更新可能 | 索引は全件再生成が簡単(軽量なため)、詳細はSQL `UPSERT` | 差分ファイルの部分更新は設計次第 | Aと同様 | 該当サービス次第 |
| 半自動更新・承認後反映 | `reference-data-update.md`の既存設計を踏襲可能 | 同左(承認後にSQL実行という1ステップが明確) | 同左(承認後に索引再生成+SQL実行の2ステップ) | 同左(承認後にアップロード) | 同左 | 同左 |
| ロールバック | ファイル差し替え(現状設計) | 旧テーブルへの切り戻しSQL、またはバックアップからの復元 | 索引ファイルの版管理+DBのロールバックの2系統 | オブジェクトのバージョニング機能(サービス次第)で対応 | ファイル差し替え | サービス次第 |
| PreviewとProductionのデータ分離 | 同一ファイルを共有(分離しにくい) | Supabaseプロジェクトを分ければ完全分離可能 | 索引ファイルは環境ごとに配信を分ければ分離可能、DBはSupabaseプロジェクト分離に依存 | ストレージのパス/バケットを分ければ分離可能 | 環境ごとに別コンテナで分離可能 | サービス次第 |
| 将来のネイティブアプリ | Next.js API経由なら影響なし | 良好(`@supabase/supabase-js`の実績) | 良好(索引配信+API双方とも標準的なWeb技術) | 良好 | 良好 | 個別確認要 |
| 実装工数 | 0(現状維持) | 中(スキーマ設計・移行スクリプト・APIルート改修) | 中(索引生成ロジック+一部Supabase移行) | 中〜高(ストレージ連携の新規実装) | 高(`hosting-options.md`既存評価どおり) | 中〜高(新規サービス学習コスト) |
| 月額費用 | 追加コストなし(現状) | Supabase無料枠内に収まる可能性が高い(下記2章) | 索引配信は追加コストなし、詳細用DBはBと同様 | ストレージサービスの追加費用(未調査) | ホスティング自体のコスト増(既存評価どおり) | 新規サービスの費用(未調査) |
| 従量課金リスク | 低い | データ量・アクセス増でPro移行の可能性(`cost-estimate.md`既存) | Bより低い(データ量が少ないため) | ストレージの転送量課金リスク | 該当ホスティングの従量課金 | 個別確認要 |
| バックアップ | 手動(現状) | Supabase Pro以降の自動バックアップ(`decision-record.md`既存推奨) | 索引=Git相当の版管理、詳細=Bと同様 | オブジェクトのバージョニング | 手動 | サービス次第 |
| 障害復旧 | ファイル差し替え | Supabase側の障害対応に依存 | 索引=即座に再配信可能、詳細=Bと同様 | ストレージ側の障害対応に依存 | コンテナ再起動 | サービス次第 |
| 保守負担 | 低い(現状のまま) | 中(RLS・移行スクリプトの保守) | 中(索引生成+DBの二重管理) | 中(新規サービスの運用) | 高(既存評価どおり) | 中〜高(新規学習) |

## 2. 第一候補: ハイブリッド構成の詳細評価

### 構成案

| データ | 方式 | 理由 |
|---|---|---|
| `player_index_entries`の検索用情報 | **軽量検索索引**(PoC実測: 47,479件で生3.51 MiB/gzip 1.03 MiB)を**サーバー側の静的アセットとして保持**し、APIルートがメモリ内で検索・返却する(クライアントへ索引全体を配信しない設計を維持し、現行のAPI経由アクセスパターンを崩さない) | 47,479件は「簡易な索引」としての性質が強く、`world_player_cards`ほど頻繁な詳細参照を要しない。静的アセット化によりSupabase側の負荷・費用を増やさずに済む |
| `world_player_cards`の詳細情報 | **Supabase PostgreSQLの公開参照用テーブル** | 13,009件・26能力値・スキル等の構造化データはリレーショナルDBとの相性が良く、検索・絞り込み・並べ替えをSQLへ委譲できる。PoC実測でフルデータは13,009件でgzip 2.21 MiBと小さく、Supabase無料枠(500 MB)を大きく下回る |
| `managers` | **Supabase PostgreSQLの公開参照用テーブル** | 66件と少量。PoC実測でgzip後40 KB未満 |
| `player_cards`(19件)+関連3テーブル(`player_card_positions`76件・`player_card_com_skills`34件・`player_card_skills`179件) | **訂正(2026-09-14)**: 当初「未使用のレガシーデータ」と記載していたが、これは誤りだった。`src/lib/world/analysis-repository.ts`の`getEfhubAnalysisDetail()`が実際にこのテーブル群を参照し、`/players/world/[worldCardId]`(World選手詳細ページ)から呼び出されている**現役の補助データ**であると判明した(World 13,009件のうちeFHUB個別ページ由来の19件だけに存在する、プレーヤーモデル・ポジション適性・COMスキル・逆足/フォーム/コンディション/怪我耐性の追加情報)。**移行対象に含める**。詳細は4章参照 | 実際に本番機能で使われているため除外できない |
| `player_booster_definitions`(44件) | **コード内静的定義(`src/lib/progression/booster-catalog.ts`)を正本のまま維持**し、SQLiteへの同期(`sync-booster-definitions.mjs`)自体を将来的に廃止する案を推奨 | 元々外部アクセス0件で、`booster-catalog.ts`が真の出所(SQLiteは派生コピー)。更新頻度が低く、コードレビュー・Gitの変更履歴で管理する方がSupabase経由より追跡しやすい |
| 画像 | **DBにはURLのみ保持**(現状の設計を維持)。表示は現行の自前プロキシ方式を維持 | 3章で比較 |

### 公開参照テーブルとユーザー非公開データの分離

- 参照データ(`world_player_cards`・`managers`)は**全ユーザー共通の読み取り専用データ**であり、`database-options.md`第3章の既存結論(「参照データをユーザーDBに混在させるべきでない」)を尊重し、**ユーザー個人データ(My Team・保存ビルド等)とは別スキーマ(例: `public`とは別の`reference`スキーマ、またはテーブル名prefixでの明確な分離)に置く**。
- RLSポリシーは、参照データテーブルには「`anon`ロールも含め全員に`SELECT`許可、`INSERT`/`UPDATE`/`DELETE`は`service_role`(管理用の別経路)のみ」という単純な形にし、ユーザーデータ用の「行ごとの所有者チェック」を伴う複雑なRLSとは**混同しない**。

### 画像の扱い: 自前プロキシ方式 vs 直接表示方式

| 項目 | 自前プロキシ方式(現状) | 直接表示方式(`next/image`直リンク等) |
|---|---|---|
| キャッシュ | サーバー側で制御可能(現行実装で`Cache-Control`/`ETag`尊重を確認済み、`player-image-findings.md`) | ブラウザー・CDNキャッシュに依存 |
| 帯域 | Vercel側の転送量にカウントされる(`vercel-pre-deploy-checklist.md`4章で既指摘) | クライアントが画像提供元(CDN)へ直接アクセスするため、Vercel側の転送量は増えない |
| 障害時フォールバック | 自前実装でプレースホルダー表示等の制御が可能(既存実装で確認済み) | 画像提供元の障害がそのままクライアントへ露出する |
| 許可ホスト制御 | 既存の`isAllowedWorldImageUrl`で実現済み | `images.remotePatterns`で同等の制御は可能 |
| **推奨** | **現状の自前プロキシ方式を維持**。理由: 既に安全設計(許可ホスト限定・プレースホルダーフォールバック)が完成しており、作り直す技術的必然性がない(`decision-record.md`既存結論と一致) | - |

## 3. Supabase移行を採用する場合の設計(実データは未送信・ローカル設計のみ)

### スキーマ設計(案、未適用)

```
-- 参照データ専用スキーマ(ユーザーデータのpublicスキーマとは分離)
create schema if not exists reference_data;

create table reference_data.world_player_cards (
  world_card_id text primary key,
  name_en text not null,
  name_ja text,
  card_type text,
  registered_position text,
  nationality text,
  region text,
  league text,
  team text,
  ovr_base integer,
  ovr_max integer,
  maximum_level integer,
  card_rating text,
  playing_style text,
  playing_style_def text,
  preferred_foot text,
  age integer,
  height integer,
  weight integer,
  image_url text,
  mobile_image_url text,
  boost1 text,
  boost2 text,
  stats jsonb,      -- 26能力値を配列/オブジェクトでまとめて格納(PoCのstats形状を踏襲)
  skills jsonb,      -- スキル一覧
  source text,
  fetched_at timestamptz
);
create index on reference_data.world_player_cards (registered_position);
create index on reference_data.world_player_cards (ovr_max desc);
create index on reference_data.world_player_cards using gin (to_tsvector('simple', coalesce(name_en,'') || ' ' || coalesce(name_ja,'')));

create table reference_data.managers (
  internal_manager_id integer primary key,
  source text,
  source_manager_id text,
  name_en text,
  name_ja text,
  team_name text,
  nationality text,
  possession_game integer,
  quick_counter integer,
  long_ball_counter integer,
  out_wide integer,
  long_ball integer,
  overload integer,
  manager_rating text,
  coaching_affinity text,
  formation text,
  has_booster boolean,
  has_link_up_play boolean,
  source_url text,
  fetched_at timestamptz
);
```

- 主キー: `world_card_id`(既存SQLiteのキーをそのまま踏襲。推測で新しいID体系は導入しない)、`internal_manager_id`。
- 外部キー: 参照データ同士(カード↔監督)に直接の外部キー関係はない(既存SQLiteでも同様、`reconcile-world-efhub.mjs`が別途緩やかな照合を行う設計)。
- 検索方式: PostgreSQLの`GIN`インデックス+`to_tsvector`による簡易全文検索、または`ILIKE`による部分一致(データ量13,009件なら`ILIKE`でも実用的な速度が見込める。全文検索の要否は実装時に計測して判断)。
- ページング: `LIMIT`/`OFFSET`、またはキーセットページング(`ovr_max`+`world_card_id`の複合カーソル)。
- 選手詳細・監督詳細取得: 主キーでの単純な`SELECT`。

### 権限設計

| ロール | 参照データテーブルへの権限 |
|---|---|
| `anon`(未認証) | `SELECT`のみ許可(公開参照データのため認証不要) |
| `authenticated`(認証済み) | `SELECT`のみ許可(`anon`と同じ。参照データはユーザー種別で内容が変わらない) |
| クライアントからの書込み | **`INSERT`/`UPDATE`/`DELETE`はいずれも拒否**(RLSポリシーで明示的に許可しない=既定で拒否) |
| 更新処理 | クライアントアプリとは別の管理用経路(ローカルの同期スクリプト+`service_role`キーを用いたサーバーサイド専用の更新、またはSupabase管理画面のSQL Editor)に分離する。**`service_role`キーは通常のNext.jsアプリケーションコードへは一切含めない** |

### Exposed schemas設定の要否(2026-09-14確定)

**結論: 実装時(Data APIから`reference_data`を読む場合)には、Supabaseダッシュボードの Project Settings → API → Exposed schemas へ`reference_data`を追加する操作が別途必要になる。今回はこの設定を変更していない。**

- Supabaseの自動生成Data API(PostgREST、`@supabase/supabase-js`の`.from()`が内部的に使う経路)は、**Exposed schemasに登録されたスキーマ(既定は`public`のみ)しか公開しない**という仕様である。これは今回新たに調査した事実ではなく、Supabase/PostgRESTの標準的な仕様。
- `reference_data`スキーマはExposed schemasに未登録のため、**現状のままでは`supabase.from("world_player_cards")`のような呼び出し(既存のuser_idスキーマとは別スキーマ指定が必要)は失敗する**(PostgRESTが「スキーマが見つからない」相当のエラーを返す)。
- 代替案として、Data API(PostgREST)を経由せず、サーバー専用の直接Postgres接続(例: Next.jsのAPI Routeから`pg`等のクライアントで接続)を使う設計であれば、Exposed schemasの変更は不要になる。ただしこの場合は別途、直接接続用の接続文字列(機密情報)の管理が必要になり、既存プロジェクトの「クライアントコードに`service_role`やDB接続文字列を含めない」という方針との整合を別途設計する必要がある。
- **今回の推奨構成(`supabase-js`の`.from()`経由でSELECTのみ行う)を実装する場合、Exposed schemasへの`reference_data`追加は必須**。この操作はSupabase管理画面上の設定変更であり、Claude Codeが代行することはできない。実施する場合は、他の設定(Site URL・Redirect URL・SMTP等)と同様に、事前に上杉さんへ1操作ずつ案内してから進める。

### Preview/Productionのデータ分離

- `preview-production-environment-design.md`2章の既存方針(初期PoC段階はA=全環境同一、一般公開前にB=Productionだけ分離)を、参照データにもそのまま適用する。
- 参照データは全ユーザー共通のため、Preview環境で参照データを誤って書き換えるリスクは(クライアントからの書込みを拒否する設計により)低い。

### 大量投入・差分更新・トランザクション

1. ローカルの同期スクリプト(既存の`sync-world-players-*.mjs`等を拡張)が、引き続きSQLite(またはステージング用の一時ファイル)へ取得。
2. 取得結果を検証(既存の`reference-data-update.md`4章の安全停止条件をそのまま適用: 件数の大幅減少・未知フィールド・能力値範囲外・重複急増・画像URL変更・計算テスト失敗・取得失敗等)。
3. 検証済みデータを、Supabaseの`reference_data`スキーマへ**トランザクション内で`UPSERT`**(1レコードずつではなくバッチ単位)。
4. 更新前後の件数・重複・異常値チェック(`reference-data-update.md`と同じ基準)。
5. **人による承認**(`reference-data-update.md`12ステップの既存方針を継続)。
6. 問題時は、直前のスナップショット(Supabaseの日次バックアップ、またはローカルに保持したJSONスナップショット)へロールバック。

### 旧SQLiteとの照合・保持方針

- 移行直後は、旧SQLite(`data/efootball.db`)を**削除せず、ローカルの参照・照合用として保持**することを推奨する(実データ移行後もしばらくは新旧の結果を突合できるようにするため)。
- 完全にSupabase移行が安定稼働した後の削除可否は、今回のタスクでは判断しない(将来の意思決定事項)。

### Supabase Free枠の概算(不明な料金は断定しない)

| 項目 | 概算 | 根拠 |
|---|---|---|
| DB容量 | `world_player_cards`(gzip 2.21 MiB相当のデータ、Postgresの行・索引オーバーヘッドを考慮しても実データは数十MB程度と見込む)+`managers`(gzip 40 KB未満)。Free枠500 MBに対し**十分な余裕がある**と見込む | PoC実測値(1章)を根拠にした概算。Postgresの実際のディスク使用量(索引・TOAST等含む)はPoCでは測定していない |
| 転送量 | 検索100件=約30 KB、詳細1件=約2.3 KB(PoC実測)。アクセス数次第だが、既存のVercel Hobby帯域(100 GB/月)と比べて十分小さい | 同上 |
| APIリクエスト数 | Supabaseの無料枠には明確なAPIリクエスト数上限は本書執筆時点で確認していない(**不明な料金・枠は断定しない**という方針のため、契約前にSupabase公式サイトのプラン画面で確認すること) | 未確認 |
| **ユーザーが契約画面で確認すべき内容** | (1) 現行のFree枠のDB容量・帯域・API呼び出し数の上限、(2) 参照データ用スキーマを追加した場合の既存ユーザーデータとの合算容量、(3) 7日間無操作での自動停止条件(`cost-estimate.md`既存記載)が参照データにも適用されるか | - |

## 4. 結論

### 1. 第一推奨構成: **ハイブリッド(索引=サーバー内静的アセット、詳細=Supabase PostgreSQL)**

理由: 公開後の安定性(Vercel公式非推奨のSQLite同梱を回避)、更新基盤(サイトデプロイと参照データ更新を分離できる)、将来のスマホアプリ(`@supabase/supabase-js`の実績)、運用費(PoC実測でデータ量が小さくFree枠に収まる見込みが高い)のいずれの観点でも最も安定している。

### 2. 暫定構成: **静的JSON索引+軽量カード一覧のみを先行導入し、詳細データは当面SQLiteのまま(サーバー内蔵ファイルとして)維持**

条件: 後で第一推奨構成(Supabase移行)へ段階的に移行できること。**ただしこの暫定構成もVercel上でのSQLite同梱という制約自体は解消しないため、あくまで「Supabase移行の実装工数を確保するまでの一時的な措置」であり、恒久的な採用はしない。**

### 3. 採用しない構成

- **91.6 MiB SQLiteのVercel Function同梱**(`sqlite-production-compatibility-audit.md`で判定C寄りと確定済み)。
- **SQLiteのpublic配置**(DB全体が誰でも直接ダウンロード可能になるため、`sqlite-production-compatibility-audit.md`5章で既に非推奨と結論済み)。
- **SQLiteのGit追加だけで解決する案**(容量・cold start・公式非推奨という技術的懸念は、Gitへ追加するだけでは一切解消しない)。
- **ブラウザーへDB全体をダウンロードする案**(上記publicの派生。同様の理由で非推奨)。

## 5. 本人操作が必要になる次の地点(今回はここで停止)

以下が必要になる直前で、1操作ずつ具体的に案内する(**今回は未実施**)。

- Supabaseプランまたは既存DB容量の確認(現在の契約状況次第では、参照データ用の追加容量が既存のFree枠内に収まるか、上杉さん自身の画面で確認する必要がある)。
- 新しいSupabaseプロジェクト作成(Preview/Productionを分離する場合)、またはスキーマ追加(既存プロジェクトを使う場合)。
- SQL Editorでのスキーマ作成(上記2章のDDLを実行する場合)。
- 実データのインポート(段階的な移行スクリプトの実装後)。

**今回はこれらのいずれも実行していない。** 次に進む場合、まず「既存のSupabaseプロジェクトへ参照データ用スキーマを追加するか、新規プロジェクトを分離するか」という判断が必要になる。
