# フェーズ: 選手ブースター効果の証拠レベル分類（v3 → v4 で訂正 → v5 で証拠レベル改名）

作成日: 2026-08-28（`phase-player-booster-resolution.md` の続き）

> **v5 改名（同日）**: `game_measured` という名称は「KONAMI のゲーム内で実測した」と誤解させる。
> ball-carrying / offence-creator の証拠は保存済みの eFHUB ビルドツール画面のスクリーンショットであり、
> KONAMI のゲームクライアント画面ではない。証拠レベルを次へ改名:
> - `game_client_verified` … KONAMI のゲームクライアント画面で直接確認した場合のみ。**現状 0 件**。
> - `screenshot_verified` … 保存済みの外部ビルド画面のスクリーンショットで対象能力・上昇量を確認（旧 `game_measured`）。ball-carrying / offence-creator の **2 種**。
> - `external_cross_verified` … **27 種**・分類は据え置き。
> - `effect_provisional` / `conditional_unverified` … 据え置き。
> - UI バッジ「ゲーム内実測済み」→「参考画面で実測確認」（補足: 保存済みスクリーンショットで対象能力と上昇量を確認。KONAMI のゲームクライアント画面での確認ではありません。）
> - 厳密モードの説明: 「保存済みスクリーンショットで変化量を直接確認したブースターだけを適用します。KONAMI 公式ゲーム画面での確認済みを意味しません。」
> - 29 種 / 1,931 カードの標準適用・3 モード・SQLite 対応表・v1〜v4 互換は維持。新規外部アクセス 0。
> - `rulesVersion`: `player-booster-resolution/2026-08-28.v5`、`booster-catalog/2026-08-28.evidence-levels-2`。
> - 読み込み互換: `GAME_MEASURED_KEYS`（= `SCREENSHOT_VERIFIED_KEYS`）エイリアス、内部フィールド名 `gameMeasured*` は据え置き。

> **v4 訂正（同日）**: v3 では「eFootball World（`efootball-world.com`）」を KONAMI 公式サイト扱いし、
> World の ScoreBar 差分 と EFScout の定義の一致だけを根拠に 29 種を「effect_confirmed（ゲーム内実測済み）」としていた。
> **eFootball World は独立したコミュニティ運営のファンサイトであり、KONAMI 公式ではない。** これを訂正する。
>
> - 証拠レベルを再分類: `game_measured`（ユーザー保存済みスクリーンショットで直接確認 = **2 種**）/
>   `external_cross_verified`（World の ScoreBar 差分 と EFScout の定義が一致 = **27 種**・KONAMI 公式実測ではない）/
>   `effect_provisional` / `conditional_unverified`。
> - 適用を **厳密 / 標準（既定）/ 実験** の 3 モードに整理。
>   - 厳密: game_measured のみ通常の最終値へ（**166 カード**）
>   - 標準: game_measured + external_cross_verified（**1,931 カード**・実用性は v3 と同等）
>   - 実験: 標準 + 検証中の付属 + 手動試算を「試算最終値」に別表示（警告への同意が必要）
> - コード・UI・ドキュメント・テストから「公式サイト / 公式実測 / 公式ページの計算結果」の表現を除去。
> - 対応表・実装・証拠台帳・v1〜v3 履歴は削除せず、確認状態・表示文言・適用モード・計算結果の証拠区分のみ修正。
> - `rulesVersion`: `player-booster-resolution/2026-08-28.v4`、`booster-catalog/2026-08-28.evidence-levels-1`。
>
> 以下 v3 時点の記述には「World 実測」等の表現が残るが、正しくは「World（外部DB）表示 と EFScout（外部DB）定義の外部2ソース整合」。

前フェーズ（v2）で、カード付属ブースターの **名称・レベル** は 98.2% 解決したが、
**効果（対象能力・上昇量）** は ball-carrying / offence-creator の 2 種だけが effect_confirmed で、
自動適用は 166 カード（7.2%）にとどまっていた。

