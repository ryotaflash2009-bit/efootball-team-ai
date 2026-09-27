# ドメイン購入キュー（まとめ買い待ち）

更新: 2026-09-27。本人の判断で、ドメインの購入は**他のプロジェクトのドメインとまとめて行うまで保留**。
このファイルは「買う予定のドメイン」の一覧であり、**どのドメインも確保・予約・購入されていない**。
購入するまでは第三者が先に登録できる。購入の直前に必ず空き状況と価格を確認し直す。

## 1. キュー

| プロジェクト | 第一候補 | 予備（順） | 状態 | 空きの最終確認 | 購入前の再確認 | 用途 |
|---|---|---|---|---|---|---|
| eFootball Team AI | `teamaixi.com` | `xibuild.app` → `xilab.dev` → `teamaixi.app` | `deferred_for_batch_purchase` | 2026-09-27（RDAP 404 = 未登録） | **必要** | Web（`https://<domain>`）と認証メールの送信元（`no-reply@auth.<domain>`） |
| （他のプロジェクト） | 本人が記入 | — | — | — | 必要 | — |

状態の値:
- `deferred_for_batch_purchase`: まとめ買いを待っている（未購入）
- `recheck_needed`: 最終確認から 30 日以上たった（購入前に空き・価格を確認し直す）
- `purchased`: 本人が購入し、Cloudflare の **Domain Registration** に表示された（本人の報告を受けて Claude Code が更新する）

**「reserved」「確保済み」とは書かない**（登録するまで確保されていない）。

## 2. 購入の直前に確認すること（本人・Cloudflare の画面）

1. Cloudflare の **Domain Registration → Register Domains** で第一候補を検索し、**Available** と表示されること。
2. 価格が `email-and-domain-cost-plan.md` の値（`.com` 登録・更新 US$10.46/年）と同じであること。**Premium** 表示や、更新価格が登録価格より高い場合は買わない（予備へ進む）。
3. 第一候補が取れなければ、表の予備を順に確認する。予備も取れなければ止めて Claude Code へ伝える（新しい候補を調べ直す）。
4. 商標の懸念（eFootball / KONAMI を含まない）は既に確認済み。予備を追加する場合は同じ観点で確認する（法的な判断ではない）。

## 3. 購入までに変えないもの（保留中は現状維持）

Supabase Custom SMTP・Site URL・Redirect URLs・確認メールの一般公開、Vercel の独自ドメイン、Cloudflare DNS、Resend の送信ドメイン、SMTP の Secret、
新規登録の公開フラグ（`ACCOUNT_SIGNUP_MODE` / `AUTH_EMAIL_DELIVERY`）、本番のスキーマ・RLS・ロール、参照データ、バックアップ・適用・スケジュールの権限。

公開サイトは `https://efootball-team-ai.vercel.app` のまま、新規登録は「限定テスト中」のまま動き続ける（ログイン・ログアウト・パスワード再設定の画面・ログイン不要の機能は利用可）。

## 4. 購入後の流れ

`custom-domain-and-email-runbook.md` の「ドメイン購入の保留と再開」→ A〜G の順。最後に `npm run validate:auth-email-release` が
`AUTH_EMAIL_RELEASE_READY` になり、本人が承認するまで新規登録は開かない。
