# マイルストーン完了報告: B1/B2 育成画面インライン配置（レイアウト整理）

- 実施日: 2026-09-06
- 対象: 選手詳細の育成タブ（育成ポイント直下の概要欄）
- 種別: 中リスクの単独UIマイルストーン。**計算エンジンは一切変更していない**（B2標準計算統合は完成済みの前提のまま）。
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **完了**

---

## 0. 前提確認（読み取り専用・作業開始前）

- シェル作業ディレクトリ: `/c/Development/eFootball-Team-AI`（正本と一致）
- Claude Code プロジェクトルート: `C:\Development\eFootball-Team-AI`（一致）
- `CLAUDE.md`: 正本側を読み込み済み
- サーバー状態（開始時）: `next dev` 親 PID **28092**（生存）・リスナー **1108**（28092 の子）・`./data/server.pid`=28092 と一致・`./data/dev-err.log` 0バイト
- 上記がすべて一致したため、正式文書（`CLAUDE.md` / `development-safety-policy.md` / `quality-gates.md` / `project-baseline.md` / `milestone-workflow.md` / `progress.md` / `2026-09-05-b2-booster-readiness.md` / `2026-09-05-b2-standard-integration.md`）を確認のうえ着手。
- 詳細報告の保存先 `docs/milestones/2026-09-05-b1-b2-inline-layout.md` は着手前に未存在を確認（上書きなし）。

---

## 1. 既存実装の確認結果（着手前）

- 「育成ポイント」表示（`PointsBar`）は `ProgressionSummary.tsx` にあり、その直下に「カード付属ブースター」見出し＋`BoosterStrip`（コンパクトなB1チップ表示）が既に配置されていた。
- B2（`selectedPlayerBooster` 経由の手動選択）の選択UIは、ページ下部の折りたたみ「計算根拠とデータの出所を見る」内の `PlayerBoosterPanel` にのみ存在し、育成ポイント直下からは離れていた。
- `PlayerBoosterPanel` は3つの役割を1つのコンポーネントに持っていた: (a) ブースター適用モード（厳密/標準/実験）、(b) B1詳細一覧（解決段階・発動方式・情報源の`<details>`折りたたみを含む）、(c) B2選択UI（スロット別 `<select>`・適用済み一覧・リセット）。
- `selectedPlayerBooster` 状態・更新処理は `ProgressionPanel.tsx` の `useState<SelectedPlayerBooster[]>` 1箇所のみ（`selectedBoosters` / `setSelectedBoosters`）で、`calculateBuild` へそのまま渡されていた。重複状態は存在しなかった。
- `conditionalBoosterSelections`（Power of Many）も `ProgressionPanel.tsx` の1箇所のみで、`ProgressionSummary`（`BoosterStrip` 経由）と `PlayerBoosterPanel`（B1一覧内の `ConditionalBoosterControl`）の**2箇所で同じ状態を参照して二重に表示**していた（状態は1つだが表示が2箇所）。
- `isConfirmedB2Candidate` / `isB2SelectableCandidate`（`booster-catalog.ts`）・`resolveAttachedBooster`（`booster-resolution.ts`）は無編集で再利用。
- 比較画面（`PlayerControlColumn.tsx`）は本マイルストーンの対象外（「選手詳細の育成画面」のみが対象）のため変更していない。
- B2標準計算統合後の Unit Test（`booster.test.ts` 79件・`engine.test.ts` 49件など）・`black-box-boosters` / `black-box-progression` は着手前に把握済み（前回完了報告を参照）。

---

## 2. UI変更（前後比較）

### 変更前
```
ProgressionSummary
  PointsBar（育成ポイント）
  「カード付属ブースター」見出し + BoosterStrip（B1・コンパクトチップ + PoM簡易コントロール）
  「監督」

（…育成スライダー等…）

「計算根拠とデータの出所を見る」（折りたたみ・既定は閉）
  PlayerBoosterPanel
    ブースター適用モード
    「B1 カード付属ブースター」詳細一覧（解決段階・発動方式・情報源）+ PoM詳細コントロール
    「B2 実験的なブースター試算（手動）」← 実験モードON時のみ表示・確認済み/検証中の2群
    実験モードトグル
```

