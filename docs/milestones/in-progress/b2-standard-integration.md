# 中断: b2-standard-integration

> **完了・2026-09-05**。詳細報告は `docs/milestones/2026-09-05-b2-standard-integration.md`。
> 以下は中断時点（設計レビュー・テスト・品質ゲート未実施の時点）の記録として履歴保持する。

- 記録日時: 2026-09-05
- 総合判定（記録当時）: **未完了**（設計レビュー・テスト・品質ゲート未実施のため）
- マイルストーンの目的: 確認済み B2（`isConfirmedB2Candidate` が true の手動選択ブースター）を、
  従来「試算専用」（`experimentalExtraDeltas` のみ）だった経路から切り出し、
  通常の最終能力値（`standardFinalValue` / `playerBoosterDelta`）へ安全に反映する。

## 前セッションの経緯（引き継ぎ監査で確認済み）

- 前々セッションは OneDrive 側フォルダーを基準に起動されていたが、Read/Edit 操作は正本ワークスペース
  （`C:\Development\eFootball-Team-AI`）内の実ファイルへ行われていた（作業ディレクトリ矛盾）。
- 直前の読み取り専用引き継ぎ監査で、シェル作業ディレクトリ・Claude Code プロジェクトルート・
  `CLAUDE.md` の所属・ファイル操作対象がすべて正本ワークスペースで一致することを確認済み。
- 監査時点で以下が確認された:
  - 未検証変更は報告された4ファイルのみ（他の src ファイルへの波及なし）
  - `package.json` / `package-lock.json` 変更なし
  - `SavedBuild` / `MyTeamRecord` / `StoredSquad` スキーマ変更なし
  - `storageVersion` / `rulesVersion` / localStorage キー変更なし
  - SQLite 変更の兆候なし
  - dev サーバー停止中・`./data/server.pid` = `31480`（プロセス不存在・stale）・ポート3000空き
  - `./data/dev-err.log` は Ctrl-C 由来の制御文字のみ
  - `./docs/milestones/in-progress/b2-standard-integration.md` は本記録作成時点で未作成
  - 完了報告として誤って確定させた文書は存在しない

## 変更済み4ファイル（未検証・正しいとも誤りとも仮定しない）

- `./src/lib/progression/calculate-player-booster.ts`
  - B2（`selectedPlayerBooster` 経由の手動選択）を `isConfirmedB2Candidate(def)` で確認済み/未確認に分離。
  - 確認済み分を新設の `confirmedB2Deltas` へ集計。
  - 未確認分は `unconfirmedManualTrialDeltas` → 従来どおり `experimentalExtraDeltas` へのみ計上。
  - `manualTrialDeltas`（全件・後方互換）は変更前と同じく「選択した B2 の全件」を維持。
  - `selNote` を「未指定 / 全確認済み / 全未確認 / 混在」の4パターンへ変更。
- `./src/lib/progression/calculate-final-stats.ts`
  - `confirmedB2Deltas` 入力を追加。
  - `standardUncapped = strictUncapped + externalVerifiedBoosterDelta + confirmedB2BoosterDelta` で1回だけ加算。
  - `experimentalExtraDeltas` 側は既に未確認分のみ（呼び出し元で分離済み）のため二重加算にならない設計（コード内コメントで明記）。
  - 出力 `StatBreakdown` へ `confirmedB2BoosterDelta` を追加。
- `./src/lib/progression/types.ts`
  - `StatBreakdown.confirmedB2BoosterDelta` 追加。
  - `playerBoosterByStat` の各能力エントリへ `confirmedB2` 追加。
  - `booster` サマリーへ `confirmedB2Total` と `hasConfirmedB2` を追加。
- `./src/lib/progression/engine.ts`
  - `confirmedB2Deltas` を `calculateFinalStats` へ配線。
  - 新しい内訳（`playerBoosterByStat.confirmedB2`）とサマリー（`confirmedB2Total` / `hasConfirmedB2`）を組み立て。

## すべて未検証

- typecheck・Unit Test・`npm run verify`・`npm run build`・全13ブラックボックス・SQLite integrity_check の
  いずれも、この4ファイルの変更に対してまだ実行されていない。
- 正しいとも誤りとも仮定しない。今回のマイルストーンで設計レビューと計算テストを行い、
  安全性を確認できた場合のみ UI 実装・最終品質ゲートへ進む。

## サーバー状態（記録時点）

- `./data/server.pid` = `31480`（**stale**。対応プロセス不存在）
- ポート3000: 空き（リスナーなし）
- dev サーバー: 停止中
- `./data/dev-err.log`: 実質的なエラー内容なし（Ctrl-C 由来の制御文字4バイトのみ）

## 保護状態（この時点で確認済み・引き継ぎ監査より）

- `SavedBuild` / `MyTeamRecord` / `StoredSquad` スキーマ変更: 0
- `storageVersion` / `rulesVersion` / localStorage キー変更: 0
- SQLite 変更: 0（書き込み兆候なし）
- `package.json` / `package-lock.json` 変更: 0
- 新規 npm 依存: 0 / 外部アクセス: 0 / ファイル削除: 0

## 今回の再開手順

1. 正式文書再確認（`CLAUDE.md` / `development-safety-policy.md` / `quality-gates.md` / `project-baseline.md` /
   `milestone-workflow.md` / `progress.md` / `2026-09-05-b2-booster-readiness.md` / B2関連既存文書）— 完了。
2. 本文書の作成（ソース変更前）— 完了。
3. 未検証4ファイルの設計レビュー（二重加算・非対象能力・B1/PoM/監督補正への影響・
   strict/standard/conditional/experimentalの意味・保存互換性）を行い、安全に説明できない場合は停止する。
4. 既存テストの期待値を先に書き換えず、typecheck → booster関連 → calculate-final-stats関連 →
   engine関連 → progression関連の順に実行し、実際の失敗を分類する。
5. 意図した仕様変更による期待値差だけを更新し、必須の計算テスト（B2なし/確認済みB2/未確認B2/
   total-package/型とサマリー）を追加する。
6. 計算テストが安全と判断できた場合のみ `PlayerBoosterPanel` の UI 整理へ進む。
7. UI 実装後、保存・URL・比較・My Team・スカッド互換性を確認する。
8. `quality-gates.md` §2 の最終品質ゲート（20手順）をすべて実行する。
9. 完了報告を `docs/milestones/2026-09-05-b2-standard-integration.md` へ作成し、チャットへ要約を報告する。

## 重要な注記（今回のユーザー承認事項）

`development-safety-policy.md` §5・§14 は「`calculateBuild` の結果が変わること」を通常は重大停止条件として
扱う。今回はユーザーが本プロンプトで明示的に「確認済み B2 を通常の最終能力値へ安全に統合する」方針を
承認しており、優先順位（同文書 §0）に従い、**この一点に限り**計算結果の変更（`standardFinalValue` が
確認済み B2 選択時のみ増加する）を許可されたスコープとして扱う。B1・Power of Many・監督補正・
B2 対象能力/上昇値・上限・丸め・育成コストなど、それ以外の計算結果は一切変更しない。
