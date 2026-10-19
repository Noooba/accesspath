# Real-world walking routes

The separate `/routes` page connects AccessPath to public OpenStreetMap data. It searches actual places, calculates pedestrian directions, renders the provider's route geometry, and offers a Google Maps handoff. It is distinct from `/explore`, which demonstrates accessibility-aware graph routing on synthetic campus data.

**A mapped walking route is not a verified accessible route.** The live planner does not establish step-free access, slope, curb condition, width, surface quality, temporary closures, opening hours, or individual suitability. It does not run a real-campus survey, certify accessibility, or feed public route output into the synthetic demo's confirmed step-free mode. Do not use it for emergency navigation.

## Use the planner

1. Open `/routes` or choose **Real-world routes** in the navigation.
2. Submit a specific place name, select a returned result for the start or destination, and repeat for the other endpoint. Search does not use autocomplete. Alternatively, enter latitude/longitude directly or choose an endpoint on the map.
3. Calculate the walking route. Read its distance, provider-estimated time, text itinerary, warnings, and any offered alternatives. New endpoint selections clear a previous result so it is not mistaken for the new route.
4. Inspect the selected versus snapped path endpoints. Dashed amber connections above 20 m are explicitly **unrouted, not verified**; they are not inserted as navigable paths. Provider route distance/time do not include an uncalculated connection from a selected point to its snapped point.
5. Optionally open **Google Maps**. It receives the chosen endpoints and computes its own walking route. Its result can differ from AccessPath's displayed OSRM result.

The initial street-map center is a fixed public Torrance viewport, not a device location. No GPS permission is requested. Manual coordinate entry and written directions provide alternatives to pointer use. The map supplies labeled zoom, fit, and pan controls, and camera changes do not require animation. Coordinates outside Web Mercator's approximately 85.051° north/south coverage are not silently moved onto the map; the map explains that limitation.

## Providers and requests

| Function | Default service | Request path |
| --- | --- | --- |
| Place search | Photon, based on OpenStreetMap data | Explicit browser submit → same-origin `POST /api/live/search` → Photon |
| Walking route | FOSSGIS OSRM's deployed foot-profile graph | Calculate button → same-origin `POST /api/live/route` → foot router |
| Street tiles | OpenStreetMap standard raster tiles | Browser → `https://tile.openstreetmap.org/{z}/{x}/{y}.png` for the current map view |
| Google handoff | Google Maps walking-directions URL | User opens an external link; Google receives selected coordinates |

