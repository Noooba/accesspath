# Mobility planning and foreground guidance — October 19, 2026

This extension preserves the existing synthetic campus, saved-route library and report moderation. It adds access-aware street planning, opt-in foreground GPS guidance, real-place obstacle reports, and explicit external travel-mode handoffs. This document records design and implementation scope; executed verification is recorded after the final build.

## Current release gate

Local lint, TypeScript and production build passed. All 150 unit/integration tests passed, and the full 48-browser-test regression passed; location tests use deliberately simulated browser coordinates, not a real-device field trial. The 21st local review reported zero errors and zero warnings, with informational color-token suggestions. Production-dependency audit reported zero advisories.

The feature branch is deployed as a preview while access-map connectivity is being resolved. Public Overpass services timed out both locally and from Vercel. The app displayed a service error rather than replacing the result with an unchecked walk. A one-off raw public OSM map retrieval succeeded for software investigation; the editing API is not used as the recurring application data backend. Real-place report lookup from the hosted preview was checked separately. A free HeiGIT/openrouteservice account sign-in has been requested as the next provider-connection step; no key, ORS integration or successful live wheelchair route is claimed yet. Ordinary walking/GPS, external travel modes, reports, saved routes and illustrations remain independently implemented and tested.

## Access-aware street routes

`/api/live/access-route` downloads a bounded OpenStreetMap pedestrian graph through Overpass and runs length-weighted Dijkstra after exclusions. Mapped stairs remain excluded even when a stair way has a ramp tag: a separately mapped usable connection is needed. Restricted access, wheelchair restrictions, rough surfaces, unsuitable recorded widths, kerbs and slopes, unsupported barriers and reviewed active obstacle areas are excluded. Vehicle-road centrelines and invented sidewalk connections are not used. Ramps are allowed by default, as selected by the user, and flagged before guidance starts; an explicit switch excludes them.

Missing slope, width, surface, wheelchair and crossing-kerb information remains unknown. Strict mode requires these mapped details and endpoint snaps within 5 m. Ordinary access-aware mode allows unknown details only with visible warnings and review before guidance. No field survey, universal suitability, accessibility certification or compliance score is inferred from tags. Endpoint snap gaps are always disclosed. Local-beta bounds: endpoints at most 3 km apart, non-polar and non-date-line area; no unchecked ordinary walk substitutes for a failed access request.

Overpass data is temporarily cached for ten minutes with bounded memory; cached responses preserve their original download time. The default endpoint is the documented Private.coffee Overpass service, using POST requests and a project-identifying User-Agent. Shared database gates enforce at least 15 seconds between requests, and the existing 1.1-second gate remains for Photon/FOSSGIS. Community services can refuse requests and offer no availability guarantee. A maintained dedicated routing/data service and field review are necessary before critical navigation reliance or substantial production demand.

## Foreground GPS

Location permission is requested only from an explicit user action. `getCurrentPosition` can choose the start. `watchPosition` updates the marker, accuracy area, next-step display and route progress. Optional speech uses the browser/OS voice service. Recalculation is separately opt-in, requires repeated deviation with accurate recent fixes, meaningful movement and a 45-second cooldown, and shares the new origin with the chosen routing service. It does not record a movement history. Stop/unmount clears tracking and speech. Denied permission, timeout and imprecise/stale fixes remain visible; inaccurate fixes do not trigger reroutes. Saved snapshots need recalculation before live guidance. Access warnings on a changed route require fresh review. A failed reroute stops guidance and keeps the old route labeled as a reference.

Browser GPS is not native background navigation: updates may stop when hidden, suspended or locked; accuracy depends on the device and environment. No guarantee of Google Maps-equivalent coverage, background behavior or positioning accuracy is claimed.

## Reports at real places

`/report?place=world` accepts a deliberately selected public obstacle point, category, radius (5–30 m), optional description and explicit public-location consent. The additive `0002_world_obstacles.sql` migration creates a separate table; existing campus reports are preserved. Same-origin writes, bounded validation, shared quotas, duplicate suppression and protected moderation apply. Pending reports do not silently modify routes. Reviewed active areas are excluded from access-aware graph routes only; neither ordinary provider walks nor external providers inherit them. Reports expire from active avoidance after seven days, not automatically from database retention. Public responses omit moderator notes. The moderator UI distinguishes real-place reports and does not apply their operations to campus edges.

## Travel modes and spatial UI

Walking/rolling uses AccessPath’s map and foreground guidance. Driving, cycling and bus/transit controls open actual Google Maps mode-specific directions. Transit schedules, availability, accessibility and traffic remain the provider’s data; no fabricated in-app bus timetable is shown. Access preferences are not silently transferred to an external URL.

The homepage and methodology contain small interactive CSS 3D ramp/stair/kerb illustrations. They are labeled illustrations, do not represent real path conditions, need no WebGL and retain controls under reduced motion. Existing typography and teal/ink tokens are reused. UI UX Pro Max guidance informed status messages and focus behavior. The 21st design context was read; catalog search returned not-signed-in, so no catalog component or hosted generation is claimed.

## Primary references

- [OSM wheelchair tagging](https://wiki.openstreetmap.org/wiki/Key:wheelchair)
- [OSM ramp tagging](https://wiki.openstreetmap.org/wiki/Key:ramp)
- [OSM incline tagging](https://wiki.openstreetmap.org/wiki/Key:incline)
- [OSM kerb tagging](https://wiki.openstreetmap.org/wiki/Key:kerb)
- [Overpass shared-service limits](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
- [Private.coffee endpoint, terms and privacy](https://overpass.private.coffee/)
- [Geolocation watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)
- [Google Maps mode-specific URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [FOSSGIS routing limits and logging](https://routing.openstreetmap.de/about.html)
