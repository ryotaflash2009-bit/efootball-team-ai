# ドメイン・SMTP・認証の公開: 再開パッケージ（2026-10-07）

本人の操作（購入・契約・Secret の入力・DNS の保存・SMTP の有効化・新規登録の公開）の**直前まで**をまとめた索引。
手順の本文は既存の文書にあり、ここは「どこまで準備済みか」「本人が何をするか」「再開の前に確かめ直すもの」だけを書く。
このパッケージを作る作業では、購入・契約・Secret・DNS・SMTP・新規登録の設定を**何も変えていない**。

| 文書 | 内容 |
|---|---|
| `domain-purchase-queue.md` | ドメインの候補・状態（`deferred_for_batch_purchase`）・購入の直前の確認 |
| `custom-domain-and-email-runbook.md` | 本人の手順 A〜G（Cloudflare・Resend・Vercel・Supabase・配信テスト） |
| `email-and-domain-cost-plan.md` | 費用（ドメイン以外 0 円・Resend Free の枠と安全策） |
| `smtp-plan.md`・`email-templates/`（6 種類 × html/txt・`subjects.json`） | SMTP の方針とテンプレート |
| `auth-deferred-items.md`・`auth-email-release-checklist.json` | 認証の保留の項目と、公開の判定の入力（Secret を含まない） |
| `scripts/validate-auth-email-release.mjs`（`npm run validate:auth-email-release`） | 公開の判定（READY でなければ公開しない） |

## 1. ドメイン

| 項目 | 状態 | 再開の前に |
|---|---|---|
| 候補 | 第一 `teamaixi.com`、予備 `xibuild.app` → `xilab.dev` → `teamaixi.app` | — |
| 空きの再確認 | 最後の確認 2026-09-27（RDAP 404）。**購入の直前に必ず確認し直す**（`domain-purchase-queue.md` §2） | 本人が Cloudflare の画面で確認（Claude Code は今回外部へ問い合わせていない） |
| 費用の再確認 | 見込み US$10.46/年（2026-09-27）。Premium・更新価格が登録より高い場合は止める | 本人が購入画面で確認 |
| Registrar | Cloudflare Registrar（原価・WHOIS 非公開・DNSSEC・DNS 無料） | — |
| DNS のレコード | Resend の SPF・DKIM（`auth.<domain>`）・DMARC、Vercel の A / CNAME（runbook B・D） | 本人が保存（Claude Code は保存しない） |
| Vercel の対応 | runbook D。既存の `efootball-team-ai.vercel.app` は**そのまま開く**（現在の URL との互換） | — |
| SSL | Vercel の自動 SSL（無料） | 鍵マークの確認（runbook D の完了条件） |
| DNSSEC | Cloudflare で有効（runbook A の完了条件） | — |
| 更新・自動更新 | Cloudflare の自動更新を有効のまま（費用は年 1 回）。期限の 30 日前に本人へ案内 | 本人が支払い方法を確認 |
| 戻し方 | Vercel のドメインを外せば `*.vercel.app` だけに戻る（データは変わらない）。Supabase の Site URL・redirect の allowlist は元の値へ戻す | — |
| 現在の URL との互換 | 共有 URL（`sd1`）は相対の path と query だけで、ドメインを含まない。旧 URL からも開ける | 変更の後に black-box で両方の URL を確認 |

## 2. カスタム SMTP

