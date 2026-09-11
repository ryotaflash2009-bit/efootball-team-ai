# 選手比較（/compare）: 比較コックピット ＋ 能力値レーダー

実施日: 2026-08-31 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除・書き直し・属性変更なし

## 目的

育成スライダーと 26 能力値比較表が遠く、育成調整と結果確認で大きな上下スクロール往復が必要だった問題を解消する。
**A. 育成スライダーと能力値結果を近づける / B. 能力値レーダーチャートを追加** の 2 点のみ。比較計算・育成計算は変更しない。
参考画像（`./screenshots/compare screen.png`・eFHUB）は **情報配置とグラフの利便性だけ**を参考にし、
デザイン・配色・DOM・計算式・OVR 値・ブランド要素は流用しない。

## 参考画像の利用範囲（`./screenshots/`）

- `compare screen.png`（今回追加・比較 UI）を **読み取り専用で 1 回だけ**確認。
- 参考にしたのは: 左右の選手カード＋スライダーと中央の能力値行を近接配置する構造、中央上部のレーダーチャート、
  1 つの比較ワークスペースへの集約、能力値行の左右差分表示。
- 流用しないもの: eFHUB のデザイン / 配色 / ロゴ / 広告 / DOM 構造 / 非公開計算式 / 表示 OVR 値 / ポジション別 OVR。
- 画像の編集・移動・改名・削除なし。UI 以外の事実を画像だけで確定していない。

## A. 比較コックピット（`ComparisonCockpit.tsx`）

2 人以上の比較で、プレイヤー列グリッドと 26 能力値表の**間**に挿入。`id="compare-cockpit"`（`scroll-mt-24`）。

- **2 人比較**: 3 カラム `[A 育成] [中央] [B 育成]`。左右 = `CompareTrainingPanel embedded`（常時展開・折りたたみボタンなし）。
  同じ育成カテゴリの左右スライダーが近接し、中央で即座に結果を確認できる。
- **3〜4 人比較**: 上部に「育成する選手」タブ（`role="tablist"` / `role="tab"` / `aria-selected` / ライム枠 ＋「（育成中）」）。
  下は `[アクティブ選手の育成] [中央]`。レーダーは全系列、26 能力値表は全列を表示。3〜4 人分のスライダーを常時縦展開しない。
- 中央 = `CompareRadarChart` ＋ `CompareCategoryPreview` ＋ 「26 能力値表へ ↓」「育成へ戻る ↑」アンカーリンク。
- `PlayerControlColumn` は 2 人以上のときスライダーを出さず「比較コックピットでまとめて操作」の案内 ＋ 使用 pt のみ。
  1 人だけ（比較表なし）のときは従来どおり列内に `CompareTrainingPanel`（折りたたみ）。

### 状態（`ComparisonBoard`・すべて UI 状態・URL には入れない）

- `radarMode`（既定 "standard"）/ `showPreBuild`（既定 false）/ `activeIndex`（既定 0・選手が減ったら丸める）/
  `activeCategory`（既定 "shooting"・スライダー / 配分方針を操作すると `onCategoryTouch` で最後に触ったカテゴリへ）。
- 既存の `al`（手動配分）復元・`ids`/`b`/`m`/`tp` は無変更。

## B. 能力値レーダーチャート

### 純関数 `src/lib/comparison/ability-radar.ts`

- **軸 = 既存の `COMPARE_CATEGORIES`（7 分類）を再利用**（攻撃→SHT / パス→PAS / ドリブル→DRI / 守備→DEF / フィジカル→PHY /
  スピード→SPD / GK→GK）。**レーダー専用の独自重みは作らない。** GK 軸はどれかが GK カードのときだけ（6 or 7 軸）。
- 各軸値 = 対象能力値の**単純平均**（小数第1位・-0 正規化）。
- `statValueForMode(stat, mode)`: 既存 `StatBreakdown` レイヤーからのみ選択 —
  基礎 `baseValue` / 育成後 `baseValue+progressionDelta` / 標準 `standardFinalValue` /
  条件反映後 `conditionalFinalValue` / 実験 `experimentalFinalValue`。存在しないレイヤーを推測しない。
- `buildComparisonRadarData(players, mode)` → `{ axes, series[{points, prePoints}], displayMax, anyOver99, notes, warnings }`。
  `prePoints` = 育成前（基礎値）。`displayMax` は既定 99・99 超過時は丸め上げ（99 で切り捨てて見せない）＋ warning。
- `radarPointForAxis(cx,cy,r,i,count,value,displayMax)`: SVG 頂点座標（12 時から時計回り・`displayMax` でクランプ）。
  null / NaN / Infinity は中心（0 扱い）。

### コンポーネント `CompareRadarChart.tsx`（アクセシブルな純 SVG・新規 npm なし）

- `viewBox` でレスポンシブ。グリッドリング（25/50/75/100%）＋ 軸線 ＋ 軸ラベル（`text` 要素）。
- 系列（最大 4）を **色 ＋ 線種 ＋ 点の形** で区別: A=実線・丸 / B=破線・四角 / C=点線・三角 / D=一点鎖線・ひし形。
  凡例に「N人目 名前（カードタイプ・線種名）」を文字で表示。**色だけに依存しない。**
- `role="img"` ＋ `aria-label`（全系列・全軸の値を読み上げ・「ポジション別 OVR ではありません」を含む）。
  ※ React 19 は SVG `<title>` を `<head>` へホイストするため `aria-label` を使用。
