# アプリ全体の能力値・育成カテゴリ 日本語表記統一

実施日: 2026-08-31 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除・書き直し・属性変更なし

前提: `docs/compare-ja-labels-and-save-build.md`（選手比較画面の日本語化）で作成した
`src/lib/world/stat-labels.ts` を、アプリの残りの画面（主に選手詳細の育成まわり）へ展開したもの。

## 目的

選手比較画面は日本語化済みだったが、選手詳細（概要の能力値一覧・育成画面・詳細な内訳・
各種ブースターの対象能力）に英語の能力値名／育成カテゴリ名が残っていた。
これらを既存の eFootball 用語（カタカナ表記）へ統一し、アプリ全体で同じ内部 key が
常に同じ日本語で表示されるようにする。**表示ラベルだけを変更し、内部 ID・計算・保存形式・URL は変更しない。**

## 単一の真実源: `src/lib/world/stat-labels.ts`

すべての画面はこの辞書（静的定数 + 純関数）だけを使う。各コンポーネントに日本語文字列を
ハードコードしない。SQLite / 外部 API / 翻訳サービスは使わない。

| 関数 | 用途 |
|---|---|
| `statLabelJa(key)` | 26 能力値の表示名（日本語 → 無ければ英語 `nameEn` → key） |
| `groupLabelJa(groupId)` | 育成カテゴリ（10 種）の表示名 |
| `radarAxisLabelJa(categoryId)` | 比較レーダー軸（`COMPARE_CATEGORIES` の id） |
| `buildModeLabelJa(mode)` | 育成方針（none/attack/defense/balance/gk） |
| `statListJa(keys)` | 対象能力の一覧を «/» 連結（「対象: 決定力 / プレースキック / カーブ」用） |

### 26 能力値（内部 key → 表示名）

| key | 表示名 | key | 表示名 |
|---|---|---|---|
| offensiveAwareness | オフェンスセンス | gkAwareness | GKセンス |
| ballControl | ボールコントロール | gkCatching | キャッチング |
| dribbling | ドリブル | gkParrying | クリアリング |
| tightPossession | ボールキープ | gkReflexes | コラプシング |
| lowPass | グラウンダーパス | gkReach | ディフレクティング |
| loftedPass | フライパス | speed | スピード |
| finishing | 決定力 | acceleration | 瞬発力 |
| heading | ヘディング | kickingPower | キック力 |
| setPieceTaking | プレースキック | jumping | ジャンプ |
| curl | カーブ | physicalContact | フィジカルコンタクト |
| defensiveAwareness | ディフェンスセンス | balance | ボディコントロール |
| tackling | ボール奪取 | stamina | スタミナ |
| aggression | アグレッシブネス | | |
| defensiveEngagement | 守備意識 | | |

### 10 育成カテゴリ（内部 groupId → 表示名）

| groupId | 表示名 | groupId | 表示名 |
|---|---|---|---|
| shooting | シュート | defending | ディフェンス |
| passing | パス | goalkeeping1 | GK1 |
| dribbling | ドリブル | goalkeeping2 | GK2 |
| dexterity | クイックネス | goalkeeping3 | GK3 |
| lowerBodyStrength | 脚力 | | |
| aerialStrength | エアバトル | | |

能力値の `dribbling` と 育成カテゴリの `dribbling`（groupId）は表示上どちらも「ドリブル」だが、
型・文脈は別物。

## 適用した画面（この回で変更したファイル）

| ファイル | 変更 |
|---|---|
| `src/components/world/WorldStatGrid.tsx` | 選手詳細「概要」タブの 26 能力値名 `s.nameEn` → `statLabelJa(s.key)`（`title` に英語併記） |
| `src/components/world/progression/CompactStatGrid.tsx` | 育成画面「能力値比較（育成前後）」の能力名を日本語化 + `title` 併記 |
| `src/components/world/progression/StatComparison.tsx` | 「詳細な内訳（表形式）」の能力名を日本語化 + `title` 併記 |
| `src/components/world/progression/FixedBoosterDetails.tsx` | 固定ブースターの「対象能力ごとの上昇量」を日本語化 + `title` |
| `src/components/world/progression/ConditionalBoosterControl.tsx` | Power of Many の対象能力名リストを日本語化（`getStatDef` import 削除） |
| `src/components/world/progression/PlayerBoosterPanel.tsx` | 付属／試算ブースターの「対象: …」を `statListJa` で日本語化（`getStatDef` import 削除） |
| `src/components/world/progression/ProgressionPanel.tsx` | GK 育成の対象能力説明・見出しヒントを `statListJa` / `groupLabelJa` で日本語化 |
| `scripts/black-box-progression.mjs` | 26 能力値日本語表示・英語主表示なし の検証を追加、GK 対象能力の期待値を日本語へ |
| `scripts/black-box-compare.mjs` | GK 対 GK の能力名検証を日本語（GKセンス／コラプシング）へ |

