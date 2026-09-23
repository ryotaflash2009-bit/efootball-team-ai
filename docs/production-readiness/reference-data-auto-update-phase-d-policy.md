# Reference Data Auto-Update — Phase D: Policy Integration

Status: implemented with fixtures only. **No Production access, no upstream access, no threshold
changes, no new dependencies.**

Module: `src/lib/reference-data/auto-update/update-candidate.ts`

`buildUpdateCandidate({ plans, stagings, currentRows, history, now })` turns Phase C diff plans
into one `UpdateCandidate`:

| field | meaning |
|---|---|
| `targetTables` | plan tables in contract order |
| `sourceChecksum` | `computeUpdateTotalChecksum` over the per-table staging source checksums |
| `idempotencyKey` | `computeUpdateIdempotencyKey` (source checksum + tables + `UPDATER_VERSION`) |
| `payloadBytes` | UTF-8 bytes of canonical source rows (independent of upstream formatting) |
| `policyInput` / `policy` | Phase A `evaluateUpdatePolicy` input and result, plus Phase D findings |
| `preservedColumnDrift` | per preserved source column, how many existing rows differ from upstream |
| `nextState` | `policy_blocked` on hard block, otherwise `awaiting_review` |

## 1. Policy input mapping

| policy field | derived from |
|---|---|
| table counts | Phase C `UpdateDiffReport` (approved removals from history, default 0) |
| `sourceChecksumAlreadyApplied` | `history.appliedSourceChecksums` contains the candidate source checksum |
| `sourceTimestampRegression` | World max `appearance_updated_at` in staging < `history.previousWorldMaxUpdatedAt` |
| `userOrAuthDataDetected` | token/credential/PII field names found in any candidate row (same detector as transport) |
| `baseline` | `history.baselinePayloadBytes` (null on first run → `baseline_missing` manual review) |
| `lastAppliedAt` / `now` | history / caller |
| frozen table, import_batches mutation, physical delete, unexpected table | always 0/false: plans are only produced for `world_player_cards` and `managers`, never delete, and never touch `player_card_analysis` or existing `import_batches` rows |

Thresholds are the unchanged Phase A `UPDATE_POLICY_THRESHOLDS`.

## 2. Phase D findings (added on top of Phase A)

| code | severity | when |
|---|---|---|
| `diff_plan_blocked` | hard_block | a plan has blocking reasons |
| `removal_detection_skipped` | warning | World plan could not detect removals (incremental scope or unidentified rejects) |
| `preserved_column_drift` | warning | existing rows whose preserved source columns differ from upstream |

## 3. State transition

`diff_generated → policy_blocked` on hard block (only cancel/supersede afterwards), else
`diff_generated → awaiting_review`. A `pass` result is still reviewed: `awaiting_review →
backup_requested` requires explicit human approval (Phase A state machine). Nothing in Phase D
applies anything.

## 4. Decision: `ai_styles` / `appearance`

Phase B confirmed the search response carries both. **Decision: keep them in
`preserveOnUpdateColumns` for automatic updates.** Reasons: Production values came from a
separate detail extension import whose freshness policy is not yet reviewed; overwriting them
silently would widen the automatic write surface. Drift is surfaced as `preserved_column_drift`
(counts only) so a reviewer can approve a dedicated refresh later. Revisit after the first real
rehearsal (Stage 4) shows the actual drift volume.

## 5. Known consequence for the first real run

Phase A treats `invalidCount > 0` as hard block, and Phase C counts upstream rows rejected by the
normalizer as invalid. If the first real fetch (Stage 1) contains rows that violate the Production
DDL (e.g. non-numeric ids), the candidate will be `policy_blocked` until a human decides how to
handle them. This is intentional fail-closed behaviour; it is not relaxed here.

## 6. Verification

`update-candidate.test.ts` (10 tests): pass path still awaits review, first-run manual review,
re-applied source checksum and timestamp regression hard blocks, blocked plan, removal findings,
manager changes always reviewed, two-table candidate, preserved column drift warning, sensitive
data hard block, input validation, deterministic checksums/keys, value-free Evidence summary.
