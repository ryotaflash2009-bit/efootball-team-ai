# マイルストーン完了報告: スカッド診断（スカッド構成評価）基盤

- 実施日: 2026-09-06
- 対象: 保存スカッド編集画面（`/squads/[squadId]`）
- 種別: 中〜高リスクの単独マイルストーン。決定的なルールベース診断エンジン（純関数）＋読み取り専用UI。
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **完了**

---

## 0. 前提確認（読み取り専用・作業開始前）

- シェル作業ディレクトリ: `/c/Development/eFootball-Team-AI`（正本と一致）
- Claude Code プロジェクトルート: `C:\Development\eFootball-Team-AI`（一致）
- `CLAUDE.md`: 正本側を読み込み済み
- サーバー状態（開始時）: `next dev` 親 PID **8872**（生存）・リスナー **34000**（8872 の子）・
  `./data/server.pid`=8872 と一致・`./data/dev-err.log` 0バイト
- `docs/project-baseline.md` の直近ベースライン（unit 1081/1081・全13ブラックボックス 706/706・
  SQLite integrity ok・Critical 0・Warning 0）を確認。
- 詳細報告の保存先 `docs/milestones/2026-09-06-squad-diagnosis-foundation.md` は着手前に未存在を確認（上書きなし）。

---

## 1. リスク評価

| 項目 | 評価 |
|---|---|
| 既存計算への影響 | **0**。`calculateBuild`/`buildSquad`/`resolveAllocation` 等は1行も変更していない。診断エンジンはこれらの**出力（`SquadComputed`）をそのまま読むだけ**。 |
| 保存データへの影響 | **0**。診断は `useMemo` による派生計算のみで、`StoredSquad`・`SavedBuild`・`MyTeamRecord`・SQLite への書き込みは一切ない（純関数・I/O一切なし）。 |
| 表示の信頼性リスク | 「総合評価」という数値が独り歩きし、全国順位や実力の指標と誤認されるリスクがある。→ 免責文言（`DIAGNOSIS_DISCLAIMER`）を常時表示し、全国順位・勝率予測は一切実装しないことで対処。 |
| 将来の収益化への影響 | 出力構造（`basicSummary` と詳細 `categories`/`strengths`/`weaknesses`/`suggestions`）をコード上分離。認証・課金は今回実装しないため、実際の権限判定は別マイルストーン。 |

---

## 2. 採用した診断項目と採用しなかった項目・理由

### 採用（8つの能力カテゴリ + 1つの構成カテゴリ）

| カテゴリ | 対象能力 | 採用理由 |
|---|---|---|
| 攻撃 | offensiveAwareness / finishing / heading / setPieceTaking / curl | 既存 `COMPARE_CATEGORIES.attack`（比較機能）と同一集合を採用し、アプリ内で評価基準を統一 |
| 守備 | defensiveAwareness / tackling / aggression / defensiveEngagement | 既存 `COMPARE_CATEGORIES.defense` と同一 |
| 空中戦 | heading / jumping / physicalContact | 既存の育成カテゴリ定義 `stat-groups.ts` の `aerialStrength` と同一 |
| スピード | speed / acceleration | 既存 `COMPARE_CATEGORIES.speed` と同一 |
| パス・ビルドアップ | lowPass / loftedPass / ballControl | グラウンダーパス・フライパスに、精度を支えるボールコントロールを追加 |
| ドリブル・ボール保持 | ballControl / dribbling / tightPossession | 既存 `COMPARE_CATEGORIES.dribble` と同一 |
| プレス適性 | aggression / stamina / speed / acceleration | 寄せの速さ・運動量に関する能力の組み合わせ |
| カウンター適性 | speed / acceleration / offensiveAwareness | 速攻の推進力（スピード）と飛び出しの判断（オフェンスセンス） |
| 選手配置の充足状況 | （能力値は使用しない）先発配置数・適性・ベンチ人数からの減点式 | 「選手が足りているか」を能力とは独立に評価する構造上の指標 |

