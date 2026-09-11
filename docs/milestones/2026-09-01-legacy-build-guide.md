# マイルストーン完了報告: 旧規則ビルド確認ガイド（`/build-inventory` 内）

- 実施日: 2026-09-01（最終品質ゲートは 2026-09-02 に完了）
- 対象ページ: `/build-inventory`（保存ビルド棚卸し）内の新セクション。**新ページは作らない。**
- 種別: 読み取り専用の表示機能。**「自動移行機能」ではない。**
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）

---

## 1. 目的と非目的

### 目的
旧 `rulesVersion` で保存されたビルド（`ruleKind === "legacy"`）を、棚卸し画面上で
**安全に発見し、影響範囲（使用中/未使用・My Team・スカッド・問題参照）を確認し、
ユーザーが 1 件ずつ現在の育成画面で確認し直す**ための導線とチェックリストを提供する。

### 非目的（実装しないこと）
- 旧規則ビルドの自動変換・一括変換・現行ルールセットでの再計算・再保存
- `rulesVersion` / `progressionAllocation` / `selectedPlayerBooster` /
  `conditionalBoosterSelections` / `calculatedStats` / `calculatedOvr` の書き換え
- My Team `selectedBuildId` / `favoriteBuildId`・スカッド `savedBuildId` の一括付け替え・解除
- 旧規則ビルドの一括削除
- 移行状態の localStorage 保存、新しい localStorage キーの追加
- 新しい URL パラメータ、新しいルート

---

## 2. 変更ファイル（すべて `C:\Development\eFootball-Team-AI` 配下）

| ファイル | 変更 |
|---|---|
| `./src/lib/progression/build-inventory.ts` | 末尾に純関数 2 個＋型 1 個を追記（`LegacyBuildSummary` / `summarizeLegacyBuilds` / `legacyOnlyFilter`）。既存ロジックは不変。 |
| `./src/components/progression/BuildInventoryView.tsx` | `LegacyBuildGuide` 関数コンポーネントを追加し、通常表示と 0 件空状態の両分岐でレンダー。保存ビルドカード（`InventoryCard`）の導線に「育成で開く」（`?tab=progression`）を追加。`legacyOnlyFilter` / `summarizeLegacyBuilds` を import。 |
| `./src/lib/progression/build-inventory.test.ts` | `describe("summarizeLegacyBuilds（旧規則ビルド確認ガイド）")` に 6 件追加（22 → 28）。 |
| `./scripts/black-box-my-builds.mjs` | `/build-inventory` の SSR 文言・安全性チェックを 9 件追加（48 → 57）。ヘッダー注記に `build-inventory.test.ts` を追記。 |
| `./docs/my-builds.md` | 「旧規則ビルド確認ガイド」小節を追加。棚卸しテスト件数 22 → 28。 |
| `./docs/progress.md` | 2026-09-01 の日付エントリを追加。 |
| `./docs/project-baseline.md` | unit 888 → 894、ブラックボックス合計 655 → 664、my-builds レール 48 → 57、直近サーバー PID、実装済み機能一覧、直前マイルストーン名を更新。 |
| `./docs/milestones/README.md` | 一覧に本報告を追加。 |
| `./docs/milestones/2026-09-01-legacy-build-guide.md` | 本ファイル（新規）。 |

**コード追加は純関数 2 個 + 表示コンポーネント 1 個のみ。** スキーマ・ストレージ API・計算エンジン・
URL・SQLite・localStorage キーへの変更は 0。

---

## 3. 純ロジック（`src/lib/progression/build-inventory.ts` 末尾）

既存の `buildInventory(...)` が返す `BuildInventoryItem[]` から派生させるだけの純関数。
保存データも `items` 配列も一切変更しない。

### `summarizeLegacyBuilds(items: BuildInventoryItem[]): LegacyBuildSummary`
`items.filter(i => i.ruleKind === "legacy")` に対して集計:

| フィールド | 単位 | 意味 |
|---|---|---|
| `total` | ビルド | 旧規則と判定された保存ビルド数 |
| `used` | ビルド | うち正常参照が 1 件以上 |
| `unused` | ビルド | うち正常参照が 0 件 |
| `myTeamSelectedRefs` | 件 | My Team `selectedBuildId` からの正常参照件数の合計 |
| `myTeamFavoriteRefs` | 件 | My Team `favoriteBuildId` からの正常参照件数の合計 |
| `squadRefs` | 枠 | スカッド（先発 + ベンチ）`savedBuildId` からの正常参照枠数の合計 |
| `multiUse` | ビルド | 正常参照 2 件以上 |
| `pom` | ビルド | Power of Many 指定あり |
| `experimental` | ビルド | 実験的試算あり |
| `withProblemRef` | ビルド | worldCardId 不一致で参照されている（`mismatchRefCount > 0`） |

