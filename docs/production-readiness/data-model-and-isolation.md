# データモデル設計とユーザー別データ分離方針

調査日: 2026-09-11。**概念設計のみ。SQL・マイグレーションは一切実行していない。** 想定DBはSupabase PostgreSQL(`decision-record.md`の第一推奨構成に基づく)。

## 1. テーブル一覧(概念設計)

各テーブルについて、主キー・`user_id`・公開/非公開フィールド・外部キー・一意制約・更新日時・削除方式・バックアップ方針・RLS方針・他ユーザーからのアクセス可否を整理する。

### `users`(認証サービス側が管理。Supabase Authの`auth.users`を想定)

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID、Supabase Auth発行) |
| 公開可能フィールド | なし(このテーブル自体を他ユーザーへ見せない) |
| 非公開フィールド | メールアドレス、パスワードハッシュ(Supabase Auth管理下、アプリコードは直接触らない) |
| 削除方式 | アカウント削除時に認証サービス側のAPIで削除(カスケードで下記全テーブルの関連行も削除、または匿名化) |
| RLS方針 | Supabase Auth管理領域のため、アプリ側テーブルとは別スキーマ(`auth`スキーマ)。アプリ側から直接クエリしない。 |
| 他ユーザーアクセス | 不可 |

### `public_profiles`(公開ユーザーIDと表示名。将来のフレンド機能等で他ユーザーに見せる部分だけを分離)

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | `users.id`への外部キー、一意制約あり(1ユーザー1プロフィール) |
| 公開可能フィールド | `public_user_id`(公開用の短いランダムID。メール・内部UUIDとは別に生成)、`display_name`(表示名) |
| 非公開フィールド | なし(このテーブル自体が「公開してよい情報だけ」を保持する設計) |
| 一意制約 | `public_user_id`に一意制約 |
| 更新日時 | `updated_at` |
| 削除方式 | アカウント削除に連動して削除、または`display_name`を匿名化(将来のフレンド機能でのデータ整合性次第で判断) |
| RLS方針 | 誰でも`SELECT`可(公開情報のため)。`UPDATE`/`DELETE`は本人の`user_id`と一致する行のみ許可。 |
| 他ユーザーアクセス | 読み取りのみ可(公開プロフィールとして機能させる場合) |

### `favorites`

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | `users.id`への外部キー(必須) |
| 公開可能フィールド | なし(本人専用データ) |
| 非公開フィールド | `world_card_id` |
| 一意制約 | `(user_id, world_card_id)`に複合一意制約(同じ選手を二重登録しない) |
| 更新日時 | `created_at` |
| 削除方式 | 物理削除(お気に入り解除は単純な行削除でよい) |
| RLS方針 | `user_id = auth.uid()`の行のみ`SELECT`/`INSERT`/`DELETE`可 |
| 他ユーザーアクセス | 不可 |

### `my_team_cards`

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | 外部キー(必須) |
| 公開可能フィールド | なし |
| 非公開フィールド | `world_card_id`、`ownership_status`、`usage_status`、`selected_build_id`(→`saved_builds.id`参照)、`note`、`tags` |
| 外部キー | `selected_build_id` → `saved_builds.id`(nullable) |
| 一意制約 | `(user_id, world_card_id)` |
| 更新日時 | `created_at`, `updated_at` |
| 削除方式 | 論理削除(`deleted_at`)を検討。既存localStorage実装が`deletedAt`フィールドを持つ設計(`my-team-storage.ts`)と一致させる。 |
| RLS方針 | `user_id = auth.uid()`の行のみ全操作可 |
| 他ユーザーアクセス | 不可 |

### `saved_builds`

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID、既存の`buildId`文字列から移行) |
| `user_id` | 外部キー(必須) |
| 公開可能フィールド | なし |
| 非公開フィールド | `world_card_id`、`build_name`、`progression_allocation`(`jsonb`)、`selected_player_booster`、`conditional_booster_selections`(`jsonb`)、`calculated_stats`(`jsonb`)、`calculated_ovr`、`calculation_mode`、`rules_version`、`schema_version` |
| 外部キー | `world_card_id`は参照データ(SQLite側)のIDと対応するが、**別DBのため外部キー制約は張れない**(アプリケーションコード側で存在確認を行う設計にする) |
| 一意制約 | なし(同一カードで複数ビルドを許容する既存仕様のまま) |
| 更新日時 | `created_at`, `updated_at` |
| 削除方式 | 物理削除(既存仕様通り) |
| RLS方針 | `user_id = auth.uid()`の行のみ全操作可 |
| 他ユーザーアクセス | 不可 |

