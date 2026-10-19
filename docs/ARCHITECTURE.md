# Architecture and data flow

AccessPath is a campus-scale TypeScript prototype. The route engine is independent of React, and demo scenarios operate on graph copies so a simulated closure does not silently become a persisted field observation.

## Modules

| Area | Responsibility |
|---|---|
| `src/types` | Shared site, node, edge, route result, filter, scenario, and report contracts |
| `src/data/demo-campus` | Authored synthetic graph and explicit scenario transformations |
| `src/lib/routing` | Graph validation, distance helpers, binary min-heap, Dijkstra, eligibility and explanations |
| `src/components` | Route controls, schematic map, results, forms and reusable interface elements |
| `src/app` | App Router pages and server API handlers |
| `src/lib/validation` | Zod request contracts and bounded fields |
| `src/lib/database` | Drizzle schema, libSQL connection, migrations/seeding and repository operations |
| `src/lib/security` | Bounded JSON parsing, origin checks, quota handling, moderator sessions |
| `drizzle`, `scripts` | Versioned schema and local database commands |
| `tests` | Algorithm, data, API, interface, and browser verification |

See the source tree for exact filenames. No route result is a hard-coded display card; the map and itinerary consume ordered edges from the route calculation.

## Route request

1. Load the supported site graph. The only supplied surveyed-independent environment is the fictional demo campus.
2. Select start, destination, mode, filters, and optionally a clearly labeled scenario.
3. Validate graph topology, finite nonnegative weights, coordinates, statuses, and endpoint membership.
4. Build eligible adjacency lists, preserving directed edges. Dijkstra minimizes stored meters with deterministic ordering.
5. Reconstruct the selected edges and produce distance, barrier/unknown lists, coverage, and an explanation.
6. Render the same result as a map line and an ordered text itinerary. Render unreachable/invalid states explicitly.

The Leaflet schematic does not require external map tiles, geocoding, or routing services. Display coordinates position the fictional scene; stored fixture lengths supply its route distances. For real geographic data, the distance helpers support haversine calculations, but no real campus survey is shipped.

## Report request and moderation

A JSON report passes bounded-body parsing, same-origin checks, Zod validation, a honeypot, deployment-wide request quota, duplicate detection, and site/edge relationship validation. The repository assigns the ID, timestamp, and pending status. Client requests cannot assign verification or review status.

Reports are stored server-side in SQLite/libSQL. A moderator signs in with a server-configured key; the server issues a short-lived signed HttpOnly cookie and verifies it on protected operations. Approval and an optional operating-status update are recorded separately from access-attribute verification. Moderator notes are not returned in the public report view. See `PRIVACY.md` for retention and the exact abuse-control limits.

## Storage environments

Local development defaults to a file-backed SQLite database and needs no paid account or API key. Migrations and seed commands are explicit and repeatable. A compatible long-running Node server can use a durable file volume; backups and operations then belong to its operator.

Serverless hosting must use a supported remote libSQL endpoint and token for persistent writes. The app checks deployment configuration instead of representing a writable temporary filesystem as durable storage. A read-only demo can remain useful, but report saving must state storage is unavailable. Configuration alone does not prove a remote database is reachable; verify an actual write and reload after deployment.

## Trust boundaries and limitations

- Database tokens and administrator/session secrets remain server-only and are excluded from version control.
- Route filtering does not prove legal accessibility, live conditions, or suitability for an individual.
- The app does not request geolocation, camera access, reporter identity, or photo uploads.
- Anonymous reports require review; they do not automatically become verified edges.
- A shared prototype moderator key is not a full multi-user identity system; a broader deployment needs named accounts, audit history, and an operating policy.
- A global database-backed quota avoids storing visitor IPs but can deny service to other visitors when exhausted. Public-scale operation needs a reviewed abuse strategy.
- Freshness policy, real survey imports, multilingual support, and a production monitoring program are outside this synthetic MVP.
