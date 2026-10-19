"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Compass,
  ExternalLink,
  Globe2,
  Info,
  MapPin,
  Navigation,
  Route,
  ShieldQuestion,
  TriangleAlert,
  X,
} from "lucide-react";
import { apiJson } from "@/lib/http-client";
import { googleWalkingDirections } from "@/lib/live-links";
import { PlacePicker } from "./PlacePicker";
import { SaveRouteForm, useSavedRoutes } from './SavedRoutes';
import { shortestRouteIndex, type SavedRoute } from '@/lib/saved-routes';
import type {
  LatLon,
  RealPlace,
  LiveRouteResponse,
} from "@/types/live-routing";

const RealWorldMap = dynamic(() => import("@/components/map/RealWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="real-map-loading" role="status">
      Opening the street map…
    </div>
  ),
});
function metres(value: number) {
  return value >= 1000
    ? `${(value / 1000).toFixed(1)} km`
    : `${Math.round(value)} m`;
}
function timeEstimate(value: number) {
  const minutes = Math.max(1, Math.round(value / 60));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
    : `${minutes} min`;
}

export function RealWorldPlanner({
  liveAvailable = true,
  savedId,
}: {
  liveAvailable?: boolean;
  savedId?: string;
}) {
  const library = useSavedRoutes();
  const saved = library.routes.find(item => item.id === savedId);
  if (savedId && !library.loaded) return <main id="main-content" className="real-page page-width"><p role="status">Opening saved map…</p></main>;
  if (savedId && (!saved || saved.journey.kind !== 'street')) return <main id="main-content" className="real-page page-width"><h1>Saved map unavailable.</h1><p>{library.error || 'This route is not saved in this browser. It may have been removed or saved on another device.'}</p><Link className="button secondary" href="/saved">Open route library</Link></main>;
  return <WalkingPlanner key={savedId ?? 'new'} liveAvailable={liveAvailable} saved={saved} />;
}
function WalkingPlanner({ liveAvailable, saved }: { liveAvailable: boolean; saved?: SavedRoute }) {
  const initial = saved?.journey.kind === 'street' ? saved.journey : null;
  const [start, setStart] = useState<RealPlace | null>(initial?.start ?? null),
    [end, setEnd] = useState<RealPlace | null>(initial?.end ?? null);
  const [pickTarget, setPickTarget] = useState<"start" | "end" | null>(null);
  const [response, setResponse] = useState<LiveRouteResponse | null>(initial ? {provider: 'FOSSGIS OSRM', profile:'walking', dataSource:'OpenStreetMap', routes:[initial.route], fetchedAt:initial.fetchedAt} : null),
    [selectedRoute, setSelectedRoute] = useState(0);
  const [preference, setPreference] = useState<'suggested' | 'shortest'>(initial?.preference ?? 'suggested');
  const [snapshot, setSnapshot] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tileError, setTileError] = useState(false);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function invalidate() {
    generation.current++;
    controller.current?.abort();
    setResponse(null);
    setSelectedRoute(0);
    setError("");
    setBusy(false);
    setSnapshot(false);
  }
  function changePlace(target: "start" | "end", place: RealPlace | null) {
    invalidate();
    if (target === "start") setStart(place);
    else setEnd(place);
    setPickTarget(null);
  }
  function picked(target: "start" | "end", point: LatLon) {
    changePlace(target, {
      ...point,
      id: `map-${point.lat}-${point.lon}`,
      label: `Map point · ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`,
      source: "map",
    });
  }
  const markTileError = useCallback(() => setTileError(true), []);
  async function calculate() {
    if (!start || !end) return;
    controller.current?.abort();
    const current = ++generation.current,
      c = new AbortController();
    controller.current = c;
    const timer = setTimeout(() => c.abort(), 22000);
    setBusy(true);
    setError("");
    setResponse(null);
    setSelectedRoute(0);
    try {
      const data = await apiJson<LiveRouteResponse>("/api/live/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: c.signal,
        body: JSON.stringify({
          start: { lat: start.lat, lon: start.lon },
          end: { lat: end.lat, lon: end.lon },
        }),
      });
      if (generation.current === current) {
        setResponse(data);
        setSnapshot(false);
        setSelectedRoute(preference === 'shortest' ? shortestRouteIndex(data.routes) : 0);
      }
    } catch (e) {
      if (generation.current === current)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "The walking-route request timed out. Try again, or open these places in Google Maps."
            : e instanceof Error
              ? e.message
              : "The walking route could not be loaded.",
        );
    } finally {
      clearTimeout(timer);
      if (generation.current === current) setBusy(false);
    }
  }
  const route = response?.routes[selectedRoute] ?? null;

  return (
    <main id="main-content" tabIndex={-1} className="real-page page-width">
      <header className="real-page-heading">
        <div>
          <span className="eyebrow">
            <Globe2 size={14} /> Beyond the demo campus
          </span>
          <h1>Find a real-world walking route.</h1>
          <p>
            Search two places or choose points on the map. Get a route from the
            street network, then inspect the directions.
          </p>
        </div>
        <div className="route-workspace-switch" aria-label="Routing workspace">
          <Link href="/explore">Demo campus</Link>
          <span aria-current="page">Real-world routes</span>
          <Link href="/saved">Saved routes</Link>
        </div>
      </header>
      <div className="real-access-notice">
        <ShieldQuestion size={22} />
        <div>
          <strong>Walking directions · accessibility unverified</strong>
          <p>
            These routes may include stairs or inaccessible sections. Step-free
            access, slopes, widths and curb ramps have not been verified. The
            demo’s confirmed step-free rules do not apply here.
          </p>
        </div>
      </div>
      <p className="sr-only" role="status" aria-atomic="true">
        {busy
          ? "Requesting walking directions."
          : route
            ? `Walking route loaded: ${metres(route.distanceMeters)}. Accessibility is unverified.`
            : ""}
      </p>
      <div className="real-grid">
        <section
          className="real-controls"
          aria-label="Real-world route planner"
        >
          <div className="real-panel-heading">
            <Route size={18} />
            <h2>Choose your places</h2>
          </div>
          <PlacePicker
            serviceAvailable={liveAvailable}
            label="Starting place"
            target="start"
            selected={start}
            onChange={(place) => changePlace("start", place)}
            onPickMap={() =>
              setPickTarget((v) => (v === "start" ? null : "start"))
            }
            isPicking={pickTarget === "start"}
          />
          <button
            className="real-swap"
            disabled={!start && !end}
            onClick={() => {
              invalidate();
              setStart(end);
              setEnd(start);
              setPickTarget(null);
            }}
          >
            <ArrowDownUp size={16} /> Swap places
          </button>
          <PlacePicker
            serviceAvailable={liveAvailable}
            label="Destination place"
            target="end"
            selected={end}
            onChange={(place) => changePlace("end", place)}
            onPickMap={() => setPickTarget((v) => (v === "end" ? null : "end"))}
            isPicking={pickTarget === "end"}
          />
          <div className="real-calculate">
            <fieldset className="walking-preference">
              <legend>Walking preference</legend>
              {([['suggested', 'Suggested walk'], ['shortest', 'Shortest available walk']] as const).map(([value, label]) => <label key={value}><input type="radio" name="walking-preference" value={value} checked={preference === value} disabled={busy} onChange={() => {
                setPreference(value);
                if (response) setSelectedRoute(value === 'shortest' ? shortestRouteIndex(response.routes) : 0);
              }} />{label}</label>)}
              <p>Shortest compares the distances of returned walking routes. The provider may offer only one; this is not a guaranteed shortest path.</p>
            </fieldset>
            <button
              className="button primary"
              disabled={!liveAvailable || !start || !end || busy}
              onClick={() => void calculate()}
            >
              {busy ? <span className="button-spinner" /> : <Route size={17} />}
              {busy ? "Finding a walking route…" : "Calculate walking route"}
            </button>
            {start && end && (
              <a
                href={googleWalkingDirections(start, end)}
                target="_blank"
                rel="noopener noreferrer"
                className="button secondary"
                aria-label="Open walking directions in Google Maps, opens in a new tab"
              >
                Open in Google Maps <ExternalLink size={15} />
              </a>
            )}
            {start && end && (
              <p>Google Maps calculates its own route from these endpoints.</p>
            )}
          </div>
          <details className="real-data-details">
            <summary>
              <Info size={14} /> Map data &amp; privacy{" "}
              <ChevronDown size={13} />
            </summary>
            <p>
              Street tiles load from OpenStreetMap. A search is sent to Photon
              only when you press Search; routing sends your selected
              coordinates to FOSSGIS. Their servers may log requests. Nothing
              here requests your live location or stores your journey in the
              report database.
            </p>
            <p>
              Google receives the endpoints only if you open its link. These
              community services have usage limits and no availability
              guarantee.
            </p>
            <p>
              <a
                href="https://github.com/komoot/photon#demo-server"
                target="_blank"
                rel="noopener noreferrer"
              >
                Photon service policy <ArrowUpRight size={12} />
              </a>
              <a
                href="https://routing.openstreetmap.de/about.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Routing service policy <ArrowUpRight size={12} />
              </a>
            </p>
          </details>
        </section>
        <section
          className="real-map-workspace"
          aria-label="Street map and walking directions"
        >
          <div className="real-map-heading">
            <span>
              <MapPin size={16} /> OpenStreetMap street network
            </span>
            <span className="real-live-label">Online routing</span>
          </div>
          <div className={`real-map-frame ${pickTarget ? "is-picking" : ""}`}>
            <RealWorldMap
              start={start}
              end={end}
              route={route}
              pickTarget={pickTarget}
              onPick={picked}
              onTileError={markTileError}
            />
            {pickTarget && (
              <div className="real-pick-notice" role="status">
                <MapPin size={16} />
                Select the {pickTarget === "start"
                  ? "starting"
                  : "destination"}{" "}
                point on the map.
                <button
                  aria-label="Cancel map selection"
                  onClick={() => setPickTarget(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          {tileError && (
            <p className="real-service-note" role="status">
              <Info size={16} /> Street tiles could not load. Place search,
              coordinate entry, text directions and the Google Maps link remain
              available.
            </p>
          )}
          {error && (
            <div
              className="form-error real-route-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              <strong>We couldn’t load that walking route.</strong>
              <p>{error}</p>
              <p>
                Check the two places and try again. No substitute route has been
                generated.
              </p>
            </div>
          )}
          {busy && (
            <div className="real-route-empty" aria-busy="true">
              <span className="button-spinner dark" />
              <h2>Checking the walking network.</h2>
              <p>
                This requests an actual route from the provider. No
                accessibility verification is inferred.
              </p>
            </div>
          )}
          {!route && !busy && !error && (
            <div className="real-route-empty">
              <Compass size={27} />
              <h2>Two places. One clearer journey.</h2>
              <p>
                Choose a start and destination, then calculate. The result
                includes mapped geometry, provider distance, an estimated
                duration and an ordered itinerary.
              </p>
              <span>Real street data · unverified accessibility</span>
            </div>
          )}
          {route && response && (
            <div className="real-result">
              {snapshot && <div className="saved-snapshot" role="status"><strong>Saved map · {saved?.name}</strong><p>Route data from {response.fetchedAt.slice(0, 10)}. Conditions may have changed. Calculate again for a fresh route. Street tiles still load online.</p></div>}
              <div className="real-result-summary">
                <div>
                  <span className="eyebrow">
                    <Navigation size={14} /> Ordinary walking route
                  </span>
                  <h2>{metres(route.distanceMeters)}</h2>
                  <p>
                    {timeEstimate(route.durationSeconds)} · provider estimate,
                    not a personal mobility estimate
                  </p>
                </div>
                <span className="real-unknown-badge">
                  <ShieldQuestion size={16} /> Accessibility unverified
                </span>
              </div>
              {preference === 'shortest' && <p className="shortest-explanation">{snapshot ? 'This snapshot keeps the selected walk. Recalculate to compare fresh alternatives.' : response.routes.length === 1 ? 'The provider returned one walking route. No shorter alternative was supplied.' : `Shortest of ${response.routes.length} returned walks: ${metres(response.routes[shortestRouteIndex(response.routes)].distanceMeters)}. ${selectedRoute !== shortestRouteIndex(response.routes) ? 'You are viewing a different alternative.' : 'Selected by distance.'}`}</p>}
              {start && end && <SaveRouteForm key={`${response.fetchedAt}-${route.id}`} defaultName={`${start.label.split(',')[0]} to ${end.label.split(',')[0]}`} journey={{kind:'street', start, end, route, fetchedAt:response.fetchedAt, preference}} />}
              {response.routes.length > 1 && (
                <div
                  className="real-alternatives"
                  aria-label="Walking route alternatives"
                >
                  {response.routes.map((r, i) => (
                    <button
                      key={r.id}
                      aria-pressed={selectedRoute === i}
                      onClick={() => setSelectedRoute(i)}
                    >
                      <span>
                        {i === 0 ? "Suggested walk" : `Alternative ${i}`}
                      </span>
                      <b>{metres(r.distanceMeters)}</b>
                      {selectedRoute === i && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
              <div className="real-route-caveats">
                <p>
                  <TriangleAlert size={16} /> No field survey supports a
                  confirmed step-free label for this route.
                </p>
                {route.warnings.map((warning, i) => (
                  <p key={i}>
                    <Info size={15} />
                    {warning}
                  </p>
                ))}
                {(route.startSnapDistanceMeters > 20 ||
                  route.endSnapDistanceMeters > 20) && (
                  <p>
                    <Info size={15} />
                    The route starts {Math.round(
                      route.startSnapDistanceMeters,
                    )}{" "}
                    m from your start point and ends{" "}
                    {Math.round(route.endSnapDistanceMeters)} m from your
                    destination. Any dashed links are un-routed gaps.
                  </p>
                )}
              </div>
              <details className="real-itinerary" open>
                <summary>
                  Walking directions <span>{route.steps.length} steps</span>
                  <ChevronDown size={16} />
                </summary>
                <ol>
                  {route.steps.map((step, i) => (
                    <li key={`${i}-${step.instruction}`}>
                      <span>{i + 1}</span>
                      <div>
                        <strong>{step.instruction}</strong>
                        <p>{metres(step.distanceMeters)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
              <div className="real-result-source">
                <span>
                  Route: FOSSGIS OSRM · data © OpenStreetMap contributors
                </span>
                <a
                  href="https://www.openstreetmap.org/fixthemap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fix the map <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
      <div className="real-bottom-note">
        <Info size={15} />
        <p>
          Keep using <Link href="/explore">Demo Campus</Link> to explore
          documented step-free filtering and reporting. Real-world results are
          supplied by external services and are not campus accessibility
          surveys.
        </p>
      </div>
    </main>
  );
}
