# プレースタイル規則台帳（Playing Style Ledger）

最終更新: 2026-09-06（第2版: プレースタイル正規化層 `src/lib/world/playing-style.ts` を追加）
ステータス: **正規化層を実装済み**（発動可否判定・選手間連携分析はまだ実装していない）
根拠データ生成日: 本ドキュメント作成時点の `data/efootball.db`（読み取り専用調査。書き込み0件）
再現方法: `node scripts/audit-playing-styles.mjs`（読み取り専用・同一データから常に同一結果。正規化層を
接続した集計は §10・§11 を参照）

---

## 0. 目的と適用範囲（最重要）

このドキュメントは、将来の「プレースタイル発動可否・選手間連携分析」を安全に実装するための**準備調査**であり、
以下を一切含まない。

- プレースタイルの発動可否（active / inactive / unknown / notApplicable）の判定ロジック
- 選手間のプレースタイル連携・補完・重複の分析
- 「このプレースタイルはこのポジションでしか発動しない」という断定
- 一般的なサッカー知識やプレースタイル名からの発動条件の推測

**結論を先に明記する: 本プロジェクト内に、プレースタイル名と発動対象ポジションの確認済み対応表は存在しない。**
`docs/db-schema.md` §4 の `playstyles` テーブルは設計案（検討のみ）であり、実際に作成されたテーブルには含まれて
いない（`docs/db-schema.md` 冒頭の実装済みテーブル一覧に `playstyles` は無い）。実データ（`data/efootball.db`）
にも、プレースタイル名から発動条件・対象ポジション・数値コードを引ける表は存在しない。

したがって、本台帳の「発動対象ポジション」「発動対象外ポジション」列は、確認できたものが無いため
**原則としてすべて「未確認」**になる。これは調査漏れではなく、確認済みデータが存在しないという調査結果である。

`squad-tactical-review.ts`（配置構造・戦術監査）は、この結論をすでに踏まえて実装されている
（同ファイルの冒頭コメントに「プレースタイル名と発動対象ポジションの確認済み対応表が存在しないため」と明記済み・
`squad-tactical-review.test.ts` に「現在の分析をプレースタイル発動分析と表示しない」ことを検証するテストが存在）。

---

## 1. 調査に用いたデータソース

| データソース | 内容 | 確認方法 |
|---|---|---|
| `data/efootball.db`（SQLite・読み取り専用） | `world_player_cards` / `player_cards` / `world_player_ai_styles` / `manager_link_up_conditions` の実データ | `scripts/audit-playing-styles.mjs` |
| `docs/db-schema.md` | eFHUB由来スキーマの設計意図・コメント（§4 プレースタイル） | 目視確認 |
| `docs/efootball-world-data-investigation.md` | eFootball World API の生JSONフィールド（`playingStyle` / `playingStyleDef` / `aiStyles`） | 目視確認 |
| `docs/player-root-findings.md` | eFHUB フロントエンドの i18n メッセージ辞書から抽出された `playstyle_sheet_desc_1`〜`33`（英語の説明文・数値IDは1始まり、23番は欠番） | 目視確認 |
| `src/lib/efhub/card-schema.ts` | eFHUB由来カードの型定義（`playingStyleName` / `playingStyleDefensive`） | 目視確認 |
| `src/lib/world/types.ts` / `mappers.ts` | World由来カードの型定義・SQLite行からのマッピング（単純な文字列パススルー） | 目視確認 |
| `src/lib/squad/squad-tactical-review.ts` / `link-up.ts` | 現在のプレースタイル使用箇所（配置構造・戦術監査は不使用、Link-Up Playは完全一致比較で使用） | 目視確認 |
| `scripts/audit-ja-stat-labels.mjs` | 日本語ラベル監査の対象範囲（プレースタイルは対象外と確認） | 目視確認 |

---

## 2. 用語整理（混同しやすい5つの概念を分離する）

現在のプロジェクトには、名前が似ているが**性質の異なる5種類のデータ**が存在する。今回の調査でこれらを分離した。

