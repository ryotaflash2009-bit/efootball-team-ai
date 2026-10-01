# eFootball Team AI

eFootball（サッカーゲーム）の選手・監督・ブースター・Tier データを集約し、
検索・比較・育成・スカッド編成を行える Web サービス。
最終目標は「ユーザーの目的・所持選手・コイン数・戦術を理解し、根拠付きで助言する AI サービス」。

- UI と機能の基準: **eFHUB**
- 主要データソース: **eFHUB**
- 補完・照合データソース: **eFootball World**
- 通常の画面表示: **自前データ**（外部サイトを毎回は呼ばない）

> 招待ベータの準備中です（2026-10-01）。機能ごとの状態は [`docs/product/feature-ledger.md`](docs/product/feature-ledger.md)、
> 実装順は [`docs/product/integrated-roadmap.md`](docs/product/integrated-roadmap.md) が正本です。全体の設計は
> [`docs/efootball-team-ai-design.md`](docs/efootball-team-ai-design.md) にあります。

---

## 現在の実装範囲（概要。詳細は機能台帳）

- 選手（World カード 13,297 枚）・監督の検索と詳細、選手比較（2〜4 人）、育成シミュレーション（能力値を直接タップする育成 UI）
- My Team・お気に入り・My Builds・ビルド分析・ビルドの JSON export / import
- スカッド編成・テンプレート・スカッド比較・スカッド診断（通常 / 辛口コメント・共有 URL・画像保存）・診断履歴・改善前後の比較・成長プロフィール
- AI ベスト 11（ルールベース）、基礎能力値のパーセンタイル・称号・バッジ・「あなたの一番」
- 認証（ログイン・パスワード再設定。新規登録は「限定テスト中」）、アカウント別のローカルデータ分離
- 日本語 / 英語、スマホ / PC
- 参照データ: Supabase（本番）。週 1 回の更新検出、承認つきの更新パイプライン

未実装（機能台帳を参照）: コミュニティ・写真付き投稿・友達・ランキング・Tier・ガチャ診断・生成 AI 機能・課金。

利用範囲: 参照データの自動更新が完成・検証されるまで、本人だけで検証する（他人への試用・新規登録・コミュニティ公開はしない）。

---

## 必要なもの

- Node.js 18 以上（開発環境では v24 で確認）
- npm

---

## セットアップと起動（初心者向け手順）

すべて、このフォルダ（`eFootball-Team-AI`）の中で実行します。

```powershell
# 1. 依存パッケージをインストール（キャッシュはこのフォルダ内の .npm-cache/ に限定）
npm install --cache ./.npm-cache --no-audit --no-fund

# 2. （任意）選手データを取得する。eFHUB へ GET 1回だけアクセスし、最大100件を保存する。
#    ネットワークが使えない場合はスキップしてよい（一覧は「データなし」表示になる）。
node scripts/fetch-player-index.mjs

# 3. 開発サーバーを起動
npm run dev
```

起動後、ブラウザで **http://localhost:3000** を開きます。

---

## よく使うコマンド

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバーを起動（コード変更が即反映される） |
| `npm run build` | 本番用にビルドできるか確認する |
| `npm run start` | ビルド結果を起動する（`npm run build` の後） |
| `npm run typecheck` | TypeScript の型エラーを検査する（`tsc --noEmit`） |
| `npm run lint` | ESLint でコードの問題を検査する |
| `npm run test` | Vitest で自動テストを実行する |
| `node scripts/fetch-player-index.mjs` | eFHUB から選手データを取得する（GET 1回・最大100件） |

---

## フォルダ構成

```
eFootball-Team-AI/
├── CLAUDE.md                  安全ルール（変更しない）
├── research.txt               調査資料（変更しない）
├── claude-master-prompt.txt   指示書（変更しない）
├── screenshots/               eFHUB のスクリーンショット（変更しない）
├── docs/
│   ├── efootball-team-ai-design.md  完全設計書
│   ├── efhub-ui-analysis.md         スクリーンショット分析
│   ├── data-verification.md         外部データ調査結果
│   └── progress.md                  進捗記録
├── scripts/
│   └── fetch-player-index.mjs   eFHUB 取得スクリプト（外部 GET 1回）
├── src/
│   ├── app/                  画面と内部API（Next.js App Router）
│   │   ├── layout.tsx        全画面共通の枠
│   │   ├── page.tsx          ホーム
│   │   ├── players/          プレイヤー一覧・詳細
│   │   └── api/              内部API（/api/players など）
│   ├── components/           画面部品（サイドメニュー・カードなど）
│   ├── lib/                  データ取得・検索・並べ替え・型・検証
│   └── data/                 取得した選手データ（JSON）
└── package.json
```

---

## データの扱い

- 画面と内部 API は **外部サイトを直接呼びません**。`src/data/*.json` を参照します。
- 外部データの取得は `scripts/` のスクリプトでのみ行います。
- 取得スクリプトは失敗した場合、ファイルを書かずに終了します（既存データが壊れません）。
- 将来 PostgreSQL へ移行できるよう、データの読み書きは `src/lib/players.ts` の関数に集約しています。

---

## ライセンス / 注意

- 本プロジェクトは個人開発の学習用です。
- eFHUB / eFootball World のデータ利用は各サイトの規約に従ってください（取得頻度を抑え、規約・robots.txt を確認すること）。
- eFootball および関連する名称は各権利者に帰属します。
