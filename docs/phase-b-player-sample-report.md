# Phase B 検証レポート — タイプの異なる20カード試験取得

実行日時: 2026-08-27T20:59:28.673Z
外部 GET 実行回数: 18 / 上限 18
結果: 取得 17 / ローカル再利用 2 / 失敗 1

## 1. カード別結果

| # | efhubCardId | 選手 | 状態 | pos | type | levelCap | boost1 | boost2 | 能力値min/max | defaulted |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 89138556575063 | Lionel Messi | local-reuse | SS | 7 | 32 | 1192 | 1400 | 40/87 | - |
| 2 | 89136409091415 | Lionel Messi | fetched | RWF | 7 | 34 | 1049 | 0 | 40/87 | - |
| 3 | 88041460996837 | Fabio Cannavaro | local-reuse | CB | 5 | 27 | 1030 | 0 | 40/86 | - |
| 4 | 88045755964133 | Fabio Cannavaro | fetched | CB | 5 | 27 | 1041 | 1201 | 40/85 | - |
| 5 | 88036092150743 | Gianluigi Buffon | fetched | GK | 5 | 30 | 1073 | 0 | 42/83 | - |
| 6 | 88038776505238 | Edwin van der Sar | fetched | GK | 5 | 30 | 1033 | 0 | 40/82 | - |
| 7 | 88045755960770 | Paolo Maldini | fetched | CB | 5 | 27 | 1041 | 0 | 40/86 | - |
| 8 | 88039581945324 | Franz Beckenbauer | fetched | CB | 5 | 33 | 1189 | 0 | 40/82 | - |
| 9 | 88039581945292 | Roberto Carlos | fetched | LB | 5 | 35 | 1187 | 0 | 40/85 | - |
| 10 | 88039581948642 | Claude Makelele | fetched | DMF | 5 | 33 | 1029 | 0 | 40/83 | - |
| 11 | 88040387117922 | Xavi | fetched | CMF | 5 | 33 | 1028 | 0 | 40/86 | - |
| 12 | 89138288136169 | Andres Iniesta | fetched | LMF | 7 | 32 | 1034 | 0 | 40/86 | - |
| 13 | 88036092152543 | Michel Platini | fetched | AMF | 5 | 33 | 1070 | 0 | 40/84 | - |
| 14 | 88035823848901 | Pavel Nedved | fetched | LMF | 5 | 33 | 1142 | 0 | 40/84 | - |
| 15 | 88041460993461 | Luis Figo | fetched | RWF | 5 | 34 | 1080 | 0 | 40/84 | - |
| 16 | 88041460894376 | Gareth Bale | fetched | RWF | 5 | 32 | 1186 | 0 | 40/83 | - |
| 17 | 88036360594345 | Franck Ribery | fetched | LWF | 5 | 31 | 1031 | 0 | 40/85 | - |
| 18 | 88040387119495 | Pele | fetched | SS | 5 | 33 | 1181 | 0 | 40/85 | - |
| 19 | 88040387119642 | Zlatan Ibrahimovic | fetched | CF | 5 | 32 | 1076 | 0 | 40/85 | - |
| 20 | 8554053 | Ismail Nasrallah (edge) | failed — parse error: 中心 player オブジェクトが見つからない（ID一致 + levelCap/overallRating/playingStyle） | - | - | - | - | - | - | - |

## 2. 検証チェック（取得/再利用カード）

| efhubCardId | ID一致 | baseStats数 | 能力値レンジOK | playerSkills文字列配列 | familiarity数値 | posコード既知 |
|---|---|---|---|---|---|---|
| 89136409091415 | true | 26 | true | true | true | true |
| 88045755964133 | true | 26 | true | true | true | true |
| 88036092150743 | true | 26 | true | true | true | true |
| 88038776505238 | true | 26 | true | true | true | true |
| 88045755960770 | true | 26 | true | true | true | true |
| 88039581945324 | true | 26 | true | true | true | true |
| 88039581945292 | true | 26 | true | true | true | true |
| 88039581948642 | true | 26 | true | true | true | true |
| 88040387117922 | true | 26 | true | true | true | true |
| 89138288136169 | true | 26 | true | true | true | true |
| 88036092152543 | true | 26 | true | true | true | true |
| 88035823848901 | true | 26 | true | true | true | true |
| 88041460993461 | true | 26 | true | true | true | true |
| 88041460894376 | true | 26 | true | true | true | true |
| 88036360594345 | true | 26 | true | true | true | true |
| 88040387119495 | true | 26 | true | true | true | true |
| 88040387119642 | true | 26 | true | true | true | true |
| 89138556575063 | true | 26 | (既存) | true | true | (既存) |
| 88041460996837 | true | 26 | (既存) | true | true | (既存) |

