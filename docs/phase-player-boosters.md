# フェーズ: 選手ブースター 調査と選択式計算の実装

作成日: 2026-08-28

監督選択UIの全面改善と同時に実施したマイルストーン。
「選手ブースターの効果を調べ、育成 / 比較 / スカッドで共通の選択式ブースター計算を実装する」。

> **後続フェーズで更新**: 本ドキュメントの「カードの数値IDから効果を自動解決できない」という結論は
> `docs/phase-player-booster-resolution.md` で覆った。eFootball 公式サイト
> （efootball-world.com/player/{id}）の個別選手ページが付属ブースターを「名称 +レベル」で
> 表示していたため、World `boost1`/`boost2` の 34+6 ID を名称・レベルまで解決し、
> 効果まで確認済みのもの（ball-carrying / offence-creator）はカードへ自動適用するようにした。

---

## 1. 調査の前提と方針

- カードには数値のブースターIDが 2 つまで付く。
  - eFootball World: `boost1` / `boost2`
  - eFHUB: `boostId1` / `boostId2`（DB 列は `player_cards.boost_id_1 / boost_id_2`）
- **World の数値ID と eFHUB の数値ID は同一視しない**（別体系として扱う）。
- 効果は **ID 番号だけからは推測しない**。
- 「明示的な再利用条件が無いもの」は「再利用可否は未確認」として扱う。

## 2. 既存ワークスペース内データの棚卸し（外部アクセス前）

| 出所 | 内容 | 判定 |
|---|---|---|
| `player_card_boosters`（SQLite, 38 行） | eFHUB 由来の付属ブースターID | ID のみ。名称→効果表なし |
| `progression/known-booster-effects`（旧 `KNOWN_BOOSTER_EFFECTS`） | Ball-carrying / Fantasista などの手動確認分 | 数点のみ confirmed |
| `data/` 配下の screenshot（育成画面キャプチャ） | 「ボールキャリー +5」「攻撃の起点 +4」等の実測 | confirmed の裏取りに使用 |
| EFScout の公開データ（`referenceData.allBoosters` = 408 件, `statMetadata` = 30 件） | ブースター名 → 影響ステータスの一覧（ゲーム機構の事実データ） | provisional の土台として採用 |

EFScout の `robots.txt` は ClaudeBot を明示的に許可しており、`/data/boot.json` は Disallow 対象外。
ここから取得したのは「ゲーム内のブースター名と影響ステータスの対応」という事実であり、
自前のステータスキー体系（World 26 キー）へ変換して `booster-catalog.ts` に取り込んだ。

## 3. World `boost1` ≠ EFScout `id` の確定

GK カード群の `boost1` 値を EFScout の Goalkeeping 系ブースター `id` と突き合わせたところ、一致しなかった。
→ **カードの数値IDから効果を自動解決することはできない**。
→ 付属ブースターは「効果未確認」と表示し、能力値へは一切加算しない。
→ 効果を試算したいユーザーは、**名前とレベルを手動で指定**する（選択式）。

外部リクエスト数: 30 回上限に対して十分下回る範囲で終了。
`eFHUB`（robots で ClaudeBot 拒否）、`eFootBase`（ClaudeBot 拒否 + 429）へはアクセスしていない。

## 4. 分類ルール

| 区分 | 意味 | 能力値への適用 |
|---|---|---|
| confirmed | 複数ソース（screenshot 実測 + 既存手動確認 + EFScout）で一致 | 常に適用 |
| provisional | EFScout の定義表のみ（実測の裏取りなし） | 既定では非適用。「検証モード」ON のときだけ加算 |
| unresolved | カード付属の数値ID。対応表なし | 適用しない（表示のみ） |
| unsupported | ゲームに存在しない / 判別不能 | カタログに載せない |

confirmed（3 件）: Ball-carrying / Fantasista / Offence Creator
provisional: 41 件（standard 系の残り・extended・single・special）

## 5. 実装

### カタログ（エンジンの真実）
- `src/lib/progression/booster-catalog.ts`
  - `BoosterDef { key, nameEn, nameJa, category, affectedStats(World 26キー), maxLevel, conditional, confirmationStatus, evidence }`
  - 44 件（standard 11 / extended 18 / single 6 / special 9）
  - `getBoosterDef(key)` / `boosterDeltas(def, level)`（各 affectedStat に +level、1..maxLevel でクランプ）
  - `BOOSTER_CATALOG_VERSION = "booster-catalog/2026-08-28.efscout-1"`

