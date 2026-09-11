# 2026-09-01 — 開発運用基盤（安全・品質・使用量最適化）の整備

## 総合判定

| 項目 | 結果 |
|---|---|
| 総合判定 | **完了** |
| 安全性低下 | **0** |
| 精度低下 | **0** |
| 品質ゲート削除 | **0** |
| 重大停止条件削除 | **0** |
| コード変更 | **0**（`src/` `scripts/` `public/` `package.json` `package-lock.json` `data/efootball.db` 変更なし） |
| サーバー状態 | `next dev` 正常稼働・停止なし（PID・server.pid・dev-err.log 不変） |
| 未解決問題 | なし |
| 品質確認の扱い | Markdown 変更のみ・コード差分 0 → `quality-gates.md` §8 に従い直前の完全成功ベースライン（2026-09-01「保存ビルド棚卸し」）を継承 |

## 目的

毎回のプロンプトへ数百行の共通安全規則・品質ゲートを再掲しなくても、Claude Code が正式リポジトリ内の
文書を読み、**現在と同じ厳格な安全規則・品質ゲート・重大停止条件・完了判定**を適用できる状態を作る。
ルールの短縮・削除ではなく、チャットに複製していた規則を**単一の真実源**へ整理する作業。

## 正本ワークスペース / 元 OneDrive プロジェクト

- 作業は `C:\Development\eFootball-Team-AI` のみ。ファイル操作は相対パス（`./…`）のみ。
- 元 OneDrive プロジェクトへのアクセス: **0**（開く・検索・読取・編集・コピー戻し・差分統合・削除・移動・
  改名・server.pid 変更・Node 起動・メモリー記録を一切していない）。

## 開始時のサーバー状態（読み取り専用で確認）

- `./data/server.pid` = `35604`（数値・生存・`next dev`・cmdline に `C:\Development\eFootball-Team-AI` を含む）
- ポート 3000 リスナー PID = `11924`（`ParentProcessId` = 35604 → next dev の子）
- npm wrapper PID = 24372
- `./data/dev-err.log` = 0 行
- `/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/api/world/players/89138556575063`
  `/api/world/players/by-ids` `/api/managers` → すべて HTTP 200
- 正常稼働のため停止・再起動・`server.pid` 書き換え・`dev-err.log` 初期化は行っていない。

## 確認した既存文書

`CLAUDE.md` / `README.md` / `docs/progress.md` / `docs/my-builds.md` /
`docs/safe-build-and-cache-policy.md` / `docs/app-wide-ja-stat-labels.md`（サイズ確認）/
`docs/black-box-tests/`（8 レポート）/ `docs/incidents/`（`2026-08-29-path-typo.md`）/
`package.json`（scripts / deps）。`docs/` 直下に約 50 の `phase-*` / 機能別文書。
`docs/milestones/` は不在だったため新規作成。

## 作成した正式文書（新規）

| ファイル | 責務 |
|---|---|
| `docs/development-safety-policy.md` | **開発安全規則の単一の真実源**（優先順位 / ワークスペース / ファイル / データ保護 / 保存互換性 / 計算・確認状態 / 既存 API 確認 / 更新直前の整合性検証 / storage イベント / Node 管理 / `.next`・OneDrive / 外部変更 / 日本語ラベル監査 / マイルストーン単独実行 / 共通の重大停止条件） |
| `docs/quality-gates.md` | **品質ゲートの単一の真実源**（実装中の確認 / 最終品質ゲート 20 手順 / `npm run verify` の重複排除 / 主要ページ・API / 全13ブラックボックスと dev 固有差の切り分け / SQLite `integrity_check` / 完了判定 / Markdown だけの変更時のベースライン継承） |
| `docs/project-baseline.md` | **現在の完全成功ベースライン**（unit 888 / 全13レール 655 / SQLite 件数 / 保護スキーマ / localStorage キー / ポジション別 OVR 状態 / npm scripts / 直近のサーバー / 実装済み機能） |
| `docs/milestone-workflow.md` | **マイルストーン実行手順**（開始時に読む必須文書 / 実装 / 最終品質ゲート / 完了報告の二層構造 / 使用量不足時の安全な中断（テンプレート付き） / 標準プロンプト構造と短縮ひな型 / 重複実行を減らす対象と減らさない確認 / セッション切り替え） |
| `docs/milestones/README.md` | マイルストーン詳細報告アーカイブの説明・これまでの主なマイルストーン一覧 |
| `docs/milestones/in-progress/README.md` | 中断・再開文書の置き場所・ルール |
| `docs/milestones/2026-09-01-dev-operations-baseline.md` | 本文書（この基盤整備の詳細報告） |

