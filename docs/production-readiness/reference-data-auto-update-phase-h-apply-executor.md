# Reference Data Auto-Update — Phase H: Apply Executor (non-Production)

Status: library + tests on a disposable PostgreSQL. **No Production connection code, CLI,
workflow, Secret or Environment.** Wiring this to Production is part of Stage 4 (first
approval-gated real update rehearsal) and needs separate approval.

Module: `src/lib/reference-data/auto-update/update-apply.ts`

## 1. `applyUpdatePlans(client, input)`

The caller supplies a connected client already acting as `reference_data_updater`. Steps:

1. `evaluateApplyPrerequisites` must pass (Backup pre-apply/restore/storage/content/age, dry run,
   shadow comparison, approval bound to the source checksum and commit, latest candidate, locks,
   rollback plan, updater role and preflight verified). The candidate's source checksum must equal
   the approved one. Otherwise nothing is sent to the database.
2. Plans must not be blocked and must not contain removed candidates or resurrected identities
   (tombstones and resurrection are not automated).
3. `current_user` must be `reference_data_updater`.
4. In one transaction: `pg_try_advisory_xact_lock` on the production-write group key → re-read
   rows and require `beforeChecksum` (stale plans are refused) → insert a `pending`
   `import_batches` row (payload hash = plan checksum) → INSERT/UPDATE using only
   `UPDATER_COLUMN_GRANTS` columns, stamping `dataset_version` / `import_batch_id` /
   `updated_at` → re-read and require `afterChecksum` → mark the batch `verified` → commit.
5. Any failure rolls the transaction back (`stale_plan`, `lock_not_acquired`,
   `after_checksum_mismatch`, `write_failed`); nothing remains.

The result carries per-table batch ids, counts, checksums and an **undo plan** (before images of
updated rows, identities of inserted rows).

## 2. `applyUndoPlan(client, schema, undo)` — explicit, human-approved

- Restores the updatable columns of the updated rows to their before values, under the same lock.
- Appends a new `import_batches` row (`source = 'undo'`, `notes = 'undo of <batch>'`) and marks it
  verified. **The original batch row stays `verified`**: the updater's RLS policy only updates
  `pending` rows, so committed history is immutable at the database level (stricter than the
  Phase A transition table, which also allows `verified → rolled_back`; that transition is left
  to a human admin operation).
- Inserted rows are not deleted (the updater has no DELETE privilege); they are returned as
  `insertedIdentitiesRequiringManualRemoval` for a separate decision.
- Never runs automatically (architecture chapter 18).

## 3. Verification

- Unit (`update-apply.test.ts`, 4 tests): failed prerequisites send nothing; only `reference_data`
  or isolated schema names are accepted; a non-updater session writes nothing; deterministic
  bigint lock key.
- PostgreSQL (`update-apply.postgres.test.ts`, 5 tests; RLS-forced schema from repository DDL +
  updater role SQL drafts, `SET ROLE reference_data_updater`): successful apply (after checksum,
  verified batch, eFHUB/preserved columns unchanged, empty re-diff); stale plan refused with no
  writes; wrong role, failed prerequisites and a held advisory lock write nothing; plans with
  removed candidates refused; undo restores before values and appends an undo batch while the
  original batch and the inserted row remain. Local disposable `postgres:17`: 9 files / 47 tests
  (container removed).

## 4. Remaining for Stage 4

A Production entrypoint (CLI + `workflow_dispatch` workflow in the
`reference-data-production-apply` Environment) that downloads the approved plan artifact,
connects with the apply Secrets, builds `ApplyPrerequisites` from real Backup/dry-run/approval
evidence, and then calls this executor. It is intentionally not written yet, because it can only
be exercised against Production.
