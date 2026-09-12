# Phase C ブラックボックステスト結果（索引 SQLite 投入後の既存UI）

実行日時: 2026-09-12T03:27:02.259Z
対象: http://localhost:3000
外部アクセス: 0 回（localhost のみ）

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | ホームが表示される | HTTP 200 |
| PASS | プレイヤー一覧が表示される | HTTP 200 |
| PASS | 選手画像が表示される（<img src=/api/player-image/…> 参照） | 参照 4 件 |
| PASS | 画像は遅延読み込み / 縦横比固定 |  |
| PASS | 選手詳細へ移動できる（href=/players/{id} または /players/world/{id}） |  |
| PASS | 日本語検索が動く（「メッシ」） | HTTP 200 |
| PASS | 英語検索が動く（「messi」） | HTTP 200 |
| PASS | OVR並べ替えが動く（降順・昇順） |  |
| PASS | Messi 詳細が表示される | HTTP 200 |
| PASS | Cannavaro 詳細が表示される | HTTP 200 |
| PASS | 不正IDの詳細ページでクラッシュしない | HTTP 200 |
| PASS | 不正IDの内部APIが 404（クラッシュしない） | HTTP 404 |
| PASS | 不正な画像IDは 400（外部アクセスなし） | HTTP 400 |
| PASS | パストラバーサル形の画像IDは安全に拒否（3xx/400/404・500ではない） | HTTP 308 |
| PASS | 存在しない数字IDのプレースホルダー応答 | 前フェーズで検証済み（/api/player-image/99999999999999 → 200 image/svg+xml）。外部アクセス回避のため本フェーズでは再テストせず |
| PASS | SQLite 索引投入後も既存UIソースは未編集 | src/app/page.tsx:2415B / src/app/players/page.tsx:3418B / src/app/players/[id]/page.tsx:555B / src/components/PlayerCard.tsx:1558B / src/components/PlayerImage.tsx:1434B / src/components/PlayerSilhouette.tsx:1119B / src/lib/players.ts:3927B / src/lib/player-image.ts:6350B / src/app/api/player-image/[id]/route.ts:2571B / next.config.mjs:330B |
| PASS | UI のデータ参照先は players.sample.json のまま（未切替） | src/lib/players.ts 未編集 / 索引は SQLite の player_index_entries のみ |

## 判定: 全項目 PASS

- UI のデータ参照先は `src/data/players.sample.json` のまま。SQLite（`player_index_entries` 含む）へは切り替えていない。