### 計算
- `src/lib/progression/calculate-player-booster.ts`
  - `calculatePlayerBooster(card, selected[], applyProvisional)`
  - 付属（boost1/boost2 ≠ 0）→ `confirmationStatus: "unresolved"`, `delta: null`,
    理由文「この数値IDは公開ブースター定義表（EFScout）の番号体系と一致せず、対応表を確認できていません。効果は適用していません。」
  - 選択式 → スロットごとに 1 つ。confirmed は常に、provisional は `applyProvisional` のときだけ `deltas` に反映。
- `StatBreakdown` のレイヤーは不変:
  `baseValue / progressionDelta / playerBoosterDelta / managerBoosterDelta / otherDelta / finalValue`
  → 手動ブースターは **playerBoosterDelta のみ** に載る（育成・監督と混ざらない）。

### SQLite（非破壊）
- `player_booster_definitions`（44 行）: カタログのスナップショット。
  `world_source_booster_id` / `efhub_source_booster_id` 列は用意のみ（現時点で対応表なし → NULL）。
- `player_booster_sync_runs`: 同期履歴。
- 投入: `node scripts/sync-booster-definitions.mjs`（UPSERT。既存の行数ガードあり）。

### UI
- 育成: `src/components/world/progression/PlayerBoosterPanel.tsx`
  - 上: 付属ブースター（スロット / ID / 「効果未確認」 / 理由文）
  - 下: スロット 1・2 の手動指定（optgroup「確認済み」「検証中」）+ レベル + 「検証モード」トグル
  - 適用結果リスト（適用 / 非適用 バッジ、影響ステータス）
- 育成の能力値比較（`StatComparison.tsx`）: 「選手B」列 = playerBoosterDelta。
  脚注に「未確認の値は加算せず、架空の上昇量は生成しません。」
- 比較: `PlayerControlColumn.tsx` に「選手ブースター（試算）」セレクト（各選手・確認済みのみ）。
- スカッド: `SlotPlayerPanel.tsx` にスロット選択後のブースターセレクト（確認済みのみ）。

### 保存形式（後方互換）
- スカッド: `StoredSlot.boosters?: SelectedPlayerBooster[]`（`squad-storage.ts` の `boostersSchema` で
  `slot 1|2 / boosterKey /^[a-z0-9-]{1,48}$/ / level 1-6`、最大 2、`catch(undefined)`）。
  欄が無い旧データはそのまま読める。カード無しスロットのブースターは保存時に破棄。
- 比較: `ComparisonPlayerInput.selectedPlayerBoosters?` / `applyProvisionalBoosters?`（URL/セッションは従来通り、無指定で既定）。

## 6. 自動適用しないものの一覧（重要）

- カード付属の `boost1` / `boost2`（World）— 対応表なし
- カード付属の `boostId1` / `boostId2`（eFHUB）— 対応表なし
- provisional ブースター（検証モード OFF のとき）
- special ブースターの `conditional` 効果（発動条件の中身は未確認）

これらはいずれも `playerBoosterDelta = 0` のまま。

## 7. テスト

- 単体: `src/lib/progression/booster.test.ts`（12）、
  `src/lib/comparison/build-comparison.test.ts` にブースター統合 3 件追加、
  `src/lib/squad/squad-storage.test.ts` に保存/復元・不正値破棄・後方互換 3 件追加、
  `src/lib/managers/schemas.test.ts` に 6 適性ソートキー 1 件追加。
- ブラックボックス: `scripts/black-box-boosters.mjs`（23）、
  `scripts/black-box-manager-picker.mjs`（35）。
- 既存スイート（progression / managers / compare / squads / ui / world-ui / world-sync / phase-c / phase-b5）に回帰なし。

## 8. 今後

- World / eFHUB のブースターID → 効果 の対応表が公開情報から得られれば
  `player_booster_definitions.*_source_booster_id` を埋め、付属ブースターの自動表示に進める。
- provisional → confirmed 昇格は screenshot 実測の追加が条件。
- 監督補正・選手ブースターの**適用順序（育成前 / 育成後）は未確認**のまま（UI で明記）。
