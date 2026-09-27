# 独自ドメインと認証メール（カスタム SMTP）の本人向け手順書

作成: 2026-09-27。費用と候補の根拠は `email-and-domain-cost-plan.md`。
**本人だけが行う操作**（購入・支払い・規約同意・ログインと 2FA・Secret の入力・DNS の保存・カスタム SMTP の有効化・実メールの確認）を、**1回のまとまった手順**にしてある。Claude Code は代行しない。

ボタン名は各サービスの画面変更で変わることがある。**名前が違っても、同じ意味の項目を選ぶ**。分からない・想定と違う画面が出たら、その時点で止めて Claude Code へ伝える。

## 0. 全体の流れ（Windows のブラウザーで行う。所要 60〜90 分。DNS の反映待ちを含む）

| 手順 | 場所 | 支払い | Secret |
|---|---|---|---|
| A. ドメイン購入 | Cloudflare | **ここだけ**（推奨1なら US$10.46/年） | なし |
| B. 送信ドメイン登録と DNS | Resend → Cloudflare | なし | なし |
| C. SMTP の鍵を作る | Resend | なし | **API キー（Supabase へ直接貼る。ほかへ保存・送信しない）** |
| D. Web のドメイン | Vercel | なし | なし |
| E. 認証の URL・SMTP・テンプレート | Supabase | なし | C の API キーを入力 |
| F. 配信テスト | 自分のメール（Gmail / iCloud / Outlook） | なし | なし |
| G. Claude Code へ報告 | — | — | **報告に Secret・パスワード・メール本文のリンクを書かない** |

以下、例として推奨1の `teamaixi.com` を使う。別の候補を選んだら置き換える。

- Web サイト: `https://teamaixi.com`
- 認証の戻り先: `https://teamaixi.com/auth/callback`
- 送信元: `no-reply@auth.teamaixi.com`（送信専用のサブドメイン。Resend 推奨）
- 送信者名: `eFootball Team AI`
- サポート: `https://teamaixi.com/support`（メールの受付窓口は作らない。受信用 MX は設定しない）

## A. Cloudflare でドメインを購入（Windows・ブラウザー）

1. `https://dash.cloudflare.com/` を開く → アカウントが無ければ **Sign up**（メールとパスワード。ここで Claude Code に何も渡さない）。
2. 右上のプロフィール → **My Profile** → **Authentication** → **Two-Factor Authentication** を有効化（2FA）。
3. 左メニュー **Domain Registration** → **Register Domains**。
4. 検索欄に `teamaixi.com` を入力 → 検索。
   - **価格が US$10.46 前後で、Renewal（更新）も同じ**であることを確認。**Premium と表示されたら購入しない**（候補2 `xibuild.app` → 候補3 `xilab.dev` の順に切り替える）。
5. **Purchase** / **Continue**。
   - 年数: **1年**。
   - 連絡先情報: 本人の情報を入力（Cloudflare が公開情報から非公開にする。WHOIS の非公開は無料で既定）。
   - **Auto-renew（自動更新）: On**（更新価格は登録と同額）。
6. **支払い（ここで課金が発生する）**: カード情報は Cloudflare の画面にだけ入力する。
7. 購入後、ドメインの画面 → **DNS** → **Settings** → **DNSSEC** → **Enable DNSSEC**（無料）。

- 完了条件: ドメインが Cloudflare の Websites に表示され、DNSSEC が有効。
- 止める条件: Premium 表示、想定より大幅に高い価格、更新価格が登録より高い。

## B. Resend で送信ドメインを登録し、DNS を設定（Windows）

1. `https://resend.com/` → **Sign up**（規約同意は本人）。**クレジットカードを求められたら入力しない**（Free で利用できない場合は止めて報告）。
2. **Settings** → **Security** などから **2FA** を有効化。
3. **Domains** → **Add Domain**。
   - Domain: `auth.teamaixi.com`
   - Region: **Tokyo（ap-northeast-1）** が選べれば選ぶ（日本の受信者へ近い）。
