# 課金の導入の前の認証の境界（2026-10-11・設計だけ）

本番の課金は実装も有効化もしていない。将来 Stripe をつなぐときに認証の設計をやり直さないための決めごと。コードの変更は不要（削除の関数の課金の接続点だけ実装済み）。

## 1. 識別子

| 項目 | 決めごと |
|---|---|
| 主キー | Supabase の `auth.users.id`（UUID・アプリの user ID）。Google のメールは主キーにしない（メールは変わりうる・Apple は非公開のことがある） |
| Stripe の customer | `public.billing_customers (user_id uuid primary key references auth.users on delete restrict, stripe_customer_id text unique not null, created_at)`。Stripe の側にも `metadata.user_id` を入れる。メールで照合しない |
| 契約の状態 | `public.billing_subscriptions (user_id, stripe_subscription_id unique, status, current_period_end, updated_at)`。**サーバー（webhook）だけが書く**。利用者は自分の行を読むだけ（RLS: `select using (user_id = auth.uid())`・insert/update/delete のポリシーなし） |
| provider の識別子 | Google の `sub` は Supabase の `auth.identities` が持つ。アプリは使わない（provider を足しても user ID は同じ） |
| メールの変更 | Supabase の `auth.users.email` が変わっても、user ID・Stripe の customer は変わらない。Stripe のメールは customer portal で本人が変える |

## 2. 権限（Pro）の判定

- 判定はサーバーの状態だけ: `billing_subscriptions.status in ('active','trialing')` かつ `current_period_end > now()`。クライアントの申告（localStorage・クエリ）を使わない。
- 画面の表示（Pro のバッジ等）はクライアントでも読むが、Pro の機能の API・RLS はサーバーで判定する。
- webhook: Stripe の署名（`Stripe-Signature`・webhook の secret）を検証。`event.id` を `billing_webhook_events (event_id primary key, processed_at)` に記録して冪等。
  順序の入れ替わりは `updated_at` と Stripe の `created` で古いイベントを無視。webhook の secret と Stripe の API key は Vercel の Server の環境変数だけ（`NEXT_PUBLIC_` にしない）。
- customer portal: サーバーで portal session を作り、本人の customer だけを開く（URL に customer ID を出さない）。

## 3. アカウントの削除と課金

`delete_my_account` は `public.billing_subscriptions` があれば、`active`・`trialing`・`past_due`・`unpaid` の契約で拒否する（実装済み・テスト済み）。

| 状態 | 削除 | 理由・手順 |
|---|---|---|
| 有効な契約 | 拒否 → 先に解約（customer portal） | 請求が残るのを防ぐ |
| 解約の予約（期間の終わりまで有効） | 拒否（`active` のため） | 期間の終わりの後に削除できる。即時の削除を望む場合は運営の手動の対応（Stripe で即時の解約） |
| 支払いの失敗中（`past_due`・`unpaid`） | 拒否 → 運営へ連絡 | 未払いの扱いを決めてから |
| 返金中・チャージバック中 | 拒否（運営の手動の対応） | 不正の対策・会計の記録が必要 |
| 解約済み（`canceled`） | 可能 | — |

削除の後に残す最小の情報（会計・返金・不正の対策）: Stripe 側の customer・請求書・支払い（Stripe が保持・法令の期間）。TeamAIXI 側は
`billing_customers` を削除の関数で消す前に `stripe_customer_id` を会計用の別の表（`billing_retained_records`: `stripe_customer_id`・削除の日時・
理由・保持の期限。user ID・メールは保存しない）へ移す。今は課金が無いため、この表は作らない（不要な保持を増やさない）。

## 4. ログイン手段を失った課金のユーザーの復旧

- Google アカウントを失った: 運営へ連絡 → Stripe の領収書（Stripe が送るメール・請求書の番号）で本人確認 → 運営者が Supabase の Admin で
  新しいログイン手段（別の Google・将来の Apple）を同じ user に追加、または権利を新しい user へ移す（`billing_customers.user_id` を更新）。メールの一致だけでは移さない。
- 予防: アカウントの画面で 2 つ目のログイン手段の追加を勧める（Apple の導入時・`linkIdentity`）。

## 5. 本番の課金の前に決めること（本人）

- 運営者が未成年のため、Stripe の本番の契約・特定商取引法の表記・税の扱いに保護者の対応が必要（Stripe の規約）。
- 独自ドメイン（`teamaixi.com`）を本番の課金の前に再判断する（Stripe の公開の URL・メールの送信元・Google の承認済みドメイン）。
- 認証の主な経路は Google OAuth（確認メールに依存しない）。決済のメールは Stripe が送り、認証のメール（Supabase）・運営の通知と分ける。
- 価格・返金の方針・Pro の範囲。
