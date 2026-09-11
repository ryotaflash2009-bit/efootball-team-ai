# eFHUB 個別選手ページ データ構造 調査結果

実行日時: 2026-08-27T20:07:03.153Z
調査対象: Lionel Messi (89138556575063) / Fabio Cannavaro (88041460996837)
外部アクセス: efhub.com の個別ページ GET ×2（合計2回）。他ホスト・他URLへのアクセスなし。
解析方針: 受信テキストの文字列解析のみ。eval・コード実行なし。JSON.parse 可能な候補のみ採用。

## 1. ページ概要

| 選手 | URL | HTTP | Content-Type | サイズ | __NEXT_DATA__ | RSCチャンク数 | 解析できたRSC行 | ld+json |
|---|---|---|---|---|---|---|---|---|
| Lionel Messi | https://efhub.com/players/89138556575063 | 200 | text/html; charset=utf-8 | 207529 B | false | 31 | 120 | 0 |
| Fabio Cannavaro | https://efhub.com/players/88041460996837 | 200 | text/html; charset=utf-8 | 194816 B | false | 28 | 87 | 0 |

- リダイレクト / ログイン要求 / Cookie 要求 / CAPTCHA: なし
- レスポンス形式: HTML + Next.js App Router の RSC ペイロード（self.__next_f.push）。
- Lionel Messi: 日本語能力値ラベルの出現 = なし
- Fabio Cannavaro: 日本語能力値ラベルの出現 = なし

## 2. 発見した基本情報フィールド（単純値）

### Lionel Messi
- `name`: Next.MetadataOutlet | next-size-adjust | Next.Metadata | Name | viewport | twitter:image
- `overall`: Overall
- `rating`: Rating
- `cardType`: Card Type
- `team`: Team... | Argentina | FC Barcelona | Miami BP | Paris Saint-Germain | Dream Team
- `teamName`: Team name...
- `club`: Club
- `nationality`: Nationality... | 
- `country`: Country...
- `league`: League | American Cup
- `age`: Age | 39
- `height`: Height | 56 | 65 | 170
- `weight`: Weight | 67
- `foot`: Foot
- `strongerFoot`: Stronger Foot
- `position`: Position | SS | CF | RWF | AMF | RMF
- `type`: image/png | image/x-icon
- `id`: player-screenshot-root | player-screenshot-content | 89138556575063 | 370537029180759 | 88032602496343 | 88030186577239
- `playerId`: 89138556575063
- `nameJa`: リオネル メッシ

### Fabio Cannavaro
- `name`: Next.MetadataOutlet | next-size-adjust | Next.Metadata | Name | viewport | Fabio Cannavaro
- `overall`: Overall
- `rating`: Rating
- `cardType`: Card Type
- `team`: Team... | Piemonte BN | Madrid Chamartin B | Napoli A | Italy
- `teamName`: Team name...
- `club`: Club
- `nationality`: Nationality... | 
- `country`: Country...
- `league`: League | Italian League
- `age`: Age | 31
- `height`: Height | 56 | 65 | 176
- `weight`: Weight | 75
- `foot`: Foot
- `strongerFoot`: Stronger Foot
- `position`: Position | CB | RB
- `id`: player-screenshot-root | player-screenshot-content | 88041460996837 | 17593528359653 | 87963614714597 | 17592186182373
- `playerId`: 88041460996837
- `nameJa`: ファビオ カンナヴァーロ
- `type`: image/png | image/x-icon

## 3. 能力値グループ（statGroup 候補）

### Lionel Messi — 2 群
- path: `$[3].children[3].children[0][3].children[0][3].player.playerModel` / キー数 16 / 能力名キー一致 0
  - keys: armLength, shoulderWidth, neckLength, chestMeasurement, neckSize, shoulderHeight, legLength, thighSize, waistSize, armSize, calfSize, legCoverageRadius, armCoverageRadius, jumpingHeight, torsoCollision, dribbleHeight
  - 断片: `{"armLength":5,"shoulderWidth":9,"neckLength":6,"chestMeasurement":9,"neckSize":9,"shoulderHeight":2,"legLength":3,"thighSize":9,"waistSize":7,"armSize":10,"calfSize":10,"legCoverageRadius":162,"armCoverageRadius":152.8,"jumpingHeight":228.4,"torsoCollision":48.1,"dribbleHeight":166}`
