# マイルストーン完了報告: B2ブースター標準計算統合

- 実施日: 2026-09-05
- 対象: 育成計算エンジン（`calculate-player-booster.ts` / `calculate-final-stats.ts` / `types.ts` / `engine.ts`）＋
  `PlayerBoosterPanel`（選手詳細・育成タブ）＋ `PlayerControlColumn`（比較画面）＋ `StatComparison` / `CompactStatGrid`（内訳表示）
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **完了**（§10 参照。全項目 PASS・未解決の技術的問題 0。ただし比較画面のB2欄コピー修正など
  §9 の付随注記は「人間の目視確認項目」および下記の運用上の申し送りとして明記）

---

## 0. 前提（前セッションからの引き継ぎ）

前々セッションは OneDrive 側フォルダーを基準に起動されていたが、実際の Read/Edit は正本ワークスペース内の
4ファイル（`calculate-player-booster.ts` / `calculate-final-stats.ts` / `types.ts` / `engine.ts`）に対して
行われていた（作業ディレクトリ矛盾）。直前の読み取り専用引き継ぎ監査でこの矛盾が解消済みであることを確認し、
`docs/milestones/in-progress/b2-standard-integration.md` に中断状態を記録した上で本マイルストーンを再開した。

---

## 1. 適用順（計算の意味論・最重要）

```
common          = base + progression + managerBoosterDelta + otherDelta
strictUncapped  = common + gameMeasuredBoosterDelta（B1: screenshot_verified/game_client_verified）
standardUncapped= strictUncapped + externalVerifiedBoosterDelta（B1: external_cross_verified）
                                  + confirmedB2BoosterDelta（B2のうち isConfirmedB2Candidate のみ・★本マイルストーンで追加）
conditionalUncapped   = standardUncapped + conditionalBoosterDelta（Power of Many のユーザー手動指定段階）
experimentalUncapped  = standardUncapped + experimentalPlayerBoosterDelta
                       （検証中の付属B1 + Power of Manyの手動指定 + 未確認B2のみ。confirmedB2 は含まない＝二重加算しない）
```

適用順（レイヤーの重ね順）は「B1（付属・証拠レベル別）→ 確認済みB2（手動選択・本マイルストーンで標準へ昇格）→
Power of Many（条件手動指定・条件反映後値のみ）」であり、監督補正 (`managerBoosterDelta`) は最初の `common` の時点で
独立レイヤーとして加算されるため、B1/B2/PoMのどのレイヤーとも重複しない。

- **standardFinalValue の新しい意味**: 「基礎 + 育成 + カード付属ブースター（実測2種＋外部照合27種）+
  **確認済みB2（ユーザーが手動選択した確認済みブースター）** + 監督補正」。旧定義（確認済みB2を含まない）から
  意味が変わる。development-safety-policy.md §5・§14 は通常 `calculateBuild` の結果変更を重大停止条件とするが、
  今回はユーザーが本プロンプトで明示的にこの一点（確認済みB2の標準反映）を承認しており、優先順位（同文書§0）に
  従い許可されたスコープとして扱った。B1・Power of Many・監督補正・B2対象能力/上昇値・上限・丸め・育成コストは
  一切変更していない（§4 のテストで回帰確認済み）。
- **conditionalFinalValue の意味**: 維持。`standardUncapped + conditionalBoosterDelta` という式は不変で、
  `standardUncapped` 自体が新しい意味（確認済みB2込み）になった分だけ、その上に正しく積み上がる
  （テストで確認: PoM段階と確認済みB2が同一能力に重なっても各バケットは独立）。
- **experimentalFinalValue の意味**: 数値としては維持される。`unconfirmedManualTrialDeltas`
  （＝ `manualTrialDeltas` から `confirmedB2Deltas` を除いた部分集合）のみが `experimentalExtraDeltas` に
  入るよう変更したため、`experimentalUncapped = standardUncapped(新) + experimentalExtra(新)` は
  `standardUncapped(旧) + experimentalExtra(旧、全B2込み)` と代数的に同じ値になる（confirmedB2 が
  standard側とexperimental側の間で移動しただけで、合計には現れない）。単体テストで実際に一致することを確認。
