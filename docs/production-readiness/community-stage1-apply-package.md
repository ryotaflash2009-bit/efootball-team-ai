# コミュニティ 第 1 段階 — 適用と運営の手順（2026-10-14）

対象: F-053 公開 ID・F-054 公開範囲・F-055 友達・F-056 ブロック・ミュート・通報・F-062 友達との比較。
本人の判断（2026-10-14）: 「全部まとめて完全自動で進めて」（推奨のまま: 13 歳未満は保護者の同意・通報の保持は解決から 1 年・
確認は 48 時間を目安として書く・生命や犯罪のおそれがある場合に関係機関へ提供する可能性を書く）。

## 1. 適用（Supabase の SQL Editor・1 回）

1. 事前の確認（読み取りだけ）: `public_profiles`・`user_blocks`・`friendships` が無いこと（2026-10-14 の確認: すべて NULL・利用者 2 人）。
2. 次の 2 つを、この順でつないだもの（CRLF を LF にしたもの）を 1 回で実行する。SHA-256 は
   `4fa92583422bf242bcb0d23e120073597fd4b0a7ece7dcf23d662a1e16ac419c`（37,251 文字・末尾の改行を含む）。
   - `docs/production-readiness/sql/create-public-profiles-schema.sql`
   - `docs/production-readiness/sql/create-community-stage1-schema.sql`
3. `docs/production-readiness/sql/verify-community-stage1.sql` を実行し、5 つの列がすべて `true`・`community_function_count = 28` を確かめる。
4. `src/lib/supabase/community-mode.ts` の `COMMUNITY_MODE` を `"enabled"` にする PR を出す（それまで画面は準備中の案内だけ）。

戻すとき: `rollback-community-stage1-schema.sql`（コミュニティの表・関数を消す・公開 ID は残す）→ 必要なら `rollback-public-profiles-schema.sql`。
先に `COMMUNITY_MODE` を `"disabled"` に戻す。

**2026-10-14 適用済み**: 事前の確認 → 実行（Success）→ 確認 SQL がすべて true・関数 28 個（`evidence/community-stage1-apply-2026-10-14.json`）→ `COMMUNITY_MODE = "enabled"`。

## 2. 通報の確認（運営者・SQL Editor）

- 一覧（未解決・子どもの安全を先頭）: `select * from public.community_report_queue;`
- 確認中にする: `select public.community_moderate_report(<id>, 'reviewing', null);`
- 対応して相手を制限（非公開・他人から見えない・申請できない）: `select public.community_moderate_report(<id>, 'actioned', '<理由のメモ>', true);`
- 対応なしで終える: `select public.community_moderate_report(<id>, 'dismissed', '<理由のメモ>');`
- 制限を外す: `select public.community_lift_restriction('<公開 ID>');`
- 目安: 48 時間以内に確認（保証ではない）。`minor_safety` と、生命・身体の危険・犯罪の予告は最優先。必要なら警察等へ連絡する。
- 通報した人の ID は相手へ出さない（関数も画面も返さない）。

## 3. 保持期間（月に 1 回）

`select public.community_purge_old_reports();` — 解決（対応済み・対応なし・取り下げ）から 1 年を過ぎた通報を消す。
1 日の上限の記録（`community_rate_events`）は各操作のときに 2 日より前の分が自動で消える。

## 4. 検証の記録

- 使い捨ての PostgreSQL（`src/lib/community/community-stage1.postgres.test.ts`・12 件）: 公開範囲 4 種・anon と表への直接の
  アクセスの拒否・申請 / 承認 / 拒否 / 取り消し / 解除・相互の申請は承認・ブロックで関係が消え相手から存在しないのと同じ・
  ミュート・通報の重複 / 自分 / 上限・運営者の制限と解除・保持期間・退会での削除・戻しと再適用。
- black-box（`scripts/black-box-community.mjs`・テストダブル・34/34）。

## 5. 第 2 段階（ライバル・F-062・2026-10-15・未適用）

1. `docs/production-readiness/sql/create-community-stage2-rivals.sql` を実行する（LF・SHA-256 `22c21b3382b7b50c3dc047ec0dfa0382042f7a1f9e748b33c835b9daaa3bb33a`・第 1 段階の後）。
2. `verify-community-stage2.sql` を実行し、4 つの列がすべて `true`・`community_function_count = 35` を確かめる。
3. `src/lib/supabase/community-mode.ts` の `RIVALS_MODE` を `"enabled"` にする PR を出す（それまでライバルの欄・ボタンは本番に出ない）。

戻すとき: `RIVALS_MODE = "disabled"` → `rollback-community-stage2-rivals.sql`（第 1 段階を戻す前に必ずこちらを先に戻す）。
2026-10-15: Claude Code による本番への適用は自動の安全確認で止められたため、本人の実行を待つ。