同じ能力（例: heading・speed・acceleration・aggression・ballControl）が複数カテゴリに現れる箇所があるが、
いずれも実際のサッカーにおける役割の重複（ヘディングは攻撃と空中戦の両方に関係する等）に基づく**限定的な**
重複であり、1つの能力が最大3カテゴリまでに収まるよう設計した（§5「無制限に重複加点しない」の趣旨）。

### 監査したが採用しなかった項目・理由

| 候補 | 不採用の理由 |
|---|---|
| 身長・利き足を用いた空中戦/その他補正 | `WorldPlayerDetail`（by-idsの完全な型）には `height`/`preferredFoot` フィールドが存在するが、
  スカッド編集画面が実際に使っている表示専用型 `SquadPlayerDisplay`（`src/lib/squad/types.ts`）には
  これらが含まれていない。既存の能力値（heading/jumping/physicalContact）だけで空中戦を安全に評価できるため、
  今回は `SquadPlayerDisplay` の拡張（新規フィールド追加）を見送り、対象を絞った。将来 `SquadPlayerDisplay` を
  拡張する場合は別マイルストーンで安全性を確認して判断する。 |
| 同じカードの別保存ビルドが改善につながる場合の確認導線 | 候補ビルドごとに `calculateBuild` を再実行して比較する必要があり、
  初期版の計算量・複雑さを大きく増やすため、今回は不採用（「ベンチ入れ替え候補」で近い効果のある改善提案は実装済み）。 |
| GK専用カテゴリ（GK能力の評価） | 依頼された8項目の一覧に含まれていないため、今回追加しない（GKは各カテゴリから除外して他選手の評価を歪めない措置のみ実施）。 |
| teamPlaystyle・監督戦術（tacticalProficiencies）を用いた「カウンター適性」補正 | `ManagerContext.tacticalProficiencies` の値の意味・単位が他機能で未消費・未確認のため、
  根拠の説明できない補正になることを避けて不採用。 |
| 「一部確認済み」のような中間評価ラベル | 候補の各カテゴリはすべて「計算可能」か「判定対象外」の2値で扱うほうが説明可能性が高いため、
  中間状態は導入しなかった。 |

---

## 3. 使用データ・評価式・重み・ランク閾値・丸め・欠損値の扱い

### データ解決層（新規コードなし・既存パイプラインを再利用）
- 診断エンジンへの入力は、**既存の `buildSquad()` の出力（`SquadComputed`）をそのまま利用**する
  （`src/lib/squad/build-squad.ts` は無編集）。B1・B2・Power of Many・監督補正・保存ビルド適用は、
  既存の `calculateBuild`/`resolveAllocation` が計算した結果（`StatBreakdown.finalValue`）を診断エンジンが
  そのまま読むだけで、**診断のために計算をやり直すことは一切していない**。
- `SquadEditor.tsx` が既に保持している `computed`（`SquadComputed`）・`squad`（`StoredSquad`）・
  `savedBuildsByCard`（`Record<string, SavedBuild[]>`）から、新設の純関数 `buildSquadDiagnosisInput()`
  （`src/lib/squad/squad-diagnosis.ts`）が診断入力を組み立てる。新しい fetch・localStorage アクセスは
  一切追加していない。
- `worldCardId` は文字列として扱い、`Number`/`parseInt` 変換は行わない。
- 削除済み `savedBuildId` 参照の検出は、既存の `build-inventory.ts` の `classifyBuildReference` と**同じ判定基準**
  （`buildId` 形式・存在確認・`worldCardId` 一致確認）を診断モジュール内に実装し、`missing` /
  `world-card-mismatch` / `invalid-build-id` / `unknown` / `ok` / `none` の6状態で分類する（自動修復・
  自動フォールバックはしない）。