- **confirmedB2BoosterDelta を型へ追加する必要性**: `StatBreakdown.playerBoosterDelta` は「現在の適用モードで
  採用された合計」であり、標準値のうちB1由来分とB2由来分を UI 側で個別に説明できない。既存の
  `manualTrialBoosterDelta`（全件・後方互換）と `confirmedB2BoosterDelta`（確認済みのみ・部分集合）を分けることで、
  UI・比較・チーム集計のどの値がどの根拠から来ているかを追跡可能にした。単一の真実源は
  `isConfirmedB2Candidate()`（`booster-catalog.ts`）。
- **playerBoosterDelta との重複・曖昧さ**: なし。`playerBoosterDelta = mode==="strict" ? gameMeasured :
  gameMeasured + externalVerified + confirmedB2`。`common + playerBoosterDelta === uncappedValue`
  という恒等式が標準/厳密の両モードで成立することをテストで確認済み（内訳の合計と最終値が矛盾しない）。

---

## 2. 設計レビュー結果（実装前に確認・すべて安全と判断）

| 確認項目 | 結果 |
|---|---|
| confirmedB2Deltas の生成条件が isConfirmedB2Candidate と一致 | 一致（`calculate-player-booster.ts` が同じ関数を直接呼び出し） |
| 未確認B2が confirmedB2Deltas へ入らない | 不参入（`unconfirmedManualTrialDeltas` へ分離） |
| total-package が正式B2として入らない | 不参入（`isConfirmedB2Candidate` が `conditional:true` を除外） |
| experimentalExtraDeltas に未確認分だけが入る | 確認済み |
| manualTrialDeltas の後方互換性 | 維持（全件を引き続き保持） |
| confirmedB2Deltas が最終値へ1回だけ加算 | 確認済み（standard側のみ・experimental側は控除済み） |
| B1 の二重加算なし | 確認済み（B1とB2は別バケット・スロット単位で排他） |
| B2 の standard/experimental 二重加算なし | 確認済み（代数的に検証・テストで実値確認） |
| Power of Many の二重加算なし | 確認済み（`conditionalUserDeltas` は完全に別バケット） |
| 監督補正の二重加算なし | 確認済み（`common` 段階で独立加算） |
| 非対象能力が変化しない | 確認済み（`boosterDeltas()` は対象4能力のみ・未変更） |
| strict/standard/conditional/experimental の既存意味 | strict・conditional式は不変。standard/experimentalは§1のとおり意図的に意味変更（standardのみ）／数値は維持（experimental） |
| playerBoosterDelta の意味の整合性 | 整合（§1参照） |
| 新しい型フィールドの必要最小限性 | 4フィールド追加のみ（`confirmedB2BoosterDelta` / `playerBoosterByStat.confirmedB2` / `booster.confirmedB2Total` / `booster.hasConfirmedB2`）。すべて既存の兄弟フィールドと対称 |
| 保存スキーマへの影響 | なし（`SavedBuild`/`MyTeamRecord`/`StoredSquad` は無編集。追加フィールドはすべて計算結果型 `ProgressionResult`/`StatBreakdown` 側のみ） |
| calculatedStats の保存形式 | 不変（`Record<string, number>` のまま。今後の新規保存では確認済みB2込みの値が入るのは意図した挙動） |
| JSON エクスポート・インポート形式 | 不変（`build-export.ts`/`build-import.ts` は無編集。`selectedPlayerBooster`のスキーマ変更なし） |
| URL 形式 | 不変（`allocation-url.ts`/比較URL は無編集） |
| My Team・スカッドの参照形式 | 不変（`build-storage.ts`/`squad-storage.ts`/`my-team-storage.ts` は無編集） |

