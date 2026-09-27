# F-072 称号・バッジ — 規則（2026-09-27）

状態: 実装済み（規則 `player-titles/2026-09-27.v1`・`diagnosis-titles/2026-09-27.v1`）。Production・DB・共有 URL の契約（sd1）の変更なし。

## 方針（本人の判断）

- ルールベース・決定的（同じ入力なら同じ結果）・版つき・説明できる（「理由を見る」で根拠の値と規則の版を表示）。
- 称号は最大1つ、バッジは最大4つ。条件を満たさなければ出さない。抽選・レア度・演出はない。
- 「最強」「公式」「専門家」などの表現を使わない（テストで確認）。
- 最初の表示場所は、選手詳細と共有カード（スカッド診断の共有ページ）。

## 選手の称号（選手詳細の「能力値」タブ）

- 入力: F-071 の基礎能力値（育成前）の区分。範囲は**役割**（フィールドプレイヤーどうし / GK どうし）で、1回の判定で範囲を混ぜない。
- 閾値は分布から決まる区分: **称号 = 規則の全能力が上位5%以内**、**バッジ = 上位10%以内**。
- 強さ = 規則の能力のうち最も低い位置（上位割合の最大値）。同じなら定義順。
- F-071 の分布が照合できないとき（未生成・古い）は表示しない。

| 規則 | 役割 | 能力 |
|---|---|---|
| 快速 / Pace | フィールド | speed, acceleration |
| 決定力 / Finishing | フィールド | finishing, offensiveAwareness |
| ドリブル / Dribbling | フィールド | dribbling, ballControl, tightPossession |
| 配球 / Passing range | フィールド | lowPass, loftedPass |
| プレースキック / Set pieces | フィールド | setPieceTaking, curl |
| 空中戦 / Aerial | フィールド | heading, jumping |
| ボール奪取 / Ball winning | フィールド | tackling, defensiveEngagement, defensiveAwareness |
| フィジカル / Physicality | フィールド | physicalContact, balance |
| 運動量 / Stamina | フィールド | stamina |
| シュートストップ / Shot-stopping | GK | gkReflexes, gkParrying |
| キャッチ・リーチ / Handling & reach | GK | gkCatching, gkReach |
| GK感覚 / GK awareness | GK | gkAwareness |

## スカッド診断の称号（診断結果・共有カード）

- 入力: 診断のカテゴリの点数と段階（共有 URL の `c` と同じ情報。表示時に計算し、URL には入れない）。
- 閾値は診断の段階をそのまま使う: 称号・バッジとも**段階 A 以上**。称号 = 最高点のカテゴリ（同点は定義順）、バッジ = 残りを点数順に最大4つ。
- スカッドの完成度はスタイルではないため対象外。
- 呼び名: カウンター型・ビルドアップ型・ポゼッション型・プレス耐性型・スピード型・空中戦型・攻撃型・堅守型。

## 検証

- 単体テスト: `src/lib/titles/titles.test.ts`（閾値・最大数・役割・決定性・文言の禁止語）。
- ブラックボックス: `scripts/black-box-base-percentile.mjs`（8 viewport × 日英。選手詳細は合成の分布、共有カードは sd1 の見本で、称号 counterAttack・バッジ pressResistance, dribblePossession を確認）。

## 規則を変えるとき

規則の版を上げる（`…v2`）。表示される称号が変わるため、変更点をこの文書へ記録する。
