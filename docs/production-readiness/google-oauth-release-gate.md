# Google OAuth: 公開のゲート・有効化・緊急停止（2026-10-11）

本人の方針（2026-10-11 の更新）: 必要な設定と限定の本番の確認が済めば、Production ですぐ有効にしてよい（アカウントの削除の完成は待たない。
削除が完成するまでは「運営への連絡で削除」の案内を出す＝実装済み）。Google Cloud・Supabase の操作・Client ID と Secret・規約の同意は本人が行う。

関連: `auth-google-oauth-plan.md`（方針・設計）・`account-deletion-apply-package.md`（削除）・`billing-auth-boundary.md`（将来の課金）。

## 1. ゲート（機械的な判定）

```
node scripts/validate-google-oauth-release.mjs
EVIDENCE_PATH=./docs/production-readiness/evidence/google-oauth-release-gate-<日付>.json node scripts/validate-google-oauth-release.mjs
```

| 段階 | 入力 | 判定 | 意味 |
|---|---|---|---|
| 有効化の前 | コードの自動の確認＋`google-oauth-release-checklist.json` の `preEnable`（9 項目） | `READY_TO_ENABLE` / `BLOCKED` | すべて `pass`（または `n/a`）で、コードの確認が全部合格なら有効化の PR を出してよい |
| 有効化の後 | `postEnable`（12 項目） | `GO` / `NO_GO` / `PENDING` / `NOT_STARTED` | `GO`＝有効のまま。`NO_GO`＝直ちに入口を閉じる（§9） |

- コードの自動の確認: モードの値が `disabled` / `enabled` のどちらか・不明な値は無効（`isGoogleOAuthAvailable` は `"enabled"` だけ）・callback が
  Google の失敗を区別・削除の手動の案内（日本語・英語）・アカウントの画面の削除の入口。
- `NO_GO` になる条件: `postEnable` のどれかが `fail`。特に RLS の分離（`prodRlsIsolationAB`）・既存のアカウントとの衝突・callback・ゲストの引き継ぎ。
  また、コードが `enabled` なのに有効化の前の記録がそろっていない場合（設定の前にマージした）。
- 同じメールの統合は推測で保証しない: `prodExistingEmailConflictRecorded` は `observedLinking`（`linked` / `separate`）を記録しない限り `GO` にならない。
- Evidence に個人情報・秘密情報らしい値（メール・UUID・`apps.googleusercontent.com`・`GOCSPX-`・JWT）を書くと不合格。
- CI の防御（`oauth-release-gate.test.ts`）: コードを `enabled` にする PR は、有効化の前の記録がすべて `pass` でないとテストが失敗する。
- 終了コード: 入口を閉じる必要あり 2・`BLOCKED` 1・それ以外 0。

## 2. callback・PKCE・state・returnTo・open redirect の安全の確認

