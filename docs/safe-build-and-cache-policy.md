# 安全なビルド・キャッシュ・プロセス運用ポリシー

最終更新: 2026-09-01

> **正本ワークスペースは `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）へ移行済み**（2026-09-01）。
> 旧 `.../OneDrive/デスクトップ/eFootball-Team-AI` はバックアップ（不可触）。
> 移行後も本ポリシーは全条項が有効: `.next` の手動削除・キャッシュ削除・`npm cache clean`・
> `node_modules` 削除・再帰/ワイルドカード削除・10 項目以上の削除・Node 一括停止は引き続き禁止。
> `.next` / OneDrive の `readlink EINVAL` / `UNKNOWN read` / `Cannot find module './NNN.js'` 手順（§10）は
> 「稼働中の `next dev` と `npm run build` の同時実行」「build 直後の start/dev 失敗」の切り分けとして
> 引き続き適用する。関連: `./development-safety-policy.md` §10 / `./quality-gates.md` §2。
>
> 旧 OneDrive 環境での本ポリシーの発端（下記 §1 の 239 項目削除確認・§10 の EINVAL）は履歴として保持する。

このポリシーの発端となった旧環境: リポジトリが **OneDrive 同期対象フォルダ**
（`.../OneDrive/デスクトップ/eFootball-Team-AI`）に置かれており、ビルド生成物やキャッシュの一括削除が
OneDrive の「大量削除」検知を発動させ、ユーザーに不要な確認・復元操作を強いた。

## 1. 実際に起きた事象

- 過去の作業で `.next` を削除したところ、**Microsoft OneDrive が 239 項目の削除確認**を表示した。
- ユーザーは **「239 件のアイテムを保持する」** を選択した。
- ユーザーは **「すべてのアイテムを削除します」を選んでいない**。
- ユーザーは **大量削除確認を無効化していない**。
- この対応は **完了済み**。OneDrive のフォルダー・同期状態・ごみ箱・Web 画面を調査しない。同じ削除を再実行しない。

## 2. `.next` を通常作業で削除しない

禁止（ユーザーの明示承認がない限り）:

- `Remove-Item .next -Recurse -Force` / `rm -rf .next` / `rmdir /s /q .next`
- `.next` 配下のファイル一括削除・`.next/cache` 削除
- `npm cache clean` / `npm cache clean --force`
- ワイルドカード削除・再帰削除・親フォルダー単位の削除

キャッシュであっても、ユーザーの明示承認なしに削除しない。

## 3. 通常のビルド手順（`.next` を削除しない）

各コマンドを個別に実行する:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test`
4. 必要なら **確認済みの単一の親 PID だけ**を停止（次章）
5. `npm run build`（`.next` は残したまま）
6. ビルド成功を確認
7. dev サーバーを再起動
8. 起動した**親 PID** を `./data/server.pid` に記録
9. ポート 3000 のリスナー PID を確認（親 PID の子孫であること）
10. `http://localhost:3000` で画面確認

既存の `.next` のまま `npm run build` が成功した場合は、**正式な成功結果**として扱う。

## 4. ビルドが失敗したときの対応順

1. エラーメッセージ全文を読む。
2. コード側で修正できるか検討（型・import・構文・設定）。
3. **`.next` を削除して回避しない。**
4. `.next` 削除が必要だと判断した場合は **実行せず停止**し、次を報告:
   - エラー / 削除が必要な理由 / 対象の相対パス / 推定項目数 / 代替手段 / 削除しない場合の影響
5. ユーザーの明示承認を待つ。

## 5. その他の削除禁止

`node_modules` / `src` / `scripts` / `docs` / `data` / `public` / `screenshots` /
`package-lock.json` / localStorage / 保存スカッド / 保存ビルド / お気に入り / My Team /
比較状態 / `GroupRow.tsx` / 一時監査スクリプト / `stat-labels.ts` /
`scripts/lib/ja-label-audit.mjs` / `scripts/audit-ja-stat-labels.mjs` /
`src/lib/world/ja-label-audit.test.ts`。

- 削除対象件数が不明な操作は実行しない。
- **10 項目以上**を削除する可能性がある操作は実行せず停止して報告する。
- ディレクトリ再帰削除・ワイルドカード削除は実行しない。

## 6. OneDrive 大量削除確認が表示された場合

- 追加の削除操作を行わず **即時停止**して報告する。
- ダイアログでは **「すべてのアイテムを削除します」を選ばない**。
- **「◯◯件のアイテムを保持する」を選択**する。
- 大量削除確認（削除の通知）を **無効化しない**。
- OneDrive のごみ箱・Web 画面・同期設定を調査しない。

## 7. Node プロセス（親 PID と子ワーカー）

`next dev` / `next start` は **親プロセス**を起動し、実際にポート 3000 を
バインドするのは**その子ワーカー**であることがある（確認例: 親 PID が
`node .../next dev`、子 PID が `node .../next/dist/compiled/...` でポート保持）。

方針:

- `./data/server.pid` には **起動した親 PID** を記録する。
- ポート 3000 のリスナー PID を別途 `Get-NetTCPConnection -LocalPort 3000` で確認する。
- そのリスナー PID が **親 PID またはその子孫**であることを確認する。
- **無関係な Node プロセスを停止しない。**
- **PID を確認せずに停止しない。**
- 停止は必ず**実際の数値 PID** で行う: 例 `Stop-Process -Id 34788 -Force`
- `Stop-Process -Id <pid>` のようなプレースホルダーを完了報告に書かない。
- 実際に停止しなかった場合は「Node 停止なし」と報告する。
- `-ErrorAction SilentlyContinue` で停止失敗を隠さない。

禁止（一括停止）:

- `Get-Process node | Stop-Process`
- `Get-Process -Name node | Stop-Process -Force`
- `taskkill /IM node.exe /F`
- `node.exe` 全体の停止

停止してよいのは、次を**すべて**満たす単一 PID のみ:

1. `./data/server.pid` に記録されている（またはその子孫）
2. ポート 3000 のリスナー（またはその親）
3. eFootball Team AI のサーバーである

## 8. `./data/server.pid`

- **数字だけ**が保存されていること。空でないこと。
- 起動した**親 PID** を示すこと。別プロセスに再利用されていないこと。
- 起動成功後に更新すること。起動失敗時に古い PID を残さないこと。
- 停止失敗時に勝手に削除しないこと。
- 変更は `./data/server.pid` だけを必要最小限で行い、他の `data/` ファイルを変更しない。

## 9. 安全停止条件（このポリシー関連）

- `.next` 削除・キャッシュ削除・ディレクトリ再帰削除・10 項目以上の削除・ワイルドカード削除が必要になった
- OneDrive 大量削除確認が表示された
- ポート 3000 のリスナー PID を特定できない／親子関係を確認できない
- Node 一括停止以外に手段がないと判断した

いずれも **実行せず停止**し、日本語で状況を報告する。

## 10. OneDrive Files-On-Demand と `.next`（readlink EINVAL）

### 既知の環境事象（断定ではなく「相互作用が原因と考えられる」）

- `.next` 内の一部（`.next/types/*.d.ts`、`.next/server`、`.next/static`、`.next/cache` など）が
  **OneDrive のオンライン専用状態（ReparsePoint）** に切り替わることがある。
- その状態で Next.js が `readlink` に失敗し、`[Error: EINVAL: invalid argument, readlink
  '...\.next\types\routes.d.ts']`（`errno: -4071` / `syscall: 'readlink'`）で起動できないことがある。
- **`npm run build` は成功しても、その直後の `npm run dev` / `npm run start` が失敗する**ことがある
  （build がローカルに書いた `.next` を OneDrive が直後にクラウド化するため）。
- 待機している間に OneDrive が再ハイドレートし、次回の起動で成功することがある。
- **コード不具合ではなく環境要因**として切り分ける。build 成功と dev/start 成功を分けて評価する。

### この事象で禁止する対応

- `.next` の削除 / `.next` 内ファイルの書き直し / `.next` の移動・改名
- `.next` の属性変更・`attrib.exe`・PowerShell によるファイル属性変更・ReparsePoint 操作
- キャッシュ削除 / `npm cache clean` / `node_modules` 削除 / 再帰削除 / ワイルドカード削除
- OneDrive の設定変更・プロセス停止・同期の強制終了・自動ハイドレート処理
  （ファイルを順番に開いて強制ダウンロードする等）
- `npm run dev` の連打・自動再試行ループ
- Node 一括停止
- エラーの隠蔽（`|| true` / exit 0 強制 / stderr 破棄 / `-ErrorAction SilentlyContinue`）

**Claude Code は「このデバイス上で常に保持する」を自動実行しない。** 必要な場合は
ユーザーへ Windows Explorer 上での手動操作を案内するだけにする。

### EINVAL 発生時の安全手順

1. エラー内容を確認し、`EINVAL` かつ `syscall: 'readlink'` で対象が `.next` 配下か確認する。
2. `.next` へ一切変更を加えない。
3. ポート 3000 のリスナーと関連 Node プロセスを確認する（§7）。
4. **20〜30 秒待機**する。
5. **同じコマンドを 1 回だけ**再試行する。
6. 2 回目も同じ EINVAL なら、**追加操作を行わず停止**する。
7. エラー対象を**相対パス**で報告する（例: `./.next/types/routes.d.ts`）。
8. ユーザーへ次の GUI 操作を案内する（Claude Code 自身が行ったと報告しない）:
   1. Windows Explorer でプロジェクトフォルダーを開く
   2. `.next` フォルダーの OneDrive 状態（雲アイコン／緑チェック）を確認する
   3. 必要ならユーザー自身が `.next` を右クリック →「このデバイス上で常に保持する」を選ぶ
   4. ローカル保持を示す緑チェックになるのを待つ
   5. `npm run dev` を 1 回実行する

### stale な `./data/server.pid`

- `./data/server.pid` に PID があっても、そのプロセスが既に終了していることがある（再利用も含む）。
- 停止前に必ず §7 の全項目を再検証する。**server.pid だけを根拠に `Stop-Process` しない。**
- stale なら: そのままにせずポート 3000 を確認し、空いていれば新しいサーバーを起動して
  新しい親 PID を記録する。起動できない場合は数値のまま（サーバー不在を示す `0` 等）とし、
  完了報告で「stale」「動作中サーバーなし」と明記する。
- 起動失敗時に古い（生きている風の）PID を残さない。停止失敗時に勝手に削除しない。