### `saved_build_intents`

| 項目 | 内容 |
|---|---|
| 主キー | `build_id`と1対1(`saved_builds.id`をそのまま主キー兼外部キーにする、または独立UUID+一意外部キー) |
| `user_id` | 外部キー(冗長だがRLSの単純化のため保持を推奨) |
| 公開可能フィールド | なし |
| 非公開フィールド | 既存`SavedBuildIntent`の全フィールド(`intentSchemaVersion`, `mainPresetId`, `subPresetIds`, `primaryGoal`, `intendedPositions`, `groupPriorities`, `avoidOverinvestmentGroups`, `intentionallyIgnoredGroups`, `strengthsToPreserve`, `comparisonTargetBuildId`, `comparisonFocusGroups`, `source`, `userModified`, `updatedAt`) |
| 外部キー | `build_id` → `saved_builds.id`(削除時カスケード) |
| RLS方針 | `user_id = auth.uid()`の行のみ全操作可 |
| 他ユーザーアクセス | 不可 |

### `saved_squads`

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | 外部キー(必須) |
| 公開可能フィールド | なし(既定は非公開。将来「スカッドを公開して共有」機能を作る場合のみ`is_public`フラグを追加検討) |
| 非公開フィールド | `squad_name`、`formation_id`、`has_custom_positioning`等のメタデータ |
| 更新日時 | `created_at`, `updated_at` |
| 削除方式 | 物理削除 |
| RLS方針 | `user_id = auth.uid()`の行のみ全操作可 |
| 他ユーザーアクセス | 不可(将来の共有機能実装時に個別設計) |

### `squad_members`(保存スカッドの中身。配置・使用ビルド参照)

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | 冗長列として保持(RLS単純化) |
| 外部キー | `squad_id` → `saved_squads.id`(カスケード削除)、`build_id` → `saved_builds.id`(nullable。ビルド削除時は`SET NULL`) |
| 非公開フィールド | `slot_id`、`world_card_id`、`role_override`、座標情報等 |
| 一意制約 | `(squad_id, slot_id)` |
| RLS方針 | `user_id = auth.uid()`の行のみ全操作可 |
| 他ユーザーアクセス | 不可 |

### `squad_templates`

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | 外部キー(必須) |
| 非公開フィールド | 複製元の保存スカッド構造一式(`jsonb`、または`saved_squads`と同様の正規化構造) |
| RLS方針 | `user_id = auth.uid()`の行のみ全操作可 |
| 他ユーザーアクセス | 不可 |

### `data_migrations`(localStorage→クラウド移行の実行履歴)

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | 外部キー(必須) |
| 非公開フィールド | `data_type`(favorites/my_team/saved_builds/saved_squads/squad_templates)、`attempted_count`、`succeeded_count`、`skipped_count`、`failed_count`、`started_at`、`completed_at` |
| RLS方針 | `user_id = auth.uid()`の行のみ`SELECT`可(自分の移行履歴だけ確認できる) |
| 他ユーザーアクセス | 不可 |
| 用途 | 移行の再試行判定・監査(いつ何件移行したか) |

### `user_exports`(データエクスポート要求の記録)

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | 外部キー(必須) |
| 非公開フィールド | `requested_at`、`completed_at`、`export_format`(json等)、`status` |
| RLS方針 | `user_id = auth.uid()`の行のみ`SELECT`/`INSERT`可 |
| 他ユーザーアクセス | 不可 |
| 用途 | 「データエクスポート」操作の監査・二重リクエスト防止 |

### `account_deletion_requests`

| 項目 | 内容 |
|---|---|
| 主キー | `id`(UUID) |
| `user_id` | 外部キー(必須) |
| 非公開フィールド | `requested_at`、`scheduled_deletion_at`(猶予期間を設ける場合)、`status`(pending/completed/cancelled) |
| RLS方針 | `user_id = auth.uid()`の行のみ`SELECT`/`INSERT`/`UPDATE`(取消のみ)可。実際の削除処理は管理者権限(サーバー側)で実行。 |
| 他ユーザーアクセス | 不可 |
| 用途 | 即時削除ではなく猶予期間を設ける場合の予約管理(誤操作からの復旧余地を残す設計オプション) |

