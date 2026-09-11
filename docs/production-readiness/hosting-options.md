# 本番ホスティング候補比較

調査日: 2026-09-11。料金は各社公式サイト・第三者解説記事(2026年時点)に基づく。**契約直前に必ず公式サイトで再確認すること。**

## 1. 前提となる現行構成の制約

`architecture-audit.md`より、ホスティング選定に直結する事実:

- Next.js 15(App Router)、APIルート多数、`node:sqlite`(Node.js組み込み実験的モジュール)で**読み取り専用**の91.6 MiB SQLiteファイルを参照。
- 画像は自前プロキシAPIルート(`/api/player-image/[id]`, `/api/world/player-image/[worldCardId]`)経由で外部ホストから中継。
- 環境変数・秘密情報は現状ゼロ。

## 2. 候補比較

比較対象: **Vercel**、**Cloudflare系構成(Pages + Workers)**、**Azure系構成(Static Web Apps / Container Apps)**。

| 項目 | Vercel | Cloudflare(Pages+Workers) | Azure(Static Web Apps/Container Apps) |
|---|---|---|---|
| Next.js互換性 | **公式フレームワーク開発元。App Router・Server Components・APIルートすべて第一級サポート** | `@cloudflare/next-on-pages`等のアダプタ経由。App Routerの一部機能(特にNode.js APIへの依存が強い機能)に制約が出ることがある | Static Web AppsはNext.jsの一部モードのみ公式サポート。フル機能(APIルート・SSR全般)にはContainer Apps等への切り替えが必要になりやすい |
| APIルート | ✅ ネイティブ対応(Node.js/Edge Functionsを選択可) | Pages Functions/Workers上で動作するが**Node.js APIの互換性はWorkers runtimeの対応範囲に限定される** | Static Web AppsのManaged Functionsで対応可能。フルNode.js環境が必要ならContainer Appsを選ぶ設計になる |
| `node:sqlite`の扱い | Node.jsランタイムを選択すれば技術的には動作しうる(Node.jsバージョンをプロジェクト設定で選択可能。2026年時点でNode 20は10/1に廃止予定、22/24系が主流になる見込み)が、**`node:sqlite`自体がRelease Candidate段階であり、Vercel上での動作は実機検証が必要** | **Cloudflare WorkersはNode.js標準ランタイムではなくV8アイソレートベースであり、`node:sqlite`のような組み込みNode.js APIはそのままでは動作しない**(Node.js互換レイヤーは限定的)。SQLiteを使うならCloudflare独自のD1(SQLite互換のマネージドDB)へ**作り直す**前提になる | Container Apps(コンテナ実行)であればNode.js環境を完全に制御できるため`node:sqlite`も動作しうるが、Static Web AppsのManaged Functions(サーバーレス)は制約が大きい |
| SQLiteの持ち込み方 | 読み取り専用・デプロイ成果物への同梱がVercel公式ナレッジベースでも許容パターンとして記載されている(書き込み用途は不可) | 前述の通りWorkers環境では素のSQLiteファイルを直接扱う想定になっていない(D1への置き換えが実質的な選択肢) | Container Appsならファイルをイメージに含めて読み取り専用で使うことが可能(通常のNode.js環境と同様) |
| 永続ファイル | サーバーレス関数はステートレス(書き込みは永続化されない)。読み取り専用の同梱ファイルは可 | 同様にWorkersはステートレス。永続化にはR2やD1等の別サービスが必要 | Container Appsは永続ボリュームをアタッチ可能(構成次第) |
| 画像プロキシ | ✅ 既存のAPIルートがそのまま動作する見込み(Node.js runtime選択時) | Workers上でも`fetch`ベースの中継は可能(Node.js固有APIに依存しなければ問題は少ない) | Container Apps/Static Web Apps双方で動作可能 |
| 無料枠 | Hobbyプラン: 個人・非商用限定、100時間のFunction実行/月、100 GB帯域 | Workers Free: 1日10万リクエストまで、Pages: 月500ビルドまで | Static Web Apps Free: 個人・評価用途向け(SLAなし) |
| 月額費用(超過時) | Proプラン $20/開発者・月〜(+使用量課金) | Workers Paidプラン 最低$5/月〜(1000万リクエスト/月込み) | Static Web Apps Standard $9/アプリ・月〜。Container Appsは実行時間・vCPU課金の従量制 |
| 帯域 | Pro: 1TB/月込み、超過$0.15/GB | 静的アセット配信は無料枠でも無制限(動的リクエストはWorkers課金対象) | プランにより異なる(要個別確認) |
| ビルド時間 | Hobby: 6,000分/月込み | Pages: ビルド時間はプランにより制限 | Azure DevOps/GitHub Actions側の課金体系に依存 |
| ステージング/プレビュー環境 | ✅ プルリクエストごとの自動プレビューデプロイが標準機能 | ✅ Pagesもプレビューデプロイに対応 | Static Web Appsはプレビュー環境に対応(ステージングスロット) |
| 独自ドメイン・HTTPS | ✅ 無料枠でも対応 | ✅ 無料枠でも対応 | ✅ Standardプラン以降で対応(Freeは制限あり) |
| ログ | 標準のFunctionログ・Observabilityダッシュボード(詳細機能は上位プラン) | Workersのログ(Tail Workers等)、上位プランで拡充 | Azure Monitor/Application Insightsとの統合(別課金) |
| ロールバック | ✅ 過去のデプロイへのワンクリックロールバックが標準機能 | ✅ Pagesも過去デプロイへの切り戻しに対応 | デプロイスロットのスワップ機構で対応可能(構成次第) |
| デプロイの簡単さ | **最も簡単(Next.js公式のため設定がほぼ不要)** | 中(Next.js用アダプタの設定・互換性確認が必要) | 中〜難(Next.jsのフル機能を使うほど構成が複雑になる) |
| 将来の拡張性 | Next.jsの新機能に最速で追従 | エッジ実行に強み(将来的な低遅延配信には有利) | エンタープライズ向け機能・Azure他サービスとの統合に強み |
| 個人開発の運用負担 | **最小**(Next.js作者自身のプラットフォームであり、ドキュメント・実例が最も豊富) | 中(Node.js APIとの非互換に遭遇した場合の調査コストが発生しやすい) | 高(Azureの学習コスト、複数サービス(Static Web Apps + Functions + Container Apps等)の使い分けが必要になりがち) |

