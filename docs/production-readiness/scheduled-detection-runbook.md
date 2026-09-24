# Scheduled update detection — runbook (owner operations)

`.github/workflows/reference-data-update-detection.yml` checks whether the upstream reference data changed
since the last verified Production apply. It uses **no Secrets, no Environment and no Production
connection**, and it **never applies anything**: when it reports `update_available`, the owner runs the
approval-gated plan → Backup → dry-run → apply sequence (`stage4-world-rehearsal-runbook.md`,
`stage4-managers-rehearsal-runbook.md`).

## What one run does

1. Refuses to send any request unless the repository variable `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED`
   is exactly `true` (the job is skipped otherwise; a smoke test re-checks this on every run).
2. Fetches the World catalogue once (≈ 443 page requests, 3 s apart, ≈ 23 min; caps 462 requests /
   40 MB) and managers.json once.
3. Normalises both and compares the source checksum (first 12 characters), record counts and
   `appearance.updatedAt` against `docs/production-readiness/reference-data-applied-state.json`.
4. Uploads `reference-data-detection-summary` with, per dataset, `decision`:
   `no_change` · `update_available` · `attention_required` (count drop beyond the policy threshold,
   future timestamps, or a regression against the applied maximum), plus counts and request statistics.

The applied-state record is updated by Claude Code in the Evidence PR after every verified apply. Until
the World rehearsal is applied, World has no applied baseline, so detection reports `update_available`
with `no_applied_baseline`.

## Enabling (owner approval required — not done)

Recommended order: finish the World apply and its Evidence PR first, so the first scheduled run compares
against the new baseline.

1. **Variable:** GitHub → repository **Settings → Secrets and variables → Actions → Variables** →
   **New repository variable** `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED` = `true`.
   Undo: delete the variable (the job is skipped immediately).
2. **First manual run:** Actions → "Reference data update detection" → **Run workflow** (branch `main`).
   Check the summary artifact: `ok: true`, `upstream.worldRequests` ≈ 443 with `non200: 0`,
   `managersRequests: 1`, `productionAccess: 0`, `automaticApply: false`, decisions as expected.
3. **Schedule:** approve adding the trigger (weekly, proposed `17 18 * * 0` = Mondays 03:17 JST).
   Claude Code then opens a PR that adds only the `schedule:` block; merge it after Checks pass.
   Undo: remove the variable (instant) or revert the PR.

## Stop conditions

`attention_required`, any `ok: false`, non-200 responses, or request counts far from ≈ 444: do not start a
Production plan; send the run URL. Never add Secrets or an Environment to this workflow.