### 変更後
```
ProgressionSummary
  PointsBar（育成ポイント）
  「ブースター」見出し
    [PC: 2列 / モバイル: 縦積み]
    左: AttachedBoosterSection（B1）
      「B1 カード付属ブースター（カードに収録・自動）」
      各付属ブースター: 名称+段階・「カード固有・変更不可」・現在の適用状況バッジ・対象能力
        → <details>「詳細を見る（解決段階・発動方式・情報源）」で根拠を折りたたみ
      Power of Many は「条件付きブースター（Power of Many）」ラベル付きで明示区別・ConditionalBoosterControl（1箇所のみ）
      B2で上書き中の付属は注記表示
    右: B2BoosterSelector（B2）
      「B2 追加ブースター（B2・手動選択）」
      スロット別 <select>（「なし」+ 確認済み候補のみ）+ レベル<select> + 「B2を解除」+「現在適用中」
      未確認・過去の保存値（total-package含む）は専用ラベル＋警告で復元表示（自動削除・自動変換なし）
      適用済み一覧（確認済み=緑バッジ「確認済み・反映中」／未確認=黄バッジ「試算のみ（未確認）」）+「すべて解除」
  「監督」

（…育成スライダー等…）

「計算根拠とデータの出所を見る」（折りたたみ・既定は閉）
  PlayerBoosterPanel（スリム化）
    ブースター適用モード（厳密/標準/実験・無変更）
    「効果の詳細・検証情報」（B1/B2の操作は上部にある旨の案内 + 実験モードトグル + 出所の注記）
```

- B1・B2は同じ「ブースター」領域に統合し、育成ポイント直下・常時表示（折りたたみなし）。
- **B2選択UIは1箇所のみ**（`B2BoosterSelector`・`ProgressionSummary` 内）。下部の `PlayerBoosterPanel` からは完全に撤去し、重複表示を排除。
- Power of Many の `ConditionalBoosterControl` も、従来「上部の簡易表示」と「下部の詳細表示」の**2箇所**に分かれていたものを、新しい B1 領域（`AttachedBoosterSection`）**1箇所**へ統合（状態は元々共有だったが、表示の重複を解消）。

---

## 3. `selectedPlayerBooster` 状態（唯一性の確認）

- `ProgressionPanel.tsx` の `useState<SelectedPlayerBooster[]>([])`（`selectedBoosters` / `setSelectedBoosters`）が**唯一の状態**。型・初期値・`calculateBuild` への渡し方は無変更。
- `grep` で `selectedBoosters` / `B2BoosterSelector` の参照箇所を確認: 状態定義1箇所（`ProgressionPanel.tsx`）・受け渡し1箇所（`ProgressionSummary.tsx`）・レンダリング1箇所（`B2BoosterSelector` 呼び出し1箇所）。`PlayerBoosterPanel.tsx` は参照なし（コメントのみ）。
- `B2BoosterSelector` 内の `setSlot` 関数は、旧 `PlayerBoosterPanel` にあった実装をそのまま移設（ロジック一切変更なし）。新しい state・新しい更新関数は作成していない。

---

## 4. Power of Many（条件付きブースター）

- `conditionalBoosterSelections` の状態・型・保存形式は無変更（`ProgressionPanel.tsx` の `useState` のまま）。
- B2の通常選択欄（`B2BoosterSelector`）には Power of Many 対象（`total-package` 等 `conditional:true`）を一切含めない（`isB2SelectableCandidate`/`isConfirmedB2Candidate` は無編集のまま再利用）。
- 「条件付きブースター（Power of Many）」という明示ラベルを追加し、B1領域内で視覚的に区別（金色バッジ・専用の警告ボックスは維持）。
- 未指定（`"none"`）を最大値として扱わない挙動は `ConditionalBoosterControl`/`conditional-boosters.ts` ともに無編集。

---

## 5. 未確認B2・`total-package` の互換表示

