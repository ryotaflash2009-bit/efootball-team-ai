# 選手比較（/compare）: 比較列内育成 ＋ カード識別表示

実施日: 2026-08-31 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除なし

## 目的

`/compare` の各比較列で、選手詳細の育成画面へ移動せずに **その場で育成配分を変更**し、26 能力値比較へ即時反映する。
併せて選択後の比較列にもカード画像・識別情報を表示する。比較専用の育成計算式は作らず、既存の
`calculateBuild` / `group-allocation` / `auto-allocate` / `ProgressionSlider` をそのまま再利用する。

**同じ配分なら選手詳細と比較画面で 26 能力値が完全に一致する**（`build-comparison.test.ts` で検証）。

## A. 比較列のカード識別表示（`ComparePlayerIdentityCard.tsx`）

`PlayerControlColumn` 上部の素朴なテキストを差し替え。検索結果カードと同じ画像解決・ブースターチップを再利用:

- `resolveCardImageSources` + `WorldCardImage`（外部取得なし・複製なし・優先順位そのまま・欠損時 `PlayerSilhouette`）。
- 日本語名 / 英語名 / カードタイプ(Badge) / 登録ポジション(Badge) / 最大OVR・基礎OVR / World ID。
- 付属ブースター（`boosterChipsForCard`）: 青=固定型 / 青「(推定)」=固定型推定 / 金=Power of Many 最大+N / 中立=未解決。色＋文字＋`title`。
- Power of Many ユーザー指定段階（`selectedConditionalBoosters`）を「Power of Many 指定: +N（条件反映後値のみ）」で表示。
- 「現在: {育成状態}」行（育成なし / 手動育成 / 保存ビルド: X / 攻撃重視 …）。
- 選手詳細（新規タブ）/ 育成画面（`#progression`・新規タブ）リンク。
- `columnCount >= 3`（3〜4人比較）で画像 `w-16`・詳細情報を省略しコンパクト化。2人比較は `w-24`。

## B. 比較列内育成（`CompareTrainingPanel.tsx`）

各列に折りたたみ（`<details>` 相当・初期は閉じる）「育成を調整」パネル。閉じた状態でも
engine 由来の「使用 X / 合計 Y pt」を表示。開くと:

- 配分方針ボタン（攻撃重視 / 守備重視 / バランス重視 / GK重視）= `autoAllocate(card, profile).allocation` を
  `savedAllocation` へ適用（「手動育成」扱い）。「ゲーム内の自動配分・OVR 最大化とは異なる」注記維持。
- リセット = `savedAllocation` を null・`buildMode` を none へ。
- 使用 / 残り / 合計ポイント（`summarizeGroupPoints`・`overAllocated` 表示）。
- フィールド 7 グループ = `ProgressionSlider`（**選手詳細と同一コンポーネント**）。段階コスト・残ポイント・
  グループ上限・不正配分（負数 / 小数 / NaN / 上限超過 / 未知グループ）の防止は `adjustGroupLevel`（engine）が担保。
- GK 3 グループ（`goalkeeping1/2/3`）= `<details>`・非GK は初期折りたたみ・GK カードは初期展開（選手詳細と同挙動）。
- 自動適用 / リセットは `aria-live="polite"` で読み上げ。
- 対象能力・段階コスト・上限は `stat-groups.ts` を単一の真実源として再利用（比較画面へ複製しない）。

### 状態の流れ（`ComparisonBoard.tsx`）

- `ComparisonPlayerInput.savedAllocation`（既存フィールド・groupId→level）が手動配分の保持先。
- `perBuild` memo: 各カードの `resolveAllocation(card, buildMode, savedAllocation)` →
  `groupBreakdowns` + `summarizeGroupPoints` を算出（比較表と同じ `resolveAllocation` を使うので数値が食い違わない）。
- スライダー: `setLevel(i, groupId, level)` / `adjustLevel(i, groupId, delta)` →
  `adjustGroupLevel(現在の解決済み配分, card, groupId, …)` → `savedAllocation` を更新・`savedBuildName` をクリア。
- `savedAllocation` 変更 → `players` 変更 → `buildComparison` 再計算 → `ComparisonTables` が即時更新。
- **一括育成の上書き確認（§10）**: 「全員に同じ育成」ボタンは、手動配分 / 保存ビルドがある列があれば
  `role="alertdialog"` で対象列（「N人目（名前）」）を提示し、「上書きして適用」/「やめる」を選ばせる。
  手動配分が無ければ確認なしで即適用（従来どおり）。

## URL 状態（`al` パラメーター）

既存シリアライズ構造を再監査 → 手動配分を保持する `al` パラメーターを追加:

- 形式: `al=<player0>_<player1>_...`。各 player は `groupId~level` を `.` 連結。空区分=方針に従う。末尾の空区分は省略。
  例: `?ids=A,B,C&al=shooting~5.dribbling~3__defending~2`
- `ids` と同順。純関数 `src/lib/comparison/allocation-url.ts`（`serializeAllocations` / `parseAllocations`）。
- **eval / Function / Base64 化 JSON / 圧縮ライブラリを使わない。** groupId は `PROGRESSION_GROUP_IDS` 許可リスト、
  level は 1..200 の整数のみ。不正な値・未知 groupId は無視。極端に長い場合（`ALLOCATION_URL_MAX_LEN` 超過）は
  `al` を URL へ入れない（保存ビルド / ページ内操作で代替）。
