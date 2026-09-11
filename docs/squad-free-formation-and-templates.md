# スカッド: 自由フォーメーション + 複製・テンプレート・横断管理

実施日: 2026-08-30 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除なし

## A. 自由フォーメーション（座標 → 配置ロール）

### 座標系

- 保存は **ピッチ幅・高さに対する百分率** `x∈[0,100]` / `y∈[0,100]`（CSS ピクセルは保存しない・解像度非依存）。
- 向きは formations.ts と同一: `y=0` が攻撃方向（相手ゴール）、`y=100` が自ゴール。GK は y≈93。
- `StoredSlot.x` / `.y` は formation 既定座標（`FormationSlot.x/y`）と同スケールで直接比較可能。
- ドロップ座標はピッチ要素の `getBoundingClientRect` を基準に正規化し `[0,100]` へ clamp（カードのポインタ位置基準・ズーム/サイドバー幅は混ぜない）。

### 配置ロール判定（`src/lib/squad/role-inference.ts`・純関数・`ROLE_INFERENCE_VERSION = "squad-role-inference/2026-08-30.v1"`）

- 横 3 グループ: 左端 `x≤22` / 中央（ハーフスペース含む）`22<x<78` / 右端 `x≥78`（定数 `X_LEFT_MAX` / `X_RIGHT_MIN`）。
- 縦バンド（`y`・0=前線）: FW `<18` / SS `<28` / AMF `<39` / CMF `<51` / DMF `<62` / DF `<86` / GK `≥86`（定数 `Y_*_MAX`）。
- ロール（内部コード＝position.ts / formations.ts と同一体系。RWG/LWG は内部 `RWF`/`LWF`）:
  - 右端: FW/SS帯→`RWF` / AMF・CMF・DMF帯→`RMF` / DF帯→`RB`
  - 左端: `LWF` / `LMF` / `LB`（左右対称・同じ閾値を文字列反転で共有）
  - 中央: FW→`CF` / SS帯→`SS` / AMF→`AMF` / CMF→`CMF` / DMF→`DMF` / DF→`CB`
  - GK ゾーン（`y≥86`）は x を問わず `GK`
- **ヒステリシス** `HYSTERESIS_MARGIN = 5`: `previousRole` の矩形を 5 だけ広げた範囲に入っていれば `previousRole` を維持。
  境界を 5 より大きく超えたときだけ切り替える。ドラッグ中は再判定せず、**ドロップ時に 1 回確定**。
- 閾値・矩形・clamp・ヒステリシスはすべて role-inference.ts の定数に集約（UI に散在させない）。

### 配置ロールと選手適性の分離（重要）

- **配置ロール（placementRole）**: 座標 or 手動上書きから決まる。`buildSquad` の `slotPlacements` 経由で
  `SquadSlotResult.position` / `.role` / `.x` / `.y` を上書き。
- **選手適性（suitability）**: カード本来の登録ポジションで `evaluateCompatibility` が判定（従来どおり）。
  座標が RWF になっても、その選手に RWF 適性を追加しない。カードの登録ポジション・副ポジションデータは変更しない。
- 適性未確認・不適性の可能性は **警告表示のみ**。ユーザーが選んだ移動を適性を理由に禁止しない。
  架空のポジション別 OVR は表示しない。表示OVR は `estimateOvr(card.registeredPosition)` のまま（座標変更で変わらない）。

### 手動上書き（roleOverride）

- `StoredSlot.roleOverride`（内部コード or null）。SlotPlayerPanel の `<select>`（自動 / 各ロール）。
- `effectiveRole = roleOverride ?? inferredRole`。UI に「配置ロール / 自動判定: X / 手動指定中」を併記。
- 手動指定中に大きく動かしても自動解除しない（`resetToFormationPositions` か select で「自動」を選ぶまで維持）。

### 保存・後方互換

