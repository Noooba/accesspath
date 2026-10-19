# AccessPath routing methodology

This is a route-planning prototype, not an accessibility certification, emergency-navigation system, live obstruction feed or guarantee of safe passage. The default campus is **entirely synthetic**. Its 26 locations and 42 segment conditions were authored as explicit test inputs. None describes a real campus, including the separately listed Palos Verdes potential pilot, whose graph is empty and unverified.

## Implementation and graph contract

`src/lib/routing/index.ts` implements Dijkstra's shortest-path algorithm using a binary min-heap. The objective is the sum of `lengthMeters` on admitted directed arcs. Bidirectional edges contribute an arc in each direction. Edges are examined in ascending ID order and queue ties use node ID order, so identical inputs produce reproducible routes independent of input-array ordering. No AI-generated path, random path, nearest-point teleport or straight-line path substitutes for missing graph connectivity.

Validation runs before routing. Missing endpoints, duplicate IDs, invalid site associations, invalid geographic coordinates, malformed polylines, non-finite or negative weights, invalid access enums, negative slope magnitudes and nonpositive known widths return `status: invalid`. Numeric overflow returns an invalid state rather than NaN or a fabricated distance. An unreachable result has no route nodes or edges. A start equal to the destination has one node, zero distance, no segments and documentation coverage marked not applicable in the explanation (numeric coverage is 0/0 represented by 0%).

## Route modes

| Mode | Admission policy | Meaning |
| --- | --- | --- |
| Shortest walk | Always excludes blocked edges; respects enabled preferences. Stairs may be traversed unless avoided. | Shortest recorded open walk under the selected filters; it may contain clearly reported access barriers. |
| Confirmed step-free | Every admitted segment and its endpoint nodes must satisfy the documentation contract below. Known stairs, not-step-free segments, closures, missing curb ramps and widths below 90 cm are excluded regardless of filter overrides. | A path satisfies this prototype's stated documented step-free rules. It is not proof that the complete journey meets every user's access needs. |
| Exploratory step-free | Always excludes blocked edges and known stairs/not-step-free segments. Unknown access information is permitted unless the documentation-only preference is enabled. | A possible step-free connection requiring confirmation where information is unknown. It must not be relabelled confirmed. |

The legacy `excludeBlocked` field remains accepted in the API type but **cannot permit closed segments in any mode**. Similarly `avoidStairs: false` cannot permit known steps in confirmed or exploratory modes. This prevents untrusted requests or stale UI state from weakening those safety requirements.

### Documentation contract

A traversed edge counts as documented only when all of these are true:

- The site, edge and both endpoint nodes have accepted verification status.
- Surface, step-free status, curb status and operational status are known.
- Slope magnitude and clear width have finite recorded values.

For a real site, accepted status is `verified`. For a site explicitly marked `isDemo: true`, `demonstration` is accepted **only as a simulation input**. Every returned result carries `coverage.isDemonstration: true` for that site and an explicit simulation explanation. Changing a real site's verification label to `demonstration` does not make it verified. Every demo `verifiedAt` is null; no survey or real inspection date is invented.

Confirmed admission additionally requires `stepFreeStatus: confirmed`, no stairs, `operationalStatus: open`, a curb ramp marked `present` or `not-required`, and a known width of at least 90 cm. The 90 cm minimum is an explicit conservative **application preference**, not a formal ADA or jurisdictional-compliance rule. Width passing this check does not resolve turning spaces, cross slopes, obstacles or other unmodelled conditions.

The optional slope preference filters recorded magnitudes above `maxSlopePercent` (default ceiling 8%) when `avoidSteepSlopes` is enabled. The comparison is strict (`slope > ceiling`). This is a user-configurable preference, not a legal ramp threshold or a wheelchair-suitability guarantee. Slope avoidance is initially off so the shortest walk remains a neutral distance comparison. Confirmed mode always requires slope to be known, even when that preference is off. `avoidUneven` excludes both uneven and gravel surfaces. Unknown surface data already prevents confirmed admission.

This version does not evaluate real-time elevator service, hours, doors, cross slope, handrails, tactile surfaces, lighting, weather, crowding, personal mobility constraints, emergency access or expiry of field observations. Real-site operation needs a documented inspection and update policy before routing should be relied on.

## Distances, units and map alignment