| 概念 | 保持場所 | 1選手あたりの数 | 現在の用途 | 今回の分析への使用可否 |
|---|---|---|---|---|
| ① 攻撃プレースタイル（`playingStyle`） | `world_player_cards.playing_style` / `player_cards.playing_style_name` | 1個（必須） | 画面表示（バッジ）・Link-Up Play条件との一致判定 | 表示・完全一致判定は確認済みで利用可能。**発動対象ポジション判定には使用不可（未確認）** |
| ② 守備プレースタイル（`playingStyleDefensive`） | `world_player_cards.playing_style_def` / `player_cards.playing_style_defensive` | 1個（World: 必須・eFHUB: 任意） | `squad-tactical-review.ts`へ受け渡すのみ・未使用 | データは存在するが意味・適用条件が未確認 |
| ③ AIプレースタイル（`aiStyles`） | `world_player_ai_styles.style_name` | 0〜複数（平均2.43個） | 未使用 | **今回の分析には使用不可**（①②とは別概念・混同禁止） |
| ④ Link-Up Play条件のプレースタイル | `manager_link_up_conditions.playing_style` | 監督のLink-Up Playごとに0〜1個 | `link-up.ts`で①と完全一致比較（確認済み・稼働中） | Link-Up Play機能としては確認済みで利用可能。**ポジション発動条件としては別概念** |
| ⑤ ポジション適性（`registeredPosition`・比較画面の適性） | `world_player_cards.registered_position` 等 | 1個（登録ポジション） | 配置適性判定（既存） | ①〜④とは完全に別の既存確認済み機能。プレースタイルと混同しない |

選手スキル（`world_player_skills` / `player_card_skills`）も上記のいずれとも異なる別概念であり、今回のプレー
スタイル調査には含めていない（`progress.md`の既存記録どおり、意味未確認のため引き続き不使用）。

---

## 3. `playingStyle` と `playingStyleDefensive` の違い（確認済み事実）

`world_player_cards`（13,009件、World由来）を対象に確認した。

- **両方とも必須項目**（NULL 0件・空文字 0件）。ただし `playing_style_def` は**約74%（9,678/13,009）が
  `"Basic"`**という単一値に集中しており、実質的に「守備専用スタイルを持たない」ことを表す既定値である
  可能性が高い（ただし、この解釈自体は eFootball World / eFHUB 側の確認済み仕様書が存在しないため
  「可能性が高い」に留め、断定しない）。
- `playing_style`（攻撃）は21種類、`playing_style_def`（守備）は14種類。**語彙は完全には共通していない**:
  `Basic` / `Box-to-Box` / `Anchor Man` の3値だけが両方の列に現れる。残り18種類は攻撃専用、11種類は
  守備専用（うち3種類はGK専用と推定される名称: `Attacking GK` / `Defensive GK` / `Sweeper GK`）。
- eFHUB由来（`player_cards`、19件）では `playing_style_defensive` が **19件中19件ともNULL**。
  eFHUB取得元は守備プレースタイルを一度も捕捉できていない（`docs/db-schema.md`の「任意項目」という
  設計コメントと整合する事実）。
- 結論: `playingStyle` と `playingStyleDefensive` は同じ語彙空間を共有する部分はあるが、**別々に管理される
  独立した属性**であり、どちらか一方から他方を推測することはできない。

---

## 4. 発動対象ポジション定義の有無

**存在しない。** 確認した範囲（§1のデータソースすべて）に、プレースタイル名から発動対象ポジション・
発動条件・数値コードを引ける確認済みの対応表は見つからなかった。

参考: `docs/player-root-findings.md` に、eFHUBフロントエンドのi18nメッセージ辞書から抽出された英語の
プレースタイル説明文（`playstyle_sheet_desc_1`〜`33`、23番は欠番）が存在する。これは公式アプリの文言を
そのまま抽出したものであり、各プレースタイルの一般的な役割を説明する一次情報として価値がある
（例: `playstyle_sheet_desc_8` = "A deep sitting defensive midfielder protecting the backline." は
内容的に `Anchor Man` の説明と考えられる）。**ただし、この番号(`desc_N`)と実際のプレースタイル名
（`playing_style`列の値）を結びつける確認済みの対応表（数値ID列）は本プロジェクト内に存在しない**
（`docs/db-schema.md`: 「数値コードは未取得 → NULL」）。したがって、内容が似ているからといって
`desc_N` とプレースタイル名を1対1に断定することは、今回は行わない。この対応付けは、将来 numeric_id を
確認できた場合の追加調査課題として本台帳の「未確認事項」に記載する。

