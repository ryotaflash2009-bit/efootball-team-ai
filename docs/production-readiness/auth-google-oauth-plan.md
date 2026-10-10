# 認証の方針の見直し: Google OAuth を主な経路に（2026-10-11）

本人の方針（2026-10-11）:

1. 未ログインでもゲストとして利用できる。
2. アカウントの登録とログインは、当面 Google OAuth を主な経路にする。
3. メールアドレス＋パスワードの新規登録は、当面ユーザーへ提供しない。
4. Supabase の確認メールは、Google OAuth の経路では使わない。
5. Apple ログインは今回は実装せず、将来の候補にする。
6. パスワードの再設定も、パスワードログインを提供しない間はユーザーの導線から外す。
7. 課金のメールは Stripe、運営の通知は将来の専用の送信基盤にして、認証のメールと分ける。

この文書のコードは **既定で無効**（`GOOGLE_OAUTH_MODE = "disabled"`・`src/lib/supabase/oauth.ts`）。本人の Google Cloud と Supabase の設定、
§7 のテストの後に PR で `"enabled"` に変える。Claude Code は Google Cloud Console・Supabase Production・秘密情報・Production のデータに触れていない。

## 1. 現在の実装の状態（読み取りの棚卸し）

| 項目 | 状態（2026-10-11 の変更の前） | この作業の後 |
|---|---|---|
| Google OAuth | **未実装**（`signInWithOAuth` の呼び出しなし。`authentication-options.md` は「OAuth は正式公開時に検討」） | 実装済み・既定で無効。ボタン（`GoogleSignInButton.tsx`）・redirectTo・失敗の表示・新規登録の画面 |
| Supabase の Google Provider | 確認できない（Production の設定は読んでいない）。コードの側に前提なし → **未設定とみなす** | 本人の設定（§4） |
| callback | `/auth/callback`（`exchangeCodeForSession`・PKCE・安全な内部パスだけに遷移・生のエラー文を出さない）。メールのリンク用 | 同じ route で `flow=google` を区別（キャンセル → `oauth_cancelled`・失敗 → `oauth_failed`・一時的な障害 → `unavailable`） |
| redirect URL | メール: `resolveAuthRedirectOrigin`（`NEXT_PUBLIC_SITE_URL` が https の origin なら優先） | Google: `<origin>/auth/callback?flow=google&next=<内部パス>`（同じ origin の規則） |
| Production / Preview の URL | Production `https://efootball-team-ai.vercel.app`（将来 `https://teamaixi.com`）。Preview は `*.vercel.app` の PR ごとの URL | Preview は Redirect URLs に**入れない**（§6）。Preview で Google のログインは試さない（ローカルとテスト用のプロジェクトで確認） |
| ゲスト → アカウントのデータ | localStorage の領域が `guest` / `account:<ハッシュ>` に分かれている（`local-storage-scope`）。ゲストの領域からアカウントへの**引き継ぎの導線は無かった**（移行センターはアカウント分離前の共通データだけ） | 移行センターに「コピー元: ゲスト」を追加（`?source=guest`）。不足分だけ追加・競合は上書きしない・バックアップ・検証・失敗で戻す（既存の仕組みをそのまま使う）。アカウントの画面にゲストのデータの件数と導線 |
| 既存のユーザーとの衝突 | 既存のアカウントはメール＋パスワード（限定テストのメンバーだけ） | §2.3 |
| RLS と所有者 ID | クラウドの表（`my_team_snapshots` 等）は `auth.uid() = user_id` の RLS。端末内の領域のキーは user ID の SHA-256（`scope-id.ts`） | 変更なし。Google で入っても Supabase の user ID が所有者。同じ user に Google がリンクされれば ID は同じ、新しい user なら別の ID（既存のデータは見えない） |
| ログアウト | `supabase.auth.signOut()`（アカウントの画面）。ログアウトすると領域は guest に戻る | 変更なし（Google のセッションは Supabase のセッションと別。TeamAIXI からのログアウトで Google 自体はログアウトしない） |
| セッションの復元 | `@supabase/ssr` の Cookie・middleware で `getUser()` による更新・クライアントは `getUser` + `onAuthStateChange` | 変更なし（OAuth も同じ Cookie のセッション） |
| アカウントの削除 | **未実装**（サポートへの連絡で運営者が手動で削除・`auth-deferred-items.md`） | 変更なし（§8・§9 のリスク） |
| OAuth の失敗・キャンセルの表示 | なし | ログインの画面に日本語・英語（ほか 10 言語）で一般化した文。ゲストのデータは残る旨 |
| 日本語・英語 | 認証の辞書は 12 言語 | 新しいキーを 12 言語に追加（`auth`）。移行センターは ja / en（既存どおり他の言語は英語へ） |
| モバイルの Safari・Chrome | — | **redirect 方式**（popup なし）。390px で横のはみ出しなし（black-box）。実機の確認は §7 |