4. 画面に表示された **DNS レコード（SPF / DKIM / 送信用の MX など）** を、**表示どおりに**使う（値を推測しない・コピーで写す）。
5. 別タブで Cloudflare → ドメイン → **DNS** → **Records** → **Add record** で、Resend の表示どおりに追加する。
   - **Proxy status は DNS only（灰色の雲）**。オレンジ（Proxied）にしない。
   - 既に SPF（`v=spf1` で始まる TXT）がある同じ名前には**2本目を作らない**（統合が必要なら止めて報告）。
6. DMARC（任意だが推奨・まずは監視だけ）: **Add record** → Type `TXT`、Name `_dmarc.auth`（= `_dmarc.auth.teamaixi.com`）、Content `v=DMARC1; p=none;` → **Save**。
   - 数週間問題がなければ、後で `p=quarantine` への強化を検討する（今は強めない）。
7. Resend に戻り **Verify DNS Records**。数分〜数時間で **Verified** になる。

- 完了条件: Resend の Domains で `auth.teamaixi.com` が **Verified**。
- 止める条件: 数時間たっても Failed、SPF が2本になる、カード入力を求められる。
- Resend の **Open / Click tracking は Off のまま**（認証メールのリンクを書き換えない）。

## C. SMTP 用の API キーを作る（Resend・Windows）

1. **API Keys** → **Create API Key**。
   - Name: `supabase-auth-smtp`
   - Permission: **Sending access**
   - Domain: `auth.teamaixi.com`
2. 表示されたキー（`re_` で始まる）は**この後の E でそのまま Supabase へ貼る**。
   - **メモ帳・チャット・スクリーンショット・Claude Code へ渡さない**。閉じたら二度と表示されない（なくしたら作り直す）。
3. Resend の **Billing / Usage** で、**Free プランであること・支払い方法が未登録であること**を確認。

## D. Vercel に独自ドメインを追加（Windows）

1. `https://vercel.com/` → 対象プロジェクト → **Settings** → **Domains** → **Add**。
2. `teamaixi.com` を入力 → **Add**。`www.teamaixi.com` を聞かれたら「apex へリダイレクト」を選ぶ。
3. Vercel が表示する **A / CNAME の値**を、Cloudflare の **DNS → Add record** へ**表示どおりに**追加（**DNS only**）。
4. Vercel の Domains に **Valid Configuration** と SSL 証明書の発行が表示されるまで待つ。
5. **Settings → Environment Variables** → `NEXT_PUBLIC_SITE_URL` = `https://teamaixi.com` を **Production だけ**に追加（Secret ではない）→ **Redeploy**（Deployments → 最新 → **Redeploy**）。
   - Preview には入れない（プレビューの URL を本番の認証メールへ混ぜないため）。

- 完了条件: `https://teamaixi.com` でサイトが開き、鍵マーク（SSL）が有効。既存の `*.vercel.app` の URL も引き続き開く。

## E. Supabase の認証設定（Windows）

1. `https://supabase.com/dashboard` → 対象プロジェクト。
2. **Authentication → URL Configuration**
   - **Site URL**: `https://teamaixi.com`
   - **Redirect URLs**: `https://teamaixi.com/auth/callback**` の1件だけにする（Supabase は glob で照合する。`**` は `?next=/auth/update-password` のようなクエリ付きの戻り先に対応するため。ホストとパスは固定なので、ほかのサイトへは戻らない）。`*.vercel.app` のプレビュー URL や、ドメイン全体のワイルドカードは**入れない**。
   - アプリ側の戻り先の検証（`/auth/callback` は内部パスだけへ遷移）は既存の `resolveSafeInternalPath` が行う。
   - **Save**。
3. **Authentication → Emails（または Email / Notifications）→ SMTP Settings → Enable Custom SMTP**
   - Sender email: `no-reply@auth.teamaixi.com`
   - Sender name: `eFootball Team AI`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: **C で作った API キーを貼る**（ここ以外に貼らない）
   - Minimum interval（同じ宛先への最短間隔）: 既定の 60 秒のまま
   - **Save**。保存後、パスワード欄は再表示されない（正常）。