## 3. 現行SQLiteをそのまま本番へ持ち込めるか(具体的評価)

| 確認項目 | 評価 |
|---|---|
| サイズ(91.6 MiB) | Vercelのサーバーレス関数は**展開後250 MBまで**が標準上限(2026年時点、Vercel公式ナレッジベース確認)。91.6 MiBはこの範囲に収まるが、Next.js本体・依存関係と合算した合計サイズが250 MBに近づかないか要確認。2026年6月30日以降の新規プロジェクトは大容量Function(Fluid Compute、最大5 GB)へ自動登録されるため、サイズ超過時の逃げ道はある。 |
| 更新方式 | 読み取り専用のまま運用するなら「デプロイのたびにSQLiteファイルを差し替える」形になる。**選手データの更新頻度とサイト自体のデプロイ頻度が結合してしまう**(`ci-cd-and-auto-update.md`で分離方法を設計する)。 |
| サーバーレス制約 | コールドスタート時に91.6 MiBのファイルを毎回読み込む(または関数インスタンスの再利用時のみ再利用)コストが発生する。実測が必要な未確認事項。 |
| `node:sqlite`のランタイム対応 | Node.jsランタイムそのものはVercelでバージョン選択可能(Node 20は2026年10月1日廃止予定、22/24系への移行が既定路線)。ただし`node:sqlite`自体がRelease Candidate(未安定)であるため、**選定前に実機での動作検証(技術検証タスク)が必須**。 |

**結論: 「動く可能性は高いが、契約前に必ず実機検証すべき」という評価に留める。断定はしない。**

## 4. 所見(次章「推奨構成」で最終判断)

- Next.jsとの親和性・個人開発の運用負担の観点で、**Vercelが最有力**。
- Cloudflareは魅力的な無料枠を持つが、`node:sqlite`との非互換リスクが本プロジェクト特有の障害になり得る(D1への作り直しは本タスクのスコープ外の大改修になる)。
- Azureは将来のエンタープライズ拡張には強いが、個人開発の初期段階では学習コストが見合わない可能性が高い。

出典:
- Vercel料金・Function制限: Vercel公式ドキュメント(`vercel.com/docs/functions/limitations`, `vercel.com/kb/guide/troubleshooting-function-250mb-limit`)、複数の第三者解説記事(2026年時点)
- Vercel Node.jsバージョン方針: Vercel公式Changelog(`vercel.com/changelog/node-js-20-is-being-deprecated`)
- Cloudflare料金: Cloudflare公式ドキュメント(`developers.cloudflare.com/workers/platform/pricing/`)、複数の第三者解説記事(2026年時点)
- Azure料金: Microsoft Azure公式ページ(`azure.microsoft.com/en-us/pricing/details/app-service/static/`)
- `node:sqlite`とサーバーレスの一般的な制約: Vercel公式ナレッジベース(`vercel.com/kb/guide/is-sqlite-supported-in-vercel`)、Node.js公式ドキュメント(`nodejs.org/api/sqlite.html`)、`nodejs/node` issue #57445
