import type { RouteEdge, RouteNode, ScenarioId, Site, SiteGraph } from '@/types';
import { polylineDistance } from '@/lib/routing/distance';

const CREATED = '2026-10-16T00:00:00.000Z';
export const DEMO_SITE: Site = {
  id: 'demo-campus', slug: 'demo-campus', name: 'AccessPath Demo Campus',
  description: 'An entirely invented campus for testing route choices. Locations, distances and access conditions are simulated; do not use for real travel.',
  centerLatitude: 0.00165, centerLongitude: 0.0019, siteType: 'demo', isDemo: true,
  verificationStatus: 'demonstration', createdAt: CREATED, updatedAt: CREATED,
};
export const PILOT_SITE: Site = {
  id: 'palos-verdes-potential-pilot', slug: 'palos-verdes-potential-pilot', name: 'Palos Verdes · potential pilot',
  description: 'Potential pilot only. No surveyed paths, access claims or campus map are available. A participating site must supply and verify its own data before routing is enabled.',
  centerLatitude: 33.7445, centerLongitude: -118.387, siteType: 'school', isDemo: false,
  verificationStatus: 'unverified', createdAt: CREATED, updatedAt: CREATED,
};
export const SITES: Site[] = [DEMO_SITE, PILOT_SITE];
export const PILOT_GRAPH: SiteGraph = { site: PILOT_SITE, nodes: [], edges: [] };

/** Synthetic local metres translated into geographic-looking coordinates near (0,0), NOT a real site. */
const position = (east: number, north: number): [number, number] => [0.001 + north / 111_195.0802, 0.001 + east / 111_195.0802];
type NodeSpec = [id: string, name: string, east: number, north: number, type?: RouteNode['nodeType']];
const NODE_SPECS: NodeSpec[] = [
  ['main-gate', 'Main gate', 0, 0, 'entrance'],
  ['welcome-plaza', 'Welcome plaza', 30, 30, 'intersection'],
  ['lower-court', 'Lower court', 30, 0, 'intersection'],
  ['ramp-west', 'West ramp', 30, 85, 'ramp'],
  ['upper-walk', 'Upper walk', 60, 105, 'intersection'],
  ['library-forecourt', 'Library forecourt', 100, 105, 'intersection'],
  ['library', 'Library', 120, 105, 'destination'],
  ['student-center', 'Student center', 70, 30, 'destination'],
  ['student-courtyard', 'Student courtyard', 100, 45, 'intersection'],
  ['arts', 'Arts building', 130, 30, 'destination'],
  ['arts-court', 'Arts courtyard', 150, 70, 'intersection'],
  ['east-ramp', 'East ramp', 150, 100, 'ramp'],
  ['science', 'Science building', 185, 100, 'destination'],
  ['science-court', 'Science courtyard', 190, 60, 'intersection'],
  ['east-gate', 'East gate', 230, 30, 'entrance'],
  ['garden', 'Learning garden', 190, 140, 'destination'],
  ['garden-bridge', 'Garden bridge', 135, 150, 'intersection'],
  ['north-path', 'North walk', 95, 155, 'intersection'],
  ['gym', 'Gymnasium', 40, 160, 'destination'],
  ['gym-foyer', 'Gym foyer', 40, 135, 'entrance'],
  ['sports-court', 'Sports court', 0, 120, 'destination'],
  ['west-gate', 'West gate', -20, 80, 'entrance'],
  ['auditorium', 'Auditorium', -20, 30, 'destination'],
  ['service-walk', 'Service walk', 0, 60, 'intersection'],
  ['admin', 'Administration', 70, -20, 'destination'],
  ['cafe', 'Campus café', 125, -10, 'destination'],
];
const nodes: RouteNode[] = NODE_SPECS.map(([id, name, east, north, nodeType = 'regular']) => {
  const [latitude, longitude] = position(east, north);
  return { id, siteId: DEMO_SITE.id, name, latitude, longitude, nodeType, verificationStatus: 'demonstration',
    sourceDescription: 'Invented demonstration location; not a surveyed or verified real-world place.', verifiedAt: null, createdAt: CREATED };
});
const byId = new Map(nodes.map((node) => [node.id, node]));

