export type VerificationStatus = "verified" | "unverified" | "demonstration";
export type Site = {
  id: string;
  slug: string;
  name: string;
  description: string;
  centerLatitude: number;
  centerLongitude: number;
  siteType: "demo" | "school" | "community";
  isDemo: boolean;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
};
export type RouteNode = {
  id: string;
  siteId: string;
  name: string;
  latitude: number;
  longitude: number;
  nodeType:
    | "intersection"
    | "entrance"
    | "ramp"
    | "elevator"
    | "destination"
    | "regular";
  verificationStatus: VerificationStatus;
  sourceDescription: string;
  verifiedAt: string | null;
  createdAt: string;
};
export type RouteEdge = {
  id: string;
  siteId: string;
  fromNodeId: string;
  toNodeId: string;
  isBidirectional: boolean;
  geometry: [number, number][];
  lengthMeters: number;
  surfaceType: "paved" | "gravel" | "uneven" | "unknown";
  hasStairs: boolean;
  stepFreeStatus: "confirmed" | "not-step-free" | "unknown";
  slopePercent: number | null;
  widthCentimeters: number | null;
  curbRampStatus: "present" | "not-required" | "missing" | "unknown";
  operationalStatus: "open" | "blocked" | "unknown";
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  sourceDescription: string;
  updatedAt: string;
};
export type SiteGraph = { site: Site; nodes: RouteNode[]; edges: RouteEdge[] };
export type RouteMode = "shortest" | "confirmed" | "exploratory";
export type RouteFilters = {
  avoidStairs: boolean;
  requireDocumented: boolean;
  avoidSteepSlopes: boolean;
  maxSlopePercent: number;
  avoidUneven: boolean;
  excludeBlocked: boolean;
};
export type RouteIssue = { edgeId: string; label: string; detail: string };
export type RouteResult = {
  status: "found" | "unreachable" | "invalid";
  mode: RouteMode;
  nodeIds: string[];
  edgeIds: string[];
  distanceMeters: number;
  barriers: RouteIssue[];
  unknowns: RouteIssue[];
  coverage: {
    documentedEdges: number;
    totalEdges: number;
    percent: number;
    isDemonstration: boolean;
  };
  explanation: string;
  error?: { code: string; message: string };
};
export type ScenarioId = "baseline" | "closure" | "uncertain" | "disconnected";
export type ReportCategory =
  | "blocked-path"
  | "stairs"
  | "damaged-surface"
  | "missing-curb-ramp"
  | "steep-slope"
  | "inaccessible-entrance"
  | "other";
export type ObstacleReport = {
  id: string;
  siteId: string;
  edgeId: string;
  category: ReportCategory;
  description: string;
  reportedAt: string;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedAt: string | null;
  moderatorNotes: string;
};
