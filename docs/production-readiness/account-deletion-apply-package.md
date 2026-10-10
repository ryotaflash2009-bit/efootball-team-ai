# アカウントの削除: Production apply package（2026-10-11・未適用）

利用者自身によるアカウントの削除を Production で有効にするための一式。**Claude Code は Production に適用していない。**
コードは `ACCOUNT_DELETION_MODE = "disabled"`（`src/lib/account/account-deletion.ts`）で、画面（`/account/delete`）は手動の削除の案内だけを出す。

## 0. 暫定の運用（削除の機能を有効にするまで）

- 利用者への案内: アカウントの画面とアカウントの削除の画面に「アカウントの削除は運営への連絡で受け付けています」（12 言語）。
  サポートのページ（`/support`）の窓口から依頼を受ける。この暫定の運用は、§5 の検証の後に `ACCOUNT_DELETION_MODE = "enabled"` にした時点で終える
  （画面の案内は自動で実行の欄に変わる）。
- 運営者の手動の削除の手順（本人）:
  1. 依頼の受付: 依頼のメールの差出人と、削除するアカウントのログインのメールが一致するか確認（一致しなければ、そのアカウントで
     ログインしたまま `/support` から送ってもらう）。メールの本文に他人の情報があれば扱わない。
  2. Supabase Dashboard → Authentication → Users → 該当のメールで検索 → ユーザーを開く（user ID をメモ。チャット・Git に貼らない）。
  3. （§2 の関数を適用した後なら）手動の削除も同じ処理にそろえる: SQL Editor で
     `select set_config('request.jwt.claim.sub', '<user ID>', true), set_config('request.jwt.claims', json_build_object('sub', '<user ID>', 'amr', json_build_array(json_build_object('method','manual','timestamp', extract(epoch from now())::bigint)))::text, true); select public.delete_my_account('DELETE');`
     を **1 つのトランザクション**（`begin; … commit;`）で実行。関数の適用の前なら、Users の画面の「Delete user」（`my_team_snapshots`・
     `rls_probe_records` は外部キーの cascade で消える）。
  4. 依頼者へ完了を返信（削除したもの・削除されないもの（§1.2）を添える）。依頼のメールは返信の後に削除。
- 期限: プライバシーポリシーに期限の記載は無い（「運営者が手動で対応」）。目安は 30 日以内。期限を書き加える場合は、ポリシーと一致させる。

## 1. 利用者に結びつくデータの棚卸し（2026-10-11）

### 1.1 Production（Supabase）

| 場所 | 状態 | 所有者の列 | 削除 | 備考 |
|---|---|---|---|---|
| `auth.users` | 適用済み（Supabase） | `id` | 関数の最後に削除 | `auth.identities`・`auth.sessions`・`auth.refresh_tokens`・`auth.mfa_*` は Supabase の外部キーの cascade |
| `public.my_team_snapshots` | 適用済み | `user_id`（`auth.users` を cascade で参照） | 関数で件数を数えて削除 | My Team のクラウドの保存 |
| `public.rls_probe_records` | 適用済み | `user_id`（cascade） | 同上 | RLS の検証用（短い文字列だけ） |
| `public.public_profiles`・`public_id_history`・`user_blocks` | **提案・未適用** | `user_id`・`blocker_id`/`blocked_id` | 表があれば関数が削除（`to_regclass`） | 公開プロフィール（F-053） |
| `public.photo_posts`・`photo_post_audit` | **提案・未適用** | `user_id`（監査は外部キーなし） | 表があれば関数が削除。監査も本人の分を消す | 写真付き投稿（F-084） |
| Storage（写真の画像） | **提案・未適用**（バケットなし） | パスの先頭が user ID | SQL では消さない（Supabase は `storage.objects` の直接の削除を禁止）。導入時に、画面が関数の前に Storage API で本人のフォルダを消す手順を追加する | 今は対象なし |
| 参照データ（`reference_data.*`） | 適用済み | なし（利用者のデータではない） | 対象外 | — |
| 参照データのバックアップ（R2） | 運用中 | なし | 対象外 | 利用者の表は禁止リスト（`backup-target.ts`）で含まない |
| Supabase のプラットフォームのバックアップ | Supabase の仕様 | — | 消せない（保持期間の後に消える） | 削除されないものとして案内（§1.2） |

### 1.2 Production の外