The [Photon official README](https://github.com/komoot/photon#demo-server) permits reasonable project use of its public instance but warns that heavy use can be throttled or blocked and availability is not guaranteed. The [FOSSGIS service description](https://routing.openstreetmap.de/about.html) identifies its foot graph and requires modest traffic, a valid request identity, attribution, and no more than one request per second. Provider information was checked on October 18, 2026; operators must recheck terms before a broader rollout.

The browser keeps visible linked OpenStreetMap attribution. The standard tile provider is for ordinary interactive viewing: HTTP caching and Referer behavior are preserved, with no offline/bulk downloader or tile prefetch feature. Follow the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Automated browser tests intercept external tile requests rather than sweeping the public tile server.

The drawn route comes from OSRM, **not Google**. The [Google Maps URL handoff](https://developers.google.com/maps/documentation/urls/get-started) uses `api=1`, coordinate-based `origin`/`destination`, and `travelmode=walking`; it does not require a Google API key or embed the Google Maps JavaScript/Routes API. No Google API billing project is created by this feature.

## Limits, validation, and failures

- Each upstream provider has a separate SQL-backed atomic gate with **1.1 seconds between admitted requests**. Instances sharing one database share the limit. Cache hits do not contact the provider. Busy requests receive HTTP 429 and are not automatically retried.
- The input endpoint separation is limited to **50 km straight-line distance** for this demonstration. This is not a promise that the returned route is at most 50 km: routed paths may be longer.
- Place queries contain 3–160 characters and return at most five places. Same-origin live API POST bodies are limited to 2 KiB; coordinates must be finite and geographically bounded, with different endpoints.
- Upstream fetches have a 12-second timeout and a bounded response size. OSRM responses are checked for finite measurements, bounded geometry/step counts, correct geometry type and snapped endpoints. The accepted response contains at most three routes in total, with at most 20,000 coordinates and 500 steps per route.
- Defaults use an actual **foot-profile** server, not a car route with a walking label. Explicit driving/cycling step modes are rejected. Other reported modes, such as a ferry segment, produce a warning. This validation does not establish physical accessibility or independently audit the provider's routing graph.
- No-route, timeout, provider throttle, malformed response, and missing-storage states show an error. No straight-line substitute or invented itinerary is presented as a calculated route. Failed street tiles produce a visible warning while text directions and selected coordinates remain available.

HTTP 400 indicates invalid input or the endpoint-distance restriction; 422 means no route/segment was found; 429 means the shared gate or provider is limiting requests; 502 covers upstream failure or invalid data; 503 can indicate missing persistent gate storage/provider configuration; 504 indicates a provider timeout. These are distinct from a successful, physically verified journey, which this app cannot claim.

## Cache and privacy boundaries

The server uses bounded process memory: search results have a 10-minute reusable TTL, at most 100 entries / 512 KiB; route responses have a 5-minute TTL, at most 12 entries / 6 MiB. They are not written to the SQL database, shared across workers, or retained across process restarts. Expired entries stop being served at TTL expiry and are physically removed on access, later insertion/eviction, or process termination; there is no background timed-deletion job.

The SQL gate stores only provider bucket/counter metadata. Place queries, selected coordinates, route responses, user IPs, and device identifiers are not gate records. This does not prevent application-host or upstream-provider logs. FOSSGIS discloses that routing requests enter its server logs. Direct tile requests disclose a viewed area and browser network metadata to the tile provider; opening Google Maps discloses endpoints to Google. Read [privacy notes](PRIVACY.md) before using private locations.

## Configuration and deployment

Local SQLite supplies the shared gate on a single local application. **Vercel needs a configured persistent remote libSQL database** for uncached live search/routing API requests, as well as durable reports. File-backed SQLite is rejected on ephemeral serverless hosts; the live APIs fail clearly instead of falling back to an ineffective per-worker limiter. Manual coordinates, the direct tile view, and Google URL handoff do not prove that remote persistence works.

Optional server-only settings:

```dotenv
PHOTON_API_URL=https://photon.komoot.io/api/
FOOT_ROUTER_URL=https://routing.openstreetmap.de/routed-foot/route/v1/foot/
LIVE_PROVIDER_USER_AGENT=AccessPath/0.1 (low-volume walking-map demonstration; manual requests only)
```

Do not prefix these with `NEXT_PUBLIC_`. Provider URLs must be public HTTPS endpoints without URL credentials, query strings, fragments, localhost, or literal IP hosts. A custom foot-router URL must end `/foot/`, and the operator must actually deploy a pedestrian profile: renaming a car endpoint is insufficient. Set an honest, stable User-Agent with operator contact information for a deployed installation. No browser request can choose its own arbitrary provider URL.

For use beyond a low-volume demo, arrange appropriate providers and capacity. A generous client-side interface is not permission to overload public community infrastructure. No hosted resource, paid service, or production deployment is provisioned automatically. See [deployment instructions](DEPLOYMENT.md).

## Public-data functional check

On **October 18, 2026**, the implementation was exercised with two public places returned by Photon:

| Place | Latitude | Longitude |
| --- | --- | --- |
| Torrance City Hall | 33.8369603 | -118.3409067 |
| Katy Geissert Civic Center Library, Torrance | 33.8377329 | -118.3432939 |

The FOSSGIS foot-router response contained **315.2 m**, a provider estimate of **252.3 seconds**, **14 route coordinates**, and **10 instructions**. Reported start/end snap distances were approximately **10.812 m / 21.793 m**. The actual normalized response is saved as [output/live-public-route.json](../output/live-public-route.json), with its response timestamp.

The running planner was opened in the in-app browser and showed **315 m / 4 min**, its real geometry, text instructions, and an explicit unverified destination connection. The Google handoff was also opened: Google displayed a separate walking result of about **4 min / 0.2 mile via Torrance Boulevard**. These values are a dated software integration observation and can change with provider data or route choices.

This check did **not** involve walking the route, measuring curb ramps/slopes/widths, interviewing a mobility-aid user, or verifying campus accessibility. It is not community-validation evidence. Automated/browser results and unresolved checks are reported separately in [TEST_REPORT.md](TEST_REPORT.md); test fixtures are not represented as live public measurements.
