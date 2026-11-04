# ブラックボックス 一覧

`node scripts/black-box-all.mjs` が作る一覧です（手で編集しない）。各行の「報告」が詳しい結果です。

- 合格 **41** ・ 失敗 **0** ・ 対象外 **5** ・ 全 46 本
- 対象外 = 社内向けページが必要な rail を、社内向けページが無効のビルドで実行した（失敗ではない。`NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled` でビルドすると実行できる）

| 結果 | rail | 件数 | 秒 | 最後に実行 | 報告 |
|---|---|---|---|---|---|
| ✅ 合格 | ability-progression | 522/522 | 171 | 2026-11-03 19:01 | — |
| ✅ 合格 | account-scoped-storage | 164/164 | 23 | 2026-11-03 19:04 | [account-scoped-storage.md](./account-scoped-storage.md) |
| ✅ 合格 | alpha-copy-fixes | 34/34 | 6 | 2026-11-03 19:05 | [alpha-copy-fixes.md](./alpha-copy-fixes.md) |
| ✅ 合格 | auth-google | 71/71 | 26 | 2026-11-03 19:05 | [auth-google.md](./auth-google.md) |
| ✅ 合格 | base-percentile | 115/115 | 120 | 2026-11-03 19:05 | [base-percentile.md](./base-percentile.md) |
| ✅ 合格 | best-xi | 27/27 | 0 | 2026-11-03 19:07 | [best-xi.md](./best-xi.md) |
| ✅ 合格 | best-xi-optimization | 45/45 | 17 | 2026-11-03 19:07 | [best-xi-optimization.md](./best-xi-optimization.md) |
| ✅ 合格 | boosters | 54/54 | 0 | 2026-11-03 19:07 | [boosters.md](./boosters.md) |
| ✅ 合格 | community | 41/41 | 15 | 2026-11-03 19:07 | [community.md](./community.md) |
| ✅ 合格 | compare | 74/74 | 1 | 2026-11-03 19:09 | [compare.md](./compare.md) |
| ✅ 合格 | compare-ability-editor | 168/168 | 92 | 2026-11-03 19:08 | — |
| ✅ 合格 | cost-rule | 11/11 | 3 | 2026-11-03 19:09 | — |
| ✅ 合格 | diagnosis-facts | 16/16 | 4 | 2026-11-03 19:09 | — |
| ✅ 合格 | favorites | 32/32 | 0 | 2026-11-03 19:09 | — |
| ✅ 合格 | game-plan | 18/18 | 6 | 2026-11-03 19:09 | — |
| ✅ 合格 | hydration-seeded | 107/107 | 279 | 2026-11-03 19:09 | — |
| ✅ 合格 | local-backup | 28/28 | 43 | 2026-11-03 19:14 | [local-backup.md](./local-backup.md) |
| ✅ 合格 | manager-compare | 16/16 | 9 | 2026-11-03 19:15 | — |
| ✅ 合格 | manager-picker | 35/35 | 2 | 2026-11-03 19:15 | [manager-picker.md](./manager-picker.md) |
| ✅ 合格 | managers | 43/43 | 1 | 2026-11-03 19:15 | [managers.md](./managers.md) |
| ✅ 合格 | my-builds | 100/100 | 0 | 2026-11-03 19:15 | [my-builds.md](./my-builds.md) |
| ✅ 合格 | my-team-cloud | 98/98 | 16 | 2026-11-03 19:15 | [my-team-cloud.md](./my-team-cloud.md) |
| ✅ 合格 | new-cards | 41/41 | 36 | 2026-11-03 19:15 | [new-cards.md](./new-cards.md) |
| ✅ 合格 | pack-check | 18/18 | 13 | 2026-11-03 19:16 | [pack-check.md](./pack-check.md) |
| ✅ 合格 | phase-b5 | 24/24 | 0 | 2026-11-03 19:32 | — |
| ✅ 合格 | phase-c | 17/17 | 0 | 2026-11-03 19:32 | — |
| ✅ 合格 | progression | 99/99 | 1 | 2026-11-03 19:16 | [progression.md](./progression.md) |
| ✅ 合格 | public-signup-limited | 117/117 | 103 | 2026-11-03 19:16 | [public-signup-limited.md](./public-signup-limited.md) |
| ✅ 合格 | release-gate | 2/2 | 596 | 2026-11-03 19:18 | — |
| ✅ 合格 | same-player | 41/41 | 90 | 2026-11-03 19:28 | [same-player.md](./same-player.md) |
| ✅ 合格 | saved-filters | 11/11 | 9 | 2026-11-03 19:29 | — |
| ✅ 合格 | share-build-link | 6/6 | 2 | 2026-11-03 19:29 | — |
| ✅ 合格 | share-card | 24/24 | 61 | 2026-11-03 19:29 | [share-card.md](./share-card.md) |
| ✅ 合格 | squad-list-banner | 5/5 | 1 | 2026-11-03 19:30 | [squad-list-banner.md](./squad-list-banner.md) |
| ✅ 合格 | squad-placement-assist | 23/23 | 9 | 2026-11-03 19:31 | [squad-placement-assist.md](./squad-placement-assist.md) |
| ✅ 合格 | squad-use | 12/12 | 0 | 2026-11-03 19:31 | [squad-use.md](./squad-use.md) |
| ✅ 合格 | squads | 51/51 | 1 | 2026-11-03 19:31 | [squads.md](./squads.md) |
| ✅ 合格 | supabase-auth | 173/173 | 35 | 2026-11-03 19:31 | [supabase-auth.md](./supabase-auth.md) |
| ✅ 合格 | ui | 75/75 | 0 | 2026-11-03 19:31 | [ui.md](./ui.md) |
| ✅ 合格 | world-sync | 35/35 | 1 | 2026-11-03 19:32 | — |
| ✅ 合格 | world-ui | 92/92 | 2 | 2026-11-03 19:31 | [world-ui.md](./world-ui.md) |
| ⏭ 対象外 | final-alpha-readiness-copy（社内向けページ） | — | 0 | 2026-11-03 19:09 | [final-alpha-readiness-copy.md](./final-alpha-readiness-copy.md) |
| ⏭ 対象外 | local-posts（社内向けページ） | — | 0 | 2026-11-03 19:15 | [local-posts.md](./local-posts.md) |
| ⏭ 対象外 | public-preparation（社内向けページ） | — | 0 | 2026-11-03 19:16 | [public-preparation.md](./public-preparation.md) |
| ⏭ 対象外 | rls-test（社内向けページ） | — | 0 | 2026-11-03 19:28 | [rls-test.md](./rls-test.md) |
| ⏭ 対象外 | support-contact（社内向けページ） | — | 0 | 2026-11-03 19:31 | [support-contact.md](./support-contact.md) |

