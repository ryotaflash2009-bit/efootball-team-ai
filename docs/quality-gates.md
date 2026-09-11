# 品質ゲート（Quality Gates）

最終更新: 2026-09-01

コード変更を伴うマイルストーンの品質確認の**単一の真実源**。
使用量削減を理由に、最終品質ゲート・全13ブラックボックス・`npm run verify`・`npm run build`・
SQLite `integrity_check` を任意扱い／省略可にしない。

## 1. 実装中（開発中）

- 変更対象に**直接関係する** unit test を使う（`npx vitest run <path>`）。
- 必要なら `npm run typecheck` を実行できる。
- 実装中に**全 unit test・`npm run build`・全13ブラックボックスを何度も繰り返さない**。
  これは品質確認の省略ではなく、最終品質ゲートで必ず実行する。
- 開発中の軽い HTTP 200 確認（`/`・変更画面・関連 API）は可。
- `next dev` が正常稼働中なら、実装中の不要な停止・再起動をしない。

## 2. 最終品質ゲート（コード／設定／スクリプト／package.json のいずれかに差分があるとき必須）

**稼働中の `next dev` と `npm run build` を同時実行しない。** 次の順序で実行する:

| # | 手順 |
|---|---|
| 1 | `npm run audit:ja-labels` |
| 2 | `npm run verify`（= audit:ja-labels → typecheck → lint → test） |
| 3 | 現在の `next dev` 親 PID・リスナー PID・親子関係・正本ワークスペース所属を再確認 |
| 4 | 確認済み単一 `next dev` 親 PID **だけ**を停止（`Stop-Process -Id <数値> -Force`） |
| 5 | 親・子・npm wrapper の終了とポート 3000 解放を確認 |
| 6 | `./data/server.pid` を `0` へ更新（ASCII・改行なし） |
| 7 | `npm run build` |
| 8 | `npm run start -- -p 3000`（バックグラウンド起動・Ready を待つ） |
| 9 | 主要ページと API の HTTP 確認（§4） |
| 10 | 関連ブラックボックス（変更領域のレール） |
| 11 | **全13ブラックボックスレール**（§5） |
| 12 | SQLite `integrity_check`（§6） |
| 13 | 確認済み単一 `next start` PID **だけ**を停止・npm wrapper も個別 PID 確認で停止 |
| 14 | ポート 3000 解放を確認 |
| 15 | `npm run dev` |
| 16 | `next dev` 親 PID・リスナー PID・親子関係を確認（リスナーは親の子孫） |
| 17 | 親 PID を `./data/server.pid` へ ASCII・改行なしで記録・再読込して一致を確認 |
| 18 | 主要ページと API を再確認 |
| 19 | `./data/dev-err.log` を確認（重大エラーなし） |
| 20 | `next dev` を起動状態で維持 |

build 失敗が環境由来の一時エラーと**明確に判断できる場合だけ**、30 秒待機後に 1 回だけ再試行できる
（同じ原因で 2 回失敗したら停止・`safe-build-and-cache-policy.md` §10）。

## 3. `npm run verify` の重複排除

`npm run verify` は `audit:ja-labels` → `typecheck` → `lint` → `test`（`vitest run`）を順に実行する。

- **`npm run verify` が成功した後は、失敗原因の切り分け・修正後の対象確認・明確な監査目的がない限り、
  `typecheck` / `lint` / 全 unit test / `audit:ja-labels` を理由なく個別に再実行しない。**
- ただし完了報告には verify 内の各結果（audit / typecheck / lint / unit test 件数）を**個別項目として記載**する。
- `verify` 成功後に src / scripts / 設定へ差分を加えたら、`verify` を再度実行する。

## 4. 主要ページと API（最終ゲートの HTTP 確認対象）

- `/`
- `/build-inventory`
- `/my-builds`
- `/my-team`
- `/squads`
- 対象スカッド編集画面（`/squads/sq_blackbox0001` 等の存在しない ID でも 200・soft 404）
- `/squads/compare`
- `/players/world/89138556575063`
- `/compare`（`?ids=89138556575063,88041460996837`）
- `/favorites`
- `/managers`
- `/api/managers`
- `/api/world/players/89138556575063`
- `/api/world/players/by-ids`（`?ids=…`）

**期待**: すべて HTTP 200。`Cannot find module './NNN.js'` / `readlink EINVAL` / `UNKNOWN read` がないこと。

## 5. ブラックボックス（全13レール・維持する）

`scripts/black-box-*.mjs`。`npm run build` → `npm run start -- -p 3000` の後に `node scripts/black-box-<rail>.mjs`。

