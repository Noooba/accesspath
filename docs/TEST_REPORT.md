# AccessPath verification record

## October 18 saved routes and shortest-walk extension

Lint, TypeScript and production build passed. All **113 Vitest tests** passed (7 files, 2.69 seconds). The frozen production build passed **41 browser tests** (39 Chromium + 2 Firefox, 42.9 seconds).

Eight new browser scenarios cover saving and reloading actual street geometry/directions without another routing request; renaming, tag filtering, favorites and confirmed removal; choosing a shorter returned alternative instead of the provider's first suggestion; restoring campus settings; responsive library layouts and keyboard focus/reduced motion; preserving corrupt local data; quota failures without false success; and cross-tab favorite synchronization. Six unit checks cover data validation, coordinate/geometry bounds, capacity, tag normalization, storage errors and minimum-distance selection.

The library was screenshot-inspected at 1440, 768 and 375 pixels. No horizontal overflow was detected. Its mobile axe audit found no violations in the tested state. Browser tests intercept provider requests with explicitly labeled fixtures; these are functional checks, not field evidence or a new real-world provider validation. Existing route/report/moderation regressions also passed. Two initial assertion failures (a Next route-announcer alert and the newly added ninth mobile-navigation link) were corrected before the complete passing run.

Saved entries remain in the browser profile, with explicit no-sync/no-offline-tiles notices. Street snapshots retain their original fetch date and warning text. Campus entries recalculate against the current graph. Shortest street mode compares only the returned alternatives, not the provider's complete network. No packages, credentials, database schema or provider request quota were changed.

**Latest software checkpoint: October 18, 2026 (America/Los_Angeles).** Development began October 16. These results come from executed checks against this project, not from configuration or source inspection alone.


## October 18 real-world routing extension

Added `/routes`, Photon place search, FOSSGIS OSRM foot-routing, real OpenStreetMap tiles, point/coordinate selection, alternative walking routes, ordered directions and a Google Maps walking-URL handoff. The synthetic campus and confirmed-accessibility engine remain separate. The live provider does not verify step-free access.

**Executed extension checks:** combined Vitest run **107 passed across6files** (51.83seconds): the original81 plus16 live parsing/cache/transport tests and10 live API/gate integration tests. Full lint and TypeScript passed. The rebuilt production application includes both `/api/live/search` and `/api/live/route`. No new package dependency or Google billing/API project was added.

The first complete browser run passed33/33 (31Chromium+2Firefox). A subsequent visual review caught clipped endpoint markers after desktop-to-mobile resizing. The map now refits current route bounds when its container changes size. The final frozen-build regression passed **33/33 browser tests (31 Chromium +2 Firefox),46.3seconds**, including the new endpoint-visibility checks at1440/768/390 and all original22 campus regressions. Zero axe violations were found in the exercised live mobile, original Explorer, report and mobile-navigation states; console/uncaught-exception checks were clean. One earlier run overlapped a changing build and was discarded; only the later immutable-build result is claimed here. The final `playwright-report/index.html` records this complete33-test run.

**Actual provider verification, separate from mocks:** manual Photon search returned Torrance City Hall and Katy Geissert Civic Center Library. A real FOSSGIS walking response returned315.2m/252.3seconds,14coordinates and10instructions, with10.812m/21.793m snapped endpoint gaps. The running browser rendered315m/4min and the un-routed destination gap. The Google Maps handoff was opened and displayed its own walking directions, about4min/0.2mile viaTorranceBoulevard. No journey was walked or surveyed. See `LIVE_ROUTING.md` and `output/live-public-route.json` for exact boundaries.

A separate public-data browser capture reproduced315m and10steps without uncaught page errors: `output/playwright/live-public-route-desktop.png` and `live-public-map.png`. Live UI regression screenshots with names ending `-fixture.png` use clearly labeled automated test data, mocked provider APIs and intercepted tile images; they must not be portrayed as additional public-provider measurements. The real public-place test and Google UI check did not use private user addresses or device location.

## Original synthetic-MVP verification record

Windows PowerShell, Node.js v24.20.0 and npm11.19.0. AccessPath is separate from the existing Recall, Facetrix, café and study applications. Only the fictional **AccessPath Demo Campus** is populated: **26 nodes and 42 pathway segments**. The potential real pilot has no supplied pathway graph. All distances, accessibility attributes and obstacle examples are synthetic.

