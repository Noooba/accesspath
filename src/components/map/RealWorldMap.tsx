"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  Circle,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LocateFixed,
  Minus,
  Plus,
} from "lucide-react";
import type {
  LatLon,
  RealPlace,
  RealWalkingRoute,
} from "@/types/live-routing";
import type { LocationFix } from '@/lib/navigation';
import type { WorldObstacle } from '@/types/accessibility';

type Props = {
  start: RealPlace | null;
  end: RealPlace | null;
  route: RealWalkingRoute | null;
  pickTarget: "start" | "end" | null;
  onPick: (target: "start" | "end", point: LatLon) => void;
  onTileError: () => void;
  position?: LocationFix | null;
  followPosition?: boolean;
  obstacles?: WorldObstacle[];
};
function FollowPosition({position,enabled}:{position?:LocationFix|null;enabled:boolean}) {
  const map=useMap();
  useEffect(()=>{if(enabled&&position&&Math.abs(position.lat)<=MAX_MAP_LATITUDE) map.setView([position.lat,position.lon],Math.max(17,map.getZoom()),{animate:false});},[enabled,position,map]);
  return null;
}

const INITIAL_CENTER: [number, number] = [33.8096, -118.3539];
// Web Mercator has no representation of the poles. Do not silently move a
// selected endpoint onto its projection boundary.
const MAX_MAP_LATITUDE = 85.0511287798;
const targetSize = { width: 44, height: 44, minWidth: 44, minHeight: 44 };

function isProjectable(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= MAX_MAP_LATITUDE &&
    Math.abs(lon) <= 180
  );
}

function fitToPoints(map: L.Map, points: [number, number][]) {
  map.invalidateSize({ pan: false });
  if (points.length === 1) {
    map.setView(points[0], 16, { animate: false });
  } else if (points.length > 1) {
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [36, 44],
      paddingBottomRight: [150, 36],
      maxZoom: 17,
      animate: false,
    });
  }
}

