# Phase: スカッド編成 / ゲームプラン（/squads）

作成日: 2026-08-28 / 外部アクセス: **0 リクエスト**（既存 SQLite・既存エンジン・既存監督データ・既存画像プロキシ・既存比較ロジックのみ）

## 目的

先発11人＋ベンチのスカッドを組み、フォーメーション・育成ビルド・監督補正・Link-Up Play 条件を
一画面で確認する。育成後能力値・監督補正は **既存の `calculateBuild` を再利用**。
スカッド専用の育成計算式・監督補正式は作らない。

## ルート

| ルート | 種別 | 説明 |
|---|---|---|
| `/squads` | Server shell + Client (`SquadListBoard`) | localStorage のスカッド一覧。新規作成 / 開く / 複製 / 名前変更 / 削除（確認あり） |
| `/squads/{squadId}` | Server shell + Client (`SquadEditor`) | 編集画面。localStorage から読み込み、各カードの詳細を `/api/world/players/{id}` で取得、`buildSquad` で計算。変更は自動保存（Zod 検証後）＋明示「保存」 |
| サイドメニュー「スカッド」 | — | `status: "ready"` |

`{squadId}` は `sq_[A-Za-z0-9]{6,32}` 形式。不正 ID でもクラッシュせず「見つかりません」表示。

## データ構造

### 永続化（localStorage `efb:squads:v1` / Zod 検証）

```
StoredSquad {
  squadId: "sq_xxern..."          // 一意・重複防止
  squadName: string               // 1..50、HTML/JS はエスケープされて表示
  formationId: string             // FORMATIONS のキー
  managerId: number | null        // スカッド全体で1人
  slots: StoredSlot[]             // 先発。formation の slotId と対応
  substitutes: StoredSub[]        // ベンチ（最大12）
  captainSlotId: string | null
  setPieces: { corners, freeKicks, penalties: slotId|null }
  linkUp: { centerPieceSlotId, keyManSlotId: slotId|null }   // Link-Up Play 手動選択
  rulesVersion: string            // PROGRESSION_RULES_VERSION（再計算判定）
  schemaVersion: number           // SQUAD_SCHEMA_VERSION（将来移行）
  createdAt, updatedAt: ISO
}
StoredSlot { slotId, worldCardId: string|null, buildMode: "none"|"attack"|"defense"|"balance"|"gk", savedBuildId: string|null }
StoredSub  { subId, worldCardId, buildMode, savedBuildId }
```

- **表示用の計算結果は保存しない**。保存するのは「カードID・育成ビルドID/方針・監督ID・規則バージョン」。
  `calculatedStats` などは読み込み時に `buildSquad` が算出する。
- 壊れた JSON・schemaVersion 不一致・localStorage 不可 → 安全に空扱い（クラッシュしない）。
- 古い `rulesVersion` は警告し、勝手に上書きしない。古い保存ビルドも保持。

### 実行時（`buildSquad` の出力）

各スロットについて engine の `ProgressionResult` をそのまま保持し、
`baseStats` / `calculatedStats` / `baseOvr` / `displayedOvr` /
`progressionDelta` / `playerBoosterDelta` / `managerBoosterDelta` / `eligibilityStatus` / `warnings` を分離表示。

## フォーメーション（`src/lib/squad/formations.ts`・データ駆動）

10 種: `4-3-3` `4-2-3-1` `4-2-1-3` `4-4-2` `4-2-2-2` `4-1-2-3` `3-4-3` `3-4-2-1` `3-5-2` `5-3-2`。

各スロット: `{ slotId, position, x(0-100), y(0-100 上=攻撃), role: "GK"|"DF"|"MF"|"FW", displayOrder, line }`。
ピッチ座標はコンポーネントにハードコードせず、この定義から描画する。

- 監督データの `formation` が NULL の場合、監督の正式フォーメーションと推測しない。
  フォーメーションは**ユーザーが手動選択する設定**。