- `StoredSlot`: `x?` / `y?` / `roleOverride?` を追加（optional）。`StoredSquad.coordinateVersion?`（`squad-positioning/2026-08-30.v1`）。
- `squad-storage` は要素ごと検証（1 スロット破損で全消ししない）。
  座標: `NaN` / `Infinity` / 文字列 / 範囲外 / x・y 片方欠損 / 座標なしの旧データ → **その slot だけ formation 既定座標へ補完**（一括変換しない・開いたスカッドのみ）。
- `roleOverride` は `isPlacementRole` を通らなければ null。
- 移動・交代（`moves.ts`）では **x / y / roleOverride はスロット（位置）の属性**として保持
  （選手を入れ替えても各スロットの座標は動かない）。キャプテン・セットプレー・Link-Up は従来どおり選手に追従。

### 操作

- **ドラッグ（PC）**: 選手カードをピッチ内の任意位置へドロップ → `SquadPitch` コンテナが座標を正規化 →
  `applyFreePosition(slotId, x, y)` → `inferPlacementRole` で確定 → Undo 退避 → 自動保存。
  枠へのドロップは `stopPropagation` で従来の入れ替え/移動を維持。
- **タップ（モバイル/主操作）**: SlotPlayerPanel の「位置を調整」→ 位置調整モード → ピッチをタップで座標指定。
- **キーボード**: 位置調整モードで矢印キー ±2（Shift で ±6）、Enter/Esc で終了。
- **プリセットへ戻す**: 「フォーメーション位置に戻す」（確認あり）→ 全先発の x/y を formation 既定へ、roleOverride を null へ。
  選手・ベンチ・育成ビルド・ブースター・キャプテン・セットプレー担当は保持。
- **フォーメーション変更**: `changeFormation` が座標なしの slots を作る → 次回保存で新 formation の既定座標へ補完（自然にプリセットへ）。
- 1 段階 Undo に座標変更・ロール上書き・プリセット復帰を含む（再読込では保持しない）。

### 集計

`buildTeamSummary` の `roleBreakdown` / `positionBreakdown` は `SquadSlotResult.role` / `.position`（＝ effectiveRole）から集計。
FW/MF/DF/GK 分類は既存 `position.ts` の `roleOfPosition` を共有（重複実装しない）。

## B. 複製・テンプレート・横断管理

### 複製（`duplicateSquad` 再監査）

- `cloneSquadData()` を新設し **slots / substitutes / boosters / conditionalBoosters / setPieces / linkUp /
  conditionalSettings を deep copy**（複製元と配列・入れ子オブジェクトを共有しない）。
- 新 `squadId` / `createdAt` / `updatedAt`、ベンチ `subId` 振り直し。
- 名前は「〈元名〉 のコピー」、同名があれば「… 2」「… 3」（名前を一意キーにしない・作成前に変更可）。
- 自由配置座標・roleOverride・キャプテン・セットプレー・Link-Up・保存ビルド参照・ブースター設定を保持。

### テンプレート（`src/lib/squad/templates.ts`・別ストア）

- キー `efootball-team-ai:squad-templates:v1`、storageVersion `squad-templates-storage/2026-08-30.v1`、最大 50。
  **通常スカッドとは別の localStorage**（同じ配列に入れない）。
- `saveTemplateFromSquad(squad, name, desc)`: 完全テンプレート（選手・自由配置座標・監督・役割・ベンチを deep copy）。
- `createEmptyTemplate(name, formationId)`: 空テンプレート（formation 既定座標のみ）。
- `createSquadFromTemplate(templateId, name?)`: deep copy + 新 squadId + subId 振り直し → 通常スカッドとして保存。
  **テンプレートと作成済みスカッドは完全に独立**（一方を変えても他方は不変・テスト済み）。
- `renameTemplate` / `deleteTemplate`（**1 件だけ**削除・localStorage 全消去しない）。
- `parseTemplatesStorage`: 要素ごと検証（1 件壊れても他は残す）、未知 storageVersion は空 + 警告。
- ページ `/squads/templates`（`SquadTemplatesBoard`）: 一覧（名前・説明・フォーメーション・空/完全・カスタム配置有無・
  先発/ベンチ人数・監督）、プレビュー（保存済み x/y の `MiniPitch`）、「このテンプレートから作成」「名前変更」「削除（確認）」。