---

## 3. 初回 typecheck と関連テスト結果（既存期待値を先に書き換えない方針で実施）

### typecheck（初回）
1件エラー: `src/lib/comparison/ability-radar.test.ts` のフィクスチャ関数 `stat()` に新規必須フィールド
`confirmedB2BoosterDelta` が無いことによる型エラー。**分類: 型配線不足**（計算バグではない）。
`confirmedB2BoosterDelta: 0` を追加して解消（テスト期待値の変更ではなくフィクスチャの補完）。

### 関連 Unit Test（初回・実際の失敗を確認してから分類）
| ファイル | 失敗数 | 分類 |
|---|---|---|
| `booster.test.ts` | 2 | **意図したB2正式化による期待値差**（`ball-carrying` は `isConfirmedB2Candidate===true` のため、"手動試算は常に experimentalExtra" という旧仕様の前提が本マイルストーンの目的により変わった） |
| `engine.test.ts` | 1 | **型配線不足**（`playerBoosterByStat.speed` の `toEqual` 期待値オブジェクトに新フィールド `confirmedB2` が無い。値は`0`で計算バグではない） |
| `build-comparison.test.ts` | 1 | **意図したB2正式化による期待値差**（同上・比較エンジンでも同じ `ball-carrying` 例を使用） |
| `build-squad.test.ts` | 1 | **意図したB2正式化による期待値差**（同上・スカッドチームサマリーでも同じ例） |

二重加算・非対象能力の変化・B1回帰・Power of Many回帰・監督補正回帰・保存互換性回帰・実装設計の誤りに
分類される失敗は**0件**。

### 更新した既存テスト期待値と根拠
- `booster.test.ts`: 「手動試算は常に experimentalExtra」を、確認済み例（`ball-carrying`）向けと
  未確認例（`single-speed`）向けの2テストへ分割。確認済み側は `confirmedB2Deltas` へ入り
  `experimentalExtraDeltas` には入らないことを新たに検証。未確認側は旧テストと同じ検証内容を維持。
- `booster.test.ts`: 「手動試算は finalValue 不変・experimentalFinalValue にのみ乗る」も同様に
  確認済み/未確認の2テストへ分割。
- `build-comparison.test.ts` / `build-squad.test.ts`: 同じ理由で、確認済み例は「通常値へ反映される」、
  未確認例は「通常値へ影響しない」の2テストへ分割。
- `engine.test.ts` / `ability-radar.test.ts`: 型配線不足のみ（フィクスチャへ `confirmedB2: 0` /
  `confirmedB2BoosterDelta: 0` を追加）。計算期待値の変更はなし。

いずれも根拠なく「テストを通すため」に数値を変更した箇所はない。

---

## 4. 追加した必須の計算テスト（`booster.test.ts` 末尾・新規 describe ブロック、23件）

`describe("B2標準統合: confirmedB2Deltas / standardFinalValue（本マイルストーン）")` として以下を網羅:

- **B2なし（4件）**: confirmedB2BoosterDelta 全能力0・非対象能力不変／B1不変／Power of Many不変／監督補正不変
- **確認済みB2（10件）**: 対象能力のみ上昇・非対象能力不変／1回だけ加算／conditionalFinalValueへの正しい積み上げ／
  B1併用（別スロット）／Power of Many併用（別スロット・バケット分離）／監督補正併用／能力値上限（99クランプ）／
  丸め規則（`Math.trunc`・`maxLevel`クランプ）／B2解除で基準値へ戻る／B2変更で前の効果が残らない（純関数）／
  複数スロット選択時の内訳と合計の一致
- **未確認B2（2件）**: confirmedB2Deltasへ不参入・標準値へ不昇格・experimental経路維持／
  selection.appliedに残る（削除・自動変換しない）
