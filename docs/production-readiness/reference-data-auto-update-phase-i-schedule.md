# Reference Data Auto-Update — Phase I: Schedule Framework (disabled)

Status: framework only, disabled by default. **No cron trigger exists; nothing runs on a
schedule; the workflow was not dispatched.**

## 1. Pieces

| piece | behaviour |
|---|---|
| `src/lib/reference-data/auto-update/update-schedule.ts` | `SCHEDULE_POLICY` (only `detection` is schedulable; `backup`, `production_apply`, `rollback`, `restore` never), `decideDetectionRun` (fail-closed), proposed cron `17 18 * * *` (18:17 UTC / 03:17 JST, once a day) |
| `.github/workflows/reference-data-update-detection.yml` | `workflow_dispatch` only; `contents: read`; no Secrets, no Environment; concurrency group `reference-data-update-detection`; the job is skipped unless the repository variable `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED` is exactly `true`, and even then it fails before any request because the real transport is not approved |

`decideDetectionRun` requires all three: a schedulable stage, the variable exactly `"true"`, and
an approved real transport (`REAL_NETWORK_ACCESS_ENABLED`, currently `false`).

## 2. Guarantees checked by tests (`update-schedule.test.ts`)

- The decision matrix is fail-closed (`TRUE`, `1`, `yes` and empty values do not enable it).
- Backup, apply, rollback and restore are never schedulable.
- The detection workflow has only `workflow_dispatch` (no `schedule`, `push`, `pull_request`,
  `workflow_run`, `repository_dispatch`), read-only permissions, no Secrets, no Environment, the
  detection concurrency group, the exact enable-variable condition, and no checkout, `npm`, `node`,
  `curl` or `wget` step.
- **Repository-wide: no workflow file has a `schedule:` trigger.**

## 3. Enabling later (each step needs separate approval)

1. Stage 1: implement and approve the real HTTP transport; verify the first upstream access
   manually.
2. Replace the stop step with the detection entrypoint (Phase E pipeline → artifact upload), still
   dispatch-only, and rehearse.
3. Only then add the `schedule:` trigger (detection only) and set the repository variable. Keep
   Backup, apply and rollback on `workflow_dispatch` + Environment approval.
