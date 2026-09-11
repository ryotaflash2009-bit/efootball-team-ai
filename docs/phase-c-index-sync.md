# Phase C 索引同期レポート（player-index.json → SQLite）

実行日時: 2026-08-27T21:48:38.327Z
モード: initial
DB: data\efootball.db
外部アクセス: player-index.json へ GET 1回のみ（個別選手ページ 0回）

## 1. 取得
- URL: https://efhub.com/search/player-index.json
- HTTP: 200 / Content-Type: application/json; charset=utf-8
- レスポンスサイズ: 3470451 bytes（**全文は保存せず** sha256 と先頭3件のみ source_snapshots へ）
- sha256: `ad87a98208698e8022ef735fa10b4d258ad43df539bb0f494a77fdac1c1fcb18`
- 受信レコード数: **47479**
- 先頭3件（生データ）:
```json
  {"i":"8554053","e":"Ismail Nasrallah","j":"イスマイル ナスララー","c":"伊斯梅尔·纳斯鲁拉","o":120}
  {"i":"8554076","e":"Safi Belal","j":"サフィ ベラル","c":"萨菲·比拉勒","o":120}
  {"i":"89138556575063","e":"Lionel Messi","j":"リオネル メッシ","c":"利昂内尔·梅西","o":107}
```

## 2. 投入結果（1回目適用）
- 新規: 47479 / 更新: 0 / 変更なし: 0 / 異常: 34088
- player_index_entries 総数: 47479
- 既存19カード（player_cards）を detail_sync_status='fetched' に更新: 19 件

### detail_sync_status 分布
```
{
  "anomalous": 34088,
  "fetched": 19,
  "pending": 13372
}
```

## 3. 冪等性（同一 entries[] を2回適用・再フェッチなし）
- 2回目: 新規 0 / 更新 0 / 変更なし 47479
- player_index_entries 総数 1回目==2回目: 47479 == 47479 → **true**
- 重複 efhub_card_id: 1回目 0 / 2回目 0
- 2回目の新規 = 0: **true**
- **冪等: true**

## 4. 異常データ
- 異常エントリ総数: 34088
- 理由別:
```
{
  "short id (likely non-card template entry)": 34088
}
```
- sync_errors へ記録した代表: 20 件（上限20）

| efhub_card_id | name_en | name_ja | ovr | reason |
|---|---|---|---|---|
| 8554053 | Ismail Nasrallah | イスマイル ナスララー | 120 | short id (likely non-card template entry) |
| 8554076 | Safi Belal | サフィ ベラル | 120 | short id (likely non-card template entry) |
| 110718 | Kylian Mbappe | キリアン エムバペ | 99 | short id (likely non-card template entry) |
| 117047 | Vinicius Junior | ヴィニシウス ジュニオール | 99 | short id (likely non-card template entry) |
| 135067 | Vitinha | ヴィティーニャ | 99 | short id (likely non-card template entry) |
| 162114 | Lamine Yamal | ラミン ヤマル | 99 | short id (likely non-card template entry) |
| 108959 | Declan Rice | デクラン ライス | 98 | short id (likely non-card template entry) |
| 110626 | Ousmane Dembele | ウスマヌ デンベレ | 98 | short id (likely non-card template entry) |
| 128720 | K. Kvaratskhelia | フヴィチャ クヴァラツヘリア | 98 | short id (likely non-card template entry) |
| 129369 | Michael Olise | マイケル オリーセ | 98 | short id (likely non-card template entry) |
| 133157 | Pedri | ペドリ | 98 | short id (likely non-card template entry) |
| 133543 | Erling Haaland | アーリング ハーランド | 98 | short id (likely non-card template entry) |
| 159320 | Joao Neves | ジョアン ネヴィス | 98 | short id (likely non-card template entry) |
| 47287 | Harry Kane | ハリー ケイン | 97 | short id (likely non-card template entry) |
| 57123 | Mohamed Salah | モハメド サラー | 97 | short id (likely non-card template entry) |
| 60512 | Bruno Fernandes | ブルーノ フェルナンデス | 97 | short id (likely non-card template entry) |
| 101520 | David Raya | ダビド ラヤ | 97 | short id (likely non-card template entry) |
| 104677 | Antonio Rudiger | アントニオ リュディガー | 97 | short id (likely non-card template entry) |
| 108279 | Gianluigi Donnarumma | ジャンルイージ ドンナルンマ | 97 | short id (likely non-card template entry) |
| 108662 | Frenkie de Jong | フレンキー デ ヨング | 97 | short id (likely non-card template entry) |
| 109005 | Joshua Kimmich | ヨズア キミッヒ | 97 | short id (likely non-card template entry) |
| 110644 | Raphinha | ハフィーニャ | 97 | short id (likely non-card template entry) |
| 111800 | Ruben Dias | ルーベン ディアス | 97 | short id (likely non-card template entry) |
| 113911 | Federico Valverde | フェデリコ バルベルデ | 97 | short id (likely non-card template entry) |
| 119907 | Luis Diaz | ルイス ディアス | 97 | short id (likely non-card template entry) |
| 124266 | Antoine Semenyo | アントワーヌ セメンヨ | 97 | short id (likely non-card template entry) |
| 126624 | Julian Alvarez | フリアン アルバレス | 97 | short id (likely non-card template entry) |
| 126689 | William Saliba | ウィリアム サリバ | 97 | short id (likely non-card template entry) |
| 128281 | Enzo Fernandez | エンソ フェルナンデス | 97 | short id (likely non-card template entry) |
| 132155 | Jurrien Timber | ジュリアン ティンバー | 97 | short id (likely non-card template entry) |

