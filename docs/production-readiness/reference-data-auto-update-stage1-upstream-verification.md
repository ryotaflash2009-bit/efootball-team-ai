# Reference Data Auto-Update — Stage 1: First Upstream Read Verification (2026-09-23)

Status: **managers.json verified end to end; eFootball World stopped on upstream contract drift
(owner decision needed).** Owner-approved, read-only. No Production, R2 or Secret access.

## 1. What ran

| run | upstream requests | result |
|---|---|---|
| `probe` — World page 1 (CREATED_AT) | World 1 (HTTP 200, 65 KB, 261 ms) | schema matches; pagination changed (see 3) |
| `incremental` — World UPDATED_AT page 1 | World 1 (HTTP 400, 180 B) | stopped: `unexpected_status` |
| `managers` — managers.json | managers.json 1 (HTTP 200, 37 KB, 318 ms) | complete; diff, policy, dry run and rollback simulation passed |

Total: **3 upstream requests.** No retries were needed; no 403, 429 or CAPTCHA. No cookie,
authorization or login was sent, and redirects were not followed. Raw payloads were kept in memory
only. Sanitized Evidence: `docs/production-readiness/evidence/stage1-*.json`.

## 2. New code

| file | purpose |
|---|---|
| `upstream-http-transport.ts` | real HTTP transport. It needs an explicit approval token and only allows the endpoints in `SOURCE_ENDPOINTS`. No cookies or authorization, `redirect: manual`, `credentials: omit`, 20 s timeout. It enforces the per-source minimum interval (World 3 s), one request at a time, a streaming byte cap and a per-run request cap. Its log is safe (no URL, body or header values). |
| `source-transport.ts` | content-type allowlist per endpoint (World `application/json`, managers.json `application/json`/`text/plain`). `Retry-After` is honored for retryable 5xx (capped at 60 s). New codes `unexpected_content_type`, `request_cap_exceeded` and `approval_missing`. `REAL_NETWORK_ACCESS_ENABLED` stays `false`, so scheduled detection is still not approved. |
| `source-world.ts` | upstream `appearance.updatedAt` has no time zone. Values in ISO date-T-time form are read as UTC (`assumeUtcIfNaiveIso`), which is how Production's `timestamptz` stored them. Other malformed forms are still rejected. |
| `sqlite-current-state.ts` | read-only rebuild of Production-shaped current rows from local SQLite, using the same transforms as the original Production import (boost as text, eFHUB link, AI styles, appearance, conflicts, name sort key). All 13,009 World and 66 manager rows pass the contract canonicalization. |
| `update-dry-run.ts` | World full-scan page and record caps, checked on page 1 before any further request (`cap_exceeded`) |
| `stage1-verification.ts` / `-cli.ts` + `scripts/reference-data-stage1-verify-entry.mjs` + `tsconfig.stage1-verification.json` | probe / full / incremental / managers modes, sanitized Evidence, and isolated validation on a disposable PostgreSQL: Phase E dry run plus a rollback simulation using the real executor and undo as `reference_data_updater` |

Stage 1 limits: World 30 pages / 15,000 records per run, managers.json 500 records.

## 3. eFootball World — upstream contract drift (stop)

1. **Page size is fixed at 30.** `size: 500` is ignored, giving 443 pages for 13,286 records. The
   existing sync design assumed about 27 requests; a full scan now needs **443 requests, about
   23 minutes at the 3-second interval**. That exceeds the Stage 1 cap (30 pages), so the full
   scan was stopped before page 2.
2. **`sortBy: "UPDATED_AT"` is rejected (HTTP 400).** The incremental approach of the existing
   `sync-world-players-incremental.mjs` and the Phase B planner no longer works.
3. Record schema: **unchanged.** All 52 expected fields were present in 100% of page-1 records,
   there were no unknown fields, and all 30 records normalized (0 rejects). Upstream count is 13,286
   against 13,009 in local SQLite and in Production at Run #7.

No request parameters were guessed and the page cap was not raised: both change the load on the
source and need an owner decision (see the final report for options).

## 4. managers.json — verified

| check | result |
|---|---|
| records / unique identities / rejects / duplicates | 67 / 67 / 0 / 0 |
| completeness | complete (removal detection allowed) |
| diff vs SQLite-derived current state | added 1, changed 0, removed 0, unchanged 66 (boosters and link-up plays identical) |
| policy | `manual_review` (`manager_change`, `baseline_missing`), next state `awaiting_review` |
| isolated dry run | verified (after checksum equal, re-diff 0) |
| rollback simulation | executor apply ok, undo ok, before state restored for existing rows; the 1 inserted row remains, listed for a manual decision |

The current state is rebuilt from local SQLite, not read from Production. Stage 4 must re-check it
against Production (Backup v2 or a read-only check).
