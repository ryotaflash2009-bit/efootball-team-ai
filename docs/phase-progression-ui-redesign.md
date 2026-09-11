# フェーズ: 選手詳細「育成」画面の全面刷新（2026-08-29）

## 目的

正確な計算情報は保ちつつ、一般ユーザー向けに直感的で見やすい操作性へ。
eFHUB から**情報配置・操作の分かりやすさ・育成スライダー・ブースター表示・
金色ブースターの段階選択・能力値変化の即時確認・1画面の情報密度**を参考にした。
eFHUB 固有のブランド・配色・広告・ナビ・ロゴ・コミュニティ機能は複製しない。

**計算エンジン・SQLite・比較・スカッド・保存/復元・厳密/標準/実験モードは一切変更していない**
（UI 層のみ）。外部アクセス 0・SQLite 書き込み 0・新規 npm 0。

## 新規コンポーネント（`src/components/world/progression/`）

| ファイル | 役割 |
|---|---|
| `BoosterIcon.tsx` | カード付属ブースターの独自インライン SVG アイコン（六角形＋抽象記号）。`fixed`（青）/ `power_of_many`（金）/ `live_update` / `unresolved` / `provisional` の 5 種。色だけに依存せず `role="img"`＋`aria-label`＋内部記号＋枠線で区別。eFHUB ロゴは複製しない。 |
| `BoosterStrip.tsx` | 選手概要付近のブースター横並び（wrap）。固定型 → `FixedBoosterDetails`、Power of Many 型 → `ConditionalBoosterControl`（既存）を compact 表示、未解決 → 静的チップ。付属が 1 つなら 1 つだけ・付属なしなら空スロットを出さない。 |
| `FixedBoosterDetails.tsx` | 青色固定ブースターの効果説明ダイアログ（`Modal` 再利用）。**数値変更 UI なし**。名称・固定 +N・対象能力ごとの上昇量・証拠レベル・適用状況・「カード本来の付属」だけを表示。 |
| `ProgressionSlider.tsx` | 能力値グループ 1 行（スライダー中心）。ネイティブ `<input type="range">`（ドラッグ / トラッククリック / ← → / Home / End / PageUp/Down）＋ − / ＋ ボタン（44px）＋ `aria-valuetext`（段階コスト・消費 pt）。 |
| `CompactStatGrid.tsx` | 簡潔な能力値一覧。1 行 = 能力名 / 合計増減 / 最終値（`StatBadge`）。行タップで内訳（基礎・育成・固定ブースター・Power of Many・監督・標準最終・条件反映後）を展開。GK 能力は `<details>` で折りたたみ（GK カードは初期展開）。 |
| `ProgressionSummary.tsx` | 育成タブ上部の選手概要（カード画像・名前・ポジション・最大OVR・Lv上限・`PointsBar`・`BoosterStrip`・監督コンパクトカード）＋ スクロール後に残る細い `ProgressionStickyBar`（残ポイント＋育成リセットだけ固定）。 |

## 既存コンポーネントの再利用（変更なし）

`ProgressionPanel`（再構成のみ）・`PlayerBoosterPanel`・`ConditionalBoosterControl`・
`StatComparison`・`RulesNotice`・`PointsBar`・`BuildBar`・`MigrationNotice`・
`ManagerPicker`・`CurrentManagerCard`・`WorldCardImage`・UI プリミティブ。

`GroupRow.tsx` は `ProgressionSlider` に置き換わり未使用（削除は承認待ち）。

## 情報設計（`ProgressionPanel` の新レイアウト）

```
[スティッキーバー]  選手名 / 最大OVR / 残りポイント / 育成リセット      ← スクロール後も固定
[選手概要]         カード画像・名前・ポジション・最大OVR・Lv上限
                  育成ポイントバー（使用/合計/残り・警告色）
                  カード付属ブースター（ロゴ付きストリップ）
                  監督（コンパクトカード・上部から変更/解除）
[PC 2カラム  lg:grid-cols-[380px_1fr] / xl:[440px_1fr]]
  左: 自動育成（攻撃/守備/バランス/GK 重視）＋育成リセット
      能力値グループ（10 スライダー）
      ビルド保存
  右: 推定OVR
      能力値一覧（簡潔・行展開で内訳）
[details]  計算根拠とデータの出所  ← 証拠情報を一段奥へ
      RulesNotice（モード・規則バージョン・能力値上限・確認状態）
      PlayerBoosterPanel（適用モード 厳密/標準/実験・証拠レベル・実験試算）
      詳細な内訳（表形式・StatComparison）
```

- ページ全体の自然なスクロールへ統一（中央パネル内の独立スクロールを廃止）。固定は
  グローバルヘッダー / タブ / スティッキーバー のみ。
- 詳細ページの `PageContainer` を `wide`(1200) → `xwide`(1440) にして PC 横幅を活用。

## スライダーとポイント計算

- スライダーの値変更は `handleGroupSet(groupId, level)` →
  `adjustGroupLevel(prev, card, groupId, level − current)`。
  **既存の `adjustGroupLevel`（段階コスト `1 + floor(level/5)`・残ポイント・グループ上限）を
  そのまま使う**。到達不能な位置へドラッグ / End キーでも、予算内の最大で止まりマイナス残高を許可しない。
- − / ＋ ボタンは `adjustGroupLevel(±1)`。スライダー・自動育成・リセットと同期。
- 育成計算式・`calculateBuild` は不変。SQLite 書き込みなし。保存はボタン押下時のみ（毎ドラッグ保存しない）。

## Power of Many（金色）

- `activationType === "power_of_many"` のときだけ `BoosterStrip` に
  `ConditionalBoosterControl`（+0/+1/+2/+3 の Modal）を出す。
  確定済みは Messi `89138556575063` boost2=44（Ball Protection・対象4能力）と
  World boost1=83（Total Package・全26能力）のみ。未確認 World ID へ推測適用しない。
- 標準最終値は変えず `conditionalFinalValue` にだけ反映。文言は「ユーザー指定・自動判定ではない」を明記。

## テスト

- `src/lib/progression/flow.test.ts` に「スライダー操作」ケースを追加
  （目標レベル指定 = target−current の delta・0→1・1→0・0→6 の段階コスト維持・±1 と同期・
  End 相当の予算内クランプ・ポイント枯渇時に増えない）。
- 既存 412 → 413 テスト全 PASS。typecheck 0 / lint 0 / build OK。
- ブラックボックス（progression 69 / boosters 44 / ui 69 ほか全 11 スイート）全 PASS。
  SSR 文字列の互換のため、証拠・規則・表形式の詳細パネルは `<details>` 内に残置（DOM には常時存在）。

## 未対応（データ不足・意図的に対象外）

- ゲーム内の**ポジション別 OVR グリッド**（CF/ST/… 別数値）: 当アプリのデータに無いため表示しない。
- 自動育成の「最大 / スマート」候補: 元々当アプリに無い機能（eFHUB 固有）。新規機能追加はしない。
- Power of Many のモーダルは中央 `Modal`（モバイルでも上寄せ・スクロール可）。Bottom Drawer 化は将来検討。
