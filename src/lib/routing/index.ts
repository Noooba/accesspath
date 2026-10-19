import type { RouteEdge, RouteFilters, RouteIssue, RouteMode, RouteNode, RouteResult, SiteGraph, VerificationStatus } from '@/types';
import { MinHeap } from './heap';
import { validateGraph } from './validation';
export { validateGraph } from './validation';
export { haversineDistance, polylineDistance } from './distance';

export const DEFAULT_FILTERS: RouteFilters = Object.freeze({
  avoidStairs: false, requireDocumented: false, avoidSteepSlopes: false,
  maxSlopePercent: 8, avoidUneven: false, excludeBlocked: true,
});
/** Demo preference only. This is not a code-compliance or wheelchair-suitability threshold. */
export const DOCUMENTED_ROUTE_MIN_WIDTH_CM = 90;

const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const acceptedVerification = (status: VerificationStatus, graph: SiteGraph) =>
  status === 'verified' || (graph.site.isDemo && status === 'demonstration');

export function edgeIsDocumented(edge: RouteEdge, graph: SiteGraph): boolean {
  const from = graph.nodes.find((node) => node.id === edge.fromNodeId);
  const to = graph.nodes.find((node) => node.id === edge.toNodeId);
  return acceptedVerification(graph.site.verificationStatus, graph) && acceptedVerification(edge.verificationStatus, graph) &&
    !!from && !!to && acceptedVerification(from.verificationStatus, graph) && acceptedVerification(to.verificationStatus, graph) &&
    edge.surfaceType !== 'unknown' && edge.stepFreeStatus !== 'unknown' && edge.slopePercent !== null &&
    edge.widthCentimeters !== null && edge.curbRampStatus !== 'unknown' && edge.operationalStatus !== 'unknown';
}

function allowed(edge: RouteEdge, graph: SiteGraph, mode: RouteMode, filters: RouteFilters): boolean {
  // A closed path is not available travel geometry in any mode; no toggle can override this.
  if (edge.operationalStatus === 'blocked') return false;
  if (mode === 'exploratory' && (edge.hasStairs || edge.stepFreeStatus === 'not-step-free')) return false;
  if (mode === 'confirmed') {
    // These conditions cannot be disabled by user filters.
    if (!edgeIsDocumented(edge, graph) || edge.hasStairs || edge.stepFreeStatus !== 'confirmed' ||
      edge.operationalStatus !== 'open' || edge.curbRampStatus === 'missing' ||
      edge.widthCentimeters === null || edge.widthCentimeters < DOCUMENTED_ROUTE_MIN_WIDTH_CM) return false;
  }
  if (filters.avoidStairs && (edge.hasStairs || edge.stepFreeStatus === 'not-step-free')) return false;
  if (filters.requireDocumented && !edgeIsDocumented(edge, graph)) return false;
  if (filters.avoidSteepSlopes && edge.slopePercent !== null && edge.slopePercent > filters.maxSlopePercent) return false;
  if (filters.avoidUneven && (edge.surfaceType === 'uneven' || edge.surfaceType === 'gravel')) return false;
  return true;
}

