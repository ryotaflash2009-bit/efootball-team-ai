# Stage 4 Runbook — first Production update rehearsal (managers only)

Owner decision 2026-09-24: the first real update covers **managers only** (expected: Production 66 →
upstream 67, added 1, changed 0, removed 0). World and `player_card_analysis` are out of scope.
Claude Code implemented and verified everything below without any upstream request, Production
connection or workflow dispatch. **Every step here is an owner operation.**

## 1. How it works

One workflow, `.github/workflows/reference-data-production-apply.yml`, five modes. Every run needs
the `reference-data-production-apply` Environment approval and runs on `main`.

| Mode | Confirm input | Reads | Writes |
|---|---|---|---|
| `plan` | `plan-managers` | preflight; Production `managers` + `import_batches` rows and 3 counts (read-only txn, as `reference_data_updater`); **one** HTTPS GET of managers.json | nothing (artifacts only) |
| `dry-run` | `dry-run-managers` | plan artifact, Backup summary, run facts; Production re-read (read-only) | only the job-local throwaway `postgres:17` |
| `apply` | `apply-managers-to-production` | everything above again | **one transaction**: 1 `import_batches` audit row + managers insert/update (column grants, RLS) |
| `verify` | `verify-managers` | apply result; Production re-read (read-only) | nothing |
| `preflight` | `preflight` | catalog only | nothing |

Bindings checked in `dry-run` and again in `apply` (any mismatch = nothing written):

- plan run: same workflow, title `reference-data plan`, `main`, `workflow_dispatch`, success,
  attempt 1, **same commit as the current run**, and no newer successful plan run.
- source/plan checksums typed by you = the plan artifact = recomputed from the replayed managers.json
  against the rows Production has **now** (otherwise `stale_plan`).
- Backup run: Backup workflow, `main`, `workflow_dispatch`, success, attempt 1, summary valid
  (format "2", `pre-apply`, restore/storage verified, content policy, 4-column coverage), summary
  job id from that run, **finished less than 24 h ago**, **started after the plan run finished**,
  row counts equal to Production's current counts (World, managers, import_batches).
- dry-run run (apply only): title `reference-data dry-run`, same checks, record verified and bound to
  the same plan run, Backup run and checksums; the dry run started after the Backup finished.
- apply: your `acknowledge_manual_review` must equal the plan's `manualReviewCodes`; no audit batch
  with the same plan checksum or candidate exists; updater preflight passes; the production-write
  advisory lock is free. Then `ApplyPrerequisites` (all 28 gates) must pass.

Failure behaviour: any failure before commit → the transaction rolls back (nothing written).
A failure found after commit → status `rollback_required`; **no automatic undo, no Restore, no
deletion of the added manager**. The undo plan artifact is kept for a separate owner decision.
No mode retries anything automatically. Run #6/#7/#8 are never used for apply (Run #8 will be older
than 24 h; a new Backup is required).

**All four Stage 4 runs must use the same `main` commit.** If anything is merged to `main` in
between, start again from step 1.

## 2. Owner steps (in this order, all within 24 h, ideally one sitting)

Open: GitHub → Actions → **"Reference data Production apply (manual, approval-gated)"** (steps 1, 3,
4, 5) or **"Reference data Production backup (manual, approval-gated)"** (step 2). Branch: `main`.

1. **plan** — mode `plan`, confirm `plan-managers`, other fields empty → Run workflow → approve the
   Environment. Download artifact `reference-data-apply-plan-summary`. Check:
   `ok: true`, `reasons: []`, `facts.upstreamRequests` = 1 request with status 200,
   `facts.productionCounts` = `{ world_player_cards: 13009, managers: 66, import_batches: 8 }`,
   `facts.plan`: `beforeCount 66`, `afterCount 67`, `addedCount 1`, `changedCount 0`,
   `removedCount 0`, `duplicateCount 0`, `targetTables ["managers"]`, `planProblems []`.
   Note: run id (from the URL), `sourceChecksum`, `planChecksum`, `manualReviewCodes`.