- path: `$[3].baseStats` / キー数 26 / 能力名キー一致 22
  - keys: offensiveAwareness, ballControl, dribbling, tightPossession, lowPass, loftedPass, finishing, heading, setPieceTaking, curl, speed, acceleration, kickingPower, jump, physicalContact, balance, stamina, defensiveAwareness, ballWinning, trackingBack, aggression, gkAwareness, gkCatching, gkClearing, gkReflexes, gkReach
  - 断片: `{"offensiveAwareness":81,"ballControl":86,"dribbling":87,"tightPossession":86,"lowPass":82,"loftedPass":80,"finishing":80,"heading":49,"setPieceTaking":83,"curl":86,"speed":76,"acceleration":81,"kickingPower":77,"jump":48,"physicalContact":77,"balance":82,"stamina":72,"defensiveAwareness":44,"ballWinning":42,"trackingBack":42,"aggression":42,"gkAwareness":40,"gkCatching":40,"gkClearing":40,"gkReflexes":40,"gkReach":40}`

### Fabio Cannavaro — 2 群
- path: `$[3].children[3].children[0][3].children[0][3].player.playerModel` / キー数 16 / 能力名キー一致 0
  - keys: armLength, shoulderWidth, neckLength, chestMeasurement, neckSize, shoulderHeight, legLength, thighSize, waistSize, armSize, calfSize, legCoverageRadius, armCoverageRadius, jumpingHeight, torsoCollision, dribbleHeight
  - 断片: `{"armLength":7,"shoulderWidth":7,"neckLength":4,"chestMeasurement":4,"neckSize":9,"shoulderHeight":5,"legLength":7,"thighSize":10,"waistSize":7,"armSize":7,"calfSize":9,"legCoverageRadius":169.8,"armCoverageRadius":159.8,"jumpingHeight":259,"torsoCollision":49.1,"dribbleHeight":176}`
- path: `$[3].baseStats` / キー数 26 / 能力名キー一致 22
  - keys: offensiveAwareness, ballControl, dribbling, tightPossession, lowPass, loftedPass, finishing, heading, setPieceTaking, curl, speed, acceleration, kickingPower, jump, physicalContact, balance, stamina, defensiveAwareness, ballWinning, trackingBack, aggression, gkAwareness, gkCatching, gkClearing, gkReflexes, gkReach
  - 断片: `{"offensiveAwareness":55,"ballControl":63,"dribbling":62,"tightPossession":63,"lowPass":70,"loftedPass":68,"finishing":58,"heading":70,"setPieceTaking":53,"curl":55,"speed":77,"acceleration":81,"kickingPower":72,"jump":86,"physicalContact":83,"balance":83,"stamina":75,"defensiveAwareness":82,"ballWinning":83,"trackingBack":84,"aggression":83,"gkAwareness":40,"gkCatching":40,"gkClearing":40,"gkReflexes":40,"gkReach":40}`

> 群が複数ある場合、基礎値 / Max Level 値 / 育成後値 / ブースター適用後値 のいずれかは
> キー名から判別できたときのみ後述の分類表に反映。判別できないものは「C 未確認」。

## 4. 選手スキル候補

### Lionel Messi
- `$[3].messages.skillBuffNotes` (object)
  - 断片: `{"longRangeShooting":"10% increase to Finishing when taking a shot outside the box.","throughPassing":"20% increase to passing stats when performing a through pass.","pinpointCrossing":"10% increase to passing stats when performing a cross.","willPower":"Increases Finishing and Kicking Power by 1 every time a shot is taken, up to a maximum of +8.","penaltySpecialist":"Increases Finishing and Place Kicking by 10 when taking a penalty kick.","fortress":"5% increase to Defensive Awareness and Tackling when in the lead during the 2nd half. Effect on Defensive Engagement and Aggression is unverified — more testing needed.","superSub":"5% increase to Offensive Awareness and Finishing when substituted on during or after half time."}`
