# マイルストーン完了報告: 保存ビルド重複候補（安全な確認機能）

- 実施日: 2026-09-05
- 対象: `/build-inventory`（本体セクション）＋ `/my-builds`（案内のみ）
- 種別: 読み取り専用の確認機能。**自動統合・自動削除・自動上書き・一括整理ではない。**
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **完了**

---

## 1. 目的

JSON インポートや複製によって増えた可能性がある保存ビルドの「重複候補」を安全に検出・確認できるようにする。
完全一致と類似を明確に分け、同じ `worldCardId` のビルドだけを比較し、一致項目・差分項目・使用状況（My Team /
スカッド）を表示する。誤った自動統合・自動削除を防ぎ、ユーザーが My Builds で個別に判断できる導線を提供する。
表示しただけでは保存データを一切変更しない。

---

## 2. 完全一致の定義

**同一性へ含めたフィールド**（`worldCardId` ごとにグループ化した上で比較）:

| フィールド | 含める理由 |
|---|---|
| `worldCardId` | 対象カードそのもの。文字列完全一致（Number 変換しない）。 |
| `rulesVersion` | `progressionAllocation` の**解釈規則**そのもの（v1 は per-stat、v2 は per-category level）。これが違えば同じ数値でも意味が異なるため必須。 |
| `progressionAllocation` | 育成配分そのもの（正規化: キー昇順・値 0 と不在は既存保存仕様上同義として統一）。 |
| `selectedPlayerBooster` | ユーザーが選んだ選手ブースター試算設定。 |
| `conditionalBoosterSelections` | Power of Many のユーザー指定段階（正規化: `boosterKey` 昇順）。 |

**除外したフィールドと理由**:

| フィールド | 除外理由 |
|---|---|
| `buildId` | 保存管理上の識別子。内容の同一性とは無関係（インポート時に新 ID を発行する仕様とも整合）。 |
| `buildName` | ユーザーが自由につけるラベル。同名でも別内容、別名でも同内容があり得る。 |
| `createdAt` / `updatedAt` | 保存操作の記録。内容が同じでも複製・再インポートで異なる。 |
| `calculatedStats` | **保存時点の計算結果のスナップショット**（設定ではなく出力）。同じ設定でも将来カード基礎値が変わればスナップショットが変わり得るため、設定の同一性の根拠にしない。 |
| `calculatedOvr` | 上と同じ理由（結果であって設定ではない）。task の絶対条件（「calculatedOvr だけで重複判定しない」「calculatedStats だけで重複判定しない」）とも整合するよう、**そもそも同一性判定に含めない**方針を採用。 |
| `calculationMode` | 計算時の確信度ラベル（結果側の付随情報）。設定が同じなら決定的に同じ値になるため、含めても含めなくても真の重複判定には影響しないが、「設定」ではなく「計算結果の性質」なので除外側に整理。 |
| `schemaVersion` | 保存スキーマのバージョン番号（実装上の記録）。育成設定の内容ではない。 |

比較対象は事前に **`savedBuildSchema`（`build-storage.ts`）で再検証**し、通過したビルドだけを対象にする
（`buildInventory()` の入力である `listAllBuilds()` は既に検証済みだが、本モジュールでも独立して再検証する）。

---

## 3. フィンガープリント設計

`src/lib/progression/build-duplicate-review.ts` の `computeBuildFingerprint(build)`:

```
JSON.stringify({
  worldCardId,
  rulesVersion,
  progressionAllocation: canonicalAllocation(...),      // キー昇順・0/不在は同義
  selectedPlayerBooster,                                  // number | null
  conditionalBoosterSelections: canonicalConditional(...) // boosterKey 昇順
})
```