function Controls({ points }: { points: [number, number][] }) {
  const map = useMap();
  const container = useRef<HTMLDivElement>(null);

  const fit = () => fitToPoints(map, points);

  useEffect(() => {
    fitToPoints(map, points);
    // Reinstall when points change so a later responsive resize fits the latest
    // route. Map pan/zoom does not resize the container or trigger this observer.
    const resize = new ResizeObserver(() => fitToPoints(map, points));
    resize.observe(map.getContainer());
    return () => resize.disconnect();
  }, [map, points]);

  useEffect(() => {
    const mapNode = map.getContainer();
    mapNode.setAttribute("role", "region");
    mapNode.setAttribute("aria-label", "Interactive OpenStreetMap street map. Place selection and written directions are also available outside the map.");
    const node = container.current;
    if (node) {
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
    }
    return () => {
      if (node) L.DomEvent.off(node);
    };
  }, [map]);

  return (
    <div className="map-control-stack real-map-controls" ref={container}>
      <div className="zoom-controls" role="group" aria-label="Map zoom">
        <button type="button" style={targetSize} aria-label="Zoom street map in" onClick={() => map.zoomIn(1, { animate: false })}>
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="button" style={targetSize} aria-label="Zoom street map out" onClick={() => map.zoomOut(1, { animate: false })}>
          <Minus size={18} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="map-fit" style={targetSize} aria-label="Fit selected places and walking route in map" onClick={fit} disabled={points.length === 0}>
        <LocateFixed size={18} aria-hidden="true" />
      </button>
      <div className="map-pan-controls" role="group" aria-label="Pan street map without dragging">
        <button type="button" style={targetSize} aria-label="Pan street map north" onClick={() => map.panBy([0, -120], { animate: false })}>
          <ArrowUp size={18} aria-hidden="true" />
        </button>
        <button type="button" style={targetSize} aria-label="Pan street map west" onClick={() => map.panBy([-120, 0], { animate: false })}>
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" style={targetSize} aria-label="Pan street map east" onClick={() => map.panBy([120, 0], { animate: false })}>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        <button type="button" style={targetSize} aria-label="Pan street map south" onClick={() => map.panBy([0, 120], { animate: false })}>
          <ArrowDown size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PointPicking({ pickTarget, onPick }: Pick<Props, "pickTarget" | "onPick">) {
  const map = useMapEvents({
    click(event) {
      if (!pickTarget) return;
      const target = event.originalEvent.target;
      if (
        target instanceof Element &&
        target.closest("button, a, input, select, textarea, .leaflet-control, .real-map-controls")
      ) return;
      // Leaflet can emit longitudes beyond +/-180 after panning across world
      // copies. Persist the equivalent canonical geographic coordinate.
      const point = event.latlng.wrap();
      if (!isProjectable(point.lat, point.lng)) return;
      onPick(pickTarget, { lat: point.lat, lon: point.lng });
    },
  });
  useEffect(() => {
    const node = map.getContainer();
    node.classList.toggle("real-map-picking", Boolean(pickTarget));
    return () => node.classList.remove("real-map-picking");
  }, [map, pickTarget]);
  return null;
}

export default function RealWorldMap({ start, end, route, pickTarget, onPick, onTileError,position,followPosition=false,obstacles=[] }: Props) {
  const { points, startCanRender, endCanRender, routeCanRender, hasUnmappedCoordinates } = useMemo(() => {
    const startCanRender = Boolean(start && isProjectable(start.lat, start.lon));
    const endCanRender = Boolean(end && isProjectable(end.lat, end.lon));
    const routeCanRender = Boolean(route && route.coordinates.every(([lat, lon]) => isProjectable(lat, lon)));
    let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
    const include = (lat: number, lon: number) => {
      minLat = Math.min(minLat, lat);
      minLon = Math.min(minLon, lon);
      maxLat = Math.max(maxLat, lat);
      maxLon = Math.max(maxLon, lon);
    };
    if (start && startCanRender) include(start.lat, start.lon);
    if (end && endCanRender) include(end.lat, end.lon);
    if (route && routeCanRender) {
      for (const [lat, lon] of route.coordinates) include(lat, lon);
    }
    // Only two extent corners reach fitBounds, even for a detailed 20k-point
    // route. Preserve the full, unsimplified route geometry for rendering.
    const points: [number, number][] = minLat === Infinity
      ? []
      : minLat === maxLat && minLon === maxLon
        ? [[minLat, minLon]]
        : [[minLat, minLon], [maxLat, maxLon]];
    return {
      points, startCanRender, endCanRender, routeCanRender,
      hasUnmappedCoordinates: Boolean((start && !startCanRender) || (end && !endCanRender) || (route && !routeCanRender)),
    };
  }, [start, end, route]);

  const hasStartGap = Boolean(start && startCanRender && route && routeCanRender && isProjectable(route.snappedStart.lat, route.snappedStart.lon) && route.startSnapDistanceMeters > 20);
  const hasEndGap = Boolean(end && endCanRender && route && routeCanRender && isProjectable(route.snappedEnd.lat, route.snappedEnd.lon) && route.endSnapDistanceMeters > 20);

  return (
    <MapContainer
      center={INITIAL_CENTER}
      zoom={14}
      minZoom={2}
      maxZoom={19}
      zoomControl={false}
      scrollWheelZoom={false}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
      worldCopyJump
      className="real-map"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution={'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'}
        eventHandlers={{ tileerror: onTileError }}
      />
      <Controls points={points} />
      <FollowPosition position={position} enabled={followPosition}/>
      <PointPicking pickTarget={pickTarget} onPick={onPick} />
      {position&&isProjectable(position.lat,position.lon)&&<><Circle center={[position.lat,position.lon]} radius={Math.min(500,Math.max(1,position.accuracy))} pathOptions={{color:'#245ac1',weight:1,fillOpacity:.08}}/><CircleMarker center={[position.lat,position.lon]} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#245ac1',fillOpacity:1}}><Tooltip>Your GPS position · accuracy about {Math.round(position.accuracy)} m</Tooltip></CircleMarker></>}
      {obstacles.filter(report=>report.reviewStatus!=='rejected'&&isProjectable(report.lat,report.lon)).map(report=><Circle key={report.id} center={[report.lat,report.lon]} radius={report.radiusMeters} pathOptions={{color:report.reviewStatus==='approved'?'#b42332':'#a14e09',weight:2,fillOpacity:.15,dashArray:report.reviewStatus==='pending'?'4 5':undefined}}><Tooltip>{report.category.replaceAll('-',' ')} · {report.reviewStatus==='approved'?'reviewed obstacle area':'unreviewed report'} · expires {report.expiresAt.slice(0,10)}</Tooltip></Circle>)}
      {route && routeCanRender && route.coordinates.length > 1 && (
        <Polyline
          positions={route.coordinates}
          pathOptions={{ color: "#087f78", weight: 6, opacity: 0.95, lineCap: "round" }}
        >
          <Tooltip>Calculated walking route · review the access details before travel</Tooltip>
        </Polyline>
      )}
      {hasStartGap && start && route && (
        <Polyline
          positions={[[start.lat, start.lon], [route.snappedStart.lat, route.snappedStart.lon]]}
          pathOptions={{ color: "#9b5b14", weight: 4, dashArray: "6 8" }}
        >
          <Tooltip>Unrouted connection, not verified · {Math.round(route.startSnapDistanceMeters)} m</Tooltip>
        </Polyline>
      )}
      {hasEndGap && end && route && (
        <Polyline
          positions={[[route.snappedEnd.lat, route.snappedEnd.lon], [end.lat, end.lon]]}
          pathOptions={{ color: "#9b5b14", weight: 4, dashArray: "6 8" }}
        >
          <Tooltip>Unrouted connection, not verified · {Math.round(route.endSnapDistanceMeters)} m</Tooltip>
        </Polyline>
      )}
      {start && startCanRender && (
        <CircleMarker center={[start.lat, start.lon]} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: "#087f78", fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -8]} className="real-place-label">A · Start</Tooltip>
        </CircleMarker>
      )}
      {end && endCanRender && (
        <CircleMarker center={[end.lat, end.lon]} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: "#192b48", fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -8]} className="real-place-label">B · Destination</Tooltip>
        </CircleMarker>
      )}
      {(hasStartGap || hasEndGap) && (
        <div className="real-map-gap-legend" role="note">
          Dashed amber: unrouted connection, not verified.
        </div>
      )}
      {hasUnmappedCoordinates && (
        <div className="real-map-coverage-notice" role="note" style={{ position: "absolute", top: 12, left: 12, right: 120, zIndex: 500, padding: 12, background: "#fff6e7", color: "#68420d", border: "1px solid #dfc28d", borderRadius: 8, pointerEvents: "none" }}>
          Some coordinates are outside this street map’s latitude coverage. They have not been moved to fit. Use the written coordinates and directions.
        </div>
      )}
    </MapContainer>
  );
}