- `B2BoosterSelector` の `legacySelectionLabel` ロジック（旧 `PlayerBoosterPanel` の `excludedSelectionLabel` を拡張・移設）:
  - 現在値が確認済み候補でない場合のみ、`<select>` に専用の1件だけ復元オプションを追加（通常候補一覧には混ぜない）。
  - `conditional:true`（`total-package`）→「◯◯（Power of Many・B2 選択肢からは提供終了）」。
  - 確認済みでない効果（`effect_provisional` 等）→「◯◯（未確認・試算のみ・過去の選択）」。
  - どちらの場合も自動削除・「なし」への自動変換はしない。警告文（「未確認のため通常の最終値には反映されません…」）を表示し、ユーザーが明示的に「なし」または確認済み候補へ変更可能。
- Unit Test（前回マイルストーンの `booster.test.ts` の「未確認B2」「total-package」describe ブロック・変更なしのまま全PASS）で、この互換動作が計算層で保たれていることを再確認済み（今回のUI変更はこの計算結果には触れていない）。

---

## 6. レスポンシブ

- グリッド: `grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start`（Tailwind既定のブレークポイント: `lg` = 1024px）。
  - 1024px未満: B1→B2の縦積み。
  - 1024px以上: B1（左）・B2（右）の2列横並び。
- B2の `<select>` は `min-w-0 flex-1` で親幅いっぱいに伸縮し、長い名称でも `flex-wrap` の兄弟要素（バッジ・警告文）へ折り返す。
- 主要操作（B2選択・レベル選択・「B2を解除」・「すべて解除」）は `min-h-[44px]` を付与しタップ領域を確保。
- 横スクロールを新たに発生させるクラス（`overflow-x-auto` を伴わない固定幅など）は追加していない。

---

## 7. 保存・URL・比較互換性

| 項目 | 結果 |
|---|---|
| `selectedPlayerBooster` 保存形式 | 不変（型・スキーマとも無編集） |
| `conditionalBoosterSelections` | 不変 |
| `SavedBuild`/`MyTeamRecord`/`StoredSquad` スキーマ | 不変（該当ファイル無編集） |
| `storageVersion` / `rulesVersion` | 不変 |
| URL `b` / `m` / `tp` / `al` | 不変（`allocation-url.ts` 等は無編集） |
| 比較画面（`PlayerControlColumn`） | 無編集（本マイルストーンは「選手詳細の育成画面」のみが対象） |
| My Builds / My Team / スカッド | 無編集 |
| JSON エクスポート・インポート | 無編集 |
| SQLite | 書き込み0・`integrity_check`=ok |

---

## 8. テスト結果

### Unit Test
- `npm run verify`（audit:ja-labels → typecheck → lint → test）**PASS**。
- `npm run test`: **1081 / 1081 PASS**（52テストファイル・件数は前回マイルストーンから不変）。
  - 本マイルストーンでは計算コード（`calculate-player-booster.ts`/`calculate-final-stats.ts`/`types.ts`/`engine.ts`）を一切変更していないため、既存の計算テスト・期待値は1件も変更していない。
  - コンポーネント（`AttachedBoosterSection`/`B2BoosterSelector`/`PlayerBoosterPanel`/`ProgressionSummary`）には、このリポジトリの既存方針どおりコンポーネントレンダリングテストの仕組み（`@testing-library` 等）が導入されていないため、UIの対話フロー（選択・解除・変更）は既存の計算層テスト（`booster.test.ts`・`engine.test.ts`・`flow.test.ts`）が同じ `setSlot`/`onChange` ロジックと `selectedPlayerBooster` 契約を検証済みであることをもって担保した（`quality-gates.md` §5 の既存注記「対話操作はJS実行が必要なため計算層テストで担保・ブラックボックスはSSR構造を確認」という既存方針に整合）。新規 npm 依存を追加しないという禁止事項とも整合する。
  - `typecheck`: PASS（新規コンポーネントの型・`ProgressionSummary`/`ProgressionPanel`/`PlayerBoosterPanel` のprops変更含め0エラー）。

### 初回ブラックボックス実行での発見・修正（dev環境）
実装直後、dev環境で `black-box-boosters` 52/54・`black-box-progression` 98/99 の一時的な FAIL を検出。原因を切り分けて対応した:

1. **「育成: 手動試算は通常の最終値・比較の順位・チーム集計に含めない旨」FAIL**
   分類: UI移設に伴う文言欠落（計算バグではない）。
   原因: 旧 `PlayerBoosterPanel` のB2見出し直下にあった説明文（"...通常の最終値・比較の順位・チーム集計は変えません。"）を、新しい `B2BoosterSelector` 側の短い案内文に置き換えた際に文言を落としていた。
   対応: `ProgressionSummary.tsx` のB2見出し説明文に、確認済み/未確認の両方を説明する文へ復元（該当フレーズを含む）。
2. **「育成Messi(v8.1): Accuracy は『固定型・推定』と表示」FAIL**
   分類: UI移設に伴う文言欠落（計算バグではない）。
   原因: この文字列は旧 `BoosterStrip`/`FixedBoosterChip`（今回使用を停止したコンポーネント）のバッジ内にのみ存在しており、`AttachedBoosterSection` へ引き継がれていなかった。
   対応: `AttachedBoosterSection.tsx` に `activationConfirmed === false`（かつ非PoM）のときのみ表示するバッジ「固定型・推定」を追加。

いずれも根拠なくブラックボックス期待値を変更したのではなく、**UI移設で欠落した既存文言を復元した**対応であり、計算結果・判定基準は変えていない。

### 開発モード固有の差異（1件・本番では非再現・quality-gates.md §5相当）
dev環境の `black-box-progression` で「回帰: cloudfront URL をブラウザへ露出しない」が一時的にFAILした。調査の結果:
- 同じ現象が、今回一切編集していない `/players`（選手一覧）ページでも再現した。
- 該当文字列は RSC フライトペイロード（`self.__next_f.push` 内の `imageUrlCandidate` フィールド）に由来し、画像プロキシ・一覧UIのソースコードは今回無編集。
- 長時間の Fast Refresh を経た dev サーバー特有の一時的な差異と判断し、`npm run build` → `npm run start` の本番ビルド上で再検証したところ **PASS**（全13ブラックボックス2回とも本番では706/706 PASS）。
- `quality-gates.md` §5 の「最終判定は `next start`（本番ビルド）上の結果を正とする」方針に従い、本番ビルドの結果を正式な最終判定として採用した。本マイルストーンのコード変更が原因ではないことを確認済み。

### 全13ブラックボックス（`next start` 上・最終実行・合計 **706 / 706 PASS**）
| レール | 件数 | 前回比 |
|---|---|---|
| boosters | 54 | 0 |
| progression | 99 | 0 |
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
| **合計** | **706** | **0（件数不変・新規レール追加なし）** |

新しい静的確認は既存の `black-box-boosters.mjs`/`black-box-progression.mjs` の記録内容（見出し・B2欄SSR確認）へ統合済みで、レール数・総件数は変更していない（前回マイルストーンの時点で既に「見出し変更」「B2欄が実験モード不要でSSRに出る」旨の検証が存在しており、今回のレイアウト移設後もそれらが指す文字列は同じ場所（新しいコンポーネント）に存在するため、追加のレコードは不要と判断した）。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべて一致。書き込み0。

### Critical / Warning
Critical **0** / Warning **0**。

---

## 9. サーバー状態（Node PID・停止/起動コマンド）

