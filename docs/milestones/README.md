# マイルストーン詳細報告アーカイブ

`docs/milestone-workflow.md` §4-2 で定義した**マイルストーンごとの完了報告**を保存する場所。

- 完了報告: `YYYY-MM-DD-<feature-name>.md`（例: `2026-09-02-build-export-import.md`）
- 進行中の中断・再開文書: [`in-progress/`](in-progress/)

`docs/progress.md`（日付順の 1〜2 行サマリー）と `docs/*.md`（機能別設計）は従来どおり維持し、
ここには「完了報告の全文（フィールド単位の変更・テスト内訳・PID と停止コマンド・サーバー状態・
SQLite 結果・スキーマ変更・ファイル一覧・バグと修正・未解決問題・人間の目視項目・次候補）」を残す。

チャットの完了報告は要約に留め、詳細はここへ完全保存することで、情報を失わずに使用量を抑える。

## これまでの主なマイルストーン（詳細は `docs/my-builds.md` / `docs/progress.md` / 会話ログ）

| 日付 | マイルストーン | 記録先 |
|---|---|---|
| 2026-09-01 | 正本ワークスペースを OneDrive 外へ移行 | `docs/progress.md` / `docs/project-baseline.md` |
| 2026-09-01 | My Builds → My Team 新規登録 | `docs/my-builds.md` |
| 2026-09-01 | My Team「保存ビルドを選ぶ」パネル | `docs/my-builds.md` |
| 2026-09-01 | スカッド編集の保存ビルド選択パネル + ビルド使用状況サマリー | `docs/my-builds.md` |
| 2026-09-01 | 保存ビルド棚卸し `/build-inventory` | `docs/my-builds.md` |
| 2026-09-01 | 開発運用基盤（本文書群）の整備 | `docs/milestones/2026-09-01-dev-operations-baseline.md` |
| 2026-09-01 | 旧規則ビルド確認ガイド（`/build-inventory` 内） | `docs/milestones/2026-09-01-legacy-build-guide.md` |
| 2026-09-02 | 保存ビルドのローカル JSON エクスポート（My Builds） | `docs/milestones/2026-09-02-saved-build-export.md` |
| 2026-09-02 | 保存ビルドのローカル JSON インポート（My Builds） | `docs/milestones/2026-09-02-saved-build-import.md` |
| 2026-09-05 | 保存ビルド重複候補（`/build-inventory`） | `docs/milestones/2026-09-02-saved-build-duplicate-review.md` |
| 2026-09-05 | 保存ビルドエクスポートの保存場所選択 | `docs/milestones/2026-09-05-saved-build-export-location.md` |
| 2026-09-05 | B2 ブースター正式化監査＋「ビルド分析」への名称変更 | `docs/milestones/2026-09-05-b2-booster-readiness.md` |
| 2026-09-05 | B2ブースター標準計算統合（確認済みB2を標準最終値へ反映） | `docs/milestones/2026-09-05-b2-standard-integration.md` |
| 2026-09-06 | B1/B2 育成画面インライン配置（レイアウト整理・計算エンジン無変更） | `docs/milestones/2026-09-05-b1-b2-inline-layout.md` |
| 2026-09-06 | スカッド診断（スカッド構成評価）基盤 | `docs/milestones/2026-09-06-squad-diagnosis-foundation.md` |

以降のマイルストーンは `YYYY-MM-DD-<feature>.md` として本ディレクトリへ追加する。
