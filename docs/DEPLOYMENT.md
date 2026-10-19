# AccessPath storage and deployment

## Local Windows setup

Use Node.js 22.12 or newer and the project package manager, npm. In PowerShell from this project directory:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

The default database is `data/accesspath.db`, a persistent SQLite file accessed through `@libsql/client` and Drizzle. Keep `data/` and `.env.local` out of source control and public ZIP packages. Do not delete the database to restart the application: restarting Node or refreshing a page retains reports. Migration and seed commands are idempotent. Seed inserts never overwrite existing edges or moderation decisions. Database reads initialize the schema and seed synthetic data on first use; no initialization runs during the Next.js build.

To enable local moderation, set separate random values of at least 32 characters for `ADMIN_KEY` and `SESSION_SECRET` in `.env.local`. Generate values without printing them into chat or committing them. There is no default password. Restart the server after editing environment variables. The admin login sends the key to the same-origin server over HTTPS in a deployed environment and receives a signed one-hour HttpOnly, SameSite=Strict cookie. Production cookies are Secure. `ADMIN_KEY`, `SESSION_SECRET`, and `DATABASE_AUTH_TOKEN` must never have a `NEXT_PUBLIC_` prefix.

## Vercel and other ephemeral serverless hosts

A local SQLite file is **not durable storage on Vercel**. In serverless environments the server refuses file-backed persistence rather than pretending a report was saved. The application can still read the bundled synthetic campus and empty pilot-site list. Evidence explicitly marks storage unavailable; reporting returns HTTP 503 until a persistent remote database is configured. Uncached `/api/live/search` and `/api/live/route` requests also require this database for their shared provider request gate and return HTTP 503 when it is unavailable. The `/routes` UI, direct street tiles, manual coordinate entry, and Google Maps URL handoff do not establish that the live APIs or persistence are configured.

Set these server-side environment variables on an existing, user-authorized libSQL database:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Remote `libsql://` or `https://` URL |
| `DATABASE_AUTH_TOKEN` | Private remote-database token |
| `ADMIN_KEY` | Private moderation key, at least 32 characters |
| `SESSION_SECRET` | Independent cookie-signing secret, at least 32 characters |

Run the migration and seed commands against the remote database from a trusted environment before exposing reports. No cloud database, paid resource, or provider account is provisioned by this project. Remote-provider availability, backup retention, access controls, and billing are operator responsibilities. Test real remote persistence before claiming production readiness. The local integration suite does not establish remote-provider availability.

Next.js must include `drizzle/*.sql` in its server output trace, because the migration initializer reads the SQL file on the server. `outputFileTracingIncludes` is configured in `next.config` for API routes. Route handlers use the Node.js runtime and are dynamic/no-store.

## Real-world map providers