---

## 5. 規則台帳（本体）

以下の表の列の意味:

- **識別子**: `src/lib/world/playing-style.ts` の `KNOWN_OFFENSIVE_PLAYING_STYLES` /
  `KNOWN_DEFENSIVE_PLAYING_STYLES` に定義された `canonicalId` と**完全に一致**する（第2版で実装と同期済み）。
  表示・検索・比較・監査スクリプルでの照合キーとして利用可能。**ユーザー向け画面には表示しない内部識別子**。
- **発動対象ポジション/発動対象外ポジション**: 確認できないため全行「未確認」（正規化層は発動可否を一切扱わない）
- **確認状態**: 本文末尾の分類定義（§9）のいずれかに一致
- **件数**: `world_player_cards`（13,009件）における実件数（2026-09-06時点のSQLiteデータ）

### 5-1. 攻撃プレースタイル（`world_player_cards.playing_style`・World由来・21種類）

| 識別子 | 日本語表示名 | 英語表示名（既存データ上の表記） | 件数 | 発動対象ポジション | 発動対象外ポジション | 確認状態 | 根拠/出典 | 最終確認日 | 使用可否 | 未確認事項 |
|---|---|---|---|---|---|---|---|---|---|---|
| basic | 未確認（存在しない） | Basic | 1827 | 未確認 | 未確認 | 正規化可能（`status: "basic"`・実スタイルの`known`とは区別） | SQLite `world_player_cards.playing_style` | 2026-09-06 | 表示・照合に利用可能（実スタイルと混同しない前提） | 「特色なし」を表す既定値かどうか未確認 |
| holePlayer | 未確認 | Hole Player | 1181 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 発動条件・descとの対応 |
| goalPoacher | 未確認 | Goal Poacher | 1132 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| creativePlaymaker | 未確認 | Creative Playmaker | 1131 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| boxToBox | 未確認 | Box-to-Box | 1105 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 攻撃/守備両欄に出現する3値の1つ |
| prolificWinger | 未確認 | Prolific Winger | 1045 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 発動条件・descとの対応 |
| buildUp | 未確認 | Build Up | 1031 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| attackingFullBack | 未確認 | Attacking Full-back | 1025 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| orchestrator | 未確認 | Orchestrator | 660 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| deepLyingForward | 未確認 | Deep-lying Forward | 418 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | eFHUB表記との大文字差（§6） |
| foxInTheBox | 未確認 | Fox in the Box | 406 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | eFHUB表記との大文字差（§6） |
| roamingFlank | 未確認 | Roaming Flank | 373 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 発動条件・descとの対応 |
| anchorMan | 未確認 | Anchor Man | 352 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 攻撃/守備両欄に出現する3値の1つ |
| defensiveFullBack | 未確認 | Defensive Full-back | 239 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 発動条件・descとの対応 |
| extraFrontman | 未確認 | Extra Frontman | 226 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| fullBackFinisher | 未確認 | Full-back Finisher | 226 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| crossSpecialist | 未確認 | Cross Specialist | 189 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| targetMan | 未確認 | Target Man | 188 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| classicNo10 | 未確認 | Classic No. 10 | 149 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| dummyRunner | 未確認 | Dummy Runner | 105 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| highLineGk | 未確認 | High Line GK | 1 | 未確認 | 未確認 | 一部のカードだけ利用可能（サンプル数1件のみ） | 同上 | 同上 | 表示のみ可（要注意） | サンプル数が極端に少なく、GK専用と思われるが「攻撃」列に現れる理由も未確認 |

### 5-2. 守備プレースタイル（`world_player_cards.playing_style_def`・攻撃と重複しない11種類）