| 項目 | 挙動 | 根拠・テスト |
|---|---|---|
| PKCE | `@supabase/ssr` の既定（flowType `pkce`）。code verifier はブラウザーの Cookie。callback は `exchangeCodeForSession(code)` | 別のブラウザーで盗んだ code は verifier が無く交換できない（login CSRF・code の注入の防止） |
| state | Google ⇄ Supabase の間の state は Supabase Auth が検証する（アプリは state を扱わない）。アプリ ⇄ Supabase は PKCE の verifier で結びつく | Supabase の標準 |
| returnTo（next） | `resolveSafeInternalPath`: `/` で始まる内部のパスだけ。`//`・`/\`・`://`・空白・制御文字は `/account` | `safe-redirect.test.ts`・`oauth.test.ts`・callback のテスト（`https://evil.example` → `/account`） |
| open redirect | redirectTo は自サイトの `/auth/callback` だけ（origin は `NEXT_PUBLIC_SITE_URL` を優先）。Supabase の Redirect URLs の許可リストが最終の防御 | `buildGoogleRedirectTo` のテスト |
| キャンセル | `error=access_denied`＋`flow=google` → 「キャンセルしました」 | callback のテスト・black-box（日本語・英語） |
| Google 側の拒否・不正な要求 | その他の `error` → 「完了できませんでした」＋開き直しの案内 | 同上 |
| 一時的な障害（`temporarily_unavailable`・`server_error`・5xx・429） | 「認証サービスに一時的に接続できません」/「回数が多すぎます」 | callback のテスト |
| パラメーター不足（code なし） | `oauth_failed` | callback のテスト |
| 期限切れ・code の交換の失敗 | `oauth_failed`（メールのリンクの「期限切れ」の文言と混ぜない） | 同上 |
| 二重の callback・戻るボタン・再読み込み | 同じ code の 2 回目は交換に失敗するが、既にセッションがあれば next へ進む（サーバーの `getUser` で確認） | callback のテスト（2026-10-11） |
| セッションの作成の失敗 | 交換の失敗と同じ（`oauth_failed`）・ゲストのデータはそのまま | — |
| profile の作成 | **該当なし**: TeamAIXI に profile の表は無い（公開プロフィールは未適用の提案）。最初のログインで Supabase が `auth.users` を作るだけ | 有効化の後の確認 `prodAccountRecordCreated` は「Users の画面に 1 件増えた」 |
| RLS の失敗 | ログインは成功し、クラウドの保存（My Team）が失敗の表示（既存）。他人のデータは RLS で読めない | 有効化の後の確認 `prodRlsIsolationAB` |
| ゲストの引き継ぎの失敗 | 失敗の表示・アカウントの領域をバックアップから戻す（既存の仕組み）・ゲストのデータは変えない | `migration-execute.test.ts` |
| 多重のクリック | ボタンは押した後に無効（「Google の画面へ移動しています…」） | `GoogleSignInButton` |
| オフライン・低速の回線 | `signInWithOAuth` の失敗 → 「完了できませんでした」。Provider の状態の確認は 4 秒で打ち切り、ログインは止めない | — |
| Supabase の停止 | Provider の確認が読めない → そのまま進め、Supabase の画面で失敗 → 戻れない場合はブラウザーの戻る。案内: ゲストのまま使える | §9 |
| Google の停止 | Google の画面のエラー → `error` 付きで戻れば「完了できませんでした」 | — |
| Provider を無効（緊急停止） | 押した時点で Supabase の公開の設定を読み、無効なら「一時的に停止しています」（Supabase の生のエラーの画面へ移さない） | black-box（緊急停止の模擬） |
| Cookie の制限（Safari のプライベート・サードパーティ Cookie の制限） | verifier の Cookie はファーストパーティ（自サイト）なので通常は影響なし。保存できない場合は交換に失敗 → 「完了できませんでした」＋開き直しの案内 | — |
| 失敗の後の再試行 | 失敗の画面からそのまま「Google で続ける」を押せる（状態を持ち越さない） | black-box |
| 別のタブ | 別のタブで完了してもセッションは Cookie で共有。元のタブは再読み込みでログイン中 | 有効化の後の確認 |

## 3. 既存のメールのアカウントとの統合（推測で保証しない）

- Supabase は、確認済みの同じメールの identity を同じ user に自動でリンクする仕様とされる（Supabase の文書「Identity Linking」）。
  **この文書は保証しない**。有効化の後の確認で実際の挙動を観測して `observedLinking` に記録する（§7-11）。
- TeamAIXI は、メールの一致で独自にアカウントやデータを統合しない（コードにその処理は無い）。端末のゲストのデータは本人の明示の操作でだけコピーする。
- 既存のアカウントを壊さずに確かめる手順（本人・有効化の直後）:
  1. Supabase → Authentication → Users で、本人のメールのアカウント（以前のメール＋パスワード）の **identities の数**を控える（provider が `email` の 1 つのはず）。
     user ID は控えない（画面で見るだけ）。
  2. そのアカウントでクラウドに My Team を 1 件保存してあるか確認（無ければ保存しておく）。
  3. ログアウト → 同じメールの Google アカウントで「Google で続ける」。
  4. Users の画面: 同じ行の identities が `email`＋`google` の 2 つになった → `linked`。新しい行が増えた → `separate`。
  5. `linked` の場合: アカウントの画面で My Team のクラウドの取得 → 2 の内容が見える（同じ user）。パスワードでのログインも引き続きできることを確認。
  6. `separate` の場合: Google の側は新しい空のアカウント。以前のアカウントはパスワードでログインできる（壊れていない）ことを確認。
  7. 結果を `prodExistingEmailConflictRecorded` に `pass`＋`observedLinking` で記録。想定外（以前のアカウントにログインできない・データが消えた）は `fail` → §9。
- Apple を将来追加する場合: 自動のリンクに頼らない。ログイン中の本人がアカウントの画面で「Apple を追加」→ `linkIdentity`（Supabase の Manual Linking を
  その時に有効化）。Apple の「メールを非公開」はメールが一致しないため、手動のリンクが唯一の統合の方法。最後のログイン手段の解除は禁止。

## 4. アプリ内ブラウザー（LINE・X・Instagram・Discord 等）

