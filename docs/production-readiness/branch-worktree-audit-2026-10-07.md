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