| 場所 | 扱い |
|---|---|
| 端末の localStorage（ゲスト・アカウントの領域・アカウント分離前の共通データ） | サーバーには無い。削除の画面で「この端末のこのアカウントのデータも消す」（既定でオン）。ゲストと共通データは残す（「データ管理」で消せる） |
| 診断の履歴・比較・お気に入り・My Builds・スカッド・テンプレート | すべて端末の中だけ（サーバーの表は無い） |
| 共有の URL（`/share/…`） | URL の中にデータを含める方式（サーバーに保存しない）。削除の対象なし。共有した URL を知っている人は見られる（案内の対象外・各自の管理） |
| JSON のエクスポート・インポート | 端末のファイル。サーバーなし |
| Vercel Analytics | user ID・メールを送らない（`sanitize-analytics-event.ts`）。結びつく情報なし |
| レート制限（`/api/build-intent/extract` 等） | プロセスの中のメモリだけ（IP ごと・一時）。永続化なし |
| サーバーのログ（Vercel・Supabase） | 各社の保持期間の後に消える（削除の画面で案内） |
| サポートのメール | 運営者のメールボックス。削除の完了の返信の後に削除（§0） |
| 将来の課金（Stripe） | 未導入。`billing-auth-boundary.md`。関数は `public.billing_subscriptions` があれば有効な契約で拒否する |

### 1.3 監査の記録（`public.account_deletion_audit`）

- 保存: `subject_hash`（`sha256('efta-account-deletion:v1:' || user_id)` の 16 進）・削除の時刻・表ごとの件数・provider の種類（`google` / `email`）。
- 保存しない: メールアドレス・名前・user ID の平文・IP・User-Agent。
- 用途: サポートで「この user ID のアカウントは削除済みか」を確かめる（user ID が分かる人だけが照合できる）。
- 保持: 1 年（本人が年 1 回 `delete from public.account_deletion_audit where deleted_at < now() - interval '1 year'` を実行。将来の課金の会計の記録とは分けて管理する）。
- 利用者からは読めない（RLS 有効・ポリシーなし・`anon`/`authenticated` の権限なし）。

## 2. 方式の判断

| 案 | 判断 |
|---|---|
| **DB の関数（`SECURITY DEFINER`）** | **採用**。service role をどこにも置かない。対象は `auth.uid()` だけ。1 つのトランザクション。Supabase の SQL Editor で適用でき、既存の使い捨て PostgreSQL のテストで検証できる |
| Edge Function（service role で Admin API の `deleteUser`） | 不採用（今は）。service role の Secret を Edge Function に置く必要がある。Storage の削除が必要になったとき（写真付き投稿の導入時）に再検討 |
| Next.js の API route（service role） | 不採用。Vercel に service role を置かない方針（`security-checklist.md`） |

再認証: Supabase の access token の `amr`（認証の方法と時刻）の最新が 10 分以内であることを関数が確かめる（クライアントの申告に依存しない）。
Google のユーザーは Google の画面でもう一度ログイン（`prompt=select_account`）、メールのユーザーはパスワード。古いセッションのままでは削除できない。
**要確認（§4-1）**: Production の access token に `amr` が含まれること（Supabase の標準。Dry run で自分の token を確かめる）。

その他:
- CSRF: 関数は `Authorization: Bearer <access token>` で呼ばれる（Cookie の自動送信ではない）＋確認の文字列。外部のサイトからは呼べない。
- 再送・二重の実行・タイムアウト: 関数は冪等（既に削除済みなら `alreadyDeleted: true` で成功）。画面は二重の押下を止め、20 秒で「結果が不明・再試行して安全」と案内。
- 中間の状態: 1 つのトランザクションなので、途中で失敗すれば何も消えない（テスト: 監査の挿入で失敗させても本人の行と `auth.users` は残る）。
- セッション: `auth.users` の削除で sessions・refresh tokens が消える（すべての端末でリフレッシュ不能）。発行済みの access token は期限（既定 1 時間）まで
  署名としては有効だが、本人の行は消えているため読めるデータは無い。画面は自分の端末の Cookie を `signOut({ scope: "local" })` で消す。
- 再登録: 同じ Google アカウントで再びログインすると新しい user（新しい ID）。以前のデータは戻らない（画面で案内）。
- 他人の削除: 関数は対象を引数で受け取らない。`authenticated` だけが実行できる（テスト: B の行は残る・anon は実行不可）。

## 3. 適用の順と依存関係

1. 前提: `public.my_team_snapshots`・`public.rls_probe_records` が存在（適用済み）。拡張は不要（`sha256` は PostgreSQL 11 以降の標準）。
2. Backup（§4-2）。
3. 適用: `docs/production-readiness/sql/create-account-deletion.sql`（表 → RLS → 権限 → 関数 → 実行の権限）。
4. 検証: `verify-account-deletion.sql`（読み取りだけ）→ §5 のテスト用のアカウントでの確認。
5. コード: `ACCOUNT_DELETION_MODE = "enabled"` の PR → CI → マージ。
6. 暫定の運用（§0）を終える。

## 4. Dry run・Backup

1. **amr の確認**: Production の SQL Editor は `postgres` の権限で動き、利用者の JWT を持たないため、`auth.jwt()` で amr を直接は確かめられない。
   §5-2 の「ログインから 10 分以上たった状態では拒否される」「再ログインの直後は成功する」の 2 つが、そのまま amr の扱いの検証になる。
   拒否されない（古いセッションで消せる）場合は §7 の停止の条件。
