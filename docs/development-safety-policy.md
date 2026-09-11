# 開発安全規則（Development Safety Policy）

最終更新: 2026-09-01

この文書は、**毎回のプロンプトへ再掲していた共通安全規則の単一の真実源**です。
今後のマイルストーンは「最初に `CLAUDE.md` とこの文書と `quality-gates.md` と `project-baseline.md` を読み、
記載のルールをすべて適用する」ことを前提にします。

**この文書はルールの短縮版ではありません。** チャットで複製していた規則を正式リポジトリへ整理したものです。
ここに書かれた安全規則・整合性検証・データ保護は、使用量削減を理由に一切削除・弱体化しません。

## 0. 優先順位（文書間でルールが競合したとき）

1. ユーザーがそのプロンプトで明示した安全条件
2. `CLAUDE.md` の絶対安全規則
3. この開発安全規則
4. そのマイルストーン固有の重大停止条件
5. `quality-gates.md` の品質ゲート
6. マイルストーン要件（完成目標）
7. ドキュメント・報告形式
8. 使用量最適化

使用量削減を理由に、上位（1〜6）の安全規則・品質ゲート・機能要件を弱めない。
迷ったら安全性とデータ保護を優先する。曖昧なら推測せず停止する。

---

## 1. ワークスペース

- **正本ワークスペース = `C:\Development\eFootball-Team-AI`**（OneDrive 同期対象外）。
  すべての調査・実装・テスト・ビルド・サーバー起動・文書更新はここだけで行う。
- 旧 `C:\Users\akihi\OneDrive\デスクトップ\eFootball-Team-AI` は**バックアップ**。
  開く・検索・読み取る・編集する・コピーを戻す・差分を統合する・削除・移動・改名・`server.pid` 変更・
  Node プロセス起動・メモリーへ内容記録を**一切行わない**。
- ファイル操作（Read / Edit / Write / Glob / Grep）は**正本ワークスペース基準の相対パス**（`./…`）だけ。
  絶対パス・ドライブ文字・`C:`・`OneDrive`（表記ゆれ含む）・`../`・`cd ..`・`Set-Location`・
  `Push-Location`・UNC・`file://`・`%USERPROFILE%`・`$HOME` によるワークスペース外アクセスは禁止。
- Node プロセスのコマンドライン確認で正本ワークスペースの絶対パスが表示されるのは許可。
  ただしファイル操作へ絶対パスを使わない。
- 禁止パスを一度でもファイル操作へ使用しようとした場合は、**修正して継続せず直ちに停止**する。
- ツールが絶対パスを要求する環境では、`C:\Development\eFootball-Team-AI\…` 配下だけを指し、
  それ以外（旧 OneDrive プロジェクト・他プロジェクト・他ドライブ）は絶対に指さない。

## 2. ファイル

- ユーザーファイル削除禁止・予定外のファイル削除禁止・再帰削除禁止・ワイルドカード削除禁止。
- **10 項目以上**を削除する可能性がある操作は実行せず停止して報告する（`safe-build-and-cache-policy.md` §5）。
- 除外ファイル（`./千鳥 打合せメモ　20260829.txt` `./claude-master-prompt.txt` `./research.txt` `./screenshots/`）を
  開く・検索・編集・削除・メモリーへ記録しない。
- `node_modules` の理由なき削除禁止。
- `.next` の手動編集・`.next` 内チャンク／`route.js` の手作業修復・理由のない `.next` 削除・キャッシュ削除・
  `npm cache clean` は禁止（詳細と例外は `safe-build-and-cache-policy.md`）。
- 既存文書を新規文書へ「置き換えて削除」しない。既存を維持し索引・相互リンクで整理する。
- 「ファイルの完全な置換」「フォルダの初期化」「lock ファイルの削除」「既存コードの全面的な書き換え」は
  破壊的操作として扱い、ユーザーの明示承認なしに行わない（`CLAUDE.md` 削除に関する制限）。

## 3. データ保護（実ユーザーデータ・ストレージ）

- **SQLite（`./data/efootball.db`）は読み取り専用**。書き込み 0。スキーマ変更は重大停止条件。
- `localStorage` の全消去禁止。ストレージ（build-storage / My Team / スカッド / お気に入り / 比較状態）の
  初期化禁止。
- テストで**実ユーザーの保存ビルド・My Team・スカッド・カードお気に入り・localStorage を変更しない**。
  テストは**インメモリストレージ**（`installMemoryStorage()` 等）または**HTTP GET 中心のブラックボックス**。
  テスト専用の `worldCardId` / `buildId` / データを使う。