## 2. 設計

### 2.1 redirect 方式（popup ではない）

- モバイルの Safari・Chrome は popup をブロックしやすく、アプリ内ブラウザー（X・LINE 等）では popup が開かない。
- Supabase の PKCE は「Google の画面 → Supabase → 自サイトの `/auth/callback`（code を Cookie の code verifier で交換）」で完結する。
- `prompt=select_account`: 複数の Google アカウントを使い分ける人が、意図しないアカウントで登録しないよう毎回選ばせる。
- アプリ内ブラウザーでは Google が「安全でないブラウザー」としてログインを拒否することがある（Google の方針）。失敗の文は一般化して表示する。
  将来、アプリ内ブラウザーを検出して「Safari / Chrome で開く」案内を出す（§9 のリスク）。

### 2.2 画面の導線（`GOOGLE_OAUTH_MODE = "enabled"` のとき）

| 画面 | 内容 |
|---|---|
| ログイン | 「Google で続ける」が主。メール＋パスワードは「以前にメールアドレスで作成したアカウント」用（既存の限定テストのメンバーがログインできなくならないよう残す）。**パスワードの再設定のリンクは出さない**（方針 6） |
| 新規登録 | Google だけ（メールとパスワードの入力欄なし・確認メールなし・方針 3/4） |
| アカウント | ゲストのデータがあれば件数と「ゲストのデータを引き継ぐ」 |
| 移行センター | コピー元を「アカウント分離前のデータ」「ゲストのデータ」から選ぶ。初期は従来どおり前者。`?source=guest` で後者 |

無効のとき（今の Production）は、どの画面も**従来と同じ**（black-box で確認）。

`/auth/forgot-password`・`/auth/update-password` の route は残す（既存のメンバーの復旧と、将来パスワードログインを戻す場合のため）。導線からは外す。

### 2.3 既存のユーザーとの衝突・アカウントのリンク（メールの一致だけで統合しない）

- **TeamAIXI のデータ**は、メールアドレスの一致で自動では統合しない。端末内のゲストのデータは本人が移行センターで選んだときだけコピーする。
  クラウドのデータ（My Team のスナップショット等）は Supabase の user ID が所有者で、user ID が違えば見えない（RLS）。
- **Supabase の Identity Linking**: Supabase Auth は、同じメールアドレスの identity を 1 人の user に**自動でリンクする**（メールが確認済みのとき。
  未確認のメールではリンクしない）。Google のメールは Google が確認済みとして渡す。つまり、既存のメール＋パスワードのアカウント（確認済み）と
  同じメールの Google でログインすると、**同じ user（同じ user ID）として入る**可能性が高い。
  - 影響: 既存のアカウントは限定テストのメンバー（本人・テスト用）だけ。一般の利用者のメールのアカウントは無い（新規登録は未開放）。
  - 本人の確認（§7-4）: テスト用のプロジェクトで「メール＋パスワードの確認済みのアカウント」と同じメールの Google でログインし、
    user ID が同じか（自動リンク）・別か（Supabase の設定）を確かめてから Production で有効にする。挙動は Supabase の公式文書
    （Auth → Identity Linking）でも確認する（この文書は Claude Code の知識に基づく。Supabase の仕様の変更に注意）。
  - 自動リンクを望まない場合: Production の既存のメールのアカウントを先に棚卸しし（本人・Supabase の Users の画面）、不要なテスト用のアカウントは
    本人が削除してから有効にする。
- **手動のリンク**（将来の Apple 等）: ログインしている本人が「アカウントに Apple を追加」を押したときだけ `linkIdentity`（Supabase の
  「Manual Linking」を有効にする必要がある）。メールの一致では統合しない。Apple の「メールを非公開」（private relay）の場合はメールが一致しないため、
  手動のリンクが唯一の統合の方法になる。リンクの解除は identity が 2 つ以上あるときだけ（最後のログイン手段を消さない）。

