# Launch status — October 18, 2026

## Vercel preview

- Project: `accesspath` (`prj_ZB1yTdpIoMwGIyS9kboPWH61mWWA`).
- Preview: https://accesspath-f9gl8hh2i-nas-projects-02932294.vercel.app
- Deployment: `dpl_6vgekzPAvv7DFStUESWx8niTWRX3`, API target `staging`, observed **READY**.
- Source commit: `999ab356ce943a11a6f31a246ca01922f3495ee2`.
- Source deployment:71 audited runtime/config files; no credentials, databases or Windows build output uploaded. Vercel built with Node24.
- Default Vercel Authentication remains enabled. Browser navigation reached the Vercel sign-in page; hosted client flows were not independently exercised through that protection.

This is a **limited preview**, not a complete public production launch. No remote database is connected. The synthetic graph can calculate routes. Persisted reporting, moderator login and in-app Photon/OSRM requests need the configured durable libSQL database. Map-point/coordinate selection and the Google Maps URL remain usable once the preview is accessed.

The preview displays an upfront availability notice and disables report submission, place-search requests and in-app route calculation when deployment storage is unavailable. A separate local production-mode browser check with `VERCEL=1` passed:notice visible; search/calculation/report submission disabled; evidence marked unavailable; synthetic route still193m. No upstream requests were made by that check.

An initial deploy defaulted to production and was canceled before release; the retained deployment is explicitly staging. One invalid `target:preview` API request was corrected to Vercel's `staging` value. No deployment-protection settings were weakened.

## GitHub

The local Git repository has a complete source commit under the authenticated user's public GitHub noreply identity. Staged content was scanned for the actual private environment values and excluded database/env files. GitHub CLI is signed out; the connected GitHub app exposes the existing Recall repository but has no create-repository tool. The in-app GitHub creation page requires sign-in. No AccessPath repository publication or automatic Git deploy connection is claimed yet; unrelated Recall source was preserved.

## Remaining setup

1. Sign in to GitHub in the opened creation tab (or use `gh auth login`) so the new AccessPath repository can be created and this commit pushed.
2. Configure an authorized remote Turso/libSQL database using server-only `DATABASE_URL` and `DATABASE_AUTH_TOKEN`; set independent `ADMIN_KEY` and `SESSION_SECRET` for cloud moderation. Do not paste secrets into chat or commit them.
3. Apply the migrations/seed against that authorized database, redeploy, and verify actual report persistence/live routing. See DEPLOYMENT.md.
4. Connect the new repository to the Vercel project after GitHub publication. Confirm the intended release and access policy before describing it as public production.

CLI/account checks are live observations, not assumed from old workspace state. No paid database resource, domain, provider account or purchase was created.


## Final permission and regression checks

Vercel's authenticated protected-preview helper returned403 for this deployment's project/team, so the connected Vercel account needs the appropriate project/team authorization (or an account with access). The local Vercel CLI is also signed out. No unchanged authorization retry or weakened protection is claimed. The READY build status is confirmed, but protected hosted client behavior is not verified.

After adding the availability guards, the normal local build passed, all107 Vitest tests passed (20.47seconds), and all33 Chromium/Firefox browser tests passed (37.3seconds). The separate six-check limited-preview exercise passed with VERCEL=1. These are local test results, not proof of a durable cloud database or a published GitHub repository.