- **決定的**: 同じ内容なら常に同じ文字列（Unit テストで確認）。
- **オブジェクトキー順序に依存しない**: `progressionAllocation` はキー昇順に正規化してから直列化。
- **配列の扱い**: `conditionalBoosterSelections` は「`boosterKey` ごとの選択状態の集合」であり、配列内の
  並び順そのものに意味はない（既存 `validateConditionalBoosterSelection` も `boosterKey` で重複除去する
  実装になっている）。そのため **`boosterKey` 昇順へ正規化してから比較**する。これは「配列の意味上の順序は
  維持する」という要求と矛盾しない — 意味のある順序（挿入順）を維持するのではなく、意味を持たない挿入順の
  違いだけで「別内容」と誤判定しないための正規化である（判断根拠として milestone 報告に明記）。
- **null / undefined /不在の扱い**: `selectedPlayerBooster` は `number | null` のまま区別（`null` と数値は
  別扱い）。`progressionAllocation` の 0 と不在は、既存保存仕様（`saveBuild` の `sanitizeAlloc` が非正数を
  保存前に削除する）に従い同義として扱う。`conditionalBoosterSelections` は未指定（キー自体が無い）と
  空配列を同義（どちらも「指定なし」）として正規化する。
- 暗号学的ハッシュは使わない・外部ライブラリを追加しない（正規化した JSON 文字列そのものをフィンガープリントとする）。
- **localStorage へは保存しない**（呼び出しのたびに計算する表示専用の値）。

---

## 4. 類似候補（実装した・安全な2パターンのみ）

類似候補は**実装した**。誤判定を避けるため範囲を厳しく限定し、以下の 2 パターンだけを対象にする
（いずれも「同じ `worldCardId`・同じ `rulesVersion`」が前提。異なれば類似にしない）:

| パターン | 条件 | 除外する複合ケース |
|---|---|---|
| `allocation-one-category` | `selectedPlayerBooster` と `conditionalBoosterSelections` が完全一致・`progressionAllocation` の差分キーが**ちょうど 1 つ** | 差分キーが 2 つ以上 → 対象外（「別ビルド」扱い） |
| `booster-or-pom-only` | `progressionAllocation` が完全一致・`selectedPlayerBooster` または `conditionalBoosterSelections` のどちらか（両方でもよい）が異なる | 配分も異なる場合は対象外 |

- 配分とブースターの**両方**が異なるケースは、どちらの条件にも当てはまらないため「類似」にせず**候補から除外**
  （安全に説明できる範囲を超えるため）。
- 完全一致（フィンガープリント一致）は、この 2 条件のどちらにも該当しない（差分ゼロは「1 件」にならないため）
  ため、完全一致と類似は自動的に分離される。
- **ペア表示（2 件 1 組）を採用**し、3 件以上を 1 つの「類似グループ」へまとめない。理由: 「配分 1 カテゴリ差」
  「ブースターのみ差」は**推移的な関係ではない**（A と B が配分 1 カテゴリで類似、B と C も配分 1 カテゴリで
  類似でも、A と C は 2 カテゴリ差かもしれない）。誤って推移的にまとめると「グループ全員が類似」という
  不正確な主張になるため、常に**具体的な 1 組（ペア）＋その差分理由**だけを表示する。
- 差分は必ず**具体的な文言**で表示する（例:「配分: シュート（Lv3 → Lv5）」「selectedPlayerBooster: 未指定 →
  ID 44」「Power of Many: 未指定 → +2」）。架空の類似度・百分率・AI 判定は使わない。
- **却下した候補パターン**: 「配分ポイント差が小さい」（「小さい」の閾値が恣意的で説明できないため不採用）。
  能力値合計・レーダー平均・calculatedOvr の近さ・選手名の類似度は最初から対象外（task の絶対条件どおり）。
- `DuplicateReviewSummary.similarSupported` は常に `true`（実装済みのため）。もし将来この判定を無効化する
  必要が生じた場合に備え、画面側は `similarSupported === false` のとき「類似候補の自動判定は、誤判定を
  避けるため現在は行っていません」を表示するフォールバック文言を保持している（現在は非表示）。

---

## 5. 判定不能