4. **Authentication → Rate Limits**: メール送信の上限は**上げない**（カスタム SMTP 有効化直後の 1 時間 30 通のまま）。
5. **Authentication → Emails → Templates**: 次の6種類に、リポジトリの `docs/production-readiness/email-templates/` の内容を貼る（件名は `subjects.json`）。
   - Confirm signup ← `confirm-signup.html`
   - Magic Link ← `magic-link.html`
   - Reset Password ← `reset-password.html`
   - Change Email Address ← `change-email.html`
   - Invite user ← `invite.html`
   - Reauthentication ← `reauthentication.html`
   - 1つずつ **Save**。
6. **Authentication → Providers → Email**: **Confirm email: On**（確認メールを必須にする）のまま。
7. （推奨）**Authentication → Attack Protection → CAPTCHA** は、利用者が増えてから検討（今は不要）。

- 完了条件: 保存エラーが出ない。
- 止める条件: SMTP の保存でエラー、項目が見当たらない。

## F. 配信テスト（本人のメールで行う・Windows と iPhone）

**まだ一般公開しない**（サイトの新規登録は「限定テスト中」のまま）。本人のメールアドレスで次を確認する。

1. Supabase → **Authentication → Users → Add user → Send invitation** で、自分の Gmail へ招待を送る → 受信箱に届くか、差出人が「eFootball Team AI <no-reply@auth.teamaixi.com>」か、迷惑メールに入っていないか、リンクを押すと `https://teamaixi.com/...` へ戻るか。
2. 同様に iCloud、Outlook（可能なら携帯キャリアメール）へ招待を送って確認。
3. `https://teamaixi.com/auth/forgot-password` でパスワード再設定を送り、届くか・リンクで再設定できるか。
4. Gmail でメールを開き **︙ → メッセージのソースを表示** → **SPF: PASS / DKIM: PASS / DMARC: PASS** を確認（値や本文は報告に写さない）。
5. iPhone のメールアプリで、日本語・英語の表示崩れがないか（主観で可）。

## G. Claude Code への報告（このまま送ってよい内容）

- 選んだドメイン名
- A〜E が完了したか（各「完了 / 止まった手順」）
- F の結果: 受信箱に届いた（Gmail / iCloud / Outlook それぞれ ○/×）、迷惑メール判定の有無、SPF/DKIM/DMARC が PASS か
- **書かないもの**: API キー、パスワード、メールアドレス、メール内のリンク、確認コード、スクリーンショット

報告を受けたら Claude Code が行うこと:
- `ACCOUNT_SIGNUP_MODE` を `"open"` に変える PR（自動ではなく報告の後）
- 公開サイトの認証 black-box（新規登録・再送・再設定・誤った戻り先の拒否・エラー表示）
- Release Gate の記録

## 付録: 無料枠を超えそうなとき

- Resend Dashboard の **Usage** で月 3,000 通・1日 100 通に近づいていないかを週1回確認。
- 80% を超えたら Claude Code へ伝える（新規登録を一時的に「限定テスト中」へ戻す PR を用意する）。
- **有料プランへ移行しない・支払い方法を登録しない**（Free には超過課金がなく、上限で送信が止まるだけ）。

## ドメイン購入の保留と再開（2026-09-27 追記）

本人の判断で、ドメインは**他のプロジェクトとまとめて購入するまで保留**。キューは `domain-purchase-queue.md`。
保留中は A〜G のどれも行わない（Supabase・Vercel・Cloudflare・Resend の設定、SMTP の Secret、新規登録の公開フラグは現状のまま）。

### 再開のチェックリスト（本人・まとめ買いの日）

1. `domain-purchase-queue.md` の第一候補を Cloudflare で検索し直す（Available・Premium でない・更新価格が同じ）。取れなければ予備へ。
2. 支払い方法とアカウントの 2FA（下の「2FA と復旧」）を先に確認してから購入する。
3. 購入したら、この手順書の A の残り（自動更新 On・WHOIS 非公開・DNSSEC）→ B〜F を1回で行う。
4. G の報告を Claude Code へ送る（ドメイン名と ○/× だけ。Secret・メールアドレス・リンクは書かない）。
5. Claude Code がキューの状態を `purchased` に、費用台帳を「支払い済み（金額は本人の報告値）」に更新し、Release Validator を通す。

