# 停止5: 実参照データ投入前の最終確認(2026-09-14)

**本書の作成にあたり、実Supabaseへの追加SQL実行・実データインポート・RLS/権限変更・Exposed schemas再変更のいずれも行っていない。** `scripts/migration/reference-data-migration-tool.mjs`の最新dry-run実行結果(実行日時2026-09-14T12:16:59.274Z)を根拠とする。

---

## 1. dataset_version・import_batch_id・manifest・payload_hash

| テーブル | dataset_version | import_batch_id(dry-run時点の例。実投入時に再採番) | payload_hash |
|---|---|---|---|
| `world_player_cards` | `world-2026-09-14` | `cabc0b69-6417-48a3-9125-a3dd2c1bac56` | `0d6ea084be4924818ae0e424a17cb2818b4e71e047c9fd534ca2340c5c9fcfa5` |
| `managers` | `managers-2026-09-14` | `0b3a26a0-1268-49b3-b9c8-ff27f2b031e4` | `03ad15f5f7637b6da1acb73c2fe0e1168b2393fb6b540e412cd926de6724e5ef` |
| `player_card_analysis` | `player-card-analysis-2026-09-14` | `2c07c67e-7964-422c-a366-e9ac526f56cf` | `d097441e4d041456cfa05c77b927ac04fa17537fc5825531e843aab8b4a70ac3` |

- `import_batch_id`は`randomUUID()`で毎回採番されるため、実投入時に再度dry-runを実行して直前の値を使う(本書の値は例示であり、実投入直前に再生成する)。
- manifest本体(件数・ハッシュ・生成日時を含むJSON)は`data/poc-hybrid-migration/migration-dry-run/*.manifest.json`に出力済み(Git未追跡)。

## 2. 件数・重複・孤立参照・必須項目・Unicode・画像URL

| 確認項目 | 結果 |
|---|---|
| `world_player_cards`件数 | **13,009件**(取得元と検証OKが一致) |
| `managers`件数 | **66件**(取得元と検証OKが一致) |
| `player_card_analysis`件数 | **19件**(検証OK) |
| 重複ID件数 | 3テーブルとも**0件**(`findDuplicateIds`) |
| 孤立参照(`world_player_cards`に存在しないID) | **0件**(`findOrphanAnalysisRows`) |
| 必須項目欠損 | 3テーブルとも検証NG **0件**(`validateWorldPlayerCard`/`validateManager`が空文字・範囲外を検出する設計、実データでは該当なし) |
| Unicode保持 | 既存テスト(`migration-transform.test.ts`)で日本語名(「バーチャット」「リオネル メッシ」等)の非破損を確認済み。実データにも日本語名が含まれる(`name_ja`列) |
| 画像URL検証 | `isAllowedWorldImageUrl`による許可ホスト(`d1zxa6glxh8sq9.cloudfront.net`等)チェックを`validateWorldPlayerCard`に組み込み済み。検証NG 0件のため、実データの画像URLはすべて許可ホスト内 |

## 3. 投入バッチ数・1バッチ最大サイズ・投入順序

### 投入バッチ数(推奨案)

| テーブル | 件数 | 推奨バッチ分割 |
|---|---|---|
| `world_player_cards` | 13,009件 | **2,000件ずつ7バッチ**(6×2,000+1×1,009) |
| `managers` | 66件 | 1バッチ |
| `player_card_analysis` | 19件 | 1バッチ(`world_player_cards`投入完了後) |

- 分割理由: 1リクエスト/1トランザクションのサイズを抑え、タイムアウト・メモリ・ロック時間を最小化するため(具体的な上限はSupabase側で公式に明記されていないため、保守的に区切る)。66件・19件は分割不要。
- `import_batches`には**サブバッチ単位ではなく、テーブル単位で1行**(例: `world_player_cards`全体で1つの`import_batch_id`)を記録し、そのバッチIDを全サブバッチのUPSERTで共通利用する(サブバッチ分割は実装上の都合であり、監査上は1テーブル1バッチとして扱う)。

### 投入順序

```
1. import_batches に status='pending' の行を作成(world_player_cards用)
2. world_player_cards を投入(2,000件×7サブバッチ、UPSERT)
3. import_batches の world_player_cards 行を status='verified' に更新(件数・payload_hash照合後)
4. import_batches に status='pending' の行を作成(managers用)
5. managers を投入(1バッチ、UPSERT)
6. import_batches の managers 行を status='verified' に更新
7. import_batches に status='pending' の行を作成(player_card_analysis用)
8. player_card_analysis を投入(1バッチ、UPSERT) ※ world_player_cards への外部キー制約があるため必ず最後
9. import_batches の player_card_analysis 行を status='verified' に更新
```

