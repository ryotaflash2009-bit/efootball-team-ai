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

## 5. World one-time full completeness scan (owner-approved, 2026-09-23)

Approval: one run only; 443 pages, at most 14,000 records, 40 MB and 445 requests (443 pages plus
the 2-retry budget); CREATED_AT only, 3-second interval, 20-second timeout. This does **not**
approve recurring full scans, schedules or Production updates. The CLI mode `world-full` requires
the approval id and refuses to run again once its Evidence exists.

Added guards: total transfer cap in the transport (`transfer_cap_exceeded`), an immediate stop on
the first duplicate identity during the scan, a record cap checked during the scan, and a
World-only run (managers.json was not requested again).

| item | result |
|---|---|
| requests / outcome | 443 / all HTTP 200, 0 retries, no 403/429/CAPTCHA/redirect |
| duration / transfer | 22 min 14 s (14:14:47–14:37:01 UTC) / 29.1 MB (avg 281 ms, max 656 ms per request) |
| records / unique identities / duplicates / rejects | 13,286 / 13,286 / 0 / 0 |
| schema drift | none (all records normalized) |
| completeness | complete (443 contiguous pages, totalPages/totalCount stable, last page `hasNext=false`); removal detection allowed |
| diff vs SQLite-derived current state (13,009) | **added 277, changed 5,879, removed 0, unchanged 7,130** |
| changed fields | `card_rating` 5,816 · `ovr_max` 125 · `maximum_level` 96 · `name_ja` 1 |
| preserved column drift (not applied) | `appearance` 13,009 (every existing row), `ai_styles` 0 |
| policy | `manual_review`: `baseline_missing`; warnings `world_change_near_threshold` (6,156 of 7,500), `world_count_increase`, `preserved_column_drift`; next state `awaiting_review` |
| isolated dry run | verified: 277 inserted, 5,879 updated, after checksum equal, re-diff 0 |
| rollback simulation | executor apply ok; undo restored all 5,879 updated rows (checksum of existing rows equals before); 277 inserted rows remain for a manual decision; 22 s |

### Source timestamps (`appearance.updatedAt`)

All 13,286 values have **no time zone** and are interpreted as UTC (provisional, unchanged policy;
nothing is silently corrected). Range 2026-04-28T17:17:02Z to 2026-09-19T14:22:37Z. There are no
future values and no regression (the SQLite maximum was 2026-08-27T16:09:27Z). The largest group
sharing one identical timestamp is a single row. Backup v2 can prove that this column is stored
and restored intact, **not** that the UTC interpretation is semantically right. This stays an
**unresolved item before any Production apply**.

### Items for owner review (not acted on)

1. `card_rating` changed on 5,816 cards (44% of the dataset). It looks like a frequently
   recalculated upstream value. If every run carries it, change volume will sit near the 7,500
   manual-review threshold. Options: keep it (review each time), treat it as volatile, or exclude
   it from automatic updates. This is a policy decision, not made here.
2. `appearance` (a preserved column) differs from upstream on **every** existing row, including
   rows with no other change. That points to a systematic representation difference between the
   detail-extension import and the search response, not 13,009 real changes. Automatic updates keep
   the current values (Phase D). Diagnose it before any decision to refresh `appearance`.
3. The current state is rebuilt from local SQLite (same transforms as the original import), not
   read from Production. Stage 4 must re-diff against Production (Backup v2 or read-only check).