## 更新した既存文書（最小差分）

| ファイル | 変更 |
|---|---|
| `CLAUDE.md` | 末尾に「## 参照文書（Claude Code が最初に読むもの）」を追加。既存の安全規則本文は**一切変更せず**、新設 4 文書と `safe-build-and-cache-policy.md` への索引リンクを追加しただけ。優先順位（`CLAUDE.md` が上位）は明記。 |
| `docs/safe-build-and-cache-policy.md` | 冒頭に「正本ワークスペースは `C:\Development\eFootball-Team-AI`（OneDrive 外）へ移行済み。`.next` 削除・キャッシュ削除・Node 一括停止の禁止と `.next`/OneDrive の EINVAL 手順は移行後も適用する」旨の注記と、`development-safety-policy.md` / `quality-gates.md` への相互リンクを追加。既存の §1〜§10 本文は変更なし。 |
| `docs/progress.md` | 2026-09-01 の「開発運用基盤の整備」を 1 節追記。 |

## 文書間の責務分離と単一の真実源

- **開発安全規則** → `docs/development-safety-policy.md`（唯一）
- **品質ゲート** → `docs/quality-gates.md`（唯一）
- **現在のプロジェクト基準状態** → `docs/project-baseline.md`（唯一）
- **マイルストーン実行手順 / 中断・再開 / 新セッション引き継ぎ / 標準プロンプト / 完了報告構造** → `docs/milestone-workflow.md`（唯一）
- **ビルド・キャッシュ・`.next`・OneDrive** → `docs/safe-build-and-cache-policy.md`（既存・唯一）
- **プロジェクト最上位ルール** → `CLAUDE.md`（既存・唯一・最優先）

役割が重複する新規文書は作っていない（既存 `safe-build-and-cache-policy.md` の範囲は再定義せず相互リンクのみ）。

## 安全規則の優先順位（`development-safety-policy.md` §0）

1. ユーザーがそのプロンプトで明示した安全条件
2. `CLAUDE.md` の絶対安全規則
3. `development-safety-policy.md`
4. そのマイルストーン固有の重大停止条件
5. `quality-gates.md`
6. マイルストーン要件
7. ドキュメント・報告形式
8. 使用量最適化

使用量削減で上位（1〜6）を弱めない。迷ったら安全性・データ保護を優先。曖昧なら停止。

## 品質確認まわりの正式化（削除・弱体化なし）

- `npm run verify` = `audit:ja-labels → typecheck → lint → test`。**verify 成功後は理由なく個別再実行しない**が、
  完了報告には verify 内の各結果を個別項目として記載する。
- 最終品質ゲート（`quality-gates.md` §2 の 20 手順）は**コード変更マイルストーンで必須のまま維持**。
  `npm run build` / `npm run start` / 全13ブラックボックス / SQLite `integrity_check` は省略可にしていない。
- ブラックボックスの最終判定は `next start`（本番ビルド）上の結果を正とする。全13レールを維持。
  既知の dev 固有差（`/squads/compare` の searchParams が dev の RSC flight ペイロードへ直列化される件）は
  `quality-gates.md` §5 に文書化し、「dev で無条件に全レールを回さない・最終ゲートでは `next start` 上で必ず全13レール」
  という運用にした。**テスト期待値は根拠なく変更しない**旨も明記。