- 破損データを自動削除しない。不明値を `0` や空値へ変換して保存しない。
- **自動データ移行しない・自動修復しない・自動フォールバックしない**（削除済み参照を別ビルドへ付け替えない、
  `null` へ勝手に書き換えない、先頭要素へ自動設定しない）。
- 架空データを生成しない。

## 4. 保存互換性（スキーマ・形式）

次を**変更しない**（変更が必要になったら重大停止条件）:

- `SavedBuild` スキーマ（`src/lib/progression/types.ts` / `build-storage.ts` の `savedBuildSchema`）
- `MyTeamRecord` スキーマ（`src/lib/user-cards/types.ts` / `my-team-storage.ts` の `myTeamRecordSchema`）
- `StoredSquad` / `StoredSlot` / `StoredSub` スキーマ（`src/lib/squad/types.ts` / `squad-storage.ts` の `squadSchema`）
- `storageVersion`（`favorites-storage/…` `my-team-storage/…` `squad-positioning/…` 等）
- `rulesVersion`（`progression/2026-08-28.v2` / `progression/2026-08-28.provisional-1` / 誤日付 `…2026-08-29.v2`）
- localStorage キー（`efootball-team-ai:progression-builds:v1` / `:favorites:v1` / `:my-team:v1` / `efb:squads:v1` /
  `efootball-team-ai:squad-templates:v1` / `efb:compare-ids:v1` 等）
- URL パラメーター形式（比較 `ids` / `b` / `m` / `tp` / `al`・`allocation-url` のシリアライズ／パース）
- `worldCardId` は**文字列**として扱う（`Number` / `parseInt` / 浮動小数変換をしない・数字1〜20桁）
- `buildId` は既存形式 `/^[A-Za-z0-9_-]{1,64}$/` を維持
- `squadId` `/^sq_[A-Za-z0-9]{6,32}$/`・`slotId` `/^[a-z0-9_-]{1,32}$/`・`subId` `/^sub_[A-Za-z0-9]{4,32}$/`

新しい localStorage キー・新しい索引ストレージ・棚卸し/集計結果の永続保存を作らない。

## 5. 計算・確認状態

次を**変更しない**（計算結果・ラベルを前後で一致させる）:

- `calculateBuild` / `buildComparison` / `group-allocation` / `auto-allocate` / `stat-groups` /
  `ability-radar` の計算 / booster 計算 / manager 計算
- `allocation-url` / 比較 URL のシリアライズ・パース
- 一致させる: 26 能力値 / `progressionDelta` / 使用ポイント / 残りポイント / 段階コスト /
  fixed booster / fixed 型推定 / Power of Many / 監督補正 /
  `standardFinalValue` / `conditionalFinalValue` / `experimentalFinalValue` / レーダー値 / 比較順位 /
  保存ビルド適用結果 / スカッド集計

確認されていない計算規則を追加しない。既存の確認状態（`confirmed` / `provisional` / `unresolved`）を
確定値として扱わない。

**Power of Many**: ユーザー未指定を「最大値」として扱わない。最大段階を自動推測しない。
fixed booster として扱わない。別カードの指定を流用しない。既存 `describeBuildPoM` を使う。

**ポジション別 OVR**: `confirmed_formula` は**なし**。実装しない。
表示は「総合値（ポジション別 OVR）: —（計算規則を確認中）」を維持。
`SavedBuild.calculatedOvr` を表示する場合は「保存時の推定OVR」ラベルのみ。欠損は「—」（0 表示しない）。
禁止: `calculatedOvr` をポジション別 OVR へ転用・レーダー平均や能力値合計や参照数から算出・
暫定 `POSITION_WEIGHTS` 使用・shape-only 推定流用・スクリーンショット値の登録。**架空 OVR は 0 件を維持**。

## 6. 既存 API・型の確認

- 実装前に、実際に存在するコード・型・API・表示・保存形式を確認して正とする。
- **存在しない関数・型・enum・ステータス値を推測で追加しない。**
- 既存の安全なストレージ API を再利用する（`updateMyTeamRecord` / `addToMyTeam` / `getMyTeamRecord` /
  `getMyTeamByWorldId` / `saveBuild` / `getBuild` / `listBuilds` / `listAllBuilds` / `getSquad` / `saveSquad` /
  `listSquads` 等）。UI コンポーネント側で localStorage へ直接書き込まない。
- 既存の純関数（`my-builds.ts` / `build-inventory.ts` の各関数・`findSquadUsageByWorldCardId` 等）を
  可能な限り再利用する。同じ整合性検証・使用状況計算をコピー＆ペーストで重複実装しない。
- 既存 API の公開形（シグネチャ・戻り値）を大きく変更しない。既存テストを壊さない。

## 7. 更新直前の整合性検証（削除・弱体化しない）