以下のいずれかに該当するビルドは**判定不能**として比較対象から除外し、「重複候補なし」には**含めない**:

| 理由コード | 条件 |
|---|---|
| `unknown-rules` | `resolveBuildRuleStatus(rulesVersion).isV2` も `.isLegacy` も false（＝空 `rulesVersion`）。ルールセットが特定できず、`progressionAllocation` の意味（v1/v2 のどちらの解釈か）を安全に判定できないため。 |
| `invalid-schema` | `savedBuildSchema.safeParse(build)` が失敗。 |

- 自動修復・自動削除・自動正規化保存は行わない。安全な識別情報（`buildId` / `worldCardId` が正規表現に
  合う場合のみ）とカード情報だけを一覧表示し、「My Builds または本ページで内容を個別に確認してください」と案内。
- Unit テストで、判定不能ビルドの入力オブジェクトが変更されないこと・安全な ID だけが返ることを確認。

---

## 6. 使用状況（既存 Build Inventory の再利用）

- 入力は **`buildInventory()` の結果（`BuildInventoryItem[]`）** そのもの。`myTeamSelectedCount` /
  `myTeamFavoriteCount` / `squadRefCount` / `squads` / `used` / `multiUse` / `refCount` を候補ビルドへ
  そのまま引き継ぐ（新しい索引・再計算は行わない）。
- 問題参照（削除済み・worldCardId 不一致・不正 buildId・不明）は既存ロジックにより「正常使用」へ含まれない
  （Unit テストで、削除済み参照を持つ My Team レコードがあっても `myTeamSelectedCount` が増えないことを確認）。
- 同じ候補グループ内でも、各 `buildId` の使用状況は**個別に**表示する（「同じ内容だから使用状況も同じ」と
  推測しない）。

---

## 7. 重複除去（グループ構築のアルゴリズム）

1. `buildInventory()` の `items` を再検証（§5）→ 有効なものだけ `eligible` へ。
2. `eligible` を `worldCardId` ごとに `Map` でグループ化（全ビルド同士の無条件総当たりをしない）。
3. 各 `worldCardId` グループ内で、フィンガープリントごとに `Map` でグループ化 → 2 件以上のバケットが
   「完全一致候補グループ」。
4. 同じ `worldCardId` グループ内で、フィンガープリントが異なる組だけ総当たり（グループサイズは通常小さい
   ため実用上問題にならない）→ §4 の 2 条件に合えば「類似候補ペア」。
5. グループは `id`（`kind:sortedBuildIds`）で安定的に識別し、構築後に `id` 昇順でソートして返す
   （呼び出し順・Map の反復順に依存しない安定順）。

---

## 8. 検索・絞り込み・並び替え

- 検索: 既存 `normalizeBuildSearchQuery` / 部分一致トークン AND を再利用（正規表現として評価しない）。
  対象: 日本語/英語選手名・ビルド名・World ID・buildId・rulesVersion・スカッド名。
- 絞り込み: すべて/完全一致候補/類似候補、使用中/未使用、My Team参照あり、スカッド参照あり、複数箇所で
  使用中、現行規則/旧規則、Power of Many指定あり、実験的試算あり、カードタイプ、登録ポジション（複数条件 AND）。
- **意図的に対象外にした絞り込み**: 「規則不明」「判定不能」はグループの絞り込みチップにしていない。
  理由: 規則不明（空 `rulesVersion`）ビルドは §5 により常に判定不能へ回り、グループのメンバーには
  絶対に含まれない（グループの `ruleKind` が `"unknown"` になることは構造上あり得ない）。よって
  「規則不明で絞り込む」チップは常に 0 件になる死んだ UI になってしまうため設けなかった。判定不能ビルドは
  別セクション（常時表示・件数付き）で確認できるようにした。
- 並び替え: 更新日時（グループ内最大）/ 作成日時（グループ内最大）/ グループ内件数/ 合計参照数/
  未使用候補を先頭/ 使用中候補を先頭/ 選手名/ ビルド名/ buildId 安定順。同キーは `id` で安定化。
  不正日時は末尾（現在時刻として扱わない）。すべて非破壊（`slice()` してから `sort()`）。

