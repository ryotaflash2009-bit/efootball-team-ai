# World 全件同期 ブラックボックステスト結果

実行日時: 2026-09-14T08:54:04.727Z
外部アクセス: 0 回（localhost + ローカル DB のみ）

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | 同期スクリプトが存在する |  |
| PASS | 進捗確認スクリプトが存在する |  |
| PASS | kill switch（data/STOP チェック）が実装されている |  |
| PASS | 一時停止フラグ（world_detail_sync_paused）が実装されている |  |
| PASS | UPSERT（ON CONFLICT）で重複防止している |  |
| PASS | ページ単位トランザクション（BEGIN/COMMIT/ROLLBACK） |  |
| PASS | 個別選手ページ（/player/{id}）を取得していない |  |
| PASS | 既存 eFHUB テーブルへ書き込んでいない |  |
| PASS | World カードが保存されている（>0） | 13009 件 |
| PASS | 最初の数ページ以上を取得できている（>= 500） | 13009 件 |
| PASS | world_card_id の重複がない | 0 件 |
| PASS | 能力値が26項目そろっているカード = 総カード数 | stats 338234 |
| PASS | 能力値キーが想定26種のみ |  |
| PASS | SQLite integrity_check = ok |  |
| PASS | foreign_key_check 違反なし |  |
| PASS | 既存 eFHUB: player_cards = 19 |  |
| PASS | 既存 eFHUB: player_index_entries = 47479 |  |
| PASS | 既存 eFHUB: player_card_stats = 494 |  |
| PASS | world_sync_progress に進捗が保存されている | status=done pages=27/27 |
| PASS | world_source_snapshots にページ記録がある | 27 件 |
| PASS | 初回同期の状態が記録されている | world_initial_status=done |
| PASS | 全件完了: world_player_cards ≈ world_total_count | 13009 vs 13009 |
| PASS | show-world-sync-progress.mjs が動く |  |
| PASS | ホームが表示される | HTTP 200 |
| PASS | プレイヤー一覧が表示される | HTTP 200 |
| PASS | 選手画像参照が存在する |  |
| PASS | 日本語検索が動く | HTTP 200 |
| PASS | 英語検索が動く | HTTP 200 |
| PASS | OVR並べ替えが動く |  |
| PASS | Messi 詳細が表示される | HTTP 200 |
| PASS | Cannavaro 詳細が表示される | HTTP 200 |
| PASS | 選手詳細へ移動できる（href=/players/... または /players/world/...） |  |
| PASS | 不正IDでクラッシュしない | HTTP 200 |
| PASS | 不正な画像IDは 400（外部アクセスなし） | HTTP 400 |
| PASS | 旧 eFHUB サンプル系 UI/API は据え置き（players.sample.json フォールバック維持） | src/app/players/[id]/page.tsx:555B / src/components/PlayerCard.tsx:1558B / src/components/PlayerImage.tsx:1434B / src/lib/players.ts:3927B / src/lib/player-image.ts:6350B / next.config.mjs:330B / src/app/api/players/route.ts:1214B / src/app/api/players/[id]/route.ts:1056B / src/data/players.sample.json:13889B |

## 判定: 全項目 PASS

- UI のデータ参照先は `src/data/players.sample.json` のまま（World / SQLite へ切替なし）。

