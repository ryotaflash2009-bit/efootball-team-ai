# Preview/Production環境設計・Supabase URL Configuration計画(2026-09-14)

調査日: 2026-09-14。本書は設計のみであり、Vercel・Supabaseいずれの設定も今回変更していない。`ci-cd-and-auto-update.md`(2026-09-11、Git未導入時点の設計)を、現在Gitが導入され認証も実装済みの状態に合わせて更新する。

---

## 1. Git連携とデプロイ設計

### 目標フロー(タスク要求どおり)

```
1. 作業ブランチをpush           → Vercelが自動でPreview Deploymentを作成
2. Pull Requestを作成           → Preview URLがPRへ自動コメントされる(Vercel標準機能)
3. GitHub側の品質ゲート         → Unit Test・Production Build・ブラックボックス・CodeQL
4. 上杉さん本人がPreview URLを確認
5. 問題なければmainへマージ     ← ★人の承認操作そのものが本番反映の引き金
6. マージ後、Production Deploymentが自動実行
```

### Vercel標準Git連携 vs GitHub Actions方式の比較

| 項目 | Vercel標準Git連携 | GitHub Actions経由 |
|---|---|---|
| 設定の簡単さ | **リポジトリをImportするだけ**(追加ワークフロー定義不要) | `.yml`の作成・保守が必要 |
| Preview URL発行 | 標準機能(プルリクエストごとに自動) | 別途Vercel CLIをActions内から呼ぶ実装が必要 |
| 本番デプロイの引き金 | `main`へのマージ(既定) | Actions側で明示的にトリガーを書く必要がある |
| ロールバック | Vercelダッシュボードからワンクリック(標準) | 同様に可能だがActions側の実装次第 |
| 個人開発での運用負担 | **最小** | 中(YAML保守・シークレット管理が増える) |

**推奨: 初期段階ではVercel標準Git連携を採用する。** 理由: 個人開発であり、`ci-cd-and-auto-update.md`が既に指摘する通りGitHub Actions無料枠(2,000分/月、プライベートリポジトリ)を圧迫しやすいブラックボックス935件超の実行を、CI上で毎回自動実行する必要性は薄い。Unit Test・typecheck・lint・Production BuildなどNode.jsだけで完結する軽量なチェックは、将来的にGitHub Actionsへ追加する余地を残すが、**今回は追加していない**(タスク要求どおり)。

### 初回Import時の重要な注意(停止条件に直結)

- Vercelへリポジトリを初めてImportすると、**既定では現在の`main`ブランチが即座にProduction Deploymentとしてビルド・公開される**(Vercelの標準挙動。Production Branchの既定値が`main`であるため)。
- 現状`main`には、`sqlite-production-compatibility-audit.md`で確認した「参照データベース欠落」の問題が未解決のまま残っている。**この状態でImportすると、本番URLが「Worldデータ利用不可」の状態で一般アクセス可能になってしまう**(クラッシュはしないが、主要機能が使えない状態が公開される)。
- したがって、**SQLite方式の判定(本書の親文書`sqlite-production-compatibility-audit.md`)が確定するまでは、Vercel Importそのものを行わないこと**を明確な前提とする。

### Production Branch / Preview Branch

| 環境 | ブランチ | 用途 |
|---|---|---|
| Production | `main` | 実際の利用者(将来)がアクセスする環境。Vercel既定のProduction Branch設定をそのまま使う |
| Preview | 上記以外の全ブランチ・全PR | 機能ブランチをpushするたびに個別のPreview URLが発行される(Vercel標準) |

### 自動デプロイ・承認ゲート

- **ステージング(Preview)デプロイまでは自動化してよい**(`ci-cd-and-auto-update.md`の既存方針を踏襲)。
- **本番反映は`main`へのマージそのものを承認行為とする**(Vercel側の「Production Deployment承認」機能を別途使うか、GitHub側のPRレビュー・マージ操作を承認とみなすかは実装時に選択。今回は設計のみ)。
- **DBマイグレーション・参照データの本番反映・利用規約変更・料金変更は、`main`マージとは独立して人の承認を必須とする**(`ci-cd-and-auto-update.md`4章を継続適用)。

### Deployment Protection(Preview保護)

- Vercelの「Deployment Protection」機能(Vercel Authenticationまたはパスワード保護)を、Preview環境に対して有効化することを推奨する(15章「ステージング公開範囲」参照)。**具体的な有効化操作はVercelダッシュボード上でユーザー自身が行う**(Claude Codeは実施しない)。

### ロールバック・デプロイ履歴