| 識別子 | 日本語表示名 | 英語表示名 | 件数 | 発動対象ポジション | 発動対象外ポジション | 確認状態 | 根拠/出典 | 最終確認日 | 使用可否 | 未確認事項 |
|---|---|---|---|---|---|---|---|---|---|---|
| theDestroyer | 未確認 | The Destroyer | 856 | 未確認 | 未確認 | データは存在するが意味・適用条件が未確認 | SQLite `world_player_cards.playing_style_def` | 2026-09-06 | 表示のみ可 | eFHUB「Destroyer」（The無し）との異表記（§6） |
| attackingGk | 未確認 | Attacking GK | 660 | 未確認（GK専用と推定されるが未確認） | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | GK専用と断定できる確認済み根拠なし |
| defensiveGk | 未確認 | Defensive GK | 300 | 未確認 | 未確認 | 同上 | 同上 | 同上 | 表示のみ可 | 同上 |
| frontLinePressure | 未確認 | Front Line Pressure | 13 | 未確認 | 未確認 | 一部のカードだけ利用可能（13件） | 同上 | 同上 | 表示のみ可 | サンプル数が少ない |
| passDisruptor | 未確認 | Pass Disruptor | 12 | 未確認 | 未確認 | 一部のカードだけ利用可能（12件） | 同上 | 同上 | 表示のみ可 | 同上 |
| frontLinePoacher | 未確認 | Front Line Poacher | 11 | 未確認 | 未確認 | 一部のカードだけ利用可能（11件） | 同上 | 同上 | 表示のみ可 | 同上 |
| allActionDefender | 未確認 | All-action Defender | 8 | 未確認 | 未確認 | 一部のカードだけ利用可能（8件） | 同上 | 同上 | 表示のみ可 | 同上 |
| highLineMaster | 未確認 | High Line Master | 6 | 未確認 | 未確認 | 一部のカードだけ利用可能（6件） | 同上 | 同上 | 表示のみ可 | 同上 |
| coveringRole | 未確認 | Covering Role | 4 | 未確認 | 未確認 | 一部のカードだけ利用可能（4件） | 同上 | 同上 | 表示のみ可 | 同上 |
| attackOutlet | 未確認 | Attack Outlet | 3 | 未確認 | 未確認 | 一部のカードだけ利用可能（3件） | 同上 | 同上 | 表示のみ可 | 同上 |
| sweeperGk | 未確認 | Sweeper GK | 1 | 未確認（GK専用と推定されるが未確認） | 未確認 | 一部のカードだけ利用可能（1件） | 同上 | 同上 | 表示のみ可（要注意） | サンプル数が極端に少ない |

### 5-3. eFHUB由来の表記（`player_cards`・19件）と World表記との対応・不整合

eFHUBは19件のみ（正本ワークスペースのbaseline `player_cards = 19`と一致）。`playing_style_defensive`は
19件中19件ともNULL（守備プレースタイルは一度も取得できていない）。

| eFHUB上の表記 | 件数 | Worldの`playing_style`に完全一致するか | 確認状態 | 備考 |
|---|---|---|---|---|
| Creative Playmaker | 3 | 一致（`creativePlaymaker`） | 正規化可能（`known`） | - |
| Build Up | 2 | 一致（`buildUp`） | 正規化可能（`known`） | - |
| Destroyer | 2 | **不一致**（World守備欄は`The Destroyer`） | **正規化対象外（統合しない）** | `The`の有無は似ているが、`Destroyer`はeFHUBの**攻撃**欄の実値であり、`The Destroyer`はWorldの**守備**欄専用の値。属性をまたいだ対応付けは行わず、`normalizePlayingStyle("Destroyer","offensive","efhub")`は`status: "unknown"`を返す（第2版で確定） |
| $undefined | 1 | 不一致（対応する概念なし） | **異常値（`status: "anomaly"`）** | 文字列として`"$undefined"`が格納されている。パース時の欠損値がそのまま文字列化された可能性が高いが未確認。`PLAYING_STYLE_ANOMALY_VALUES`に登録し、正式なプレースタイルとして扱わない |
| Box To Box | 1 | **不一致**（Worldは`Box-to-Box`、ハイフン） | **表記揺れとして正規化済み（`aliasMatched` → `boxToBox`）** | スペース区切り vs ハイフン区切り。同じ攻撃欄どうしの綴り違いのため`PLAYING_STYLE_ALIASES`へ登録 |
| Classic No. 10 | 1 | 一致 | 正規化可能（`known`） | - |
| Cross Specialist | 1 | 一致 | 正規化可能（`known`） | - |
| Deep-Lying Forward | 1 | **不一致**（Worldは`Deep-lying Forward`、`L`の大文字小文字差） | **表記揺れとして正規化済み（`aliasMatched` → `deepLyingForward`）** | 同じ攻撃欄どうしの大文字小文字違いのため`PLAYING_STYLE_ALIASES`へ登録 |
| Defensive Goalkeeper | 1 | 不一致（Worldの守備欄は`Defensive GK`） | **正規化対象外（統合しない）** | `Destroyer`と同じ理由（属性をまたぐ対応付けになるため）。`normalizePlayingStyle("Defensive Goalkeeper","offensive","efhub")`は`status: "unknown"`（第2版で確定） |
| Fox In The Box | 1 | **不一致**（Worldは`Fox in the Box`、`In`/`The`の大文字小文字差） | **表記揺れとして正規化済み（`aliasMatched` → `foxInTheBox`）** | 同じ攻撃欄どうしの大文字小文字違いのため`PLAYING_STYLE_ALIASES`へ登録 |
| Hole Player | 1 | 一致 | 正規化可能（`known`） | - |
| Offensive Goalkeeper | 1 | 不一致（World側に対応する攻撃欄の値なし。守備欄`Attacking GK`が近いか未確認） | 未確認（`unknown`） | 同一概念かは未確認のため未登録。断定しない |
| Offensive Wingback | 1 | 不一致（World側に完全一致なし。`Attacking Full-back`が近いか未確認） | 未確認（`unknown`） | 同一概念かは未確認のため未登録。断定しない |
| Orchestrator | 1 | 一致 | 正規化可能（`known`） | - |
| Prolific Winger | 1 | 一致 | 正規化可能（`known`） | - |

