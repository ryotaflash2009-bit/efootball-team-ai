# Reference Data Auto-Update — Phase C: Deterministic Diff

Status: implemented and verified locally and against a disposable PostgreSQL built from the
repository DDL. **No Production access, no upstream access, no new dependencies.**

Module: `src/lib/reference-data/auto-update/update-diff.ts`
Inputs: current Production-shaped rows (from a Backup restore or a fixture — Phase C never
connects to Production) + a Phase B `StagingDataset`.
Output: `UpdateDiffPlan` = Phase A `UpdateDiffReport` + inserts / updates / removed candidates /
resurrected + `blockingReasons` + `planChecksum`.

## 1. Rules

| topic | rule |
|---|---|
| comparison | Phase A canonical row checksum (volatile columns excluded) |
| update | current row + source columns; `preserveOnUpdateColumns` keep current values (World: `ai_styles`, `appearance`; managers: `internal_manager_id` and insert-only columns); eFHUB-derived `efhub_card_id`/`efhub_conflicts` keep current values; `fetched_at` from source |
| insert | source columns + DDL defaults (`efhub_card_id` null, `efhub_conflicts` `[]`; managers insert-only columns null) |
| manager id | new managers get `max(current internal_manager_id) + 1…` in identity byte order (apply must re-verify under lock) |
| removed | only when the staging dataset allows removal detection (complete full scope, no unidentified rejects); rejected identities count as invalid, never removed; removed = tombstone candidate, stays in the after state (no physical delete) |
| resurrected | identities in the tombstone history are reported separately (never auto-applied as added/changed) |
| blocked | duplicate identities, unknown/missing columns or invalid values in current rows; report violating the Phase A validator |
| determinism | all lists in identity byte order; report and `planChecksum` independent of input order |
| privacy | report holds counts, checksums, ≤20 identities and column names only (no values) |

`changedFields` lists canonical columns whose canonical value differs; the report's
`changedFieldNames` is their sorted union.

## 2. Verification

- Unit (`update-diff.test.ts`, 13 tests): unchanged/added/changed/removed, idempotent re-diff after
  applying the plan, preserve rules, insert defaults, manager id allocation, removal gating
  (incremental, unidentified rejects), rejected-not-removed, resurrected, order independence,
  blocking cases, report validation and no row values in the report.
- PostgreSQL (`update-diff.postgres.test.ts`, 4 tests): schema built from
  `create-reference-data-schema.sql` + `extend-reference-data-detail-schema.sql` +
  `extend-name-sort-key-schema.sql` (isolated schema `reference_data_diff_test`). Planned rows
  satisfy the real constraints; rows read back keep the planned row checksums (jsonb key order,
  text[], timestamptz, integer round-trip); the table checksum equals the report's
  `afterChecksum`; re-diff after apply is empty; an upstream change applies as an update with
  the expected changed fields. Also confirms the contract's column list equals the DDL's columns.
  Run locally on a disposable `postgres:17` container (removed afterwards) and in CI
  (`postgres:16` service container).

## 3. Not in Phase C

Policy evaluation of the report (Phase D), dry run orchestration (Phase E), any Production read
or write, tombstone storage (tombstone history is an input; none exists yet).