- 「育成前を表示」トグル → アクティブ選手の `prePoints` を細い点線で追加（全選手分は出さない）。
- グラフ表示モードボタン（基礎 / 育成後 / 標準・PoM 指定時 +条件反映後・実験モード時 +実験）。
- 直下に **数値代替表**（`<details>`・カテゴリ値・取得不可は「—」）＋ 注記
  （「カテゴリ単純平均」「ゲーム公式の総合値・ポジション別 OVR・AI 評価ではない」「正確な各能力値は 26 能力値表で」）＋
  監督補正が含まれる旨 ＋ 99 超過 warning。
- `motion-safe:transition-none`（アニメーションなし・`prefers-reduced-motion` 尊重）。

## 選択カテゴリの近接プレビュー（`CompareCategoryPreview.tsx`）

- 対象カテゴリは **`stat-groups.ts`（既存の育成カテゴリ定義）を単一の真実源**として `getGroupDef(groupId)` から取得。
  比較画面専用の対象能力対応表は作らない。
- 対象能力ごとに「育成前（`baseValue`）→ 現在（選択モードの値）→ 差」を全選手分、2 人比較は「1人目 − 2人目」も。
- カテゴリ Lv ・使用 / 残りポイント（engine `perBuild`）。
- 注記: 値は `calculateBuild` の結果 / fixed booster・Power of Many・監督補正は「標準 / 条件反映後」モードに含まれる /
  26 能力値表の行を開くとレイヤー別内訳。

## ポジション別 OVR（今回も実装せず）

- `confirmed_formula` なし（`docs/phase-position-overall.md` §21 のまま・新根拠なし）。
- 各比較列の「ポジション適性」`<details>` は「現在の育成でのポジション別総合値: **—**（計算規則を確認中）」を維持。
- **レーダーのカテゴリ平均・面積・合計をポジション別 OVR の代替として扱わない。** 注記で明示。架空値 0 件。

## 維持したもの（変更なし）

26 能力値比較表（`ComparisonTables`・全 26 能力・カテゴリ折りたたみ・差分・行展開の内訳）/ カード画像 / 育成スライダー
（`ProgressionSlider` を再利用）/ 段階コスト / fixed booster / fixed 型推定 / Power of Many / 監督補正 /
保存ビルド適用 / 一括育成 ＋ 上書き確認 / URL（`ids`/`b`/`m`/`tp`/`al`）/ 再読込復元 / rulesVersion /
比較検索カード画像 / スカッド検索 / スカッド比較。**比較 / 育成計算は 1 行も変更なし。**

## テスト

- `src/lib/comparison/ability-radar.test.ts`（12）: 6/7 軸、既存 statKeys 再利用、モード別レイヤー、単純平均（-0 正規化）、
  取得不可の除外、GK 軸、`displayMax`（既定 99・99 超過拡張・切り捨てない）、注記に「ポジション別 OVR ではない」、
  頂点座標（中心 / 半径いっぱい / 12 時方向 / null-NaN-Infinity / クランプ）。
- 全 635 単体テスト PASS（+12）。`black-box-compare.mjs` 68/68（+14: コックピットセクション・レーダー SVG role=img・
  軸ラベル・色以外の区別・表示モード・数値代替表・ポジション別 OVR 注記・アンカー・カテゴリプレビュー・
  架空 OVR なし・26 能力値表維持・4 人 tablist・GK 軸）。
- 全 12 ブラックボックスレール PASS（回帰なし）。
- SVG 実描画・スライダードラッグ・タブ切替は jsdom 未導入（新規 npm 禁止）のため純関数テスト ＋ SSR ブラックボックス ＋
  手動確認で担保。

## 手動確認手順（ブラウザ）

1. `/compare?ids=89138556575063,88041460996837` → 上部にカード列、その下に「比較コックピット」（左 A 育成 / 中央レーダー＋プレビュー / 右 B 育成）。
2. 左の Shooting スライダーを上げる → 中央レーダーの SHT 軸と「Shooting の対象能力（Finishing / Set Piece / Curl）育成前 → 現在」と
   26 能力値表が**スクロールせず**即時更新。
3. Passing / Dribbling を操作 → プレビューが最後に触ったカテゴリへ切替。
4. グラフ表示モードを「基礎」「育成後」「標準」で切替 → レーダーが変化。「育成前を表示」で選択中選手の細線が出る。
5. 右の B を別配分に → レーダーで A/B の形を比較。凡例で「実線・丸 / 破線・四角」を確認（色を見なくても区別できる）。
6. Power of Many +1 を指定 → 「条件反映後」モードが選べる → レーダーがその値へ。
7. 監督を変更 → 標準モードの値が更新（注記に監督補正の旨）。
8. 保存ビルド適用 → スライダー・レーダー・プレビュー・26 能力値表が更新。
9. 「26 能力値表へ ↓」で移動 →「育成へ戻る ↑」でコックピットへ。
10. 3 人目・4 人目を追加 →「育成する選手」タブでアクティブ選手を切替（ライム枠・「育成中」）。4 人目を変えても他 3 人の配分は不変。
11. 再読込 → `al` 配分・レーダー（既定モード）を復元。ポジション適性の総合値は「—」。RWF 105 のような架空数値なし。
12. 375 / 430 / 768 / 1440 / 1920px。比較領域内スクロールのみ。キーボードでスライダー（矢印）・モードボタン・選手タブ。
13. `.next` 削除・書き直し・属性変更なし。OneDrive 大量削除警告なし。