### buildMode 表示ラベルの集約（2026-08-31 追補）

`育成方針`（none / attack / defense / balance / gk）の日本語ラベルが 6 ファイルに
`{ value, label }` 配列としてハードコードされていた。表示テキストを `buildModeLabelJa` へ集約し、
各コンポーネントには**順序と値（内部リテラル）だけ**を残した。表示文字列は完全一致のため画面表示は不変。

| ファイル | 変更 | 表示 |
|---|---|---|
| `src/components/compare/PlayerControlColumn.tsx` | `BUILD_MODES` 配列＋`MODE_LABEL` レコードを削除し `buildModeLabelJa` へ | 不変（育成なし / 攻撃重視 / 守備重視 / バランス重視 / GK重視） |
| `src/components/compare/ComparisonBoard.tsx` | `SHARED_MODES` の label と find(...).label を `buildModeLabelJa` へ | 不変 |
| `src/components/compare/CompareTrainingPanel.tsx` | `PROFILES` 配列（自動配分ボタン）を `buildModeLabelJa` へ | 不変（攻撃重視 / 守備重視 / バランス重視 / GK重視） |
| `src/components/world/progression/ProgressionPanel.tsx` | 同上（選手詳細の自動育成ボタン） | 不変 |
| `src/components/squad/SlotPlayerPanel.tsx` | `MODE_LABEL` レコードを削除し `buildModeLabelJa` へ | 不変 |

`src/components/squad/SquadBench.tsx` の `MODE_LABEL`（攻撃 / 守備 / バランス / GK）は
**意図的な短縮ラベル**（ベンチ行の狭い `<select>` 用）。`buildModeLabelJa` の「攻撃重視」等とは
別物なので集約せず、コード内コメントで明記した。

### 既に日本語化済み（前マイルストーン・この回では未変更）

- `ProgressionSlider.tsx`（選手詳細・比較で共通。見出し・対象能力・aria-label は `groupLabelJa` / `statListJa`）
- `ComparisonTables.tsx` / `CompareCategoryPreview.tsx` / `CompareRadarChart.tsx` / `CompareTrainingPanel.tsx`
- スカッド編集（`SlotPlayerPanel.tsx`）・スカッド比較（`SquadCompareBoard.tsx`）のカテゴリ平均は
  以前から日本語（攻撃 / パス / ドリブル / 守備 / フィジカル / スピード / GK）。個別能力値名を出す UI は無い。
- `WORLD_STAT_GROUP_LABELS`（攻撃 / 守備 / GK / 身体能力）は既存分類のまま。

## 英語を残す方針

内部識別子は英語のまま:
内部 stat key / groupId / TypeScript 型 / enum / API フィールド / SQLite 列 / URL パラメーター /
`rulesVersion` / `worldCardId` / import 名 / 関数名 / 英語の選手名 / カードタイプ /
KONAMI 由来の正式ブースター名 / "Power of Many" / "World ID" / "GK" / 開発用コメント。

- **英語の能力値名は `title` 属性へ併記**（マウスオーバーで確認可能・スクリーンリーダーからも読める）。
  主表示（`>テキスト<`）には残さない。
- 「実験的なブースター試算」セレクトの "Shooting" / "Passing" 等は **KONAMI のブースター名**であり、
  育成カテゴリの英語表示ではない。これらは英語のまま（`booster-catalog.ts` 由来）。

### 内部 ID / groupId を変更しない理由

- URL の `ids` / `b` / `m` / `tp` / `al`、保存ビルドの `progressionAllocation`（`{groupId: level}`）、
  保存スカッドの選手エントリはすべて内部 key / groupId をそのまま保持する。表示名へ変えると
  過去に保存したビルド・スカッド・共有した比較 URL がすべて読めなくなる。
- `calculateBuild` / `buildComparison` / `stat-groups.ts` / `ability-radar.ts` は内部 key で
  能力値を突き合わせる。表示ラベルを計算入力に使うと 26 能力値の対応が壊れる。

## 数値結果の不変性