- **規則不明（`ruleKind === "unknown"`・空 `rulesVersion`）は含めない。**
- **現行規則（`ruleKind === "current"`）は含めない。**
- 判定は既存 `resolveBuildRuleStatus` / `isLegacyRulesVersion` に一致（`isLegacyRulesVersion`:
  空文字は `false`、v2 は `false`、それ以外の非空文字列はすべて `true`）。
- 保存日時・ビルド名・文字の見た目で旧規則判定しない。

### `legacyOnlyFilter(): BuildInventoryFilter`
`{ ...DEFAULT_BUILD_INVENTORY_FILTER, rules: "legacy" }` を返すだけ。「旧規則ビルドだけを表示」
ボタン用。既存のフィルター状態は破棄する（＝ボタンは常に同じ結果になる）。

### ポイント表示
一覧カードのポイントは既存 `buildPointSummary(build, maximumLevel)` を使う。これは
`getRuleset(build.rulesVersion)` で**保存時の rulesVersion のルールセット**を引くため、
旧規則ビルドは旧ルールで計算される。`maximumLevel` 不明時は合計・残りが `null` → UI は「—」。
**現行ルールセットでの無条件再計算はしない。**

---

## 4. 画面（`BuildInventoryView.tsx` 内 `LegacyBuildGuide`）

`<details open={旧規則 > 0}>`。見出し「旧規則ビルド確認ガイド（N ビルド）」。

### 常時表示（両分岐共通の導入文）
> 旧規則（旧 rulesVersion）で保存されたビルドを確認し、必要なら各自で個別に現行規則へ調整し直すための
> 読み取り専用ガイドです。この画面から旧規則ビルドを自動変換・一括変換・上書き・削除・解除・付け替えする
> ことはありません。既存の旧規則ビルドはそのまま保持されます。「自動移行機能」ではありません。

### 旧規則ビルドがある場合
1. 件数サマリー（`SummaryStat` で上表 10 項目・単位ラベル付き・0 でない項目は警告色）
2. 単位の説明（ビルド/件/枠）
3. 注意事項ボックス（info 色）:
   - 旧規則ビルドは現行規則へ自動変換されていない。配分の解釈が現行規則と異なる場合がある。
   - この画面から一括変換・上書き・削除・解除・付け替えはしない。
   - ポイントは保存されている旧 rulesVersion のルールセットで表示（現行規則で再計算していない）。
4. 「現行規則で確認し直す手順（各ビルドを個別に）」6 ステップ:
   1. 下の一覧で配分・rulesVersion・使用状況を確認
   2. 各ビルドの「育成で開く」で対象選手の育成タブを開く（旧規則配分は自動で読み込まれない）
   3. 現行規則の状態で配分を確認・調整
   4. **既存の旧規則ビルドを上書きせず**、新しいビルド名で保存（「この育成を保存」）
   5. My Team / スカッドで新しいビルドを**個別に**選び直す（各画面の「保存ビルドを選ぶ」パネル）
   6. 旧規則ビルドが不要かは、参照が外れたことを確認してから My Builds で個別に判断
   ＋ 補足（新規保存しても旧規則ビルドは残る / 参照は自動で切り替わらない / 管理は My Builds）
5. ボタン「旧規則ビルドだけを表示」（`legacyOnlyFilter()` を適用・`aria-pressed`）＋
   （適用中のみ）「絞り込みを解除」＋ My Builds / My Team / スカッドへのリンク
6. 各行（下の一覧）の個別導線の案内

### 旧規則ビルドがない場合（空状態）
- 「旧規則ビルドはありません」
- 「保存されているビルドは現行規則、規則不明、または保存ビルドなしの状態です。旧規則ビルドが
  存在しない理由は複数あるため、**明示的に移行したとは断定できません**。」（§13 遵守）
- 総数 / 現行規則 / 規則不明 の内訳（`SummaryStat`）
- My Builds へのリンク