### スカッド一覧（`SquadListBoard`）

- 名前検索 / フォーメーション絞り込み / カスタム配置あり・なし / 使用選手（World ID）絞り込み /
  並び替え（更新新しい順・作成新しい順・名前順・フォーメーション順）。
- 各スカッドに「テンプレ保存」。ヘッダーに「テンプレート一覧へ」。
- `SquadListEntry.hasCustomPositioning` を追加（`hasCustomPositioning(squad)` = 先発座標が formation 既定から 1.5 超離れる or roleOverride あり）。

### 横断使用状況（`src/lib/squad/usage.ts`）

- `findSquadUsageByWorldCardId(squads, worldCardId)` → `SquadUsage[]`（squadId / squadName / formation /
  hasCustomPositioning / area / slotId / benchIndex / x / y / placementRole / isCaptain / setPieceRoles /
  savedBuildId / updatedAt）。`worldCardId` は文字列比較（number は空）。
- My Team（`MyTeamView`）: 各カードに「N スカッドで使用中: 〈スカッド名〉（4-3-3・カスタム・先発 RWF・C）…」を表示、
  スカッドへのリンク付き。**My Team の `usageStatus` は自動変更しない**。

## テスト

- `src/lib/squad/role-inference.test.ts`（24件）: 13 の代表座標 → ロール、四隅・範囲外・NaN・Infinity、
  `clampCoord`、ヒステリシス（維持 / 十分超えたら切替 / 反対サイド / CB→GK にならない / GK 維持 / 揺れで安定）。
- `src/lib/squad/templates.test.ts`（9件）: `cloneSquadData` 非共有、複製の座標保持＋独立性、
  完全/空テンプレート、rename/delete が 1 件のみ、`parseTemplatesStorage` の部分破損耐性・未知バージョン、
  `listTemplateSummaries` のカスタム配置検出、`findSquadUsageByWorldCardId`（先発/ベンチ/配置ロール/キャプテン、文字列比較）。
- `src/lib/squad/squad-storage.test.ts`（+3）: 配置 → 保存 → 再読込、20 桁 ID、1 スロット破損時の他スロット保持。
- 全 549 単体テスト PASS。`black-box-squads.mjs` 34/34、全 12 ブラックボックスレール PASS、回帰なし。
- ドラッグ / タップ / キーボードの実描画は jsdom 未導入（新規 npm 禁止）のため純関数テスト + 手動確認で担保。

## 手動確認手順（ブラウザ）

1. `/squads` でテスト用 4-3-3 を作成。RWF 枠へ選手を追加。
2. その選手を右サイド高位置へドラッグ → 「配置ロール: RWF」。少し下げても境界内は RWF 維持。
3. 中盤位置まで下げる → RMF。さらに下げる → RB。左サイドで LWF→LMF→LB。中央で CF→SS→AMF→CMF→DMF→CB。GK 領域 → GK ＋適性警告。
4. ピッチ外へドロップ → 位置は変わらない（枠から外れない）。
5. SlotPlayerPanel の「位置を調整」→ 矢印キー / ピッチタップで微調整。
6. ロール `<select>` で手動上書き → 「手動指定中」表示。「自動」を選ぶと戻る。
7. 「フォーメーション位置に戻す」で全先発が初期位置へ（選手・キャプテン・担当は残る）。
8. 「元に戻す」で直前の座標へ。自動保存「保存済み」。再読込で x/y・配置ロールを維持。
9. スカッドを複製 → 座標保持・別 ID。複製先の座標を変えても複製元は不変。
10. 「テンプレ保存」→ `/squads/templates` でプレビュー確認 →「このテンプレートから作成」→ 座標保持・独立。
11. スカッド一覧で名前検索・フォーメーション絞り込み・カスタム配置絞り込み・使用選手 ID 絞り込み・並び替え。
12. My Team で「N スカッドで使用中」＋配置ロール表示。375/430/768/1440/1920px で横スクロールなし。