- 更新直前の整合性検証・別タブ競合検出・`worldCardId` 文字列一致・`buildId` 検証・Node の PID/ポート/親子関係確認は
  「減らさない確認」として明記（`milestone-workflow.md` §7）。

## 使用量不足時の完了判定

- 品質確認を省略して「完了」にしない。
- 未検証の変更を完成扱いにしない。変更を勝手に巻き戻さない。
- 総合判定は「条件付き完了」または「未完了」とし、`docs/milestones/in-progress/<feature>.md` へ
  実装済み範囲 / 残作業 / 実行済み品質確認 / サーバー状態 / 保護状態 / 再開手順を記録して安全に停止。

## ベースラインの現在値（`project-baseline.md`）

- unit test: **888 / 888 PASS**（46 ファイル）
- ブラックボックス: 全13レール・合計 **655 / 655 PASS**（`next start`）
- SQLite `integrity_check`: ok（`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
  `player_cards` 19 / `player_booster_definitions` 44）
- ポジション別 OVR: 未実装・表示「—（計算規則を確認中）」・架空 OVR 0
- Critical 0 / Warning 0
- 直前の完全成功マイルストーン: 2026-09-01「保存ビルド棚卸し `/build-inventory`」

> 本タスクのプロンプト §1 は「unit 866 / 全13レール 642」と記載していたが、これはその前のマイルストーン
> （スカッド保存ビルドパネル）時点の値。直前の完了報告（保存ビルド棚卸し）と現在のファイル状態
> （`src/lib/progression/build-inventory.ts` / `BuildInventoryView.tsx` / `app/build-inventory/page.tsx` /
> `build-inventory.test.ts` が実在・Sidebar に `/build-inventory` 行あり）から **888 / 655** を正とした。
> ベースライン確認のために全テスト・全ブラックボックスは再実行していない。

## 変更範囲の確認

| 項目 | 結果 |
|---|---|
| src 変更 | 0 |
| scripts 変更 | 0 |
| package.json 変更 | 0 |
| package-lock 変更 | 0 |
| SQLite 変更 | 0 |
| localStorage 変更 | 0 |
| 実ユーザーデータ変更 | 0 |
| 新規 npm 依存 | 0 |
| 外部アクセス | 0 |
| ファイル削除 | 0 |
| Node 停止 | 0（`next dev` 稼働維持） |
| ワークスペース外アクセス | 0 |
| 許可外絶対パス使用 | 0 |
| 元 OneDrive プロジェクト変更 | 0 |

## 作成ファイル

- `./docs/development-safety-policy.md`
- `./docs/quality-gates.md`
- `./docs/project-baseline.md`
- `./docs/milestone-workflow.md`
- `./docs/milestones/README.md`
- `./docs/milestones/in-progress/README.md`
- `./docs/milestones/2026-09-01-dev-operations-baseline.md`

## 編集ファイル

- `./CLAUDE.md`（末尾に参照文書索引を追加・既存本文は不変）
- `./docs/safe-build-and-cache-policy.md`（冒頭注記＋相互リンク・§1〜§10 本文は不変）
- `./docs/progress.md`（1 節追記）

## 削除ファイル

なし（0 件）。

## テストを再実行したか / しなかった根拠

- **再実行していない。**
- 根拠: 変更は Markdown（`docs/*.md`）と `CLAUDE.md` の索引追加のみ。`package.json` / `package-lock.json` /
  `src/` / `scripts/` / 設定ファイル / SQLite / localStorage に差分なし。`audit:ja-labels` の対象
  （`src/**/*.tsx`）に影響なし。開発サーバー状態不変。→ `quality-gates.md` §8 の条件をすべて満たすため、
  直前の完全成功ベースライン（2026-09-01「保存ビルド棚卸し」の verify PASS / build PASS / 全13レール 655/655 /
  SQLite ok）を継承した。「品質確認を省略した」のではなく「コード差分がないため継承した」。
- 読み取り確認で代替: 変更ファイルが Markdown / `CLAUDE.md` だけであること・`package.json` 等に差分がないこと・
  サーバーが正常であること・ベースラインを変えるコード差分がないことを確認済み。

## Node 停止 / 動作中サーバー / server.pid / dev-err.log

- Node 停止: **0**（`Stop-Process` 未使用・一括停止なし）。
- 動作中サーバー: `next dev` 親 PID `35604` / リスナー `11924`（親 = 35604）/ npm wrapper `24372`・維持。
- `./data/server.pid` = `35604`（不変）。
- `./data/dev-err.log` = 0 行（不変・重大エラーなし）。

## 発生した問題 / 自動修正

- 問題: なし。
- 自動修正: なし（Markdown 新規作成と最小追記のみ）。

## 未解決問題

なし。

## 今後の新規セッションで最初に読む文書（正式化）

1. `CLAUDE.md`
2. `docs/development-safety-policy.md`
3. `docs/quality-gates.md`
4. `docs/project-baseline.md`
5. `docs/progress.md`
6. 対象機能の設計文書（`docs/my-builds.md` 等）
7. 直前のマイルストーン報告（`docs/milestones/YYYY-MM-DD-*.md`）
8. 進行中なら `docs/milestones/in-progress/<feature>.md`

その後 `docs/milestone-workflow.md` §1 の 7 手順を実行してから実装へ進む。

## 今後の短縮プロンプト例

`docs/milestone-workflow.md` §6「短縮プロンプトのひな型」を参照。要旨:

> 最初に CLAUDE.md / development-safety-policy.md / quality-gates.md / project-baseline.md / progress.md /
> 対象機能文書を読み、記載ルールをすべて適用。今回の単独マイルストーンだけを実装し次へ進まない。
> 共通ルールを弱めず今回固有の禁止事項（例: 今回は SavedBuild だけ触る / My Team・スカッド・SQLite・
> 新規 localStorage キーは変更しない）を追加適用。既存コード・型・API を正とし推測しない。
> 実装中は関連 unit test、最後に quality-gates.md §2 の最終品質ゲートをすべて実行。
> 同じ検査を理由なく重複実行しない（最終ゲートは省略しない）。
> 使用量不足時は未完了として in-progress へ記録し安全に中断。
> 完了後 next dev を正常稼働へ戻し、詳細報告を milestones/YYYY-MM-DD-<feature>.md へ保存、
> チャットへ重要サマリーを報告して停止。

## 人間が確認する項目

1. `docs/development-safety-policy.md` / `docs/quality-gates.md` / `docs/project-baseline.md` /
   `docs/milestone-workflow.md` の内容が、これまでチャットで適用してきた安全規則・品質ゲートと
   齟齬がないか（特に「削減してよい / 削減禁止」の線引き）。
2. `CLAUDE.md` 末尾に追加した「参照文書」索引が、既存の安全規則本文を弱めていないこと。
3. `docs/project-baseline.md` の unit 888 / 全13レール 655 / SQLite 件数が、直近の実測と一致すること
   （疑わしければ次のコード変更マイルストーンの最終ゲートで実測して更新する）。
4. `docs/safe-build-and-cache-policy.md` 冒頭注記が、正本ワークスペース移行後も `.next` 削除禁止・
   Node 一括停止禁止・EINVAL 手順が有効であることを正しく示していること。
5. 今後のプロンプトを短縮運用に切り替える際、`docs/milestone-workflow.md` §6 のひな型に
   「機能固有の危険領域」を毎回明記する運用が守られること。

## 次に推奨する単独マイルストーン

- **保存ビルドのローカルエクスポート/インポート**（JSON・localStorage のみ・端末間の手動移行。
  読み込みは Zod で厳格検証・既存 `buildId` 衝突時は新規 `buildId` 発行・既存データを上書きしない）
- または **旧規則ビルドの現行規則移行ガイド**（棚卸しで「旧規則」に絞り込んだビルドを各育成画面へ誘導・
  一括変換はしない）