- **total-package（3件）**: isConfirmedB2Candidate=false／過去のB2保存値を破棄せず試算経路のまま維持／
  conditionalBoosterSelections（正規のPoM経路）との区分維持
- **型とサマリー（3件）**: 0件／1件／複数対象能力・二重集計なし（`stats`合計と`booster.confirmedB2Total`が一致）

合計 `booster.test.ts` は 54 → 79 件（+25、既存2件の分割+2 含む）。

---

## 5. B2なし・確認済みB2の前後比較（実測）

CANNAVARO_EPIC（boost1=0, boost2=0）を用いた実測（`speed` 系対象・`ball-carrying` +3 選択時）:

| 項目 | B2なし | 確認済みB2（ball-carrying +3） |
|---|---|---|
| `confirmedB2BoosterDelta`（speed等4能力） | 0 | 3 |
| `playerBoosterDelta`（standardモード） | 0 | 3 |
| `standardFinalValue` | baseValue | baseValue + 3 |
| `finalValue`（現在モード=standard） | baseValue | baseValue + 3（standardFinalValueと一致） |
| `experimentalFinalValue` | baseValue | baseValue + 3（standardFinalValueと同値・二重加算なし） |
| 非対象能力（例: finishing） | 不変 | 不変（confirmedB2BoosterDelta=0のまま） |

未確認B2（`single-speed` +3、対象: speed）:

| 項目 | 値 |
|---|---|
| `confirmedB2BoosterDelta` | 0 |
| `playerBoosterDelta` | 0（標準値は不変） |
| `standardFinalValue` | baseValue（不変） |
| `experimentalPlayerBoosterDelta` | 3 |
| `experimentalFinalValue` | baseValue + 3（試算のみ） |

---

## 6. UI 変更（`PlayerBoosterPanel.tsx`）

計算テストがすべて安全と判断できたため、UI を正式なB2表示へ整理した。

### 通常表示
- **B1**: 「カード付属ブースター（カードに収録・自動）」見出し・内容は無変更。
- **B2**: 見出しを「実験的なブースター試算（手動）」→ **「追加ブースター（B2・手動選択）」** へ変更
  （明示的な仕様変更。理由: B2の一部が試算専用ではなく通常反映になったため）。
  - スロットごとの `<select>` は **実験モードのトグルなしで常時 SSR に表示**（旧: 実験モード ON のときのみ）。
  - 通常候補（`<optgroup label="確認済み（通常反映）">`）は `isConfirmedB2Candidate` を満たす定義のみ
    （44件中43件から Power of Many を除いた集合のうち、確認済み29件）。
  - 「なし」で解除可能。選択すると即座に対象能力・通常の最終値へ反映（計算はサーバー/クライアント共通の
    `calculatePlayerBooster`/`calculateBuild` を再利用しているため、選択即時反映は既存の状態管理をそのまま利用）。
  - 現在選択中の確認済みB2には `現在適用中` バッジを表示。
  - 下部の適用済みリストは、確認済みは `確認済み・反映中`（緑）、未確認は `試算のみ（未確認）`（黄）バッジで区別。
  - 「追加ブースター（B2）をすべて解除」ボタン（旧「試算ブースターをリセット」から改称・機能は同じ）。
- **未確認・過去の保存値**: 通常候補一覧には混ぜず、現在選択中の場合だけ `<select>` に
  「◯◯（未確認・試算のみ・過去の選択）」または「◯◯（Power of Many・B2 選択肢からは提供終了）」という
  専用オプションとして復元表示。自動削除・自動「なし」変換はしない。専用の警告文
  （「未確認のため通常の最終値には反映されません…」）を表示し、ユーザーが明示的に「なし」または
  確認済み候補へ変更できる。
- **Power of Many**: `ConditionalBoosterControl` は無変更。B2の `<select>` とは完全に別UI・別状態
  （`conditionalBoosterSelections`）のまま。未指定を最大扱いしない挙動も無変更。