### 5-4. AIプレースタイル（`world_player_ai_styles.style_name`・①②とは別概念・8種類）

選手1人が0〜複数個保持（13,009選手中11,558選手が最低1個保持・平均2.43個/選手）。**通常のプレースタイル
（①②）と混同禁止**（今回の調査で明確に別テーブル・別概念であることを確認済み）。

| 表記 | 件数 | 確認状態 | 使用可否 |
|---|---|---|---|
| Long Ranger | 5052 | データは存在するが意味・適用条件が未確認 | 今回の分析には使用不可 |
| Mazing Run | 5019 | 同上 | 同上 |
| Speeding Bullet | 3854 | 同上 | 同上 |
| Incisive Run | 3851 | 同上 | 同上 |
| Long Ball Expert | 3813 | 同上 | 同上 |
| Trickster | 3199 | 同上 | 同上 |
| Early Cross | 2146 | 同上 | 同上 |
| `-`（ハイフン1文字） | 1111 | **未知値**（NULLではなく「なし」を表す記号の可能性が高いが未確認） | 今回の分析には使用不可 |

### 5-5. Link-Up Play条件のプレースタイル（`manager_link_up_conditions.playing_style`・別概念・10種類）

52件のLink-Up Play条件すべてにプレースタイル条件が設定されている（positions条件との併用有無は今回未調査）。
**10種類すべてが`world_player_cards.playing_style`の値と完全一致**（大文字小文字・空白差も含めて0件の不一致）。

| 表記 | 条件での使用件数 | Worldの`playing_style`との一致 |
|---|---|---|
| Creative Playmaker | 9 | 一致 |
| Goal Poacher | 8 | 一致 |
| Prolific Winger | 7 | 一致 |
| Orchestrator | 7 | 一致 |
| Fox in the Box | 7 | 一致 |
| Cross Specialist | 4 | 一致 |
| Hole Player | 3 | 一致 |
| Build Up | 3 | 一致 |
| Box-to-Box | 2 | 一致 |
| Attacking Full-back | 2 | 一致 |

この一致は`link-up.ts`の実装（`norm()`による大小・前後空白を無視した完全一致比較）が安全に機能する根拠として
確認済みで利用可能。**ただし、これは「Link-Up Play条件の充足判定」であり、「プレースタイルがポジション上で
発動するかどうか」の判定とは別の確認済み機能である**（混同しないこと＝調査項目14への回答）。

---

## 6. 表記揺れ・異常値の一覧（まとめ）

