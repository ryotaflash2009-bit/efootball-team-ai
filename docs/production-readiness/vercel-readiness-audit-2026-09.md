# Vercel公開互換性監査(2026-09-14 技術検証)

調査日: 2026-09-14。正本ワークスペース `C:\Development\eFootball-Team-AI`(ブランチ`chore/vercel-readiness-audit`、開始HEAD `f315ab9` = main)を対象に、コード・ビルド成果物を直接確認した結果のみを記載する(推測は含めない)。

本書は`architecture-audit.md`(2026-09-11調査)・`hosting-options.md`・`decision-record.md`の続きであり、それらが「未検証」として残した`node:sqlite`のVercel実機相当検証を、Vercelアカウントへ接続せずローカルで可能な範囲まで実施した記録である。**Vercelへの実際の接続・デプロイ・アカウント登録は今回一切行っていない。**

---

## 1. フレームワーク構成(再確認・一部更新)

| 項目 | 内容 |
|---|---|
| Next.js | `15.5.24`(package-lock解決値。`package.json`の指定は`^15.5.0`) |
| React / React DOM | `19.0.0` |
| Node.js(ローカル実行時) | `v24.20.0` |
| `engines`指定 | **なし**(`package.json`に`engines`フィールドが存在しない。デプロイ先のNode.js既定バージョンに依存する) |
| `package-lock.json` | 存在する。`lockfileVersion: 3`(`npm ci`と互換) |
| ビルドコマンド | `next build`(`npm run build`) |
| startコマンド | `next start`(`npm run start`) |
| `output`設定 | **なし**(`standalone`等の指定なし。Vercel標準のGit連携デプロイでは`output`指定は通常不要) |
| `outputFileTracingIncludes` | **なし** |
| `serverExternalPackages` | **なし** |
| `images.remotePatterns` | **なし**(画像は自前プロキシAPI経由のため、Next.js標準の画像最適化は現状未使用) |

## 2. Server/Client Component・APIルート・Middleware

- `architecture-audit.md`(2026-09-11)の記載通り、APIルートは基本的に`export const runtime = "nodejs"`を明示している(13ファイルで確認。Edge Runtimeを指定している箇所は0件)。
- **更新点(重要)**: `architecture-audit.md`は「`middleware.ts`は存在しない」としていたが、現在は`src/middleware.ts`が**存在する**(Supabase Auth導入後に追加)。内容を確認した結果:
  - `@supabase/ssr`の`createServerClient`でCookie経由のセッション更新(`supabase.auth.getUser()`)のみを行う公式パターン。
  - `node:sqlite`・`fs`等のNode専用APIへの依存は**一切ない**(fetchベースの通信とCookie操作のみ)。
  - Next.jsのMiddlewareは仕様上Edge Runtimeで動作するが、上記の理由により**Edge Runtime非互換のコードは含まれていない**。Vercel上でもそのまま動作する見込みが高い。
- `instrumentation.ts`は引き続き存在しない。

## 3. ファイルシステム・プロセス依存の監査

| 確認項目 | 結果 |
|---|---|
| `process.cwd()`依存 | 6箇所(`src/lib/world/db.ts`、画像プロキシ2箇所、`src/lib/players.ts`、`src/lib/efhub/card-store.ts`、そのテスト)。いずれも`path.join(process.cwd(), ...)`でリポジトリ相対パスを組み立てる用途で、Vercelのサーバーレス関数実行環境でも`process.cwd()`はデプロイされたプロジェクトルートを指すため、パスの組み立て方自体に問題はない(後述「ファイルの実体が存在するか」が別問題として残る)。 |
| `__dirname`相当の利用 | テストファイル2件のみ(`REPO_ROOT`算出用)。本番実行コードには影響しない。 |
| Windows絶対パス・ローカルパスのハードコード | **0件**(`src`配下を検索し該当なし)。 |
| 子プロセス起動(`child_process`等) | **0件**(`src`配下)。 |
| 書き込みを伴うファイル操作 | `src/lib/efhub/card-store.ts`に`fs.mkdir`/`fs.writeFile`が存在するが、**`src/app`のどのルートからも呼び出されていない**(grep調査で呼び出し元0件)。コード自身のコメントに「Phase A のカード保存層。Phase C 以降でSQLite/PostgreSQLへ差し替える」とあり、SQLite移行後の**死んだコード**であることを確認した。現状Vercel上で書き込みが発生する経路は**ない**。 |
| 一時ファイル生成 | 上記以外に本番実行コードでの一時ファイル生成は確認されなかった。 |
| ファイル名の大文字小文字衝突リスク | `src`配下の全ファイルパスを小文字化して重複確認し、**衝突なし**(Windowsでは動くがLinuxで壊れる典型パターンは検出されず)。 |
| タイムゾーン依存 | `src/lib/i18n/format.ts`ほか7ファイルが`Intl.DateTimeFormat`/`toLocaleDateString`等を使用し、いずれも明示的な`timeZone`指定なし(実行環境のローカルタイムゾーンに依存)。ローカル開発機(JST)とVercel実行環境(既定でUTC)でサーバー側レンダリング結果が異なる可能性があるが、**実際にSSR側で呼ばれているか、クライアント専用か(`"use client"`配下でマウント後にのみ呼ばれるか)までは今回のコード監査だけでは全箇所を断定できていない**。デプロイ後の表示確認項目として明記する(未確認事項)。 |
| npm ciでのクリーン依存関係インストール前提 | `package-lock.json`(lockfileVersion 3)が存在し、追加のワークスペース設定・privateレジストリ指定等の複雑要因は`package.json`に見当たらない。Vercelの標準ビルド(`npm ci`相当)で解決できる可能性が高いが、**実際に`npm ci`をこのワークスペースで実行する検証はCLAUDE.mdの安全規則(依存関係を無断更新しない)に抵触しうるため今回は実施していない**(`npm install`は既存の`node_modules`を前提に普段使っており、`npm ci`は`node_modules`を作り直す破壊的性質があるため)。 |