- `$[3].messages.skillDescriptions` (object)
  - 断片: `{"scissorsFeint":"Performs a faster type of Scissors Feint than normal when entering a Scissors Feint command.","doubleTouch":"Performs a faster type of Double Touch than normal when entering a Double Touch command.","flipFlap":"Performs a Flip Flap feint when entering a Flip Flap command.","marseilleTurn":"Performs a faster type of Marseille Turn than normal when entering a Marseille Turn command.","sombrero":"Increases the accuracy of Sombrero and Rainbow Flick. Also allows the player to perform a Sombrero when receiving a Low Pass.","crossOverTurn":"Performs a faster type of Chop Turn than normal when entering a Chop Turn command.","cutBehindTurn":"Performs a Cut Behind. When turning at a wide angle, also uses a special trapping motion.","scotchMove":"Performs a Scotch Move feint when entering a Scotch Move command.","stepOnSkillControl":"Enables the player to control the ball more using the soles of his feet when executing feints and turns.","heading":"Improves the accuracy of headers as well as the frequency of downward headers.","longRangeDrive":"Performs a sharp, accurate Controlled Shot with a heavy curl that often hits the target even from a long distance.","chipShotControl":"Performs an accurate Chip Shot, even when moving at high speed.","longRangeShooting":"Performs a Long-range Shot from outside the box that often hits the target.","knuckleShot":"Performs a Knuckle Shot when entering a Stunning Shot command while the Power Gauge is 50-65％ full. A good free kick option.","dippingShot":"Performs a Dipping Shot when entering a Stunning Shot command while the Power Gauge is 20-50％ full.","risingShots":"Performs a Rising Shot when entering a Stunning Shot command while the Power Gauge is 65-95％ full.","acrobaticFinishing":"Enables the player to find a finish even from awkward positions or when off balance.","hellTrick":"Enables the player to pass and shoot using the heel, even from awkward positions or when off balance.","firstTimeShot":"Improves technique and precision when taking first-time shots.","one …(切り詰め)`
- `$[3].children[3].playerSkills` (array, len 10)
  - 断片: `["doubleTouch","longRangeDrive","firstTimeShot","oneTouchPass","throughPassing","pinpointCrossing","captaincy","momentumDribbling","edgedCrossing","magneticFeet"]`
- `$[3].children[3].children[0][3].children[0][3].player.comSkills` (array, len 2)
  - 断片: `["trickster","longBallExpert"]`

### Fabio Cannavaro
- `$[3].messages.skillBuffNotes` (object)
  - 断片: `{"longRangeShooting":"10% increase to Finishing when taking a shot outside the box.","throughPassing":"20% increase to passing stats when performing a through pass.","pinpointCrossing":"10% increase to passing stats when performing a cross.","willPower":"Increases Finishing and Kicking Power by 1 every time a shot is taken, up to a maximum of +8.","penaltySpecialist":"Increases Finishing and Place Kicking by 10 when taking a penalty kick.","fortress":"5% increase to Defensive Awareness and Tackling when in the lead during the 2nd half. Effect on Defensive Engagement and Aggression is unverified — more testing needed.","superSub":"5% increase to Offensive Awareness and Finishing when substituted on during or after half time."}`
- `$[3].messages.skillDescriptions` (object)
  - 断片: `{"scissorsFeint":"Performs a faster type of Scissors Feint than normal when entering a Scissors Feint command.","doubleTouch":"Performs a faster type of Double Touch than normal when entering a Double Touch command.","flipFlap":"Performs a Flip Flap feint when entering a Flip Flap command.","marseilleTurn":"Performs a faster type of Marseille Turn than normal when entering a Marseille Turn command.","sombrero":"Increases the accuracy of Sombrero and Rainbow Flick. Also allows the player to perform a Sombrero when receiving a Low Pass.","crossOverTurn":"Performs a faster type of Chop Turn than normal when entering a Chop Turn command.","cutBehindTurn":"Performs a Cut Behind. When turning at a wide angle, also uses a special trapping motion.","scotchMove":"Performs a Scotch Move feint when entering a Scotch Move command.","stepOnSkillControl":"Enables the player to control the ball more using the soles of his feet when executing feints and turns.","heading":"Improves the accuracy of headers as well as the frequency of downward headers.","longRangeDrive":"Performs a sharp, accurate Controlled Shot with a heavy curl that often hits the target even from a long distance.","chipShotControl":"Performs an accurate Chip Shot, even when moving at high speed.","longRangeShooting":"Performs a Long-range Shot from outside the box that often hits the target.","knuckleShot":"Performs a Knuckle Shot when entering a Stunning Shot command while the Power Gauge is 50-65％ full. A good free kick option.","dippingShot":"Performs a Dipping Shot when entering a Stunning Shot command while the Power Gauge is 20-50％ full.","risingShots":"Performs a Rising Shot when entering a Stunning Shot command while the Power Gauge is 65-95％ full.","acrobaticFinishing":"Enables the player to find a finish even from awkward positions or when off balance.","hellTrick":"Enables the player to pass and shoot using the heel, even from awkward positions or when off balance.","firstTimeShot":"Improves technique and precision when taking first-time shots.","one …(切り詰め)`