### 2.4 課金のユーザーがログインできなくなった場合の復旧（将来・課金は未導入）

- 課金は Stripe（方針 7）。Stripe の Customer に Supabase の user ID を `metadata` で保存し、メールアドレスを鍵にしない。
- Google アカウントを失った・停止された場合: 本人がサポートへ連絡 → 運営者が Stripe の領収書（Stripe が送るメール・請求の ID）で本人確認 →
  新しいログイン手段（別の Google・将来の Apple）を**運営者の手動の操作**で同じ user に追加、または新しい user へ課金の権利を移す（Stripe の
  Customer の metadata を更新）。メールの一致だけでは移さない。手順は課金の導入時に runbook にする。
- 予防: 将来、アカウントの画面で 2 つ目のログイン手段（Apple 等）の追加を勧める。

### 2.5 メールの分離（方針 4・7）

| 種類 | 送信 | 状態 |
|---|---|---|
| 認証（確認・再設定・メールの変更・招待） | Supabase Auth | Google の経路では**使わない**。メールの経路は限定テストのメンバーだけ（組み込みのメール） |
| 課金（領収書・請求・失敗） | Stripe | 将来（課金の導入時） |
| 運営の通知（お知らせ等） | 将来の専用の送信基盤 | 将来。認証のドメイン・SMTP とは分ける |

Google の経路では Custom SMTP・独自ドメインが無くても一般の利用者がアカウントを作れる。そのため、Google を有効にすることは
**新規登録の一般公開**に当たる（`ACCOUNT_SIGNUP_MODE` のメールの経路とは別の判断。本人の承認が必要）。

## 3. 本人が行う Google Cloud の設定

Google Cloud Console（https://console.cloud.google.com/）で、本人の Google アカウントで操作する。

1. 上部のプロジェクトの選択 → 「新しいプロジェクト」→ 名前 `TeamAIXI` → 作成 → そのプロジェクトを選ぶ。
2. 左のメニュー → 「API とサービス」→「OAuth 同意画面」（または「Google Auth Platform」→「ブランディング」）。
   - User Type: **外部** → 作成。
   - アプリ名: `TeamAIXI`／ユーザーサポートのメール: 本人のメール／デベロッパーの連絡先: 本人のメール。
   - アプリのドメイン（任意）: ホームページ `https://efootball-team-ai.vercel.app`、プライバシーポリシー `https://efootball-team-ai.vercel.app/privacy`、
     利用規約 `https://efootball-team-ai.vercel.app/terms`。
   - 承認済みドメイン: `vercel.app` は追加できない（公開サフィックス）。独自ドメインの購入後に `teamaixi.com` を追加。それまでは空でよい。
   - スコープ（「データアクセス」）: `openid`・`.../auth/userinfo.email`・`.../auth/userinfo.profile` の 3 つだけ（機密のスコープは追加しない → 審査不要）。
   - 公開ステータス: 最初は「テスト」で、テストユーザーに本人のアカウントを追加。§7 の確認の後に「本番環境に公開」（上の 3 つのスコープだけなら審査なし）。
3. 左のメニュー →「認証情報」（または「クライアント」）→「認証情報を作成」→「OAuth クライアント ID」。
   - アプリケーションの種類: **ウェブ アプリケーション**／名前: `TeamAIXI Supabase`。
   - 承認済みの JavaScript 生成元: `https://efootball-team-ai.vercel.app`（独自ドメインの後に `https://teamaixi.com` を追加）。
   - **承認済みのリダイレクト URI**: `https://kbauokzninaervjgwzdd.supabase.co/auth/v1/callback`（§6。Supabase の Google の設定の画面に
     表示される「Callback URL (for OAuth)」と一字一句同じか確認する。違えば Supabase の画面の値を使う）。
   - 作成 → 表示される **クライアント ID** と **クライアント シークレット** を控える（シークレットは画面とチャットに貼らない・Git に入れない）。

## 4. 本人が行う Supabase の設定（Production）

Supabase Dashboard → 対象のプロジェクト（`kbauokzninaervjgwzdd`）。

1. **Authentication → Sign In / Providers → Google** → Enable。
   - Client ID（for OAuth）: §3-3 のクライアント ID。
   - Client Secret（for OAuth）: §3-3 のクライアント シークレット。
   - 「Skip nonce checks」はオフのまま。「Allow users without an email」はオフ。
   - Callback URL（for OAuth）の表示を §3-3 のリダイレクト URI と照合 → Save。
