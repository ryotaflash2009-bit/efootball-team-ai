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

## 4. 能力値と育成カテゴリの対応表

| 能力（ID） | English | 育成カテゴリ | 対応の確認 | 分類（指示の A〜H） |
|---|---|---|---|---|
| finishing | Finishing | shooting | 確認済み | A |
| setPieceTaking | Set Piece Taking | shooting | 確認済み | A |
| curl | Curl | shooting | 確認済み | A |
| lowPass | Low Pass | passing | 推定 | A（推定） |
| loftedPass | Lofted Pass | passing | 推定 | A（推定） |
| offensiveAwareness | Offensive Awareness | passing | 推定 | A（推定） |
| ballControl | Ball Control | dribbling | 推定 | A（推定） |
| dribbling | Dribbling | dribbling | 推定 | A（推定） |
| tightPossession | Tight Possession | dribbling | 推定 | A（推定） |
| speed | Speed | dexterity | 推定 | A（推定） |
| acceleration | Acceleration | dexterity | 推定 | A（推定） |
| kickingPower | Kicking Power | lowerBodyStrength | 推定 | A（推定） |
| balance | Balance | lowerBodyStrength | 推定 | A（推定） |
| stamina | Stamina | lowerBodyStrength | 推定 | A（推定） |
| heading | Heading | aerialStrength | 推定 | A（推定） |
| jumping | Jumping | aerialStrength | 推定 | A（推定） |
| physicalContact | Physical Contact | aerialStrength | 推定 | A（推定） |
| defensiveAwareness | Defensive Awareness | defending | 推定 | A（推定） |
| tackling | Tackling | defending | 推定 | A（推定） |
| aggression | Aggression | defending | 推定 | A（推定） |
| defensiveEngagement | Defensive Engagement | defending | 推定 | A（推定） |
| gkAwareness | GK Awareness | goalkeeping1 | 推定 | A（推定） |
| gkReflexes | GK Reflexes | goalkeeping1 | 推定 | A（推定） |
| gkCatching | GK Catching | goalkeeping2 | 推定 | A（推定） |
| gkParrying | GK Parrying | goalkeeping2 | 推定 | A（推定） |
| gkReach | GK Reach | goalkeeping3 | 推定 | A（推定） |

- どの能力も 1 つのカテゴリだけに属する（A）。監督の補正（C）・ブースター（D）は内訳に別に出し、育成前の基礎値と混ぜない。
  ポジションの適性（E）は能力値を変えない（表示と OVR の推定だけ）。選手ごとの特例（F）は無い。育成で変えられない能力（G）は無い。
- 1 つの情報源のヒントでは Dexterity = Acceleration・Offensive Awareness・Balance とする記述があり、上の推定と違う。独立の確認が無いため変えない。
- **確認に必要なもの**: ゲームの育成画面で各カテゴリを選んだときに上がる能力の記録（カテゴリごとに 1 枚・本人の操作）。確認できたカテゴリから
  `statsConfidence: "confirmed"` にし、対応が違えばテストと保存ビルドへの影響を確かめてから直す。

## 5. 画面の表示（未確定の文言の整理）

| 以前 | 今 | 理由 |
|---|---|---|
| 対象能力は検証中 | 対象能力は推定（説明つき） | 割り当ては実装済みで推定。何が未確認かを具体的に示す |
| 計算規則を確認中（ポジション別 OVR） | 公式の計算式が非公開のため計算しません | 計算しない理由を示す（作業中ではない） |
| 消費は段階コスト（検証中） | 1〜4 段階 1pt … 4 段階ごとに +1pt（確認済み） | 根拠を確認した |
| 検証中（暫定規則を使用） | 推定値（能力ごとの上昇量は推定） | 何が推定かを示す |

確認: `src/lib/progression/cost-rule-v3.test.ts`・`scripts/black-box-cost-rule.mjs`（11/11）・`scripts/black-box-ability-progression.mjs`（506/506・8 viewport）・
`scripts/black-box-compare-ability-editor.mjs`（168/168）。