Local development uses persistent SQLite through libSQL/Drizzle. Automated API/browser mutations use disposable isolated SQLite databases and throwaway moderator credentials. No remote database, public deployment, real survey, interview, or participant usability study is established by these checks.

## Executed final checks

| Check | Actual result |
|---|---|
| `npm.cmd run lint` | Passed, no errors or warnings |
| `npm.cmd run typecheck` | Passed; script generates Next route types before TypeScript so it also works before the first build |
| `npm.cmd test` | **81 passed across 4 files**, final run52.73seconds |
| Routing unit suite | **48 tests**; independent cost oracle and safety cases below |
| Backend integration + origin suites | **27 tests**:21 database/API cases and6 same-origin cases |
| Evidence component suite | **6 tests**, including errors, invalid payload, cancellation, retry and finite12second timeout |
| `npm.cmd run db:migrate` | Passed against local persistent DB; versioned migration preserves existing reports |
| `npm.cmd run db:seed` | Passed; repeatable conflict-ignore seeding preserves existing operational updates |
| `npm.cmd run build` | Passed; optimized Next.js16.4.1 build, all page generation and route handlers completed |
| `ACCESSPATH_E2E_START_SERVER=1; npm.cmd run test:e2e` | **22 passed:20 Chromium +2 Firefox**, final run about1.2minutes |
| `npm.cmd audit --omit=dev --json` | **0 production vulnerabilities reported** |
| Full `npm.cmd audit --json` | **5 high-severity development dependency entries**; scope below |
| `21st review src --json` | Completed:0 errors,0 warnings,306 informational hardcoded-color suggestions at review time |
| Development server | `npm.cmd run dev` listening on3050; HTTP200 and rendered explorer/193m result inspected in the in-app browser at `http://localhost:3050/explore`, with no captured console errors |
| Git ignore checks | Actual `.env.local`, database files, dependencies, build cache and browser test artifacts are ignored |

The 81 Vitest tests and22 browser tests are different suites. The all-pairs cases below are enumerated within the routing tests; they are not thousands of independent user journeys.

## Routing correctness

The unit suite checks weighted shortest paths, deterministic ties, directed/bidirectional edges, disconnected graphs, same-start/end zero routes, distance sums, reconstruction, malformed topology/weights, overflow, filters, coverage and strict/exploratory distinctions.

An independent Floyd–Warshall cost comparison checks **676 endpoint pairs**. Confirmed-route invariants check **2,704 endpoint/scenario combinations** across the four scenarios. Found strict routes must be connected, sum to the returned length, and exclude stairs, blocked edges and undocumented required access data. Blocked edges remain excluded even when a client attempts `excludeBlocked:false`.

Reproducible Main gate → Library results with slope avoidance off:

| Synthetic scenario/mode | Calculated distance | Browser display |
|---|---:|---:|
| Baseline shortest |168.2931668856m|168m|
| Baseline confirmed step-free |193.4819196324m|193m|
| Walkway closure confirmed |195.96742656m|196m|
| Missing access data, confirmed |Unreachable|Explicit no-qualifying-route message|
| Missing access data, exploratory |Found with unknown sections|80% demo documentation; uncertainties shown|
| No open approach |Unreachable in all modes|No unsafe fallback|

A peripheral baseline closure is excluded independently of the simulated closure. These figures are synthetic fixture measurements, not surveyed route lengths, travel times or accessibility certification.

## Browser verification

The final22-test suite exercised the production build on port3060 with a new isolated database. Its server stopped automatically after the run. Chromium and Firefox both rendered the real graph and route states.

Verified flows:

- Actual route comparison, closure recalculation, unknown-data disclosure, disconnected results, zero routes, swapping endpoints, slope/stair/surface/documentation filters, and the empty unverified pilot.
- Map pan, instant zoom in/out, fit, selectable nodes and stair segments, pathway attributes and comparison overlays; direct map controls measure at least44×44CSSpx.
- Persisted pending report receipts surviving reload, duplicate rejection, optional empty descriptions, invalid inputs, forged review status rejection and cross-site rejection.
- Protected moderator access, actual browser sign-in, approval with explicit operational closure, resulting route change, rejection, restoration and sign-out. Approval alone never verifies access attributes.
- Skip-link focus, visible keyboard focus, route panel collapse, the nonmodal planning bottom sheet, menu focus containment and Escape/focus restoration.
- Desktop1440×900, tablet768×1024, mobile390×844 and narrow320px reflow; no page-wide horizontal overflow in the exercised states.
- Reduced-motion behavior and finite, recoverable graph/routing errors.
- Actual evidence counts and explanatory/privacy/accessibility navigation.

