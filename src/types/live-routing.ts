export type LatLon = { lat: number; lon: number };
export type RealPlace = LatLon & {
  id: string;
  label: string;
  source: "photon" | "map" | "coordinates";
};
export type WalkingStep = {
  instruction: string;
  distanceMeters: number;
  location: [number, number];
};
export type RealWalkingRoute = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  steps: WalkingStep[];
  snappedStart: LatLon;
  snappedEnd: LatLon;
  startSnapDistanceMeters: number;
  endSnapDistanceMeters: number;
  warnings: string[];
};
export type LiveRouteResponse = {
  provider: "FOSSGIS OSRM";
  profile: "walking";
  dataSource: "OpenStreetMap";
  routes: RealWalkingRoute[];
  fetchedAt: string;
};
export type PlaceSearchResponse = {
  places: RealPlace[];
  provider: "Photon";
  attribution: "© OpenStreetMap contributors";
};
