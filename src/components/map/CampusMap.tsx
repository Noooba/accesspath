"use client";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Polyline,
  CircleMarker,
  Tooltip,
  Rectangle,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  Plus,
  Minus,
  LocateFixed,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { SiteGraph, RouteResult, RouteMode } from "@/types";
import { mapPoint, geometryPoint } from "./projection";
const modeColors: Record<RouteMode, string> = {
  shortest: "#416eaf",
  confirmed: "#087f78",
  exploratory: "#b65e11",
};
type Props = {
  graph: SiteGraph;
  result?: RouteResult;
  comparison?: RouteResult;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string) => void;
  onSelectNode: (id: string) => void;
};
function Controls({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    const resize = new ResizeObserver(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [35, 35], animate: false });
    });
    resize.observe(map.getContainer());
    return () => resize.disconnect();
  }, [map, bounds]);
  return (
    <div className="map-control-stack">
      <div className="zoom-controls">
        <button aria-label="Zoom map in" onClick={() => map.zoomIn(1,{animate:false})}>
          <Plus size={17} />
        </button>
        <button aria-label="Zoom map out" onClick={() => map.zoomOut(1,{animate:false})}>
          <Minus size={17} />
        </button>
      </div>
      <button
        className="map-fit"
        aria-label="Fit demo campus in map"
        onClick={() =>
          map.fitBounds(bounds, { padding: [30, 30], animate: false })
        }
      >
        <LocateFixed size={18} />
      </button>
      <div className="map-pan-controls" aria-label="Pan map without dragging">
        <button
          aria-label="Pan map north"
          onClick={() => map.panBy([0, -90], { animate: false })}
        >
          <ArrowUp size={13} />
        </button>
        <button
          aria-label="Pan map west"
          onClick={() => map.panBy([-90, 0], { animate: false })}
        >
          <ArrowLeft size={13} />
        </button>
        <button
          aria-label="Pan map east"
          onClick={() => map.panBy([90, 0], { animate: false })}
        >
          <ArrowRight size={13} />
        </button>
        <button
          aria-label="Pan map south"
          onClick={() => map.panBy([0, 90], { animate: false })}
        >
          <ArrowDown size={13} />
        </button>
      </div>
    </div>
  );
}
export default function CampusMap({
  graph,
  result,
  comparison,
  selectedEdgeId,
  onSelectEdge,
  onSelectNode,
}: Props) {
  const points = useMemo(() => graph.nodes.map(mapPoint), [graph]);
  const bounds = useMemo<L.LatLngBoundsExpression>(() => {
    const north = points.map((p) => p[0]),
      east = points.map((p) => p[1]);
    return [
      [Math.min(...north) - 35, Math.min(...east) - 35],
      [Math.max(...north) + 35, Math.max(...east) + 35],
    ];
  }, [points]);
  const start = result?.nodeIds[0],
    end = result?.nodeIds.at(-1);
  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      boundsOptions={{ padding: [28, 28] }}
      minZoom={-0.5}
      maxZoom={3.5}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      className="campus-map"
      aria-label="Interactive schematic of the synthetic AccessPath Demo Campus"
    >
      <Controls bounds={bounds} />
      <Rectangle
        bounds={[
          [10, 10],
          [70, 45],
        ]}
        pathOptions={{
          color: "none",
          fillColor: "#e1ebdf",
          fillOpacity: 0.8,
          interactive: false,
        }}
      />
      <Rectangle
        bounds={[
          [105, 155],
          [175, 240],
        ]}
        pathOptions={{
          color: "none",
          fillColor: "#e1ebdf",
          fillOpacity: 0.8,
          interactive: false,
        }}
      />
      {graph.nodes
        .filter((n) => n.nodeType === "destination")
        .map((n) => {
          const [y, x] = mapPoint(n);
          return (
            <Rectangle
              key={`building-${n.id}`}
              bounds={[
                [y + 4, x - 13],
                [y + 25, x + 13],
              ]}
              pathOptions={{
                color: "#cbd4d5",
                weight: 1,
                fillColor: "#dce3e3",
                fillOpacity: 1,
                interactive: false,
              }}
            />
          );
        })}
      {graph.edges.map((edge) => (
        <Polyline
          key={edge.id}
          positions={edge.geometry.map(geometryPoint)}
          pathOptions={{
            color:
              edge.operationalStatus === "blocked"
                ? "#b42332"
                : edge.stepFreeStatus === "unknown" ||
                    edge.verificationStatus === "unverified"
                  ? "#b65e11"
                  : "#cbd5d8",
            weight: edge.id === selectedEdgeId ? 8 : 5,
            opacity: edge.id === selectedEdgeId ? 1 : 0.8,
            dashArray:
              edge.operationalStatus === "blocked"
                ? "5 6"
                : edge.stepFreeStatus === "unknown" ||
                    edge.verificationStatus === "unverified"
                  ? "3 5"
                  : undefined,
            lineCap: "round",
          }}
          eventHandlers={{ click: () => onSelectEdge(edge.id) }}
        >
          <Tooltip>
            {edge.id.replaceAll("-", " ")} ·{" "}
            {edge.operationalStatus === "blocked"
              ? "blocked"
              : edge.hasStairs
                ? "stairs"
                : edge.stepFreeStatus === "unknown"
                  ? "access unknown"
                  : `${Math.round(edge.lengthMeters)} m`}
          </Tooltip>
        </Polyline>
      ))}
      {comparison?.status === "found" &&
        comparison.edgeIds.map((id) => {
          const edge = graph.edges.find((e) => e.id === id);
          return edge ? (
            <Polyline
              key={`compare-${id}`}
              positions={edge.geometry.map(geometryPoint)}
              pathOptions={{
                color: modeColors[comparison.mode],
                weight: 4,
                opacity: 0.7,
                dashArray: "6 7",
                interactive: false,
              }}
            />
          ) : null;
        })}
      {result?.status === "found" &&
        result.edgeIds.map((id) => {
          const edge = graph.edges.find((e) => e.id === id);
          return edge ? (
            <Polyline
              key={`route-${id}`}
              positions={edge.geometry.map(geometryPoint)}
              pathOptions={{
                color: modeColors[result.mode],
                weight: 7,
                opacity: 1,
                dashArray: result.mode === "exploratory" ? "9 6" : undefined,
              }}
              eventHandlers={{ click: () => onSelectEdge(id) }}
            />
          ) : null;
        })}
      {graph.edges
        .filter((e) => e.hasStairs || e.operationalStatus === "blocked")
        .map((e) => {
          const a = geometryPoint(e.geometry[0]),
            b = geometryPoint(e.geometry.at(-1)!);
          return (
            <Marker
              key={`barrier-${e.id}`}
              position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]}
              title={
                e.operationalStatus === "blocked"
                  ? "Blocked path"
                  : "Stair segment"
              }
              keyboard
              icon={L.divIcon({
                className: "barrier-marker",
                html:
                  e.operationalStatus === "blocked"
                    ? '<span class="blocked">×</span>'
                    : '<span class="steps">≋</span>',
                iconSize: [23, 23],
                iconAnchor: [11, 11],
              })}
              eventHandlers={{ click: () => onSelectEdge(e.id) }}
            >
              <Tooltip>
                {e.operationalStatus === "blocked"
                  ? "Blocked path"
                  : "Stair segment"}{" "}
                · select for details
              </Tooltip>
            </Marker>
          );
        })}
      {graph.nodes.map((node) => {
        const important =
          node.nodeType === "destination" || node.nodeType === "entrance";
        return (
          <CircleMarker
            key={node.id}
            center={mapPoint(node)}
            radius={
              node.id === start || node.id === end ? 9 : important ? 5 : 3
            }
            pathOptions={{
              color:
                node.nodeType === "ramp"
                  ? "#087f78"
                  : node.id === start || node.id === end
                    ? "#fff"
                    : "#6c818b",
              weight: node.id === start || node.id === end ? 3 : 1.5,
              fillColor:
                node.id === start || node.id === end ? "#087f78" : "#fff",
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelectNode(node.id) }}
          >
            {important && (
              <Tooltip
                permanent
                direction="bottom"
                offset={[0, 6]}
                className="place-label"
              >
                {node.name}
              </Tooltip>
            )}
            {!important && (
              <Tooltip>
                {node.name}
                {node.nodeType === "ramp" ? " · ramp" : ""}
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}
      <div className="map-north" aria-hidden="true">
        <span>↑</span>N
      </div>
      <div className="map-attribution">
        AccessPath · original synthetic schematic · no real-world survey
      </div>
    </MapContainer>
  );
}
