# Beta Readiness — Internal Pages, Search Indexing, Local Data Deletion

Status: implemented and verified on a local Production build (`next build` + `next start`).
No deployment settings were changed; no public release.

## 1. Internal pages are fail-closed

| path | purpose | Production build / Preview |
|---|---|---|
| `/account/rls-test` | developer RLS PoC | **404** |
| `/release-readiness` | internal release status | **404**; footer link hidden |
| `/data-management` | user-facing local data guide and "delete all local data" | **kept** (see 3) |

- `src/lib/public-info/internal-pages.ts`: visible only when `NODE_ENV=development` (local
  `npm run dev`, where the black-box scripts run) or `NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled`.
  Any other value (`true`, `1`, `Enabled`, unset) hides them.
- `src/middleware.ts` rewrites hidden internal paths (with or without a trailing slash) to a
  non-existent path with HTTP 404 **before rendering**. Page-level `notFound()` alone was
  insufficient: the root `loading.tsx` starts streaming, so the status stayed 200 (observed on
  the local Production build). The pages also call `notFound()` in `generateMetadata` and the
  page body (defence in depth) and are `force-dynamic`.
- Observed on the local Production build: `/release-readiness` 404, `/account/rls-test` 404,
  `/release-readiness/` 308 → 404, `/`, `/players`, `/data-management`, `/account`, `/terms` 200,
  and no `/release-readiness` link in the rendered footer.

## 2. Search indexing (invite-only beta)

- `src/app/robots.ts` → `User-Agent: * / Disallow: /`.
- Root layout metadata `robots: { index: false, follow: false, nocache: true }` → every page
  carries `<meta name="robots" content="noindex, nofollow, nocache">` (verified on `/players`).
- `SEARCH_INDEXING_ALLOWED = false`. Allowing indexing is part of a general public release, which
  needs separate approval.

## 3. `/data-management` interpretation

The request listed `/data-management` next to the pages to hide. That page is the user-facing
local-data guide with the "delete all local data" function, and the Terms/Support text points
users to it; hiding it would remove a data-protection function. It was therefore **kept visible**
and made fail-closed instead: deletion now reads each key back after `removeItem` and reports a
failure if the value is still present (a silently ignored removal is no longer shown as success).
If hiding it is still wanted, a replacement deletion path and updated Terms/Support text are
needed first.

## 4. Performance on the local Production build

`next start` on this PC, 3 requests per page, HTML document only (no browser rendering, no
network throttling). Reference-data pages read from the configured Supabase reference-data path
(read-only public reference data, the same path used by the build and black-box gates).

| page | avg TTFB | avg total | HTML |
|---|---|---|---|
| `/` | 0.007 s | 0.541 s | 73 KB |
| `/players` | 0.007 s | 0.259 s | 109 KB |
| `/managers` | 0.008 s | 0.129 s | 127 KB |
| `/my-team` | 0.004 s | 0.004 s | 32 KB |
| `/best-xi` | 0.003 s | 0.003 s | 34 KB |
| `/squads` | 0.006 s | 0.006 s | 31 KB |
| `/data-management` | 0.003 s | 0.003 s | 36 KB |
| `/about` | 0.004 s | 0.004 s | 34 KB |

These are local server-side numbers, not user-perceived metrics. Measuring the real beta
environment (Vercel, mobile network, Core Web Vitals) belongs to the release stage.

## 5. Tests

`internal-pages.test.ts` (visibility matrix, page guards, footer filter, robots/noindex),
`middleware.test.ts` (404 rewrite before rendering, other pages untouched, explicit opt-in; Supabase
env blanked and `fetch` forbidden so the test makes no network call), `local-data.test.ts`
(silent removal failure is reported).