- `$[3].children[3].playerSkills` (array, len 10)
  - 断片: `["oneTouchPass","manMarking","interception","acrobaticClear","fightingSpirit","blocker","aerialSuperiority","slidingTackle","aerialForte","shadowHunt"]`
- `$[3].children[3].children[0][3].children[0][3].player.comSkills` (array, len 1)
  - 断片: `["earlyCross"]`

## 5. プレースタイル候補

### Lionel Messi
- `$[3].messages.playingStyle` — 断片: `"Playing Style"`
- `$[3].messages.playstyle_sheet_desc_1` — 断片: `"A predatory striker who plays off the shoulders of the last defender."`
- `$[3].messages.playstyle_sheet_desc_2` — 断片: `"A player who attracts the defence to create space for other players to exploit."`
- `$[3].messages.playstyle_sheet_desc_3` — 断片: `"A striker who lurks in the opposition 18 yard box just waiting for the ball."`
- `$[3].messages.playstyle_sheet_desc_4` — 断片: `"A player who positions himself on the wing to receive passes, occasionally cutting into the centre when the opportunity arises."`
- `$[3].messages.playstyle_sheet_desc_5` — 断片: `"A playmaker who initiates attacks near the penalty area and will present himself to score when opportunities arise. When defending, he refrains from dashing to minimise stamina loss."`

### Fabio Cannavaro
- `$[3].messages.playingStyle` — 断片: `"Playing Style"`
- `$[3].messages.playstyle_sheet_desc_1` — 断片: `"A predatory striker who plays off the shoulders of the last defender."`
- `$[3].messages.playstyle_sheet_desc_2` — 断片: `"A player who attracts the defence to create space for other players to exploit."`
- `$[3].messages.playstyle_sheet_desc_3` — 断片: `"A striker who lurks in the opposition 18 yard box just waiting for the ball."`
- `$[3].messages.playstyle_sheet_desc_4` — 断片: `"A player who positions himself on the wing to receive passes, occasionally cutting into the centre when the opportunity arises."`
- `$[3].messages.playstyle_sheet_desc_5` — 断片: `"A playmaker who initiates attacks near the penalty area and will present himself to score when opportunities arise. When defending, he refrains from dashing to minimise stamina loss."`

## 6. ポジション適性 / ポジション別総合値 候補

### Lionel Messi
- `$[3].additionalPositions` — 断片: `[{"position":"RMF","familiarity":2},{"position":"AMF","familiarity":2},{"position":"RWF","familiarity":2},{"position":"CF","familiarity":2}]`

### Fabio Cannavaro
- `$[3].additionalPositions` — 断片: `[{"position":"RB","familiarity":1}]`

## 7. 育成 / レベル情報 候補

### Lionel Messi
- `$[3].messages.autoAllocateProgression` = "Auto Allocate Progression"
- `$[3].messages.maxLevel` = "Max Level"
- `$[3].messages.maxLevelStats` = "Max Level Stats"
- `$[3].messages.progression` = "Progression"
- `$[3].messages.searchMaxLevelStats` = "Search Max Level Stats"
- `$[3].messages.tapAnAbilityToUseProgressionPoints` = "Tap an ability to use progression points"
- `$[3].messages.buildNotSaved.useAllProgressionPoints` = "Build not saved. Use all progression points"

### Fabio Cannavaro
- `$[3].messages.autoAllocateProgression` = "Auto Allocate Progression"
- `$[3].messages.maxLevel` = "Max Level"
- `$[3].messages.maxLevelStats` = "Max Level Stats"
- `$[3].messages.progression` = "Progression"
- `$[3].messages.searchMaxLevelStats` = "Search Max Level Stats"
- `$[3].messages.tapAnAbilityToUseProgressionPoints` = "Tap an ability to use progression points"
- `$[3].messages.buildNotSaved.useAllProgressionPoints` = "Build not saved. Use all progression points"

## 8. ブースター情報 候補

