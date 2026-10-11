# 保存ビルドのクラウド保存: Production apply package（2026-10-11・未適用）

保存ビルド（My Builds）を利用者が手動でクラウドに保存し、別の端末で足りないビルドだけを追加して戻す機能（F-052 クラウド同期の第 2 段階）。
**Claude Code は Production に適用していない。** コードは `BUILDS_CLOUD_MODE = "disabled"`（`src/lib/supabase/builds-cloud-mode.ts`）で、
画面（`/account/builds-cloud`・アカウントの画面から入る）は準備中の案内だけを出し、Supabase を呼ばない。

## 1. 何が入るか

| 項目 | 内容 |
|---|---|
| 表 | `public.saved_builds_snapshots`（1 ユーザー 1 行・`unique(user_id)`・`user_id` の既定値は `auth.uid()`・`auth.users` を on delete cascade で参照） |
| RLS | authenticated だけ・select / insert / update / delete とも `user_id = (select auth.uid())`。anon・public は権限なし |
| 制約 | 件数 0〜2000・`builds_data` 1MB 以下・ハッシュの形・`items` が配列で件数と一致・`user_id` の書き換えはトリガーで拒否 |
| 中身 | 保存ビルドそのもの（ビルド名・配分・ブースターの選択・計算結果・規則の版）。メールアドレス・トークン・端末の情報は入れない |
| アカウントの削除 | `auth.users` の削除で cascade（関数 `delete_my_account` の件数の集計には含まれない。必要なら次の版で追加） |

SQL: `docs/production-readiness/sql/create-builds-cloud-schema.sql`（冪等）・ロールバック `rollback-builds-cloud-schema.sql`。
CI: `src/lib/account/builds-cloud-rls.postgres.test.ts`（PostgreSQL 16・A/B の分離・anon・制約・冪等・ロールバック）。

## 2. 適用の手順（本人の承認の後）

1. Supabase Dashboard → SQL Editor（プロジェクト `kbauokzninaervjgwzdd` = TeamAIXI であることを確認）。
2. `create-builds-cloud-schema.sql` の全文を貼って Run。エラーが無いこと。
3. 読み取りの確認（SQL Editor）:
   - `select count(*) from pg_policies where tablename = 'saved_builds_snapshots';` → 4
   - `select relrowsecurity from pg_class where relname = 'saved_builds_snapshots';` → true
   - `select has_table_privilege('anon', 'public.saved_builds_snapshots', 'select');` → false
   - `select count(*) from public.my_team_snapshots;` が適用の前と同じ（他の表に影響が無い）
4. Claude Code に「適用した」と伝える → Claude Code が `BUILDS_CLOUD_MODE = "enabled"` の PR を作り、本番で A/B の 2 アカウント
   （Android の実機・本人とテスト用のアカウント）で「保存 → 相手から見えない → 足りないビルドの追加 → 削除」を確認してマージ。

## 3. 戻し方

- 画面を止める: `BUILDS_CLOUD_MODE = "disabled"` の PR（データは残る）。
- 表を消す: 画面を止めた後に `rollback-builds-cloud-schema.sql`（クラウドの保存ビルドは消える。端末の保存ビルドは消えない）。

## 4. 確認済みのこと（2026-10-11・Claude Code）

- 単体テスト: ペイロードの検証（壊れた要素・重複・上限・知らない版・プロトタイプ汚染）・ハッシュ・復元の計画・アクセス層（user_id を送らない・
  読み戻しと再取得での一致・0 件／複数件を成功にしない）・公開の状態（本番のホストでは開かない）。
- black-box（auth-google のテストダブルの DB）: 既定は準備中・画面を開いただけでは送らない・確認の後に保存・足りないビルドだけ追加（既存は変えない）・
  削除しても端末のビルドは残る・未ログインはログインの案内だけ。