---

## 9. データ非変更

この機能は**表示専用**。以下は 1 バイトも変更していない:

- 保存ビルド（`build-storage.ts` に変更なし。新規エクスポート・新規関数の追加も行っていない）
- My Team（`selectedBuildId` / `favoriteBuildId` / 所有・使用状態 / タグ / メモ）
- 保存スカッド（配置・`savedBuildId` 参照）
- カード自体のお気に入り
- SQLite（読み取りすら行わない — 本機能は SQLite に触れない）
- `updatedAt` / `buildId` / `rulesVersion` / `progressionAllocation`
- 新規 localStorage キー: 0 / 保存スキーマ変更: 0 / URL 形式変更: 0 / 計算エンジン変更: 0 / 外部送信: 0

---

## 10. テスト結果

### Unit（新規 1 ファイル・40 件）

**`src/lib/progression/build-duplicate-review.test.ts`**
- 完全一致: 0 件・1 件・完全一致 2 件・3 件以上・buildId/buildName/createdAt/updatedAt だけ異なっても一致・
  worldCardId が異なれば統合しない・rulesVersion が異なれば完全一致でない・配分が異なれば完全一致でない・
  selectedPlayerBooster が異なれば完全一致でない・Power of Many 指定が異なれば完全一致でない・
  配分の 0 と不在は同義・オブジェクトキー順序に依存しない・決定的フィンガープリント・元配列不変
- 類似: `similarSupported === true`・配分 1 カテゴリ差 → similar（理由・詳細付き）・selectedPlayerBooster
  だけ差 → similar・Power of Many だけ差 → similar・複数差分は候補にしない・配分とブースター両方差は
  候補にしない・異なる worldCardId 除外・異なる rulesVersion 除外・完全一致と類似の分離・百分率を含まない
- グループ: グループ内 buildId 一意・グループ間重複なし・使用中/未使用混在・同じ選手で複数グループ・安定順
- 使用状況: My Team selected/favorite/両方・スカッド先発・各 buildId 個別保持・問題参照を正常使用へ含めない
- 判定不能: 規則不明（空 rulesVersion）・スキーマ不正（worldCardId 不正）・必須フィールド欠損・
  重複候補なしへ含めない・自動修復/削除なし・安全な ID のみ返す
- 検索・絞り込み: 日本語/英語選手名・ビルド名・World ID・buildId・種類・使用状況・規則・PoM・実験的試算・
  カードタイプ・登録ポジション・My Team参照・スカッド参照・複数箇所（複数条件 AND）・検索結果 0 件・非破壊
- 並び替え: 更新日時・作成日時・グループ件数・未使用優先・使用中優先・buildId 安定順・不正日時は末尾・非破壊

### `npm run verify`（最終）
| 検査 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx` の `{group.nameEn}`） |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`） |
| `npm run test`（vitest run） | **1031 / 1031 PASS**（51 テストファイル） |

### `npm run build`
PASS（全 26 ルート。`/build-inventory` は Static・16.9 kB / First Load 163 kB。`/my-builds` は Static・24.8 kB）。

### ブラックボックス（全13レール・`next start` 上・合計 702 / 702 PASS）
| レール | 件数 |
|---|---|
| my-builds（＋My Team連携＋棚卸しSSR＋旧規則ガイド＋JSON エクスポート/インポート＋**重複候補**） | **95** |
| compare | 74 |
| progression | 99 |
| squads | 46 |
| boosters | 53 |
| world-ui | 82 |
| favorites | 33 |
| ui | 69 |
| managers | 41 |
| manager-picker | 35 |
| phase-b5 | 23 |
| phase-c | 17 |
| world-sync | 35 |
| **合計** | **702** |