- **実験モードトグル（`ExperimentalModeToggle`）**: コンポーネント自体は無変更。ページ全体の
  「試算最終」列表示など、B2以外の既存用途のために維持（B2の表示条件からは切り離した）。

### 付随した表示の整合修正（計算変更の直接的な帰結）
- `StatComparison.tsx`: 「標準最終」の説明文に「確認済みB2」を追記。「選手B」列の内訳ポップに
  `確認済みB2+N` を追加表示できるよう拡張（`gameMeasured`/`externalVerified`/`confirmedB2` のうち
  2項目以上が非0のときに内訳を表示、に一般化）。「試算最終」の説明文を
  「未確認の手動試算（B2）」に修正（確認済みB2は二重加算しない旨を明記）。
- `CompactStatGrid.tsx`: モバイル向け内訳に「うち確認済みB2（手動選択）」行を追加（非0のときのみ）。
- `PlayerControlColumn.tsx`（比較画面）: この画面のB2選択欄は元々 `confirmationStatus==="confirmed"` の
  ブースターのみを候補にしていたため、計算エンジン変更により**この画面の全選択肢が標準値・比較順位へ
  反映されるようになった**。旧文言「手動試算は…通常の最終値・比較の順位には含めません」は事実と矛盾するため、
  「追加ブースター（B2）…確認済みのB2（この一覧はすべて確認済み）は通常の最終値・比較の順位へも反映します」
  へ修正（ラベル・aria-label改称含む・計算ロジックは無変更）。

---

## 7. 保存・比較・URL 互換性の確認

| 項目 | 結果 |
|---|---|
| `selectedPlayerBooster` の保存形式 | 不変（`number \| null`・型定義未編集） |
| `conditionalBoosterSelections` | 不変 |
| `SavedBuild` / `MyTeamRecord` / `StoredSquad` スキーマ | 不変（該当ファイル無編集） |
| `buildId` / `worldCardId` / `rulesVersion` / `progressionAllocation` | 不変 |
| B2 保存・復元・解除・復元 | `build-storage.test.ts`（30件）・`my-builds.test.ts`（142件）が無編集のまま全PASS |
| 未確認B2・total-package 保存値の後方互換 | §4「未確認B2」「total-package」テストで明示的に確認（削除・自動変換しない） |
| JSON エクスポート/インポート往復・`formatVersion` | `build-export.test.ts`（34件）・`build-import.test.ts`（40件）無編集のまま全PASS |
| URL `b`/`m`/`tp`/`al` | `allocation-url.test.ts`（11件）無編集のまま全PASS。ブラックボックスでも `tp=` `al=` `m=` `b=` の疎通を確認 |
| 比較左右でB2を独立管理 | `PlayerControlColumn` は選手ごとに独立した state（既存構造・無変更） |
| My Team `selectedBuildId`/`favoriteBuildId`・スカッド`savedBuildId`・カードお気に入り | 該当ファイル無編集・関連テスト全PASS |
| SQLite | 書き込み0・`integrity_check`=ok・全件数一致（§10） |

---

## 8. サーバー状態（今回の操作）

| 局面 | PID / コマンド |
|---|---|
| 開始時 | `./data/server.pid`=31480（**stale**・プロセス不存在）。ポート3000空き。dev停止中。 |
| build前 | `./data/server.pid` を `0` へ更新 |
| build | `npm run build` PASS |
| start | `npm run start -- -p 3000`。リスナー **20672**（npmラッパー **37404** の子）。Ready確認・主要ページ/API全200 |
| 全13ブラックボックス・SQLite | `next start`（20672）上で実行・全PASS |
| start停止 | `Stop-Process -Id 20672 -Force` → `Stop-Process -Id 37404 -Force`。ポート3000 LISTEN 無し確認 |
| dev再起動 | `npm run dev`。**next dev 親 PID 28092**（npmラッパー33260の子）／**リスナー 1108**（start-server.js・28092の子） |
| server.pid | `28092` を記録（ASCII・改行なし・再読込で一致確認） |
| dev再確認 | `/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/players/world/89138556575063` `/api/managers` すべて200 |
| `./data/dev-err.log` | 0バイト（クリーン） |

