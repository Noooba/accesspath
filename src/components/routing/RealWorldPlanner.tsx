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
  LocateFixed,
  Footprints,
  Car,
  Bike,
  Bus,
} from "lucide-react";
import { apiJson } from "@/lib/http-client";
import { googleDirections, type TravelMode } from "@/lib/live-links";
import { PlacePicker } from "./PlacePicker";
import { SaveRouteForm, useSavedRoutes } from './SavedRoutes';
import { shortestRouteIndex, type SavedRoute } from '@/lib/saved-routes';
import { DEFAULT_ACCESS_PREFERENCES, type AccessPreferences } from '@/types/accessibility';
import { useLiveGuide } from './useLiveGuide';
import { LiveGuidance } from './LiveGuidance';
import { AccessPreferencesPanel } from './AccessPreferencesPanel';
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
  initialAccess=false,
  wheelchairProvider=false,
}: {
  liveAvailable?: boolean;
  savedId?: string;
  initialAccess?: boolean;
  wheelchairProvider?: boolean;
}) {
  const library = useSavedRoutes();
  const saved = library.routes.find(item => item.id === savedId);
  if (savedId && !library.loaded) return <main id="main-content" className="real-page page-width"><p role="status">Opening saved map…</p></main>;
  if (savedId && (!saved || saved.journey.kind !== 'street')) return <main id="main-content" className="real-page page-width"><h1>Saved map unavailable.</h1><p>{library.error || 'This route is not saved in this browser. It may have been removed or saved on another device.'}</p><Link className="button secondary" href="/saved">Open route library</Link></main>;
  return <WalkingPlanner key={savedId ?? `new-${initialAccess}`} liveAvailable={liveAvailable} saved={saved} initialAccess={initialAccess} wheelchairProvider={wheelchairProvider} />;
}
function WalkingPlanner({ liveAvailable, saved,initialAccess,wheelchairProvider }: { liveAvailable: boolean; saved?: SavedRoute;initialAccess:boolean;wheelchairProvider:boolean }) {
  const initial = saved?.journey.kind === 'street' ? saved.journey : null;
  const [start, setStart] = useState<RealPlace | null>(initial?.start ?? null),
    [end, setEnd] = useState<RealPlace | null>(initial?.end ?? null);
  const [pickTarget, setPickTarget] = useState<"start" | "end" | null>(null);
  const [response, setResponse] = useState<LiveRouteResponse | null>(initial ? {provider:initial.access?.engine==='openrouteservice'?'openrouteservice wheelchair':initial.access?'OpenStreetMap pedestrian graph':'FOSSGIS OSRM',profile:'walking',dataSource:'OpenStreetMap',routes:[initial.route],fetchedAt:initial.fetchedAt,...(initial.access?{access:initial.access}:{})} : null),
    [selectedRoute, setSelectedRoute] = useState(0);
  const [preference, setPreference] = useState<'suggested' | 'shortest' | 'accessibility'>(initial?.preference ?? (initialAccess?'accessibility':'suggested'));
  const [accessPreferences,setAccessPreferences]=useState<AccessPreferences>(initial?.accessPreferences ?? (wheelchairProvider?{...DEFAULT_ACCESS_PREFERENCES,maxSlopePercent:6,maxKerbCm:3}:DEFAULT_ACCESS_PREFERENCES));
  const [travelMode,setTravelMode]=useState<TravelMode>('walking');
  const [acknowledged,setAcknowledged]=useState(false),[followPosition,setFollowPosition]=useState(true);
  const [snapshot, setSnapshot] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [rerouteFailed,setRerouteFailed]=useState(false),
    [tileError, setTileError] = useState(false);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (error&&!rerouteFailed) errorRef.current?.focus();
  }, [error,rerouteFailed]);
  const route = response?.routes[selectedRoute] ?? null;
  function reroute(point:LatLon) {return calculate(point,true);}
  const guide=useLiveGuide(route,reroute,liveAvailable&&!busy&&travelMode==='walking');
  useEffect(()=>{if(guide.tracking)window.scrollTo({top:0,behavior:'auto'});},[guide.tracking]);
  function invalidate() {
    guide.stop();
    setAcknowledged(false);
    generation.current++;
    controller.current?.abort();
    setResponse(null);
    setSelectedRoute(0);
    setError("");
    setRerouteFailed(false);
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
  async function calculate(originOverride?: LatLon, automatic = false) {
    if (!start || !end) return;
    if(!automatic) guide.stop();
    controller.current?.abort();
    const current = ++generation.current,
      c = new AbortController();
    controller.current = c;
    const timer = setTimeout(() => c.abort(), preference==='accessibility'?45000:22000);
    setBusy(true);
    setError("");
    setRerouteFailed(false);
    if(!automatic) setResponse(null);
    if(!automatic) setSelectedRoute(0);
    try {
      const data = await apiJson<LiveRouteResponse>(preference==='accessibility'?'/api/live/access-route':"/api/live/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: c.signal,
        body: JSON.stringify({
          start: originOverride ?? { lat: start.lat, lon: start.lon },
          end: { lat: end.lat, lon: end.lon },
          ...(preference==='accessibility'?{preferences:accessPreferences}:{}),
        }),
      });
      if (generation.current === current) {
        setResponse(data);
        setSnapshot(false);
        setSelectedRoute(preference === 'shortest' ? shortestRouteIndex(data.routes) : 0);
        setAcknowledged(false);
        if(originOverride) setStart({...originOverride,id:'current-location',label:'Current location',source:'coordinates'});
        if(automatic && (data.access?.engine==='openrouteservice' || data.access?.unknownSegments || data.access?.rampSegments || data.routes.some(route=>route.startSnapDistanceMeters>20 || route.endSnapDistanceMeters>20))) guide.stop();
      }
    } catch (e) {
      if(generation.current===current&&automatic){setRerouteFailed(true);guide.stop();}
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
  const isAccess=preference==='accessibility';
  function changeAccessPreference(next:Partial<AccessPreferences>) {invalidate();setAccessPreferences(current=>({...current,...next}));}

  return (
    <main id="main-content" tabIndex={-1} className={`real-page page-width ${guide.tracking?'is-navigating':''}`}>
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
      <fieldset className="travel-modes"><legend>How are you travelling?</legend>{([['walking','Walk / roll',Footprints],['driving','Drive',Car],['bicycling','Cycle',Bike],['transit','Bus / transit',Bus]] as const).map(([value,label,Icon])=><label key={value} className={travelMode===value?'selected':''}><input type="radio" name="travel-mode" checked={travelMode===value} onChange={()=>{invalidate();setTravelMode(value);}}/><Icon size={19}/>{label}</label>)}</fieldset>
      <div className="real-access-notice">
        <ShieldQuestion size={22} />
        <div>
          <strong>{travelMode!=='walking'?'Driving, cycling and transit directions':isAccess?'Access-aware walking · mapped barriers excluded':'Walking directions · accessibility unverified'}</strong>
          <p>
            {travelMode!=='walking'?'Choose places below, then open the selected travel mode in Google Maps. Transit schedules and vehicle accessibility are supplied there; availability varies by area. AccessPath’s built-in live guidance is for walking and rolling.':isAccess?wheelchairProvider?'Uses a wheelchair-routing profile with steps and ferries excluded, requested mapped slope/width/kerb limits, and reviewed obstacle areas. Ramp details and missing-data coverage are not fully returned. Check the route before travelling; this is not field-verified accessibility.':'This local beta excludes mapped stairs, restricted paths, unsuitable surfaces, excessive slopes and reviewed obstacles. Missing tags and unmapped endpoint gaps remain unknown. It is not a field-verified wheelchair-accessible guarantee.':'These routes may include stairs or inaccessible sections. Step-free access, slopes, widths and curb ramps have not been verified. The demo’s confirmed step-free rules do not apply here.'}
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
          <button className="button secondary location-start" disabled={guide.locating} onClick={()=>guide.locate(point=>changePlace('start',{...point,id:'current-location',label:'Current location',source:'coordinates'}))}><LocateFixed size={16}/>{guide.locating?'Finding your position…':'Use my current location'}</button>
          <p className="location-disclosure">Asks your browser for permission. The point stays here until you calculate a route or open an external directions link.</p>
          {guide.error&&!route&&<p className="saved-error" role="alert">{guide.error}</p>}
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
            {travelMode==='walking'&&<fieldset className="walking-preference">
              <legend>Walking preference</legend>
              {([['suggested', 'Suggested walk'], ['shortest', 'Shortest available walk'], ['accessibility','Wheelchair / mobility access']] as const).map(([value, label]) => <label key={value}><input type="radio" name="walking-preference" value={value} checked={preference === value} disabled={busy} onChange={() => {
                if(value==='accessibility'||preference==='accessibility') invalidate();
                setPreference(value);
                if (response && value!=='accessibility' && preference!=='accessibility') setSelectedRoute(value === 'shortest' ? shortestRouteIndex(response.routes) : 0);
              }} />{label}</label>)}
              <p>Shortest compares the distances of returned walking routes. The provider may offer only one; this is not a guaranteed shortest path.</p>
            </fieldset>}
            {isAccess&&travelMode==='walking'&&<AccessPreferencesPanel preferences={accessPreferences} onChange={changeAccessPreference} wheelchairProvider={wheelchairProvider}/>}
            {travelMode==='walking'&&<button
              className="button primary"
              disabled={!liveAvailable || !start || !end || busy}
              onClick={() => void calculate()}
            >
              {busy ? <span className="button-spinner" /> : <Route size={17} />}
              {busy ? "Finding a walking route…" : isAccess?'Find access-aware walk':"Calculate walking route"}
            </button>}
            {start && end && (
              <a
                href={googleDirections(start, end,travelMode,travelMode!=='transit')}
                target="_blank"
                rel="noopener noreferrer"
                className="button secondary"
                aria-label={`Open ${travelMode==='walking'?'walking':travelMode==='transit'?'transit':travelMode==='bicycling'?'cycling':'driving'} directions in Google Maps, opens in a new tab`}
              >
                {travelMode==='transit'?'Open transit routes & schedules':travelMode==='walking'?'Open in Google Maps':`Open ${travelMode==='driving'?'driving':'cycling'} directions`} <ExternalLink size={15} />
              </a>
            )}
            {start && end && (
              <p>Google Maps calculates its own route from these endpoints. AccessPath’s access filters are not carried over.</p>
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
              is saved as a journey in the report database. Optional location and live guidance ask permission only when you activate them.
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
              <a href="https://overpass.private.coffee/#terms" target="_blank" rel="noopener noreferrer">Access-map service &amp; privacy <ArrowUpRight size={12}/></a>
              <a href="https://heigit.org/privacy-policy/" target="_blank" rel="noopener noreferrer">Wheelchair-routing service &amp; privacy <ArrowUpRight size={12}/></a>
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
              position={guide.fix}
              followPosition={guide.tracking&&followPosition&&guide.reliable}
              obstacles={response?.obstacles}
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
          {guide.tracking&&<label className="access-check follow-position"><input type="checkbox" checked={followPosition} onChange={e=>setFollowPosition(e.target.checked)}/>Keep the map centered on me</label>}
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
              <strong>{rerouteFailed?'We couldn’t update your route.':'We couldn’t load that walking route.'}</strong>
              <p>{error}</p>
              <p>
                {rerouteFailed?'Live guidance has stopped. The previous route remains visible for reference; calculate again before continuing guidance.':'Check the two places and try again. No substitute route has been generated.'}
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
                  <Navigation size={14} /> {response.access?'Access-aware walk':'Ordinary walking route'}
                  </span>
                  <h2>{metres(route.distanceMeters)}</h2>
                  <p>
                    {timeEstimate(route.durationSeconds)} · {response.access&&response.access.engine!=='openrouteservice'?'illustrative pace estimate':'provider estimate'},
                    not a personal mobility estimate
                  </p>
                </div>
                <span className="real-unknown-badge">
                  <ShieldQuestion size={16} /> Accessibility unverified
                </span>
              </div>
              {preference === 'shortest' && <p className="shortest-explanation">{snapshot ? 'This snapshot keeps the selected walk. Recalculate to compare fresh alternatives.' : response.routes.length === 1 ? 'The provider returned one walking route. No shorter alternative was supplied.' : `Shortest of ${response.routes.length} returned walks: ${metres(response.routes[shortestRouteIndex(response.routes)].distanceMeters)}. ${selectedRoute !== shortestRouteIndex(response.routes) ? 'You are viewing a different alternative.' : 'Selected by distance.'}`}</p>}
              {response.access&&<div className="access-result-summary"><h3>What the map supports</h3>{response.access.engine==='openrouteservice'?<p>Wheelchair profile requested with steps excluded and your mapped access limits. The provider does not report complete segment, ramp or missing-data counts, so these are not shown as zero or verified.</p>:<><p>{response.access.checkedSegments} pedestrian segments checked · {response.access.excludedSegments} excluded by your preferences or reviewed obstacles.</p><p>{response.access.rampSegments} mapped ramp segments · {response.access.unknownSegments} segments with missing access details.</p></>}<p>Reviewed obstacle areas excluded from the search: {response.access.reviewedObstaclesAvoided}. Unreviewed reports near the route: {response.access.pendingReportsNearby}.</p></div>}
              {start && end && <SaveRouteForm key={JSON.stringify([response.fetchedAt,route.id,start.lat,start.lon,end.lat,end.lon])} defaultName={`${start.label.split(',')[0]} to ${end.label.split(',')[0]}`} journey={{kind:'street', start, end, route, fetchedAt:response.fetchedAt, preference,...(response.access?{access:response.access,accessPreferences}:{} )}} />}
              <LiveGuidance guide={guide} route={route} busy={busy||snapshot} needsAcknowledgment={Boolean(response.access && (response.access.engine==='openrouteservice' || response.access.rampSegments || response.access.unknownSegments || route.startSnapDistanceMeters>20 || route.endSnapDistanceMeters>20))} acknowledged={acknowledged} onAcknowledge={setAcknowledged}/>
              <p className="real-report-link"><Link href={guide.fix?`/report?place=world&lat=${guide.fix.lat}&lon=${guide.fix.lon}`:'/report?place=world'}>Report an obstacle at a real place →</Link></p>
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
                  Route: {response.provider} · data © OpenStreetMap contributors
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
