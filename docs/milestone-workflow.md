# マイルストーン実行手順（Milestone Workflow）

最終更新: 2026-09-01

各マイルストーンの実行・中断・再開・報告の**単一の真実源**。
`development-safety-policy.md`（安全規則）と `quality-gates.md`（品質ゲート）と併せて適用する。

## 1. マイルストーン開始時（新セッション含む）

必ず最初に**読み取り専用**で次を行う:

1. 必須文書を読む:
   - [`../CLAUDE.md`](../CLAUDE.md)
   - [`development-safety-policy.md`](development-safety-policy.md)
   - [`quality-gates.md`](quality-gates.md)
   - [`project-baseline.md`](project-baseline.md)
   - [`progress.md`](progress.md)
   - 対象機能の設計文書（例: [`my-builds.md`](my-builds.md) / `phase-squad.md` / `phase-comparison.md` など）
   - 直前のマイルストーン報告（`milestones/YYYY-MM-DD-*.md` があればそれ、なければ `progress.md` の該当節）
   - 進行中の場合は `milestones/in-progress/` の中断・再開文書
2. 正本ワークスペース（`C:\Development\eFootball-Team-AI`）で作業していることを確認する。
   旧 OneDrive プロジェクトでないことを確認する。
3. サーバー状態を読み取り専用で確認する（`./data/server.pid` / PID 生存 / コマンドライン /
   正本ワークスペース所属 / ポート 3000 リスナー / 親子関係 / `http://localhost:3000` / `./data/dev-err.log` /
   World 選手 API / by-ids API / managers API）。
4. 直前の品質結果（`project-baseline.md` の値）を確認する。
5. 変更途中のファイル（`git` 未使用なので、`milestones/in-progress/` の記録と実ファイルの差分）を確認する。
6. 引き継ぎ内容と実状態が**一致するか**確認する。一致しなければ実装へ進まず停止して報告する。
7. 一致した場合だけ、今回の単独マイルストーンへ進む。

**新セッションだからといって既存実装を重複実装しない。** `project-baseline.md` の「実装済みの主要機能」を確認する。

## 2. 実装

- `development-safety-policy.md` §6（既存 API・型の確認）§7（更新直前の整合性検証）§8（storage イベント）を適用。
- 純関数へ分離できるロジックは分離してテスト対象にする。UI へ整合性検証を過剰に直接記述しない。
- 既存の純関数・ストレージ API を再利用する。コピー＆ペーストで重複実装しない。
- 実装中の品質確認は `quality-gates.md` §1（関連 unit test のみ）に従う。

## 3. 最終品質ゲート

`quality-gates.md` §2 の 20 手順を実行する。
Markdown だけの変更でコードに差分がない場合は `quality-gates.md` §8（ベースライン継承）を適用できる。

## 4. 完了報告（二層構造）

情報を失わず使用量を抑えるため、報告は次の 2 層にする。

### 4-1. チャットへ必ず表示する重要サマリー（短い）

- 総合判定（完了 / 条件付き完了 / 未完了）
- 完成した機能
- 採用した設計（要点）
- Critical 件数 / Warning 件数
- audit:ja-labels 結果 / verify 結果 / unit test 件数 / build 結果 / 全13ブラックボックス結果 /
  SQLite `integrity_check`
- 保存スキーマ変更の有無 / SQLite 変更の有無 / localStorage 全消去の有無 / 実ユーザーデータ変更の有無 /
  新規依存の有無
- 作成ファイル / 編集ファイル / 削除ファイル
- サーバー状態 / `server.pid` / `dev-err.log`
- 未解決問題
- 人間の目視確認項目
- **詳細報告の保存先**（`milestones/YYYY-MM-DD-<feature>.md` へのパス）

### 4-2. 詳細報告文書（`docs/milestones/YYYY-MM-DD-<feature-name>.md`）

これまでの厳格な完了報告と**同等の情報**を残す:

- フィールド単位の変更（例: `selectedBuildId` のみ変更・`favoriteBuildId` 不変…）
- 変更されなかったデータ（明示）
- テスト結果（追加テストの内訳・件数）
- ブラックボックス レール別件数
- Node 停止した PID と正確なコマンド / 起動親 PID / リスナー PID / 親子関係
- サーバー状態 / SQLite 結果 / localStorage 結果
- スキーマ変更の有無
- 作成・編集・削除ファイル一覧
- 発生したバグと修正
- 未解決問題
- 人間の目視確認項目
- 次に推奨する単独マイルストーン

チャット報告を短くしても、詳細情報を捨てない。詳細は必ず正式文書へ完全保存する。

> 既存の `docs/progress.md`（日付順の 1〜2 行サマリー）と `docs/*.md`（機能別設計）は維持する。
> `milestones/` は「マイルストーンごとの完了報告アーカイブ」で、`progress.md` から必要に応じてリンクする。

## 5. 使用量不足時の安全な中断

Claude Code の使用量上限が近い、または作業継続が困難な場合、
**品質確認を省略して完成扱いにしない。** 次を行う:

1. 新しい変更を開始しない。
2. 実行中のコマンドを安全な区切りまで待つ（強制中断しない）。
3. 現在の変更ファイルを確認する。
4. 実装済み範囲を確認する。
5. 実行済みテストを確認する。
6. 未実施の品質ゲートを確認する。
7. 動作中サーバーと `./data/server.pid` を確認する。
8. 未完了状態を `docs/milestones/in-progress/<feature>.md` へ保存する（下記テンプレート）。
9. 再開手順を同じ文書へ保存する。
10. 総合判定を「条件付き完了」または「未完了」にする。
11. 変更を勝手に巻き戻さない。
12. 未検証の変更を完成扱いにしない。
13. 次セッション向けの最小引き継ぎ（このファイルへのパス＋一行要約）を作る。
14. 安全に停止する。

### 中断・再開文書テンプレート（`docs/milestones/in-progress/<feature>.md`）

```markdown
# 中断: <feature-name>

- 中断日時: YYYY-MM-DD
- 総合判定: 未完了 / 条件付き完了
- マイルストーンの目的: （1〜2行）

## 実装済み
- 変更ファイル:
  - ./src/... （何をしたか）
- 追加した純関数 / 型:
- 追加したテスト（件数）:

## 未実装 / 残作業
- （箇条書き）

## 実行済みの品質確認
- typecheck: PASS / 未実行
- 関連 unit test: PASS（N 件）/ 未実行
- npm run verify: 未実行
- npm run build: 未実行
- 全13ブラックボックス: 未実行
- SQLite integrity_check: 未実行

## サーバー状態
- server.pid: <値>（生存 / stale）
- next dev 親 PID / リスナー PID / 親子関係:
- dev-err.log: N 行

## 保護状態（この時点で確認済み）
- SavedBuild / MyTeamRecord / StoredSquad スキーマ変更: 0
- SQLite 変更: 0 / localStorage 全消去: 0 / 実ユーザーデータ変更: 0
- 新規 npm 依存: 0 / 外部アクセス: 0 / ファイル削除: 0

## 再開手順（次セッション）
1. CLAUDE.md / development-safety-policy.md / quality-gates.md / project-baseline.md / progress.md /
   この文書 / 対象機能設計文書 を読む
2. 正本ワークスペース確認・サーバー状態を読み取り専用で確認
3. 「実装済み」の変更ファイルが実在し内容が一致するか確認 → 不一致なら停止して報告
4. 「未実装 / 残作業」だけを実装（既存実装を重複実装しない）
5. quality-gates.md §2 の最終品質ゲートをすべて実行
6. 完了報告（二層）→ この文書を milestones/ へ移動 or 完了印

## 次に推奨する単独マイルストーン（完了後）
```

## 6. 今後のマイルストーン用プロンプト標準構造

今後のプロンプトは、共通安全規則・共通品質ゲートを**正式文書参照**で済ませ、
今回固有の要件だけを詳細に指示する。標準構造:

