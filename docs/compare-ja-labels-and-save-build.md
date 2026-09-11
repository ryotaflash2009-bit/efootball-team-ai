# 選手比較: 能力値・育成カテゴリの日本語化 ＋「この育成を保存」

実施日: 2026-08-31 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除・書き直し・属性変更なし

## A. 表示ラベルの日本語・カタカナ化

**内部 stat key / groupId / カテゴリ ID / URL の `al` / 保存スキーマ / 計算ロジックは一切変更していない。**
表示ラベルだけを既存の eFootball 用語へ統一。ラベル変更前後で全数値結果が一致（`vitest` 643 / black-box 74）。

### ラベル辞書 `src/lib/world/stat-labels.ts`（新規・静的定数 + 純関数・単一の真実源）

- `STAT_LABEL_JA` / `statLabelJa(key)` — 26 能力値（オフェンスセンス / ボールコントロール / ボールキープ /
  グラウンダーパス / フライパス / 決定力 / プレースキック / カーブ / ディフェンスセンス / ボール奪取 /
  アグレッシブネス / 守備意識 / GKセンス / キャッチング / クリアリング / コラプシング / ディフレクティング /
  スピード / 瞬発力 / キック力 / ジャンプ / フィジカルコンタクト / ボディコントロール / スタミナ …）。未知キーは英語 → key。
- `GROUP_LABEL_JA` / `groupLabelJa(groupId)` — 育成カテゴリ（シュート / パス / ドリブル / クイックネス / 脚力 /
  エアバトル / ディフェンス / GK1 / GK2 / GK3）。
- `RADAR_AXIS_LABEL_JA` / `radarAxisLabelJa(categoryId)` — レーダー軸（`COMPARE_CATEGORIES` の id →
  シュート / パス / ドリブル / ディフェンス / フィジカル / スピード / GK）。
- `buildModeLabelJa` / `statListJa(keys)`（「対象: 決定力 / プレースキック / カーブ」用）。

### 変更したコンポーネント（表示のみ）

| ファイル | 変更 |
|---|---|
| `ProgressionSlider.tsx`（**選手詳細と共通**） | グループ見出し・「対象: …」・`aria-label` / `aria-valuetext` を `groupLabelJa` / `statListJa` へ。段階コスト・上限・能力対応は不変 |
| `ComparisonTables.tsx` | 26 能力値行名 `s.nameEn` → `statLabelJa(s.key)`（英語は `title` に残す）。スキル見出し「選手スキル（Player Skills）」「AI プレースタイル（AI Playing Styles）」 |
| `CompareCategoryPreview.tsx` | カテゴリ名 `groupLabelJa`・対象能力 `statLabelJa`・「1人目 / 2人目」表記・各行に完全な日本語 `aria-label` |
| `CompareRadarChart.tsx` | 軸ラベル（SVG `text`）・`aria-label` の全系列読み上げ・数値代替表の見出しを `radarAxisLabelJa` へ。英略称 SHT/PAS/DRI は `title` にのみ残す |

英語のまま残すもの（§13）: 内部 key / groupId / 型 / URL / API / SQLite / rulesVersion / worldCardId /
選手名・カードタイプ・**ブースター名**（付属ブースター試算セレクトの "Shooting" 等は KONAMI のブースター名で
育成カテゴリとは別概念）/ "Power of Many" / "World ID" / "GK" / 内部 enum。
`ComparisonTables` の能力値グループ見出し（攻撃 / 守備 / GK / 身体能力）は既存分類のまま。
`CompactStatGrid` / `StatComparison`（選手詳細のみ・`/compare` では未使用）は今回のスコープ外。

## B.「この育成を保存」（`CompareSaveBuildDialog.tsx`）

比較コックピットの各育成パネル（リセットの隣）に「この育成を保存」ボタン。**既存の `build-storage` を再利用**
（比較専用ストレージは作らない）。

- ダイアログ = 既存 `Modal`（`@/components/ui/Overlay`・フォーカストラップ・Esc・背景クリック・フォーカス復帰）。
- 表示: `{N}人目 {カード名} の育成を保存` / 配分プレビュー（`groupLabelJa` + Lv・使用/合計 pt）/ ビルド名入力
  （既定「比較画面の育成」・重複なら「… 2」）/ 新規保存 or 既存を上書き（同一カードのみ）/ Power of Many を含めるか
  （指定があれば既定 ON）。
- **保存内容**: `saveBuild({ worldCardId(文字列), buildName, progressionAllocation, selectedPlayerBooster: null,
  conditionalBoosterSelections: 含める場合のみ, calculatedStats, calculatedOvr, calculationMode, rulesVersion,
  buildId: 上書き時のみ })`。実験的試算・監督は保存ビルド仕様に含まれないため保存しない。fixed booster はカード解決なので保存しない。