- 検出は User-Agent による推測で、**補助の情報**として扱う。ログインは止めない（Google のボタンは出したまま）。外れても通常のログインを試せる。
- 案内: 「アプリの中のブラウザーで開いている可能性があります」＋ OS ごとの手順（iPhone: 「…」/共有 →「Safari で開く」・Android: 「⋮」→「Chrome で開く」・
  その他: 「ブラウザで開く」）。iPhone では「Chrome で開く」のボタンを出さない。
- 外部のブラウザーで開くリンク: LINE は `openExternalBrowser=1`（LINE の機能）・Android は Chrome の intent。iPhone のその他のアプリは自動で開く方法が無いため
  手順と URL のコピー。各アプリの手順は「見つからない場合は URL をコピー」として断定しない。
- コピー・外部で開く URL は origin＋パス＋安全な `next` だけ（認証のコード・エラーの文・callback の URL は含めない。callback の URL は手でコピーさせない）。
- Google の失敗の後は、判定に関係なく「Safari / Chrome で開き直す」の一般の案内。
- Discord・Slack 等の WebView は一般の WebView として検出（iOS: `Safari/` を含まない WKWebView・Android: `; wv)`）。
- アクセシビリティ: 見出し（`aria-labelledby`）・ボタンは実際の `<button>` / `<a>`・コピーの結果は `role="status"`。小さな画面（390px）で横のはみ出しなし。
  色はテーマの変数（ダークモードはサイト全体の設定に従う）。
- 12 言語。

## 5. ゲストのデータの引き継ぎ（検証の範囲）

**前提の整理**: 引き継ぎは端末の中のコピー（ゲストの領域 → そのアカウントの領域）で、**クラウドへは書かない**。クラウドの My Team は別の明示の操作
（アカウントの画面の「クラウドへ保存」）で、RLS（`auth.uid() = user_id`）のまま。したがって「クラウドだけにある」「RLS の拒否」は引き継ぎの対象外。

| ケース | 扱い | テスト |
|---|---|---|
| 対象の種類 | My Team・My Builds・お気に入り・スカッド・テンプレートの 5 種類 | 既存の移行のテスト |
| 0 件 / 1 件 / 多数 | 件数を表示・0 件はボタンを押せない | `migration-preview.test.ts`・black-box |
| 同じ内容 | 「重複」で追加しない | unit |
| 同じ ID で違う内容 | 「競合」で書かない（アカウントの側を上書きしない） | unit・black-box（2026-10-11） |
| ゲストだけ | 「追加」 | unit・black-box |
| 一部だけ衝突 | 追加・重複・競合を種類ごとに件数で表示 | unit |
| 書き込みの失敗（容量の上限等） | `WRITE_FAILED`・何も変えない | unit |
| 検証の失敗 | アカウントの領域をバックアップから戻す（`VERIFICATION_FAILED`・`rolledBack`） | unit |
| 再実行・二重の押下 | ID で判定するので重複しない（2 回目は「重複」） | unit |
| 別のタブ | 各タブが書き込みの直前に読み直す。同じ集合の結果になる | 設計 |
| 途中で画面を閉じる | 書き込みは 1 回の `setItem`（途中の状態なし）。バックアップは一時のキーに残る | 設計 |
| 引き継ぎ中のログアウト | コピー先のキーは実行の開始時に決まる（同じ本人の領域）。他人の領域へは書かない | 設計 |
| 不正なデータ・古い形式 | 読めない記録は「無効」として数え、コピーしない（元は変えない） | unit |
| インポート・共有の URL から復元したデータ | 端末の領域の通常のデータとして同じ扱い | — |
| 同じ選手の別のカード | スカッドはそのままコピー（保存データを勝手に直さない）。エディタが「同じ選手が 2 枚以上」と知らせる | `same-player-rule.md` |
| ゲストのデータを消す | しない（コピーの後も残る） | black-box |
| 所有者 | コピー先のキーは認証済みの user ID のハッシュ（`scope-id.ts`）。他人の領域へは書けない（別の user は別のキー） | 既存のテスト |

## 6. 実機の確認の手順（iPhone Safari・Android Chrome）

各端末で、本人の Google アカウントを使う。結果は `postEnable` の該当の項目へ（個人情報を書かない）。

