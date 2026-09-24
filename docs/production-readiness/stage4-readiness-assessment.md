# Stage 4 Readiness Assessment — first approval-gated Production update rehearsal

Recorded 2026-09-24 after Stage 3 (Backup v2 Run #8 verified,
`evidence/stage3-production-backup-v2-2026-09-24.json`). Static review only: no upstream request,
no Production query, no workflow dispatch.

## 1. Verdict

**Not ready to request apply approval.** The executor, the policy, the Backup and the updater role
are in place, but three inputs do not exist yet and four owner decisions are open. None of them
can be produced without a stop-point operation (new upstream fetch, or a Production read by the
updater through the apply workflow).

## 2. What is in place

| Piece | Status |
|---|---|
| Backup | Run #8: pre-apply, format "2", restore/storage verified, 13009/66/19/8 (= Run #7), 4 new columns covered |
| Updater role | Stage 2 complete; preflight Run #3 ok (3 table SELECT, 119 column grants, no auth/user access) |
| Executor | `update-apply.ts`: prerequisite gate, role check, advisory lock, `stale_plan` refusal via `beforeChecksum` re-read, pending → verified batch, `after_checksum` check, rollback on any failure, undo plan (before images) |
| Undo | `applyUndoPlan`: restores updated rows, appends an undo batch; inserted rows are listed for a manual decision (no DELETE privilege) |
| Isolated dry run / rollback simulation | reproduced in Stage 1 against a SQLite-derived state (World +277 / 5,879 changed; managers +1) |
| Apply workflow | preflight mode only; `apply` is refused before any secret is read |

## 3. Static evaluation of `evaluateApplyPrerequisites` with today's Evidence

| Gate | State | Why |
|---|---|---|
| `source_not_fetched`, `source_checksum_missing` | **fails** | Stage 1 kept summaries only; no candidate payload exists to bind an approval to |
| `diff_not_generated` | **fails** | Stage 1 diffed against a SQLite-derived state. The executor compares `beforeChecksum` with rows it re-reads from Production, so a plan must be computed from Production rows (otherwise `stale_plan`) |
| `manual_review_unresolved` | **fails** | World: `baseline_missing` (+ warnings near threshold, count increase, preserved drift). managers: `manager_change`, `baseline_missing` |
| `dry_run_not_verified`, `shadow_comparison_failed` | **fails** | must be re-run on the Production-derived plan, after the Backup |
| `backup_*` | passes today | Run #8 satisfies category / conclusion / restore / storage / content policy |
| `backup_too_old` | **will fail after 2026-09-25 09:24 UTC** | `MAX_BACKUP_AGE_BEFORE_APPLY_HOURS = 24` from Run #8 completion; the order also requires Backup < dry run start < dry run end < approval < apply. A fresh pre-apply Backup will be needed in the same window as the apply |
| `approval_*`, `commit_sha_mismatch` | **fails** | no approval yet (bound to source checksum + commit) |
| `rollback_plan_missing` | **fails** | produced by the plan step |
| `updater_role_not_verified`, `production_preflight_failed` | pass today | Stage 2; re-checked at apply time |
| `concurrency_lock_missing`, `duplicate_batch`, `candidate_not_latest` | evaluated at apply time | |

## 4. Missing pieces (engineering)

1. **Candidate artifact**: a fetch that keeps the normalized candidate (not just a summary) with its
   `sourceChecksum`, as a GitHub artifact or a git-ignored workspace file.
2. **Production plan mode** (read-only): as `reference_data_updater` inside `begin read only`, read
   the target tables, diff them against the candidate, and emit the plan checksum, before/after
   checksums, counts, changed fields and the undo preview as a non-secret artifact.
3. **Apply mode**: download the approved plan + candidate artifacts, verify checksums and the
   approval binding (source checksum, plan checksum, Backup run id, commit), build
   `ApplyPrerequisites` from Evidence, call `applyUpdatePlans`, upload the undo plan
   (row data, access-restricted artifact) and a non-secret result summary.
4. **Post-apply verifier**: re-read as updater (read-only), require `afterChecksum`, verified
   batch rows, unchanged preserved columns and row counts = before + inserts.

## 5. Owner decisions needed before building (1) to (4)

1. **Scope of the first rehearsal.** Recommendation: **managers only** (Stage 1: +1 row, 0 changes).
   It avoids `card_rating` churn, the `appearance` drift and the naive-timestamp question, and it
   still exercises every gate and the batch lifecycle (an insert-only undo just lists the new row
   for a manual decision, since the updater cannot DELETE). World follows once the
   items below are decided.
2. **Candidate fetch.** managers.json = 1 request (the Stage 1 pattern). A World candidate needs a
   full scan (443 requests); the 2026-09-23 approval was one-time only.
3. **World policy items** (only if World is in scope): `card_rating` volatility (5,816 changes),
   `appearance` systematic drift (preserved; do not refresh), and the UTC interpretation of the
   naive `appearance.updatedAt`.
4. **Timing.** Plan → dry run → approval → apply must fit inside 24 h of a fresh pre-apply Backup.
   Expect a new Backup (owner dispatch) at the start of the Stage 4 window.

## 6. Binding design (for implementation after the decisions)

`approval = { sourceChecksum, planChecksum, backupRunId, backupTotalChecksum, commitSha, tables, approvedAt, expiresAt }`.
The apply run refuses when any value differs from what it recomputes: the candidate checksum from
the downloaded artifact, the plan checksum from a fresh read of Production in the same
transaction (stale → refuse), the Backup facts from its summary artifact (validated with
`validate-backup-v2-summary-entry.mjs`) and the workflow's commit.

## 7. Update 2026-09-24 — managers-only rehearsal implemented

Owner decision: first rehearsal = managers only. Implemented (no upstream request, no Production
access): `plan` / `dry-run` / `apply` / `verify` modes in the apply workflow
(`stage4-managers.ts`, `stage4-managers-cli.ts`), candidate artifact (recorded managers.json replayed
deterministically), Production plan from Production rows, Backup / plan / dry-run run bindings,
approval binding (source + plan checksum, commit, manual-review acknowledgement), post-apply
verifier, and no automatic undo. Owner procedure: `stage4-managers-rehearsal-runbook.md`.
Run #8 is not used for apply (24 h limit); a new pre-apply Backup is part of the procedure.