1. 今回の単独マイルストーン
2. 目的
3. 完成目標
4. **今回固有の変更禁止事項**（機能固有の危険領域は正式文書参照だけで済ませず毎回明記する）
5. 最初に確認する既存実装
6. 更新直前の整合性検証（今回対象に固有の再検証項目）
7. UI・アクセシビリティ（今回固有）
8. テスト（今回追加するテスト）
9. 今回固有の重大停止条件
10. 完了条件
11. 完了報告（二層・詳細は `milestones/` へ）
12. 実行方針

### 短縮プロンプトのひな型

> 最初に `CLAUDE.md`、`docs/development-safety-policy.md`、`docs/quality-gates.md`、`docs/project-baseline.md`、
> `docs/progress.md`、`docs/<対象機能>.md` を読み、記載のルールをすべて適用してください。
> 今回の単独マイルストーンだけを実装し、次の機能へ進まないでください。
> 共通ルールを弱めず、今回固有の禁止事項を追加適用してください:
> **今回は `<スキーマ名>` だけを触る / My Team を変更しない / スカッドを変更しない / SQLite を書き換えない /
> 新規 localStorage キーを作らない**（← 機能に応じて具体化）。
> 既存コード・型・API を正とし、存在しない仕様を推測しないでください。
> 実装中は関連 unit test を使い、最後に `docs/quality-gates.md` §2 の最終品質ゲートをすべて実行してください。
> 同じ検査を理由なく重複実行しないでください。ただし最終品質ゲートは省略しないでください。
> 使用量不足時は品質確認を省略せず、未完了として `docs/milestones/in-progress/` へ記録し安全に中断してください。
> 完了後は `next dev` を正常稼働状態へ戻し、詳細報告を `docs/milestones/YYYY-MM-DD-<feature>.md` へ保存し、
> チャットへ重要サマリーを報告して停止してください。
>
> ＜ここから今回固有の要件（目的・完成目標・変更禁止・整合性検証・テスト・停止条件・完了条件）＞

## 7. 重複実行を減らす対象 / 減らさない確認

### 減らしてよい（使用量削減）

- `npm run verify` 成功後の `typecheck` / `lint` / 全 unit test / `audit:ja-labels` の理由なき個別再実行
- 実装中の全13ブラックボックス反復・`npm run build` 反復
- dev モード固有の既知差（`quality-gates.md` §5）に対する同じ調査の反復
- 既に文書化された不変の安全規則のプロンプト全文再掲
- 既にベースライン文書へ記録済みの内容の全文再報告
- 同じファイル構造の理由なき再列挙
- 同じ完了結果の複数形式での重複説明
- Markdown だけの変更での全回帰（`quality-gates.md` §8）

### 減らさない（安全・精度・必須ゲート）

- 更新直前の整合性再検証・保存対象の再取得・`worldCardId` 一致確認・`buildId` 存在確認
- 対象スカッド／対象枠／対象レコードの確認
- Node の PID／生存／コマンドライン／ポート／親子関係の確認
- 最終 `npm run verify` / 最終 `npm run build` / 最終 全13ブラックボックス / SQLite `integrity_check`
- 実ユーザーデータ非変更の確認・dev サーバー復旧確認・未解決問題確認・人間の目視確認項目

## 8. セッション切り替え

マイルストーン完了後、新しい Claude Code セッションへ切り替えられる。新セッションは §1 の手順を実行する。
`docs/milestones/YYYY-MM-DD-<feature>.md`（直前の詳細報告）と `project-baseline.md` を突き合わせて
実状態と一致することを確認してから次へ進む。一致しなければ停止して報告する。

## 参照

- 開発安全規則: [`development-safety-policy.md`](development-safety-policy.md)
- 品質ゲート: [`quality-gates.md`](quality-gates.md)
- 現在のベースライン: [`project-baseline.md`](project-baseline.md)
- 進捗ログ: [`progress.md`](progress.md)
- マイルストーン詳細報告アーカイブ: [`milestones/`](milestones/)
