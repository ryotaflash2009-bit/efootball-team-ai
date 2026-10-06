# Changelog

## Unreleased — after v1.0 (2026-10-05/06)

### Changed
- Support page names the channel "TeamAIXI専用サポート窓口" / "TeamAIXI Support" and shows the safety notice (no passwords, verification codes, API keys, secrets, addresses or phone numbers; bug reports contain only screen, steps, time, device, OS and browser). The dedicated mailbox is kept for v1.0.
- Update-frequency text on Support and About corrected from weekly to hourly.

### Performance
- Player detail First Load JS 227 → 167 kB (#144); sign-in 189 → 120 kB (#145, Supabase client loaded on submit).

### Operations
- Hourly detection observation tooling and contract for 2026-10-06..13 (`scripts/observe-hourly-detection.mjs`); tests for the contract that missed schedule slots never lose an update.
- Local verification server: `scripts/local-server.mjs` records the real `next start` listener PID and stops only re-verified PIDs.

### Known issues
- GitHub's scheduler ran only 7 of 40 hourly slots between 2026-10-04 17:17Z and 2026-10-06 08:33Z (max gap 538 min). Kept as is per the owner's decision; observed until 2026-10-13.
- The automatic Apply on 2026-10-05 stopped at the database connection (password authentication, no writes); the owner needs to re-enter one secret value.
- Post-release production smoke (2026-10-06): full black-box 576/576; targeted checks 87/88 twice, each failure being the navigation watchdog completing a genuine router hang (it never fired on 200 normal navigations).

## 1.0.0 — TeamAIXI v1.0 (2026-10-05)

First official release: free, no sign-in, unofficial. Served from the existing Vercel Production URL; search engines stay excluded (noindex).

### Product
- Brand: **TeamAIXI**, an unofficial squad analysis tool for eFootball™. Not an official KONAMI or eFootball™ service.
- Released features:
  - player and manager search and detail;
  - progression (direct ability tap and sliders), player comparison;
  - My Team and My Builds (stored in the browser);
  - Build Analysis, Squad Diagnosis, AI Best XI;
  - percentiles, titles and badges, "Your Best", Growth Profile;
  - diagnosis history and before/after;
  - share URLs and share images;
  - data export, import and deletion, and full local backup;
  - Japanese and English.
- Home: v1.0 notice and a six-step guide (find → train → compare → My Team → diagnose → share).
- Navigation: unreleased items (tier lists, packs, community) are no longer shown.
- Terms, Privacy Policy, Disclaimer, About and Support were rewritten for a sign-in-free, local-first v1.0. They were written by the operator; a professional review is recommended.

### Performance (production, 2026-10-04/05)
- Route transitions 0.9–1.5 s → about 0.31–0.35 s (parallel server reads, 300 s shared cache of public reference data).
- Cold LCP on Home (desktop) 1.32 s → 0.54 s (p95 5.8 s → 0.76 s); cold Home weight 4.55 MB → 1.32 MB (card images load near the viewport).
- First Load JS: Home 198 → 119 kB, /players 219 → 141 kB, squad editor 342 → 288 kB (Japanese dictionary split per screen, lazy Supabase client and English dictionary).
- CLS 0 on main screens; React #418 root causes fixed (#129, #134).

### Quality
- Navigation: a dropdown choice made before the page finished loading is no longer lost (#141); client navigations that never commit (about 1% of navigations, inside the Next.js router) now complete with a normal browser navigation after 5 s (#142).
- React #418 final gate: 3 consecutive clean production runs (576/576 steps each, 8 viewports, 0 hydration errors).
- English mode: no Japanese UI text on public pages and in the squad editor and comparison (engine, diagnosis and perspectives text localized in the display layer, with leak tests).

### Not included in v1.0
- Best XI manager boosts (F-070): planned for v1.1.
- Public sign-up, authentication emails, public IDs, friends, public profiles.
- Photo posts, community, comments.
- Rankings, user statistics.
- Payments, ads.
- Tier and pack data with unconfirmed rights.

### Data
- World 13,372 cards and 69 managers (as of 2026-10-03).
- Reference data updates automatically: hourly detection (Managers compared fully every hour; World light check every hour and a full comparison every 6 hours or when the signal changes) → Plan → encrypted Backup → Dry run → automatic Apply.
  - Automatic Apply happens only when the update matches the safety contract (`auto-apply-policy/2026-10-03.v1`). Anything else waits for the operator.
  - No automatic Rollback or Restore.

### Compatibility
- Storage keys, backup and export identifiers, share URL format and feature IDs are unchanged.
