"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Route,
  MapPin,
  SlidersHorizontal,
  RotateCw,
  Info,
  Flag,
  ChevronDown,
  X,
  ShieldCheck,
  FlaskConical,
  PanelRight,
} from "lucide-react";
import type {
  RouteMode,
  RouteFilters,
  RouteResult,
  SiteGraph,
  Site,
  ScenarioId,
} from "@/types";
import { SITES, SCENARIOS, applyScenario } from "@/data/demo-campus";
import { DEFAULT_FILTERS } from "@/lib/routing";
import { apiJson } from "@/lib/http-client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RouteDetails, MODE_LABELS } from "./RouteDetails";
const CampusMap = dynamic(() => import("@/components/map/CampusMap"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">
      <div className="map-loader" />
      <p>Opening the demo schematic…</p>
    </div>
  ),
});
type GraphResponse = { key: string; data?: SiteGraph; error?: string };
type CalculationResponse = {
  key: string;
  results?: Partial<Record<RouteMode, RouteResult>>;
  error?: string;
  storageUnavailable?: boolean;
};
const EMPTY_RESULTS: Partial<Record<RouteMode, RouteResult>> = {};
export function Explorer() {
  const [sites, setSites] = useState<Site[]>(SITES),
    [siteListError, setSiteListError] = useState(""),
    [siteId, setSiteId] = useState("demo-campus"),
    [graphResponse, setGraphResponse] = useState<GraphResponse | null>(null),
    [startId, setStart] = useState("main-gate"),
    [endId, setEnd] = useState("library"),
    [mode, setMode] = useState<RouteMode>("confirmed"),
    [scenario, setScenario] = useState<ScenarioId>("baseline"),
    [filters, setFilters] = useState<RouteFilters>(DEFAULT_FILTERS),
    [calculation, setCalculation] = useState<CalculationResponse | null>(null),
    [refresh, setRefresh] = useState(0),
    [selectedEdgeId, setSelectedEdge] = useState<string | null>(null),
    [selectedNodeId, setSelectedNode] = useState<string | null>(null),
    [showComparison, setShowComparison] = useState(false),
    [mobilePlanner, setMobilePlanner] = useState(false),
    [detailsVisible, setDetailsVisible] = useState(true);
  const graphKey = `${siteId}:${refresh}`;
  const baseGraph =
    graphResponse?.key === graphKey ? (graphResponse.data ?? null) : null;
  const graphLoading = graphResponse?.key !== graphKey;
  const graphError =
    graphResponse?.key === graphKey ? (graphResponse.error ?? "") : "";
  const calculationKey = JSON.stringify([
    graphKey,
    startId,
    endId,
    scenario,
    filters,
  ]);
  const currentCalculation =
    calculation?.key === calculationKey ? calculation : null;
  const results = currentCalculation?.results ?? EMPTY_RESULTS;
  const error = currentCalculation?.error ?? "";
  const loading =
    graphLoading ||
    Boolean(baseGraph?.nodes.length && startId && endId && !currentCalculation);
  const storageUnavailable = currentCalculation?.storageUnavailable ?? false;
  useEffect(() => {
    const c = new AbortController();
    apiJson<{ sites: Site[] }>("/api/sites", { signal: c.signal })
      .then((d) => setSites(d.sites))
      .catch((e) => {
        if (e.name !== "AbortError")
          setSiteListError(
            "The live site list could not be loaded. Showing the bundled demonstration and unverified pilot.",
          );
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    let active = true;
    const c = new AbortController(),
      timeout = setTimeout(() => c.abort(), 12000);
    apiJson<SiteGraph>(`/api/sites/${siteId}/graph`, { signal: c.signal })
      .then((d) => {
        if (!active) return;
        setGraphResponse({ key: graphKey, data: d });
        setSelectedEdge(null);
        setSelectedNode(null);
        setStart((current) =>
          d.nodes.some((n) => n.id === current)
            ? current
            : (d.nodes[0]?.id ?? ""),
        );
        setEnd((current) =>
          d.nodes.some((n) => n.id === current)
            ? current
            : (d.nodes.find((n) => n.nodeType === "destination")?.id ??
              d.nodes[0]?.id ??
              ""),
        );
      })
      .catch((e) => {
        if (active)
          setGraphResponse({
            key: graphKey,
            error:
              e.name === "AbortError"
                ? "The site request timed out. Try again."
                : e.message,
          });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      c.abort();
      clearTimeout(timeout);
    };
  }, [siteId, graphKey]);
  const graph = useMemo(
    () => (baseGraph ? applyScenario(baseGraph, scenario) : null),
    [baseGraph, scenario],
  );
  useEffect(() => {
    if (!baseGraph || !startId || !endId || !baseGraph.nodes.length) return;
    let active = true;
    const c = new AbortController(),
      timeout = setTimeout(() => c.abort(), 12000);
    const modes: RouteMode[] = ["shortest", "confirmed", "exploratory"];
    Promise.all(
      modes.map(async (current) => {
        const d = await apiJson<{
          route: RouteResult;
          storageUnavailable?: boolean;
        }>("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: c.signal,
          body: JSON.stringify({
            siteId: baseGraph.site.id,
            startId,
            endId,
            mode: current,
            scenarioId: scenario,
            filters,
          }),
        });
        return { current, ...d };
      }),
    )
      .then((all) => {
        if (active)
          setCalculation({
            key: calculationKey,
            results: Object.fromEntries(all.map((d) => [d.current, d.route])),
            storageUnavailable: all.some((d) => d.storageUnavailable),
          });
      })
      .catch((e) => {
        if (active)
          setCalculation({
            key: calculationKey,
            error:
              e.name === "AbortError"
                ? "Calculation timed out. Please try again."
                : e.message,
          });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      c.abort();
      clearTimeout(timeout);
    };
  }, [baseGraph, startId, endId, scenario, filters, calculationKey]);
  const selectedEdge = graph?.edges.find((e) => e.id === selectedEdgeId),
    selectedNode = graph?.nodes.find((n) => n.id === selectedNodeId),
    result = results[mode];
  function selectEdge(id: string) {
    setSelectedEdge(id);
    setSelectedNode(null);
  }
  function selectNode(id: string) {
    setSelectedNode(id);
    setSelectedEdge(null);
  }
  function changeSite(id: string) {
    setSiteId(id);
    setScenario("baseline");
    setSelectedEdge(null);
    setSelectedNode(null);
  }
  return (
    <main id="main-content" tabIndex={-1} className="explorer-page">
      <p className="sr-only" role="status" aria-atomic="true">
        {loading
          ? "Calculating route options."
          : error
            ? `Route calculation failed: ${error}`
            : result?.status === "found"
              ? `${MODE_LABELS[mode]} route: ${Math.round(result.distanceMeters)} metres, ${result.barriers.length} known barriers and ${result.unknowns.length} unknown details.`
              : result?.status === "unreachable"
                ? `${MODE_LABELS[mode]}: no qualifying route with the current data.`
                : ""}
      </p>
      <div className="explorer-title">
        <div>
          <span className="eyebrow">Route explorer</span>
          <h1>A clearer way from here to there.</h1>
          <Link className="text-link" href="/routes">Find a real-world walking route <ArrowUpRight size={13} /></Link>
        </div>
        <StatusBadge kind={siteId === "demo-campus" ? "demo" : "unknown"}>
          {siteId === "demo-campus"
            ? "Illustrative demo data"
            : "Pilot ? Unverified"}
        </StatusBadge>
      </div>
      <div className="explorer-demo-notice">
        <FlaskConical size={15} />
        <p>
          AccessPath Demo Campus is entirely synthetic. These are not surveyed
          real-world pathways.
        </p>
        <Link href="/about">
          Data methodology <ArrowUpRight size={13} />
        </Link>
      </div>
      {siteListError && (
        <p role="status" className="storage-notice">
          {siteListError}
        </p>
      )}
      <div
        className={`explorer-grid ${detailsVisible ? "" : "details-hidden"}`}
      >
        <section
          className={`planner-panel ${mobilePlanner ? "expanded" : "collapsed"}`}
          aria-label="Route planner"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMobilePlanner(false);
              e.currentTarget
                .querySelector<HTMLButtonElement>(".mobile-planner-toggle")
                ?.focus();
            }
          }}
        >
          <button
            className="mobile-planner-toggle"
            aria-controls="planner-content"
            aria-label={
              mobilePlanner ? "Close route planner" : "Plan your route"
            }
            aria-expanded={mobilePlanner}
            onClick={() => setMobilePlanner((v) => !v)}
          >
            <Route size={17} /> Plan your route <ChevronDown size={16} />
          </button>
          <div id="planner-content" className="planner-content">
            <div className="panel-heading">
              <Route size={18} />
              <h2>Plan a route</h2>
            </div>
            <label className="field-label">
              Supported site
              <select
                value={siteId}
                onChange={(e) => changeSite(e.target.value)}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {!s.isDemo ? " — Pilot, unverified" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="planner-endpoints">
              <label className="field-label">
                <span className="endpoint-label">
                  <i className="start-dot" />
                  Starting point
                </span>
                <select
                  value={startId}
                  disabled={!graph?.nodes.length}
                  onChange={(e) => setStart(e.target.value)}
                >
                  {!graph?.nodes.length && (
                    <option value="">No mapped places</option>
                  )}
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="swap-button"
                aria-label="Swap starting point and destination"
                disabled={!graph?.nodes.length}
                onClick={() => {
                  setStart(endId);
                  setEnd(startId);
                }}
              >
                <ArrowDownUp size={16} />
              </button>
              <label className="field-label">
                <span className="endpoint-label">
                  <MapPin size={12} />
                  Destination
                </span>
                <select
                  value={endId}
                  disabled={!graph?.nodes.length}
                  onChange={(e) => setEnd(e.target.value)}
                >
                  {!graph?.nodes.length && (
                    <option value="">No mapped places</option>
                  )}
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="route-modes">
              <legend>Route preference</legend>
              {(["shortest", "confirmed", "exploratory"] as RouteMode[]).map(
                (m) => (
                  <label key={m} className={mode === m ? "selected" : ""}>
                    <input
                      type="radio"
                      name="route-mode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    <span>
                      <strong>{MODE_LABELS[m]}</strong>
                      <small>
                        {m === "shortest"
                          ? "Distance first; may include stairs."
                          : m === "confirmed"
                            ? "Only documented step-free segments."
                            : "Allows unknown access information."}
                      </small>
                    </span>
                  </label>
                ),
              )}
            </fieldset>
            <details className="filter-details">
              <summary>
                <SlidersHorizontal size={15} /> Additional preferences{" "}
                <ChevronDown size={14} />
              </summary>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.avoidStairs}
                    disabled={mode !== "shortest"}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        avoidStairs: e.target.checked,
                      }))
                    }
                  />
                  Avoid stairs in shortest walk
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.requireDocumented}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        requireDocumented: e.target.checked,
                      }))
                    }
                  />
                  Require documented details
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.avoidSteepSlopes}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        avoidSteepSlopes: e.target.checked,
                      }))
                    }
                  />
                  Avoid known steep slopes
                </label>
                {filters.avoidSteepSlopes && (
                  <label className="slope-field">
                    Maximum recorded slope
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="1"
                      value={filters.maxSlopePercent}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n))
                          setFilters((f) => ({
                            ...f,
                            maxSlopePercent: Math.max(0, Math.min(30, n)),
                          }));
                      }}
                    />
                    %
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={filters.avoidUneven}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        avoidUneven: e.target.checked,
                      }))
                    }
                  />
                  Avoid gravel and uneven surfaces
                </label>
                <p>
                  <ShieldCheck size={13} /> Blocked pathways are always
                  excluded.
                </p>
                <small>
                  Preferences use recorded attributes. No slope threshold
                  establishes ADA compliance.
                </small>
              </div>
            </details>
            <button
              className="button primary calculate-button"
              disabled={loading || graphLoading || !graph?.nodes.length}
              onClick={() => setRefresh((n) => n + 1)}
            >
              {loading ? (
                <span className="button-spinner" />
              ) : (
                <Route size={17} />
              )}{" "}
              {loading ? "Checking the graph…" : "Calculate route"}
            </button>
            <div className="planner-scenario">
              <label className="field-label">
                <span>
                  <FlaskConical size={14} /> Demo scenario
                </span>
                <select
                  aria-label="Demo scenario"
                  value={scenario}
                  disabled={!graph?.site.isDemo}
                  onChange={(e) => setScenario(e.target.value as ScenarioId)}
                >
                  {SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>{SCENARIOS.find((s) => s.id === scenario)?.description}</p>
              {scenario !== "baseline" && (
                <button
                  className="text-link"
                  onClick={() => setScenario("baseline")}
                >
                  <RotateCw size={12} /> Reset simulation
                </button>
              )}
            </div>
          </div>
        </section>
        <section
          className="map-workspace"
          aria-label="Campus map and pathway inspection"
        >
          <div className="map-topline">
            <div>
              <MapPin size={14} />
              <strong>{graph?.site.name ?? "Opening site…"}</strong>
            </div>
            <button
              className="text-link details-toggle"
              aria-expanded={detailsVisible}
              onClick={() => setDetailsVisible((v) => !v)}
            >
              <PanelRight size={15} />
              {detailsVisible ? "Hide" : "Show"} route details
            </button>
          </div>
          {graphLoading ? (
            <div className="map-placeholder">
              <div className="map-loader" />
              <p role="status">Loading site information…</p>
            </div>
          ) : graphError ? (
            <div className="map-placeholder">
              <Info size={27} />
              <h2>Site information is unavailable.</h2>
              <p role="alert">{graphError}</p>
              <button
                className="button secondary"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          ) : graph && graph.nodes.length ? (
            <div className="map-canvas">
              <CampusMap
                graph={graph}
                result={result}
                comparison={
                  showComparison
                    ? mode === "confirmed"
                      ? results.shortest
                      : results.confirmed
                    : undefined
                }
                selectedEdgeId={selectedEdgeId}
                onSelectEdge={selectEdge}
                onSelectNode={selectNode}
              />
              <div className="map-status-chip">
                <span className="small-dot" />{" "}
                {scenario === "baseline"
                  ? "Synthetic campus"
                  : `Simulation: ${SCENARIOS.find((s) => s.id === scenario)?.name}`}
              </div>
            </div>
          ) : (
            <div className="map-placeholder pilot-empty">
              <MapPin size={32} />
              <StatusBadge kind="unknown">Pilot — Unverified</StatusBadge>
              <h2>Good data comes before a route.</h2>
              <p>
                No pathway survey has been supplied for this potential pilot.
                AccessPath will not invent connections or describe an unverified
                campus as accessible.
              </p>
              <button
                className="button secondary"
                onClick={() => changeSite("demo-campus")}
              >
                Explore the synthetic campus <ArrowRight size={15} />
              </button>
            </div>
          )}
          <div className="map-legend" aria-label="Map legend">
            <span>
              <i className="legend-line teal" />
              Documented demo route
            </span>
            <span>
              <i className="legend-line blue" />
              Shortest walk
            </span>
            <span>
              <i className="legend-line amber dashed" />
              Unknown access
            </span>
            <span>
              <i className="legend-line red dashed" />
              Blocked
            </span>
          </div>
          <div className="map-inspection-toolbar">
            <label>
              Inspect a pathway
              <select
                aria-label="Inspect a pathway"
                value={selectedEdgeId ?? ""}
                disabled={!graph?.edges.length}
                onChange={(e) => {
                  setSelectedEdge(e.target.value || null);
                  setSelectedNode(null);
                }}
              >
                <option value="">Choose a segment</option>
                {graph?.edges.map((e) => (
                  <option key={e.id} value={e.id}>
                    {graph.nodes.find((n) => n.id === e.fromNodeId)?.name} ↔{" "}
                    {graph.nodes.find((n) => n.id === e.toNodeId)?.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="compare-checkbox">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
              />
              Overlay comparison
            </label>
          </div>
          {selectedEdge && (
            <div className="path-inspector">
              <div className="path-inspector-title">
                <span>
                  <Info size={16} />
                  Pathway details
                </span>
                <button
                  className="icon-button"
                  aria-label="Close pathway details"
                  onClick={() => setSelectedEdge(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <h3>
                {
                  graph?.nodes.find((n) => n.id === selectedEdge.fromNodeId)
                    ?.name
                }{" "}
                <ArrowRight size={13} />
                {graph?.nodes.find((n) => n.id === selectedEdge.toNodeId)?.name}
              </h3>
              <div className="path-attributes">
                <span>
                  Length <b>{selectedEdge.lengthMeters.toFixed(1)} m</b>
                </span>
                <span>
                  Step-free <b>{selectedEdge.stepFreeStatus}</b>
                </span>
                <span>
                  Operation <b>{selectedEdge.operationalStatus}</b>
                </span>
                <span>
                  Surface <b>{selectedEdge.surfaceType}</b>
                </span>
                <span>
                  Width{" "}
                  <b>
                    {selectedEdge.widthCentimeters === null
                      ? "Unknown"
                      : `${selectedEdge.widthCentimeters} cm`}
                  </b>
                </span>
                <span>
                  Slope{" "}
                  <b>
                    {selectedEdge.slopePercent === null
                      ? "Unknown"
                      : `${selectedEdge.slopePercent}%`}
                  </b>
                </span>
                <span>
                  Curb ramp <b>{selectedEdge.curbRampStatus}</b>
                </span>
                <span>
                  Evidence <b>{selectedEdge.verificationStatus}</b>
                </span>
              </div>
              <p>{selectedEdge.sourceDescription}</p>
              <Link
                href={`/report?edge=${encodeURIComponent(selectedEdge.id)}&site=${encodeURIComponent(siteId)}`}
                className="text-link"
              >
                <Flag size={13} />
                Report a barrier on this segment <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {selectedNode && (
            <div className="node-inspector">
              <div>
                <MapPin size={17} />
                <strong>{selectedNode.name}</strong>
                <StatusBadge>{selectedNode.verificationStatus}</StatusBadge>
              </div>
              <p>
                {selectedNode.nodeType} · {selectedNode.sourceDescription}
              </p>
              <div>
                <button
                  className="text-link"
                  onClick={() => setStart(selectedNode.id)}
                >
                  Start here <ArrowRight size={13} />
                </button>
                <button
                  className="text-link"
                  onClick={() => setEnd(selectedNode.id)}
                >
                  Go here <ArrowRight size={13} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Close place details"
                  onClick={() => setSelectedNode(null)}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
        {graph && detailsVisible && (
          <RouteDetails
            graph={graph}
            result={result}
            allResults={results}
            onSelectMode={setMode}
            onSelectEdge={selectEdge}
            loading={loading}
            error={error}
          />
        )}
      </div>
      <div className="explorer-footnote">
        <Info size={14} />
        <p>
          All distances and conditions are simulated. Routing uses graph edges
          and documented attributes, never guessed connections. No real-world
          accessibility or safety guarantee is made.
        </p>
        <Link href="/accessibility">
          Keyboard &amp; map alternatives <ArrowUpRight size={12} />
        </Link>
      </div>
      {storageUnavailable && (
        <p className="storage-notice" role="status">
          Database storage is unavailable. The synthetic routing demo works, but
          new reports cannot be persisted on this deployment.
        </p>
      )}
    </main>
  );
}
