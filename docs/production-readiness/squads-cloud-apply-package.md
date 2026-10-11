# 保存スカッドのクラウド保存: Production apply package（2026-10-11・**適用済み**）

保存スカッドを利用者が手動でクラウドに保存し、別の端末で足りないスカッドだけを追加して戻す機能（F-052 クラウド同期の第 3 段階）。
**2026-10-11 に Production へ適用済み（§5）。** コードは `SQUADS_CLOUD_MODE = "disabled"`（`src/lib/supabase/squads-cloud-mode.ts`）で、
画面（`/account/squads-cloud`・アカウントの画面から入る）は準備中の案内だけを出し、Supabase を呼ばない。

スカッドが参照するビルドの中身は含まない（`savedBuildId` だけ）。ビルドは「保存ビルドのクラウド保存」（`builds-cloud-apply-package.md`）で一緒に保存する。両方をまとめて適用してよい。

## 1. 何が入るか

| 項目 | 内容 |
|---|---|
| 表 | `public.saved_squads_snapshots`（1 ユーザー 1 行・`unique(user_id)`・`user_id` の既定値は `auth.uid()`・`auth.users` を on delete cascade で参照） |
| RLS | authenticated だけ・select / insert / update / delete とも `user_id = (select auth.uid())`。anon・public は権限なし |
| 制約 | 件数 0〜200（端末の上限は 50）・`squads_data` 1MB 以下・ハッシュの形・`items` が配列で件数と一致・`user_id` の書き換えはトリガーで拒否 |
| 中身 | 保存スカッドそのもの（スカッド名・フォーメーション・配置・控え・監督・キャプテン・セットプレー・選んだビルドの ID）。メールアドレス・トークン・端末の情報は入れない |
| アカウントの削除 | `auth.users` の削除で cascade（関数 `delete_my_account` の件数の集計には含まれない。必要なら次の版で追加） |

SQL: `docs/production-readiness/sql/create-squads-cloud-schema.sql`（冪等）・ロールバック `rollback-squads-cloud-schema.sql`。
CI: `src/lib/account/squads-cloud-rls.postgres.test.ts`（PostgreSQL 16・A/B の分離・anon・制約・冪等・ロールバック）。

## 2. 適用の手順（本人の承認の後）

1. Supabase Dashboard → SQL Editor（プロジェクト `kbauokzninaervjgwzdd` = TeamAIXI であることを確認）。
2. `create-squads-cloud-schema.sql` の全文を貼って Run。エラーが無いこと。
3. 読み取りの確認（SQL Editor）:
   - `select count(*) from pg_policies where tablename = 'saved_squads_snapshots';` → 4
   - `select relrowsecurity from pg_class where relname = 'saved_squads_snapshots';` → true
   - `select has_table_privilege('anon', 'public.saved_squads_snapshots', 'select');` → false
   - `select count(*) from public.my_team_snapshots;` が適用の前と同じ（他の表に影響が無い）
4. Claude Code に「適用した」と伝える → Claude Code が `SQUADS_CLOUD_MODE = "enabled"` の PR を作り、本番で A/B の 2 アカウント
   （Android の実機・本人とテスト用のアカウント）で「保存 → 相手から見えない → 足りないスカッドの追加 → 削除」を確認してマージ。

## 3. 戻し方

- 画面を止める: `SQUADS_CLOUD_MODE = "disabled"` の PR（データは残る）。
- 表を消す: 画面を止めた後に `rollback-squads-cloud-schema.sql`（クラウドの保存スカッドは消える。端末の保存スカッドは消えない）。

## 4. 確認済みのこと（2026-10-11・Claude Code）

- 単体テスト: ペイロードの検証（壊れた要素・重複・上限・知らない版・プロトタイプ汚染）・ハッシュ・復元の計画・アクセス層（user_id を送らない・
  読み戻しと再取得での一致・0 件／複数件を成功にしない）・公開の状態（本番のホストでは開かない）。
- black-box（auth-google のテストダブルの DB）: 既定は準備中・画面を開いただけでは送らない・確認の後に保存・足りないスカッドだけ追加（既存は変えない・上限 50 を超えるなら追加しない）・
  削除しても端末のスカッドは残る・未ログインはログインの案内だけ。

## 5. 適用の記録（2026-10-11）

本人の指示（「君が押して」）で Claude Code が Supabase の SQL Editor（プロジェクト `efootball-team-ai-dev` = ref `kbauokzninaervjgwzdd`・本人の組織）で実行した。
貼り付けた SQL は main のファイルと SHA-256 で一致を確認（改行の違いだけ）。適用の前の件数: `my_team_snapshots` 2・`rls_probe_records` 0・`auth.users` 3。
適用の後の読み取りの確認: 表あり・ポリシー 4・RLS 有効・anon の select なし・既存の件数は変化なし・`auth.users` への外部キーは CASCADE。
コードの公開の状態を `enabled` に変更（同じ日の PR）。
