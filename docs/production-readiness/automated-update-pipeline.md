# Reference-data update pipeline — one approval per update

Owner instruction 2026-09-27: when all normal conditions hold, the update runs automatically up to Apply, and the owner acts **once**, via Approve and deploy on the Production Apply run.

## 1. Before and after

| Step | Before (Stage 4) | After (this pipeline) |
|---|---|---|
| Detection (weekly) | automatic | automatic (unchanged) |
| Plan: upstream fetch, diff, policy | owner dispatch + Environment approval | **automatic**; read-only credential, no approval |
| Pre-apply Backup v2 + restore check | owner dispatch + Environment approval | **automatic**; same read-only Backup credential, no approval |
| Isolated Dry run | owner dispatch + Environment approval | **automatic**; no Production credential at all |
| Production Apply | owner dispatch + Environment approval | **run created automatically**; the owner's single Approve and deploy |
| Post-verify | inside Apply | inside Apply (unchanged) |
| Evidence / applied-state PR | Claude Code | Claude Code (unchanged) |

Approvals per update: **4 → 1**. Owner dispatches: **4 → 0**.

## 2. Credential boundaries

| Job | Environment | Secrets available | Production access |
|---|---|---|---|
| Orchestrator (`reference-data-update-orchestrator.yml`) | none | **none** (only `GITHUB_TOKEN`: `actions: write`, `contents: read`) | none |
| Plan (`reference-data-production-apply.yml`, mode `plan`) | `reference-data-automation` (no reviewer, `main` only) | `REFERENCE_DATA_PLAN_READ_DB_URL`, `REFERENCE_DATA_PLAN_READ_DB_CA_CERT` only (a read-only role: `reference_data_plan_reader`, or until it exists the existing `reference_data_backup_reader`) | read only; role identity, read-only transaction and "no write privilege" are checked before any read |
| Backup (`reference-data-production-backup.yml`, `execution: automation`) | `reference-data-automation` | the 7 existing Backup secrets | read only (SELECT); writes one new encrypted object to R2 |
| Dry run (`reference-data-production-apply.yml`, mode `dry-run`) | `reference-data-automation` | **none are referenced** | **none**: works only from the Plan run's artifacts (bundle + Production state snapshot, sha256-bound) and a job-local disposable PostgreSQL 17 |
| Apply / verify / preflight | `reference-data-production-apply` (**required reviewer**) | `REFERENCE_DATA_APPLY_DB_URL`, `REFERENCE_DATA_APPLY_DB_CA_CERT` | the only job with a write credential |

- The Apply secrets exist only in the Apply Environment. A Plan or Dry run job cannot read them even by mistake, and the workflow never references them in those modes.
- Backup/R2 secrets and Apply secrets are never in the same job. The Plan job does not reference the Backup/R2 secrets either (the CLI refuses to start if they, or the Apply secrets, are present).
- The reviewer on `reference-data-production-apply` and on `production-backup-approval` is unchanged. Manual Backup runs still use `production-backup-approval`.
- `reference-data-automation` must allow deployments from `main` only. That keeps a pull-request branch from reaching its secrets.

## 3. Automatic progression and stop conditions

The orchestrator starts only when the repository variable `REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED` is exactly `true` (default: unset, so nothing runs). A manual run needs confirm `orchestrate`. The orchestrator runs one dataset at a time (World first, then Managers).

It chains the steps as separate `workflow_dispatch` runs on the same `main` commit. The existing bindings therefore apply unchanged:
- same SHA
- run facts from the GitHub API
- the Plan run is the latest one
- the Backup is newer than the Plan and less than 24 h old
- source and plan checksums
- manual-review acknowledgement
- the 28 Apply prerequisites
- advisory lock, stale-plan detection, post-verify

It stops **without creating an Apply run** if any of the following occurs:

