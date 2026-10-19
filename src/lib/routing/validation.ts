import type { SiteGraph } from '@/types';
import { isCoordinate } from './distance';

export type GraphError = { code: string; message: string; nodeId?: string; edgeId?: string };
export type GraphValidation = { valid: boolean; errors: GraphError[] };
const verification = new Set(['verified', 'unverified', 'demonstration']);

/** Reject invalid topology or weights before Dijkstra can produce misleading results. */
export function validateGraph(graph: SiteGraph): GraphValidation {
  const errors: GraphError[] = [];
  if (!graph || !graph.site || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { valid: false, errors: [{ code: 'INVALID_GRAPH', message: 'A site, node array and edge array are required.' }] };
  }
  if (!graph.site.id || typeof graph.site.isDemo !== 'boolean' || !verification.has(graph.site.verificationStatus)) {
    errors.push({ code: 'INVALID_SITE', message: 'The site needs an ID and an explicit demonstration and verification status.' });
  }
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || nodeIds.has(node.id)) errors.push({ code: 'DUPLICATE_NODE', nodeId: node.id, message: `Node ID ${node.id || '(empty)'} is missing or duplicated.` });
    nodeIds.add(node.id);
    if (node.siteId !== graph.site.id) errors.push({ code: 'NODE_SITE_MISMATCH', nodeId: node.id, message: `Node ${node.id} belongs to another site.` });
    if (!isCoordinate([node.latitude, node.longitude])) errors.push({ code: 'INVALID_COORDINATE', nodeId: node.id, message: `Node ${node.id} has an invalid coordinate.` });
    if (!verification.has(node.verificationStatus)) errors.push({ code: 'INVALID_VERIFICATION', nodeId: node.id, message: `Node ${node.id} has an invalid verification status.` });
  }
  for (const edge of graph.edges) {
    if (!edge.id || edgeIds.has(edge.id)) errors.push({ code: 'DUPLICATE_EDGE', edgeId: edge.id, message: `Edge ID ${edge.id || '(empty)'} is missing or duplicated.` });
    edgeIds.add(edge.id);
    if (edge.siteId !== graph.site.id) errors.push({ code: 'EDGE_SITE_MISMATCH', edgeId: edge.id, message: `Edge ${edge.id} belongs to another site.` });
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) errors.push({ code: 'MISSING_ENDPOINT', edgeId: edge.id, message: `Edge ${edge.id} refers to a missing node.` });
    if (!Number.isFinite(edge.lengthMeters) || edge.lengthMeters < 0) errors.push({ code: 'INVALID_WEIGHT', edgeId: edge.id, message: `Edge ${edge.id} must have a finite, non-negative length.` });
    if (!Array.isArray(edge.geometry) || edge.geometry.length < 2 || !edge.geometry.every(isCoordinate)) errors.push({ code: 'INVALID_GEOMETRY', edgeId: edge.id, message: `Edge ${edge.id} needs a valid coordinate polyline.` });
    if (edge.slopePercent !== null && (!Number.isFinite(edge.slopePercent) || edge.slopePercent < 0)) errors.push({ code: 'INVALID_SLOPE', edgeId: edge.id, message: `Edge ${edge.id} slope must be non-negative or unknown.` });
    if (edge.widthCentimeters !== null && (!Number.isFinite(edge.widthCentimeters) || edge.widthCentimeters <= 0)) errors.push({ code: 'INVALID_WIDTH', edgeId: edge.id, message: `Edge ${edge.id} width must be positive or unknown.` });
    if (!verification.has(edge.verificationStatus) || typeof edge.isBidirectional !== 'boolean' || typeof edge.hasStairs !== 'boolean' ||
      !['paved', 'gravel', 'uneven', 'unknown'].includes(edge.surfaceType) || !['confirmed', 'not-step-free', 'unknown'].includes(edge.stepFreeStatus) ||
      !['present', 'not-required', 'missing', 'unknown'].includes(edge.curbRampStatus) || !['open', 'blocked', 'unknown'].includes(edge.operationalStatus)) {
      errors.push({ code: 'INVALID_EDGE_ATTRIBUTES', edgeId: edge.id, message: `Edge ${edge.id} has unsupported or missing access attributes.` });
    }
  }
  return { valid: errors.length === 0, errors };
}