### Lionel Messi
- `$[3].messages.booster` — 断片: `"Booster"`
- `$[3].messages.iconBoost` — 断片: `"Icon Boost!!"`
- `$[3].messages.iconicMomentBoost` — 断片: `"Iconic Moment Boost"`
- `$[3].messages.managerBoosts` — 断片: `"Manager Boosts"`
- `$[3].messages.managerBoostPlusOne` — 断片: `"{stat} +1"`
- `$[3].messages.boostedStats` — 断片: `"Boosted Stats"`
- `$[3].messages.includeBoosterManagers` — 断片: `"Include Booster Managers"`
- `$[3].messages.popularBoosters` — 断片: `"Popular boosters"`

### Fabio Cannavaro
- `$[3].messages.booster` — 断片: `"Booster"`
- `$[3].messages.iconBoost` — 断片: `"Icon Boost!!"`
- `$[3].messages.iconicMomentBoost` — 断片: `"Iconic Moment Boost"`
- `$[3].messages.managerBoosts` — 断片: `"Manager Boosts"`
- `$[3].messages.managerBoostPlusOne` — 断片: `"{stat} +1"`
- `$[3].messages.boostedStats` — 断片: `"Boosted Stats"`
- `$[3].messages.includeBoosterManagers` — 断片: `"Include Booster Managers"`
- `$[3].messages.popularBoosters` — 断片: `"Popular boosters"`

## 9. Weak Foot / Form / Injury Resistance 候補

### Lionel Messi
- `$[3].messages.form` = "Form"
- `$[3].messages.injuryResistance` = "Injury Resistance"
- `$[3].messages.weakFootAcc` = "Weak Foot Acc"
- `$[3].messages.weakFootAccuracy` = "Weak Foot Accuracy"
- `$[3].messages.weakFootUsage` = "Weak Foot Usage"
- `$[3].messages.weakFootUse1` = "Weak Foot Use: 1"
- `$[3].messages.injuryResAbbr` = "Injury Res."
- `$[3].messages.weakFoot` = "Weak Foot"
- `$[3].weakFootAccuracy` = 3
- `$[3].children[3].children[0][3].children[0][3].player.weakFootUsage` = 1

### Fabio Cannavaro
- `$[3].messages.form` = "Form"
- `$[3].messages.injuryResistance` = "Injury Resistance"
- `$[3].messages.weakFootAcc` = "Weak Foot Acc"
- `$[3].messages.weakFootAccuracy` = "Weak Foot Accuracy"
- `$[3].messages.weakFootUsage` = "Weak Foot Usage"
- `$[3].messages.weakFootUse1` = "Weak Foot Use: 1"
- `$[3].messages.injuryResAbbr` = "Injury Res."
- `$[3].messages.weakFoot` = "Weak Foot"
- `$[3].weakFootAccuracy` = 2
- `$[3].children[3].children[0][3].children[0][3].player.weakFootUsage` = 1

## 10. 画像情報

- 選手カード画像 / ミニカード画像は前調査（docs/player-image-findings.md）で確認済み:
  `https://efimg.com/efootballhub22/images/player_cards/{playerId}_l.png` / `.../mini-cards/mini-cards/{playerId}_l.png`
- 本調査では画像へアクセスしていない。

## 11. 通常 JSON API の形跡（記録のみ・未アクセス）