- ベンチの `worldCardId` 未解決枠は、`buildSquad()` の出力からは除外される既存仕様（未解決は配列に含まれない）
  であるため、`StoredSquad.substitutes`（元データ）と突き合わせて「未解決」として補い、0件として消さない。

### 評価式（カテゴリスコア）
```
対象 = 先発スロットのうち、カードが解決済み・role が GK でない選手（ベンチは含めない）
1選手のカテゴリ値 = そのカテゴリの対象能力キー（finalValue）の単純平均（全キーが揃わない場合は不算入）
カテゴリスコア = 対象選手のカテゴリ値の単純平均（Math.round・0〜100 にクランプ）
対象選手が0人 → score=null（判定対象外。0点で代用しない）
```
「選手配置の充足状況」だけは能力値を使わず、減点方式（後述）で算出する。

### 重み・減点定数（すべて `SQUAD_COMPLETENESS_WEIGHTS` として明示）
```
score = 100
  - 先発の空き枠数 × 9   （11人全員欠けると 99 減点 ≈ ほぼ0点）
  - 適性未確認の件数 × 5
  - 不適性の可能性(GKミスマッチ)の件数 × 8
  - ベンチが0人なら追加で 3
（0〜100にクランプ）
```
根拠: 先発の欠員が最も評価を左右すべき要因であるため最大の重みを与え、適性未確認（判定できないだけ）は
不適性の可能性（明確な懸念）より軽く扱う。ベンチ0人は「交代の余地が全くない」という別種の懸念として小さく加点。

### ランク閾値（`DIAGNOSIS_TIER_THRESHOLDS`・降順で最初に一致した境界を採用）
```
S: 85以上 / A: 70以上 / B: 55以上 / C: 40以上 / D: 0以上
```
根拠: eFootball のカード能力値は主力級で80台後半〜90台、控え級で40〜60台に分布する傾向があるため、
Sを「主力級が複数揃う」水準に絞り、D〜Cを「明確な底上げの余地がある」水準に広く取った。今後の実測データで
見直す可能性があるが、初期版として固定する。

### 丸め・NaN/Infinity対策
- すべてのスコアは `Math.round` で整数化し、`Math.max(0, Math.min(100, …))` でクランプ（`safeScore()`）。
- `!Number.isFinite(n)` の場合は `null`（判定対象外）を返し、`NaN`/`Infinity` を外部へ返さない。
- 除算は対象人数が1人以上であることを確認してから行うため、構造的にゼロ除算は発生しないが、
  防御的に `safeScore()` でも保護している。

### 欠損値の扱い
- 対象能力が1つでも解決できない選手は、そのカテゴリの計算対象から**除外**する（0点に変換しない）。
- 保存ビルド未設定は「データ不足」であり、能力値自体は基礎値のまま評価対象に含める（未設定＝評価対象外とはしない）。
- worldCardId 未解決・監督未解決は、スコアを下げる要因にはせず、`dataQuality`（データ充足率とは別軸の内訳）
  および `evaluationUnratedCategoryLabels`／`suggestions` へ明示する。

---

## 4. 先発・ベンチ／GK・DF・MF・FW／保存ビルド／B1・B2・Power of Many／監督補正の扱い

- **先発とベンチ**: 8つの能力カテゴリはすべて「先発」のみを対象にする（ベンチの能力値は加点しない）。
  ベンチは「選手配置の充足状況」（人数）と「改善候補（ベンチ入れ替え候補）」でのみ参照する。
- **GKとフィールドプレイヤー**: `role !== "GK"` の先発だけを8カテゴリの対象にする（GKカードの低い攻撃系能力に
  引きずられない）。GK専用カテゴリは今回追加しない（§2参照）。
- **配置ポジション**: `SquadSlotResult.compatibility.status`（`exact`/`related`/`unresolved`/`gkMismatch`/`empty`）
  をそのまま利用し、独自の適性判定ロジックは実装していない（`src/lib/squad/position.ts` は無編集）。
