# Stage 2 Runbook — Production Updater Setup (owner-only operations)

Everything below has been prepared and rehearsed on a disposable PostgreSQL that mirrors Production:
the repository DDL with forced RLS, the Backup reader role and its policies, and each SQL file run
verbatim. Claude Code does **not** run anything in Production, never sees the password, and never
reads Secrets. Do the steps in one sitting, in order. Stop at the first failure and report only
what the "report" line asks for.

Prepared files:

| file | kind |
|---|---|
| `docs/production-readiness/sql/stage2-production-metadata-check.sql` | read-only metadata (run twice: before and after) |
| `docs/production-readiness/sql/create-reference-data-updater-role.sql` | creates the role (prechecks; no password) |
| `docs/production-readiness/sql/create-reference-data-updater-rls-policies.sql` | 9 policies for the role only |
| `docs/production-readiness/sql/verify-reference-data-updater-role.sql` | read-only verification |
| `docs/production-readiness/sql/rollback-reference-data-updater-role.sql` | emergency removal (only if told to) |
| `scripts/reference-data-scram-verifier.mjs` | local, offline: turns your password into a SCRAM verifier |
| `.github/workflows/reference-data-production-apply.yml` | dispatch-only, **read-only preflight** (no apply mode exists) |

## Step 1 — metadata before (Supabase Dashboard → SQL Editor)

1. Open Supabase Dashboard → your project → **SQL Editor** → **New query**.
2. Paste the whole content of `stage2-production-metadata-check.sql` → **Run**.
3. Success: one row, one column `stage2_metadata` containing JSON.
4. Keep the JSON (copy it to a local text file). It contains only table/column/role/policy
   metadata: no data, no passwords.

## Step 2 — create role and policies (SQL Editor)

1. New query → paste `create-reference-data-updater-role.sql` → **Run**.
   Success: "Success. No rows returned". Any `blocked: ...` error: stop.
2. New query → paste `create-reference-data-updater-rls-policies.sql` → **Run**. Same success
   signal.

## Step 3 — set the password without typing it into SQL (your PC)

1. Create a new password in your password manager: at least 24 printable ASCII characters, no
   spaces, no `'` or `\`. Keep it only in the password manager.
2. In a terminal in the repository folder, run `node scripts/reference-data-scram-verifier.mjs`.
   Type the password twice (it is not shown).
3. The tool prints one line:
   `alter role reference_data_updater with password 'SCRAM-SHA-256$4096:...';`
4. SQL Editor → new query → paste **only that line** → **Run**. The plain password never reaches
   Supabase's SQL history.
5. Do **not** paste the password or that line into chat, Git, issues or screenshots.

## Step 4 — verify (SQL Editor)

1. Run `verify-reference-data-updater-role.sql`. Expected: role
   `login=true`, `super/createdb/createrole/replication/bypassrls/inherit=false`, `connlimit=1`;
   SELECT on 3 tables only; 9 policies, none DELETE; RLS enabled and forced on all 3.
2. Run `stage2-production-metadata-check.sql` again and keep the second JSON.

## Step 5 — GitHub Environment and Secrets (github.com, browser)

1. Repository → **Settings → Environments → New environment** → name exactly
   `reference-data-production-apply` → **Configure environment**.
2. **Required reviewers**: add yourself → **Save protection rules**. Optionally restrict
   deployment branches to `main`.
3. In that Environment → **Add environment secret** (twice):
   - `REFERENCE_DATA_APPLY_DB_URL`: the same connection form as the Backup secret, but with the
     updater role: `postgresql://reference_data_updater.<project-ref>:<password>@<pooler-host>:5432/postgres`
     (Session pooler; no `sslmode` or other TLS parameters, which the code rejects).
   - `REFERENCE_DATA_APPLY_DB_CA_CERT`: the same Supabase root CA PEM already used for Backup.
4. Never add these to the Backup Environment, and never reuse the Backup secrets here.

## Step 6 — read-only preflight from GitHub Actions

1. Repository → **Actions** → "Reference data Production apply (manual, approval-gated; preflight
   only)" → **Run workflow** → branch `main`, confirm `preflight`, mode `preflight` → **Run workflow**.
2. Approve the Environment deployment when asked.
3. Success: the job is green and the artifact `reference-data-apply-preflight-summary` shows
   `"ok": true` with `problems: []`. The job connects as the updater inside `begin read only`, reads
   catalog/privilege metadata only, and rolls back.

## Report to Claude Code (safe to paste)

- Step 1 JSON (metadata before) and Step 4 JSON (metadata after)
- The Actions run URL of Step 6 (Claude reads its status and the summary artifact read-only)

Resume message:

> Stage 2完了。metadata(before/after)のJSONとpreflightのrun URLを貼ります。検証してStage 3準備へ進んで。

## Stop conditions

- Any `blocked:` error, permission error, or unexpected output: stop, do not retry, report the
  step number and the error text (no passwords).
- Preflight red: do not re-run blindly; send the run URL.
- Emergency: `alter role reference_data_updater nologin;` then delete the two Environment secrets.
  Full removal only if asked: `rollback-reference-data-updater-role.sql`.

## What Claude Code does after your report

1. Validates both metadata JSONs with `production-metadata-contract.ts` (pre and post).
2. Reads the preflight run status and its summary artifact (read-only GitHub API).
3. Records sanitized Evidence, then continues with Stage 3 preparation (Backup v2 checks, expected
   outputs, artifact validator). It stops again right before the Backup v2 `workflow_dispatch`.
