# Reference Data Auto-Update — Phase B: Fetcher / Normalizer / Snapshot

Status: implemented locally with recorded synthetic fixtures. **No upstream network access,
no Production access, no new dependencies.** Real HTTP transport is intentionally not
implemented; it belongs to Stage 1 (first upstream network verification, separate approval).

Parent design: `reference-data-auto-update-architecture-v2.md` (chapters 4, 5, 9, 13, 23).

## 1. Modules

| file | role |
|---|---|
| `src/lib/reference-data/auto-update/source-transport.ts` | endpoint allowlist, request builder, response acceptance rules, disabled/recorded transports, retry wrapper, safe errors |
| `src/lib/reference-data/auto-update/source-world.ts` | players/search parser, normalizer (port of `scripts/sqlite/world.mjs`), source row, incremental planner |
| `src/lib/reference-data/auto-update/source-managers.ts` | managers.json parser, normalizer (port of `scripts/sync-managers.mjs`), source row |
| `src/lib/reference-data/auto-update/source-snapshot.ts` | `SourceSnapshot`, completeness, dedup, `StagingDataset`, source checksum, Evidence summary |
| `src/lib/reference-data/auto-update/__fixtures__/source/*.json` | synthetic recorded responses (fictional names/ids; not captured from the real API) |

## 2. Transport boundary

- `REAL_NETWORK_ACCESS_ENABLED = false`. Only two transports exist: `createDisabledSourceTransport()`
  (default; rejects every request with `network_disabled`, sends nothing) and
  `createRecordedFixtureTransport()` (returns recorded responses only; unrecorded requests fail
  with `fixture_missing`).
- A static test forbids `fetch(`, `http`/`https`/`net`/`tls`/`child_process` imports, `undici`,
  `WebSocket` and `process.env` in `source-*.ts`.
- Endpoints are fixed (`https`, fixed host/method/URL). Requests never carry `Cookie` or
  `Authorization`. The retry wrapper refuses a request whose URL/method differ from the allowlist
  before calling the transport.

## 3. Response acceptance (same criteria as the existing scripts)

| condition | code | retry |
|---|---|---|
| 3xx | `redirect` (not followed) | no |
| 429 | `http_429` | no |
| 403 (CAPTCHA text → `captcha`) | `http_403` / `captcha` | no |
| 401 | `http_401` | no |
| 5xx | `http_5xx` | World: yes (max 3 attempts, 5s → 15s); managers.json: no |
| network error / timeout | `network_error` / `timeout` | same as 5xx |
| other status | `unexpected_status` | no |
| `Set-Cookie` header | `set_cookie` | no |
| HTML CAPTCHA page | `captcha` | no |
| token/credential/PII field names in body | `sensitive_content` | no |
| body over size limit / empty | `response_too_large` / `empty_body` | no |

Error messages contain only the fixed code and HTTP status number — never body text, header
values or URLs. Each attempt is recorded as `{stage, attempt, reason, code, at}` (Evidence fields
from `RETRY_POLICIES`).

## 4. Normalization and characterization

- `normalizeWorldPlayerRecord` returns exactly what `normalizeWorldPlayer` in
  `scripts/sqlite/world.mjs` returns (`toEqual` over all fixture records and degenerate inputs).
- `toWorldSourceRow` is checked against the full legacy path: script normalizer → SQLite row
  shape → `transformWorldPlayerCard` → `buildAiStylesMap`/`buildAppearanceMap`. All upstream
  columns match (boost values are compared as the decimal text PostgreSQL stores in the `text`
  column; `appearance_updated_at` compared after UTC normalization).
- Manager boosters/link-up plays are checked against `buildManagerBoostersMap` /
  `buildManagerLinkUpPlaysMap`; stat-name mapping against `STAT_KEY_MAP`; constants
  (source label `amine250`, URL, id regex, aliases, `Link-Up N` default) against the script text.
  `sync-*.mjs` are not imported because they run `main()` (write SQLite) on import.

### Intentional differences from the legacy scripts (fail closed, never silently corrected)

1. World rows whose id is not digits-only are rejected (SQLite allowed `[0-9A-Za-z_-]`; the
   Production DDL requires `^[0-9]{1,20}$`).
2. Integer columns (`ovr_base`, `ovr_max`, `maximum_level`, `age`, `height`, `weight`) that are
   fractional or negative, `ovr_*` above 130, image URLs outside the allowed host/path, and
   `appearance.updatedAt` without a time zone are rejected with reasons (Production would reject
   or misstore them).
3. Incremental comparisons use UTC-normalized timestamps rather than raw strings.
4. When `totalPages` is missing, the incremental planner is bounded by `maxPages` only (the
   script used a fallback of 27).
5. A non-object link-up entry is tolerated as an unnamed play (the script failed that manager).

## 5. Findings for open Phase A items

- **`ai_styles`/`appearance` upstream mapping (Known Gap 6): confirmed.** The search response
  carries `aiStyles` and `appearance`; the legacy syncs persist them to
  `world_player_ai_styles`/`world_player_appearances`, and the source row reproduces the Production
  shape exactly. The contract still lists them in `preserveOnUpdateColumns`; whether automatic
  updates may overwrite them is a Phase D policy decision (Phase B does not change the contract).
- Source rows exclude `efhub_card_id`/`efhub_conflicts` (local eFHUB linkage) and, for managers,
  `internal_manager_id` and the insert-only columns. Phase C merges them from current rows.
- `photo_path` from managers.json is not carried (Production does not store photos).

## 6. Snapshot and StagingDataset

- `buildSourceSnapshot` dedupes rows by contract identity (identical duplicates are merged;
  conflicting duplicates are recorded and block staging), orders rows by identity bytes, records
  page hashes and attempts, and computes completeness.
- World full scope is complete only if pages are 1..N contiguous, N = `totalPages`,
  `totalPages`/`totalCount` are stable across pages, every non-last page is full, the last page has
  `hasNext != true`, and received = `totalCount`. managers.json must be a single non-empty document.
- `removalDetectionAllowed` is true only for a complete full-scope snapshot with no rejected row of
  unknown identity. Incremental snapshots never allow removal detection.
- `buildStagingDataset` refuses incomplete full-scope snapshots and conflicting duplicates. Its
  `sourceChecksum` covers only source columns (canonicalized with the Phase A rules; `fetched_at`
  excluded) and is independent of input order. `rejectedIdentities` lets Phase C classify those
  records as invalid instead of removed.
- `summarizeSnapshot` returns counts, flags and a 12-character hash only (no rows, no body).

## 7. Not in Phase B

Real HTTP transport, scheduling, diff (Phase C), policy integration (Phase D), dry run (Phase E),
any Production read or write, any change to the legacy scripts.
