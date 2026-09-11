# Phase B.5 SQLite 移行レポート

実行日時: 2026-08-27T21:32:29.666Z
DB: data\efootball.db（node:sqlite・Node標準）
外部アクセス: 0 回

## 1. 入力
- src/data/cards/ の有効カード JSON: 19 件
- 不正 JSON: 0 件

## 2. 移行結果
- 1回目: 成功 19 / 失敗 0

## 3. テーブル件数（最終）
```
{
  "parser_versions": 2,
  "player_cards": 19,
  "player_card_stats": 494,
  "player_card_skills": 179,
  "player_card_com_skills": 34,
  "player_card_positions": 76,
  "player_card_boosters": 38,
  "sync_runs": 2,
  "sync_errors": 1
}
```

## 4. JSON ↔ SQLite 照合
- 一致: 19 / 19

| efhubCardId | 選手 | 照合 | 不一致内容 |
|---|---|---|---|
| 88035823848901 | Pavel Nedved | 一致 | - |
| 88036092150743 | Gianluigi Buffon | 一致 | - |
| 88036092152543 | Michel Platini | 一致 | - |
| 88036360594345 | Franck Ribery | 一致 | - |
| 88038776505238 | Edwin van der Sar | 一致 | - |
| 88039581945292 | Roberto Carlos | 一致 | - |
| 88039581945324 | Franz Beckenbauer | 一致 | - |
| 88039581948642 | Claude Makelele | 一致 | - |
| 88040387117922 | Xavi | 一致 | - |
| 88040387119495 | Pele | 一致 | - |
| 88040387119642 | Zlatan Ibrahimovic | 一致 | - |
| 88041460894376 | Gareth Bale | 一致 | - |
| 88041460993461 | Luis Figo | 一致 | - |
| 88041460996837 | Fabio Cannavaro | 一致 | - |
| 88045755960770 | Paolo Maldini | 一致 | - |
| 88045755964133 | Fabio Cannavaro | 一致 | - |
| 89136409091415 | Lionel Messi | 一致 | - |
| 89138288136169 | Andres Iniesta | 一致 | - |
| 89138556575063 | Lionel Messi | 一致 | - |

> 照合項目: efhub_card_id / ovr_base / ovr_max / name_en / name_ja / player_type_code / level_cap /
> registered_position / playing_style_defensive / parser_version / baseStats 26値 / playerSkills 順序 /
> comSkills / additionalPositions / boost_id_1 / boost_id_2 / player_model_json

## 5. 冪等性（2回実行）
- 2回目: 成功 19 / 失敗 0
- データテーブル件数 1回目==2回目: **true**
- efhub_card_id 集合 1回目==2回目: **true**
- player_cards 内の重複 efhub_card_id: **なし**
```
1回目: {"parser_versions":2,"player_cards":19,"player_card_stats":494,"player_card_skills":179,"player_card_com_skills":34,"player_card_positions":76,"player_card_boosters":38}
2回目: {"parser_versions":2,"player_cards":19,"player_card_stats":494,"player_card_skills":179,"player_card_com_skills":34,"player_card_positions":76,"player_card_boosters":38}
```

## 6. sync_runs
| id | kind | status | ok | fail |
|---|---|---|---|---|
| 1 | json-to-sqlite-migration | done | 19 | 0 |
| 2 | json-to-sqlite-migration-rerun | done | 19 | 0 |

## 7. sync_errors（異常エントリ含む）
- 8554053 の記録: 今回追加

| id | run_id | efhub_card_id | http | error |
|---|---|---|---|---|
| 1 | 1 | 8554053 | 200 | anomalous: no player object (non-card index entry) (name: Ismail Nasrallah) |

## 8. 判定
- 全カード照合一致・冪等・重複なし・移行失敗0: **true**
- UI のデータ参照先は players.sample.json のまま（未切替）。