書き込み操作（`updateMyTeamRecord` / `addToMyTeam` / `saveSquad` 経由の `savedBuildId` 変更 等）の**確定直前**に、
表示開始時の状態を信用せず**再取得して検証**する:

- 対象レコード / スカッド / 枠が現在も存在するか（`getMyTeamRecord` / `getSquad` / slotId・subId 一致）
- `worldCardId` が表示開始時と一致するか（**文字列完全一致・Number 変換しない**）
- 参照する保存ビルドが現在も存在し `worldCardId` が一致するか（`getBuild`）
- `buildId` が既存形式か
- `localStorage` が利用可能か
- 既に同値なら再保存しない（`updatedAt` を無駄に更新しない）

競合検出時（別タブで削除・カード入れ替え・値変更）は**上書きせず**、`role="alert"` で通知し
「再読込してください」と案内する。

## 8. storage イベント（別タブ更新）

- `window` の `storage` イベントで**関係するキーのみ**（`BUILD_STORAGE_KEY` / `MY_TEAM_STORAGE_KEY` /
  `SQUAD_STORAGE_KEY` / `key == null`）を監視。無関係キーは無視。
- 別タブ更新時に通知＋**手動「再読込」ボタン**（`aria-live="polite"`）。
- 開いているダイアログ／パネルを勝手に閉じない・検索入力を消さない・フィルターを勝手に解除しない・
  操作対象を勝手に差し替えない。
- リスナーはアンマウント時に解除・毎描画で登録しない。
- 同一タブ更新は既存購読（`useMyTeam` の `useSyncExternalStore` 等）または操作後の明示的な安全な再取得で反映。
- 新しい pub-sub 基盤・新しい localStorage キーをイベント用途で作らない。

## 9. Node プロセス管理

停止前に必ず確認する（`safe-build-and-cache-policy.md` §7 と同一）:

- `./data/server.pid` の記録値（数値か）
- 記録 PID が生存しているか
- コマンドラインが `next dev` または `next start` か
- 正本ワークスペースに属するか（cmdline に `C:\Development\eFootball-Team-AI` を含む）
- ポート 3000 のリスナー PID
- リスナー PID が記録親 PID（またはその子孫）であること／親子関係

停止できるのは、**上記をすべて満たす確認済みの単一の数値 PID** だけ。

禁止:
- `Get-Process node | Stop-Process` / `Get-Process -Name node | Stop-Process -Force` / `taskkill /IM node.exe /F`
- Node 一括停止・`node.exe` 全体の停止
- PID 確認なしの停止・stale PID だけを根拠にした停止・無関係な Node プロセス停止
- プレースホルダー PID を完了報告に書く・停止失敗の隠蔽（`-ErrorAction SilentlyContinue` で隠す等）

`./data/server.pid`: 数字だけ・空でない・起動した**親 PID**・別プロセスに再利用されていない・
起動成功後に更新・起動失敗時に古い PID を残さない（サーバー不在は `0`）・停止失敗時に勝手に削除しない。
変更は `./data/server.pid` だけを必要最小限で。

## 10. `.next` と OneDrive／ビルド

`safe-build-and-cache-policy.md` の全条項を適用する。要点:

- **稼働中の `next dev` と `npm run build` を同時実行しない。** build 前に確認済み単一 next dev 親 PID を停止し、
  ポート 3000 解放を確認する。build と全回帰後に `npm run dev` で復旧する。
- 正本ワークスペースは OneDrive 外なので、正規コマンド（`npm run build` / `start` / `dev`）による `.next` 生成は許可。
  それでも `.next` の手動編集・チャンク手作業修復・`route.js` 直接編集・理由のない `.next` 削除・
  キャッシュ削除・`node_modules` 削除・自動再試行ループは禁止。
- build が**環境由来の一時エラー**と明確に判断できる場合だけ、**30 秒待機後に 1 回だけ**再試行できる。
  同じ原因で 2 回失敗したら停止。
- `readlink EINVAL` / `UNKNOWN read` / `Cannot find module './NNN.js'` 発生時の安全手順は
  `safe-build-and-cache-policy.md` §10。`.next` へ触れず、`.next` の「このデバイス上で常に保持する」は
  ユーザーの GUI 操作として案内する（Claude が自動実行しない・実行したと報告しない）。

## 11. 外部変更（依存・ネットワーク・デプロイ）

- 新規 npm 依存の無断追加禁止。グローバルインストール禁止。必要な場合もローカルのみ・ユーザー承認制。
- 新しい外部アクセス（fetch / API）の無断追加禁止。既存の内部 API（`/api/world/players/by-ids` 等）のみ使用。
  `eFHUB`（efhub.com）は robots.txt でブロック済み・回避しない。