表記変更前後で次が完全一致（`vitest` 643 / black-box 12 レール全 PASS で担保）:
基礎能力値 / 育成後能力値 / `progressionDelta` / fixed booster / fixed 型推定 / Power of Many /
監督補正 / `standardFinalValue` / `conditionalFinalValue` / `experimentalFinalValue` /
レーダー値 / カテゴリ平均 / 使用・残りポイント / 段階コスト / 比較順位 / 保存ビルド適用結果 / スカッド集計。

`calculateBuild` / `buildComparison` / `stat-groups.ts` / `ability-radar.ts` / allocation /
URL の `al` / 保存スキーマ / `rulesVersion` / `worldCardId` は未変更。

## 互換性

- **URL 互換性**: 比較 URL（`ids` / `b` / `m` / `tp` / `al`）の形式・意味は不変。
- **保存ビルド互換性**: `efootball-team-ai:progression-builds:v1` のスキーマ不変。旧 `rulesVersion` の
  ビルドも従来どおり読み込み・再計算。
- **スカッド保存互換性**: `efootball-team-ai:squads:*` のスキーマ不変。

## ポジション別 OVR（今回も実装せず）

`confirmed_formula` なし（`docs/phase-position-overall.md` §21 のまま。`src/lib/ratings/` は存在せず、
`POSITION_WEIGHTS` は暫定値、検証サンプルは 1 カードのみ）。
日本語化を理由に暫定 OVR を追加していない。レーダーのカテゴリ平均・面積・単純合計を OVR へ流用していない。
選手詳細の表示は「総合値（ポジション別 OVR）: —（計算規則を確認中）」を維持。**架空 OVR は 0 件。**

## アクセシビリティ

- 能力値名・育成カテゴリ名・レーダー軸・対象能力を日本語で読み上げ（英略称に依存しない）。
- 視覚的に省略される場合も `title` / `aria-label` では完全名。
- 色だけで能力値・系列を区別しない（数値・符号を必ず併記）。
- スライダーの現在値・使用/残りポイント・段階コストを読み上げ（`ProgressionSlider`・既存）。

## 自動監査（日本語表記回帰監査）

### 目的

いったん日本語化した能力値名・育成カテゴリ名が、今後の機能追加で英語の「主表示」として
再混入するのを、テスト時に機械的に検出する。人手の目視に依存しない安全網。

### 実行

```
npm run audit:ja-labels     # 監査だけ
npm run verify              # 日常の複合品質確認（下記）
npm run build              # マイルストーン完了時に verify と別で実行
```

- 純ロジック `scripts/lib/ja-label-audit.mjs`（依存ゼロ・読み取り専用・ファイルを書き換えない）。
- ランナー `scripts/audit-ja-stat-labels.mjs`。ロジックのテストは `src/lib/world/ja-label-audit.test.ts`
  （`npm run test` に含まれる）。

#### `npm run verify`（ローカル複合品質コマンド）

```
"verify": "npm run audit:ja-labels && npm run typecheck && npm run lint && npm run test"
```

- 実行順: **1. audit:ja-labels → 2. typecheck → 3. lint → 4. test**
  （軽い表示回帰監査を先に → 型エラー → Lint → 最後に全 unit test）。
- `&&` 連結なので、いずれかが失敗した時点で後続を実行せず、その exit code をそのまま返す
  （`|| true` / `exit 0` 強制なし・エラーを握りつぶさない）。
- **`build` は含めない。** 理由: `next build` は OneDrive Files-On-Demand の影響（`.next` の
  readlink EINVAL）を受けうるため、日常の高速品質確認とは分離し、コード不具合と環境要因の
  失敗を切り分ける。マイルストーン完了時は `npm run verify` の後に `npm run build` を別実行。
- 一般的な npm 環境（Windows / macOS / Linux）で動作。`concurrently` / `cross-env` /
  PowerShell 専用構文 / bash 専用構文 / 新規依存は使わない。
- **リモート CI サービスには接続していない**（このリポジトリに CI 設定はなく、今回も
  GitHub Actions 等を追加していない）。これは「ローカル品質監査」。

### 監査対象 / 対象外

- 対象ディレクトリ: `src/app` / `src/components` / `src/lib` / `scripts` / `docs`。
- 英語主表示の検出は **`.tsx` / `.jsx` のみ**（JSX 本文が対象。`.ts` / `.mjs` / `.md` は構造上 JSX を持たない）。
- 除外: `node_modules` / `.next` / `.git` / `coverage` / `screenshots`、`*.test.tsx` / `*.spec.tsx`、
  CLAUDE.md 除外ファイル（`千鳥…​.txt` / `claude-master-prompt.txt` / `research.txt`）。