同一PCの他プロジェクトのNodeプロセスには一切触れていない。停止は上記の確認済み単一数値PIDのみに対して実施。

---

## 9. テスト・ブラックボックス・SQLite 最終結果

### `npm run verify`
| 検査 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx`、stale 0、未許可 0） |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`） |
| `npm run test`（vitest run） | **1081 / 1081 PASS**（52 テストファイル。直前ベースライン1054から+27） |

### `npm run build`
PASS（全26ルート。`/players/world/[worldCardId]` 23.1kB→23.7kB・`/compare` 22.3kB程度・`/build-inventory` 16.9kB＝前回同等）。

### 全13ブラックボックス（`next start` 上・合計 **706 / 706 PASS**）
| レール | 件数 | 前回比 |
|---|---|---|
| boosters | 54 | +1（見出し・実験モード非依存チェックの意図的更新に伴う純増） |
| progression | 99 | 0（同種チェックを1:1で置換） |
| compare | 74 | 0 |
| my-builds | 98 | 0 |
| squads | 46 | 0 |
| world-ui | 82 | 0 |
| favorites | 33 | 0 |
| ui | 69 | 0 |
| managers | 41 | 0 |
| manager-picker | 35 | 0 |
| phase-b5 | 23 | 0 |
| phase-c | 17 | 0 |
| world-sync | 35 | 0 |
| **合計** | **706** | **+1** |

`black-box-boosters.mjs` / `black-box-progression.mjs` の更新点（意図的・理由付き）:
- 「カード付属と実験的なブースター試算をUIで分離（見出し）」→ 新見出し「追加ブースター（B2・手動選択）」を
  検証するよう更新（B2の名称変更という明示的な仕様変更のため）。
- 「実験モードは初期OFF（試算セレクトがSSRに出ない）」を、
  「確認済みB2の追加ブースター欄は実験モード不要でSSRに出る」（新しい新aria-labelの存在を確認）＋
  「旧『試算ブースターを指定』の文言は使わない」（新設計では当該文言自体が存在しないため）の2チェックへ分離。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべてベースラインと一致。**書き込み0**。

### Critical / Warning
Critical **0** / Warning **0**（lint警告0）。

---

## 10. 完了判定（`quality-gates.md` §7 準拠）

| 基準 | 結果 |
|---|---|
| 必須機能完成 | ✅ 計算統合・UI整理とも完了 |
| `npm run audit:ja-labels` | ✅ PASS |
| `npm run verify` | ✅ PASS |
| `npm run build` | ✅ PASS |
| 全13ブラックボックス | ✅ 706/706 PASS |
| SQLite `integrity_check` | ✅ ok |
| Critical 0 / Warning 0 | ✅ |
| 主要ページ・API 200 | ✅ |
| 保存互換性維持 | ✅ スキーマ変更0 |
| 実ユーザーデータ変更 | ✅ 0 |
| devサーバー復旧・server.pid正確・dev-err.logクリーン | ✅ |
| 未解決問題0 | ✅（§11参照。技術的な保留事項はなし。将来検討事項のみ） |

**総合判定: 完了**

---

## 11. 未解決問題

技術的な保留事項は0件。ただし将来の検討事項として:

1. `PlayerControlColumn`（比較画面）のB2選択欄はもともと確認済みブースターのみを候補にしていたため、
   本マイルストーンの計算変更で自動的に「その画面のB2選択はすべて標準値・比較順位へ反映される」という
   挙動になった。文言は本マイルストーンで整合させたが、この画面のUI構造自体（`PlayerBoosterPanel` とは
   別実装であること）は今回のスコープ外のため手を加えていない。将来、両画面のB2 UIを共通化するかどうかは
   別マイルストーンで判断する。