| Stage | Stops when |
|---|---|
| Detection | not `update_available`, `attention_required`, or `ok: false` |
| Plan | `ok: false`, or any plan problem: removed > 0, duplicate > 0, invalid > 0, hard block > 0, schema drift / incomplete snapshot (the plan fails), future timestamp, timestamp regression, count drop over the threshold (hard block), unexpected target table, zero changes, rehearsal scope exceeded |
| Backup | run not successful, validator not `BACKUP_V2_VALID`, `restoreVerified` / `storageVerified` false, content policy, category not `pre-apply` |
| Dry run | `ok: false`, isolated validation not verified, re-diff ≠ 0, checksum mismatch, undo simulation failure |
| Any stage | the main SHA changed between steps; a step timed out; a newer orchestrator run exists (concurrency group, no cancel) |

Nothing is retried automatically. After Apply is approved:
- the Apply run re-verifies everything against live Production (stale plan, Backup age and counts) and then post-verifies;
- Claude Code writes the Evidence and applied-state PR.

## 4. What the owner sees (one screen)

The orchestrator's job summary and its `reference-data-update-approval` artifact show:
- dataset, target tables and main SHA
- Production before count, candidate after count
- added, structural changed, card_rating-only changed, removed, duplicate, schema drift, hard block
- Backup run and validity (expiry), Dry run run, re-diff and checksums, manual-review reasons
- the writes Apply will perform, and what is not approved
- the Apply run URL and a ready-to-paste approval comment

## 5. Owner setup (once)

1. **Create the Environment.** GitHub → Settings → Environments → **New environment** `reference-data-automation`.
   - Deployment branches: **Selected branches → `main`**.
   - Required reviewers: none.
2. **Add Secrets to it.**
   - Plan (read only), 2 secrets: `REFERENCE_DATA_PLAN_READ_DB_URL` and `REFERENCE_DATA_PLAN_READ_DB_CA_CERT`. Use the **same values** as `REFERENCE_DATA_BACKUP_DB_URL` / `REFERENCE_DATA_BACKUP_DB_CA_CERT` (the read-only `reference_data_backup_reader`). A dedicated `reference_data_plan_reader` role can replace it later (`sql/create-reference-data-plan-reader-role.sql`, design only, needs a separate approval).
   - Backup, the 7 existing Backup secrets with the **same values** as in `production-backup-approval`:
   - `REFERENCE_DATA_BACKUP_DB_URL`
   - `REFERENCE_DATA_BACKUP_DB_CA_CERT`
   - `REFERENCE_DATA_BACKUP_AGE_RECIPIENT`
   - `REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID`
   - `REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY`
   - `REFERENCE_DATA_BACKUP_R2_ENDPOINT`
   - `REFERENCE_DATA_BACKUP_R2_BUCKET`
3. **Enable the pipeline.** Repository variable `REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED` = `true`.

**Do not** add the Apply secrets to `reference-data-automation`. **Do not** remove reviewers from any existing Environment.

Until setup is done:
- nothing runs automatically (the variable is unset);
- a manual `plan` run stops at the secret check before any connection, because the Plan secrets now live in `reference-data-automation`;
- manual Backup (`production-backup-approval`) and manual `apply` / `verify` / `preflight` are unchanged.

Note: GitHub creates an Environment that a workflow names but that does not exist yet, with no rules. Create `reference-data-automation` with the `main`-only rule **before** any Plan or Dry run.

## 6. Level 3 (fully automatic Apply) — policy only, not enabled

Level 3 would let only additions and `card_rating`-only changes apply without the owner. **It is not implemented and must not be enabled without an explicit owner decision.**

Readiness criteria (all required):
- ≥ 10 consecutive normal batches with the one-approval pipeline
- ≥ 8 weeks of operation
- Backup success rate 100 %
- 0 missed anomalies
- false-positive rate < 10 %
- a successful rollback rehearsal
- a recorded schema-drift case handled safely

Permanent owner-only items, even under Level 3:
- removals
- structural changes
- Managers changes
- rollback
- Restore

Implementation sketch for later:
- a separate Environment with no reviewer for Apply limited to `added`/`card_rating_only` diffs;
- a stricter policy gate (plan must contain only those change kinds);
- a weekly cap on rows changed;
- the same Backup, Dry run and post-verify.