### `subscription_state`(将来のPro課金用。**今回は設計のみ、実装しない**)

| 項目 | 内容 |
|---|---|
| 主キー | `user_id`(1対1) |
| 非公開フィールド | `plan`(free/pro)、`status`(active/canceled/past_due等)、`current_period_end`、`payment_provider_customer_id`(決済サービス側のID。**カード番号等の決済情報そのものは一切保存しない**) |
| RLS方針 | `user_id = auth.uid()`の行のみ`SELECT`可。`INSERT`/`UPDATE`はサーバー側(決済Webhook経由)のみ、クライアントからの直接書き込みは禁止。 |
| 他ユーザーアクセス | 不可 |
| 用途 | 将来の課金導入時に、どのプランかをアプリが判定するための最小限のフラグ。決済情報そのものは決済サービス(Stripe等)側に留め、このテーブルには持ち込まない。 |

## 2. ユーザー別データ分離の原則

| 原則 | 設計 |
|---|---|
| クライアントから`user_id`を信用しない | すべてのAPIルート・RLSポリシーは、リクエストボディやクエリパラメータの`user_id`を**一切参照しない**。 |
| 認証済みセッションから`user_id`を決定 | Supabase Authのセッション(JWT)から`auth.uid()`(RLS内)またはサーバー側で検証済みのユーザーIDのみを使用する。 |
| 他ユーザーのIDを指定して取得できない(IDOR対策) | 上記2点の組み合わせにより、URLやリクエストボディに他人の`user_id`を指定しても、RLSが該当行を返さないため実質的に不可能になる。 |
| RLSまたはサーバー側認可 | **RLSを第一防衛線とし、APIルート側でも`user_id`の二重チェックを行う(多層防御)**。RLSの設定ミス一つで全データが露出する事態を避けるため、片方だけに依存しない。 |
| 管理者権限の分離 | 管理者用の操作(不具合調査・権利者対応等)は、通常ユーザーのRLSをバイパスする専用のサーバー側ロール(Service Role Key)を使うが、**このキーはクライアントへ絶対に露出しない**(サーバー環境変数のみ、`security-checklist.md`参照)。 |
| 公開プロフィールと非公開データの分離 | `public_profiles`テーブルを独立させ、他の全テーブルとは異なるRLS(誰でも`SELECT`可)を適用する。非公開データテーブルには公開プロフィールと同じ緩いポリシーを**絶対に適用しない**。 |
| メールアドレス非公開 | メールアドレスは`auth.users`(Supabase Auth管理領域)にのみ存在し、アプリ側の公開画面が参照するテーブル(`public_profiles`等)には**そもそもカラムとして持たせない**。 |
| 削除済みアカウント | 論理削除(`deleted_at`)を基本とし、一定の猶予期間後に物理削除するバッチ処理を想定(`account_deletion_requests`参照)。 |
| 退会処理 | ユーザー自身が`account_deletion_requests`へ予約 → 猶予期間 → 自動物理削除、というワンクッションを設けることで誤操作からの復旧余地を残す(即時削除も選択肢としてはあるが、初期版は猶予期間ありを推奨)。 |
| 監査可能性 | `data_migrations`・`user_exports`・`account_deletion_requests`のような「操作記録テーブル」を用意し、後から「いつ何が起きたか」を追えるようにする。 |
| レート制限 | APIルート単位でのレート制限(認証試行・移行処理の連打等)を、認証サービス標準機能(ログイン試行制限)+ 自前の簡易スロットリング(既存の`/api/build-intent/extract`が既に実装しているプロセス内メモリのベストエフォート方式を参考にできる)の組み合わせで実現する。 |

## 3. 未確定事項

- `public_profiles`をベータ初期段階から作るか、フレンド機能実装時まで先送りするかは実装ロードマップ側で判断する(`implementation-roadmap.md`)。
- 論理削除と物理削除の猶予期間の具体的な日数は未確定(個人開発の運用負担と利用者保護のバランスで後日決定)。