### Lionel Messi
- https://efhub.com/players/89138556575063
- https://efhub.com/fr/players/89138556575063
- https://efhub.com/de/players/89138556575063
- https://efhub.com/es/players/89138556575063
- https://efhub.com/it/players/89138556575063
- https://efhub.com/pt/players/89138556575063
- https://efhub.com/pt-BR/players/89138556575063
- https://efhub.com/nl/players/89138556575063
- https://efhub.com/tr/players/89138556575063
- https://efhub.com/ar/players/89138556575063
- https://efhub.com/ja/players/89138556575063
- https://efhub.com/ko/players/89138556575063
- https://efhub.com/zh/players/89138556575063
- https://efhub.com/ru/players/89138556575063
- https://efhub.com/id/players/89138556575063
- https://efhub.com/th/players/89138556575063
- https://efhub.com/players/89138556575063\
- https://efhub.com/fr/players/89138556575063\
- https://efhub.com/de/players/89138556575063\
- https://efhub.com/es/players/89138556575063\
- https://efhub.com/it/players/89138556575063\
- https://efhub.com/pt/players/89138556575063\
- https://efhub.com/pt-BR/players/89138556575063\
- https://efhub.com/nl/players/89138556575063\
- https://efhub.com/tr/players/89138556575063\
- https://efhub.com/ar/players/89138556575063\
- https://efhub.com/ja/players/89138556575063\
- https://efhub.com/ko/players/89138556575063\
- https://efhub.com/zh/players/89138556575063\
- https://efhub.com/ru/players/89138556575063\
- https://efhub.com/id/players/89138556575063\
- https://efhub.com/th/players/89138556575063\
- https://efimg.com/efootballhub22/images/player_cards/89138556575063_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89136409091415_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89129429769559_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89133456301399_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89129161334103_l.png\
- https://efimg.com/efootballhub22/images/player_cards/17592722922839_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89129698205015_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89133187865943_l.png\
- https://efimg.com/efootballhub22/images/player_cards/106781476920663_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89067958050135_l.png\
- https://efimg.com/efootballhub22/images/player_cards/299067699633495_l.png\
- https://efimg.com/efootballhub22/images/player_cards/88030186577239_l.png\
- https://efimg.com/efootballhub22/images/player_cards/88032602496343_l.png\
- https://efimg.com/efootballhub22/images/player_cards/370537029180759_l.png\
- https://efimg.com/efootballhub22/images/player_cards/17592186051927_l.png\
- https://efimg.com/efootballhub22/images/player_cards/88046829575511_l.png\
- https://efimg.com/efootballhub22/images/player_cards/52788637736279_l.png\
- https://efimg.com/efootballhub22/images/player_cards/52783805898071_l.png\

### Fabio Cannavaro
- https://efhub.com/players/88041460996837
- https://efhub.com/fr/players/88041460996837
- https://efhub.com/de/players/88041460996837
- https://efhub.com/es/players/88041460996837
- https://efhub.com/it/players/88041460996837
- https://efhub.com/pt/players/88041460996837
- https://efhub.com/pt-BR/players/88041460996837
- https://efhub.com/nl/players/88041460996837
- https://efhub.com/tr/players/88041460996837
- https://efhub.com/ar/players/88041460996837
- https://efhub.com/ja/players/88041460996837
- https://efhub.com/ko/players/88041460996837
- https://efhub.com/zh/players/88041460996837
- https://efhub.com/ru/players/88041460996837
- https://efhub.com/id/players/88041460996837
- https://efhub.com/th/players/88041460996837
- https://efimg.com/efootballhub22/images/player_cards/88041460996837_l.png\
- https://efhub.com/players/88041460996837\
- https://efhub.com/fr/players/88041460996837\
- https://efhub.com/de/players/88041460996837\
- https://efhub.com/es/players/88041460996837\
- https://efhub.com/it/players/88041460996837\
- https://efhub.com/pt/players/88041460996837\
- https://efhub.com/pt-BR/players/88041460996837\
- https://efhub.com/nl/players/88041460996837\
- https://efhub.com/tr/players/88041460996837\
- https://efhub.com/ar/players/88041460996837\
- https://efhub.com/ja/players/88041460996837\
- https://efhub.com/ko/players/88041460996837\
- https://efhub.com/zh/players/88041460996837\
- https://efhub.com/ru/players/88041460996837\
- https://efhub.com/id/players/88041460996837\
- https://efhub.com/th/players/88041460996837\
- https://efimg.com/efootballhub22/images/player_cards/88045755964133_l.png\
- https://efimg.com/efootballhub22/images/player_cards/88036360723173_l.png\
- https://efimg.com/efootballhub22/images/player_cards/88033407933157_l.png\
- https://efimg.com/efootballhub22/images/player_cards/88032334191333_l.png\
- https://efimg.com/efootballhub22/images/player_cards/89063126342373_l.png\
- https://efimg.com/efootballhub22/images/player_cards/88030723578597_l.png\
- https://efimg.com/efootballhub22/images/player_cards/17592186182373_l.png\
- https://efimg.com/efootballhub22/images/player_cards/87963614714597_l.png\
- https://efimg.com/efootballhub22/images/player_cards/17593528359653_l.png\
- /api/auth/token
- fetch: /api/auth/token

> これらのURLへは一切アクセスしていない。追加調査には別途承認が必要。

## 12. RSC 解析の必要性

