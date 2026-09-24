# Invite-only beta — stop procedure (owner operations)

Use this when a production incident or a serious bug appears during the invite-only beta. Claude Code
has **not** executed any of these steps; every step is an owner operation in a vendor dashboard. Screen
and button names are as of 2026-09 and may differ slightly. **Production Restore is not a stop
measure** (it is a separate, last-resort recovery decision).

Choose the smallest step that contains the problem. Record what you did (time, step, reason) and send
it to Claude Code afterwards.

## 1. Roll the site back to the last good deployment (fastest; data unchanged)

- **Where:** Vercel → project `efootball-team-ai` → **Deployments**.
- **Do:** open the last known-good Production deployment → **⋯** → **Instant Rollback** (or
  **Promote to Production**).
- **Effect:** the public URL serves that build within seconds. Reference data and user data are not
  touched. New commits on `main` stop being deployed to Production until you promote again.
- **Undo / recovery:** after the fix is merged and verified, promote the new deployment
  (**⋯ → Promote to Production**). Recovery condition: Release Gate passes on the fix.

## 2. Stop friends from reaching the site (temporary access restriction)

- **Where:** Vercel → project → **Settings → Deployment Protection**.
- **Do:** enable protection for **Production** (e.g. Vercel Authentication, or Password Protection)
  **if your plan offers it for Production**. Check the plan before relying on this step.
- **Effect:** visitors must authenticate; the app itself is unchanged.
- **Undo:** disable the protection again. Recovery condition: the incident is fixed and verified.
- If the plan does not offer it, use step 1 to a known-good build and stop sharing the URL; do not
  change domains or DNS for this.

## 3. Stop new sign-ups (account features)

- **Where:** Supabase Dashboard → project → **Authentication → Sign In / Providers** (user sign-up
  settings).
- **Do:** turn off **Allow new users to sign up**.
- **Effect:** existing users can still sign in; no new accounts. Local (browser) features keep working.
- **Undo:** turn it back on after the fix.

## 4. Hide or stop an affected feature

- Revert the offending PR with a normal revert PR (no force push), let Checks pass, merge; Vercel
  deploys it. If that takes too long, use step 1 first.

## 5. Stop the reference-data update pipeline

- **No schedule exists** (verified: no `schedule:` in any workflow). Updates happen only when you
  dispatch a workflow.
- **Updater role:** Supabase → SQL Editor → `alter role reference_data_updater nologin;`
  Effect: Production apply/plan/dry-run cannot connect; reads by the site are unaffected.
  Undo: `alter role reference_data_updater login;` (only after review).
- **Workflow:** GitHub → Actions → "Reference data Production apply (manual, approval-gated)" →
  **⋯ → Disable workflow**. Undo: **Enable workflow**.
- Do not approve any pending `reference-data-production-apply` / `production-backup-approval`
  deployment during an incident.

## 6. Suspected secret leak only

- Rotate, do not just delete: create a new value in the provider (Supabase role password via the SCRAM
  tool, R2 key, etc.), update the GitHub Environment secret, then revoke the old value. Deleting a
  secret without a replacement only disables the related workflow.
- Follow the Stage 2 runbook for the updater password; never paste secret values into chats or issues.

## 7. After the stop

1. Confirm the site state (public URL loads or is protected as intended).
2. Tell invitees the beta is paused (without sharing internal details).
3. Report to Claude Code: steps taken, times, observed symptoms (no secrets, no personal data).
4. Resume only after a fix passes the Release Gate and you approve re-opening.
