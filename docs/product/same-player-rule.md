# 同じ選手の別のカードは同じスカッドに 1 枚だけ（2026-10-10）

## 根拠

- 本人のゲームの画面の確認（2026-10-10）: 同じ選手の別のカードは、同じスカッドに 2 枚編成できない。
- 表示名・翻訳名では判定しない（同じ名前の別人がいる）。

## 「同じ選手」の判定（`src/lib/world/person-identity.ts`）

World のカード ID の**下位 20 ビット**を人物キーとする（`BigInt(id) & (2^20 - 1)`）。

| データ | カード | 人物 | 複数のカードを持つ人物 | 食い違い（同じキーで名前・国籍が違う） |
| --- | --- | --- | --- | --- |
| ローカル SQLite | 13,009 | 3,775 | 2,151 | 0 |
| 本番 API（2026-10-10・`data/work/person-identity-prod-2026-10-10.json`） | 13,372 | 3,846 | 2,208 | 0 |

- 下位 16 ビットでは食い違い 59 件（足りない）。20 ビットで 0 件。
- 同じ名前・国籍でキーが違う 25 組は別人（例: 橋本 健人 / 橋本 拳人、Rodri 2 人、João Pedro、Danilo）。名前で判定すると誤って同じ選手にしてしまう。
- KONAMI が公開した仕様ではないため、World の更新（apply）のたびに再監査する:
  `node scripts/audit-person-identity.mjs`（ローカル）・`BASE_URL=https://… node scripts/audit-person-identity.mjs`（本番 API・読み取りだけ・ページ間 200 ms）。
  判定が `PERSON_IDENTITY_CONFLICT` なら規則を止めて調べる（食い違いのキーが出力される）。
- ID が数字でない・空のときは人物キーなし（`null`）→ カード ID 単位の従来の扱い（誤って同じ選手にしない側に倒す）。

## 経路ごとの扱い

方針: **新しく入れる操作は止める。保存・取り込み済みのデータは消さず・変えず、知らせる。**

| 経路 | 扱い | 実装 |
| --- | --- | --- |
| 手動の編集（先発の枠に入れる・入れ替え） | 拒否（`same_player_not_allowed`）。入れ替える枠自身のカードは除外して比べる | `assign.ts` `assignWorldCardToSlot` |
| 控えに追加 | 拒否 | `assign.ts` `addWorldCardToBench` |
| My Team から追加・World の詳細から追加 | 上の 2 つの関数を通る | 同上 |
| 先発 ⇄ 控えの移動・並べ替え・フォーメーションの変更 | 同じスカッドの中の移動だけ（新しいカードは入らない）→ 新しい重複は生まれない | `moves.ts`・`formation-change.ts` |
| AI ベスト11（先発） | 人物単位の二部マッチング（同じ選手は 1 枚・強い方） | `best-xi/optimize.ts` |
| AI ベスト11（控え） | 先発・控えをまたいで人物単位で 1 枚 | `best-xi/bench.ts` |
| 改善シミュレーション（控えとの入れ替え） | 別の先発と同じ選手になる入れ替えは拒否・候補にも出さない | `improvement-simulation.ts` |
| 保存データの読み込み・JSON の取り込み・共有 URL の復元・テンプレート・コピー・古い形式の移行 | **変えない**。エディタに「同じ選手が 2 枚以上います: 名前」と知らせる（`squad-same-player-warning`） | `SquadEditor.tsx` |
| 診断 | 既存のカードを評価するだけ（追加しない） | — |

- 同じカード（同じ ID）の重複は従来どおり `duplicate_not_allowed`（文言を「同じカードは…」に変更）。
- 以前の「同じ名前の選手が含まれています」の知らせ（NEW-25・`best-xi/same-name.ts`）は、規則そのものの実装に置き換えたため削除。

## 確認

- `src/lib/world/person-identity.test.ts`（4）・`src/lib/squad/same-player-rule.test.ts`（5）・`improvement-simulation.test.ts`（フィクスチャのカード ID を別々に変更）。
- `scripts/black-box-best-xi-optimization.mjs` の「[同じ選手]」: 実データで先発の 1 人と同じ人物キーの別のカードを My Team に足し、
  選出・控え（`data-world-card-id`）に 2 枚のうち 1 枚だけ・人物キーの重複なし。
- `scripts/black-box-same-player.mjs`（5/5・2026-10-10）: 同じ選手の 2 枚（先発と控え）を含む既存の保存データを開くと「同じ選手が 2 枚以上います: ロベルト カルロス（2）」と知らせ、
  保存データは変えない。同じ選手がいないスカッドでは知らせない。