Demo locations start from invented local east/north metre positions. Each local position is converted to `[latitude, longitude]` using:

```text
latitude  = 0.001 + northMetres / 111195.0802
longitude = 0.001 + eastMetres  / 111195.0802
```

They lie near (0°, 0°), deliberately away from any real campus. The demo contains no external map tiles. Rendering may project these coordinates into a Leaflet `CRS.Simple` plane, but **screen pixels are never used as route weights**. Leaflet documents that `CRS.Simple` uses map units with `[y, x]` ordering and that those units need not equal image pixels. The UI must use one consistent projection for node markers, edge paths, highlighted route paths and reports, derived from the same `geometry` arrays.

`polylineDistance` sums great-circle distances of consecutive geometry coordinates using a spherical Earth radius of 6,371,008.8 m. The implementation uses the haversine expression with its intermediate value clamped to [0,1] for floating-point stability. Invalid or insufficient geometry returns null, never zero as a missing-value placeholder. Each demo edge's `lengthMeters` is calculated directly from its supplied polyline. Geographic distances here are internally reproducible synthetic inputs, **not field-measured distances**. No walking-time estimate is supplied because user pace and terrain have not been measured.

## Coverage, barriers and unknowns

Coverage is the count of admitted route segments satisfying the documentation contract divided by the number of traversed segments, rounded to the nearest percentage point. It is path-specific and is not a probability, accessibility score, confidence interval or fraction of a campus surveyed. A fully documented stair route can have 100% coverage while still reporting stairs as an access barrier.

`barriers` includes recorded stairs/steps, missing curb ramps, slope above the selected ceiling, widths below the app preference, and gravel or uneven surfaces. `unknowns` identifies the actual affected edge for unverified site/edge/endpoint information, unknown step-free status, missing slope/width, unknown curb status, unknown surface and unknown operating status. A confirmed route always has an empty unknown list under these rules. Obstacles pending moderator review must not silently rewrite trusted graph conditions; approved graph changes are passed back through the same validator and router.

## Reproducible scenarios

Call `applyScenario(DEMO_GRAPH, scenarioId)` with the baseline source, not the previously modified scenario:

- `baseline`: the main-gate → library shortest route uses `stair-flight`; confirmed step-free takes the longer west-ramp route. The peripheral `west-auditorium` segment is explicitly blocked in the baseline, so the ordinary map demonstrates a recorded closure without altering this comparison.
- `closure`: `upper-library-walk` is blocked. The confirmed route takes an open courtyard alternative.
- `uncertain`: `library-entry` has unknown step-free/width data and unverified status; the stair shortcut is closed. Confirmed is unavailable; exploratory returns the possible path and explicit unknowns.
- `disconnected`: all edges incident to the library are blocked. Every route mode is unreachable even if an API caller passes `excludeBlocked: false`.

`applyScenario` clones its argument and never modifies it. It does not apply these invented conditions to a non-demo site.

## Verification evidence

`tests/unit/routing.test.ts` covers minimum accumulated costs, directionality, zero-cost cycles, deterministic equal-cost ties, identity routes, invalid graphs and preferences, numeric overflow, known distance calculations, coverage and unknowns, demo/real status separation, closure and missing-data outcomes, and every hard exclusion. An independent Floyd-Warshall oracle checks the Dijkstra result for all 676 shortest-route endpoint pairs in the closure scenario. A separate all-pairs check runs all 26 × 26 endpoint combinations across all four scenarios (2,704 cases) and verifies that every found confirmed path is contiguous, has a finite correct edge sum and never includes stairs, closures or undocumented segments. These software tests establish implementation properties; they do not validate any real campus or access standard.

## Primary references

- [Leaflet 1.9.4 API reference — CRS.Simple](https://leafletjs.com/reference.html#crs-simple): rendering coordinate-system behavior.
- [Leaflet non-geographical maps tutorial](https://leafletjs.com/examples/crs-simple/crs-simple.html): coordinate order, map units and image-pixel distinction.
- [NetworkX Dijkstra path documentation](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.shortest_paths.weighted.dijkstra_path.html): non-negative length-weighted path objective and hidden-edge modeling. AccessPath uses its own TypeScript implementation, not the NetworkX package.

No legal compliance, clinical mobility assessment, surveyed location, accuracy statistic or accessibility certification is inferred from these references.