本フェーズで **効果の実測方法** を確立し、29 種を effect_confirmed へ昇格。自動適用を **1,931 カード（83.4%）** へ引き上げた。

---

## 1. 効果の実測方法（決め手）

`efootball-world.com/player/{worldCardId}` の個別選手ページは:

- RSC ペイロードの `baseAbilities` = **ブースター OFF** の 26 能力値
- HTML の ScoreBar（`ScoreBar-module__…__scoreText`）= **ブースター ON** の 26 能力値（既定で ON 表示）

→ **ScoreBar − baseAbilities = そのカードの付属ブースターの効果（対象能力ごとの上昇量）**。
ゲーム公式サイトの計算結果なので、EFScout の定義とは独立した実測になる。

抽出: `node scripts/analyze-booster-effects.mjs --dir <保存HTML>`。

## 2. 昇格の基準（effect_confirmed）

以下をすべて満たすものだけを effect_confirmed（＝カード付属で自動適用）とした:

1. 名称・レベルを World 公式ページで確認（v2 で完了）
2. **別カード 2 枚以上**で ScoreBar 差分を観測
3. 観測した対象能力セットが全カードで一致
4. すべての対象能力で delta == level（「+level を各対象能力へ」の単純モデル）
5. 発動条件がない（非 conditional）
6. World 26 能力キーへ完全変換できる
7. 反例なし・ID 競合なし

## 3. 結果

### effect_confirmed へ昇格した 29 種

STANDARD 11 種（Shooting / Free-kick Taking / Aerial / Passing / Ball-carrying / Technique /
Defending / Duelling / Agility / Physicality / Goalkeeping）
＋ EXTENDED 18 種（Striker's Instinct / Shutdown / Hard Worker / Saving / Crossing / Fantasista /
Regista / Rebuilding / Accuracy / Offence Creator / Ball Protection / Balancer / Counter /
Aerial Block / Breakthrough / Strength / Off the Ball / Stealing）。

各種の効果（対象4能力・各 +level）は `booster-catalog.ts` に記録。ScoreBar 実測で確認済み。

**カタログ修正**: `goalkeeping` の対象能力を `gkCatching/gkParrying/gkReflexes/gkReach` →
`gkAwareness/gkCatching/gkParrying/gkReflexes` に修正（World 実測で gkReach ではなく gkAwareness だった）。

### effect_provisional のまま（自動適用しない）

- **Total Package**（341 カード・最多）: ScoreBar で「全26能力 +level」を実測。
  → **v6（`docs/phase-total-package.md`）で発動条件を KONAMI 公式で確認**:
  「The Power of Many」= Game Plan に登録した対象リーグの選手数で +1（1–13人）/ +2（14–19人）/ +3（20人以上）。
  World の ScoreBar は条件を無視して最大（+3）を表示していた（疑い→確認）。
  条件は判明したが per-card の対応リーグと Game Plan 構成を評価できないため **`conditional_unverified` 維持・全モードで自動適用しない**。
  実験モードでは最大効果（全26能力 +3）の候補として試算できる。
- **単一能力ブースター**（`category:single`）: カタログ定義は **6 種**
  （Aggression / Balance / Ball Control / Jump / Physical Contact / Speed・すべて `maxLevel 6`）。
  うちカード付属として観測できたのは **4 種**（Ball Control / Speed / Balance / Aggression = WORLD_BOOST2 ID 73/75/76/77）で、
  それぞれ 1 デュアルカードのみ（別カード 2 枚に届かず）。Jump / Physical Contact は EFScout 定義のみでカード付属 0。
  6 種すべて effect_provisional 維持。
- レジェンド系 8 種: カード付属として未観測 → effect_provisional。
- → `effect_provisional` は合計 **14 種**（単一能力 6 ＋ レジェンド系 8）。category `single` と証拠レベル `effect_provisional` は別軸。

### デュアルブースターの加算検証