## 4. 環境変数・秘密情報

- `process.env`を秘密情報目的で参照している箇所は`src/lib/supabase/env.ts`系のみで、参照する変数名は`NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(いずれも`NEXT_PUBLIC_`接頭辞=クライアントに埋め込まれる前提の公開可能な値)。
- Secret key・service_role・DBパスワード・接続文字列を参照するコードは**存在しない**(該当パターンの`git grep`で0件)。
- `.env.local`はGit追跡対象外(`.gitignore`の`.env.*`ルールで除外、`!.env.example`のみ例外)。
- `.env.example`は実値を含まないテンプレートとして存在する。

## 5. Linux本番環境で失敗し得る箇所(一覧)

| # | 箇所 | リスク内容 | 深刻度 |
|---|---|---|---|
| 1 | `data/efootball.db`がGit未追跡(詳細は`sqlite-production-compatibility-audit.md`) | Vercelのビルドはこのリポジトリをcloneして行うため、**ファイル自体が存在せず、World/監督関連の全機能が本番で動かない** | **重大(デプロイ阻害)** |
| 2 | `src/data/players.sample.json` / `meta.json`がGit未追跡 | 旧eFHUBサンプル依存のレガシー`/players`系ルートが空データ状態になる。ただし`readJsonIfExists`が安全に「データなし」を返す設計のため、**クラッシュはしない(空表示に留まる)** | 中 |
| 3 | `node:sqlite`がNode.js実験的モジュール(Release Candidate) | `nodejs/node` issue #57445等でRC段階と確認済み(`architecture-audit.md`)。Vercelの提供するNode.jsランタイムでの動作保証は公式に明記されていない | 中〜高(実機検証必須) |
| 4 | タイムゾーン依存の日付表示 | 上記3章参照。SSR側で呼ばれる箇所がある場合、ローカル(JST)とVercel(既定UTC)で表示が数時間ずれる可能性 | 低〜中(表示のみ、機能停止ではない) |
| 5 | Middlewareの広いmatcher | 静的アセットを除く全リクエストで`supabase.auth.getUser()`を呼ぶため、Supabase未設定環境(環境変数未設定時)は早期returnで安全だが、**Preview環境で開発用Supabaseの認証エンドポイントへ毎リクエスト問い合わせが発生する**(後述「Supabase環境分離」参照) | 低(機能面は安全、レート制限の考慮が必要) |

## 6. ローカルでのVercel類似検証(実施結果)

Vercelアカウントへ接続せず、以下をこのワークスペース内(Windows上)で実施した。

| 検証項目 | 結果 |
|---|---|
| クリーンなProduction Build | `npm run build`成功。43ルート定義ファイル・44 Route(app)行、変化なし。 |
| Node File Trace(`.nft.json`)によるファイル追跡確認 | `.next/server/app/api/world/players/route.js.nft.json`を直接読み取り、**`data/efootball.db`が実際にファイル一覧へ含まれることを確認した**(`../../../../../../data/efootball.db`)。Next.jsの自動トレースは`process.cwd()`経由の動的パスアクセスも検出できており、`outputFileTracingIncludes`の追加設定なしでも技術的にはトレース対象になる。**ただし、ファイルがGitリポジトリに存在しなければ、Vercelのビルド環境にはそもそも存在せず、トレースする対象自体がない**(この点が最大の実質的ブロッカー)。 |
| トレース対象ファイルの合計サイズ | 上記1ルートについて、トレース済み全ファイルの実サイズ合計は**約92.7 MiB**(DB本体91.6 MiB+ルート本体・依存モジュール)。Vercelの旧来のサーバーレス関数展開後サイズ上限(250 MB、`hosting-options.md`引用)には収まる。ただしSQLiteへアクセスするAPIルート・ページは7経路確認されており(後述)、Vercelの関数バンドル方式次第では**経路ごとに個別にファイルが複製され、デプロイ全体の合計サイズが数百MBへ積み上がる可能性がある**(重複排除の有無は実デプロイでの確認が必要、今回は断定しない)。 |
| DB欠落時の安全なエラー | `data/efootball.db`を一時的にリネーム(削除ではない)し、隔離した`next start`インスタンスで検証。`/api/world/players/{id}`は**HTTP 503**、レスポンスは`{"error":{"code":"WORLD_DATA_UNAVAILABLE","message":"World データがまだ用意されていません。"}}`のみで、パス・SQL・スタックトレースは一切含まれない。ページ側(`/players/world/{id}`)もHTTP 200で安全な非表示状態になることを確認した(クラッシュしない)。検証後、ファイル名を直ちに元へ戻し、`PRAGMA integrity_check`(`ok`)と行数(`world_player_cards=13009`)を再確認して実データに影響がないことを確認した。 |
| 読み取り専用アクセスの確認 | `src/lib/world/db.ts`のコード監査により、接続は常に`{ readOnly: true }`で開かれ、書き込みAPI(`run`/`exec`等の変更系メソッド)の呼び出しは全体で0件であることを確認した(コードレビューによる確認。実データベースファイルへの書き込み権限を意図的に奪う形での実行検証は、正本データ破損リスクを避けるため今回は実施していない)。 |
| WAL/SHM/journalファイル | `data/`直下に`.db-wal`・`.db-shm`・`.db-journal`は存在しない(単一ファイル完結、読み取り専用運用と整合)。 |
| 複数インスタンス間の同時アクセス | ローカルでの単一プロセス実行のみ検証可能であり、**Vercelのサーバーレス関数が複数インスタンスへスケールアウトした場合の同一ファイルへの同時読み取り挙動は、ローカル環境では再現・検証できない**(不可能な項目として明記)。 |
| コールドスタート相当の計測 | ローカルSSD・OSキャッシュが温まった状態で、DB接続オープンからクエリ実行までミリ秒単位(0〜2ms)で完了することを計測した。ただし**これはVercelの実際のサーバーレス関数のコールドスタート特性(初回ディスクI/O)を代表する数値ではない**。実測にはVercelへの実デプロイが必要であり、今回は接続前段階のため実施していない(不可能な項目として明記)。 |
| 主要ページ・APIの回帰 | Production Build上で以下すべてがHTTP 200で応答することを確認済み(ブラックボックス詳細は`docs/black-box-tests/`参照): 選手一覧・選手詳細・監督一覧・監督詳細・My Team・My Builds・お気に入り・保存スカッド・スカッドテンプレート・AIベスト11・診断・認証画面・アカウント画面・My Teamクラウド画面・移行センター。 |
| Build Analysis | 個別の性能プロファイリングツールは導入されていない。既存のブラックボックス・Unit Testの通過をもって機能面の回帰なしとした(専用のビルド分析は今回のスコープ外)。 |

### 実施できなかった項目(正直な開示)

- `output: "standalone"`成果物そのものの生成・調査は、`next.config.mjs`の一時変更が必要になるため、「アプリ本体をVercel向けに変更しない」という今回の方針を優先し、**実施していない**。代わりに、`output`設定の有無に関わらずNext.jsが標準生成する`.nft.json`(Node File Trace)を直接読み取ることで、同等の「どのファイルが追跡されるか」という情報を取得した。
- Vercelの実際のサーバーレス実行環境(ファイルシステム特性、コールドスタート、複数インスタンス)は、ローカルWindows環境では原理的に再現できない。

## 7. 総合所見

- コード側の設計(読み取り専用アクセス・単一接続・安全なエラーハンドリング・書き込み経路ゼロ)は健全であり、**実装品質そのものに欠陥はない**。
- 最大のブロッカーは技術的な非互換ではなく、**「参照データベースがGitリポジトリに存在しない」という運用上の事実**である。これはVercelがGitリポジトリからビルドする以上、`outputFileTracingIncludes`等のいかなる設定によっても回避できない(トレース対象ファイルがそもそもチェックアウトされないため)。
- **追記(2026-09-14、Vercel公式情報を直接確認)**: Vercel公式ナレッジベース自体が「SQLiteは使えない」と無条件に明言していることを確認した。読み取り専用・同梱という運用は技術的に動作させたコミュニティ事例はあるが、Vercel公式が推奨する構成ではなく、コミュニティ報告のサイズ上限(100MB)に対し現在のDB(約96.05 MB)がほぼ限界であることも判明した。詳細・出典は`sqlite-production-compatibility-audit.md`7章を参照。
- 総じて、SQLiteをそのまま同梱する方式(判定Aに相当する構成)の見込みは、当初の想定より悪化したと判断する。
- **追記(2026-09-14、方針決定・実行済み)**: 上記を踏まえ、SQLite同梱は正式に不採用と決定した。参照データをSupabase Postgres `reference_data`スキーマへ移行し、実際に投入・検証を完了した(13,009/66/19件、Database Size 0.049 GB、`reference-data-sql-execution-log.md`)。**アプリ本体の読み取り元はこの追記時点でもまだSQLiteのままであり**、Supabaseへの実際の切替は`app-hybrid-switch-implementation-plan.md`の計画に基づき次の作業ブランチで実施する(本監査ブランチでは未着手)。この切替が完了するまで、本ブロッカーはVercelデプロイ前の未解決事項として扱う。
