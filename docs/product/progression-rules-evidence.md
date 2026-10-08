# 育成の計算の規則: 根拠と能力値スライダーの契約（2026-10-08）

## 1. 根拠の調査（2026-10-08・読み取りだけ・13 件の要求）

本人の承認（2026-10-08）の上で、公開の情報を GET だけで調べた。保存はこのリポジトリの文書だけ。

| 情報源 | 書かれていること | 使い方 |
|---|---|---|
| efootballlab（育成ポイントの計算機・育成の解説、同じサイトの 2 ページ） | "levels 1–4 cost one point each, 5–8 cost two each, 9–12 cost three each, and the pattern continues every four levels" | コストの規則（4 段階ごと） |
| 本人の確認（2026-10-08 の指示「4Levelごとの必要Point変化」） | 4 段階ごとにコストが変わる | 同上 |
| pesmastery（コードの以前の根拠） | 「0-4 段階は 1pt、5 段階目以降は 2pt」 | 4 段階ごとと読むのが自然。以前は 5 段階ごとと解釈していた（誤り） |
| gamingonphone・gamemarket・pesmastery | Shooting = Finishing・Set Piece Taking（Place Kicking）・Curl | Shooting の対象（確認済みのまま） |
| 同上・efootballlab・KONAMI の公式（Dream Team）・eFHUB | 他の 9 カテゴリの対象能力の一覧は**どこにも無い** | 確認できない（推定のまま） |
| **訂正（2026-10-09）** eFHUB の育成シミュレーター（公開のページのクライアントの定義） | 10 カテゴリすべての対象能力の定義がある（2026-10-08 の調査はページの本文だけを見ていて見落とした） | eFHUB基準で照合し、6 カテゴリを直した（§4・`progression-efhub-crosscheck-2026-10-09.md`） |

## 2. コストの規則（版）

| 版（`costRuleId`） | コスト | 使う場面 |
|---|---|---|
| `staged-2026-10-08`（現行） | 1〜4 段階 1pt・5〜8 段階 2pt・9〜12 段階 3pt … 4 段階ごとに +1pt | 新しい育成・新しく保存するビルド・自動配分 |
| `staged-2026-08-28`（旧） | 1〜5 段階 1pt・6〜10 段階 2pt … 5 段階ごとに +1pt | `costRuleId` の無い既存のビルド（保存した時の規則のまま。黙って変えない） |

- ポイント総数 = (最大レベル − 1) × 2（確認済み・変更なし）。
- 規則で変わるのは**ポイントの計算だけ**。能力値の上昇・OVR は規則に依存しない（テストで確認）。
- 旧規則のビルドを開くと案内を出し、「現在のポイント計算で再計算」で現行の規則に切り替えられる（ポイントが足りなくなるカテゴリは既存の
  「使いすぎ」の警告で示す）。保存すると新しいビルドに現行の規則が記録される。元のビルドは変わらない。
- 保存の形: `SavedBuild.costRuleId`（省略可・知らない値は旧規則として読む・移行不要）。書き出し・読み込み・バックアップで保持。
- 例: カテゴリ Lv10 は旧規則 15pt、現行 18pt。

## 3. 能力値スライダーの契約（能力値を直接操作する育成）

- 能力値を選ぶと、その能力が属する**育成カテゴリのレベル**を動かす（能力値単体へのポイント配分は作らない）。同じカテゴリの能力も一緒に再計算する。
- スライダーの値はカテゴリのレベル。表示: 操作している能力・カテゴリ・Lv の前後・必要／返却ポイント・次の 1 段階のコスト・到達可能な最大・
  一緒に変わる能力の前後と増減・内訳（基礎値・育成・ブースター・監督・その他・最終値）。
- 正の状態は既存のカテゴリの配分（ビルドの `progressionAllocation`）だけ。左側のカテゴリのスライダー・＋／−・元に戻す・リセット・保存は同じ状態を操作する。
- 操作: ドラッグ（ポインター・タッチ）・← → ↑ ↓（±1）・Page Up / Page Down（±4）・Home（0）・End（到達可能な最大）。ドラッグ中はプレビューだけで、
  離したときに確定する（ドラッグ中に保存しない・通信しない）。
- **斜線の範囲**: 到達可能な最大（残りポイントで届く Lv）からカテゴリの上限までの範囲。理由は**残りポイントの不足**。足りないポイントを文字で示す。
- **カテゴリの上限**: 対象能力のうち最も伸びしろのある能力が 99 に届くレベル（`maxUsefulLevelForGroup`）。
- 届かない位置へ動かすと最後の有効な値で止まり、エラーにしない。ポイントは負にならない。

## 4. 能力値と育成カテゴリの対応表（2026-10-09・eFHUB基準）