- サイト本体: Vercel標準の「過去のデプロイへのワンクリック切り戻し」をそのまま使う(追加実装不要)。
- 失敗デプロイの扱い: ビルド失敗時はVercelが自動的にそのデプロイを「Failed」として扱い、直前の正常なProduction Deploymentは変更されない(Vercelの標準挙動)。
- 詳細は`rollback-plan.md`を参照。

### デプロイ後のhealth check

- 主要ルートのHTTP 200確認・簡易な機能スモークを、デプロイ後に人が(将来的にはCIから)実行する運用を推奨(`ci-cd-and-auto-update.md`5章の既存方針を踏襲)。

---

## 2. Supabase環境変数

現在コードが参照している環境変数は以下の2つのみ(`src/lib/supabase/env.ts`調査済み)。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

いずれも`NEXT_PUBLIC_`接頭辞であり、クライアントバンドルに埋め込まれる前提の**公開可能な値**(Supabaseの`anon`/`publishable`キーは、RLSポリシーによる保護を前提に公開されることが設計上想定されている)。**本書には実際の値を記載しない。**

Secret key・service_role・DBパスワード・接続文字列を参照するコードは、コード監査の結果**存在しない**ことを確認済み(`vercel-readiness-audit-2026-09.md`4章)。

### PreviewとProductionで同一Supabase開発プロジェクトを使う場合のリスク評価

| リスク項目 | 内容 |
|---|---|
| Preview URLから開発用Supabaseへ接続する危険 | Preview URLは第三者に推測されにくいがpublicには変わりなく、Deployment Protectionを設定しない限り誰でもアクセスできる。開発用Supabaseに現在保存されているユーザーAの実クラウドMy Team(3件)へ、意図しない第三者がアクセス・変更できる経路には**ならない**(RLSにより認証済みユーザー自身の行にしかアクセスできない設計のため)。ただし、Preview環境が実際の開発用プロジェクトへ接続する以上、**Preview環境での操作(新規登録・データ作成等)がそのまま開発用プロジェクトの実データとして残る**点は明確なリスク。 |
| 複数PR Previewによるテストデータ混入 | 複数のPreview環境が同一Supabaseプロジェクトを共有するため、PRごとのテストで作成したテストユーザー・テストデータが同一プロジェクト内に蓄積し、開発用データと混在する。 |
| Redirect URL増加 | Vercel PreviewはデプロイごとにURLが変わるため、個別URLをSupabaseのRedirect URLsへ都度登録する運用は非現実的。**ワイルドカードパターンでの登録が必要**(後述)。 |
| メール確認リンク・Cookie・RLS・Rate Limits | 標準SMTP(Supabase既定)を使う限り、送信数上限は開発用プロジェクトと共用になる(14章参照)。Cookie・RLSの動作自体は環境によらず同じ設計で機能する。 |
| ユーザーAの実クラウド3件・現在のテストユーザー | Preview・Production問わず同一プロジェクトを使う限り、これらの実データと同じプロジェクトに存在し続ける。誤って本番相当の操作(実データの一括削除等)をPreview環境から行わないよう、**Preview環境での破壊的操作は特に慎重に扱う必要がある**。 |
| 将来の本番プロジェクト分離 | 一般公開段階では、開発用プロジェクトと本番用プロジェクトを分離することを強く推奨する(下記比較参照)。 |

### 比較: A(全環境同一) / B(ローカル+Previewは開発用、Productionは別) / C(完全分離)

| 項目 | A. 全環境同一 | B. Production だけ分離 | C. 完全分離(ローカル/Preview/Production) |
|---|---|---|---|
| 管理対象プロジェクト数 | 1 | 2 | 3 |
| 初期PoC・身内テストの運用負担 | **最小** | 中 | 高 |
| 本番データと開発データの混在リスク | **高い**(現在のユーザーA・Bのデータと本番利用者のデータが同一プロジェクトに同居する) | 低い(本番は独立) | 最小 |
| 費用 | 無料枠1つで足りる可能性が高い | 無料枠2つ、または一方をPro化 | 無料枠3つ、または複数をPro化(コスト増) |
| Redirect URL管理 | localhost + Previewワイルドカード + Production URLをすべて1プロジェクトに登録 | Previewワイルドカードは開発用プロジェクトのみ、Production URLは本番用プロジェクトのみ | 環境ごとに完全に分離した設定 |

**推奨(初期PoC・身内テスト段階): A(全環境同一)。** 理由: `cost-estimate.md`が示す身内テスト規模(5人程度)では、複数プロジェクトを管理する負担がリスクに見合わない。ただし、**一般公開(招待制ベータ以降)へ進む前には、少なくともB(Productionだけ分離)への移行を強く推奨する**。この移行judgment自体は今回のタスクでは行わない(将来の意思決定事項として記録するに留める)。

---

## 3. Supabase URL Configuration計画

