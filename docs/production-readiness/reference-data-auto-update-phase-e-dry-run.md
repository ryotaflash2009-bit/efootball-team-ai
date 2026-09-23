# Reference Data Auto-Update — Phase E: Isolated Dry Run

Status: implemented and verified with recorded fixtures and a disposable PostgreSQL built from
the repository DDL. **No Production access (no service role, no anon API, no DB URL), no upstream
access, no new dependencies.**

Modules:

- `src/lib/reference-data/auto-update/update-dry-run.ts`
- `src/lib/reference-data/auto-update/isolated-reference-schema.ts`

## 1. Detection pipeline — `runDetectionPipeline`

`transport → snapshot → StagingDataset → diff plan → update candidate`, full scope, per table.

| state | reached when |
|---|---|
| `detected` | always (start) |
| `source_fetched` | every table fetched and parsed |
| `normalized` | every snapshot produced a staging dataset (complete, no conflicting duplicates) |
| `diff_generated` | plans computed |
| `policy_blocked` / `awaiting_review` | candidate policy result (Phase D) |

Failures stop without advancing and are reported as `{stage, table, code}`: `source_fetch`
(transport codes such as `http_429`, `network_disabled`), `parse` (`schema_drift`,
`parse_error`, `sort_contract_violation`), `normalize` (`source_incomplete`,
`conflicting_duplicates`). The history is checked with `validateStateHistory`.

Collectors:

- `collectWorldFullSnapshot` — CREATED_AT DESC from page 1 to `totalPages` (safety cap 60 pages),
  3-second spacing between pages via the injected `sleep`, any page failure → no partial snapshot.
- `collectWorldIncrementalSnapshot` — UPDATED_AT DESC with the Phase B planner (first-page hash,
  early stop, max pages, sort contract), incremental scope (no removal detection). Returns the
  first-page hash and max `updatedAt` for the next run's history.
- `collectManagersSnapshot` — single GET, no retry.

Current rows are supplied by the caller: fixtures now; a restored Backup in Stage 4.

## 2. Isolated apply — `runIsolatedDryRunApply`

1. Schema name must match `^reference_data_([a-z0-9]+_)*(test|dry_run)$` and must not be a
   reserved schema (`reference_data`, `reference_data_ops`, `public`, `auth`, …).
2. The isolated schema is built by `buildIsolatedReferenceSchemaDdl` from the repository DDL text
   (`create-reference-data-schema.sql`, detail and name-sort-key extensions); the builder refuses
   output containing grant/revoke/drop table/truncate/delete/role/policy statements.
3. Blocked plans are not sent at all. Target tables must be empty.
4. Current rows + planned inserts/updates are written in one transaction (rolled back on error).
5. Verified only if each read-back table checksum equals the plan's `afterChecksum` and a
   re-diff against the same staging dataset is empty.

## 3. Verification

- Unit (`update-dry-run.test.ts`, 11 tests): full scan pacing and completeness, mid-scan 429 stop,
  schema drift, incremental early stop and sort-contract stop, two-table pipeline to
  `awaiting_review` with a value-free summary, stop states for disabled transport / incomplete
  source, `policy_blocked` on invalid current rows, schema-name guard, DDL builder guard, blocked
  plans send nothing.
- PostgreSQL (`update-dry-run.postgres.test.ts`, 3 tests): end-to-end fixture pipeline applied to
  `reference_data_phase_e_dry_run` (added/changed/removed/unchanged; removed row kept; eFHUB and
  insert-only columns preserved; manager ids 5, 6 → new 7), tampered plan not verified, non-empty
  target rolled back and rejected. Local disposable `postgres:17` run: 7 files / 35 tests (container
  removed); CI `postgres:16`.

## 4. Next boundary

Running this pipeline with real upstream responses requires a real HTTP transport, which is
Stage 1 (first upstream network verification) and needs separate approval. Using a restored
Production Backup as current rows is Stage 3/4.