- 復元時: `page.tsx` → `worldDetailToComparisonInput({ savedAllocation })` が **カードごとに
  `normalizeGroupAllocation` で再検証・再クランプ**（不正 1 件で他の比較対象を壊さない）。
- worldCardId は文字列のまま（`Number()` / `parseInt` しない）。

## C. ポジション別 OVR（再監査結果 — 実装せず）

`docs/phase-position-overall.md` を再監査（外部アクセスなし・ワークスペース内のみ）:

| 確認項目 | 結果 |
|---|---|
| `src/lib/ratings/` | **存在しない** |
| `calculate-rating.ts` の `POSITION_WEIGHTS` | 変わらず **暫定重み**（`confidence: "provisional"` / `method: "…(weights are provisional)"` / コメントに「ゲーム内 OVR とは一致しません」「公式の OVR 計算式は未確認」） |
| `confirmed_formula` / 能力重み / 正規化 / 定数項 / 丸め規則 / OVR上限 / familiarity 補正 / 無適性補正 | すべて **未確認**（新しい根拠の追加なし） |
| 検証カードのサンプル | 依然 **1 枚のみ**（`./screenshots/` は今回の除外対象・参照せず） |

→ **正式なポジション別 OVR は実装しない。** 各比較列の「ポジション適性」`<details>` は:
- 登録ポジション（`display.registeredPosition`）を明示。
- 「現在の育成でのポジション別総合値: **—**（計算規則を確認中）」を維持。
- 「現在の育成内容は上の 26 能力値比較へ反映されています。ポジション別総合値は KONAMI が算式・能力重み・
  丸め規則を公開しておらず、複数カードの表示値サンプルも不足しているため、推測値を表示していません
  （架空の数値は出しません）。」

**架空値 0 件。** `calculate-rating.ts` の推定 OVR をポジション別欄へ流用していない。§39 のとおり、
比較列内育成の完成をもって本マイルストーンは完了扱い。

## 維持したもの（変更なし）

最大 4 人 / 26 能力値比較 / 育成方針（全員・個別）/ 保存ビルド選択 / fixed booster / fixed 型推定 /
Power of Many / 条件反映後値 / 実験値 / 監督補正（全員・個別・解除）/ 比較順位 / `ComparisonTables` /
既存の URL パラメーター（`ids` / `b` / `m` / `tp`）/ rulesVersion / 検索カード画像 / スカッド検索・スカッド比較。

## テスト

- `src/lib/comparison/allocation-url.test.ts`（11）: serialize/parse round-trip、空区分 null、末尾空区分省略、
  未知 groupId / 0 / 負数 / 小数の除外、長さガード定数。
- `src/lib/comparison/schemas.test.ts`（+5 → 24）: `al` の解釈・未知値無視・未指定は全 null・round-trip・全 null 省略。
- `src/lib/comparison/build-comparison.test.ts`（+2 → 24）: **`adjustGroupLevel` で積んだ配分が
  `calculateBuild` 直接（選手詳細相当）と 26 能力値一致**、過大 delta でも `overAllocated=false`・残ポイント≥0。
- 全 623 単体テスト PASS（+18）。`black-box-compare.mjs` 54/54（+9: 育成パネル・カテゴリ表示・pt 表示・
  カード導線・ポジション適性「—」維持・架空 OVR なし・`al` URL 反映・`al` 不正値・手動育成状態表示）。
- 全 12 ブラックボックスレール PASS（回帰なし）。
- スライダーの実描画・ドラッグ・キーボードは jsdom 未導入（新規 npm 禁止）のため既存 `ProgressionSlider`（選手詳細で
  実績あり）の再利用 ＋ 純関数テスト ＋ SSR ブラックボックス ＋ 手動確認で担保。

## 手動確認手順（ブラウザ）

1. `/compare?ids=89138556575063,88041460996837` を開く → 各列に カード画像・名前・タイプ・OVR・World ID・
   ブースターチップ・「現在: 育成なし」・選手詳細/育成画面リンク。
2. 1人目の「育成を調整」を開く → Shooting スライダーを上げる → 対象能力（Finishing / Set Piece / Curl）だけ +N・
   残りポイント減少・26 能力値比較の該当行が即時更新。
3. Passing / Dribbling / Dexterity / Lower Body Strength / Aerial Strength / Defending を調整。
4. 「攻撃重視」ボタン → 配分適用（「手動育成」表示）。段階コストで残ポイント不足なら ＋ が disabled。
5. 非GKカードは GK 3 項目が折りたたみ。GK カードで開くと展開。
6. 2人目を別配分に → 26 能力値の差分が変わる。
7. 「全員に同じ育成 → 攻撃重視」→ 手動配分がある列の上書き確認ダイアログ → 「やめる」で維持 /「上書きして適用」で反映。
8. URL に `al=` が付く。再読込 → 配分・「手動育成」表示・26 能力値が復元。各列の「選手詳細」で開いて同じ配分にすると
   26 能力値が一致。
9. ポジション適性の総合値は「—（計算規則を確認中）」。RWF 105 のような架空数値は出ない。
10. 3人目・4人目を追加 → 4 人でも各列のカード画像を判別できる。1人削除 → 残る列の配分がずれない。別カードへ交換
    （削除 → 追加）→ 前カードの配分が流用されない。
11. 375 / 430 / 768 / 1440 / 1920px。比較領域内スクロールのみ。キーボードでスライダー（矢印）・パネル開閉（Enter/Space）。
12. `.next` 削除なし・OneDrive 大量削除警告なし。