| レール | スクリプト |
|---|---|
| my-builds | `black-box-my-builds.mjs`（My Builds ＋ My Team 連携 ＋ **保存ビルド棚卸し `/build-inventory`** の SSR 検証を統合） |
| compare | `black-box-compare.mjs` |
| progression | `black-box-progression.mjs` |
| squads | `black-box-squads.mjs` |
| boosters | `black-box-boosters.mjs` |
| world-ui | `black-box-world-ui.mjs` |
| favorites | `black-box-favorites.mjs` |
| ui | `black-box-ui.mjs` |
| managers | `black-box-managers.mjs` |
| manager-picker | `black-box-manager-picker.mjs` |
| phase-b5 | `black-box-phase-b5.mjs` |
| phase-c | `black-box-phase-c.mjs` |
| world-sync | `black-box-world-sync.mjs` |

方針:

- **最終判定は `next start`（本番ビルド）上の結果を正とする。**
- 全13レールを維持する（新機能はまず既存の最も適切なレールへ統合し、無条件に 14 番目のレールを作らない）。
- **開発モード固有の RSC 出力差が既知の場合、開発中に全ブラックボックスを無条件で実行しない。**
  既知の dev 固有差:
  - `/squads/compare?a=…&b=…` の不正パラメーターが **dev モードの RSC flight ペイロード**
    （`self.__next_f.push` の router state）へ `<` エスケープ付きで直列化される
    → `black-box-squads.mjs` の「比較 不正パラメーター」チェックが dev で 1 件 FAIL する。
    `/squads/compare` は静的ルートで、**本番 `next start` の HTML には当該パラメーターが含まれず PASS する**
    （非実行・XSS ではない・当該ルートは未編集）。
- 開発中の軽い HTTP 200 確認は可。**最終品質ゲートでは全13レールを必ず `next start` 上で実行する。**
- 失敗を dev 固有差と判断する場合は、`next start` で再現しないことを実際に確認してから切り分ける。
- **根拠なくテスト期待値（black-box の `record(...)` 条件）を変更しない。**
- black-box は localhost への HTTP のみ・外部アクセス 0 回。実ユーザーの localStorage を変更しない
  （localStorage ベース画面は SSR 空状態シェルまでを検証し、状態変更ロジックは unit test で担保）。

## 6. SQLite `integrity_check`

読み取り専用接続で `PRAGMA integrity_check` = `ok` を確認。主要件数（`project-baseline.md` と一致すること）:

- `world_player_cards` = 13,009
- `managers` = 66
- `player_index_entries` = 47,479
- `player_cards` = 19
- `player_booster_definitions` = 44

`node:sqlite`（Node 24 標準・実験的）で読む例:
`node --experimental-sqlite -e "..."` または一時スクリプト。**書き込み 0。**

## 7. 完了判定

次を**すべて**満たした場合だけ「完了」:

- 必須機能完成
- `npm run audit:ja-labels` PASS
- `npm run verify` PASS（audit / typecheck / lint / unit test すべて）
- `npm run build` PASS
- **全13ブラックボックス PASS**（`next start` 上）
- SQLite `integrity_check` = `ok`
- Critical 0 / Warning 0（Warning は「lint 警告なし」。`next lint` の deprecation 予告や
  既存 lockfile 由来の `npm audit` 情報は Warning に数えない）
- 主要ページ・API 正常（HTTP 200）
- 保存互換性維持（スキーマ変更 0）
- 実ユーザーデータ変更 0
- dev サーバー正常復旧・`server.pid` 正確・`dev-err.log` に重大エラーなし
- 未解決問題 0

満たさない場合は「条件付き完了」または「未完了」とし、理由と残作業を報告・記録する。

## 8. Markdown だけの変更でコードに差分がないとき

次を**すべて**満たす場合のみ、直前の完全成功ベースラインを継承し、`verify` / `build` / 全13ブラックボックスを
**理由なく再実行しない**:

- 変更ファイルが Markdown または `CLAUDE.md`（索引・説明の追加）だけ
- `package.json` / `package-lock.json` 変更なし
- `src/` / `scripts/` / 設定ファイル（`tsconfig.json` / `next.config.mjs` / `eslint` / `postcss` / `tailwind` /
  `vitest.config.ts`）変更なし
- SQLite / localStorage 変更なし
- 開発サーバー状態不変
- 既存ベースラインを変更するコード差分なし
- `audit:ja-labels` の対象（`src/**/*.tsx`）に影響する変更なし

この条件を **1 つでも満たさない**場合は、通常の最終品質ゲートを省略せず実行する。

継承した場合は「品質確認を省略した」ではなく
**「コード差分がないため直前の完全成功ベースラインを継承した」**と完了報告へ明記する
（継承元のマイルストーンと日付も記載）。