### 保存ビルドカードの導線追加
`InventoryCard` のアクション行に「育成で開く」（`href={/players/world/{worldCardId}?tab=progression}`）を
「選手詳細」の隣へ追加。旧規則配分を安全に復元できる URL が存在しないため、`?tab=progression` で
育成タブを開くだけ（配分は自動読込されないと手順に明記）。既存の「選手詳細 / My Builds で管理 /
My Team」「使用中スカッド」リンクは不変。

---

## 5. テスト内訳

### Unit（`src/lib/progression/build-inventory.test.ts`・22 → 28）
`describe("summarizeLegacyBuilds（旧規則ビルド確認ガイド）")`:
1. 旧規則 0 件 → 全フィールド 0
2. 現行規則・規則不明を除外し旧規則だけを数える（V1 / V2 / 空 `rulesVersion` の 3 ビルド →
   `total === 1`、`summary.legacyRulesBuilds === 1`、`summary.unknownRulesBuilds === 1`）
3. 使用中・未使用・My Team selected/favorite・スカッド枠・複数箇所・PoM・実験・問題参照
   （旧規則 5 ビルドで `total 5 / used 3 / unused 2 / myTeamSelectedRefs 2 / myTeamFavoriteRefs 1 /
   squadRefs 2 / multiUse 2 / pom 1 / experimental 1 / withProblemRef 1`）
4. 同一スカッドの複数枠は `squadRefs` に各枠を含める
5. 非破壊: 元の `items` 配列を変更しない
6. `legacyOnlyFilter()` は既存フィルターを破棄して `rules: "legacy"` のみ／
   `filterBuildInventory(items, legacyOnlyFilter())` が旧規則ビルドだけを返す

### ブラックボックス（`scripts/black-box-my-builds.mjs`・48 → 57・`next start` 上）
`/build-inventory` の SSR（保存ビルド 0 件のシェル）に対して:
1. 見出し「旧規則ビルド確認ガイド」がある
2. 新しい専用ページを増やしていない（`/legacy` 等へのリンクがない）
3. 読み取り専用・「自動移行機能」ではないと明示（「自動変換・一括変換・上書き・削除・解除・付け替え」）
4. 旧規則ビルドの説明（「旧 rulesVersion」「現行規則へ調整し直す」）
5. 「既存の旧規則ビルドはそのまま保持されます」を明示
6. 空状態「旧規則ビルドはありません」
7. 空状態で「移行済み」と断定しない（`/移行済み|移行が完了|移行しました|移行完了/` に一致しない）
8. 個別確認の導線（「My Builds で管理」）
9. ビルドを変換/移行/更新「しました」と完了形で断定しない

状態別の件数・使用状況・参照数・「旧規則だけを表示」絞り込み・手順本文は localStorage 依存の
ため、Unit テスト（項 5-1〜5-2）で担保。

---

## 6. 最終品質ゲート結果（`docs/quality-gates.md` §2）

