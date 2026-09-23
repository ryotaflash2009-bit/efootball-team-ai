# Reference Data Auto-Update — Phase G Preparation: Updater Role

Status: SQL drafts, TypeScript contract, static audits and disposable-PostgreSQL tests. **Nothing
was applied to Production; no role, password, Secret or GitHub Environment was created.**
Applying this is Stage 2 and needs separate approval.

## 1. Files

| file | purpose |
|---|---|
| `docs/production-readiness/sql/create-reference-data-updater-role.sql` | prechecks, `create role`, schema usage, table SELECT, column-level INSERT/UPDATE, session settings |
| `docs/production-readiness/sql/create-reference-data-updater-rls-policies.sql` | 9 policies scoped to `reference_data_updater` (no DELETE policy) |
| `docs/production-readiness/sql/verify-reference-data-updater-role.sql` | catalog/information_schema only |
| `docs/production-readiness/sql/rollback-reference-data-updater-role.sql` | `nologin` first, drop the 9 policies, revoke, drop role; no row changes |
| `src/lib/reference-data/auto-update/updater-role.ts` | `UPDATER_COLUMN_GRANTS` (single source of truth), never-updated columns, settings, policy names |
| `src/lib/reference-data/auto-update/updater-role-sql-audit.ts` | static audits of the 4 SQL files |

## 2. Privilege design (enforced by the database)

| table | SELECT | INSERT (columns) | UPDATE (columns) | DELETE / TRUNCATE |
|---|---|---|---|---|
| `world_player_cards` | yes | source columns + `fetched_at`, `dataset_version`, `import_batch_id` | source columns except `world_card_id`, `ai_styles`, `appearance` + apply metadata + `updated_at` | no |
| `managers` | yes | `internal_manager_id` + source columns + apply metadata | source columns except `source`, `source_manager_id` + apply metadata + `updated_at` | no |
| `import_batches` | yes | batch columns (RLS: only `status = 'pending'`) | `status`, `verified_at`, `rolled_back_at` (RLS: only `pending` rows) | no |
| `player_card_analysis`, `auth.*`, `public.*`, `reference_data_ops` | no | no | no | no |

- eFHUB-derived columns (`efhub_card_id`, `efhub_conflicts`), preserved columns, identities and
  `created_at` cannot be updated even by a buggy apply; this mirrors the Phase C/D rules.
- Role attributes: `LOGIN`, no password in SQL, `NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS NOINHERIT`, `CONNECTION LIMIT 1`; `statement_timeout 120s`,
  `lock_timeout 5s`, `idle_in_transaction_session_timeout 60s`, `search_path reference_data`.
- RLS stays `FORCE`; existing public SELECT and Backup-reader policies are untouched.
- Separate from `reference_data_backup_reader` (no shared role or credential).

## 3. Verification

- Static (`updater-role-sql-audit.test.ts`, 6 tests): all four files pass; the audit catches
  DELETE/TRUNCATE grants, preserved-column UPDATE grants, password literals, BYPASSRLS, out-of-scope
  tables, DELETE policies, a non-pending `import_batches` update policy, row changes in rollback
  and row reads in verify.
- PostgreSQL (`updater-role.postgres.test.ts`, 5 tests): the four SQL files run verbatim against a
  schema built from the repository DDL, with RLS enabled and forced (only the schema name is
  rewritten to `reference_data_updater_role_test`). Verify output equals the contract. Allowed
  INSERT/UPDATE work. UPDATE of `ai_styles`, `appearance`, `efhub_*`, identities or `created_at`,
  and INSERT of `efhub_card_id`, are `permission denied`. DELETE, TRUNCATE and
  `player_card_analysis` are denied. Non-pending `import_batches` rows are unchanged, and inserting
  a non-pending batch violates RLS. Rollback removes policies/grants/role without changing rows.
  Local disposable `postgres:17`: 8 files / 42 tests (container removed).

## 4. Staging without `reference_data_ops` in Production

Decision: **no `reference_data_ops` schema in Production** for the first rehearsal. Detection
(Phase B–E) runs in CI, and the plan (staging dataset, diff plan, candidate summary; public
reference data only) is kept as a workflow artifact bound to the idempotency key and source
checksum. The apply job re-downloads the artifact, re-verifies its checksums and re-diffs against
live Production rows immediately before writing. Approval uses the GitHub Environment
`reference-data-production-apply` (required reviewer), not a database table. The existing
`create-reference-data-ops-schema.sql` draft stays unapplied.

## 5. Stage 2 checklist (human, separate approval)

1. Read-only check that Production matches the repository DDL columns (Known Gap 7; also needed
   for the Backup format 2 in Stage 3).
2. Run `create-reference-data-updater-role.sql`, then `create-reference-data-updater-rls-policies.sql`,
   in the Supabase SQL Editor.
3. Run `verify-reference-data-updater-role.sql` and compare with `UPDATER_COLUMN_GRANTS`.
4. Set the role password outside the repository; register `REFERENCE_DATA_APPLY_DB_URL` and
   `REFERENCE_DATA_APPLY_DB_CA_CERT` only in the `reference-data-production-apply` Environment
   (required reviewer). Never share them with the Backup Environment.
5. Emergency stop: `alter role reference_data_updater nologin;` then delete the Environment Secret.
   Full removal: `rollback-reference-data-updater-role.sql`.