| 項目 | 状態 | 再開の前に |
|---|---|---|
| 送信ドメイン | `auth.<domain>`（送信専用のサブドメイン・受信の MX は作らない） | ドメインの購入の後 |
| SPF / DKIM / DMARC | Resend の指示どおり（runbook B）。SPF は 1 本だけ。DMARC は `p=none` から始め、配信が安定してから強める | 本人が DNS を保存 |
| Resend | Free（月 3,000 通・1 日 100 通）。Open / Click tracking は Off | 本人が登録（カードを求められたら止める） |
| Supabase の SMTP | runbook E。API キーは Supabase の画面へ直接貼る（ほかへ保存・送信しない） | 本人が入力 |
| テンプレート 6 種類 | 確認・招待・マジックリンク・メールアドレスの変更・パスワードの再設定・再認証（`email-templates/`・ja/en） | 本人が Supabase へ貼る（runbook E） |
| Gmail / iCloud / Outlook | 配信テスト（runbook F）。迷惑メールに入らないこと・リンクが書き換わらないこと | 本人が確認し、結果だけを報告 |
| Bounce・Suppression | Resend のダッシュボードで確認（自動の抑制あり）。週 1 回の確認（`email-and-domain-cost-plan.md`） | — |
| Rate limit | Supabase の送信の上限を低いまま（1 時間 30 通）。アプリの再送は 60 秒のクールダウン（`resend-cooldown.ts`） | 上げない |
| Release Validator | `validate:auth-email-release`（チェック項目の JSON に Secret・メールアドレス・リンクを書かない） | すべての確認の後に READY |

## 3. 認証の公開

| 項目 | コード・設定の状態（2026-10-07 に確認） |
|---|---|
| Signup | `ACCOUNT_SIGNUP_MODE = "limited"`・`AUTH_EMAIL_DELIVERY = "builtin_members_only"`（`account-availability.ts`）。`isSignupOpen` は両方が揃わないと false。フォームは localhost の `?signupPreview=1` だけ |
| Login・Confirmation・Password reset | `/auth/sign-in`・`/auth/confirm`・`/auth/forgot-password`・`/auth/update-password`（実装済み・black-box あり） |
| Email change | 画面はあるが無効（送信しない）。`custom_smtp_verified` で有効にする（PR で切り替え） |
| Session | `@supabase/ssr` と middleware のセッション更新 |
| Reauthentication | テンプレートのみ。Supabase の「Secure password change」は無効のまま |
| Account deletion | 未実装（サポート経由の手動）。方式（Edge Function / DB の関数）は本人の判断（`auth-deferred-items.md`） |
| Data export | 端末のデータは `/data-management` の書き出し・ローカルのバックアップで提供済み。クラウドの My Team の書き出しは未実装（公開の前の判断の候補） |
| RLS | `supabase-auth-rls-hardening-results.md`（本人のデータだけ読める・書ける） |
| 列挙の防止 | サインインの失敗理由・登録済みかどうかを区別しない（`auth-errors.ts`） |
| Open redirect | `resolveSafeInternalPath`（`safe-redirect.ts`）: アプリ内の相対 path だけ。`//`・`/\`・`://`・制御文字・空白を拒否 |
| Callback の allowlist | Supabase の Redirect URLs に `https://<domain>/auth/callback` と既存の `*.vercel.app` の callback だけ（runbook E）。`resolveAuthRedirectOrigin` は設定の Site URL を優先 |
| Public signup flag | `ACCOUNT_SIGNUP_MODE` を `open` にする PR は、validator が READY かつ本人の承認の後だけ |
| Owner approval | `auth-email-release-checklist.json` の `ownerApprovedAt`（本人の承認の日時。Claude Code は書かない） |

## 4. 本人の操作の順（1 回の作業・約 60〜90 分）

1. 空き・価格を確かめ直してドメインを購入（Cloudflare）→ `domain-purchase-queue.md` の状態を `purchased` へ（報告を受けて Claude Code が更新）。
2. runbook B〜E（Resend・DNS・Vercel・Supabase の SMTP とテンプレート）。
3. runbook F（Gmail・iCloud・Outlook の配信テスト）。
4. Claude Code へ「完了」と結果だけを報告（Secret・パスワード・メールのリンクを書かない）。
5. Claude Code: チェック項目の JSON（Secret なし）→ validator → black-box（新旧の URL）→ READY の報告。
6. 本人の承認 → `ACCOUNT_SIGNUP_MODE` を `open` にする PR（Claude Code）→ merge の後に公開の black-box。

## 5. Claude Code が行わないこと

購入・契約・Secret の入力と表示・DNS の保存・SMTP の有効化・新規登録の公開・`ownerApprovedAt` の記入。
