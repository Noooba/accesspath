"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Route,
  TriangleAlert,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  Navigation,
  Info,
} from "lucide-react";
import type { SiteGraph, RouteResult, RouteMode } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
export const MODE_LABELS: Record<RouteMode, string> = {
  shortest: "Shortest walk",
  confirmed: "Confirmed step-free",
  exploratory: "Exploratory step-free",
};
export function RouteDetails({
  graph,
  result,
  allResults,
  onSelectMode,
  onSelectEdge,
  loading,
  error,
}: {
  graph: SiteGraph;
  result?: RouteResult;
  allResults: Partial<Record<RouteMode, RouteResult>>;
  onSelectMode: (mode: RouteMode) => void;
  onSelectEdge: (id: string) => void;
  loading: boolean;
  error: string;
}) {
  const reduceMotion = useReducedMotion();
  if (loading)
    return (
      <aside
        className="route-details loading-panel"
        aria-label="Calculating route"
      >
        <div className="panel-heading">
          <Route size={17} />
          <h2>Finding your options</h2>
        </div>
        <div className="skeleton-line wide" />
        <div className="skeleton-line" />
        <div className="skeleton-map-block" />
        <p role="status">Checking the pathway graph…</p>
      </aside>
    );
  if (error)
    return (
      <aside className="route-details">
        <div className="empty-result">
          <TriangleAlert size={30} />
          <h2>We couldn’t calculate that route.</h2>
          <p role="alert">{error}</p>
          <p>Your map and pathway details are still available.</p>
        </div>
      </aside>
    );
  if (!result)
    return (
      <aside className="route-details">
        <div className="empty-result">
          <Route size={28} />
          <h2>A route starts with information.</h2>
          <p>
            Select a supported site and two documented places. Real pilot routes
            remain unavailable until pathway data is collected.
          </p>
        </div>
      </aside>
    );
  return (
    <aside className="route-details">
      <div className="panel-heading">
        <Navigation size={17} />
        <h2>Your route</h2>
        <span className="detail-state">Demo</span>
      </div>
      {result.status === "found" ? (
        <>
          <motion.div
            key={`${result.mode}-${result.edgeIds.join("-")}`}
            initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="route-result-main"
          >
            <StatusBadge
              kind={result.mode === "exploratory" ? "caution" : "demo"}
            >
              {result.mode === "confirmed"
                ? "Demo step-free rules satisfied"
                : result.mode === "exploratory"
                  ? "Potential route · unverified sections"
                  : "Review known barriers"}
            </StatusBadge>
            <h3>{MODE_LABELS[result.mode]}</h3>
            <div className="result-distance">
              {Math.round(result.distanceMeters)}
              <span>m</span>
            </div>
            <p>Calculated from {result.edgeIds.length} recorded segments.</p>
            <div className="route-certainty">
              <span>
                {result.coverage.isDemonstration
                  ? "Demo documentation"
                  : "Verified documentation"}{" "}
                coverage
              </span>
              <b>{result.coverage.percent}%</b>
              <div>
                <i style={{ width: `${result.coverage.percent}%` }} />
              </div>
              <small>
                {result.coverage.documentedEdges} of{" "}
                {result.coverage.totalEdges} segments.{" "}
                {result.coverage.isDemonstration
                  ? "Simulated attributes, not field verification."
                  : ""}
              </small>
            </div>
          </motion.div>
          {result.mode === "exploratory" && (
            <p className="route-warning">
              <TriangleAlert size={16} /> Potential route—some accessibility
              information is unverified.
            </p>
          )}
          {(result.barriers.length > 0 || result.unknowns.length > 0) && (
            <div className="route-flags">
              <h4>Before you choose this path</h4>
              {result.barriers.map((issue, i) => (
                <button
                  key={`b${i}`}
                  onClick={() => onSelectEdge(issue.edgeId)}
                >
                  <TriangleAlert size={14} />
                  <span>
                    <strong>{issue.label}</strong>
                    <small>{issue.detail}</small>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
              {result.unknowns.map((issue, i) => (
                <button
                  key={`u${i}`}
                  onClick={() => onSelectEdge(issue.edgeId)}
                >
                  <Info size={14} />
                  <span>
                    <strong>{issue.label}</strong>
                    <small>{issue.detail}</small>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
            </div>
          )}
          <details className="itinerary" open>
            <summary>
              Step-by-step itinerary <ChevronDown size={16} />
            </summary>
            <ol>
              {result.edgeIds.map((id, i) => {
                const edge = graph.edges.find((e) => e.id === id),
                  from = graph.nodes.find((n) => n.id === result.nodeIds[i]),
                  to = graph.nodes.find((n) => n.id === result.nodeIds[i + 1]);
                if (!edge || !from || !to) return null;
                return (
                  <li key={id}>
                    <span className="itinerary-number">{i + 1}</span>
                    <button onClick={() => onSelectEdge(id)}>
                      <strong>{to.name}</strong>
                      <span>
                        From {from.name} · {Math.round(edge.lengthMeters)} m
                      </span>
                      <small>
                        {edge.hasStairs
                          ? "Stairs"
                          : edge.stepFreeStatus === "unknown"
                            ? "Step-free status unknown"
                            : edge.stepFreeStatus === "confirmed"
                              ? "Step-free in dataset"
                              : "Not step-free"}
                        {edge.slopePercent !== null
                          ? ` · ${edge.slopePercent}% slope`
                          : " · slope unknown"}
                      </small>
                    </button>
                  </li>
                );
              })}
              {result.edgeIds.length === 0 && (
                <li>
                  <MapPin size={17} />
                  <span>
                    You are already at the selected destination. No pathway
                    segments are traversed.
                  </span>
                </li>
              )}
            </ol>
          </details>
          <details className="route-why">
            <summary>
              Why this route? <ChevronDown size={15} />
            </summary>
            <p>{result.explanation}</p>
          </details>
        </>
      ) : (
        <div className="empty-result no-route">
          <TriangleAlert size={31} />
          <StatusBadge kind="caution">No qualifying route</StatusBadge>
          <h3>
            {result.mode === "confirmed"
              ? "No confirmed step-free route is available with the current data."
              : "No available route matches these preferences."}
          </h3>
          <p>{result.explanation}</p>
          {result.mode === "confirmed" && (
            <button
              className="button secondary"
              onClick={() => onSelectMode("exploratory")}
            >
              View an unverified option <ArrowRight size={15} />
            </button>
          )}
          <Link className="text-link" href="/community">
            Review reported obstacles <ArrowRight size={14} />
          </Link>
          <p className="muted small-copy">
            Missing data does not prove that a real accessible route is
            impossible.
          </p>
        </div>
      )}
      <section className="compare-options">
        <h4>Compare your options</h4>
        {(["shortest", "confirmed", "exploratory"] as RouteMode[])
          .filter((m) => m !== result.mode)
          .map((m) => {
            const option = allResults[m];
            return (
              <button key={m} onClick={() => onSelectMode(m)}>
                <span className={`route-option-dot ${m}`} />
                <span>
                  <strong>{MODE_LABELS[m]}</strong>
                  <small>
                    {option?.status === "found"
                      ? `${option.barriers.length} known barrier${option.barriers.length === 1 ? "" : "s"} · ${option.unknowns.length} unknown detail${option.unknowns.length === 1 ? "" : "s"}`
                      : "No qualifying path"}
                  </small>
                </span>
                <b>
                  {option?.status === "found"
                    ? `${Math.round(option.distanceMeters)} m`
                    : "—"}
                </b>
                <ChevronRight size={13} />
              </button>
            );
          })}
      </section>
      <div className="details-footnote">
        <Check size={14} />
        <p>
          Blocked paths are always excluded. Demo results are not guidance for
          actual travel.
        </p>
      </div>
    </aside>
  );
}
