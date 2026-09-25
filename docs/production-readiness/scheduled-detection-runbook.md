# Scheduled update detection — runbook (owner operations)

`.github/workflows/reference-data-update-detection.yml` checks whether the upstream reference data changed
since the last verified Production apply. It uses **no Secrets, no Environment and no Production
connection**, and it **never applies anything**: when it reports `update_available`, the owner decides
whether to run the approval-gated plan → Backup → dry-run → apply sequence
(`stage4-world-rehearsal-runbook.md`, `stage4-managers-rehearsal-runbook.md`). The workflow has
`permissions: contents: read` only, so it cannot dispatch other workflows, commit, or open PRs.

## Status (2026-09-25)

- Repository variable `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED` = `true` (set by the owner).
- First manual detection: Run #1 (attempt 1) succeeded — World `update_available` (same 13,297 cards and
  same newest `appearance.updatedAt` as applied; checksum differs, most likely `card_rating` churn),
  managers `no_change`. Evidence: `evidence/detection-first-manual-run-2026-09-25.json`.
- Weekly schedule: `cron: "17 18 * * 0"` = Sundays 18:17 UTC = **Mondays 03:17 JST** (GitHub cron is UTC).

## What one run does

1. **Gate (same for schedule and manual).** The job runs only if the variable is exactly `true`, and the
   run is either scheduled or manual with confirm `detect`. Otherwise the job is skipped and no request is
   sent. The CLI checks the variable again, then the trigger. A smoke test proves 0 requests when the
   variable is not set.
2. **Fetch.**
   - World catalogue once: about 444 page requests, 3 s apart, about 25 min.
   - Limits: at most 462 requests, 40 MB and 14,000 records; 20 s timeout; one request at a time.
   - 403, 429 or CAPTCHA/challenge stops the run immediately.
   - Network, 5xx or timeout errors get at most 2 retries, honouring Retry-After.
   - managers.json: 1 GET.
3. **Compare.** Both datasets are normalised. For each one, the run compares the source checksum
   (same basis as the applied candidate), the record count and `appearance.updatedAt` against
   `docs/production-readiness/reference-data-applied-state.json`.
4. **Summary.** The run uploads `reference-data-detection-summary` (schema
   `reference-data-detection-summary/v2`) and nothing else. It contains:
   - per-dataset `decision`, counts, 12-character checksum prefixes and quality (complete, duplicates,
     rejected records, schema drift);
   - request statistics (403, 429 and challenge counts);
   - `overall`;
   - `safety`: Production 0, Secrets 0, no automatic plan, Backup, apply, rollback or Restore, no
     applied-state update, no raw payload stored.

   Page bodies are never stored.

| Result | Meaning | Job |
|---|---|---|
| `no_change` | upstream equals the applied state | green |
| `update_available` | upstream changed; **nothing is applied** — owner reviews | green |
| `attention_required` | count drop over threshold, future timestamps, regression, duplicate identity, schema drift, incomplete snapshot, rejected records, record cap | **red** (GitHub failure email) |
| `fetch_stopped` | 403 / 429 / CAPTCHA / network / caps | **red** |

The applied-state record is updated only by Claude Code, in the Evidence PR after a verified apply.

## Checking a run

Download the artifact into `./data/<folder>/`, which is git-ignored, and run:

```
npx tsc -p tsconfig.update-detection.json
node scripts/validate-detection-summary-entry.mjs ./data/<folder>/reference-data-detection-summary.json
```

The expected result is `"verdict": "DETECTION_SUMMARY_VALID"`. The validator checks:
- the safety fields and request counts;
- that there are no 403, 429 or challenge responses;
- data quality;
- that each decision agrees with the applied-state checksum comparison;
- that no row data or page bodies are present.

## Owner operations

- **Manual detection:** Actions → **"Reference data update detection (weekly + manual; detection only)"**
  → **Run workflow** → branch `main`, confirm `detect`. No Environment approval is needed.
- **When the result is `update_available`:** decide whether to update. If you do, follow the Stage 4
  runbook (Plan → Backup → Dry run → Apply, each approval-gated). The Plan summary shows which fields
  changed.
- **Pause everything:** delete the variable, or set it to anything other than `true`. From then on, every
  scheduled and manual run is skipped with 0 requests.
- **Remove the schedule:** revert the schedule PR.
- **Inactivity:** GitHub pauses scheduled workflows after 60 days without repository activity. Re-enable
  the workflow from the Actions page.

## Stop conditions

Stop if any of these occurs:
- a red job, `attention_required` or `fetch_stopped`;
- a validator verdict other than VALID;
- any non-200 response;
- request counts far from about 445;
- `productionAccess` not 0.

When one occurs:
- do not start a Production plan;
- send the run URL;
- do not rerun blindly;
- never add Secrets, an Environment or write permissions to this workflow.

Nothing in this workflow triggers Backup, apply, rollback or Restore.