- **保存ビルド**: `savedBuildId` が設定されていれば、`buildSquad()` が既に適用した育成配分後の `finalValue`
  （B1・B2・Power of Many・監督補正すべて反映済み）をそのまま使用する。未設定なら基礎値ベースの計算結果を
  そのまま使用する（診断エンジン側で追加の分岐はしていない＝計算エンジンを信頼して二重実装しない）。
- **B1・B2・Power of Many**: 診断エンジアン自体はこれらを一切計算しない。`calculatePlayerBooster`/
  `calculate-final-stats.ts` の出力（`finalValue`）をそのまま読むだけであり、計算結果は完全に既存エンジンに従う。
  Unit Test（`buildSquadDiagnosisInput: buildSquad実データとの統合`）で、`buildSquad` 経由で得た選手の `speed`
  の `finalValue` が、同じ入力で直接 `calculateBuild` を呼んだ場合と**完全に一致する**ことを確認済み
  （診断のために計算をやり直していないことの証明）。
- **監督補正**: `SquadComputed.manager.applied` をそのまま `managerApplied` として保持するのみ（計算は既存の
  `calculate-manager-booster.ts` に委譲・無編集）。

---

## 5. 総合評価（採用した計算）

初期版では「主要評価の平均」を採用し、実験的な複雑重みは追加していない。

```
総合評価 = 8つの能力カテゴリのうち score が null でないものの単純平均（Math.round）
         = 判定対象外（0件）の場合は null（「判定対象外」を表示・0点で代用しない）
```

「選手配置の充足状況」は総合評価の平均には含めない（能力の評価と構造上の評価は性質が異なるため、
混ぜて1つの数値にすると「なぜこの点数か」の説明が難しくなるという判断）。データ充足率（`dataQuality.coveragePercent`）
は総合評価とは別軸の指標として常に個別表示する。

---

## 6. 長所・弱点・改善候補

- **長所**（最大3件）: 8カテゴリのうちランクS・Aのものを、スコア降順（同点はカテゴリID昇順で安定ソート）で
  最大3件抽出。
- **弱点**（最大3件）: 優先度順に、(1) 削除済み保存ビルド参照などの「参照エラー」→ (2) GK不適性の可能性 →
  (3) ランクD・Cの能力カテゴリ → (4) 選手配置の充足状況が70点未満、の順で抽出。**能力上の弱点
  （kind: "ability"）とデータ不足・参照エラー・配置適性の問題（kind: "compatibility"/"referenceError"/"config"）を
  型で明確に分離**しており、UI上もバッジで区別する（データ不足を「弱い」と断定する表現は使っていない）。
- **改善候補**（最大3件）: 優先度順に、(1) 削除済み参照の修正案内 → (2) 保存ビルド未設定の案内 →
  (3) 配置適性の見直し案内 → (4) 先発の空き枠案内 → (5) ベンチ入れ替え候補
  （対象カテゴリの評価が最も低い先発と、そのカテゴリで
  `BENCH_SWAP_IMPROVEMENT_THRESHOLD`（5点）以上高いベンチ選手がいる場合のみ提案）。
  いずれも「提案」の文字列を返すだけで、自動適用・自動交代・自動配置は一切行わない
  （実装にも `apply` のような実行系フィールドは存在しない。Unit Testで確認済み）。

---

## 7. 根拠表示

各カテゴリの `evidence`（配列）に、次を保持する:
- 対象選手数
- 使用した能力（`statLabelJa` で日本語表示）
- 採用理由（§2の出典）
- 平均値・最高値/最低値（選手名付き）

「選手配置の充足状況」の `evidence` には、先発配置数・ベンチ人数・適性未確認件数・不適性件数・適用した減点重みを表示する。
内部実装のファイルパスや機密情報（SQLパス等）は一切含めていない。

---

## 8. 無料版・Pro版へ分離しやすい出力構造

