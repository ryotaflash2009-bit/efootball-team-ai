# Phase B.5 ブラックボックステスト結果（SQLite 導入後の既存UI）

実行日時: 2026-09-12T03:27:01.966Z
対象: http://localhost:3000（dev サーバー）
外部アクセス: 0 回（localhost のみ。選手画像プロキシの有効IDは叩かない）

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | ホームが表示される | HTTP 200 |
| PASS | ホームにデータ状態が出る |  |
| PASS | プレイヤー一覧が表示される | HTTP 200 |
| PASS | 選手画像参照が存在する（<img src=/api/player-image/…>） | 参照 4 件 |
| PASS | 画像は遅延読み込み（loading=lazy） |  |
| PASS | 画像枠の縦横比固定（aspect-[3/4] = CLS対策） |  |
| PASS | 日本語検索が動く（「メッシ」） | HTTP 200 |
| PASS | 英語検索が動く（「messi」） | HTTP 200 |
| PASS | OVR並べ替えが動く（降順） |  |
| PASS | OVR並べ替えが動く（昇順） |  |
| PASS | Messi 詳細が表示される | HTTP 200 |
| PASS | Messi 詳細に画像要素がある |  |
| PASS | Messi 詳細にデータ来歴がある |  |
| PASS | Cannavaro 詳細が表示される | HTTP 200 |
| PASS | 一覧から詳細へ移動できる（href=/players/{id} または /players/world/{id}） |  |
| PASS | 不正IDの詳細ページでクラッシュしない | HTTP 200 |
| PASS | 不正IDの内部APIが 404 を返す（クラッシュしない） | HTTP 404 |
| PASS | 不正な画像IDは 400（外部アクセスなし） | HTTP 400 |
| PASS | パストラバーサル形の画像IDは安全に拒否される（3xx/400/404・500ではない） | HTTP 308 |
| PASS | スラッシュ入り画像IDは安全に拒否される（3xx/400/404） | HTTP 400 |
| PASS | 存在しない数字IDのプレースホルダー応答 | 前フェーズで検証済み（/api/player-image/99999999999999 → 200 image/svg+xml）。外部アクセス回避のため本フェーズでは再テストせず |
| PASS | SQLite 導入後も既存UIソースは未編集 | Phase B.5 の編集対象に UI ファイルは含まれない。サイズ: src/app/page.tsx:2415B / src/app/players/page.tsx:3418B / src/app/players/[id]/page.tsx:555B / src/components/PlayerCard.tsx:1558B / src/components/PlayerImage.tsx:1434B / src/components/PlayerSilhouette.tsx:1119B / src/lib/players.ts:3927B / src/lib/player-image.ts:6350B / src/app/api/player-image/[id]/route.ts:2571B / next.config.mjs:330B |
| PASS | UI のデータ参照先は players.sample.json のまま（未切替） | src/lib/players.ts 未編集 / SQLite は scripts と data のみ |

## 判定: 全項目 PASS

- UI のデータ参照先は `src/data/players.sample.json` のまま。SQLite へは切り替えていない。
- 選手画像の「存在しない数字ID → SVGプレースホルダー」動作は前フェーズ（選手画像実装）で検証済み。
  本フェーズでは外部アクセス（efimg.com）を避けるため再テストせず、不正ID（400）のみ確認。