`player_card_analysis.world_card_id`は`world_player_cards`への外部キー参照(`on delete cascade`)のため、**必ずworld_player_cardsの投入完了後に投入する**(順序を守らないと外部キー制約違反で投入自体が失敗する。データは残らないため安全側の失敗だが、無駄な失敗を避けるため順序を守る)。

## 4. 失敗時のロールバック方法

| 失敗のタイミング | ロールバック方法 |
|---|---|
| コミット前(トランザクション内でのエラー) | `ROLLBACK`によりそのトランザクションは何も反映されない(自動的に安全) |
| コミット後、件数/ハッシュ照合で不一致を検出 | 直前の`import_batches`行を`status='rolled_back'`に更新し、そのバッチが投入した行を、ローカル保存済みの投入前状態(まだ存在しないため=新規投入なら該当行を`DELETE`)に戻す。**初回投入は既存行が無いため、ロールバック=該当バッチの投入行を削除するだけで良い**(`reference-data-supabase-update-flow.md`3章の「差分だけを戻す」方針は2回目以降の更新時に適用される) |
| 最終手段(スキーマ自体を作り直したい場合) | `rollback-reference-data-schema.sql`でスキーマごと削除し、`create-reference-data-schema.sql`から再実行する(空の状態から再スタート) |

## 5. 容量確認

| 項目 | 内容 |
|---|---|
| 投入前Database Size | **0.026 GB**(2026-09-14、上杉さん確認済み。今回の検証で行った書込みはすべて`42501`で拒否され実データは残っていないため、この値から変化していないと推定されるが、**実投入直前にダッシュボードで再確認することを推奨**) |
| 投入後の容量確認方法 | `supabase-capacity-verification-procedure.md`1-1節の手順(Project Settings → Database/Reports → Database size)を、各テーブル投入完了直後(3章の投入順序のステップ3・6・9のタイミング)に実施し、`supabase-capacity-verification-procedure.md`2章の3段階見積り(Stage 1〜3、累計約81 MB)との乖離を確認する |
| 400 MB超過時の停止条件 | `supabase-capacity-verification-procedure.md`4章のとおり: 累計Database Sizeが**400 MB(上限500 MBの80%)**を超えた時点で以降の投入を停止。見積りの2倍を超える乖離、1バッチ50 MB超の急増、Egress異常急増も同様に停止条件とする |

## 6. 投入ツールが実Supabaseへ接続するために必要な本人操作(今回は未実施)

実データ投入には、現在の`scripts/migration/reference-data-migration-tool.mjs`(dry-run専用、接続機能なし)とは別に、実接続を持つ投入ツールの実装が必要であり、その実行には以下のいずれかの資格情報が必要になる。

- **直接Postgres接続情報**(ホスト・ポート・データベース名・ユーザー名・パスワードを含む接続文字列)、または
- `service_role`キー(Data API経由でRLSをバイパスする管理用キー)

**いずれも、Supabase Dashboardからのみ取得できる情報であり、上杉さん本人の操作が必要になる。この情報をチャットへ貼り付けたり、Claude Codeに直接入力させたりしない**(7章の資格情報取扱い方針を参照)。この本人操作は、実装したツールを実行する直前の段階で、1操作ずつ具体的に案内する(今回はまだ案内していない)。

## 7. 資格情報の取扱い方針

- 管理用資格情報(接続文字列・`service_role`キー)は、通常のNext.jsアプリケーションコード(`src/`配下)へは一切含めない。投入専用の`scripts/`配下の一時ツールでのみ使用する。
- 資格情報をCLIの**コマンドライン引数として渡さない**(シェル履歴・プロセス一覧に残るため)。ローカルのGit非追跡ファイル(例: `.env.migration.local`、`.gitignore`へ追加要)から環境変数として読み込む方式にする。
- 資格情報を`console.log`等でログへ出力しない実装にする(既存の`migration-transform.ts`系コードは値を一切ログ出力しない設計を踏襲する)。
- 資格情報をGitへコミットしない(`.gitignore`で確実に除外する)。
- 資格情報を本書を含むいかなる文書にも記載しない。

---

## 8. 実データ投入手段の比較

