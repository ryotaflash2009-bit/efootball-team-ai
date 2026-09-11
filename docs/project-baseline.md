# プロジェクト基準状態（Project Baseline）

最終更新: 2026-09-06（保存スカッド編集画面のレイアウト再構成 後）

**現在の完全成功ベースライン**。新セッションが最初に読む必須文書の 1 つ。
値は「直前の完全成功マイルストーンの完了報告」＋「現在のファイル状態」を根拠に更新する。
ベースライン確認のために全テスト・全ブラックボックスを無条件で再実行しない。

## ワークスペース

- **正本ワークスペース**: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- **旧 OneDrive 版**: `C:\Users\akihi\OneDrive\デスクトップ\eFootball-Team-AI` = **バックアップ**（不可触）
- 移行完了日: 2026-09-01（`npm ci` 復元・全検証 PASS 済み）

## 品質ベースライン（直前の完全成功マイルストーン: 2026-09-06「保存スカッド編集画面のレイアウト再構成」）

| 項目 | 値 |
|---|---|
| unit test | **1302 / 1302 PASS**（57 テストファイル・`npm run test` / `vitest run`、レイアウトのみの変更のため件数不変） |
| ブラックボックス | **全13レール・合計 710 / 710 PASS**（`next start` 上・件数不変） |
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx` の `{group.nameEn}`） |
| `npm run verify` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`） |
| `npm run build` | PASS |
| SQLite `integrity_check` | ok |
| Critical | 0 |
| Warning | 0 |

### ブラックボックス レール別件数（2026-09-01）

| レール | 件数 |
|---|---|
| my-builds（＋My Team連携＋棚卸しSSR＋旧規則ガイド＋JSONエクスポート/インポート＋重複候補＋保存場所選択） | 98 |
| compare | 74 |
| progression | 99 |
| squads（スカッド診断の回帰確認・禁止事項の非表示確認を統合 +4） | 50 |
| boosters（B2標準統合の見出し/選択欄チェック更新分 +1） | 54 |
| world-ui | 82 |
| favorites | 33 |
| ui | 69 |
| managers | 41 |
| manager-picker | 35 |
| phase-b5 | 23 |
| phase-c | 17 |
| world-sync | 35 |
| **合計** | **710** |

> 既知の dev モード差: `black-box-squads.mjs` の「比較 不正パラメーター」チェックは
> `npm run dev` 相手だと 1 件 FAIL（`/squads/compare` の searchParams が dev の RSC flight ペイロードへ
> `<` エスケープ付きで直列化されるため）。本番 `next start` では 46/46 PASS。詳細は `quality-gates.md` §5。

## SQLite（`./data/efootball.db`・読み取り専用）

| テーブル | 件数 |
|---|---|
| `world_player_cards` | 13,009 |
| `managers` | 66 |
| `player_index_entries` | 47,479 |
| `player_cards` | 19 |
| `player_booster_definitions` | 44 |

`integrity_check` = ok。**書き込み禁止・スキーマ変更禁止。**

## 主要ページ・API（HTTP 200 が基準）

`/` `/players` `/players/world/[worldCardId]` `/managers` `/managers/[managerId]` `/compare`
`/squads` `/squads/[squadId]` `/squads/compare` `/squads/templates`
`/favorites` `/my-team` `/my-builds` `/build-inventory`
`/api/managers` `/api/managers/[managerId]` `/api/world/players/[worldCardId]` `/api/world/players/by-ids`
`/api/world/players` `/api/players` `/api/players/[id]` `/api/player-image/[id]` `/api/world/player-image/[worldCardId]`
`/api/data-status`

## 保護されているスキーマ（変更は重大停止条件）

- `SavedBuild`（`src/lib/progression/types.ts` / `build-storage.ts` の `savedBuildSchema`・`schemaVersion` 1）
- `MyTeamRecord` / `FavoriteRecord`（`src/lib/user-cards/types.ts`）
- `StoredSquad` / `StoredSlot` / `StoredSub`（`src/lib/squad/types.ts`・`SQUAD_SCHEMA_VERSION` 1）
- `storageVersion`: `favorites-storage/2026-08-30.v1` / `my-team-storage/2026-08-30.v1` /
  `squad-positioning/2026-08-30.v1` / `squad-templates-storage/2026-08-30.v1`
- `rulesVersion`: `progression/2026-08-28.v2`（現行）/ `progression/2026-08-28.provisional-1`（旧）/
  誤日付 `progression/2026-08-29.v2`（v2 扱いで正規化）

## localStorage キー（新規追加禁止）

