# Launch status — October 18, 2026

## Published

- Live app: https://accesspath-alpha.vercel.app
- Public source: https://github.com/Noooba/accesspath
- Vercel project: accesspath; GitHub main is connected for automatic deployments.
- Verified production deployment: dpl_E4oVbARnPj6w7nRPPunGLHNcCzD8, READY, commit 92484f6976c70b8677c63699aaf9faba2072772e.
- Free Turso database connected using server-only Secret variables. Database token is scoped to AccessPath; credentials are excluded from Git. Independent cloud moderation/session secrets are configured. Existing Vercel protection settings were preserved.

## Hosted checks actually performed

- Home renders without the limited-storage notice.
- Fresh /api/evidence request: remote-libsql, available and persistent, deployed true, moderation configured; 26 synthetic nodes and 42 edges.
- Browser submitted a clearly synthetic deployment report. A fresh independent API request retrieved report 4171b918-48b4-484a-bb3e-63d2b9ce4b41 as persisted. It is not real field evidence.
- Hosted walking planner visibly returned a 1.2 km route from Torrance City Hall to a selected map point, with eight written steps and a Google Maps handoff. Accessibility remains explicitly unverified.
- Browser console captured no warnings or errors during the hosted check. Screenshot: output/playwright/hosted-live-route.png.
- Moderation secrets are configured; hosted moderator login/review was not separately exercised in this release check.

## Build repair and local regression

The initial Git build exposed an overly broad data ignore rule. It excluded src/data along with the local database folder. Anchoring it to /data preserved source data and the next Git production build reached READY. Earlier source-file-upload builds did not expose this Git packaging problem.

Before publication, lint, TypeScript and production build passed, with 107 Vitest and 33 Chromium/Firefox tests passing. No application logic changed in the ignore-rule repair. This is distinct from the narrower hosted checks above.

## Boundaries

The campus is synthetic. No verified real-world accessible route, community interview, field survey, or mobility validation is claimed. Public geocoding/routing services have capacity and availability limits. Free provider terms can change. No paid plan, domain purchase or weakened deployment protection was used.