- `SquadDiagnosisResult`（詳細・全件）と `SquadDiagnosisResult.basicSummary`（無料版候補: 総合評価・
  攻撃/守備/空中戦の3カテゴリ・長所1件・弱点1件・データ充足率・免責文言）を**コード構造上分離**した
  （`basicSummary` は `diagnoseSquad()` が返す1フィールドであり、詳細情報を持たない独立した最小データ）。
- `FREE_TIER_CATEGORY_IDS = ["attack", "defense", "aerial"]` を単一の真実源として、各カテゴリに
  `visibility: "free" | "pro"` を付与。
- **今回は認証・会員判定・課金壁を実装していない**。開発用として全診断結果（`categories` 全件・
  `strengths`/`weaknesses`/`suggestions` 全件）を常に画面表示する。
- `isPro` フラグ・localStorageでの権限判定・クエリパラメーターでのPro解除は一切実装していない
  （Unit Testで `JSON.stringify(結果)` に `isPro`/`authenticated`/`premium`/`paid` 相当の文字列が
  含まれないことを確認済み）。

---

## 9. UI（`SquadDiagnosisPanel.tsx`）

- 保存スカッド編集ページ（`SquadEditor.tsx`）の「サマリー」タブ内、`TeamSummaryPanel` の直後に配置
  （新規ページは作らず、既存タブへ統合）。
- 総合評価（大きな数値＋ランクバッジ）・データ充足率・8カテゴリのスコア一覧・長所/弱点（最大3件・kindで
  バッジ区別）・改善候補（最大3件）・詳細な根拠（`<details>` で折りたたみ・カテゴリごとに `evidence` を表示）。
- 免責文言（`DIAGNOSIS_DISCLAIMER`）を `role="status" aria-live="polite"` で常時表示。
- スカッド情報が読み込めない場合は `role="alert"` で通知（自動リトライ・自動フォールバックはしない）。
- 既存の `Badge`/`details` パターンを再利用（新規UIプリミティブは追加していない）。
- 表示は `useMemo` による派生計算のみで、**表示しただけでは `updatedAt` を含むいかなる保存データも変更しない**
  （新しい `setState`/書き込み処理を追加していない）。

---

## 10. storageイベント

診断は `computed`（`useMemo`。依存: `squad`/`managerContext`/`managerDetail`/`savedBuildsByCard` 等）から
再計算される既存の仕組みにそのまま乗っているため、**新しい pub-sub 基盤は追加していない**。
`SquadEditor.tsx` の既存の別タブ更新通知（`SQUAD_STORAGE_KEY`/`BUILD_STORAGE_KEY` 監視・手動再読込導線）は
無編集のまま維持されており、診断結果もその再取得のタイミングで自動的に再計算される（診断専用の追加購読は
不要と判断し、実装していない）。My Team ストレージは診断入力として使用していないため、監視対象にも含めていない。

---

## 11. テスト結果

### Unit Test（新規 `src/lib/squad/squad-diagnosis.test.ts`・55件）
決定性（3）／空・不足状態（11）／項目別評価（10）／役割の区別（3）／長所・弱点（5）／改善候補（6）／
総合評価（3）／無料・詳細分離（3）／非変更・純関数（2）／`calculateDataCoverage`（1）／
`buildSquadDiagnosisInput` と `buildSquad` 実データの統合（4・削除済み参照・別カードビルド不使用・非変更を含む）。

既存テストは無編集（計算エンジン・スカッド関連ロジックへ一切手を加えていないため）。