- フォーメーション変更: 旧スロット→新スロットを「同ポジション完全一致 → 同 role → 残り」の順で貪欲に引き継ぎ、
  あふれた選手はベンチへ退避（ベンチ満杯なら警告して外す）。育成ビルド・監督設定は保持。

## 選手の追加・配置（`src/components/squad/`）

- World 13,009件は既存 `/api/world/players`（SQLite）で検索。**一度に全件は送らない**（pageSize=20）。
- スロットをタップ → 選手検索ドロワー / 選手を選んで空きスロットへ。**ドラッグ非依存**（タップ/クリックで配置）。
- 同じ `worldCardId` の重複配置を拒否（先発・ベンチ通算）。既に配置済みなら配置場所を表示。
- 同一人物の別カードは `worldCardId` が異なれば追加可。
- 先発11・ベンチ最大12 の上限超過を拒否。
- 先発⇄ベンチ入れ替え、配置解除、選手交代（スロット間 swap）。

## ポジション適性（`src/lib/squad/position.ts`）

World は副ポジション適性が未取得。次を**分離**して表示（能力値・OVR は下げない）:

| status | 意味 |
|---|---|
| `exact` | 登録ポジションと配置ポジションが一致 |
| `related` | 同じ role（DF/MF/FW）内 → 「適性未確認（近いポジション）」 |
| `unresolved` | role も異なる → 「適性未確認」 |
| `gkMismatch` | GK⇔フィールドの組み合わせ → 「不適性の可能性」（唯一断言できる不一致） |

未確認の適性から架空の能力値低下・OVR低下を計算しない。
`displayedOvr` は既存 `calculateBuild().rating.estimatedOvr`（**登録ポジション基準**・検証中）を使い、
配置ポジションによる再重み付けはしない（見かけ上のペナルティを作らないため）。

## 監督（`src/lib/squad/build-squad.ts`）

- スカッド全体へ監督1人。`/api/managers/{id}` → `managerToContext` → `calculateBuild({..., manager})`。
- `confirmationStatus === "confirmed"` かつ `statKey` ありの効果だけ全選手へ適用（既存 `calculateManagerBooster`）。
- 監督変更: 各選手の育成配分は変えず `managerBoosterDelta` だけ再計算（`buildSquad` を再実行するだけ）。
- 監督解除: 全選手 `managerBoosterDelta = 0`。
- 適用順序（育成前/後）は未確認 → UI に明記。

## Link-Up Play（`src/lib/squad/link-up.ts`）

監督の `linkUpPlays[]` と先発11人で **発動条件の照合のみ**:

- Center Piece / Key Man それぞれ `{ playingStyle, positions[] }`。
- 選手が条件に合致 = `playingStyle` 一致（条件にあれば）**かつ** 配置 or 登録ポジションが `positions` に含まれる（条件にあれば）。
- 状態: `met`（両方に合致選手あり）/ `partial`（片方）/ `unmet`（なし）/ `indeterminate`（条件データ不足）。
- Center Piece 候補・Key Man 候補を提示し、ユーザーが手動選択できる。
- **ゲーム内の能力値上昇・効果は未確認 → 能力値へ一切適用しない**。
  UI に「発動条件の照合のみ対応。ゲーム内効果は追加検証中です。」を明記。

## チームサマリー（`src/lib/squad/team-summary.ts`）

先発（オプションでベンチ）を集計: 先発/ベンチ人数、ポジション構成、平均基礎OVR、平均表示OVR、
7カテゴリ（攻撃/ドリブル/パス/守備/フィジカル/スピード/GK・既存 `COMPARE_CATEGORIES` を再利用）の平均、
共通スキル数、監督ブースター適用人数、適性未確認人数、Link-Up 状態、警告件数。

**独自の「チーム総合力」は公式チームパワーとして表示しない**。見出しは「平均表示OVR（検証中・非公式）」。

## 比較機能との接続（`src/lib/squad/to-compare.ts`）

