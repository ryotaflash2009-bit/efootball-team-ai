# Scheduled update detection — runbook (owner operations)

`.github/workflows/reference-data-update-detection.yml` checks whether the upstream reference data changed
since the last verified Production apply. It uses **no Secrets, no Environment and no Production
connection**, and it **never applies anything**: when it reports `update_available`, the owner runs the
approval-gated plan → Backup → dry-run → apply sequence (`stage4-world-rehearsal-runbook.md`,
`stage4-managers-rehearsal-runbook.md`). The workflow has `permissions: contents: read` only, so it cannot
dispatch other workflows.

## What one run does

1. The job runs only if the repository variable `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED` is exactly
   `true` **and** the run is either scheduled (once a schedule is approved) or manual with confirm `detect`.
   Otherwise the job is skipped and no request is sent; the CLI re-checks the variable, and a smoke test
   proves 0 requests when it is not set.
2. Fetches the World catalogue once (≈ 444 page requests, 3 s apart, ≈ 25 min; caps 462 requests / 40 MB,
   20 s timeout, one request at a time; 403 / 429 / CAPTCHA stop immediately; network / 5xx / timeout get at
   most 2 retries honouring Retry-After) and managers.json once (1 GET).
3. Normalises both and compares, per dataset, the source checksum (the same basis as the applied candidate:
   first 12 characters), record counts and `appearance.updatedAt` against
   `docs/production-readiness/reference-data-applied-state.json` (World 13,297 / `33fb0c2ee49c`,
   managers 67 / `8c1d654ec48e` as of 2026-09-25).
4. Uploads `reference-data-detection-summary` only: per dataset `decision` = `no_change` ·
   `update_available` · `attention_required` (count drop beyond the policy threshold, future timestamps, or a
   regression against the applied maximum), counts, 12-character checksum prefixes, request statistics,
   `productionAccess: 0`, `automaticApply: false`.

The applied-state record is updated by Claude Code in the Evidence PR after every verified apply.

## Owner steps

1. **Variable** (GitHub → repository **Settings** → **Secrets and variables** → **Actions** → tab
   **Variables** → **New repository variable**): Name `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED`,
   Value `true` → **Add variable**. Not a secret. Undo: delete the variable (all runs are skipped at once).
2. **First manual detection**: Actions → **"Reference data update detection (manual; schedule needs owner
   approval)"** → **Run workflow** → branch `main`, confirm `detect` → **Run workflow**. No Environment
   approval is involved. ≈ 25–30 min.
   Success: job green; artifact `reference-data-detection-summary` has `ok: true`,
   `upstream.worldRequests` ≈ 444, `managersRequests: 1`, `non200: 0`, `productionAccess: 0`,
   `automaticApply: false`; `world.decision` and `managers.decision` are `no_change` if upstream did not
   change since the World plan (2026-09-25 09:21 UTC), otherwise `update_available` (both are fine — no
   action is taken automatically).
3. **Schedule PR** (after the first run succeeds and you approve): Claude Code opens a PR that only adds
   ```yaml
     schedule:
       - cron: "17 18 * * 0"   # Sundays 18:17 UTC = Mondays 03:17 JST
   ```
   under `on:`, and updates the tests that currently require "no schedule anywhere" to allow exactly this
   trigger in this workflow only. Merge after Checks pass. Undo: delete the variable (instant) or revert the
   PR. Note: GitHub pauses scheduled workflows after 60 days without repository activity.

## Stop conditions

`attention_required`, `ok: false`, any non-200 response, a 403/429/CAPTCHA stop, request counts far from
≈ 445, or `productionAccess` not 0: do not start a Production plan; send the run URL. Never add Secrets or
an Environment to this workflow. Nothing here triggers Backup, apply, rollback or Restore.