function issuesFor(edge: RouteEdge, graph: SiteGraph, filters: RouteFilters): { barriers: RouteIssue[]; unknowns: RouteIssue[] } {
  const barriers: RouteIssue[] = [];
  const unknowns: RouteIssue[] = [];
  const add = (target: RouteIssue[], label: string, detail: string) => target.push({ edgeId: edge.id, label, detail });
  if (edge.hasStairs || edge.stepFreeStatus === 'not-step-free') add(barriers, 'Stairs / steps', 'This segment is documented as not step-free.');
  if (edge.operationalStatus === 'blocked') add(barriers, 'Blocked path', 'This segment is marked blocked and must not be presented as an available route.');
  if (edge.curbRampStatus === 'missing') add(barriers, 'Missing curb ramp', 'The segment records a missing curb ramp.');
  if (edge.slopePercent !== null && edge.slopePercent > filters.maxSlopePercent) add(barriers, 'Slope above preference', `${edge.slopePercent}% exceeds the selected ${filters.maxSlopePercent}% slope preference; this is not a compliance determination.`);
  if (edge.widthCentimeters !== null && edge.widthCentimeters < DOCUMENTED_ROUTE_MIN_WIDTH_CM) add(barriers, 'Narrow segment', `${edge.widthCentimeters} cm is below this app’s ${DOCUMENTED_ROUTE_MIN_WIDTH_CM} cm documented-route preference.`);
  if (edge.surfaceType === 'gravel' || edge.surfaceType === 'uneven') add(barriers, 'Surface consideration', `The recorded surface is ${edge.surfaceType}.`);
  if (!acceptedVerification(graph.site.verificationStatus, graph)) add(unknowns, 'Site unverified', 'This site has not been verified; a route cannot be confirmed.');
  if (!acceptedVerification(edge.verificationStatus, graph)) add(unknowns, 'Segment unverified', 'The segment’s access information has not been verified for this site.');
  if (graph.nodes.some((node) => (node.id === edge.fromNodeId || node.id === edge.toNodeId) && !acceptedVerification(node.verificationStatus, graph))) add(unknowns, 'Endpoint unverified', 'At least one intersection or destination on this segment is unverified.');
  if (edge.stepFreeStatus === 'unknown') add(unknowns, 'Step-free status unknown', 'No confirmed step-free status is recorded for this segment.');
  if (edge.slopePercent === null) add(unknowns, 'Slope unknown', 'No slope measurement is recorded.');
  if (edge.widthCentimeters === null) add(unknowns, 'Width unknown', 'No clear-width measurement is recorded.');
  if (edge.curbRampStatus === 'unknown') add(unknowns, 'Curb status unknown', 'Curb-ramp availability or non-necessity has not been recorded.');
  if (edge.surfaceType === 'unknown') add(unknowns, 'Surface unknown', 'No surface information is recorded.');
  if (edge.operationalStatus === 'unknown') add(unknowns, 'Operational status unknown', 'It is not known whether this segment is open.');
  return { barriers, unknowns };
}

function emptyResult(graph: SiteGraph, mode: RouteMode, status: RouteResult['status'], explanation: string, error?: RouteResult['error']): RouteResult {
  return { status, mode, nodeIds: [], edgeIds: [], distanceMeters: 0, barriers: [], unknowns: [],
    coverage: { documentedEdges: 0, totalEdges: 0, percent: 0, isDemonstration: Boolean(graph?.site?.isDemo) }, explanation, ...(error ? { error } : {}) };
}