- `npm ci` の依存取得ネットワークアクセスは、正本ワークスペース移行のような明示された作業の限定例外。
- SQLite スキーマ変更・保存スキーマ変更はそれぞれ重大停止条件。
- 認証・クラウド同期・決済はそれぞれ専用の単独マイルストーン。ユーザー承認なしに公開・デプロイしない。

## 12. 日本語表示・ラベル監査

- ユーザー向け表示は日本語を基本とする。能力値名・育成カテゴリ名・レーダー軸は既存日本語ラベル
  （`statLabelJa` / `groupLabelJa` / `buildModeLabelJa` 等）を再利用する。
- 英語能力値名・英語育成カテゴリ名を JSX の主表示へ追加しない（`{stat.nameEn}` 等の動的英語名も含む）。
- `npm run audit:ja-labels`（`dynamic-name-en-child` ルール含む）を通過させる。allowlist は `GroupRow.tsx` の
  1 エントリのみ。理由なく allowlist を増やさない。

## 13. マイルストーンの単独実行

- **1 回につき 1 マイルストーン。** 完了したら停止する。次の機能候補へ自動で進まない。
- 例外: プロンプトで「M1 が完全成功し、明示された進行条件をすべて満たした場合に限り M2 まで連続」と
  指示された場合のみ。少しでも未解決問題・仕様の曖昧さ・回帰・データ互換性の懸念・予定外の変更があれば
  次へ進まず停止する。時間を埋めるために次へ進まない。
- 完了後に着手しない範囲（プロンプトで都度指定される）: 例として 保存ビルドのエクスポート・インポート、
  My Team からの配分直接編集、`selectedBuildId` と `favoriteBuildId` の自動同期、スカッド自動適用、
  カードお気に入り変更、ポジション別 OVR、Power of Many 追加調査、未解決ブースター ID、PNG・TXT 出力、
  パック、Tier、ガチャ診断、AI 診断、認証、クラウド同期、コミュニティ。

## 14. 重大停止条件（共通・削除しない）

次のいずれかに該当したら**直ちに停止**して日本語で報告する:

- 元 OneDrive プロジェクトへアクセスする必要／正本ワークスペース外へアクセスする必要／禁止パスを使用しようとした
- ファイル削除・`node_modules` 削除・キャッシュ削除・再帰削除・10 項目以上の削除が必要
- 除外ファイルを開く必要／`.next` 変更が必要／生成チャンク・`route.js` の手動修復が必要
- SQLite 書き込み・SQLite スキーマ変更が必要
- 新しい localStorage キー・保存スキーマ変更（`SavedBuild` / `MyTeamRecord` / `StoredSquad` / `StoredSlot` / `StoredSub`）が必要
- 更新直前の整合性検証・別タブ競合検出・実ユーザーデータ保護・Node 安全管理・保存互換性を弱める必要
- `worldCardId` を `Number` へ変換する必要／表示のために既存データを保存し直す必要
- 一括削除・一括解除・一括適用・一括変換・自動修復・自動フォールバックが必要
- `confirmed_formula` なしでポジション別 OVR を表示する必要
- `calculateBuild` / `buildComparison` / Power of Many / 監督補正の結果が変わる
- 安全な既存登録／更新 API が存在しない／既存 API では有効なレコードを作れない／登録失敗時に破損レコードが残る
- 対象スカッド・対象枠・対象レコードを安定 ID で識別できない（配列 index だけで誤更新の可能性がある）
- 新規 npm 依存・新しい外部アクセスが必要／Node 一括停止が必要／対象 PID を確認できない
- 過去データ（保存ビルド／My Team／スカッド）互換性が壊れる
- 使用量削減のために未検証の変更を完成扱いにする必要
- 文書間の重大な矛盾を安全に解消できない／`ownership`・`usage` 等の正式値を確認できない
- 同じ原因の修正が 3 回失敗／主要機能が複数壊れた／Critical テストが残る
- 全13ブラックボックスのいずれかが失敗し、安全に原因を切り分けられない

停止時は、元プロジェクトと正本ワークスペースを削除・巻き戻しせず、現在状態を報告する。

---

## 参照

- 品質ゲート: [`quality-gates.md`](quality-gates.md)
- 現在のベースライン: [`project-baseline.md`](project-baseline.md)
- マイルストーン手順・中断/再開・報告構造: [`milestone-workflow.md`](milestone-workflow.md)
- ビルド・キャッシュ・`.next`・OneDrive: [`safe-build-and-cache-policy.md`](safe-build-and-cache-policy.md)
- プロジェクト最上位ルール: [`../CLAUDE.md`](../CLAUDE.md)