デュアル 15 カードすべてで、`slot1 効果 + slot2 効果 = 観測差分` が一致（例: Accuracy+4 & Ball Protection+3 →
lowPass/loftedPass/finishing/kickingPower +4 かつ ballControl/tightPossession/balance/physicalContact +3）。
→ **デュアルは単純加算**。同一能力への重複時も加算（Regista+3 & Accuracy+3 の lowPass は +6）。

## 4. 大量検証（`node scripts/scan-booster-resolution.mjs`）

| 指標 | v2 | **v3** |
|---|---|---|
| ブースター付きカード | 2,314 | 2,314 |
| slot1 効果確認済み（自動適用対象） | 164 | **1,931** |
| slot1 conditional（Total Package） | 341 | 341 |
| slot1 未解決 | 42 | 42 |
| slot2 効果確認済み | 3 | 34 |
| slot2 provisional（単一能力） | 35 | 4 |
| 自動適用カード | 166（7.2%） | **1,931（83.4%）** |
| 名称のみカード（Total Package） | 2,106 | 341 |
| 完全未解決カード | 42（1.8%） | 42（1.8%） |
| ID 競合 | 0 | 0 |
| 能力値異常（自動適用の全対象能力 7,860 項目） | — | **99超過 0 / 負値 0 / 基礎値異常 0** |

## 5. 通常モードと検証モードの分離（実装）

`calculatePlayerBooster` は最初から 2 系統のデルタを返す:
- `confirmedDeltas` … カード付属の effect_confirmed のみ → 通常の `finalValue`（`StatBreakdown.playerBoosterDelta`）
- `experimentalDeltas` … 検証中の付属（conditional / provisional）+ **手動試算（常に）** → `experimentalFinalValue`

`calculateFinalStats` は各能力に `finalValue`（通常）と `experimentalFinalValue`（試算）を持たせる。
`experimentalModeEnabled` は **表示フラグのみ**でエンジンの数値には影響しない（両方常に計算）。

UI:
- `ExperimentalModeToggle`（新規）: 初期 OFF。有効化前に警告 Modal（フォーカストラップ・Esc・キーボード）。
  ON のとき常時バナー。解除ワンクリック。ページ再読込で OFF。
- `PlayerBoosterPanel`: 「カード付属ブースター（自動）」と「実験的なブースター試算（手動）」を見出しで分離。
  付属は解決段階（① 数値IDのみ / ③ 名称確認済み・効果検証中 / ⑤ 効果まで確認済み・自動適用）を表示。
- `StatComparison`: 通常は 基礎/育成/選手B/監督/**通常最終**。検証モード時のみ **試算B / 試算最終** 列を追加。
- 比較・スカッド: カード付属の effect_confirmed のみ比較の順位・チーム集計へ反映。手動試算は experimental で不反映。

## 6. rulesVersion

- `player-booster-resolution/2026-08-28.v3`（旧: v1, v2 を `BOOSTER_RESOLUTION_PREVIOUS_VERSIONS` に保持）
- `booster-catalog/2026-08-28.world-measured-1`（旧: `…efscout-1`）

保存ビルド／スカッド／比較状態は選手ブースターの ID を保持せず計算時に解決するため、移行不要・後方互換。
手動試算ブースターは従来どおり `StoredSlot.boosters?` / `ComparisonPlayerInput.selectedPlayerBoosters?` に保存され、
検証（試算）データとして扱われる。

## 7. 次に確認すべきブースター

- ~~**Total Package**（341 カード）: 発動条件の有無・内容を独立ソースで確認~~ → **v6 完了**（`docs/phase-total-package.md`）。
  条件は KONAMI 公式で判明したが評価不能のため `conditional_unverified` 維持。
- 単一能力ブースター（カード付属として観測できた 4 種 / カタログ定義は 6 種）: 別カード 2 枚目を取得して effect_confirmed へ（各 1 カードしか付属カードがない可能性あり）。
- 未解決 boost1 35 ID（42 カード・希少）/ boost2 13 ID（19 カード）。
- 適用順序（育成前 / 後）・最終能力値上限（暫定99）。