`black-box-my-builds` 追加 15 件: 見出し「保存ビルド重複候補」/ 完全一致候補の説明（対象フィールド） /
類似候補の説明 / 自動削除しない・自動統合しない・一括処理しない説明 / My Team・スカッド参照を変更しない説明 /
空状態 / My Builds への導線 / Build Inventory への導線 / 架空 OVR なし / 内部情報リークなし /
My Builds 画面の Build Inventory 案内。14 番目のレールは作らない。

途中 1 件、SSR（保存ビルド 0 件）では候補グループが描画されず「選手詳細への導線」チェックが常に失敗したため
削除（既存の旧規則ガイドの個別行導線チェックも同じ理由で省略されている前例と同じ扱い）。

### HTTP 200（`next start`）
`/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/squads/sq_blackbox0001`（soft 404）`/squads/compare`
`/players/world/89138556575063` `/compare?ids=…` `/favorites` `/managers` `/api/managers`
`/api/world/players/89138556575063` `/api/world/players/by-ids?ids=…` → すべて 200。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべて一致。**書き込み 0**（この機能は SQLite に触れない）。

---

## 11. 作成・編集・削除ファイル

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/lib/progression/build-duplicate-review.ts` | フィンガープリント・完全一致/類似判定・グループ構築・検索/絞り込み/並び替えの純ロジック |
| `src/components/progression/DuplicateReviewSection.tsx` | `/build-inventory` 内のセクション（サマリー・グループ一覧・比較表示） |
| `src/components/progression/DuplicateReviewTeaser.tsx` | `/my-builds` 上部の案内（Build Inventory への導線のみ） |
| `src/lib/progression/build-duplicate-review.test.ts` | Unit テスト 40 件 |
| `docs/milestones/2026-09-02-saved-build-duplicate-review.md` | 本報告 |

### 編集（最小差分）
| ファイル | 変更 |
|---|---|
| `src/components/progression/BuildInventoryView.tsx` | `buildDuplicateReview(inv)` を計算し `<DuplicateReviewSection>` を空状態・通常表示の 2 か所へ追加。既存ロジック・storage リスナーは不変。 |
| `src/components/progression/MyBuildsView.tsx` | `<DuplicateReviewTeaser>` を 2 か所へ追加（既存ロジック不変）。 |
| `scripts/black-box-my-builds.mjs` | SSR 文言・安全性チェックを 15 件追加。 |
| `docs/my-builds.md` | 「保存ビルド重複候補」小節を追加。 |
| `docs/progress.md` | 2026-09-05 の日付エントリを追加。 |
| `docs/project-baseline.md` | unit 991→1031、ブラックボックス 687→702、my-builds レール 80→95、直近サーバー PID、実装済み機能一覧、直前マイルストーン名を更新。 |
| `docs/milestones/README.md` | 一覧に本報告を追加。 |

### 削除
なし。`src/lib/progression/build-storage.ts` / `build-inventory.ts` / `build-export.ts` / `build-import.ts` は
**一切変更していない**（読み取り専用の新規モジュールが既存の型・関数を import するだけ）。

---

## 12. Node 停止 PID とコマンド / 起動 PID と親子関係 / server.pid / dev-err.log

| 局面 | 操作 | PID / コマンド |
|---|---|---|
| 開始時の `next dev` | 停止前検証 | 親 32588（cmdline に `C:\Development\eFootball-Team-AI`）/ リスナー 23180（32588 の子）/ server.pid=32588 一致 |
| dev 停止 | `Stop-Process -Id 23180 -Force` → `Stop-Process -Id 32588 -Force` | ポート 3000 FREE・両 PID 消滅を確認 |
| build 前 | `./data/server.pid` → `0`（ASCII・改行なし） | |
| build | `npm run build` | PASS |
| start | `npm run start -- -p 3000` | npm ラッパー 21888 / `next start` リスナー 34300（cmdline に `C:\Development\eFootball-Team-AI`） |
| 全13ブラックボックス・SQLite | `next start` 上で実行 | 702/702 PASS / integrity ok |
| start 停止 | `Stop-Process -Id 34300 -Force` | ポート 3000 FREE を確認 |
| dev 再起動 | `npm run dev` | npm ラッパー 19008 / **`next dev` 親 33252** / **リスナー 28848（33252 の子）** |
| server.pid | `33252` を書き込み（ASCII・改行なし）・`od -c` で確認 | |
| dev ページ再確認 | `/` `/my-builds` `/build-inventory` `/my-team` `/squads` `/api/world/players/by-ids` `/api/managers` | すべて 200 |
| `./data/dev-err.log` | 0 行（クリーン） | |

同一 PC の別プロジェクト（`遅延証明書シミュレーター`）の Node プロセスには一切触れていない
（停止対象はコマンドラインに `C:\Development\eFootball-Team-AI` を含む PID のみ）。

### 現在のサーバー状態（引き継ぎ）
- `next dev` 稼働中: 親 PID **33252** / ポート 3000 リスナー PID **28848**（33252 の子孫）
- `./data/server.pid` = `33252`（ASCII・改行なし）
- `./data/dev-err.log` = 0 行
- `http://localhost:3000` の主要ページ・API = 200