### `npm run verify`
| 検査 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1・stale 0・未許可 0） |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`） |
| `npm run test`（vitest run） | **1136 / 1136 PASS**（53 テストファイル。直前ベースライン1081から+55） |

### `npm run build`
PASS（全26ルート。`/squads/[squadId]` 34.3kB → 40.2kB（診断UI追加分）。他ルートは前回と同一）。

### 全13ブラックボックス（`next start` 上・最終実行・合計 **710 / 710 PASS**）
| レール | 件数 | 前回比 |
|---|---|---|
| boosters | 54 | 0 |
| progression | 99 | 0 |
| compare | 74 | 0 |
| my-builds | 98 | 0 |
| squads | **50** | **+4**（診断機能追加後の回帰確認＋今回固有の禁止事項の非表示確認） |
| world-ui | 82 | 0 |
| favorites | 33 | 0 |
| ui | 69 | 0 |
| managers | 41 | 0 |
| manager-picker | 35 | 0 |
| phase-b5 | 23 | 0 |
| phase-c | 17 | 0 |
| world-sync | 35 | 0 |
| **合計** | **710** | **+4** |

`black-box-squads.mjs` への追加項目（新しい14番目のレールは作らず既存レールへ統合）:
- 診断機能追加後もシェルの回帰なし（11枠・読み込み中の表示を維持）
- 全国順位・上位率・勝率予測を表示しない
- 課金・会員・Pro判定の仮実装を表示しない
- （参照）状態別の診断ロジックは vitest（`squad-diagnosis.test.ts`）で検証済みである旨を明記

`SquadDiagnosisPanel` はスカッドデータの localStorage 読み込み後にクライアント側で描画されるため、
既存の「保存ビルドを選ぶパネル」等と同様に **SSR シェルには出ない**（`black-box-squads.mjs` 冒頭のコメントで
明記されている既存方針と同じ扱い）。動的な選択・スコア計算・状態別診断は上記 Unit Test で決定的に検証した。

開発中に一度だけ検出した dev モード固有の既知差（`black-box-squads.mjs`「比較 不正パラメーター」・
`quality-gates.md` §5 に記載済みの RSC flight ペイロード差異）は、本番ビルド（`next start`）では
再現せず、最終判定は本番ビルドの結果（PASS）を採用した。本マイルストーンのコードに起因するものではない。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべて一致。書き込み0。

### Critical / Warning
Critical **0** / Warning **0**。

---

## 12. サーバー状態（Node PID・停止/起動コマンド・最終）

| 局面 | PID / コマンド |
|---|---|
| 開始時 | `next dev` 親 8872（生存）/ リスナー 34000（8872 の子）/ `server.pid`=8872 一致 |
| 最終ゲート: dev停止 | `Stop-Process -Id 34000 -Force` → `Stop-Process -Id 8872 -Force`（ポート3000解放確認） |
| `server.pid` → `0` | 更新（ASCII・改行なし） |
| build（最終） | `npm run build` PASS |
| start（最終） | npmラッパー **30968**（cmd.exe）/ `next start` リスナー **39160** → 全13ブラックボックス
  710/710 PASS・SQLite ok → `Stop-Process -Id 39160 -Force` → `Stop-Process -Id 30968 -Force` |
| dev再起動（最終・現在稼働中） | npmラッパー **1004** / `next dev` 親 **28244** / リスナー **23012**（28244 の子） |
| `server.pid`（最終） | `28244`（ASCII・改行なし・再読込で一致確認） |
| dev再確認 | `/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/squads/sq_blackbox0001`
  `/players/world/89138556575063` `/api/managers` すべて200 |
| `./data/dev-err.log`（最終） | 0バイト（クリーン） |

同一PCの他プロジェクトのNodeプロセスには一切触れていない。停止は上記の確認済み単一数値PIDのみに対して実施。

---

## 13. 発生した問題と修正

1. **Unit Testの1件のテストバグ**（実装バグではない）: 「データ充足率」テストで先発配列を単純に
   `slice(0, 6)` していたため `totalStartingSlots` 自体が6になり意図した検証にならなかった。
   11枠を維持したまま5枠を「未解決」にする形へ修正（エンジン側の変更なし）。
2. **ベンチの未解決 worldCardId が診断入力から欠落する可能性**: `buildSquad()` はベンチの未解決エントリを
   結果配列から除外する既存仕様のため、`buildSquadDiagnosisInput()` で元の `StoredSquad.substitutes` と
   突き合わせて「未解決」として補う対応を実装時に追加した（0件として消さないための措置）。

ゲート本体（verify / build / 全13ブラックボックス / SQLite）のFAILは、上記1（テストコード側のバグで
実装バグではない）を除き0件。

---

## 14. 未解決問題

技術的な保留事項は0件。次回以降の判断材料:

1. `SquadPlayerDisplay` に `height`/`preferredFoot` を追加すれば空中戦・利き足関連の評価をさらに拡張できるが、
   今回はスコープを絞るため見送った（§2参照）。
2. 「同じカードの別保存ビルドが改善につながる場合の確認導線」は、複数ビルドの再計算コストを考慮し
   未実装（§2参照）。将来のPro版候補として検討可能。
3. 無料版/Pro版の実際の権限分岐（認証・課金）は今回のスコープ外。`basicSummary`/`categories` の構造分離は
   完了しているため、次のマイルストーンで権限判定層を追加する形が想定される。

---

## 15. 人間の目視確認項目（推奨）

- 実ブラウザーで `/squads/{既存の保存スカッドID}` を開き、「サマリー」タブ内に「スカッド診断
  （スカッド構成評価）」が表示され、総合評価・ランク・データ充足率・8カテゴリのスコアが読めることを確認する。
- 先発が空の新規スカッドで開き、「判定対象外」が0点ではなく明示的に表示されることを確認する。
- 保存ビルド未設定の選手がいるスカッドで、「保存ビルドの設定」改善候補が表示されることを確認する。
- 削除済みの保存ビルドを参照している枠がある場合、「参照エラー」バッジ付きの弱点と改善候補が表示されることを確認する。
- 「根拠を見る」「項目別の詳細な根拠を見る」の `<details>` がキーボード（Tab/Enter）で開閉できることを確認する。
- 375px・430px・768px・1024px・1280px・1440px・1920px の各幅で、カード一覧・長所/弱点の2カラムが横スクロールなく
  表示されることを確認する。
- スクリーンリーダーで、総合評価・カテゴリ名・ランク・データ充足率が正しく読み上げられることを確認する。

---

## 16. 作成・編集・削除ファイル

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/lib/squad/squad-diagnosis.ts` | 診断エンジン本体（純関数）。型・定数・`diagnoseSquad`/`scoreSquadCategory`/
  `calculateDataCoverage`/`determineDiagnosisGrade`/`suggestSquadImprovements`/`buildSquadDiagnosisInput` 等。 |