先発/ベンチから最大4人を選択 → 既存 `serializeComparisonState` で `/compare?ids=&b=&m=` を生成。
各選手の `buildMode` と スカッド監督を反映（`b=` `m=`）。育成配分は URL に入れない（保存ビルドは比較画面側で再選択）。
比較専用エンジンは作らず既存 `buildComparison` を使う。

## 入力検証（Zod）

`squadId` `squadName`(1-50) `formationId` `managerId` `worldCardId` `slotId` `assignedPosition`
`selectedBuildId` `captainId` `schemaVersion` `rulesVersion` / localStorage データ全体。
不正値・壊れた保存データで画面をクラッシュさせない。スカッド名の HTML/JS はテキストとして表示（React 標準エスケープ）。

## レスポンシブ

- PC: ピッチ + 右に「選手パネル / 監督 / チームサマリー / Link-Up」。
- モバイル: タブ切替（ピッチ / ベンチ / 監督 / サマリー / Link-Up）、ピッチは縦長、選手パネルはドロワー。
- 375 / 430 / 768 / 1024 / 1280 / 1440px で確認。ピッチは `aspect-[68/105]` の枠内、はみ出さない。横スクロールでページを壊さない。

## テスト

- `formations.test.ts`: 各10フォーメーションが11スロット・GK1・slotId 重複なし・座標0-100・role 構成。
- `position.test.ts`: exact / related / unresolved / gkMismatch。
- `link-up.test.ts`: met / partial / unmet / indeterminate・候補抽出。
- `build-squad.test.ts`: 11配置・ベンチ・監督なし→デルタ0・confirmed 監督→適用・未確認監督→非適用・buildMode・保存ビルド・適性分類・チームサマリー・古い rulesVersion 警告・フォーメーション変更で選手維持。
- `squad-storage.test.ts`: 新規/保存/読込/名前変更/複製/削除/複数/壊れJSON/localStorage 不可/古い schemaVersion/重複防止。
- `to-compare.test.ts`: 有効な比較URL・最大4・buildMode/監督反映。
- `scripts/black-box-squads.mjs`: `/squads` 空状態、`/squads/{id}` 編集シェル（ピッチ11スロット・`?f=` で布陣が変わる）、不正IDでクラッシュしない、検索/監督API到達、既存機能の回帰。
  クリック操作（追加/交代/保存/複製/再読込復元/比較遷移）は JS 実行が必要なため単体テストで担保。

## 実装結果（2026-08-28）

- ライブラリ: `src/lib/squad/`（types / formations / position / link-up / team-summary / build-squad / formation-change / squad-storage / to-compare / from-world / index）。
  `src/lib/progression/resolve-allocation.ts` を新設し比較機能と共用（`buildComparison` もこれを使うようリファクタ）。
- UI: `src/components/squad/`（SquadListBoard / SquadEditor / SquadPitch / SlotPlayerPanel / SquadBench / SquadManagerPanel / TeamSummaryPanel / LinkUpPanel / PlayerSearchPanel / FormationSelect）。
- ページ: `src/app/squads/page.tsx`（一覧・force-static）、`src/app/squads/[squadId]/page.tsx`（編集・force-dynamic・ID形式検証）。
- 編集画面は SSR で「空ピッチ11枠」を描画し、クライアントで localStorage からスカッドを読み込んで差し替え。変更は 500ms デバウンスで自動保存＋明示「保存」ボタン。
- テスト: `src/lib/squad/*.test.ts` 78件（formations 23 / position 9 / link-up 7 / build-squad 19 / squad-storage 15 / to-compare 5）。ブラックボックス `black-box-squads.mjs` 30件。
- 実データ確認: 監督 `linkUpPlays[].centerPiece.playingStyle`（例 "Prolific Winger"）と選手 `playingStyle` が同語彙 → 条件照合が実データで機能。
- 品質ゲート全 PASS（typecheck / lint / test 302 / build / SQLite 整合性）。回帰ブラックボックス全 PASS。外部アクセス 0。