type EdgeSpec = [id: string, from: string, to: string, attributes?: Partial<RouteEdge>];
const EDGE_SPECS: EdgeSpec[] = [
  ['gate-plaza', 'main-gate', 'welcome-plaza'],
  ['gate-court', 'main-gate', 'lower-court'],
  ['stair-flight', 'lower-court', 'library', { hasStairs: true, stepFreeStatus: 'not-step-free', slopePercent: 25, widthCentimeters: 120 }],
  ['plaza-west-ramp', 'welcome-plaza', 'ramp-west', { slopePercent: 5 }],
  ['ramp-upper-walk', 'ramp-west', 'upper-walk', { slopePercent: 4 }],
  ['upper-library-walk', 'upper-walk', 'library-forecourt'],
  ['library-entry', 'library-forecourt', 'library'],
  ['plaza-student-center', 'welcome-plaza', 'student-center'],
  ['student-center-courtyard', 'student-center', 'student-courtyard'],
  ['courtyard-arts', 'student-courtyard', 'arts'],
  ['arts-courtyard', 'arts', 'arts-court'],
  ['arts-east-ramp', 'arts-court', 'east-ramp', { slopePercent: 4.5 }],
  ['east-library-walk', 'east-ramp', 'library-forecourt'],
  ['courtyard-library-walk', 'student-courtyard', 'library-forecourt'],
  ['west-ramp-gym', 'ramp-west', 'gym-foyer', { slopePercent: 3 }],
  ['gym-entry', 'gym-foyer', 'gym'],
  ['gym-north-walk', 'gym', 'north-path'],
  ['north-garden-bridge', 'north-path', 'garden-bridge'],
  ['bridge-garden', 'garden-bridge', 'garden'],
  ['bridge-east-ramp', 'garden-bridge', 'east-ramp', { widthCentimeters: 130 }],
  ['east-science-walk', 'east-ramp', 'science'],
  ['science-courtyard', 'science', 'science-court'],
  ['science-east-gate', 'science-court', 'east-gate', { curbRampStatus: 'present' }],
  ['arts-science-walk', 'arts', 'science-court'],
  ['science-arts-court', 'science-court', 'arts-court'],
  ['garden-science-walk', 'garden', 'science'],
  ['gate-administration', 'main-gate', 'admin'],
  ['admin-student-center', 'admin', 'student-center'],
  ['admin-cafe', 'admin', 'cafe'],
  ['cafe-arts', 'cafe', 'arts'],
  ['cafe-east-gate', 'cafe', 'east-gate', { surfaceType: 'gravel', widthCentimeters: null, verificationStatus: 'unverified' }],
  ['west-gate-sports', 'west-gate', 'sports-court'],
  ['sports-gym-foyer', 'sports-court', 'gym-foyer'],
  ['west-service-walk', 'west-gate', 'service-walk'],
  ['service-plaza', 'service-walk', 'welcome-plaza'],
  ['service-auditorium', 'service-walk', 'auditorium'],
  ['auditorium-main-gate', 'auditorium', 'main-gate'],
  ['plaza-auditorium', 'welcome-plaza', 'auditorium'],
  ['sports-gym-walk', 'sports-court', 'gym', { surfaceType: 'uneven', slopePercent: 10 }],
  ['service-west-ramp', 'service-walk', 'ramp-west'],
  ['arts-bridge-shortcut', 'arts-court', 'garden-bridge', { widthCentimeters: 75, slopePercent: null }],
  ['west-auditorium', 'west-gate', 'auditorium', { operationalStatus: 'blocked', sourceDescription: 'Invented baseline closure of the west auditorium segment for demonstration. This is not a real obstruction or survey observation.' }],
];

const edges: RouteEdge[] = EDGE_SPECS.map(([id, fromNodeId, toNodeId, attributes = {}]) => {
  const from = byId.get(fromNodeId)!;
  const to = byId.get(toNodeId)!;
  const geometry: [number, number][] = [[from.latitude, from.longitude], [to.latitude, to.longitude]];
  const lengthMeters = polylineDistance(geometry);
  if (lengthMeters === null) throw new Error(`Invalid synthetic geometry for ${id}.`);
  return { id, siteId: DEMO_SITE.id, fromNodeId, toNodeId, geometry, lengthMeters,
    isBidirectional: true, surfaceType: 'paved', hasStairs: false, stepFreeStatus: 'confirmed',
    slopePercent: 1, widthCentimeters: 180, curbRampStatus: 'not-required', operationalStatus: 'open',
    verificationStatus: 'demonstration', verifiedAt: null,
    sourceDescription: 'Invented demonstration condition. Distances are calculated from synthetic geometry; access attributes are simulation inputs, not survey findings.', updatedAt: CREATED,
    ...attributes };
});

export const DEMO_GRAPH: SiteGraph = { site: DEMO_SITE, nodes, edges };

export const SCENARIOS: { id: ScenarioId; name: string; description: string }[] = [
  { id: 'baseline', name: 'Baseline campus', description: 'Compare a short stair route with a longer documented step-free route.' },
  { id: 'closure', name: 'Walkway closure', description: 'The upper library walkway is blocked. Routing uses another documented path.' },
  { id: 'uncertain', name: 'Missing access data', description: 'Library approaches have unknown width and step-free details. Only an exploratory route is available.' },
  { id: 'disconnected', name: 'No open approach', description: 'All library approaches are marked blocked. No available route is returned.' },
];

/** Always returns a fresh graph; scenario edits apply only to the synthetic demo. */
export function applyScenario(graph: SiteGraph, id: ScenarioId): SiteGraph {
  const result = structuredClone(graph);
  if (!graph.site.isDemo) return result;
  // Scenarios are independent: reset to the supplied baseline first. Call with DEMO_GRAPH.
  if (id === 'closure') {
    result.edges = result.edges.map((edge) => edge.id === 'upper-library-walk' ? { ...edge, operationalStatus: 'blocked',
      sourceDescription: 'Simulated temporary walkway closure. This is demonstration data.' } : edge);
  }
  if (id === 'uncertain') {
    result.edges = result.edges.map((edge) => edge.id === 'library-entry' ? { ...edge, stepFreeStatus: 'unknown', widthCentimeters: null,
      verificationStatus: 'unverified', sourceDescription: 'Simulated incomplete access information at the library entry; requires site review.' } :
      edge.id === 'stair-flight' ? { ...edge, operationalStatus: 'blocked' } : edge);
  }
  if (id === 'disconnected') {
    result.edges = result.edges.map((edge) => edge.toNodeId === 'library' || edge.fromNodeId === 'library' ?
      { ...edge, operationalStatus: 'blocked', sourceDescription: 'Simulated closure of all library approaches; no open path is recorded.' } : edge);
  }
  return result;
}