| キー | 用途 |
|---|---|
| `efootball-team-ai:progression-builds:v1` | 保存ビルド（build-storage・`{[worldCardId]: SavedBuild[]}`） |
| `efootball-team-ai:favorites:v1` | カードお気に入り（favorites-storage） |
| `efootball-team-ai:my-team:v1` | My Team（my-team-storage） |
| `efb:squads:v1` | 保存スカッド（squad-storage） |
| `efootball-team-ai:squad-templates:v1` | スカッドテンプレート |
| `efb:compare-ids:v1` | 比較カート（sessionStorage） |
| `efb:squad-editor-prefs:v1` | スカッド編集の表示設定（スナップ/ガイド/グリッド） |

## ポジション別 OVR

- **未実装**。`confirmed_formula` なし。
- 全画面で表示は「総合値（ポジション別 OVR）: —（計算規則を確認中）」。
- **架空 OVR: 0 件**を維持。`SavedBuild.calculatedOvr` は「保存時の推定OVR」ラベルのみ。

## npm scripts（`package.json`）

`dev` / `build` / `start` / `lint`（next lint）/ `typecheck`（tsc --noEmit）/ `test`（vitest run）/
`audit:ja-labels`（`node scripts/audit-ja-stat-labels.mjs`）/
`verify`（audit:ja-labels → typecheck → lint → test）/ `fetch:players`

依存: `next ^15.5.0` / `react 19.0.0` / `react-dom 19.0.0` / `zod 3.24.1`。**新規依存追加禁止。**

## 直近に確認された開発サーバー（2026-09-06・PID は再利用され得るので毎回再確認）

- URL: `http://localhost:3000`
- next dev 親 PID: 16892 / ポート 3000 リスナー PID: 4296（start-server.js・16892 の子）
- `./data/server.pid`: 16892
- `./data/dev-err.log`: 0 行
- 注: 同一 PC で別プロジェクト（`遅延証明書シミュレーター`）の Node プロセスが並走することがある。
  停止対象はコマンドラインに `C:\Development\eFootball-Team-AI` を含む PID のみ。

## 実装済みの主要機能（2026-09-01 時点）

選手検索 / 選手カード画像 / 選手詳細 / 育成エンジン / 保存ビルド / 選手比較 / 比較画面内育成 /
比較コックピット / 能力値レーダー / 26能力値比較 / 「この育成を保存」 / My Team / カードお気に入り /
スカッド作成 / 自由配置 / スナップ / 左右反転 / テンプレート / スカッド比較 / My Builds（一覧・検索・
絞り込み・並び替え・名前変更・複製・安全な1件削除・使用状況表示） /
My Builds ⇄ My Team（selectedBuildId / favoriteBuildId 設定・解除・新規登録・ownership/usage 選択・独立管理） /
My Team「保存ビルドを選ぶ」パネル / スカッド編集「保存ビルドを選ぶ」パネル（先発・ベンチの savedBuildId） /
スカッドのビルド使用状況サマリー / 保存ビルド分析 `/build-inventory`（読み取り専用・旧称「保存ビルド棚卸し」・URL不変） /
旧規則ビルド確認ガイド（`/build-inventory` 内・読み取り専用・自動移行しない） /
保存ビルドのローカル JSON エクスポート（My Builds・全件/選択・外部送信なし） /
保存ビルドのローカル JSON インポート（My Builds・追加保存・既存を上書きしない・全件単位・最終確認制） /
保存ビルド重複候補（`/build-inventory` 内・完全一致/類似候補・読み取り専用・自動統合/削除なし） /
保存ビルドエクスポートの保存場所選択（対応ブラウザーは showSaveFilePicker・非対応はダウンロードへ自動フォールバック） /
B1/B2/Power of Many 定義監査（`isB2SelectableCandidate`/`isConfirmedB2Candidate`） /
B2ブースター標準計算統合（確認済みB2を`standardFinalValue`へ反映・未確認/`total-package`は試算専用のまま維持） /
B1/B2 育成画面インライン配置（育成ポイント直下でB1・B2をPC2列/モバイル縦積み表示・
`AttachedBoosterSection`/`B2BoosterSelector`へ集約・B2選択UI重複0・計算エンジン無変更） /
スカッド診断（スカッド構成評価・`src/lib/squad/squad-diagnosis.ts`・決定的な純関数・
攻撃/守備/空中戦/スピード/パス・ビルドアップ/ドリブル・ボール保持/プレス適性/カウンター適性の8カテゴリ+
選手配置の充足状況・全国順位/勝率予測/課金なし・無料/詳細の出力構造分離） /
削除済みビルド参照の安全表示 / 別タブ更新通知 / 手動再読込 / 日本語ラベル統一・回帰監査 /
`npm run verify` / 全13ブラックボックスレール / OneDrive 外への正本ワークスペース移行

## 参照

- 開発安全規則: [`development-safety-policy.md`](development-safety-policy.md)
- 品質ゲート: [`quality-gates.md`](quality-gates.md)
- マイルストーン手順・中断/再開・報告構造: [`milestone-workflow.md`](milestone-workflow.md)
- 進捗ログ: [`progress.md`](progress.md)