**axe-core:** zero violations in the exercised WCAG2A/AA,2.1AA and2.2AA rule sets on desktop Explorer, the report form, and the open mobile menu. This does not establish complete WCAG conformance. Captured browser console errors and uncaught page exceptions were clean in the final responsive flow. No hydration mismatch was observed.

The screenshots were also visually inspected. Final tablet mapping uses a bounded full-width canvas and a preferences sheet, fixing the earlier stretched map. Screenshots include:

- `output/playwright/landing-desktop.png`, `landing-tablet.png`, `landing-mobile.png`
- `output/playwright/explorer-desktop.png`, `explorer-tablet.png`, `explorer-mobile.png`
- `output/playwright/no-route-desktop.png`, `no-route-tablet.png`, `no-route-mobile.png`
- `output/playwright/report-desktop.png`, `report-tablet.png`, `report-mobile.png`
- `output/playwright/exploratory-unknowns.png`, `explorer-320-reduced-motion.png`, `mobile-navigation.png`, `mobile-route-planner.png`

Local browser detail: `playwright-report/index.html` is generated and ignored from source archives. A subsequent screenshot-only focused check passed1/1 and replaced the HTML report; its single-test total must not be confused with the earlier complete22/22 run recorded here. The original demo screenshots contain synthetic test data; the October18 extension distinguishes live-fixture screenshots from the actual public-place capture above. The October18 final full report supersedes the earlier single-test HTML noted in this historical section.

## Defects found and repaired

Earlier runs failed; those failures were used to repair the product rather than hidden:

1. Next's internal localhost URL rejected valid127.0.0.1 browser mutations. Origin checks now use the browser-visible Host while retaining cross-site/protocol checks; six regression cases cover this boundary.
2. UI-optional descriptions were constrained to at least5characters by API/SQL. Optional/empty values now work, with a transactional migration preserving existing reports; HTML and over800characters remain rejected.
3. Skip navigation scrolled without transferring focus. Main landmarks now accept programmatic skip focus.
4. Small pan targets and low-contrast labels were enlarged/darkened, then scanned again.
5. Stretching maps and camera-action races obscured nodes. Bounded layouts, resize refits and instant explicit controls were verified by actual node interaction.
6. A test-harness Secure-cookie cleanup issue was fixed by using authenticated browser requests. Production cookie protections were preserved; the successful final run used a fresh test DB.

## Dependency audit limits

The full audit reports the development-tool chain `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. The five high entries are the vulnerable package and affected dependents, not five independent production vulnerabilities. The underlying [GHSA-vfj7-8cjw-p6xm advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) concerns stack exhaustion from deeply nested brace patterns and listed no patched version when checked. Use only trusted project glob inputs and reassess upstream updates.

The suggested automatic fix would downgrade `eslint-config-next` to14.2.35, incompatible with retaining this Next16 toolchain. No forced downgrade or disabled check was used. The production-only audit is clean. Audit data is point-in-time evidence, not a security certification. Full JSON is saved in `output/dependency-audit.json`.

21st catalog access required sign-in, so no catalog code or hosted generation was used. The local design-context and review workflows ran; informational token-drift suggestions remain, especially schematic layer colors. `output/21st-review.json` records that review.

## Not established

- Screen-reader sessions, actual200% text-zoom testing, real participant usability testing, professional accessibility assessment or field validation.
- Persistent remote database writes/restore, hosted performance, field Core Web Vitals, independent penetration testing or public-scale abuse resistance.
- Public deployment/repository, recorded submission video, student contribution review, real community observations or organizer deadline clarification.

**Readiness:** the locally verified synthetic software MVP is ready for student review and demonstration. The hackathon submission is **not complete** until the genuine evidence, student participation, public repository, video and applicable deployment requirements are completed. See `DEVPOST_SUBMISSION.md`, `COMMUNITY_VALIDATION.md` and `DEPLOYMENT.md`.


### October 18 handoff checks

The final optimized build passed after reserving map space for the control stack. Full lint and explicit `next typegen && tsc --noEmit` passed; final map-specific lint also passed. Local21streview completed with0errors,0warnings and372 informational color-token suggestions; these are suggestions, not accessibility findings or a WCAG certification. No dependencies changed, so the prior production0/full5 development-advisory audit remains the recorded point-in-time dependency result. Documentation links were checked against the filesystem and no broken local targets were found. The updated source ZIP excludes database files, credentials, caches and browser traces.