2. **Authentication → URL Configuration**
   - Site URL: `https://efootball-team-ai.vercel.app`（独自ドメインの後は `https://teamaixi.com`）。既に設定済みなら変えない。
   - Redirect URLs: `https://efootball-team-ai.vercel.app/auth/callback**` が無ければ追加（`**` は `?flow=google&next=…` のため）。
     ローカルのテストをこのプロジェクトで行う場合だけ `http://localhost:3000/auth/callback**`（テストの後に削除）。`*.vercel.app` のワイルドカードは入れない。
3. **Authentication → Sign In / Providers → Email**: 方針 3 に合わせ、一般のメールの新規登録を止める場合は「Allow new users to sign up」を
   メールの経路だけで止める設定が無いため、**全体の「Allow new users to sign up」はオンのまま**（オフにすると Google の新規登録も止まる）。
   メールの新規登録は画面に出さないことで止めている（`ACCOUNT_SIGNUP_MODE = "limited"`）。API を直接呼んでメールのアカウントを作る経路は残るため、
   同じ画面の「Confirm email」が**オン**であることを確認する（オンなら確認メールが一般に届かないので、そのアカウントは確認済みにならずログインできない）。
4. 「Manual Linking」（Authentication → Sign In / Providers の上部の設定）は**オフのまま**（Apple の導入時に検討）。

登録の場所のまとめ（§5）: クライアント ID とシークレットは **Supabase の Google Provider の画面だけ**に入れる。Vercel の環境変数・GitHub の Secret・
リポジトリには入れない（アプリは Supabase の publishable key だけで `signInWithOAuth` を呼ぶ）。

## 5. Client ID・Secret の登録の場所

| 値 | 登録する場所 | 入れない場所 |
|---|---|---|
| Google の OAuth クライアント ID | Supabase → Authentication → Providers → Google → Client ID | Vercel・GitHub・リポジトリ（不要） |
| Google の OAuth クライアント シークレット | Supabase → Authentication → Providers → Google → Client Secret | Vercel・GitHub・リポジトリ・チャット・スクリーンショット |
| Supabase の publishable key・URL | 既存（Vercel の `NEXT_PUBLIC_SUPABASE_*`）。変更なし | — |

シークレットの更新: Google Cloud で新しいシークレットを追加 → Supabase に入れて Save → ログインを確認 → 古いシークレットを Google Cloud で無効化。

## 6. Redirect URI の正確な値

| 使う所 | 値 |
|---|---|
| Google Cloud の「承認済みのリダイレクト URI」 | `https://kbauokzninaervjgwzdd.supabase.co/auth/v1/callback`（Supabase の画面の Callback URL と一致を確認） |
| Google Cloud の「承認済みの JavaScript 生成元」 | `https://efootball-team-ai.vercel.app`（将来 `https://teamaixi.com`） |
| Supabase の Redirect URLs（アプリへの戻り先） | `https://efootball-team-ai.vercel.app/auth/callback**`（将来 `https://teamaixi.com/auth/callback**`） |
| アプリが送る redirectTo（コード） | `https://efootball-team-ai.vercel.app/auth/callback?flow=google&next=%2Faccount` の形（`NEXT_PUBLIC_SITE_URL` があればその origin） |

Supabase の URL（`kbauokzninaervjgwzdd`）は公開の値（ブラウザーへ配る JS に含まれる）で、秘密ではない。ローカルのビルドの公開値から確認した。

## 7. Production 適用前のテストの手順

1. ローカル（Claude Code が完了）: `node scripts/black-box-auth-google.mjs`（23/23・テストダブル・実 Supabase なし）・単体テスト
   （`oauth.test.ts`・callback・ゲストの引き継ぎ）。
2. 本人: §3・§4 の設定（Google の公開ステータスは「テスト」・テストユーザーは本人だけ）。
3. 本人（または Claude Code へ依頼）: `GOOGLE_OAUTH_MODE` を `"enabled"` にする PR を作り、**Preview ではなくローカル**（`npm run build` → `node scripts/local-server.mjs start`）で、
   Supabase の Redirect URLs に一時的に `http://localhost:3000/auth/callback**` を追加して確認する:
   - PC の Chrome: 「Google で続ける」→ アカウントの選択 → `/account` に戻る → ログイン中の表示。
   - キャンセル: Google の画面で戻る／キャンセル → ログインの画面に「キャンセルしました」。
   - ログアウト → ゲストに戻る → もう一度ログイン（セッションの復元: タブを閉じて開き直してもログイン中）。
   - ゲストで My Team に 1 枚入れる → Google でログイン → アカウントの画面の「ゲストのデータを引き継ぐ」→ プレビュー → 実行 → ゲストのデータは残る。