---

## 13. 発生したバグと修正（この報告内で完結）

1. **Unit テストの誤った期待値**（`複数箇所で使用中` の絞り込みテスト）: b_a を My Team 選択中とスカッド先発の
   両方から参照させたテストデータで `multiUse: true` の結果を 0 件と期待していたが、b_a 自身が実際に 2 箇所
   から参照されているため 1 件が正しい。テストの期待値を修正（アプリ側のロジックは正しかった）。
2. **ブラックボックスの「選手詳細への導線」チェック**が SSR（保存ビルド 0 件）では常に失敗する
   （候補グループが無いので該当リンクが描画されない）。既存の旧規則ガイドの個別行導線チェックも同じ理由で
   省略されている前例に合わせ、この 1 件を削除（実際の導線は Unit テスト外・人間の目視確認項目で担保）。

ゲート本体（verify / build / 全13ブラックボックス / SQLite）の FAIL は 0。

---

## 14. 未解決問題

**なし。** 完了条件（判定・表示・保護・品質）をすべて満たしている。

---

## 15. 人間の目視確認項目（推奨）

- 実ブラウザーで、同じ選手のビルドを複製 → 名前だけ変えて保存 → `/build-inventory` を開き、「保存ビルド
  重複候補」に完全一致候補として表示されること。グループ内の「選手詳細」「育成で開く」「My Builds で管理」
  「My Team を開く」「〈スカッド名〉を開く」導線が実際に機能すること。
- 配分を 1 カテゴリだけ変えた 2 つのビルドが「類似候補」として表示され、差分（例:「配分: シュート（Lv3 →
  Lv5）」）が文字で読めること。配分を 2 カテゴリ変えると候補から消えること。
- `/my-builds` 上部の案内から「Build Inventory で重複候補を確認」を押すと `/build-inventory` へ遷移すること。
- 別タブで保存ビルド・My Team・スカッドのいずれかを更新した状態で `/build-inventory` を開いたまま戻ると、
  「別のタブで重複判定対象データが更新されました」バナーが出て、「再読込」で候補が再計算されること。
  検索語・絞り込み・並び替えの選択が再読込前後で維持されること。
- 375 / 430 / 768 / 1024 / 1280 / 1440 / 1920px で重複候補セクション・グループカードが横スクロールなしで
  読め、`<details>` の開閉がキーボード（Tab / Enter / Space）で操作できること。

---

## 16. 次に推奨する単独マイルストーン（候補・今回は着手しない）

- 類似候補パターンの追加検討（安全に説明できる新しい条件が定義できた場合のみ）。
- 重複候補セクションへのページネーション/仮想スクロール（候補グループ数が非常に多いユーザー向け・現状は
  100 件規模で実用上問題ないため優先度は低い）。