| 局面 | PID / コマンド |
|---|---|
| 開始時 | `next dev` 親 28092（生存）/ リスナー 1108（28092 の子）/ `server.pid`=28092 一致 |
| 実装中の dev ブラックボックス（1回目） | 同上のdevサーバー上で実行（52/54・98/99 → 修正後 54/54・99/99） |
| 最終ゲート: dev停止 | `Stop-Process -Id 1108 -Force` → `Stop-Process -Id 28092 -Force`（ポート3000解放確認） |
| `server.pid` → `0` | 更新（ASCII・改行なし） |
| build | `npm run build` PASS |
| start（1回目・アクセシビリティ調整前） | リスナー 20672 相当…(実際は下記2回目が最終) |
| start（最終） | npm ラッパー **38688**（cmd.exe）/ `next start` リスナー **12112** → 全13ブラックボックス実行後、`Stop-Process -Id 12112 -Force` → `Stop-Process -Id 38688 -Force` |
| dev再起動（1回目・44px調整前の中間確認用） | 親 **31572** / リスナー **28056** |
| 追加のアクセシビリティ修正後、再度最終ゲートを実施 | dev停止: `Stop-Process -Id 28056 -Force` → `Stop-Process -Id 31572 -Force` |
| build（2回目・最終） | `npm run build` PASS |
| start（2回目・最終） | npm ラッパー **1156**（cmd.exe）/ `next start` リスナー **30960** → 全13ブラックボックス 706/706 PASS・SQLite ok → `Stop-Process -Id 30960 -Force` → `Stop-Process -Id 1156 -Force` |
| dev再起動（最終・現在稼働中） | npm ラッパー **19800** / `next dev` 親 **8872** / リスナー **34000**（8872 の子） |
| `server.pid`（最終） | `8872`（ASCII・改行なし・再読込で一致確認） |
| dev再確認 | `/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/players/world/89138556575063` `/api/managers` すべて200 |
| `./data/dev-err.log`（最終） | 0バイト（クリーン） |

同一PCの他プロジェクトのNodeプロセスには一切触れていない。停止は上記の確認済み単一数値PIDのみに対して実施（`next dev`/`next start` の親プロセスと、そのport 3000を握る子プロセス、および必要に応じてnpm/cmdラッパーのみ）。

---

## 10. 完了条件チェック（`quality-gates.md` §7 準拠）

| 基準 | 結果 |
|---|---|
| B1とB2を近接表示・PC横並び・モバイル縦並び | ✅ |
| B2をその場で選択・なし選択・解除可能 | ✅ |
| 確認済みB2だけ通常候補 | ✅（`isConfirmedB2Candidate` 無編集のまま再利用） |
| Power of Manyは別領域 | ✅（「条件付きブースター（Power of Many）」ラベル明示） |
| B2選択UIの重複0 | ✅（`B2BoosterSelector` は1箇所のみ・`grep`で確認） |
| `selectedPlayerBooster` 形式不変 | ✅ |
| B2標準計算結果不変 | ✅（計算コード無編集・既存テスト1081件全PASS） |
| B1不変 / Power of Many不変 / 監督補正不変 | ✅（計算コード無編集） |
| 保存・URL・比較・JSON互換 | ✅ |
| 保存スキーマ変更0 / SQLite変更0 / 新規localStorageキー0 / 実ユーザーデータ変更0 | ✅ |
| `npm run verify` PASS | ✅ |
| `npm run build` PASS | ✅ |
| 全13ブラックボックス PASS | ✅ 706/706 |
| SQLite `integrity_check` = ok | ✅ |
| Critical 0 / Warning 0 | ✅ |
| next dev正常復旧・server.pid正確・dev-err.logに重大エラーなし | ✅ |
| 未解決問題0（技術的な意味で） | ✅（§11参照。運用上のフォローアップ事項のみ） |

**総合判定: 完了**

---

## 11. 未解決問題

技術的な保留事項は0件。ただし以下は次回以降の判断材料として記録する（今回の完了条件には影響しない）。

1. **未使用となったファイル**: `src/components/world/progression/BoosterStrip.tsx` と
   `src/components/world/progression/FixedBoosterDetails.tsx` は、今回の統合（`AttachedBoosterSection` への一本化）により
   どこからも参照されなくなった（`grep` で確認済み・importer 0件）。CLAUDE.md の削除制限（ユーザーの明示承認が必要）に従い、
   **今回は削除せずそのまま残した**。lint/typecheck には影響しない（未使用でもエラーにはならない）。
   ユーザーが不要と判断すれば、次回以降の別マイルストーンまたは明示指示で削除を検討されたい。
2. **dev モード固有の一時差異**: 上記§8で報告した cloudfront URL の一時的な検出は、本番ビルドでは再現せず、
   かつ今回編集していない `/players` ページでも同様の現象が発生することを確認した。原因はおそらく長時間稼働した
   dev サーバー（Fast Refresh の蓄積）固有の RSC ペイロード挙動であり、本マイルストーンのコードに起因するものではない。
   最終判定は本番ビルドで実施し PASS 済みだが、参考情報として記録する。