| 種別 | 内容 | 影響 |
|---|---|---|
| 大文字小文字・区切り文字の違い | `Box To Box` (eFHUB) vs `Box-to-Box` (World) / `Deep-Lying Forward` vs `Deep-lying Forward` / `Fox In The Box` vs `Fox in the Box` | eFHUB(19件)とWorld(13,009件)を単純な文字列一致で突き合わせると一部が不一致になる |
| 略記の違い | `Defensive Goalkeeper`/`Offensive Goalkeeper` (eFHUB) vs `Defensive GK`/`Attacking GK` (World) | 同一概念の可能性はあるが確認済み根拠なし。断定しない |
| 冠詞の有無 | `Destroyer` (eFHUB) vs `The Destroyer` (World守備欄) | 同上 |
| 異常値 | `$undefined`（eFHUB、1件） | パース/欠損の artifact の可能性が高い。**分析には使用不可** |
| 未知の記号値 | AIプレースタイルの`-`（1111件） | NULLとは区別される値だが意味未確認 |
| World内の大文字小文字表記揺れ | 0件（`playing_style`列内では検出されず。データ自体はクリーン） | 該当なし |
| 極端に少ないサンプル | `High Line GK`(1件)・`Sweeper GK`(1件)・`Attack Outlet`(3件)等 | 統計的な傾向を語れるサンプル数ではない |

---

## 7. プレースタイル正規化層（実装済み・第2版で追加）

`src/lib/world/playing-style.ts`（純関数のみ・SQLite/localStorage/HTTP/DOM一切不使用）。
発動対象ポジション・発動可否は一切扱わない（本台帳§0の方針を維持）。

### 7-1. 設計

- `normalizePlayingStyle(rawValue, attribute, source)`: 攻撃(`offensive`)/守備(`defensive`)プレースタイルを
  正規化する。`attribute`を明示的に受け取り、**攻撃と守備を統合しない**（同じ英語表記でも別々に扱う）。
- `normalizeAiPlayingStyle(rawValue, source)`: AIプレースタイル専用の別関数。通常プレースタイルとcanonicalId・
  別名テーブルを共有しない。
- 大文字小文字・ハイフン・空白を無制限に自動吸収するフォールバックは実装していない。前後の空白除去だけを
  行い、それ以外は`PLAYING_STYLE_ALIASES`に明示登録された組み合わせだけを別名として解決する。
- 判定結果`status`: `known`（正規表記に完全一致）/ `aliasMatched`（確認済み別名に一致）/ `basic`（`"Basic"`）/
  `empty`（null・undefined・空文字）/ `anomaly`（`$undefined`等の確認済み異常値）/ `unknown`（未知の値）/
  `notApplicable`（他方の属性の確認済み名称と一致。攻撃⇔守備を混同させないための専用ステータス）。
- `canonicalId`はこのモジュール内だけの内部識別子。**ユーザー向け画面には表示しない**
  （画面には既存の`rawValue`/`canonicalEnglishName`＝既存の英語表記をそのまま表示する）。

### 7-2. 確認済みの別名（3件。台帳§5-3から実装へ反映）

| eFHUB表記（別名） | 属性 | canonicalId | 正規表記 |
|---|---|---|---|
| Box To Box | offensive | boxToBox | Box-to-Box |
| Deep-Lying Forward | offensive | deepLyingForward | Deep-lying Forward |
| Fox In The Box | offensive | foxInTheBox | Fox in the Box |

### 7-3. 慎重に検討し、あえて別名登録しなかったもの

実装・テストの過程で、`Destroyer`/`Defensive Goalkeeper`（いずれもeFHUBの**攻撃**欄`playing_style_name`に
実在する値）は、類似する`The Destroyer`/`Defensive GK`が**Worldの守備欄`playing_style_def`専用の値**である
ことを確認した。これらを同一視するには「攻撃欄の値を守備欄の概念として読み替える」という、属性をまたいだ
未確認の推測が必要になるため、**別名登録しなかった**（`status: "unknown"`のまま）。`Offensive Wingback`・
`Offensive Goalkeeper`も同様に、World側に完全一致・確認済み対応が無いため未登録のまま。

### 7-4. 異常値・未知記号の扱い

- `PLAYING_STYLE_ANOMALY_VALUES = {"$undefined"}`: 正式なプレースタイルとして登録しない（`status: "anomaly"`）。
- `AI_PLAYING_STYLE_UNKNOWN_MARKERS = {"-"}`: AIプレースタイル側だけの未知記号（`status: "unknownMarker"`）。
  通常プレースタイルの異常値とは別カテゴリとして扱う。

