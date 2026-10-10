# Google ログイン: 本人の操作（TeamAIXI 専用の Google Cloud プロジェクトで・2026-10-11）

対象: **TeamAIXI**（`https://efootball-team-ai.vercel.app`・Supabase `kbauokzninaervjgwzdd`）だけ。他のプロダクトのプロジェクト・クライアント・
テストユーザー・値を使わない・混ぜない。所要 15〜20 分。Client ID と Secret は、手順 9 の Supabase の画面に直接貼るだけ（チャット・メモ・
GitHub・Vercel・スクリーンショットに残さない）。

前回の設定は、別のプロダクト用だった可能性のあるプロジェクト（My First Project）に作られたため、**新しい専用のプロジェクトで最初からやり直す**。
古いプロジェクトのクライアントは、新しい設定で動くことを確かめた後に本人の判断で削除する（先に消さない）。

## Google Cloud

1. https://console.cloud.google.com/ を開き、画面の上のプロジェクトの名前（「My First Project」等）を押す → 右上の「新しいプロジェクト」。
2. プロジェクト名: `TeamAIXI` → 「作成」。作成の通知が出たら、上のプロジェクトの名前が **TeamAIXI** になっていることを確認（違えば押して選ぶ）。
   **以後の手順は、上に TeamAIXI と出ている状態でだけ行う。**
3. 左上の「≡」→「API とサービス」→「OAuth 同意画面」（「Google Auth Platform」と出たら「開始」）。
   - アプリ名: `TeamAIXI`／ユーザー サポートのメール: 自分のメール →「次へ」
   - 対象: **外部** →「次へ」／連絡先: 自分のメール →「次へ」→ 同意にチェック →「作成」
4. 左の「対象」（または「テストユーザー」）→「+ Add users」→ 自分の Google アカウントのメール → 保存。公開ステータスは **テスト** のまま（変えない）。
5. 左の「データアクセス」→「スコープを追加または削除」→ `openid`・`.../auth/userinfo.email`・`.../auth/userinfo.profile` の 3 つだけにチェック → 更新 → 保存。
   他のスコープは追加しない。ロゴは追加しない（追加すると審査が必要になる）。
6. 左の「クライアント」→「+ クライアントを作成」→ アプリケーションの種類 **ウェブ アプリケーション**／名前 `TeamAIXI Web`（自分用の名前・何でもよい）。
7. 「承認済みの JavaScript 生成元」→「+ URI を追加」→ `https://efootball-team-ai.vercel.app`
8. 「承認済みのリダイレクト URI」→「+ URI を追加」→ `https://kbauokzninaervjgwzdd.supabase.co/auth/v1/callback` →「作成」。
   クライアント ID とシークレットが表示される画面は**開いたまま**にする。

## Supabase

9. https://supabase.com/dashboard → プロジェクト `kbauokzninaervjgwzdd` → 左の Authentication → Sign In / Providers → **Google**。
   - Client IDs: 手順 8 の画面のクライアント ID を貼る（前の値があれば**置き換える**）
   - Client Secret (for OAuth): 手順 8 の画面のシークレットを貼る（前の値があれば置き換える）
   - Skip nonce checks: オフ／Allow users without an email: オフ → **Save**
   - 画面の「Callback URL (for OAuth)」が手順 8 の URI と同じことを目で確認。
10. 他の設定（Redirect URLs・Confirm email・Allow new users to sign up・Manual linking・Anonymous）は前回の確認のまま変えない。
11. Google Cloud の手順 8 の画面を閉じる（シークレットはもう表示しない）。

## Claude Code へ送る報告（コピーして、□ を ☑ にする）

```
TeamAIXI専用のGoogle Cloudプロジェクトで設定しました。
□ 画面上のプロジェクト名が TeamAIXI の状態で作業した
□ 同意画面: 外部・テスト・アプリ名 TeamAIXI
□ テストユーザーに自分のGoogleアカウントを追加した
□ スコープは openid・email・profile の3つだけ（ロゴなし）
□ ウェブ アプリケーションのクライアントを作成した
□ JavaScript生成元 https://efootball-team-ai.vercel.app
□ リダイレクトURI https://kbauokzninaervjgwzdd.supabase.co/auth/v1/callback
□ SupabaseのGoogleに、新しいクライアントのIDとシークレットを入れ直してSaveした
□ シークレットはチャット・GitHub・Vercel・スクショに残していない
```

この報告の後、Claude Code が行う（本人の操作なし）: チェックリストの記録 → ゲート A（LIMITED_OAUTH_TEST_READY）の判定 →
プライバシーポリシーの Google の節（PR #232）のマージ → 限定モードの有効化の PR（`GOOGLE_OAUTH_MODE = "limited"`）→ CI → マージ →
本番で「通常の URL ではボタンなし・`/auth/sign-in?oauthPreview=1` だけボタンあり・noindex」を読み取りで確認。

その後に本人が行う確認（12 項目・`google-oauth-release-gate.md` §6・§8）: `https://efootball-team-ai.vercel.app/auth/sign-in?oauthPreview=1` から
Google でログイン・キャンセル・ログアウトと再ログイン・ゲストのデータの引き継ぎ・PC / iPhone Safari / Android Chrome・既存のメールのアカウントとの衝突・
2 つのアカウントで互いのデータが見えないこと。

## 緊急停止

Supabase → Authentication → Sign In / Providers → Google → オフ → Save（即時）。または Claude Code に「Google を止めて」と伝える
（`GOOGLE_OAUTH_MODE` を `disabled` に戻す PR）。