/** Length-weighted Dijkstra. Directionality, strict access exclusions and unknowns are explicit. */
export function route(graph: SiteGraph, start: string, end: string, mode: RouteMode, partialFilters: Partial<RouteFilters> = {}): RouteResult {
  const validation = validateGraph(graph);
  if (!validation.valid) {
    const first = validation.errors[0];
    return emptyResult(graph, mode, 'invalid', 'The graph could not be routed because its data is invalid.', { code: first.code, message: first.message });
  }
  if (!['shortest', 'confirmed', 'exploratory'].includes(mode)) return emptyResult(graph, mode, 'invalid', 'Choose a supported routing mode.', { code: 'INVALID_MODE', message: 'Unsupported routing mode.' });
  const filters = { ...DEFAULT_FILTERS, ...(mode === 'exploratory' ? { avoidStairs: true } : {}), ...partialFilters };
  if (!Number.isFinite(filters.maxSlopePercent) || filters.maxSlopePercent < 0 ||
    Object.entries(filters).some(([key, value]) => key !== 'maxSlopePercent' && typeof value !== 'boolean')) {
    return emptyResult(graph, mode, 'invalid', 'Route preferences contain an invalid value.', { code: 'INVALID_FILTER', message: 'Slope must be finite and non-negative; route toggles must be booleans.' });
  }
  const nodes = new Map<string, RouteNode>(graph.nodes.map((node) => [node.id, node]));
  if (!nodes.has(start) || !nodes.has(end)) return emptyResult(graph, mode, 'invalid', 'Choose a start and destination from this site.', { code: 'UNKNOWN_NODE', message: 'Start or destination does not exist in the selected graph.' });
  if (mode === 'confirmed' && (!acceptedVerification(nodes.get(start)!.verificationStatus, graph) || !acceptedVerification(nodes.get(end)!.verificationStatus, graph) || !acceptedVerification(graph.site.verificationStatus, graph))) {
    return emptyResult(graph, mode, 'unreachable', 'The site, start or destination is unverified. A confirmed route cannot be established.');
  }
  if (start === end) return { ...emptyResult(graph, mode, 'found', 'Start and destination are the same. No path segments were traversed; coverage is not applicable.'), nodeIds: [start] };
  const adjacency = new Map<string, { to: string; edge: RouteEdge }[]>(graph.nodes.map((node) => [node.id, []]));
  for (const edge of [...graph.edges].sort((a, b) => compareIds(a.id, b.id))) {
    if (!allowed(edge, graph, mode, filters)) continue;
    adjacency.get(edge.fromNodeId)!.push({ to: edge.toNodeId, edge });
    if (edge.isBidirectional) adjacency.get(edge.toNodeId)!.push({ to: edge.fromNodeId, edge });
  }
  const queue = new MinHeap<{ id: string; distance: number }>((a, b) => a.distance - b.distance || compareIds(a.id, b.id));
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, { from: string; edge: RouteEdge }>();
  queue.push({ id: start, distance: 0 });
  while (queue.size > 0) {
    const current = queue.pop()!;
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === end) break;
    for (const neighbor of adjacency.get(current.id)!) {
      const next = current.distance + neighbor.edge.lengthMeters;
      if (!Number.isFinite(next)) return emptyResult(graph, mode, 'invalid', 'The route length exceeded the supported numeric range.', { code: 'DISTANCE_OVERFLOW', message: 'Accumulated route distance is not finite.' });
      if (next < (distances.get(neighbor.to) ?? Infinity)) {
        distances.set(neighbor.to, next);
        previous.set(neighbor.to, { from: current.id, edge: neighbor.edge });
        queue.push({ id: neighbor.to, distance: next });
      }
    }
  }
  const distance = distances.get(end);
  if (distance === undefined) return emptyResult(graph, mode, 'unreachable', mode === 'confirmed' ?
    'No route meets all documented step-free requirements and the selected preferences. This does not prove that no accessible path exists; more data or a site review may be needed.' :
    'No connected route meets the selected preferences. Change the endpoints or request updated site information.');
  const selectedEdges: RouteEdge[] = [];
  const nodeIds = [end];
  let currentId = end;
  while (currentId !== start) {
    const item = previous.get(currentId)!;
    selectedEdges.unshift(item.edge);
    nodeIds.unshift(item.from);
    currentId = item.from;
  }
  const issues = selectedEdges.map((edge) => issuesFor(edge, graph, filters));
  const documentedEdges = selectedEdges.filter((edge) => edgeIsDocumented(edge, graph)).length;
  const barriers = issues.flatMap((item) => item.barriers);
  const unknowns = issues.flatMap((item) => item.unknowns);
  const demonstration = graph.site.isDemo ? ' Simulation only: this is invented demo geography, not verified campus guidance.' : '';
  const explanation = mode === 'confirmed' ? 'Every traversed segment has documented step-free, open-path, endpoint, surface, slope, width and curb information under the stated rules.' :
    mode === 'exploratory' ? `Exploratory path: ${unknowns.length ? 'unresolved information needs site confirmation before relying on this route.' : 'review all segment information and capture dates before travel.'}` :
      `Shortest path under the selected exclusions.${barriers.length ? ' Recorded access barriers are present.' : ''}${unknowns.length ? ' Some access information is unknown.' : ''}`;
  return { status: 'found', mode, nodeIds, edgeIds: selectedEdges.map((edge) => edge.id), distanceMeters: distance,
    barriers, unknowns, coverage: { documentedEdges, totalEdges: selectedEdges.length, percent: Math.round(documentedEdges / selectedEdges.length * 100), isDemonstration: graph.site.isDemo },
    explanation: explanation + demonstration };
}