### コードから特定した実際のURL構築ロジック

| 用途 | 実装箇所 | 構築方法 |
|---|---|---|
| サインアップ確認メールの遷移先 | `src/components/auth/SignUpView.tsx` | `emailRedirectTo: ${window.location.origin}/auth/callback`(**実行時のオリジンから動的に構築。ハードコードされたlocalhost/本番URLはない**) |
| パスワード再設定メールの遷移先 | `src/components/auth/ForgotPasswordView.tsx` | `redirectTo: ${window.location.origin}/auth/callback?next=/auth/update-password`(同上、動的構築) |
| コールバック後の遷移先検証 | `src/app/auth/callback/route.ts` | `resolveSafeInternalPath()`で内部相対パスのみを許可(open redirect対策済み)。`new URL(next, request.url)`により、**リダイレクト先は常にリクエストを受けた同一オリジンになる**設計。 |

**重要な既存の良い設計**: 上記のとおり、リダイレクトURLはすべて実行時の`window.location.origin`/`request.url`から動的に構築されており、コード内にlocalhost/本番URLのハードコードは存在しない。これは**Preview URLがデプロイごとに変わっても、コード変更なしでそのまま機能する**ことを意味する。**必要なのはSupabase側のURL Configuration設定(許可リストへの追加)だけであり、コード変更は不要と判断する。**

### Supabase側で設定が必要な項目(値の変更はユーザー自身が行う。ここでは設計のみ)

| 項目 | 設定方針 |
|---|---|
| Site URL | **Production URLが正式に決まってから設定する**(タスク要求どおり、確定前に変更しない)。それまでは現在の値(ローカル開発用と推定されるが、実値はここに記載しない)を維持する。 |
| Redirect URLs(localhost) | **削除しない**(ローカル開発を継続するため)。 |
| Redirect URLs(Preview用) | Vercel Previewのドメインパターンに対するワイルドカード(例: `https://<プロジェクト名>-*.vercel.app/auth/callback`。実際のパターンはVercelプロジェクト作成後に確定するドメイン形式に合わせる)を**追加**する。 |
| Redirect URLs(Production用) | Production URLが確定した時点で、完全一致のURL(例: `https://<本番ドメイン>/auth/callback`)を**追加**する。ワイルドカードは使わず、Production用は完全一致に限定することで、無関係なドメインへのリダイレクトを防ぐ。 |

### 変更が必要になった時点でのユーザー案内(1操作ずつ)

Vercelでの実際のPreview/Production URLが確定した段階で、以下を1操作ずつ案内する(**今回はまだ実施しない**)。

1. Supabaseダッシュボード(`supabase.com`)を開く。
2. 対象プロジェクトの「Authentication」を押す。
3. 「URL Configuration」を押す。
4. 現在の「Site URL」の値を確認する(変更はまだしない)。
5. 「Redirect URLs」に、確定したPreviewワイルドカード・Production URLを追加する。
6. 「Save」を押す。

**本番Site URLの変更、localhostのRedirect URL削除はいずれも、今回のタスクでは行わない。**

---

## 4. ステージング公開範囲(初回Preview公開時の方針)

SQLite方式・ライセンスの判断はいずれも解決済み(2026-09-14、`vercel-owner-actions-checklist.md`参照)。将来、アプリ本体のSupabase切替(`app-hybrid-switch-implementation-plan.md`)が完了し、実際にVercel Previewを公開する段階になった時点で適用する方針(**今回は未実施**)。

| 項目 | 方針 |
|---|---|
| 公開範囲 | 初回Previewは**一般公開ではなく、開発者本人だけが確認する技術検証**とする。第三者へURLを配布しない。 |
| Vercel Authentication / Deployment Protection | 有効化を推奨(Preview URLの推測可能性だけに頼らない)。 |
| 検索エンジンindex防止 | Preview URLは既定でVercelにより`noindex`相当の扱いを受けることが多いが、`robots.txt`・`<meta name="robots">`での明示的なnoindex設定の要否は、実際にPreviewを公開する段階で個別確認する。 |
| サイトマップ | Preview環境ではサイトマップを外部へ公開・送信しない。 |
| 外部共有・ログ・個人情報 | Preview環境で作成したテストアカウント・テストデータは実データと同様に扱い、第三者と共有しない。 |
| 問い合わせ先・法務ページ | 現状の`/terms`・`/privacy`・`/support`ページはドラフト段階(既存の`release-readiness`関連文書を参照)。一般公開前に内容の最終確認が必要。 |
| Production URLの扱い | 一般公開の準備が整うまで、Production URLも第三者へ配布しない。 |

**初回Previewでは、第三者へURLを配布しない。検索エンジンへ登録させない。Production URLを一般公開しない。**