| 手順 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx` の `{group.nameEn}`） |
| `npm run verify`（audit:ja-labels → typecheck → lint → test） | PASS |
| `npm run typecheck`（tsc --noEmit） | PASS（exit 0） |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`。`next lint` 廃止予定の注意のみ・従来どおり） |
| `npm run test`（vitest run） | **894 / 894 PASS**（46 ファイル。`build-inventory.test.ts` 28 件） |
| dev サーバー停止（停止前検証） | 親 PID 35604・リスナー 11924（35604 の子）を確認 |
| dev 停止コマンド | `Stop-Process -Id 11924 -Force` → `Stop-Process -Id 35604 -Force` → `Stop-Process -Id 24372 -Force`（npm ラッパー）。ポート 3000 FREE・node プロセス 0 を確認 |
| `./data/server.pid` | `0`（ASCII・改行なし）に設定 |
| `npm run build` | PASS（全 26 ルート。`/build-inventory` は Static・11 kB） |
| `npm run start -- -p 3000` | Ready。リスナー PID 38824 |
| HTTP 200 確認 | `/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/favorites` `/compare` `/managers` `/players` `/api/world/players/89138556575063` `/api/world/players/by-ids?ids=89138556575063` `/api/managers` `/api/data-status` → すべて 200 |
| `black-box-my-builds` | **57 / 57 PASS** |
| 全 13 ブラックボックスレール | **合計 664 / 664 PASS**（my-builds 57・compare 74・progression 99・squads 46・boosters 53・world-ui 82・favorites 33・ui 69・managers 41・manager-picker 35・phase-b5 23・phase-c 17・world-sync 35） |
| SQLite `integrity_check` | **ok**（`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 / `player_cards` 19 / `player_booster_definitions` 44 — すべて一致） |
| `next start` 停止（停止前検証） | リスナー PID 38824（`next start -p 3000`・当該ワークスペース）を確認 |
| `next start` 停止コマンド | `Stop-Process -Id 38824 -Force` → `Stop-Process -Id 40196 -Force`（npm ラッパー）。ポート 3000 FREE・node 0 を確認 |
| `npm run dev` 再起動 | 親 PID **27248** / リスナー PID **30472**（27248 の子）|
| `./data/server.pid` | **27248**（ASCII・改行なし）を記録 |
| dev のページ再確認 | `/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/api/world/players/by-ids?ids=...` `/api/managers` → すべて 200 |
| `./data/dev-err.log` | **0 行**（クリーン） |

### 途中で見つけた不具合と修正（この報告内で完結）
- 追加したブラックボックスチェックの初版正規表現
  `!/rulesVersion.*(上書き|書き換え|一括更新)|.../` が、ガイド導入文の
  「旧規則ビルドを自動変換・一括変換・**上書き**・…することはありません」（＝上書きしないという否定文）に
  一致して自己 FAIL（56/57）。**アプリ側の不具合ではなくテスト側の誤検知。**
  完了形の断定（「変換／移行／再計算／上書き…しました」）だけを検出する正規表現へ修正し 57/57 PASS。

---

## 7. 保護対象の非変更確認

- スキーマ不変: `SavedBuild` / `MyTeamRecord` / `StoredSquad` / `StoredSlot` / `StoredSub` /
  `storageVersion` / `schemaVersion` に変更なし。`worldCardId` は文字列のまま（Number/parseInt なし）。
- localStorage キー: 追加・改名なし（`efootball-team-ai:progression-builds:v1` /
  `:favorites:v1` / `:my-team:v1` / `efb:squads:v1` / `efootball-team-ai:squad-templates:v1` / 変更なし）。
- 計算エンジン不変: `calculateBuild` / `buildComparison` / fixed ブースター / fixed 型推定 /
  Power of Many 計算 / 監督補正 に変更なし。Power of Many の未指定を最大値扱いしていない。
- ポジション別 OVR: 未実装のまま。カードは「総合値（ポジション別 OVR）: —（計算規則を確認中）」を表示。
  架空 OVR 0 件。
- SQLite: 読み取りのみ。`integrity_check` ok・全テーブル件数一致。
- URL: `ids` / `b` / `m` / `tp` / `al` に変更なし。新パラメータなし。新ルートなし。
- 既存 My Builds / My Team / スカッド / 棚卸しの既存機能に回帰なし（全 13 レール 664/664）。
- 実ユーザーの保存ビルド・My Team・スカッド・カードお気に入りは変更していない
  （テストはインメモリ・テスト専用データのみ）。

---

## 8. 現在のサーバー状態（引き継ぎ）

- `next dev` 稼働中: 親 PID **27248** / ポート 3000 リスナー PID **30472**（27248 の子孫）
- `./data/server.pid` = `27248`（ASCII・改行なし）
- `./data/dev-err.log` = 0 行
- `http://localhost:3000` の主要ページ・API = 200

PID は再利用され得るため、次回操作前に必ず `docs/safe-build-and-cache-policy.md` §7 の
全項目（server.pid 一致／ポート 3000 リスナー／親子関係／`next dev` コマンドライン／
当該ワークスペース所属）を再検証すること。

---

## 9. 未解決事項・次の候補（この場では実装しない）

- 旧規則ビルドの配分を安全に復元できる URL がまだない。育成タブへ配分をプリロードする
  仕組みができれば「育成で開く」をより有用にできる（要 URL 設計・既存 `al` パラメータとの整合確認）。
- `rulesVersion` の種類（V1 の細分など）が増えた場合の「旧規則」ラベルの粒度。現状は
  「非空・非 v2 ＝ 旧規則」で一括。
- 規則不明（空 `rulesVersion`）ビルドの扱いは本ガイドの対象外。別途、規則不明ビルドの
  発生原因調査と表示方針が必要か検討の余地あり。