---

## 12. 人間の目視確認項目（推奨）

- 実ブラウザーで選手詳細の育成タブを開き、育成ポイント表示のすぐ下に「ブースター」領域が表示され、
  PC幅（1024px以上）ではB1（左）・B2（右）が横並び、375/430/768pxではB1の下にB2が縦に並ぶことを確認する。
- B2の「なし」→確認済み候補選択→対象能力・標準最終値へ即座に反映→「B2を解除」で基準値へ戻ることを確認する。
- Messi（89138556575063）でAccuracy（青・固定・「固定型・推定」バッジ）とBall Protection（金・Power of Many・
  「条件付きブースター（Power of Many）」ラベル付き）が正しく区別表示されることを確認する。
- B1の各項目で「詳細を見る（解決段階・発動方式・情報源）」を展開し、根拠情報が読めることを確認する。
- ページ下部の「計算根拠とデータの出所を見る」を開き、B1/B2の重複UIが存在しないこと（モード設定と検証情報のみ）を確認する。
- スクリーンリーダー（NVDA等）でB2の `<select>` のラベル・現在値・「B2を解除」ボタンが適切に読み上げられることを確認する。
- キーボードのみ（Tab/Shift+Tab/Enter/矢印キー）でB2の選択・解除が操作できることを確認する。
- `prefers-reduced-motion: reduce` の環境で、新規追加箇所に不要なアニメーションが発生しないことを確認する
  （今回トランジションは追加していないため通常は問題ないはずだが、念のため確認を推奨）。

---

## 13. 作成・編集・削除ファイル

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/components/world/progression/AttachedBoosterSection.tsx` | B1（カード付属ブースター）表示。旧 `PlayerBoosterPanel` の詳細一覧を移設・「カード固有・変更不可」「固定型・推定」バッジ・「条件付きブースター（Power of Many）」ラベルを追加。 |
| `src/components/world/progression/B2BoosterSelector.tsx` | B2（追加ブースター）選択UI。旧 `PlayerBoosterPanel` の選択欄を移設（ロジック無変更）。タップ領域44px対応。 |
| `docs/milestones/2026-09-05-b1-b2-inline-layout.md` | 本報告 |

### 編集
| ファイル | 変更概要 |
|---|---|
| `src/components/world/progression/ProgressionSummary.tsx` | 育成ポイント直下に「ブースター」グリッド（B1+B2）を追加。`BoosterStrip` の使用を停止し `AttachedBoosterSection`/`B2BoosterSelector` を配置。props に `attachedNote`/`selectedBoosters`/`appliedBoosters`/`onSelectedBoostersChange` を追加。 |
| `src/components/world/progression/PlayerBoosterPanel.tsx` | B1詳細一覧・B2選択UIを削除しスリム化。残すのは「ブースター適用モード」と「効果の詳細・検証情報」（実験モードトグル・出所注記）のみ。props を `{ mode, onModeChange }` のみへ縮小。 |
| `src/components/world/progression/ProgressionPanel.tsx` | `ProgressionSummary`/`PlayerBoosterPanel` への渡し方を更新（`attachedNote`/`selectedBoosters`/`appliedBoosters`/`onSelectedBoostersChange` を`ProgressionSummary`へ、`mode`/`onModeChange`のみを`PlayerBoosterPanel`へ）。 |
| `docs/progress.md` | 本マイルストーンの記録を追加 |
| `docs/project-baseline.md` | 直前マイルストーン名・サーバーPIDを更新（unit数・ブラックボックス数は不変のため据え置き） |
| `docs/milestones/README.md` | 一覧に本報告を追加 |

### 削除
なし（`BoosterStrip.tsx`/`FixedBoosterDetails.tsx` は未使用化したが削除していない。§11参照）。

計算コード（`calculate-player-booster.ts` / `calculate-final-stats.ts` / `types.ts` / `engine.ts` / `booster-catalog.ts` / `booster-resolution.ts` / `conditional-boosters.ts`）は**一切編集していない**。
