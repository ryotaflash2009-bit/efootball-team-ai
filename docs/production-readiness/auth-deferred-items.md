# 認証まわりの保留項目（Deferred）

更新: 2026-09-27。ドメインの購入保留中に「実装しない・有効にしない」と決めた項目。どれも**現在の公開サイトで誤って使える状態にはなっていない**（画面は利用できない旨を表示するか、表示しない）。

| 項目 | 現在の状態 | 保留の理由 | 再開の条件 | 本人の操作 | 費用 | 公開の判定 |
|---|---|---|---|---|---|---|
| 一般の新規登録 | 「限定テスト中」の案内だけ（フォームなし。`?signupPreview=1` は localhost だけ） | Supabase の組み込みメールはプロジェクトのメンバーにしか届かない | 独自ドメイン・カスタム SMTP の配信確認 | runbook A〜G | ドメイン US$10.46/年の見込み | `npm run validate:auth-email-release` が READY ＋本人の承認 |
| カスタム SMTP の有効化 | 無効（組み込みメール） | 送信ドメインがない | ドメイン購入 | runbook B・C・E | 0円（Resend Free） | 同上 |
| メールアドレスの変更 | 画面はあるが無効（利用できない旨を表示・送信しない） | 確認メールが届かない | `AUTH_EMAIL_DELIVERY = "custom_smtp_verified"` | なし（PR で切り替え） | 0円 | 同上＋変更メールの配信テスト（runbook F） |
| 招待 | テンプレートと着地点（`/auth/confirm?type=invite` → パスワード設定）だけ準備済み。送る操作は Supabase の画面から本人だけ | 配信確認前 | カスタム SMTP | Supabase → Users → Invite | 0円 | runbook F の招待テスト |
| 再認証（Reauthentication） | テンプレートのみ。パスワード変更で必要と返された場合は案内を表示 | Supabase の「Secure password change」は無効のまま（有効にするとメールが必要） | カスタム SMTP ＋本人の判断 | Supabase → Providers → Email | 0円 | 配信テスト |
| アカウントの削除（本人が自分で） | 未実装。プライバシーポリシーとアカウント画面で「サポートへ連絡すれば運営者が手動で削除」と案内 | 削除にはサーバー側の管理者権限（service role）か、本番 DB の関数（マイグレーション）が必要。どちらも本番の権限・スキーマ変更で、本人の判断が必要 | 本人が方式（Edge Function / DB 関数）を承認 | 本番マイグレーションの承認 | 0円 | 削除の black-box（本人のデータだけ消える・他人は消せない・ローカルデータの扱い） |
| ローカルデータの削除 | 実装済み（`/data-management`。端末内だけ・本番に影響なし） | — | — | — | — | — |

## 変えていないもの（保留中は現状維持）

Supabase Custom SMTP・Site URL・Redirect URLs・確認メールの一般公開、Vercel の独自ドメイン、Cloudflare DNS、Resend の送信ドメイン、SMTP の Secret、新規登録の公開フラグ、本番のスキーマ・RLS・ロール、参照データ、バックアップ・適用・スケジュールの権限。

関連: `domain-purchase-queue.md`・`custom-domain-and-email-runbook.md`・`email-and-domain-cost-plan.md` §7・`auth-email-release-checklist.json`。