- **検証**: ビルド名は制御文字 → スペース・空白畳み・trim・60 字（`build-storage` 側でも trim/空文字/60字）。
  `saveBuild` が worldCardId 正規表現・`sanitizeAlloc`（`normalizeGroupAllocation` 相当の範囲チェック）・
  `sanitizeStats`・上書き時の buildId 存在チェック（**別カードの buildId は自動的に拒否**）。
- **上書き**: buildId 指定・確認ステップ（「『○○』を上書きします（元の配分へは自動で戻せません）」）→「上書きして保存」。
  `createdAt` 維持・`updatedAt` 更新（`saveBuild` の既存挙動）。
- **保存後**: `ComparisonBoard.onBuildSaved(idx, build)` → `buildsRefreshKey++`（`PlayerControlColumn` /
  ダイアログの保存ビルド一覧が読み直す）＋ 該当比較列に `savedBuildName` を関連付け（配分は既に `savedAllocation`・
  26 能力値・レーダーは不変）＋ `aria-live` で「『○○』を保存しました（選手詳細・My Team・スカッドから選択できます）。」。
- **保存失敗**: 成功表示しない・`role="alert"` でエラー・比較の配分は消さない・他の保存ビルド不変・
  localStorage 障害でもクラッシュしない。
- **My Team / スカッドへの自動適用なし**（§26 / §27）。お気に入り不変（§28）。URL の `ids`/`b`/`m`/`tp`/`al` 不変。
  保存ビルドは同じ localStorage キー（`build-storage`）なので選手詳細・My Team・各スカッド編集画面から同じ buildId を選択できる。

## ポジション別 OVR（今回も実装せず）

`confirmed_formula` なし（`docs/phase-position-overall.md` §21 のまま）。日本語化・保存ビルド作成を理由に暫定 OVR を追加していない。
レーダーのカテゴリ平均・面積・単純合計を OVR へ流用していない。「現在の育成でのポジション別総合値: **—**（計算規則を確認中）」を維持。架空値 0 件。

## テスト

- `src/lib/world/stat-labels.test.ts`（8）: 26 能力値すべてに JA ラベル・指定表記一致・未知キーはそのまま /
  10 育成カテゴリ・指定表記 / レーダー軸に英略称が残らない（GK 除く）/ buildMode / statListJa。
- 全 643 単体テスト PASS（+8）。`black-box-compare.mjs` 74/74（+8: 育成カテゴリ日本語・スライダー対象能力日本語・
  26 能力値日本語・英語主表示なし・近接プレビュー日本語・レーダー軸日本語・英略称なし・「この育成を保存」導線）。
- `black-box-progression.mjs`: 「能力値グループ10種」「GKグループ」の期待値を英語 → 日本語（シュート/GK1 等）へ更新（97/97）。
- 全 12 ブラックボックスレール PASS（回帰なし）。
- 保存ダイアログの実操作・フォーカストラップは jsdom 未導入（新規 npm 禁止）のため既存 `Modal` の再利用 ＋
  純関数（`build-storage` 既存テスト）＋ SSR ブラックボックス ＋ 手動確認で担保。

## 手動確認手順（ブラウザ）

1. `/compare?ids=89138556575063,88041460996837` → 育成スライダー見出し「シュート / パス / ドリブル / クイックネス /
   脚力 / エアバトル / ディフェンス / GK1 / GK2 / GK3」、対象能力「決定力 / プレースキック / カーブ」など日本語。
2. 26 能力値表が「オフェンスセンス / ボールコントロール / ボールキープ / グラウンダーパス / …」。レーダー軸が
   「シュート / パス / ドリブル / ディフェンス / フィジカル / スピード」。数値代替表・近接プレビューも日本語。
3. スライダーを変更 → 26 能力値・レーダー・プレビューが変更前と同じ数値で更新（ラベルだけ日本語）。
4. コックピットの「この育成を保存」→ ダイアログ（対象選手・配分プレビュー・ビルド名）→ 新規保存 → 「保存しました」。
5. 「選手詳細」を開く → ビルド保存欄に同名ビルド → 適用 → 26 能力値が比較画面と一致。
6. My Team / 各スカッド編集画面の保存ビルドセレクタにも同ビルドが出る。スカッドへ自動適用されていない。
7. もう一度「この育成を保存」→「既存の保存ビルドを上書き」→ 対象選択 → 確認 → 上書き。別の保存ビルドは不変。
8. localStorage を無効化（プライベートウィンドウ）→ 保存すると「保存できませんでした」/ 比較の配分は消えない。
9. Power of Many を指定 → ダイアログの「Power of Many を含める」が既定 ON。含めて保存 → 条件反映後値で試算される。
10. ポジション適性は「—（計算規則を確認中）」のまま。RWF 105 のような架空数値なし。
11. キーボード: Tab で「この育成を保存」→ Enter → ダイアログ内 Tab 循環 → Esc で閉じてボタンへフォーカス復帰。
12. 375 / 430 / 768 / 1440 / 1920px。`.next` 削除・書き直し・属性変更なし。OneDrive 大量削除警告なし。