The `/routes` planner is separate from the synthetic graph and uses public OpenStreetMap-based services. Default place search is [Photon](https://github.com/komoot/photon#demo-server); default walking routing is the [FOSSGIS OSRM service](https://routing.openstreetmap.de/about.html). These public instances are suitable only for a modest demonstration, can throttle or deny requests, and provide no availability guarantee for this application. Before substantial use, arrange suitable hosted or self-managed services and review their current terms. No paid account or infrastructure is provisioned here.

Optional overrides are read **on the server**, without `NEXT_PUBLIC_` prefixes:

| Variable | Default / requirement |
| --- | --- |
| `PHOTON_API_URL` | `https://photon.komoot.io/api/`; public HTTPS Photon search endpoint |
| `FOOT_ROUTER_URL` | `https://routing.openstreetmap.de/routed-foot/route/v1/foot/`; public HTTPS OSRM endpoint ending `/foot/`, with a genuinely deployed pedestrian routing profile |
| `LIVE_PROVIDER_USER_AGENT` | Defaults to `AccessPath/0.1 (low-volume walking-map demonstration; manual requests only)`; set a stable, honest application identity with an operator contact for a deployment |

Configured URLs cannot contain URL credentials, query parameters, fragments, localhost, or literal IP hosts. Request bodies cannot select an upstream URL. A `/foot/` URL is an application configuration requirement; changing a car server's path to `/foot/` does **not** turn its routing graph into a walking graph. The operator must verify that any replacement service actually uses pedestrian data/profile settings. Vehicle-mode responses are rejected. This integration does not implement Google API credentials or an embedded Google map.

Each provider has its own atomic SQL gate: at most one upstream request is admitted per **1.1 seconds** across instances sharing that database. A busy gate returns HTTP 429; the client does not enqueue automatic retries. Point both deployments and workers at the same database if they share a provider allowance. SQL gate records contain provider bucket names and counters, not place queries or route endpoints. Cache hits do not contact the provider or acquire another gate slot.

Search responses have a 10-minute reusable in-memory TTL (up to 100 entries / 512 KiB); route responses have a 5-minute TTL (up to 12 entries / 6 MiB). These caches are bounded per process, are not stored in the database, are not shared across workers, and disappear on process restart. TTL expiration ends reuse; physical removal occurs on cache access, later insertion/eviction, or process termination rather than a background deletion timer. Do not describe them as persistent route history or as a durable availability fallback.

Search requires an explicit submit, not autocomplete. The prototype accepts endpoints within **50 km straight-line distance**; the returned route can be longer. Provider calls time out after 12 seconds, are bounded in response size, and are validated before display. The route view uses real returned geometry and estimated travel time, with separate, unverified snap-to-path connections. See [live routing](LIVE_ROUTING.md) for full boundaries and failure behavior.

The browser requests ordinary interactive tiles directly from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Keep linked OpenStreetMap attribution visible, preserve browser HTTP caching, and retain an appropriate HTTP Referer. The configured `strict-origin-when-cross-origin` policy sends the origin on cross-origin HTTPS requests. Do not add offline download, bulk fetching, cache-bypass headers, or automated tile sweeps. Follow the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and use an appropriate alternative provider before heavier traffic. Automated browser tests intercept tile requests instead of loading public tiles repeatedly.

The **Open in Google Maps** button builds an ordinary HTTPS walking-directions URL from the selected endpoints. It needs no API key and works independently of an embedded Google service. Google receives the endpoints when that link is opened and calculates its own route; it is not the source of the route drawn inside AccessPath.

## API contract

| Endpoint | Behavior |
| --- | --- |
| `GET /api/sites` | `{sites, storage}`; database sites or explicit read-only fallback |
| `GET /api/sites/{siteId}/graph` | `SiteGraph`; fallback has `X-AccessPath-Storage: unavailable` |
| `POST /api/route` | `{route, storageUnavailable}` from server-side solver; demo scenarios rejected for real pilot sites |
| `GET /api/reports?siteId=...` | `{reports}`, latest 200; no internal duplicate hashes or private moderator notes |
| `POST /api/reports` | Pending report persisted; returns HTTP 201 only after the database write |
| `POST /api/admin/login` | Key validation and signed HttpOnly cookie |
| `POST /api/admin/logout` | Clears session cookie |
| `GET /api/admin/reports` | Requires a valid session; latest 200 reports |
| `PATCH /api/admin/reports/{id}` | Session required; review state and optional explicit operational-status update |
| `GET /api/evidence` | Actual graph/report counts and persistence status; no fabricated field-work counts |
| `POST /api/live/search` | Same-origin bounded JSON `{query}`; up to five Photon places, shared SQL provider gate and short-lived memory cache |
| `POST /api/live/route` | Same-origin bounded JSON `{start:{lat,lon},end:{lat,lon}}`; validated OSRM walking geometry, estimates, steps, snap distances, and accessibility warnings |

Reports and reviews accept bounded JSON only. Report descriptions are optional; omission, an empty string, or whitespace is stored as an empty string. Descriptions remain limited to 800 characters and plain text. Invalid content type, cross-origin mutations, oversized text, HTML-like input, mismatched site/path combinations, and repeated reports are rejected. All report submissions begin `pending`, irrespective of forged client review fields. The schema checks coordinate bounds and positive weights and uses composite foreign keys to prohibit edges or reports from referencing another site's paths/nodes. SQL parameters/ORM bindings are used for user input. A versioned transactional migration preserves existing reports while relaxing the description minimum.

Moderation approval alone never changes accessibility verification or routing data. A moderator can explicitly set an approved report's path `operationalStatus` to `open`, `blocked`, or `unknown`; this keeps step-free, slope, width, and verification provenance unchanged. Reporting is a signal requiring review, not an automatic route-closure mechanism.

## Abuse controls and known limits

SQL-backed atomic counters enforce a conservative **deployment-wide** fixed-window quota: 30 report attempts per 10 minutes and 10 admin login attempts per 15 minutes. This avoids storing visitor IP addresses and remains shared across workers connected to one database. It is a coarse prototype control: one abusive visitor can exhaust a shared quota, window boundaries allow bursts, and this does not replace operator monitoring, edge controls, or a suitable production anti-abuse design. Duplicate normalized report descriptions for the same path/category are blocked durably with a unique index; an operator must remove or archive a duplicate record to resubmit identical text later. Login sessions are stateless: logout removes the current browser cookie, while already copied valid tokens expire within an hour or can be invalidated by rotating `SESSION_SECRET`.

Do not claim production hardening, independent penetration testing, regulatory compliance, or real-world accessible-route validation from these implementation controls. The synthetic campus is a reproducible demonstration only.

## Maintenance

For local backup, stop writes and copy the database and any SQLite WAL/SHM sidecars together, or use a consistent SQLite backup facility. Prefer the remote provider's tested snapshot/restore facility for hosted data. Test restoration with a disposable copy. Database schema, migrations, and application changes should be reviewed together before upgrading an existing installation.

Primary implementation references: [libSQL TypeScript reference](https://docs.turso.tech/sdk/ts/reference), [Drizzle SQLite/libSQL setup](https://orm.drizzle.team/docs/get-started/turso-new), [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
