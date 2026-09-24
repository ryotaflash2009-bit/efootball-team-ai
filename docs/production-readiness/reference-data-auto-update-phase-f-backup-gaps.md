# Reference Data Auto-Update — Phase F: Backup Column Gaps and Summary Artifact

Status: code, tests and workflow definition changed. **The Backup workflow was not dispatched.
No Production, R2 or Secret access.** The next real Backup (Stage 3) is the first run of the new
format and needs separate approval.

## 1. Backup format versions

`backup-schema.ts` now versions the Backup column set; the manifest's `backupVersion` records it.

| version | columns | used for |
|---|---|---|
| `"1"` | original set (Run #7): no `world_player_cards.appearance_updated_at`, no `import_batch_id` on world/managers/analysis | verifying and restoring existing Backups (Run #7) — frozen, pinned by column-count tests |
| `"2"` (current) | `"1"` + the missing columns; equals the repository DDL's Production columns for all four tables | every new Backup |

- `getBackupTableSpec(table, version)`, `buildBackupDumpSelectSql(..., version)` and
  `buildBackupRestoreInsertSql(..., version)` default to the current version.
- `createReferenceDataBackup` writes `backupVersion` = requested version (default `"2"`, unknown →
  blocked). Previously it wrote `"1"` by default.
- `restoreReferenceDataBackup` rejects unsupported versions in preflight and verifies/restores
  with the manifest's version, so a `"1"` Backup restores and re-checksums with its own columns
  (new columns stay null in the restore target).
- The isolated verify/restore DDL gained `appearance_updated_at timestamptz` and
  `import_batch_id uuid` (no FK, like the other isolated tables).
- `KNOWN_BACKUP_COLUMN_GAPS` is now empty for every table; the contract test compares the current
  spec with the DDL-based Production columns.

## 2. Non-secret summary artifact

- `backup-summary-artifact.ts`: allowlisted summary (`phase`, `ok`, verification flags, object /
  manifest keys, job id, category, prefix, retention, `expiresAt`, row counts, total checksum,
  encryption algorithm, `backupVersion`) plus sanitized reasons. `sourcePreflight` and any unknown
  field are dropped.
- Before writing, the CLI checks that no runtime Secret value (whole value, and each ≥16-char line
  of multi-line values such as the CA PEM) appears in the text; otherwise it refuses to write and
  the job fails.
- Workflow: the run step sets `REFERENCE_DATA_BACKUP_SUMMARY_PATH` under `runner.temp`; a new
  `Upload non-secret backup summary` step (`if: always()`, `actions/upload-artifact@v4`,
  30-day retention, `if-no-files-found: ignore`) uploads only that JSON file. Triggers
  (`workflow_dispatch` only), permissions (`contents: read`), Environment approval and Secret checks
  are unchanged.

## 3. Verification

- Unit: `backup-format-version.test.ts` (5), `backup-summary-artifact.test.ts` (4); all existing
  Backup tests unchanged and passing.
- PostgreSQL: two new cases in `backup-restore.postgres.test.ts` — format `"2"` round-trips
  `appearance_updated_at` and `import_batch_id`; format `"1"` still verifies and restores. Local
  disposable `postgres:17`: 7 files / 37 tests (container removed); CI `postgres:16`.
- Backup execution compile (`tsconfig.backup-execution.json`) and the no-secret runtime smoke
  (module loads, blocked before any connection).

## 4. Risk carried to Stage 3 (first new-format Production Backup)

The new format selects `appearance_updated_at` and `import_batch_id` from Production. They are in
the repository DDL, and the backup reader's grant is table-level, but the match between Production
and the repository DDL has not been checked read-only (architecture Known Gap 7). If Production
differs, the Backup fails closed at export (nothing is written or deleted). The Stage 3 checklist
should include a read-only column check before dispatching.

**Update 2026-09-24 (Stage 2 complete):** the owner's Stage 2 metadata check (before/after) matched
the contract for all 4 tables, including the `column_missing` / `column_unexpected` checks, so the
new columns exist in Production. The first format "2" Backup additionally records `columnCoverage`
(row and non-null counts of the 4 new columns after the isolated restore) and blocks the upload if
any is missing. Owner steps: `stage3-backup-v2-execution-runbook.md`.
