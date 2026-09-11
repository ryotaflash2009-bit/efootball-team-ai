# 現行アーキテクチャ監査

調査日: 2026-09-11。正本ワークスペース `C:\Development\eFootball-Team-AI` を対象に、コードとファイルシステムを直接確認した結果のみを記載する(推測は含めない)。

## 1. フレームワーク構成

| 項目 | 内容 |
|---|---|
| Next.js | `^15.5.0`(`package.json`) |
| ルーティング方式 | **App Router**(`src/app/` 配下。Pages Routerは未使用) |
| React | `19.0.0` |
| TypeScript | `5.7.3` |
| パッケージマネージャ | npm(`package-lock.json`のみ存在。yarn/pnpmロックファイルなし) |
| モジュール形式 | ESM(`"type": "module"`) |
| ローカル実行時のNode.js | `v24.20.0`(開発機で確認した実測値) |
| `engines`指定 | **なし**(`package.json`に`engines`フィールドが存在しない → デプロイ先が自動選択するNode.jsバージョンに依存する) |

## 2. Server Component / Client Component の利用状況

- `src/app/layout.tsx`はServer Component(既定)。`LocaleProvider`・`AppShell`をラップするのみ。
- 各`page.tsx`は基本的にServer Component(`export const dynamic = "force-static"`が多数の静的ページで指定されている)。
- 実際の画面ロジック(状態・イベントハンドラ・localStorage読み書き)を持つコンポーネントは明示的に`"use client"`を宣言している(`AppShell.tsx`・`Header.tsx`・`Footer.tsx`・`Sidebar.tsx`・`*View.tsx`系すべて)。
- **API ルートからのデータ取得は、クライアント側コンポーネントが`fetch("/api/...")`で行うパターンが主**(Server Component側でSQLiteへ直接アクセスして初期HTMLへ埋め込む設計にはなっていない画面が多い。例: My Team・AIベスト11・比較画面はすべてクライアント側`fetch`)。
- 一部のAPI ルート(選手詳細・監督詳細等)はServer Component用の直接呼び出し経路を持たず、常にHTTP経由。

## 3. APIルート一覧(`src/app/api/`)

| ルート | 用途 | `runtime`指定 |
|---|---|---|
| `/api/players` | 旧eFHUBサンプルデータ(`players.sample.json`)検索(レガシー機能。据え置き) | 既定 |
| `/api/players/[id]` | 同上・個別取得 | 既定 |
| `/api/player-image/[id]` | 旧サンプル用の選手画像を`efimg.com`から取得して中継する自前プロキシ | 既定 |
| `/api/managers` | SQLite上の監督データ一覧 | `nodejs` |
| `/api/managers/[managerId]` | 監督個別データ | `nodejs` |
| `/api/world/players` | SQLite上のWorldカード検索・一覧 | `nodejs` |
| `/api/world/players/[worldCardId]` | Worldカード個別詳細(26能力値含む) | `nodejs` |
| `/api/world/players/by-ids` | Worldカードの複数ID一括取得(要約のみ、能力値なし) | `nodejs` |
| `/api/world/player-image/[worldCardId]` | SQLiteに保存済みのWorld画像URL(許可ホストのみ)を取得して中継する自前プロキシ | `nodejs` |
| `/api/build-intent/extract` | 自由記述からの育成意図抽出(ルールベース、外部通信なし) | `nodejs` |
| `/api/data-status` | データ取得状況の確認用エンドポイント | 既定 |

`middleware.ts`・`instrumentation.ts`は**存在しない**(認可・共通ログ処理を差し込む共通レイヤーが現状ない)。

## 4. SQLiteの利用方法(最重要・ホスティング判断に直結)