**iPhone（Safari）**
1. Safari で `https://efootball-team-ai.vercel.app/my-team` を開き、ゲストのまま 1 枚追加する（引き継ぎの確認用）。
2. 右上の「ログイン」→「Google で続ける」→ Google の画面でアカウントを選ぶ → TeamAIXI の「アカウント」の画面に戻る（ログイン中）。
3. 「ゲストとして保存したデータが 1 件」→「ゲストのデータを引き継ぐ」→ My Team を選んで「移行内容を確認」→「新規追加分を移行する」→ 確認の欄 →「移行する」。
4. Safari のタブを閉じ、もう一度サイトを開く → ログイン中のまま（セッションの復元）。
5. アカウントの画面で「ログアウト」→ ゲストに戻る → もう一度「Google で続ける」（再ログイン）。
6. キャンセル: 「Google で続ける」→ Google の画面で左上の「キャンセル」（または戻る）→ TeamAIXI のログインの画面に「キャンセルしました」。
7. （任意）LINE のトークに URL を送ってタップ → アプリ内の案内が出る → 「ブラウザーで開く」で Safari が開く。

**Android（Chrome）**: 上の 1〜6 を Chrome で同じように行う。7 は X のアプリで URL を開き、「Chrome で開く」で Chrome が開くこと。

**PC**: Chrome（または Edge）で 2〜6。

## 7. 有効化の手順（本人の操作の後）

### 7.1 本人の操作（Google Cloud）
1. https://console.cloud.google.com/ → 上部のプロジェクトの選択 →「新しいプロジェクト」→ 名前 `TeamAIXI` → 作成 → 選ぶ。
2. 「API とサービス」→「OAuth 同意画面」（または「Google Auth Platform」→「ブランディング」）: User Type **外部**・アプリ名 `TeamAIXI`・サポートのメールと
   デベロッパーの連絡先は本人のメール・スコープは `openid`・`.../auth/userinfo.email`・`.../auth/userinfo.profile` の 3 つだけ。公開ステータスは
   まず「テスト」（テストユーザーに本人）→ 限定の確認の後に「本番環境に公開」（この 3 つのスコープだけなら審査なし）。
3. 「認証情報」（または「クライアント」）→「認証情報を作成」→「OAuth クライアント ID」→ 種類 **ウェブ アプリケーション**・名前 `TeamAIXI Supabase`。
   - 承認済みの JavaScript 生成元: `https://efootball-team-ai.vercel.app`
   - 承認済みのリダイレクト URI: `https://kbauokzninaervjgwzdd.supabase.co/auth/v1/callback`（Supabase の Google の画面の「Callback URL」と一字一句同じか確認）
4. 表示されたクライアント ID とシークレットを、§7.2 の Supabase の画面に直接貼る（チャット・メモ・Git・スクリーンショットに残さない）。

### 7.2 本人の操作（Supabase）
1. https://supabase.com/dashboard → プロジェクト `kbauokzninaervjgwzdd` → Authentication → Sign In / Providers → **Google** → Enable。
   Client ID（for OAuth）・Client Secret（for OAuth）に §7.1-4 の値 → Save。「Skip nonce checks」・「Allow users without an email」はオフ。
2. Authentication → URL Configuration: Site URL `https://efootball-team-ai.vercel.app`（既にあれば変えない）・Redirect URLs に
   `https://efootball-team-ai.vercel.app/auth/callback**` があることを確認（無ければ追加）。Preview・ワイルドカードの `*.vercel.app` は入れない。
3. Authentication → Sign In / Providers → Email: 「Confirm email」が **オン**（API で直接作られたメールのアカウントが確認済みにならない）・
   「Allow new users to sign up」はオンのまま（オフにすると Google の新規登録も止まる）。Manual Linking は **オフ**。

### 7.3 Claude Code（本人の操作の後）
1. `google-oauth-release-checklist.json` の `preEnable` を本人の報告で更新（個人情報なし）→ `node scripts/validate-google-oauth-release.mjs` が `READY_TO_ENABLE`。
2. `GOOGLE_OAUTH_MODE = "enabled"` の PR → CI（ゲートのテストが有効化の前の記録を確認）→ 通常のマージ → Production の再デプロイの完了を確認。
3. Production の公開の画面の確認（読み取りだけ）: `/auth/sign-in` に Google のボタン・`/auth/sign-up` が Google だけ・パスワードの欄は「以前のアカウント」用。

## 8. 有効化の直後の限定の確認（本人・`postEnable`）