- 個別選手データは Next.js の RSC ペイロード（self.__next_f.push）内に直列化されている。
- 能力値グループの検出: あり（RSC 解析で能力値らしき数値群を取得できる）
- 通常の JSON API（安定した公開エンドポイント）が別に存在するかは「11.」の候補URLを追加調査するまで未確定。
- 実装方針の推奨:
  1. まず「11.」の候補URL（JSON API らしきもの）を1件だけ調査し、安定 API があればそれを使う。
  2. API が無ければ RSC パーサを作り、parser_version を管理し、構造変化を検知したら停止する運用にする。

## 13. フィールド分類表（A 確認済み / B 有力な推測 / C 未確認 / D 取得不可）

| 表示名 | 元フィールド名 | 型 | Messiの値 | Cannavaroの値 | 意味 | 確認状態 | 推奨DB名 | 変換要否 | null可能性 | 取得元 |
|---|---|---|---|---|---|---|---|---|---|---|
| 選手ID | id / playerId | string|number | player-screenshot-root / player-screenshot-content / 89138556575063 / 370537029180759 / 88032602496343 / 88030186577239 | player-screenshot-root / player-screenshot-content / 88041460996837 / 17593528359653 / 87963614714597 / 17592186182373 | カード固有ID（player-index.json の i と同じ想定） | B | efhub_card_id | 文字列化 | 低 | RSC |
| 英語名 | name / nameEn / englishName | string | Next.MetadataOutlet / next-size-adjust / Next.Metadata / Name / viewport / twitter:image | Next.MetadataOutlet / next-size-adjust / Next.Metadata / Name / viewport / Fabio Cannavaro | 英語表記名 | B | name_en | 不要 | 低 | RSC |
| 日本語名 | nameJa / japName | string | リオネル メッシ | ファビオ カンナヴァーロ | 日本語表記名 | B | name_ja | 不要 | 低 | RSC |
| OVR | ovr / overall / rating | number | Overall | Overall | 総合値（基礎かMaxかは要確認） | C | ovr_base / ovr_max | 要区別 | 低 | RSC |
| カードタイプ | cardType / type | string|number | Card Type | Card Type | カード種別（Epic/Legend/POTW等） | C | card_type | 要マッピング | 中 | RSC |
| 所属チーム | team / teamName / club | string|object | Team... / Argentina / FC Barcelona / Miami BP / Paris Saint-Germain / Dream Team | Team... / Piemonte BN / Madrid Chamartin B / Napoli A / Italy | 所属クラブ | C | team_id / team_name | 要正規化 | 中 | RSC |
| 国籍 | nationality / country | string|object | Nationality... /  | Nationality... /  | 国籍 | C | nationality | 要正規化 | 中 | RSC |
| リーグ | league | string|object | League / American Cup | League / Italian League | リーグ | C | league | 要正規化 | 中 | RSC |
| 地域 | region | string | — | — | 地域分類 | C | region | 要マッピング | 中 | RSC |
| 年齢 | age | number | Age / 39 | Age / 31 | 年齢 | C | age | 不要 | 中 | RSC |
| 身長 | height | number | Height / 56 / 65 / 170 | Height / 56 / 65 / 176 | 身長cm | C | height_cm | 不要 | 中 | RSC |
| 体重 | weight | number | Weight / 67 | Weight / 75 | 体重kg | C | weight_kg | 不要 | 中 | RSC |
| 利き足 | foot / strongerFoot | string|number | Foot | Foot | 利き足 | C | stronger_foot | 要マッピング | 中 | RSC |
| 登録ポジション | registeredPosition / position | string|number | Position / SS / CF / RWF / AMF / RMF | Position / CB / RB | 登録ポジション | C | registered_position | 要マッピング | 中 | RSC |
| 能力値(群) | (下記 3. の statGroup) | object | 検出 | 検出 | 26能力値。基礎/Max/育成後の別は要確認 | C | player_card_stats | 要区別 | — | RSC |
| 選手スキル | skills / playerSkills | array | 検出 | 検出 | 保有スキル一覧 | C | player_card_skills | 要マッピング | 中 | RSC |
| プレースタイル | playingStyle / playstyle | string|number | 検出 | 検出 | 攻撃/守備のプレースタイル | C | playstyle | 要マッピング | 中 | RSC |
| ポジション適性 | positions / positionRatings | object|array | 検出 | 検出 | 各ポジションの適性/総合値 | C | player_card_position_ratings | 要区別(数値/文字) | 中 | RSC |
| 最大レベル/育成P | maxLevel / trainingPoints | number | 検出 | 検出 | 育成上限・ポイント総量 | C | max_level / training_points | 不要 | 中 | RSC |
| ブースター | boost / booster | object|array | 検出 | 検出 | カード付きブースター | C | player_card_boosters | 要マッピング | 高 | RSC |
| Weak Foot | weakFoot* | number | 検出? | 検出? | 逆足の頻度/精度 | C | weak_foot_usage / weak_foot_acc | 不要 | 中 | RSC |
| Form | form | number | — | — | コンディション安定度 | C | form | 不要 | 中 | RSC |
| Injury Resistance | injuryResistance | number | — | — | 怪我耐性 | C | injury_resistance | 不要 | 中 | RSC |

