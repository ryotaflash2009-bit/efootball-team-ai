# World-only Production update rehearsal — runbook (owner operations)

Owner decision 2026-09-24: bring Production World data (13,009 cards) up to the latest upstream
catalogue before the invite-only beta. Same workflow, stages and bindings as the managers rehearsal
(`stage4-managers-rehearsal-runbook.md`), with `dataset = world`. Claude Code implemented and verified
it without any upstream request, Production access or dispatch. **Every run below is an owner
operation** (dispatch + Environment approval).

## 1. What is different for World

| Item | Rule |
|---|---|
| Target | `world_player_cards` + one `import_batches` audit row. managers and `player_card_analysis` are never written; post-apply verifies managers count and `max(updated_at)` unchanged. |
| Removals | **Any removed card stops the plan** (`removal_not_allowed`). No physical delete, no tombstone apply. |
| `card_rating` | Updated and part of every checksum. Updates whose only changed field is `card_rating` are counted separately (`cardRatingOnlyChangedCount`, finding `world_card_rating_only_changes`, warning) and are **excluded from the volume threshold** (added + structural changes). They never hard-block on their own. |
| `appearance` / `ai_styles` | Existing Production values are kept (preserve columns; the updater has no UPDATE grant). Upstream differences are reported as `preserved_column_drift` (warning). New cards are inserted with upstream values. |
| `appearance.updatedAt` | Naive upstream values are interpreted as UTC (provisional; the semantic time zone stays unresolved). The plan summary records how many raw values had no time zone. Future values (> fetch time + 24 h) → **hard block**; upstream maximum older than the Production maximum → **hard block**; > 20 % of cards sharing one timestamp → manual review. |
| First World apply | Always manual review (`world_first_apply`), plus `baseline_missing`. |
| Upstream | `plan` fetches the World catalogue once: CREATED_AT pages, 3 s interval, retry budget from the endpoint, caps 460 pages / 14,000 records / 462 requests / 40 MB; no managers request. Stops on any duplicate identity or incomplete scan. |
| Scale guard | More than 8,000 inserts + updates stops the plan (`rehearsal_scope_exceeded`). |

## 2. Expected values (from the 2026-09-23 full scan; the new plan is authoritative)

Production 13,009 → upstream ≈ 13,286: added ≈ 277, changed ≈ 5,879 of which ≈ 5,816 card_rating-only
(structural ≈ 63), removed 0. Manual review codes: `baseline_missing,world_first_apply` (plus any
the new plan reports). Warnings: `world_count_increase`, `world_card_rating_only_changes`,
`preserved_column_drift`. If the plan differs materially (removals, hard blocks, far larger changes),
stop and report — do not apply.

## 3. Owner steps (same `main` commit, all within 24 h of the Backup)

Actions → **"Reference data Production apply (manual, approval-gated)"**, branch `main`, **dataset `world`**:

1. **plan** — mode `plan`, confirm `plan-world` → approve `reference-data-production-apply`.
   Takes ≈ 25 min. Summary artifact `reference-data-apply-plan-world-summary`: `ok: true`, `reasons: []`,
   `facts.upstream.worldRequests` ≈ 443 (all 200), `managersRequests: 0`, `productionCounts`
   `{13009, 67, 9}`, `plan.removedCount 0`, `planProblems []`. Note run id, `sourceChecksum`,
   `planChecksum`, `manualReviewCodes`.
2. **Backup** — Backup workflow, `pre-apply`, confirm `backup` → approve `production-backup-approval`.
   Must be `BACKUP_V2_VALID` with rows equal to the plan-time Production counts
   (`node scripts/validate-backup-v2-summary-entry.mjs <summary> --expected-counts=world_player_cards:<n>,managers:<n>,player_card_analysis:<n>,import_batches:<n>`).
   Started after the plan finished.
3. **dry-run** — mode `dry-run`, dataset `world`, confirm `dry-run-world`, `plan_run_id`,
   `backup_run_id`, `source_checksum`, `plan_checksum` → approve. Expect `isolated.verified: true`,
   `worldBefore 13009 → worldAfter ≈ 13286`, `rediffChanges 0`, executor / audit / post-verify ok,
   undo restores the updated rows and leaves the added rows for a manual decision.
4. **apply** — mode `apply`, dataset `world`, confirm `apply-world-to-production`, the ids and
   checksums above, `acknowledge_manual_review` = the plan's codes joined by `,` → **approve only if
   every value matches**. One transaction (≈ 6,000 row writes; allow up to ~20 min). Expect
   `applied_verified`, `postVerify.ok`, World ≈ 13,286, import_batches 10, managers unchanged,
   `automaticUndo: false`.
5. **verify** (optional) — mode `verify`, dataset `world`, confirm `verify-world`, `apply_run_id`.

Environment comment for step 4:
`Approved for the World-only Production rehearsal. Expected: about 277 added, about 5,879 updated (about 5,816 card_rating-only), 0 removed. appearance keeps Production values. managers, player_card_analysis, deletes, rollback and Restore are not approved.`

## 4. Stop conditions

Any red run, `ok: false`, removals, a hard block, row counts that differ from the plan, a stale plan,
Backup older than 24 h, or `rollback_required` → stop, do not re-run, send the run URL. After a
committed apply with `rollback_required`: no undo, no restore, no deletion without a separate decision
(the undo plan artifact is kept 90 days). Emergency: `alter role reference_data_updater nologin;`.

## 5. After a successful apply

Claude Code records Evidence and updates the applied-state record used by scheduled detection;
the Release Gate is re-run on the new data before any invitation is sent.

## 6. Result (2026-09-25)

Plan #7 → Backup #10 → Dry run #8 → Apply #9 on `88805ba`: `applied_verified`, World 13,009 → 13,297
(288 added, 5,897 updated of which 5,766 card_rating-only, 0 removed), managers 67 unchanged,
import_batches 10. Evidence: `evidence/stage4-world-rehearsal-2026-09-25.json`; applied-state updated.

Note: the physical-ranking panel ("全 N 中の順位") uses each card's preserved `appearance.ranks`, whose totals
are from the original import (13,009) and are not refreshed while appearance is preserved. The rail checks
the page against the card's own ranks total. Refreshing appearance is a separate owner decision.