## 複数プロジェクトのドメインとメールの管理

まとめ買いで複数のプロジェクトのドメインを持つときの分け方。**共有するのは Cloudflare のアカウント（支払い・請求）だけ**で、それ以外はプロジェクトごとに分ける。1つのプロジェクトの事故（鍵の漏えい・送信停止・停止処分）が他へ広がらないようにするため。

| 項目 | 共有 / 分離 | 理由 |
|---|---|---|
| Cloudflare アカウント | 共有可（1つ） | 請求と更新をまとめて管理する |
| Cloudflare のゾーン（DNS） | **プロジェクトごと**（ドメインごとに自動で別ゾーン） | DNS の変更が他へ影響しない |
| Resend の送信ドメイン | **プロジェクトごと**（Free は 3 ドメインまで。4つ目からは別アカウントか有料） | 到達率の評判（reputation）を分ける |
| SMTP の API キー | **プロジェクトごとに1本**（権限は Sending access・対象ドメインを限定） | 1本漏れても他を止めずに差し替えられる |
| Supabase プロジェクト | **プロジェクトごと** | 利用者・Auth 設定・レート制限を分ける |
| Vercel プロジェクト | **プロジェクトごと** | ドメイン・環境変数を分ける |
| サポートの窓口 | **プロジェクトごと**（このプロジェクトは `https://<domain>/support`。受信用メールは作らない） | 問い合わせの混在を防ぐ |

### 更新（リニューアル）の一覧と失効の防止

| ドメイン | プロジェクト | 登録日 | 次の更新日 | 自動更新 | 年額 |
|---|---|---|---|---|---|
| （購入後に本人の報告で記入） | eFootball Team AI | — | — | On にする | US$10.46（`.com`） |

- 自動更新は**全ドメインで On**。支払い方法の有効期限が更新日より前に切れないか、年1回確認する。
- Cloudflare の更新通知メールが届くアドレスを、本人が普段読むアドレスにしておく。
- 失効するとサイトと認証メールが止まり、第三者に取られる可能性がある。やめる場合も、先に利用者へ告知してから自動更新を止める。

### 費用の按分

Cloudflare の請求はまとめて1つになるが、台帳はプロジェクトごとに分ける（このプロジェクトは `email-and-domain-cost-plan.md` の §7）。
共有の費用（Cloudflare のアカウント自体）は無料のため按分しない。

### Secret の一覧（値は書かない。どこにあるかだけ）

| Secret | 置き場所（唯一） | 作る場所 | 失効・差し替え |
|---|---|---|---|
| Resend API キー（SMTP パスワード） | Supabase → Authentication → SMTP Settings の Password 欄だけ | Resend → API Keys | Resend で新しいキーを作る → Supabase に貼る → 古いキーを Revoke |
| Supabase の service role / secret key | GitHub Actions の Secrets と Vercel の環境変数（既存の運用どおり） | Supabase | 既存の手順（`owner-actions.md`・`reference-data-auto-update-runbook.md`） |

Secret を本人のメモ・チャット・スクリーンショット・Claude Code へ渡さない。パスワード管理ソフトに入れる場合は本人だけが見られる場所にする。

### 2FA と復旧

- Cloudflare・Resend・Supabase・Vercel・GitHub の**すべてで 2FA を有効**にする（認証アプリ推奨。SMS は避ける）。
- 各サービスの**リカバリーコード**を、パスワード管理ソフトか紙で保管する（PC だけに置かない）。
- 端末をなくしたとき: リカバリーコードで入り、2FA を登録し直し、各 API キーを差し替える。

### 期限切れの防止（年1回・本人）

- ドメインの更新日と支払い方法の期限
- 各 API キーの作成日（1年以上たったら差し替えを検討）
- 各サービスの無料枠・料金の変更（`email-and-domain-cost-plan.md` の見直し日）