| 比較項目 | 1. Dashboard手動投入 | 2. psql/接続文字列でのローカル投入 | 3. 一時的な管理用インポートスクリプト | 4. Supabase CLI | 5. Data API管理用投入(`service_role`) |
|---|---|---|---|---|---|
| 13,009件の大量投入への適性 | **悪い**(手動貼付・入力は非現実的) | 良い(`\copy`等で高速一括処理) | **良い**(バッチ・検証ロジックを実装で制御) | 中(本来はスキーマ変更向け、大量データには不向き) | 中(1リクエストの分割が必須、上限が非公開) |
| バッチ処理 | 手動分割のみ(煩雑) | 可能(`\copy`/複数トランザクション) | **実装次第で柔軟に自動化可能** | 標準機能としては無い | リクエスト単位で分割可能 |
| トランザクション | SQL Editor内で可能 | 明示的に制御可能 | **明示的に制御可能** | マイグレーション単位で1トランザクション | リクエスト単位(複数リクエストをまたぐ一括性は無い) |
| ロールバック | 自動(コミット前のみ) | 容易(`ROLLBACK`) | **実装で自動化可能** | データ投入用途では想定されていない | バッチ単位のみ、全体の一括ロールバックは別途設計要 |
| 資格情報の安全性 | **良い**(Dashboardログインのみ、DB資格情報を別途扱わない) | 要注意(接続文字列の保管・入力方法に注意) | 要注意だが実装で軽減可能(環境変数化・非ログ出力を徹底) | 中(CLI認証情報がローカルに永続化) | **最も要注意**(`service_role`はRLSを完全バイパスする最強権限) |
| ログへの秘密情報混入リスク | 低い | 中(コマンドライン引数にすると高い) | 低い(実装で回避可能) | 低い | 中(HTTPヘッダに載る) |
| Windows環境での実行可否 | 可能(ブラウザのみ) | 可能(psqlの別途インストールが必要) | **可能**(既存Node.js環境をそのまま使用) | 可能(別途CLIインストールが必要) | 可能 |
| 通常アプリへ管理資格情報を残さないか | 満たす | 満たせる(徹底すれば) | **満たせる**(`scripts/`配下に隔離) | 満たせる | 満たせるが最も慎重な分離が必要 |
| 失敗後の再開のしやすさ | 悪い(手動) | 中 | **良い**(`import_batches`の状態を見て再開可能な設計にできる) | 中 | 中(バッチ単位) |
| 件数・ハッシュの照合のしやすさ | 悪い(手動SQL) | 中(手動クエリ) | **良い**(既存の`buildManifest`/`computePayloadHash`をそのまま再利用) | 悪い(別途クエリ必要) | 中(投入後に別途SELECT) |
| 実装・本人操作の負担 | **非常に高い**(非現実的) | 中(psqlインストール・コマンド作成) | **中**(実装はClaude Codeが行える。本人操作は資格情報受け渡しのみ) | 中〜高(CLI導入が別途必要) | 中(`service_role`取扱いの心理的負担が大きい) |

### 第一推奨: 方式3(一時的な管理用インポートスクリプト、直接Postgres接続)

理由:
1. 既存のテスト済み・監査済みロジック(`migration-transform.ts`の`buildManifest`/`computePayloadHash`/`validateWorldPlayerCard`等)をそのまま再利用でき、実装の一貫性・検証済み度が最も高い。
2. トランザクション制御・バッチ分割・エラー時ロールバック・件数/ハッシュ照合をすべて自動化でき、方式1(手動投入)のような非現実的な人手作業を避けられる。
3. `service_role`キー(方式5、RLSを完全バイパスする最強権限)ではなく、**用途を限定した直接Postgres接続情報**を使うことで、資格情報の影響範囲をより明示的に管理できる。
4. 資格情報を環境変数経由でのみ受け取り、コード・ログ・Gitのいずれにも残さない実装にできる(このプロジェクトの既存コードスタイルと一貫性がある)。
5. Windows環境で追加のインストール(psql・Supabase CLI等)なしに、既存のNode.js環境で実行できる。

次点: 方式2(psql)も安全性は高いが、psqlの別途インストールという環境構築負担、および件数・ハッシュ照合の自動化のしづらさで方式3に劣る。

**本人の資格情報入力・接続が必要になる直前で停止する。** 実装(投入スクリプト本体)はここから着手可能だが、実行には上杉さん本人がSupabase Dashboardから取得した直接Postgres接続情報が必要になり、この受け渡し方法(チャットに貼り付けない、ローカルのGit非追跡ファイル経由で渡す等)を含め、次のステップとして1操作ずつ案内する。