| `src/lib/squad/squad-diagnosis.test.ts` | Unit Test 55件 |
| `src/components/squad/SquadDiagnosisPanel.tsx` | 診断結果の表示（読み取り専用） |
| `docs/milestones/2026-09-06-squad-diagnosis-foundation.md` | 本報告 |

### 編集
| ファイル | 変更概要 |
|---|---|
| `src/components/squad/SquadEditor.tsx` | `diagnoseSquad`/`buildSquadDiagnosisInput` の import・`diagnosis`
  の `useMemo` 追加・`SquadDiagnosisPanel` を `TeamSummaryPanel` の直後に配置。既存の計算・保存処理は無編集。 |
| `scripts/black-box-squads.mjs` | 診断機能追加後の回帰確認・禁止事項の非表示確認を追加（既存レールへ統合）。 |
| `docs/progress.md` | 本マイルストーンの記録を追加 |
| `docs/project-baseline.md` | unit数・ブラックボックス数・直前マイルストーン名・サーバーPIDを更新 |
| `docs/milestones/README.md` | 一覧に本報告を追加 |

### 削除
なし。計算エンジン（`calculateBuild`/`buildSquad`/`resolveAllocation`/`calculate-manager-booster.ts`/
`position.ts`/`build-inventory.ts` 等）は**一切変更していない**。