2. **Backup** — Backup workflow, `backup_category` **pre-apply**, confirm `backup` → approve
   `production-backup-approval`. It must succeed with the same checks as Stage 3
   (validator: `node scripts/validate-backup-v2-summary-entry.mjs <summary> --expected-counts=<plan-time Production counts>` → `BACKUP_V2_VALID`).
   Note its run id. Do not re-run a failed Backup; stop and report.
3. **dry-run** — mode `dry-run`, confirm `dry-run-managers`, `plan_run_id`, `backup_run_id`,
   `source_checksum`, `plan_checksum` → approve. Artifact `reference-data-apply-dry-run-summary`:
   `ok: true`, `facts.isolated.verified: true`, `dryRun.managersBefore 66 → managersAfter 67`,
   `rediffChanges 0`, `executor.applyOk / auditBatchVerified / postVerifyOk: true`,
   `undo.insertedRemaining 1`. Note its run id.
4. **apply** — mode `apply`, confirm `apply-managers-to-production`, `plan_run_id`, `backup_run_id`,
   `dry_run_run_id`, `source_checksum`, `plan_checksum`, `acknowledge_manual_review` = the plan's
   `manualReviewCodes` joined with `,` (e.g. `baseline_missing,manager_change`; `none` if empty) →
   **approve the Environment only if every value above matches**. Run it once.
   Artifact `reference-data-apply-apply-summary`: `ok: true`, `facts.status: "applied_verified"`,
   `inserted 1`, `updated 0`, `postVerify.ok: true` (managers 67, import_batches 9, World unchanged,
   audit batch `verified`), `automaticUndo: false`.
5. **verify** (optional, read-only) — mode `verify`, confirm `verify-managers`, `apply_run_id` →
   approve → `ok: true`.
6. Public smoke (browser): open the site's manager pages and confirm they load normally (no error, existing managers still shown).

## 3. Stop conditions (do not re-run blindly)

- Any red run, `ok: false`, or any value differing from step 1–4 expectations: stop and send the
  run URL. Do not re-run, do not change inputs to "make it pass".
- `plan`: more than 1 upstream request, non-200, `planProblems` not empty, counts ≠ 13009/66/8.
- Backup: anything but `BACKUP_V2_VALID`, row counts ≠ plan's Production counts.
- `dry-run`/`apply`: any binding problem (e.g. `stale_plan`, `backup_expired`, `candidate_not_latest`,
  `commit_sha_mismatch`) — nothing was written; report.
- `apply` status `rollback_required`: the change is committed but verification failed. **Do not
  undo, restore or delete anything**; send the run URL. The undo plan artifact is kept 90 days.
- Emergency: `alter role reference_data_updater nologin;` in the SQL Editor.

## 4. Safe result to send

> Stage 4 managers rehearsal完了。plan run: <URL>、Backup run: <URL>、dry-run run: <URL>、apply run: <URL>、(verify run: <URL>)。

Only run URLs and the summaries (no rows, no secrets). Never paste DB URLs, CA certificates, age keys
or R2 credentials.

## 5. Evidence schema (recorded by Claude Code afterwards)

`docs/production-readiness/evidence/stage4-managers-rehearsal-<date>.json`:
`{ runs: { plan, backup, dryRun, apply, verify? } (number, id, attempt, conclusion, headSha),
upstream: { requests, status, bytes }, candidate: { sourceChecksum, planChecksum, idempotencyKey },
diff: { before, after, added, changed, removed, addedIdentities (≤10) }, policy: { severity,
manualReviewCodes }, backup: { runNumber, validator verdict, rowCounts }, dryRun: { verified,
postgresVersion, rediffChanges, undoSimulation }, apply: { status, batchId, inserted, updated },
postVerify: { ok, counts }, productionEffects }` — no row data, no secret, no full object key.

## 6. World (out of scope, recorded for the later World rehearsal)

- `card_rating`: part of the candidate, but counted separately as a high-frequency field.
- `appearance`: preserved (never refreshed by the updater).
- `appearance.updatedAt`: interpreted as UTC provisionally; semantic correctness of the time zone is
  unresolved.
- Physical deletion: forbidden; removed rows become tombstone candidates only.
- No World full scan (443 requests), candidate or apply plan now; World apply needs a separate
  approval.