4. 既存のアカウントとの衝突（§2.3）: 本人のメール＋パスワードのアカウントと同じメールの Google でログインし、Supabase の Users の画面で
   identity が同じ user に増えたか（自動リンク）を確認。結果をこの文書に追記する。
5. 実機: iPhone の Safari・Android の Chrome で 3 と同じ流れ（Production で有効にした直後に本人のアカウントで 1 回）。
6. 合格の後: Redirect URLs から localhost を削除 → PR をマージ（Production に反映）→ Google の公開ステータスを「本番環境に公開」→
   Production で本人のアカウントで 1 回ログイン・ログアウト。

## 8. Rollback の手順

| 状況 | 手順 | 影響 |
|---|---|---|
| 画面の不具合・想定外の新規登録 | `GOOGLE_OAUTH_MODE` を `"disabled"` に戻す PR → マージ（数分で Production に反映） | ボタンが消える。作成済みの Google のユーザーとデータは残る（ログインの手段だけ消える） |
| Google の側の問題・シークレットの漏えい | Supabase → Providers → Google を Disable（即時）。漏えいなら Google Cloud でシークレットを無効化して作り直す | Google のログインが即時に止まる。画面のボタンは失敗の文を出す（上の PR も行う） |
| 誤ったリンク・統合 | Supabase の Users の画面で該当の identity を確認し、本人の判断で unlink（運営者の手動）。TeamAIXI のデータは自動では統合していないため、端末内のデータは影響なし | — |

コードの変更（このブランチ）は既定で無効なので、マージしても Production の挙動は変わらない（black-box: 既定・無効の 3 項目）。

## 9. 残るリスク

- **Supabase の自動リンク**（§2.3）: 既存のメールのアカウントと同じメールの Google は同じ user になる可能性。Production で有効にする前に §7-4 で確認。
- **アカウントの削除が未実装**: Google で誰でもアカウントを作れるようになると、削除の依頼が増える。Production の DB 関数か Edge Function が必要
  （本番の権限・スキーマの変更・本人の承認）。一般公開の前に実装するのが望ましい。
- **新規登録の一般公開**: Google を有効にすると一般の利用者がアカウントを作れる。利用規約・プライバシーポリシーの「アカウント」の記述
  （Google から受け取る情報: メール・名前・アイコン。使う目的）を公開の前に確認する。
- **アプリ内ブラウザー**: Google は WebView でのログインを拒否する（`disallowed_useragent`）。失敗の文は出るが、「ブラウザーで開く」の案内は未実装。
- **Preview で試せない**: Redirect URLs に Preview を入れない方針のため、Google のログインは Preview の URL では失敗する（ローカルと Production で確認）。
- **独自ドメインへの移行**: `teamaixi.com` に移るとき、Google の JavaScript 生成元・Supabase の Site URL と Redirect URLs・`NEXT_PUBLIC_SITE_URL` を同時に更新する。
- **Google の OAuth 同意画面の「テスト」**: テストのままだとテストユーザー以外はログインできず、リフレッシュの期限も 7 日。公開の前に「本番環境に公開」。
- **パスワードでログインする既存のメンバー**: 再設定の導線を外すため、パスワードを忘れた場合は `/auth/forgot-password` を直接開くか運営者の対応
  （組み込みのメールはメンバーには届く）。

## 10. 変更したファイル（このブランチ）

`src/lib/supabase/oauth.ts`（新）・`src/components/auth/GoogleSignInButton.tsx`（新）・`SignInView.tsx`・`SignUpView.tsx`・`AccountView.tsx`・
`LocalDataMigrationView.tsx`・`src/app/auth/callback/route.ts`・`src/lib/supabase/email-link.ts`・`src/lib/supabase/client.ts`（テストダブルの型）・
`src/lib/local-storage-scope/{backup,migration-execute,legacy-detect}.ts`・辞書（auth 12 言語・localDataMigration ja/en）・テスト・
`scripts/black-box-auth-google.mjs`（新）・`scripts/lib/headless-chrome.mjs`（テストダブルに `signInWithOAuth`）。
