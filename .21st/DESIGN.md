# AccessPath design context

Project facts reconciled October 16–17, 2026 (client dates). Initial generated context is preserved as `design.before-accesspath.json` and `DESIGN.before-accesspath.md`. The structured source of truth is `design.json`; actual implementation tokens live in `src/app/globals.css`.

## Direction

A calm, precise civic mapping workspace. Use light surfaces, ink typography, restrained teal actions, and a compact original schematic. The map is the flagship working tool, paired with a labeled route form and text itinerary. No decorative 3D, fabricated real-campus imagery, generic AI startup sections, or unsupported impact statistics.

## Implemented palette

| Role | Value |
|---|---|
| Ink | `#0C1424` |
| Canvas | `#F6F8FB` |
| Primary teal | `#087F78` |
| Hover teal | `#06645E` |
| Light teal | `#D9F5F0` |
| Secondary text | `#526174` |
| Borders | `#DCE3E9` |
| Caution text | `#A14E09` |
| Danger | `#B42332` |
| Shortest route | `#416EAF` |
| Map uncertainty | `#B65E11` |
| Surface | `#FFFFFF` |

Words, labels, and line patterns accompany status colors. A selected route must be rendered from its actual graph edges.

## Typography, space and depth

Locally hosted Manrope headings and Inter body/interface text are loaded in `src/app/layout.tsx`; their OFL licenses are included in `public/fonts`. Use tabular numerals for distances and counts. The layout follows an 8-point rhythm with compact control adjustments, a 1240px page maximum, and a 52px desktop outer gutter. Existing feature/map corners are 12px, buttons 7px, and badges 5px. Shadows are restrained and limited to useful layer separation.

Small labels and touch targets still require actual browser accessibility review. These tokens do not establish readable contrast, target-size compliance, or WCAG conformance by themselves.

## Reusable project components

`SiteHeader` / `SiteFooter`, original SVG `CampusPreview`, Leaflet `CampusMap`, route form and `RouteDetails`, `ReportForm`, `AdminReview`, `StatusBadge`, and `EvidenceDashboard` are original project components. Reuse them before introducing lookalikes. Native controls support the core workflows. Radix is available for appropriate primitives; a dependency is not evidence that every screen uses it.

The schematic uses Leaflet `CRS.Simple` with no external tile requests. Public routes are calculated from the same graph consumed by the map and itinerary. An empty unverified pilot must not receive invented paths.

## Interaction requirements

Visible focus, keyboard alternatives to map gestures, readable status feedback, real loading/error/empty states, and `prefers-reduced-motion` support are required. CSS handles simple hover/press feedback. `RouteDetails` now imports Motion and `useReducedMotion` for a short result transition; do not describe broader motion effects without evidence. Never animate uncertainty away or conceal a no-route result.

## 21st workflow record

`21st init --design-context` succeeded. Catalog search and usage requests returned **not signed in**. No hosted AI generation was called, no catalog component was retrieved, and no 21st-generated layout is claimed. This project therefore uses original implementations guided by the user's brief, UI/UX Designer guidance, and focused UI UX Pro Max recommendations. Do not spend hosted AI credits or claim catalog access without an explicit successful capability check.

Preserve the distinction between a configured shadcn/21st registry and an actually installed/retrieved component. Run project checks and the available local `21st review` before handoff; record the actual outcome in `docs/TEST_REPORT.md`.



## October 17 verification refinements

Map, pan, swap and icon controls use 44px targets. Operational microcopy uses a 12px minimum with larger primary text; muted labels on pale surfaces were darkened after actual axe findings. Page main landmarks accept skip-link focus. Radix supplies the named mobile navigation drawer with Escape/focus handling. The route planner is a nonmodal collapsible bottom sheet at small widths. Route results use a restrained 5px/180ms entrance, disabled for reduced motion, and a concise polite status announcement.

The local `21st review src --json` completed with zero errors, zero warnings and 306 informational hardcoded-color suggestions. Existing semantic tokens are used for core colors; schematic layer colors still include local constants. Catalog access remained unauthenticated, and no remote generation or catalog code is claimed.


## Real-world workspace, October 18

Reuse the same type, teal/ink palette, borders and44px controls. The `/routes` interface adds native place/coordinate forms, actual OpenStreetMap tiles, unverified walking directions and a Google Maps external handoff. Keep the data/privacy disclosure at the point of use, distinguish snap gaps with an amber dashed line and text, and preserve the synthetic campus’s strict mode as a separate workspace. No geolocation permission or automatic search-as-you-type behavior. Camera refits to the current endpoints on responsive changes; map controls never set accidental endpoints. Actual evidence is in LIVE_ROUTING.md and TEST_REPORT.md.