> 異常エントリも player_index_entries には記録（is_anomalous=1 / detail_sync_status='anomalous'）。
> Phase D の詳細取得キューは `WHERE detail_sync_status='pending' AND is_anomalous=0` で作るため自動スキップされる。

## 5. 既存19カードの保護
```
事前: {"player_cards":19,"player_card_stats":494,"player_card_skills":179,"player_card_com_skills":34,"player_card_positions":76,"player_card_boosters":38}
事後: {"player_cards":19,"player_card_stats":494,"player_card_skills":179,"player_card_com_skills":34,"player_card_positions":76,"player_card_boosters":38}
```
- player_cards 系6テーブルの件数が投入前後で不変: **true**
- sync-player-index.mjs はこれらのテーブルに一切書き込まない。

## 6. 自動差分更新の準備
- prev snapshot hash: (なし=初回)
- this snapshot hash: ad87a98208698e8022ef735fa10b4d258ad43df539bb0f494a77fdac1c1fcb18
- snapshot 変化: 初回
- sync_state（次回同期用）:
```
{
  "index_initial_done": "true",
  "index_last_fetch_at": "2026-08-27T21:48:38.314Z",
  "index_last_snapshot_hash": "ad87a98208698e8022ef735fa10b4d258ad43df539bb0f494a77fdac1c1fcb18",
  "index_record_count": "47479",
  "index_detail_cursor": "0"
}
```
- `--mode incremental`: 前回との差分（name / ovr_max_candidate の変化）だけ更新。
  ovr_max_candidate が変化し、かつ detail_sync_status='fetched' のエントリは 'pending' に戻す（Phase D が再取得）。
- 将来: サーバー側 cron で `node scripts/sync-player-index.mjs --mode incremental` を定期実行 → ユーザー操作不要で索引が最新化。

## 7. テーブル件数（最終）
```
{
  "parser_versions": 2,
  "player_cards": 19,
  "player_card_stats": 494,
  "player_card_skills": 179,
  "player_card_com_skills": 34,
  "player_card_positions": 76,
  "player_card_boosters": 38,
  "sync_runs": 3,
  "sync_errors": 21
}
```

## 8. 判定
- **Phase C 成功: true**
  - 受信件数 >= 10000 / 冪等 / player_cards 保護 / 全件が new+updated+unchanged に分類
- UI のデータ参照先は players.sample.json のまま（未切替）。