### 7-5. 既存コードへの接続範囲

| 接続先 | 内容 | 既存挙動への影響 |
|---|---|---|
| `scripts/audit-playing-styles.mjs` | 正規化済み/別名一致/Basic/値なし/異常値/未知値/他属性一致の件数集計・データソース別集計を追加（§11） | 影響なし（読み取り専用の監査スクリプト） |
| `src/lib/squad/link-up.ts` | `playerMatches`のプレースタイル一致判定を、正規化層経由の比較（両者が確認済み値のときだけ`canonicalId`+`attribute`で比較）へ変更。**どちらか一方でも未確認の値なら、既存の大小無視・trim完全一致比較へフォールバックする**ため、正規化層を経由しても未確認の値どうしの一致・不一致は変化しない | **実データで判定結果の変化なし**（§7-6で検証） |

配置構造・戦術監査（`squad-tactical-review.ts`）・通常/辛口コメント・8カテゴリ診断・PNG画像保存は今回接続していない（対象外）。

### 7-6. Link-Up Play照合への影響（変更前後の差分確認）

`manager_link_up_conditions.playing_style`の実データ10種類（台帳§5-5）は、いずれもWorldの`playing_style`と
完全一致することを監査済みであり、正規化層を経由しても`status: "known"`同士の比較になるため、**判定結果は
変更前とまったく同じ**であることをUnit Test（`link-up.test.ts`「回帰確認: 実際に運用されている10種類の
Link-Up Play条件値は、正規化接続の前後で判定が変わらない」）で確認済み。表記揺れ（`Box To Box`等）が
関わるのは現状eFHUBの19件のみであり、スカッドのLink-Up Play照合はWorldカードのみを対象とするため
（`build-squad.ts`→`from-world.ts`経由）、**現時点の実運用データでは表記揺れによる不一致は発生していなかった
（今回の接続は将来的な保険としての意味合いが大きい）**。

---

## 8. 観察情報（発動条件の根拠には使用しない参考データ）

`playing_style`（World・21種類）ごとに実データ上でどの`registered_position`と共起しているかを機械的に
集計した（`scripts/audit-playing-styles.mjs` §10）。**これは相関の観察に過ぎず、公式または確認済みの
発動条件ではない。** 一部は名称から連想される役割と一致するように見える（例: `Fox in the Box`は406件
すべてがCF、`Target Man`は188件すべてがCF）一方、`Extra Frontman`（226件）は名称に反して224件がCBという
反直感的な分布を示しており、**名称からの推測がいかに危険かを示す実例**でもある。この観察情報は台帳の
「発動対象ポジション」列を埋める根拠として**使用していない**（すべて「未確認」のまま）。

主な結果（全件は監査スクリプトの出力を参照）:

- 単一ポジションにほぼ限定: `Fox in the Box`(CF 100%)・`Target Man`(CF 100%)・`Build Up`(CB 100%)
- 複数ポジションにまたがる: `Basic`(GK/CB/DMF等・既定値のため分散が大きいと考えられる)
- 名称と実際のポジションが直感と異なる例: `Extra Frontman`(CBが99%)

---

## 9. 分類まとめ（調査項目ごとの確認状態）

