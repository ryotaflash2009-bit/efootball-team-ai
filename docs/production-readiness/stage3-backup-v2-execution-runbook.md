# Stage 3 Runbook — first Production Backup in format "2" (owner-only operation)

Claude Code prepared and verified everything up to the dispatch. **Dispatching the workflow,
approving the Environment and running the Production Backup are owner operations.** Claude Code
does not run them.

## What is already verified (no Production / R2 / Secret access by Claude Code)

| Item | Status |
|---|---|
| Stage 2 | Complete: preflight Run #3 success (`evidence/stage2-production-preflight-2026-09-24.json`) |
| Production columns = repository DDL | Stage 2 metadata before/after matched the contract, including `column_missing` / `column_unexpected` checks for all 4 tables, so the 4 new columns exist in Production (closes Phase F risk §4) |
| Backup reader access to the new columns | table-level SELECT + backup-reader RLS policies (Run #7) cover all columns |
| Format "2" columns | `backup-schema.ts`: v1 + `world_player_cards.appearance_updated_at`, `world_player_cards.import_batch_id`, `managers.import_batch_id`, `player_card_analysis.import_batch_id` (38/30/18/13 columns) |
| Manifest / checksum | per-table and total checksums are computed over the format "2" column set; manifest records `backupVersion: "2"` |
| Restore | restore uses the manifest's version column set; v1 (Run #7) still restores with the v1 set |
| Run #6 regression | source preflight + content policy reject empty (0-row) backups before upload |
| Coverage evidence | new: after the isolated restore, the job counts rows and non-null values of the 4 new columns (aggregate numbers only) and blocks the upload if any is missing or the row count differs; the result is in the summary as `columnCoverage` |
| Validator | new: `scripts/validate-backup-v2-summary-entry.mjs` checks the downloaded summary artifact |
| Workflow | unchanged since Run #7 (dispatch-only, `confirm` = `backup`, category choice, Environment `production-backup-approval`, main only, 7 secrets checked before any connection, non-secret summary artifact, plaintext cleanup check) |

## Owner steps

1. **Workflow**: GitHub → Actions → **"Reference data Production backup (manual, approval-gated)"**.
2. **Branch**: `main` (the only branch the Environment allows).
3. **backup_category**: select **`pre-apply`** yourself (never deleted by R2 lifecycle).
4. **confirm**: type **`backup`** (lowercase, exact).
5. **Run workflow** button.
6. **Environment approval**: when the job waits for `production-backup-approval`, open the run →
   Review deployments → approve.
7. **Steps that must be green**: "Check required secrets…", "Runtime smoke test…", "Run Production
   backup (…)", "Upload non-secret backup summary", "Final cleanup verification…".
8. **Summary artifact**: download `reference-data-backup-summary` from the run page into
   `./data/stage3-backup-v2/` inside this repository (the folder is git-ignored). Expect:
   - `ok: true`, `reasons: []`, `summary.phase: "upload"`
   - `rowCounts`: `world_player_cards 13009`, `managers 66`, `player_card_analysis 19`,
     `import_batches 8` (unchanged since Run #7; Production has not been updated)
   - `backupVersion: "2"`
   - `restoreVerified: true`
   - `storageVerified: true`
   - `columnCoverage.formatVersion: "2"`, `columnCounts` 38/30/18/13, and all 4 `addedColumns`
     with `included: true` and `rows` equal to that table's row count (`nonNullRows` may be 0 —
     it is recorded, not judged)
   - `category: "pre-apply"`, `prefix: "pre-apply/"`, `retentionCategory: "production-pre-apply"`,
     `retentionDays: null`, `expiresAt: null`, `encryptionAlgorithm: "age-x25519"`
9. **Validate** (local, no network):
   ```
   npx tsc -p tsconfig.backup-summary-validation.json
   node scripts/validate-backup-v2-summary-entry.mjs ./data/stage3-backup-v2/reference-data-backup-summary.json \
     --expected-counts=world_player_cards:<n>,managers:<n>,player_card_analysis:<n>,import_batches:<n>
   (use the Production counts at that time; without the option row counts are not compared)
   ```
   Expected `"verdict": "BACKUP_V2_VALID"`. Claude Code can also run this for you.
10. **Cleanup**: none needed. The job deletes its plaintext temp file and fails if one is left; the
    ephemeral verification key and the isolated restore database end with the job. Do **not**
    delete any R2 object (Run #6 and Run #7 objects stay as Evidence).

## Stop conditions (do not re-run blindly)

- Any red step, `ok: false`, `restoreVerified` / `storageVerified` not `true`, `backupVersion`
  not `"2"`, a row count different from Run #7, or a missing `columnCoverage`: stop and send the
  run URL. The run stays as Evidence.
- `column-coverage` phase failure: the backup was **not** uploaded; send the run URL.
- `source-preflight` failure: nothing was exported; send the run URL.
- Never delete R2 objects, never re-run Run #1–#7, never change Secrets to "fix" a failure.
- Production is read-only in this workflow (SELECT by `reference_data_backup_reader`); no apply,
  restore or rollback happens.

## Safe result to send

> Stage 3 Backup v2実行完了。run URL: <URL>。summary artifactを./data/stage3-backup-v2/へ保存済み。

Include only: the run URL, conclusion, and optionally the summary JSON (it has no secrets:
object keys, counts, checksums, flags). Never paste DB URLs, CA certificates, age keys or R2
credentials.

## Known limitation (unchanged, not a blocker)

The manifest's `postgresMajorVersion` is the configured value `16` (the isolated verification
database is `postgres:16`), while Production runs PostgreSQL 17. Restore compatibility checks
compare the manifest with that same configured value, so this does not block restore; it is
recorded here so the field is not read as the Production server version.