| # | 項目 | 方法 |
|---|---|---|
| 1 | 新規のログイン（`prodNewGoogleLogin`） | PC で本人の Google でログイン（§6 の 2） |
| 2 | callback の成功（`prodCallbackSuccess`） | アカウントの画面に戻り、ログイン中の表示 |
| 3 | アカウントの作成（`prodAccountRecordCreated`） | Supabase の Users に Google の行が 1 件（profile の表は無い） |
| 4 | セッションの復元（`prodSessionRestore`） | タブを閉じて開き直してもログイン中 |
| 5 | ログアウトと再ログイン（`prodLogoutAndRelogin`） | §6 の 5 |
| 6 | ゲストの引き継ぎ（`prodGuestCarryOver`） | §6 の 1・3 |
| 7 | PC（`prodPcBrowser`） | 1〜6 を PC で |
| 8 | iPhone Safari（`prodIphoneSafari`） | §6 |
| 9 | Android Chrome（`prodAndroidChrome`） | §6 |
| 10 | キャンセル（`prodOauthCancel`） | §6 の 6 |
| 11 | 既存のメールのアカウントとの衝突（`prodExistingEmailConflictRecorded`） | §3 の手順・`observedLinking` を記録 |
| 12 | user A と B の RLS の分離（`prodRlsIsolationAB`） | A（Google）と B（別の Google またはメールのアカウント）で、それぞれ My Team をクラウドに保存 → A で B の内容が見えない・B で A の内容が見えない（アカウントの画面の「クラウドから取得」） |

すべて `pass` → `GO`。どれかが `fail` → `NO_GO` → §9。

## 9. 緊急停止と Rollback

| 方法 | 手順 | 反映 | 影響 |
|---|---|---|---|
| **A. Supabase の Google の Provider を Disable**（最速） | Supabase → Authentication → Sign In / Providers → Google → オフ → Save | 即時 | Google での新しいログインが止まる。画面のボタンは「一時的に停止しています」と案内（Provider の状態を確認して Google へ移さない） |
| B. コードを無効に戻す | `GOOGLE_OAUTH_MODE = "disabled"` の PR → マージ（Claude Code でも可） | 数分（再デプロイ） | ボタンが消え、画面は今と同じ（メール＋パスワードの限定のログインだけ） |
| C. シークレットの漏えい | Google Cloud → 認証情報 → クライアント → シークレットを無効化 → 新しいシークレットを Supabase に入れる（または A で止める） | 即時 | — |

既存の利用者への影響（A または B の間）:
- **ログイン中の利用者**: セッションは残る見込み（リフレッシュは Provider を使わないため。Supabase の仕様として、停止の時に本人のアカウントで確認する）。ログアウトすると Google では再ログインできない。
- **Google だけのアカウント**: 停止の間はログインできない（データは消えない・端末のデータは端末に残る）。再開すれば同じアカウントに入れる。
- **メール＋パスワードのアカウント**: 影響なし。
- **自動でリンクされたアカウント**（§3 で `linked`）: パスワードでログインできる。
- 案内: 停止が長引く場合は、サポートのページか X 等で「Google でのログインを一時停止中・ゲストとして利用可能」と告知（本人の判断）。

## 10. GO / NO-GO のチェックリスト

**有効化の前（READY_TO_ENABLE の条件）**
- [ ] Google の同意画面（外部・3 スコープ・テストユーザーに本人）
- [ ] ウェブ アプリケーションのクライアント・リダイレクト URI が Supabase の Callback URL と一字一句同じ
- [ ] Supabase の Google の Provider が有効・Client ID と Secret は Supabase の画面だけ
- [ ] Redirect URLs が `https://efootball-team-ai.vercel.app/auth/callback**` だけ（Preview・ワイルドカードなし）
- [ ] Confirm email がオン・Manual Linking がオフ
- [ ] シークレットがリポジトリ・チャット・スクリーンショットに無い
- [ ] プライバシーポリシーの Google の記述（§11）を本人が確認・反映
- [ ] `node scripts/validate-google-oauth-release.mjs` → `READY_TO_ENABLE`

**有効化の後（GO の条件）**: §8 の 12 項目がすべて `pass`・`observedLinking` を記録。
**NO-GO（直ちに §9 の A）**: 他人のデータが見えた・既存のアカウントにログインできなくなった・callback が失敗し続ける・ゲストのデータが消えた・
同意画面が意図しないスコープを求めた。

## 11. プライバシーポリシーへの追記の下書き（本人の確認の後に反映）

> **Google アカウントでのログイン**: Google アカウントでログインした場合、Google から、メールアドレス・名前・プロフィール画像の URL・Google 内の識別子を
> 受け取ります。受け取った情報は、アカウントの識別とログインのためだけに使い、Supabase（認証の提供者）に保存します。Google のパスワードを本サービスが
> 受け取ることはありません。名前とプロフィール画像は、現時点では画面に表示しません。アカウントを削除すると、これらの情報も削除されます
> （削除の方法は「アカウントの削除について」）。

（反映は `src/lib/i18n/dictionaries/ja-ns/privacy.ts` と各言語。法的な文書のため Claude Code は本人の確認なしに公開の文面を変えない。）
