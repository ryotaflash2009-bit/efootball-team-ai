# Stage 5 — Invite-only beta readiness (2026-09-24)

Local-only review on main `7a633df` + this PR. No friend URL sent, no public release, noindex kept,
no World update, no Production write, no schedule.

## 1. The remaining World black-box FAIL — root cause and fix

- **Failing check:** "回帰: 旧 eFHUB サンプル詳細（Messi）" (`/players/89138556575063` must contain
  "Lionel Messi"), run against the public site after Stage 4: HTTP 200 without the text.
- **Root cause (C/D/E, not A/B):** `/players/[id]` is the legacy route that reads only
  `src/data/players.sample.json` — an eFHUB-derived local sample that is **git-ignored and not
  redistributable**. No UI links to it any more (`PlayerCard` is unused). The product's player detail
  is `/players/world/[worldCardId]` (Production: reference-data DB). On Vercel/CI the sample does not
  exist, so the legacy page correctly renders the shared not-found view; HTTP 200 is the streaming
  (`loading.tsx`) soft-404 already documented for internal pages. The check had pinned a local-only
  sample and a fixed player name since the initial baseline (2026-09-12).
- **Fix:** `scripts/lib/legacy-sample-detail.mjs` — environment-aware check used by the 7 rails that
  had it (managers, boosters, compare, progression, squads, ui, world-ui):
  sample present → the player returned by the legacy API `/api/players` must be shown (no fixed name);
  sample absent → the legacy API returns 0 and the page shows the shared not-found view with no player
  data, no internal paths/stack traces and no 5xx. A new World identity check was added to the managers
  rail (the formal detail shows the same player as the detail API). Unit test with a stubbed `fetch`
  (`src/lib/players-legacy-sample-check.test.ts`) proves HTTP 200 alone never passes.
- **Also stale after Stage 4:** the `ui` rail pinned "66 名の監督". It now compares the displayed
  counts with the live API counts and requires managers ≥ 66 (no deletions were approved).
- phase-b5 / phase-c / world-sync are explicitly local-sample rails and keep their sample checks
  (they pass locally; they are not meant to run against Vercel).

## 2. Public scope

| Item | Result (local `next start`) |
|---|---|
| Internal pages `/account/rls-test`, `/release-readiness` | 404 (middleware fail-closed; trailing slash → 308 → 404); no links on Home |
| Global metadata | `noindex, nofollow, nocache` on every page (incl. `/data-management`, `/support`, legal, `/my-team`) |
| New: `X-Robots-Tag: noindex, nofollow, noarchive` | on every response incl. API JSON and images (defense in depth; not only robots.txt) |
| robots.txt | `Disallow: /` |
| sitemap | none (404) |
| canonical / OG | none (nothing can override noindex) |
| `/data-management` | public, noindex, local-browser deletion only (read-back verified by unit tests), no Production DB actions, no secrets/debug |
| Client bundle | no source maps; no secret values (matches are guard regexes rejecting `sb_secret_`); public env = Supabase URL, publishable key, internal-page flag |

Removing noindex (metadata, header, robots) is a future owner decision for a public launch.

## 3. Data freshness

- Home: counts are live (World 13,009, managers 67). The date label is now **"World 取り込み日時" /
  "World data imported"** (latest `fetched_at` of Production World rows), so it is not mistaken for the
  managers update. The unapplied upstream count (13,286) is never shown.
- Managers page: new **"取り込み: <date>" / "Imported: <date>"** from the latest managers `fetched_at`
  (Stage 4 → 2026-09-24). If the date cannot be read the page still renders and shows "—".
  No batch id, checksum, object key or project ref is shown.
- Player detail keeps per-card "取得日時". Analysis (19 rows) is frozen; no new display.

## 4. Known limits and feedback (support page)

Added: World data is not updated daily and may lag; no charge during the beta and no promise of a
public release or continued availability; not an official eFootball service (same wording as the
disclaimer); local data deletion via "データ管理" and account deletion via the support contact.
Existing: invite-only beta, manual imports, browser storage, recommendations are not official,
features may change, bug report guide, and the "do not send passwords / codes / payment info /
unnecessary personal data / private screenshots" notices.
**Open (owner decision):** a beta end date; the legal pages are clearly labeled drafts (not final legal
documents) — final legal wording is an owner/legal decision, not changed here.

## 5. Performance (local Production build)

Method: `scripts/perf-local-benchmark.mjs` — `next start`, HTTP cold (first request after start) +
5 warm per route/API, headless Chrome desktop 1280 / mobile 390, 3 navigations per page (first =
cold), navigation timing, long tasks, CLS, request/duplicate-API counts, console errors, 5xx.
Report: `docs/black-box-tests/perf-local-benchmark.md`. Machine-specific reference values.

- **Severe issues: 0.** Warm page render 14–437 ms; APIs 106–302 ms; browser load ≤ 419 ms; long
  tasks 0 ms; CLS ≤ 0.024; duplicate API requests 0; console errors 0; 5xx 0.
- Non-blocker: the very first Home render after a server start took ~5.2 s (cold server + first
  reference-data queries); subsequent renders ~0.4 s. On Vercel this corresponds to a cold function
  start — observe in the read-only final check; no code change made.
- "Diagnostics" has no separate route in this app; the listed user-facing routes were measured.

## 6. Release Gate (local `next start`, reference data = Production via the app's read path)

13 rails all PASS: my-builds 100, compare 74, progression 99, squads 51, boosters 54, world-ui 78,
favorites 32, ui 70, managers 43, manager-picker 35, phase-b5 23, phase-c 17, world-sync 35.
Browser Release Gate (desktop + mobile, 16 pages incl. `/managers`, search rejection, `/data-management`):
160/160 — console errors 0, unexpected network failures 0, 5xx 0, horizontal overflow 0, no internal
information, no off-origin requests. Counts observed: managers 67, World 13,009.

## 7. Security (static + local, no production testing)

Internal pages fail closed; noindex (meta + header + robots); CSP / X-Frame-Options / nosniff /
Referrer-Policy / Permissions-Policy; no source maps; no secrets in the bundle; search input rejection
returns the safe 400 `SEARCH_INPUT_REJECTED`; API errors carry codes, not internals; user-specific data
stays in the browser or per-account RLS (no shared caching of user data added); no debug endpoints.
Not performed (by rule): penetration, stress, brute force, enumeration, third-party scanners.

## 8. Vercel read-only final check (needs one owner approval)

After this PR is merged and Vercel deploys `main`, read-only GETs against the public site only:
1. `/`, `/players`, `/managers`, `/data-management`, `/support`, `/privacy`, `/terms` → 200,
   `<meta name="robots" content="noindex, nofollow, nocache">` and header `X-Robots-Tag`.
2. `/robots.txt` → `Disallow: /`; `/sitemap.xml` → 404.
3. `/account/rls-test`, `/release-readiness` → 404.
4. `/api/managers?pageSize=1` → `totalCount 67`; `/api/world/players?pageSize=1` → `13009`.
5. Managers page shows "取り込み: 2026/…"; Home shows "World 取り込み日時".
6. Managers black-box with `BASE_URL=<public site>` (≈ 30 read-only GETs) → all PASS, including the
   legacy check in its "sample absent" branch.
No settings, domains, Environment or Secrets are touched.

## 9. Stop procedure

`docs/production-readiness/invite-beta-stop-procedure.md` (rollback, access restriction, sign-up stop,
feature revert, updater NOLOGIN / workflow disable, secret rotation) — owner operations only.