> 実際の値・キー名は「2.〜9.」の検出結果と断片で確認すること。短縮キー・数値コードは証拠が揃うまで A に上げない。

## 14. 確認済み事項（A）
- 両ページとも HTTP 200 / HTML + RSC 形式 / 認証・CAPTCHA・リダイレクトなし。
- 個別選手データは初期レスポンスの RSC ペイロードに含まれる（クライアント専用フェッチではない部分がある）。
- 日本語能力値ラベルのページ内出現: Messi 0 種 / Cannavaro 0 種。

## 15. 有力な推測（B）
- 選手ID＝カード固有ID（player-index.json の i と同一体系）。
- 英語名/日本語名は基本情報として RSC に存在。

## 16. 未確認事項（C）
- 能力値が「基礎値 / Max Level / 育成後 / ブースター適用後」のどれか（複数群の意味）。
- OVR が基礎かMaxか、ポジション別総合値の計算規則。
- カードタイプ・チーム・国籍・リーグ・地域の数値コード対応。
- スキル/プレースタイル/ポジション適性のコード体系（数値↔名称）。
- 育成ポイントの消費規則、能力値グループ定義。
- ブースター適用前後の値が両方含まれるか。
- Weak Foot / Form / Injury Resistance の正確なキー名と値域。

## 17. 取得できなかった項目（D）
- （実行結果を見て、2ページのレスポンスに存在しなかったフィールドをここに列挙）

## 18. 推奨する自前DB構造（案）

```
player_cards        : internal_card_id(PK), efhub_card_id, name_en, name_ja, ovr_base, ovr_max,
                      card_type, team_id, nationality, league, region, age, height_cm, weight_kg,
                      stronger_foot, registered_position, weak_foot_usage, weak_foot_acc, form,
                      injury_resistance, max_level, training_points, source, fetched_at
player_card_stats   : internal_card_id(FK), stat_kind('base'|'max'|'trained'|'boosted'), stat_key, value
stat_definitions    : stat_key(PK), name_en, name_ja, group('offense'|'defense'|'physical'|'gk'), display_order
player_card_skills  : internal_card_id(FK), skill_key, is_additional, display_order
skills              : skill_key(PK), name_en, name_ja
player_card_playstyles: internal_card_id(FK), playstyle_key, kind('attack'|'defense')
playstyles          : playstyle_key(PK), name_en, name_ja, code
player_card_position_ratings: internal_card_id(FK), position_code, rating_value, rating_kind('registered'|'high'|'partial'|'none'|'trained')
player_card_boosters : internal_card_id(FK), booster_id, magnitude, applied('before'|'after')
boosters            : booster_id(PK), name_en, name_ja, effect_json
progression_rules   : rule_version, group_key, points_cost, delta_json   -- API/式が判明したら
```
- `stat_kind` を必ず持たせ、基礎/Max/育成後/ブースター後を混在させない。
- eFHUB 独自の計算結果（ポジション別OVR等）は `computed_*` として別管理し、元データと区別する。

## 19. 次の追加調査
- 「11.」の JSON API 候補URLのうち最も有望な1件だけを（別承認で）調査。
- 同一選手の別カード（Messi 106/105 等）で能力値群を比較し、stat_kind を確定。
- eFHUB 画面（DevTools）で「基礎値表示」と「Max表示」を切り替えた時の数値と RSC の群を突き合わせ。
- eFHUB / efimg.com の robots.txt・利用規約。

## 20. 実装前に確認すべきこと
- 能力値の stat_kind を根拠付きで確定できているか。
- RSC 依存か JSON API 利用かの方針決定。
- スキル/プレースタイル/ポジションのコード表を用意できているか。
- カード固有ID と player-index.json の i の同一性を複数カードで確認したか。