2. `docs/phase-booster-activation-types.md` 等、既存文書内の「B2は常に試算専用」という記述は、
   本マイルストーンの結果により一部古くなっている可能性がある（次回の文書整理で確認・更新を推奨）。

---

## 12. 人間の目視確認項目（推奨）

- 実ブラウザーで選手詳細の育成タブを開き、「B2」バッジ付き「追加ブースター（B2・手動選択）」で
  実験モードを有効化せずに確認済みB2（例: Ball-carrying）を選択し、対象能力（ドリブル/ボールキープ/
  スピード/ボディバランス）が即座に上昇し、「標準最終」列にも反映されることを確認する。
- 「現在適用中」バッジ、下部の「確認済み・反映中」バッジ（緑）が正しく表示されることを確認する。
- 過去に未確認ブースター（例: `single-speed`）や `total-package` を選択していたセッション状態がある場合、
  それが自動的に消えたり「なし」になったりせず、警告付きで「過去の選択」として復元表示されることを確認する
  （新しいセッションでは選択肢に出ないため、ブラウザの開発者ツールで一時的に `selectedPlayerBoosters` を
  差し込むなどの手動確認が必要）。
- 比較画面（`/compare`）でB2を選択し、順位・26能力値テーブルへ反映されることと、新しい注記文言が
  意味的に正しいことを確認する。
- 375〜1920px の各幅で育成タブ・比較画面のB2欄が横スクロールなく操作できることを確認する。

---

## 13. 作成・編集・削除ファイル

### 新規作成
- `docs/milestones/in-progress/b2-standard-integration.md`（中断記録・本マイルストーン完了により追記して保持）
- `docs/milestones/2026-09-05-b2-standard-integration.md`（本報告）

### 編集
| ファイル | 変更概要 |
|---|---|
| `src/lib/progression/calculate-player-booster.ts` | 前セッション由来（未検証だった）。設計レビュー・テストで安全性を確認 |
| `src/lib/progression/calculate-final-stats.ts` | 同上 |
| `src/lib/progression/types.ts` | 同上 |
| `src/lib/progression/engine.ts` | 同上 |
| `src/lib/comparison/ability-radar.test.ts` | フィクスチャに `confirmedB2BoosterDelta: 0` を追加（型配線） |
| `src/lib/progression/engine.test.ts` | `playerBoosterByStat` 期待値に `confirmedB2: 0` を追加（型配線） |
| `src/lib/progression/booster.test.ts` | 既存2テストを確認済み/未確認の分割へ更新＋新規23件のB2標準統合テスト |
| `src/lib/comparison/build-comparison.test.ts` | 既存1テストを確認済み/未確認の分割へ更新 |
| `src/lib/squad/build-squad.test.ts` | 既存1テストを確認済み/未確認の分割へ更新 |
| `src/components/world/progression/PlayerBoosterPanel.tsx` | B2 UI を正式なB2表示へ整理（§6） |
| `src/components/world/progression/StatComparison.tsx` | 内訳・説明文に確認済みB2を反映（§6） |
| `src/components/world/progression/CompactStatGrid.tsx` | モバイル内訳に確認済みB2行を追加（§6） |
| `src/components/compare/PlayerControlColumn.tsx` | B2欄のラベル・注記を新挙動に整合（§6） |
| `scripts/black-box-boosters.mjs` | 見出し・実験モード非依存チェックを更新（§9） |
| `scripts/black-box-progression.mjs` | 同上 |
| `docs/progress.md` | 本マイルストーンの記録を追加 |
| `docs/project-baseline.md` | unit数・ブラックボックス数・サーバーPID・実装済み機能一覧を更新 |
| `docs/milestones/README.md` | 一覧に本報告を追加 |

### 削除
なし。