- ファイル: `data/efootball.db`、実測サイズ **約91.6 MiB(96,051,200バイト)**。
- ドライバ: **Node.js 24の組み込み実験的モジュール `node:sqlite`**(`DatabaseSync`)。`better-sqlite3`等の外部npm依存は**使用していない**。
- 接続方式: `readOnly: true`で開き、**プロセス内で1接続だけを保持**(リクエストごとに開閉しない、`src/lib/world/db.ts`)。
- 書き込みは一切行わない(選手・監督データの更新は、別途の同期スクリプト(`scripts/fetch-player-index.mjs`等)がオフラインで行い、Production運用中のAPIルートはREADのみ)。
- Node.js公式ドキュメント上、`node:sqlite`は2026年9月時点で**安定度 1.2(Release Candidate)= まだ完全な安定版ではない**ことを確認した(Node.js v26.8.2ドキュメント、`nodejs/node` issue #57445)。将来のNodeマイナー/メジャーバージョンでAPIが変わる可能性が残る。
- 一般に「SQLiteはサーバーレスで使えない」という情報が広く流通しているが、これは**書き込み用途**の場合の制約であり、Vercel公式ナレッジベースでも「**読み取り専用でデプロイ成果物に同梱するSQLite**」は許容パターンとして明記されている。本プロジェクトのSQLiteはまさにこの「読み取り専用・同梱」パターンに該当するため、方式自体は技術的に成立し得る。ただし以下は実機検証が必要な未確認事項:
  - 91.6 MiBのファイルをサーバーレス関数の成果物へ同梱した場合の起動時間(コールドスタート)への影響。
  - ホスティング先のNode.jsランタイムが`node:sqlite`をサポートするバージョンであるか(後述の「ホスティング候補比較」参照)。
  - `readOnly: true`で開いたSQLiteファイルに対する`node:sqlite`のファイルロック挙動が、複数の同時実行インスタンス(サーバーレスのスケールアウト)下で問題を起こさないか。

## 5. Production Buildと起動方法

- ビルド: `npm run build`(= `next build`)。今回の一連のタスクで複数回実行し、**34ルート生成・PASS**を確認済み(静的ページと動的APIルートが混在)。
- 開発起動: `npm run dev`(= `next dev`)。
- 本番起動(現状の検証方法): `npm run start`(= `next start -p 3000`)。**これは「本番相当のNext.jsサーバーをローカルで起動する」方法であり、インターネット上へ公開する本番ホスティングではない。**
- `next.config.mjs`は`reactStrictMode: true`のみを設定し、`output: "standalone"`等のデプロイ形式指定は**行っていない**。

## 6. 環境変数の利用状況・秘密情報の有無

- コード全体を検索した範囲で、**`process.env`を秘密情報(APIキー・DB接続文字列・パスワード等)の目的で参照している箇所は存在しない**。
- `.env`系ファイルは**存在しない**(`.env`, `.env.local`等をワークスペース直下で確認したが見つからなかった)。
- `src/lib/ai/build-intent-extractor.ts`のコメントに「AIプロバイダー・APIキー・環境変数・サーバー側AIクライアントのいずれも存在しない」という明示的な設計根拠が残っている(意図的にゼロ)。
- **結論: 現時点で保護すべき秘密情報はコード内に一切存在しない。** 将来認証・DB接続を導入した時点で、初めて秘密情報管理が必要になる。

## 7. Gitの利用状況

- **`.git`ディレクトリは存在しない。** 正本ワークスペースはバージョン管理下に置かれていない。
- これは今後の設計において極めて重要な事実であり、「1. Gitと秘密情報の監査」(実装ロードマップ)は文字通り「Gitリポジトリの初期化そのもの」から始まる。
- GitHubへの公開・リモートリポジトリの有無も未確認(ローカルにGit管理自体がないため、当然リモートも存在しない)。

## 8. CI/CD設定の有無

**存在しない。** `.github/workflows/`ディレクトリ、`.gitlab-ci.yml`、`azure-pipelines.yml`等のCI定義ファイルはいずれも見つからなかった。

## 9. Docker設定の有無

**存在しない。** `Dockerfile`・`docker-compose.yml`等は見つからなかった。

## 10. 本番ホスティング設定の有無

**存在しない。** `vercel.json`・`wrangler.toml`(Cloudflare)・`staticwebapp.config.json`(Azure Static Web Apps)等のホスティング設定ファイルはいずれも見つからなかった。

## 11. エラー監視の有無

**存在しない。** Sentry・Rollbar等のSDKは`package.json`の依存関係に含まれておらず、コード内にも初期化処理は見つからなかった。

## 12. アクセス解析の有無

**存在しない。**(Google Analytics・Plausible等のスクリプト・SDKは未検出。前回フェーズの調査結果と一致)

## 13. ログ管理の有無

- アプリケーションコードには構造化ログの仕組みはなく、開発中は`console.log`とシェルのリダイレクト(`data/*.log`)で手動運用している。
- `data/`直下には開発セッション中に生成された大量の一時ログファイル(`dev-*.log`, `build-*.log`, `verify-*.log`等、100件超)が残っている。これらは**このタスクの対象外**(削除・整理は今回行わない。将来Git管理を始める際に`.gitignore`へ含めるべき対象として記録するに留める)。

## 14. バックアップ機構の有無

**存在しない。** `scripts/`配下にSQLite・localStorageデータの自動バックアップスクリプトは見つからなかった(`migrate-cards-to-sqlite.mjs`は一度限りのデータ移行スクリプトであり、定期バックアップではない)。ユーザーの保存データ(localStorage)については、既存の「データ管理」ページ(`/data-management`)がJSONエクスポートを案内する形で手動バックアップ手段を提供している。

## 15. パッケージ依存関係

```
dependencies: next(^15.5.0), react(19.0.0), react-dom(19.0.0), zod(3.24.1)
devDependencies: @types/node, @types/react, @types/react-dom, autoprefixer, eslint,
                 eslint-config-next, postcss, tailwindcss, typescript, vitest
```

外部AI SDK(openai, @anthropic-ai/sdk等)、認証SDK、DB接続ライブラリ(pg, mongodb等)は**一切含まれていない**。

## 16. localStorage保存データの詳細調査と分類

コード全体(`localStorage.getItem/setItem/removeItem`の全呼び出し箇所)を検索し、現在保存されている9個のキーすべてを特定した。各データについて、型・保存キー・保存/読込/削除処理の実装場所・JSON入出力の有無を整理し、将来のクラウド移行に向けて3分類した。

### 分類基準

- **A(アカウントと同期すべきデータ)**: ユーザーが時間をかけて作成した、失うと実害のある「成果物」。複数端末で参照・編集したい動機が明確にあるもの。
- **B(端末ごとの設定としてlocalStorageへ残すデータ)**: UIの見た目・挙動の好みであり、端末ごとに異なっていても不自然ではない、または同期の便益が薄いもの。
- **C(一時状態として永続保存しないデータ)**: 現在は概念的に「戻れる」「作り直せる」ものであり、そもそも長期保存する価値が低いもの。

| データ | 保存キー | 実装ファイル | 型の概要 | JSON入出力 | 分類 | 分類理由 |
|---|---|---|---|---|---|---|
| Favorites | `efootball-team-ai:favorites:v1` | `src/lib/user-cards/favorites-storage.ts` | `worldCardId`の配列 | インポート/エクスポート機構なし(個別追加・削除のみ) | **A** | ユーザーが選手を探して選んだ意思の記録。端末を変えても引き継ぎたい典型的なデータ。 |
| My Team | `efootball-team-ai:my-team:v1` | `src/lib/user-cards/my-team-storage.ts` | `{storageVersion, updatedAt, records: MyTeamRecord[]}`(所有状態・使用状況・選択ビルド参照等を含む) | インポート/エクスポート機構なし | **A** | 所有カード管理という中核機能そのもの。件数が多くなりやすく、手動での再入力は非現実的。 |
| 保存ビルド(`SavedBuild`、`buildIntent`を含む) | `efootball-team-ai:progression-builds:v1` | `src/lib/progression/build-storage.ts` | `{[worldCardId]: SavedBuild[]}`。各`SavedBuild`は育成配分・計算結果キャッシュ・`buildIntent`(育成目的)を内包 | **既存のJSONエクスポート/インポート機能あり**(`BuildExportModal`/`BuildImportModal`) | **A** | 最も作成コストが高いデータ(育成配分を手作業で決める)。既に「バックアップすべき重要データ」として利用者向けに案内している。 |
| 保存スカッド | `efb:squads:v1` | `src/lib/squad/squad-storage.ts` | スカッドごとの編成(フォーメーション・配置・使用ビルド参照等) | インポート/エクスポート機構なし | **A** | 複数選手・複数ビルドを組み合わせた成果物であり、再作成コストが高い。 |
| スカッドテンプレート | `efootball-team-ai:squad-templates:v1` | `src/lib/squad/templates.ts` | 保存スカッドから複製したテンプレート配列 | インポート/エクスポート機構なし | **A** | 保存スカッドと同種の成果物(複製元として保持する設計)であり、同じ理由で同期対象。 |
| 表示言語 | `efootball-team-ai:locale:v1` | `src/lib/i18n/LocaleContext.tsx` | `"ja" \| "en"` | なし | **B** | UIの表示言語という端末側の好み。ブラウザーの`navigator.language`からも自動推定される値であり、同期の必要性が薄い。 |
| サイドバー開閉状態 | `efb:sidebar-collapsed` | `src/components/AppShell.tsx` | `"0" \| "1"`(文字列) | なし | **B** | 画面サイズに依存しやすい表示設定。端末ごとに異なっていて自然。 |
| スカッド編集の表示設定 | `efootball-team-ai:squad-editor-preferences:v1` | `src/lib/squad/editor-preferences.ts` | `{snapEnabled, showGuides, showGrid}` | なし | **B** | コード自身のコメントに「ユーザーUI設定・スカッド固有ではない」と明記された、純粋な表示設定。 |
| スカッド比較の直前状態 | `efootball-team-ai:squad-comparison:v1` | `src/lib/squad/comparison-store.ts` | `{storageVersion, squadIdA, squadIdB, updatedAt}` | なし | **C**(現状はlocalStorageへ保存されているが、性質はC) | コード自身のコメントに「主な状態源はURL。パラメーターなしで来たときの復元用」と明記されている**便宜的な復元ヒント**であり、失っても実害がない(選び直せばよい)。将来的にはクラウド同期対象から明確に除外し、現状のままlocalStorage(またはsessionStorage)に留めるのが妥当。 |

### 現在C(一時状態)として正しく実装されている例(参考)

上記9キーはすべて何らかの形で永続化されているが、「そもそも保存しない」設計が既に多数存在する。例:
- My Teamから保存スカッドへ選手を引き継ぐ際の`pendingWorldCardId`/`pendingBuildId`は**URLクエリパラメータ**として渡され、localStorageへは保存されない。
- 各種確認ダイアログの開閉状態、フォームの入力途中の値は、いずれもReactコンポーネントのメモリ内state(`useState`)であり、ページ遷移や再読み込みで失われる設計になっている。
- これらは将来のクラウド同期設計においても**変更する必要がない**(そのままCとして扱ってよい)。

### まとめ

将来のアカウント同期(クラウドDB)へ移行すべきは **Favorites・My Team・保存ビルド(buildIntent込み)・保存スカッド・スカッドテンプレートの5種類**。表示言語・サイドバー状態・スカッド編集設定の3種類は**端末ローカルのまま(B)**でよい。スカッド比較の直前状態は**将来的に同期対象から除外し、現状同様の軽量な復元ヒントとして扱う(C寄りのB、または将来的にCへ格下げ)**。