- NUL バイトを含むファイルは開かず、修復せず、一覧だけ報告する。

### 検出ルール（構文解析なし・保守的な行スキャン）

| ルール | 内容 |
|---|---|
| A: JSXテキスト | JSX テキストノードの英語能力値／カテゴリ名（複数語）: `>…Set Piece Taking…<` |
| B: JSXテキスト厳密 | JSX テキストノードの英語名（1 語・厳密）: `>Speed<` のように前後がタグのみ |
| C: アクセシブル属性 | `title` 以外のユーザー向け属性の英語名: `aria-label` / `aria-valuetext` / `aria-description` / `placeholder` / `alt` |
| dynamic-name-en-child | JSX **子要素**で `{stat.nameEn}` 等を直接描画（後述） |

#### dynamic-name-en-child（動的 nameEn 表示）

静的リテラル監査（A/B/C）は文字列リテラルが中心なので、`<span>{stat.nameEn}</span>` のような
**式による英語表示**は素通りしてしまう。これを補うルール。

- **検出**: JSX 子要素位置にある `{<受け手>.nameEn}` で、受け手が能力値・育成カテゴリを指す
  慣用名（`stat` / `stats` / `s` / `group` / `groups` / `g` / `item` / `def` / `statDef` / `groupDef`）。
  単一行（`<td>{s.nameEn}</td>`）と、限定的な複数行（`<span>` 改行 `{stat.nameEn}` 改行 `</span>`）に対応。
- **非対象**:
  - `title={stat.nameEn}` などの**属性**（子要素ではない）
  - `const v = stat.nameEn` / `return { nameEn: stat.nameEn }` / `console.log(stat.nameEn)`
  - `{statLabelJa(stat.key)}`（`.nameEn` 式ではない）
  - `{stat.nameEn || "…"}` / `{s.nameEn ?? "-"}`（「単純」ではない）
  - 受け手が固有名詞（`b` / `a` / `r` = ブースター、`manager` / `detail` = 監督、
    `player` / `card` / `d` = 選手・カード表示）。これらの `nameEn` は英語表示可。
  - テンプレートリテラル内、コメント、`import` / `export`、`*.test.tsx`
- **報告**: 「確定違反」ではなく「ユーザー向け英語表示候補」。ただし allowlist で許可されていない
  候補が残れば exit 1。