2. **Backup**: Supabase Dashboard → Database → Backups で最新のバックアップの時刻を確認（Free プランは自動バックアップが無いため、
   SQL Editor で `select count(*) from public.my_team_snapshots; select count(*) from public.rls_probe_records; select count(*) from auth.users;`
   の件数だけを控える。データの複製は作らない＝個人情報を増やさない）。この関数は既存の表を変えない（新しい表と関数を足すだけ）。
3. **Dry run（使い捨ての PostgreSQL）**: CI の `Reference data PostgreSQL validation` で `account-deletion.postgres.test.ts`（8 件）が通っていること。
4. **SQL の差分の確認**: 適用する SQL がこのリポジトリの main の `create-account-deletion.sql` と一字一句同じこと。

## 5. 適用の後の検証

1. `verify-account-deletion.sql` の結果:
   - 関数: `security_definer = true`・`config = {search_path=""}`・所有者が `postgres`。
   - 実行の権限: `authenticated = true`・`anon = false`。
   - 監査の表: `rls_enabled = true`・`policy_count = 0`・`anon_select = false`・`authenticated_select = false`。
   - 外部キー: `my_team_snapshots`・`rls_probe_records` が `CASCADE`。
2. テスト用のアカウント A・B（本人が作る。実在の利用者は使わない）:
   - A でログイン → My Team をクラウドに 1 件保存 → B でも 1 件保存。
   - A でログインしてから 10 分以上たった状態で削除 → 「もう一度ログイン」の表示（`reauthentication_required`）・何も消えない。
   - A で再ログイン → 削除 → 完了の表示・ログアウト。Users の画面で A が無い・B は残る。B の My Team が読める。
   - 監査の表に 1 行・メール・user ID の平文が無い（`select subject_hash, deleted_counts, providers from public.account_deletion_audit order by id desc limit 1`）。
   - 同じ Google アカウントで再ログイン → 新しい空のアカウント（My Team のクラウドは空）。
3. 本人の操作の後に Claude Code が自動で行える検証（読み取りだけ）: Production の画面の black-box（`/account/delete` が実行の欄を出す・
   未ログインでは出さない）・`verify-account-deletion.sql` の結果の照合（本人が結果を貼る）。

## 6. Rollback

- 関数を止める: `rollback-account-deletion.sql`（関数を削除。監査の表は残す）。画面は `ACCOUNT_DELETION_MODE = "disabled"` の PR で手動の案内に戻す。
- 監査の表まで消すのは、1 件も削除していないときだけ（`select count(*) from public.account_deletion_audit` が 0）。
- 削除したアカウントは戻せない（Supabase のプラットフォームのバックアップからの復元は、全体を巻き戻すため行わない）。

## 7. 停止の条件

- `verify-account-deletion.sql` のどれかが期待と違う（特に `anon = true`・`security_definer = false`・`policy_count > 0`）→ Rollback。
- テスト用のアカウントの削除で B の行が減った・`auth.users` の件数が 2 以上減った → 直ちに Rollback（他人のデータの削除）。
- `reauthentication_required` が出ない（古いセッションで消せた）→ Rollback して amr の扱いを調べる。
- 監査の表にメール・user ID の平文が入った → Rollback。
- 関数の適用で既存の表・ポリシーが変わった（差分に `alter table my_team_snapshots` 等が出た）→ 適用しない。

## 8. セキュリティの確認（テストで確かめた点）

| 観点 | 確認 |
|---|---|
| 他人を削除できない | 引数で対象を受け取らない・B の行は残る（`account-deletion.postgres.test.ts`） |
| 未ログイン | anon は実行の権限なし（permission denied） |
| 古いセッション | amr が 10 分より古い・無い → 拒否・何も消えない |
| 確認の文字列 | `DELETE` 以外 → 拒否 |
| 部分的な削除 | 途中の失敗で何も消えない |
| 冪等 | 2 回目は `alreadyDeleted`・監査は増えない |
| 監査の個人情報 | ハッシュだけ・user ID の平文なし |
| 関数の乗っ取り | `SECURITY DEFINER`・`search_path` を空・すべて修飾した名前 |
| 課金 | 有効な契約があれば拒否 |
| service role | 使わない（ブラウザー・Vercel・Edge Function のどこにも置かない） |

## 9. 本人が行う操作（まとめ）

| いつ | 操作 |
|---|---|
| 今（暫定の運用） | 削除の依頼が来たら §0 の手順 |
| 有効にするとき | §4-2 の件数の控え → SQL Editor で `create-account-deletion.sql` を貼り付けて実行 → `verify-account-deletion.sql` を実行して結果を Claude Code に渡す → §5-2 のテスト用のアカウントでの確認 → 合格なら Claude Code に有効化の PR を依頼 |
| 年 1 回 | 監査の表の 1 年より古い行の削除 |