## 3. 失敗一覧

| efhubCardId | 選手 | edge | 理由 |
|---|---|---|---|
| 8554053 | Ismail Nasrallah | true | parse error: 中心 player オブジェクトが見つからない（ID一致 + levelCap/overallRating/playingStyle） |

## 4. 構造差（生 player オブジェクトのキー・参照＝Messi/Cannavaro の37キー）

| efhubCardId | 生キー数 | 参照に無いキー(extra) | 参照から欠けるキー(missing) |
|---|---|---|---|
| 89136409091415 | 38 | playingStyleDefensive | - |
| 88045755964133 | 38 | playingStyleDefensive | - |
| 88036092150743 | 37 | - | - |
| 88038776505238 | 38 | playingStyleDefensive | - |
| 88045755960770 | 38 | playingStyleDefensive | - |
| 88039581945324 | 38 | playingStyleDefensive | - |
| 88039581945292 | 38 | playingStyleDefensive | - |
| 88039581948642 | 37 | - | - |
| 88040387117922 | 38 | playingStyleDefensive | - |
| 89138288136169 | 37 | - | - |
| 88036092152543 | 38 | playingStyleDefensive | - |
| 88035823848901 | 37 | - | - |
| 88041460993461 | 38 | playingStyleDefensive | - |
| 88041460894376 | 37 | - | - |
| 88036360594345 | 38 | playingStyleDefensive | - |
| 88040387119495 | 37 | - | - |
| 88040387119642 | 37 | - | - |

> ローカル再利用の2枚（Messi 89138556575063 / Cannavaro 88041460996837）は再フェッチしていないため生キー比較なし。

## 5. 分布

### playerTypeCode
```
{
  "5": 16,
  "7": 3
}
```
### levelCap
```
{
  "27": 3,
  "30": 2,
  "31": 1,
  "32": 4,
  "33": 6,
  "34": 2,
  "35": 1
}
```
### boostId1（値ごとの枚数）
```
{
  "1028": 1,
  "1029": 1,
  "1030": 1,
  "1031": 1,
  "1033": 1,
  "1034": 1,
  "1041": 2,
  "1049": 1,
  "1070": 1,
  "1073": 1,
  "1076": 1,
  "1080": 1,
  "1142": 1,
  "1181": 1,
  "1186": 1,
  "1187": 1,
  "1189": 1,
  "1192": 1
}
```
### boostId2: 0 = 17 枚 / 非0 = 2 枚

### registeredPosition
```
{
  "RWF": 3,
  "CB": 4,
  "GK": 2,
  "LB": 1,
  "DMF": 1,
  "CMF": 1,
  "LMF": 2,
  "AMF": 1,
  "LWF": 1,
  "SS": 2,
  "CF": 1
}
```

## 6. 同一人物の別カード区別

- Messi (89138556575063 vs 89136409091415): 区別可能 = true
- Cannavaro (88041460996837 vs 88045755964133): 区別可能 = true
  （efhubCardId が異なり、baseStats も異なることを確認）

## 7. 重複防止

- src/data/cards/ の JSON ファイル数: 19
- 重複 efhubCardId: 0
- ファイル名 ≠ 中身の efhubCardId: 0
- いま再実行した場合のフェッチ対象件数: 1（0 + 失敗分なら重複しない）

## 8. エッジケース（OVR120・7桁ID）

- 8554053 Ismail Nasrallah: failed — parse error: 中心 player オブジェクトが見つからない（ID一致 + levelCap/overallRating/playingStyle）

## 9. Phase B 成功条件の判定

- 非エッジ 19 枚中 成功/再利用 19 枚（基準: 17以上）
- 重複ファイルなし: true
- 再実行フェッチ対象: 1
- 同一人物カード区別: Messi=true / Cannavaro=true
- typecheck / lint / test / build の結果はスクリプト外で実行し、本レポートの後に追記。