- **完全な TypeScript/JSX 構文解析ではない。** 関数を経由した表示・条件式・複雑な式は検出できない
  場合がある（[監査の限界](#監査の限界)）。

### 許可する英語（検出しない）

- `title="…"` / `title={\`…\`}` / `title={stat.nameEn}` への英語併記（マウスオーバー確認用）
- `nameEn: "…"` / `const nameEn = "…"` / `const v = stat.nameEn` / `return { nameEn: x.nameEn }`
  / `console.log(x.nameEn)`（データ定義・代入・return オブジェクト・ログ）
- 内部 stat key（`"offensiveAwareness"` 等・camelCase）、groupId、`import` / `export` / `type` / `interface` / `enum`
- 行コメント `//` / ブロックコメント `/* */`
- 静的リテラル監査では `{式}` 全般（`{b.nameEn}` `{statLabelJa(s.key)}` 等）
- テストの否定検査（`expect(html).not.toContain(">Offensive Awareness<")`）
- KONAMI 正式ブースター名（実アプリは `{b.nameEn}` で描画。リテラルの `"Shooting"` 単独は検出しない）
- 英語の選手名（能力値名リストに無い）、"Power of Many"、"World ID"、"GK"、カードタイプ

> 例「`label: "Shooting"`」について: 実アプリの実験的ブースター試算セレクトは `{b.nameEn}` 式で
> 描画しており、育成カテゴリの英語リテラルは JSX に存在しない。監査はリテラルの `>Shooting<` /
> アクセシブル属性のみを対象にし、KONAMI ブースター名の巻き添え検出を避けている。
> 動的ルールも受け手 `b`（ブースター）は対象外。

### allowlist の方針

`scripts/lib/ja-label-audit.mjs` の `ALLOWLIST`。**現状 1 件**（下記 GroupRow のみ）。

各エントリの構造:

| フィールド | 内容 |
|---|---|
| `file` | ワークスペース相対の**単一ファイル**（`..` 不可・絶対パス不可・監査対象ディレクトリ内） |
| `rule` | 既知ルール名（`KNOWN_RULES` のいずれか） |
| `expression` | 許可する具体的な式／文字列（空不可 = ファイルだけの広い除外は禁止） |
| `reason` | 理由（空・短すぎ不可） |
| `reviewWhen` | この例外を見直す条件 |

照合は `file` + `rule` + `expression`（行番号だけに依存しない）。`validateAllowlistEntry()` が
構造を検証し、`isAllowlistEntryStale()` が「対象ファイルが無い／登録式が見つからない」を検出する。
**stale なエントリが残っていると監査は exit 1**（自動削除はしない・人が消す）。

#### 現在の allowlist（1 件）

| file | rule | expression | reason | reviewWhen |
|---|---|---|---|---|
| `src/components/world/progression/GroupRow.tsx` | `dynamic-name-en-child` | `{group.nameEn}` | 未使用のデッドコードだが既存の安全方針で変更・削除禁止。現在どの画面からも到達しないことを確認済み。再利用／表示経路追加時に `groupLabelJa` での日本語化が必要。 | GroupRow.tsx がいずれかの画面から import・描画されたとき、または削除されたとき |

- 禁止: `src/` 全体の除外、`src/components` 全体の除外、wildcard による広い除外、
  コンポーネント全体の無条件除外、新規画面の自動除外、行番号だけに依存した壊れやすい例外、
  空の理由、`nameEn` 式全般の許可、違反を隠す広い正規表現、常に exit 0 にする処理。
- allowlist へ登録したファイルまたは式が存在しなくなったら **stale** として検出し exit 1。
  不要になった例外を恒久的に残さないため。

### 辞書完全性（`stat-labels.ts`）

`checkDictionary()` と `src/lib/world/stat-labels.test.ts` で検証:

- 26 能力値キー・10 育成カテゴリ・7 レーダー軸・5 育成方針すべてに空でない日本語がある
- キーが正典（`WORLD_STAT_KEYS` / `PROGRESSION_GROUP_IDS` / `COMPARE_CATEGORIES`）と過不足なく一致
- 各辞書内に日本語ラベルの意図しない重複がない／HTML 様文字・制御文字を含まない／英語 fallback のままでない
- 未知キーは fallback（英語 → key）で安全に返る
- **意図的な重複**: 能力値 `dribbling` と育成カテゴリ `dribbling` はどちらも「ドリブル」。
  GK1 / GK2 / GK3 は育成カテゴリとして正しい値。辞書をまたいだ重複は検査しない。

### false positive が出たら

1. まず本当に英語主表示か確認（`title` 併記・属性の `{x.nameEn}`・`{式}`・コメント・テスト・
   `b`/`manager`/`player` 受け手は許可）。
2. 監査ロジックの誤検出なら `scripts/lib/ja-label-audit.mjs` のルール／許可コンテキスト
   （`STAT_NAME_EN_RECEIVERS` など）を直し、`src/lib/world/ja-label-audit.test.ts` にケースを追加。
3. どうしても許可が必要な既知箇所だけ `ALLOWLIST` へ `file` + `rule` + `expression` + `reason`
   + `reviewWhen` を付けて追加。見直し条件を必ず書く。不要になったら stale 検出で気付けるので消す。

### 自動修正しない理由

監査は読み取り専用。英語を機械的に日本語へ書き換えると、`title` 併記・ブースター名・
テスト期待値・内部 ID を誤って変更するリスクがある。検出だけ行い、修正は人間が文脈を見て行う。

### 監査の限界

- **完全な TypeScript / JSX 構文解析ではない。** ブロック／行コメント除去 + 正規表現の
  保守的な行スキャン。
- 対象は「静的リテラル（A/B/C）」と「JSX 子要素の単純な `{x.nameEn}` 直接表示（dynamic-name-en-child）」。
- 関数・ヘルパーを経由した動的表示、条件式、複雑な式、複数行にまたがる複雑な JSX は
  検出できない場合がある。
- 監査 PASS は**翻訳完全性の証明ではない**。実ブラウザの目視確認・ブラックボックス確認を
  引き続き行う（[人間の目視確認項目](#人間の目視確認項目) を参照）。
- 誤検出には最小限の allowlist で対応し、広い除外は追加しない。自動修正は行わない。
- 監査能力を過大に表現しない。

### ポジション別 OVR とは無関係

この監査は表示ラベルの言語のみを見る。ポジション別 OVR（`confirmed_formula` なし・「—（計算規則を確認中）」を維持）
とは無関係で、監査を理由に暫定 OVR を追加することはない。

## 育成モード・能力値表示モードのラベル定義（集約状況）

| ラベル群 | 定義場所（単一の真実源） | 状態 |
|---|---|---|
| 育成方針 none/attack/defense/balance/gk | `stat-labels.ts` `BUILD_MODE_LABEL_JA` / `buildModeLabelJa` | 集約済（前追補で 5 コンポーネントを移行） |
| 能力値表示モード base/progressed/standard/conditional/experimental → 基礎/育成後/標準/条件反映後/実験 | `src/lib/comparison/ability-radar.ts` `RADAR_MODE_LABEL` | 既に単一定義。`statValueForMode` の計算 switch と同居しており分離しない。`CompareRadarChart` / `CompareCategoryPreview` / `ComparisonCockpit` が同一 const を import |
| レーダー軸 attack/pass/dribble/… | `stat-labels.ts` `RADAR_AXIS_LABEL_JA` / `radarAxisLabelJa` | 集約済 |
| スカッドのベンチ育成方針（短縮: 攻撃/守備/バランス/GK） | `src/components/squad/SquadBench.tsx` ローカル `MODE_LABEL` | **意図的に非集約**（狭いベンチ select 用の短縮表記。`buildModeLabelJa` の「攻撃重視」等とは別物。コメントで明記） |
| 育成状態の語（「手動育成」「保存ビルド: X」「（手動）」） | 各コンポーネントのローカル文字列 | 文脈依存の UI 文。辞書化しない（表示不変を優先） |

同一内部値へ画面ごとに異なる日本語を割り当てている箇所は無い（`buildModeLabelJa` 移行済みの
5 コンポーネント・`RADAR_MODE_LABEL` 利用の 3 コンポーネントは完全一致）。

## 新しい能力値・カテゴリを追加する場合

1. `src/lib/world/stats.ts`（`WORLD_STAT_DEFS`）または `src/lib/progression/stat-groups.ts` に
   **内部 key / groupId と英語 `nameEn`** を追加。
2. `src/lib/world/stat-labels.ts` の `STAT_LABEL_JA` / `GROUP_LABEL_JA` に **日本語表示名** を追加。
3. `src/lib/world/stat-labels.test.ts` を更新（全 key に日本語がある／未知 key はそのまま返る）。
4. `scripts/lib/ja-label-audit.mjs` の `STAT_NAMES_EN` / `CATEGORY_NAMES_EN` に英語表示名を追加
   （回帰監査が新しい名前も見張るように）。
5. 表示コンポーネントは `statLabelJa(key)` / `groupLabelJa(groupId)` を呼ぶだけ。日本語文字列を
   コンポーネントに直接書かない（`{stat.nameEn}` を JSX 子要素に直接置かない）。
6. `npm run verify`（audit → typecheck → lint → test）が通ることを確認。

## OneDrive Files-On-Demand と `.next` / 開発サーバー

このリポジトリの `.next` は OneDrive の同期対象で、ビルド直後に一部が
オンライン専用（ReparsePoint）へ切り替わり `next dev` / `next start` が
`EINVAL: readlink` で起動できないことがある。詳細と安全手順は
[`docs/safe-build-and-cache-policy.md`](./safe-build-and-cache-policy.md) の
「OneDrive Files-On-Demand と `.next`」章を参照。要点だけ:

- `.next` を削除・書き直し・属性変更しない。`attrib.exe` / ReparsePoint 操作をしない。
- OneDrive の設定・プロセス・同期に触れない。
- EINVAL が出たら 20〜30 秒待って**同じコマンドを 1 回だけ**再試行。再発したら停止して報告し、
  ユーザーに Windows Explorer で `.next` を右クリック →「このデバイス上で常に保持する」を案内。
- `build` が成功しても、その後の `dev` / `start` の失敗は環境要因として切り分ける。

## 表示辞書と内部識別子を混同しない注意

- `stat-labels.ts` は**表示専用**。ここが返す文字列を計算・保存・URL・SQL クエリの
  キーとして使わない。
- 逆に、内部 key / groupId をユーザーに主表示しない（`title` 併記は可）。
- ブースター名（KONAMI 正式名）は能力値・育成カテゴリではない。`stat-labels.ts` の対象外。
