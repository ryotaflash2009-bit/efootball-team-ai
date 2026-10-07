# 古いブランチ・worktree の監査（2026-10-07・読み取りと安全な削除だけ）

## 削除した（main に完全に含まれる・`git branch -d`・未 merge の commit 0）

ローカル: feat/vercel-web-analytics・i18n/es-ptbr-rc-work・i18n/es-release-candidate・i18n/fixed-terms-contract・
i18n/game-terms-and-generated・i18n/next-languages-rc・i18n/pt-br-release-candidate。
リモート（今回の PR #158〜#162 の merge 済みのもの・`origin/main` の祖先であることを確認してから削除）: i18n/es-release-candidate・
i18n/pt-br-release-candidate・i18n/next-languages-rc・i18n/fixed-terms-contract・feat/vercel-web-analytics。

## 残した（強制の削除が必要なため。今夜は行わない）

| 対象 | 状態 | 判断 | 削除の手順（本人または次の作業で） |
|---|---|---|---|
| `perf/detail-progression-split`（ローカル・0d5fae7） | commit 1 件。`git cherry` で main に同じ内容（patch-equivalent）がある | 不要 | `git branch -D perf/detail-progression-split` |
| `release/teamaixi-v1-final`（ローカル・105dd57・2026-10-04 の wip） | squad の engine の文言の English 化の途中。main では `squad-text-en.ts` と 2026-10-06 の生成文の仕組みで置き換え済み | 不要（内容は後の実装に含まれる） | `git branch -D release/teamaixi-v1-final` |
| `origin/wip/build-inventory-english`（リモート・61e5d3e・2026-09-27） | `builds-text-en.ts` の初期版。main に同じファイル（後の版）がある | 不要 | `git push origin --delete wip/build-inventory-english` |
| `data/work/wt-head`（worktree・detached 555daf4） | 2026-10-06 の PR B の単独の検証に使った。未 commit の変更は coverage の生成物 2 件だけ（検証の出力・不要）。node_modules の junction は削除済み | 不要 | `git worktree remove --force data/work/wt-head`（10 項目以上の削除のため本人の承認の後に） |

その他のリモートのブランチ（feat/*・docs/*・fix/* の多く）は過去の merge 済みの PR のもの。一括の削除は行わない（必要なら merge 済みであることを
`git merge-base --is-ancestor origin/<branch> origin/main` で確かめてから個別に削除）。

## 追記（2026-10-08）: 実施した削除と `data/work/wt-head` の読み取り監査

### 削除した local branch（remote は削除していない）

| branch | 判断 | 根拠 |
|---|---|---|
| `perf/detail-progression-split`（0d5fae7） | `-d` が拒否 → `-D` | 唯一の commit と patch-id が同じ commit 378bb22 が main にある（別 commit として移植済み） |
| `release/teamaixi-v1-final`（105dd57） | `-d` が拒否 → `-D` | WIP の commit の追加行 8 件すべてが main に発展した形で存在（`locale` → `displayLocale`・ja の文言は ja-ns へ移動・`swapPlayerNames` で包まれた形）。v1.0.0 の tag より前 |

### `data/work/wt-head`（削除しない・読み取りだけ）

| 項目 | 結果 |
|---|---|
| 状態 | detached HEAD 555daf4（2026-10-06 21:57 JST）。`git worktree list` に登録あり |
| 未ステージの変更 2 件 | `docs/i18n/coverage.json`・`coverage.md` だけ（生成物。`audit-locale-coverage` で再生成できる）。価値のある編集ではない |
| 固有の commit 555daf4 | 「Spanish release candidate」の**早い版**。main には同名の最終版 dc411e5（PR #158）があり、`es` の各ファイルは main の方が同じか新しい（行が多いのは後から足した名前空間）。patch-id は一致しないが、内容は main に取り込み済み |
| junction | `wt-head\node_modules` → `C:\Development\eFootball-Team-AI\node_modules`（**main のリポジトリの依存**）。再帰削除するとリンク先を消す危険がある |
| 使用中 | open PR・CI・実行中のプロセスからの参照なし。source of truth ではない。Evidence・fixture・runbook・Secret・利用者のデータを含まない |
| バックアップ不要の根拠 | 内容は main（dc411e5 以降）と生成物だけ。555daf4 は reflog と object に残る（`git branch rescue/wt-head 555daf4` で復元できる） |

#### 将来の安全な削除の手順（本人の承認の後・今回は実施しない）

1. junction だけを外す（リンク先には触れない）: `cmd /c rmdir C:\Development\eFootball-Team-AI\data\work\wt-head\node_modules`
   （`rmdir` は junction ではリンクだけを消す。`Remove-Item -Recurse`・`rm -rf` は使わない）。外した後に main の `node_modules` が残っていることを確認する。
2. 生成物の変更を捨てる: `git -C data/work/wt-head restore docs/i18n/coverage.json docs/i18n/coverage.md`
3. 通常の削除: `git worktree remove data/work/wt-head`（`--force` なし。ignored の `.next`・`tsconfig.tsbuildinfo` は一緒に消える）。
4. `git worktree list` で main だけになったことを確認する。