| 調査項目 | 分類 |
|---|---|
| 1. 全プレースタイル名の棚卸し | 確認済みで利用可能（値の一覧・件数として） |
| 2. 日本語名・英語名 | 英語名: 確認済みで利用可能。**日本語名: プロジェクト内に一切存在しない（未実装）** |
| 3. 表記揺れ・別名・空文字・null・未知値 | 表記揺れまたは不整合あり（§6に一覧化） |
| 4. SQLite列とTS型 | 確認済みで利用可能（本台帳§1・§5に記載） |
| 5. プレースタイルを持つカード数 | 確認済みで利用可能（World: 13,009/13,009・eFHUB: 19/19、いずれも必須項目のため欠損0） |
| 6. プレースタイル未登録のカード数 | 確認済みで利用可能（0件。ただし`Basic`が実質的な「特色なし」の既定値である可能性は未確認） |
| 7. playingStyleとplayingStyleDefensiveの違い | 確認済みで利用可能（§3） |
| 8. 画面での使用箇所 | 確認済みで利用可能（`WorldPlayerHero.tsx`等でバッジ表示・翻訳なし） |
| 9. 計算・診断での使用箇所 | 確認済みで利用可能（8カテゴリ診断は不使用。戦術監査は型のみ保持し未使用。Link-Up Playのみ完全一致判定で使用） |
| 10. 発動対象ポジション定義の有無 | **未実装（存在しないことを確認済み）** |
| 11. 発動条件のテスト・設計書 | 未実装（`squad-tactical-review.test.ts`に「発動分析ではないことを保証する」テストは存在するが、発動条件自体のテストは無い） |
| 12. eFHUBとWorldの差 | 表記揺れまたは不整合あり（§5-3・§6） |
| 13. ポジション適性との混同 | 混同なし（別概念として実装済み・本調査で分離を確認） |
| 14. Link-Up Playとの混同 | 混同なし（別概念として実装済み・完全一致判定は確認済みで利用可能） |
| 15. AIプレースタイル・選手スキルとの混同 | 混同なし（別テーブル・別概念であることを確認済み。今回の分析には使用不可） |

---

## 10. 不足しているデータ・次の安全な実装手順

### 不足データ

1. プレースタイル名と発動対象ポジションを結びつける公式または確認済みの対応表（存在しない）
2. プレースタイルの数値ID（`docs/db-schema.md`が「未取得」と明記済み。`playstyle_sheet_desc_N`との対応も未確認）
3. プレースタイルの日本語表示名（プロジェクト内に皆無）
4. `playing_style_def = "Basic"`が「守備プレースタイル無し」を意味するという解釈の公式確認
5. `Destroyer`/`Defensive Goalkeeper`/`Offensive Goalkeeper`/`Offensive Wingback`（eFHUB）とWorldの
   対応する可能性がある概念との、属性をまたいだ確認済み対応関係（第2版時点でも未解決。正規化層では
   意図的に未登録のまま）

### 次の安全な実装手順（今回は実施しない・将来の提案）

1. 発動対象ポジションを確認できる一次情報（公式資料・確認済みの外部情報）が得られた場合のみ、本台帳の
   該当行を「確認済みで利用可能」へ更新し、根拠/出典と最終確認日を記録する。
2. 確認が取れた項目から段階的に、`squad-tactical-review.ts`とは独立した新しいモジュールとして
   「プレースタイル発動可否」機能を設計する（既存の配置構造・戦術監査のロジックへ直接混入させない）。
3. 正規化層（`normalizePlayingStyle`）を、表示専用の表記統一（例: 選手一覧・比較画面でのプレースタイル
   フィルター表記統一）へ段階的に接続することを検討する（発動可否には踏み込まない）。
4. 未確認のまま推測で対応表を作らない。確認できない限り、「不明」「未確認」を明示し続ける。

---

## 11. 監査スクリプト

`scripts/audit-playing-styles.mjs`（新規・読み取り専用・恒久スクリプトとして追加。第2版で正規化層接続の
集計セクション §11・§12相当を追加）。

- SQLiteへ書き込まない（`DatabaseSync(..., { readOnly: true })`）
- 実ユーザーデータ（localStorage・保存スカッド・保存ビルド）へ一切アクセスしない
- 同一データから常に同一の集計結果を出す（`GROUP BY` + 決定的な `ORDER BY`）
- NULLと空文字を区別して集計する
- 出力に個人情報を含まない（選手カードの公開データの集計のみ）
- 正規化済み件数・別名一致件数・Basic件数・値なし件数・異常値件数・未知値件数・他属性一致件数・
  正規化できなかった実値・データソース別（World/eFHUB/Link-Up Play/AI）集計を出力する
- 実行方法: `node scripts/audit-playing-styles.mjs`

---

## 12. 変更履歴

- 2026-09-06（第2版）: プレースタイル正規化層 `src/lib/world/playing-style.ts` を実装。確認済み別名3件を
  `link-up.ts`へ安全に接続（既存挙動への影響なしをテストで確認）。`Destroyer`/`Defensive Goalkeeper`は
  属性をまたぐため別名登録を見送り（§7-3）。
- 2026-09-06（初版）: 初版作成（調査専用・発動可否判定は未実装）