| 能力（ID） | English | 育成カテゴリ | 根拠 | 以前の TeamAIXI との比較 |
|---|---|---|---|---|
| finishing | Finishing | shooting | eFHUB基準・外部ガイド複数 | 一致 |
| setPieceTaking | Set Piece Taking | shooting | 同上 | 一致 |
| curl | Curl | shooting | 同上 | 一致 |
| lowPass | Low Pass | passing | eFHUB基準 | 一致 |
| loftedPass | Lofted Pass | passing | eFHUB基準 | 一致 |
| offensiveAwareness | Offensive Awareness | dexterity | eFHUB基準 | **修正**（以前は passing） |
| ballControl | Ball Control | dribbling | eFHUB基準 | 一致 |
| dribbling | Dribbling | dribbling | eFHUB基準 | 一致 |
| tightPossession | Tight Possession | dribbling | eFHUB基準 | 一致 |
| speed | Speed | lowerBodyStrength | eFHUB基準 | **修正**（以前は dexterity） |
| acceleration | Acceleration | dexterity | eFHUB基準 | 一致 |
| kickingPower | Kicking Power | lowerBodyStrength | eFHUB基準 | 一致 |
| balance | Balance | dexterity | eFHUB基準 | **修正**（以前は lowerBodyStrength） |
| stamina | Stamina | lowerBodyStrength | eFHUB基準 | 一致 |
| heading | Heading | aerialStrength | eFHUB基準 | 一致 |
| jumping | Jumping | aerialStrength **と** goalkeeping1 | eFHUB基準 | **修正**（GK 1 にも入る・両方のレベルが合算） |
| physicalContact | Physical Contact | aerialStrength | eFHUB基準 | 一致 |
| defensiveAwareness | Defensive Awareness | defending | eFHUB基準 | 一致 |
| tackling | Tackling | defending | eFHUB基準 | 一致 |
| aggression | Aggression | defending | eFHUB基準 | 一致 |
| defensiveEngagement | Defensive Engagement | defending | eFHUB基準 | 一致 |
| gkAwareness | GK Awareness | goalkeeping1 | eFHUB基準 | 一致 |
| gkReflexes | GK Reflexes | goalkeeping3 | eFHUB基準 | **修正**（以前は goalkeeping1） |
| gkCatching | GK Catching | goalkeeping3 | eFHUB基準 | **修正**（以前は goalkeeping2） |
| gkParrying | GK Parrying | goalkeeping2 | eFHUB基準 | 一致 |
| gkReach | GK Reach | goalkeeping2 | eFHUB基準 | **修正**（以前は goalkeeping3） |

- eFHUB基準 = eFHUB の公開の育成シミュレーターの定義と照合した（2026-10-09・クライアントの版 `dpl_7gGKaJc1jLQoxvhP9JHRJQakeEGq`）。
  **ゲームの公式の発表ではない**（KONAMI は対象能力の一覧を公開していない）。画面では「eFHUB基準」と示し、「公式」「ゲーム内で確認済み」とは書かない。
- 6 カテゴリ（Passing・Dexterity・Lower Body Strength・GK 1・GK 2・GK 3）が以前の TeamAIXI の推定と違っていたため、eFHUB基準へ直した。
  以前の「1 つの情報源のヒント（Dexterity = Acceleration・Offensive Awareness・Balance）」は eFHUB と一致した。
- Jumping だけが 2 つのカテゴリ（Aerial Strength・GK 1）の対象。両方を上げるとレベルが合算される（eFHUB と同じ）。
- 保存したビルドの配分（カテゴリのレベル）とポイントは変えない。同じ配分から求める能力値が eFHUB基準の対応で計算し直される
  （影響と照合の記録: `progression-efhub-crosscheck-2026-10-09.md`・`docs/production-readiness/evidence/efhub-progression-crosscheck-2026-10-09.json`）。

## 5. 画面の表示（未確定の文言の整理）

| 以前 | 今 | 理由 |
|---|---|---|
| 対象能力は検証中 | 対象能力は推定（説明つき） | 割り当ては実装済みで推定。何が未確認かを具体的に示す |
| 計算規則を確認中（ポジション別 OVR） | 公式の計算式が非公開のため計算しません | 計算しない理由を示す（作業中ではない） |
| 消費は段階コスト（検証中） | 1〜4 段階 1pt … 4 段階ごとに +1pt（確認済み） | 根拠を確認した |
| 検証中（暫定規則を使用） | 推定値（能力ごとの上昇量は推定） | 何が推定かを示す |

確認: `src/lib/progression/cost-rule-v3.test.ts`・`scripts/black-box-cost-rule.mjs`（11/11）・`scripts/black-box-ability-progression.mjs`（506/506・8 viewport）・
`scripts/black-box-compare-ability-editor.mjs`（168/168）。
