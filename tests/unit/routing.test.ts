import { describe, expect, it } from 'vitest';
import type { RouteEdge, SiteGraph } from '@/types';
import { applyScenario, DEMO_GRAPH, PILOT_GRAPH, SITES } from '@/data/demo-campus';
import { DEFAULT_FILTERS, edgeIsDocumented, haversineDistance, polylineDistance, route, validateGraph } from '@/lib/routing';
import { MinHeap } from '@/lib/routing/heap';

function fixture(): SiteGraph {
  const nodes = DEMO_GRAPH.nodes.slice(0, 3).map((node, index) => ({ ...node, id: ['a', 'b', 'c'][index] }));
  const first = DEMO_GRAPH.edges[0];
  const edge = (id: string, fromNodeId: string, toNodeId: string, lengthMeters: number): RouteEdge => ({ ...first, id, fromNodeId, toNodeId, lengthMeters });
  return { site: { ...DEMO_GRAPH.site }, nodes, edges: [edge('ab', 'a', 'b', 5), edge('bc', 'b', 'c', 7), edge('ac', 'a', 'c', 20)] };
}
const changeEdge = (graph: SiteGraph, id: string, attributes: Partial<RouteEdge>) => {
  const result = structuredClone(graph);
  result.edges = result.edges.map((edge) => edge.id === id ? { ...edge, ...attributes } : edge);
  return result;
};

describe('synthetic demo and truthful scenario data', () => {
  it('contains 26 valid invented nodes and 42 explicit edges', () => {
    expect(DEMO_GRAPH.nodes).toHaveLength(26);
    expect(DEMO_GRAPH.edges).toHaveLength(42);
    expect(validateGraph(DEMO_GRAPH)).toEqual({ valid: true, errors: [] });
    expect(DEMO_GRAPH.nodes.every((node) => Math.abs(node.latitude) < 0.01 && Math.abs(node.longitude) < 0.01)).toBe(true);
  });
  it('keeps the potential real pilot empty and unverified', () => {
    expect(SITES).toHaveLength(2);
    expect(PILOT_GRAPH.site.isDemo).toBe(false);
    expect(PILOT_GRAPH.site.verificationStatus).toBe('unverified');
    expect(PILOT_GRAPH.nodes).toEqual([]);
    expect(PILOT_GRAPH.edges).toEqual([]);
    expect(route(PILOT_GRAPH, 'main-gate', 'library', 'confirmed').status).toBe('invalid');
  });
  it('uses calculated synthetic polyline distances rather than arbitrary weights', () => {
    for (const edge of DEMO_GRAPH.edges) expect(edge.lengthMeters).toBeCloseTo(polylineDistance(edge.geometry)!, 8);
  });
  it('includes a clearly marked peripheral baseline closure without changing the main comparison', () => {
    expect(DEMO_GRAPH.edges.find((edge) => edge.id === 'west-auditorium')).toMatchObject({ operationalStatus: 'blocked', verificationStatus: 'demonstration' });
    const result = route(DEMO_GRAPH, 'west-gate', 'auditorium', 'shortest', { excludeBlocked: false });
    expect(result.status).toBe('found');
    expect(result.edgeIds).not.toContain('west-auditorium');
    expect(route(DEMO_GRAPH, 'main-gate', 'library', 'shortest').distanceMeters).toBeCloseTo(168.2931668856, 8);
    expect(route(DEMO_GRAPH, 'main-gate', 'library', 'confirmed').distanceMeters).toBeCloseTo(193.4819196324, 8);
  });
  it('shows the shorter stair walk and the longer documented step-free walk', () => {
    const shortest = route(DEMO_GRAPH, 'main-gate', 'library', 'shortest');
    const confirmed = route(DEMO_GRAPH, 'main-gate', 'library', 'confirmed');
    expect(shortest.status).toBe('found');
    expect(shortest.edgeIds).toContain('stair-flight');
    expect(shortest.barriers.some((issue) => issue.label === 'Stairs / steps')).toBe(true);
    expect(confirmed.status).toBe('found');
    expect(confirmed.edgeIds).not.toContain('stair-flight');
    expect(confirmed.distanceMeters).toBeGreaterThan(shortest.distanceMeters);
    expect(confirmed.coverage.isDemonstration).toBe(true);
    expect(confirmed.explanation).toContain('Simulation only');
  });
  it('routes around the closure using a longer open alternative', () => {
    const baseline = route(DEMO_GRAPH, 'main-gate', 'library', 'confirmed');
    const closure = route(applyScenario(DEMO_GRAPH, 'closure'), 'main-gate', 'library', 'confirmed');
    expect(baseline.edgeIds).toContain('upper-library-walk');
    expect(closure.status).toBe('found');
    expect(closure.edgeIds).not.toContain('upper-library-walk');
    expect(closure.distanceMeters).toBeGreaterThan(baseline.distanceMeters);
  });
  it('withholds confirmation where entry information is unknown, but labels an exploratory path', () => {
    const graph = applyScenario(DEMO_GRAPH, 'uncertain');
    expect(route(graph, 'main-gate', 'library', 'confirmed').status).toBe('unreachable');
    const exploratory = route(graph, 'main-gate', 'library', 'exploratory');
    expect(exploratory.status).toBe('found');
    expect(exploratory.unknowns.some((issue) => issue.label === 'Width unknown')).toBe(true);
    expect(exploratory.unknowns.some((issue) => issue.label === 'Step-free status unknown')).toBe(true);
    expect(exploratory.coverage.percent).toBeLessThan(100);
  });
  it('does not return a route when every destination approach is blocked', () => {
    const graph = applyScenario(DEMO_GRAPH, 'disconnected');
    for (const mode of ['shortest', 'confirmed', 'exploratory'] as const) {
      const result = route(graph, 'main-gate', 'library', mode, { excludeBlocked: false });
      expect(result.status).toBe('unreachable');
      expect(result.edgeIds).toEqual([]);
      expect(result.distanceMeters).toBe(0);
    }
  });
  it('does not mutate the source graph or apply demo closures to a real site', () => {
    const original = JSON.stringify(DEMO_GRAPH);
    const altered = applyScenario(DEMO_GRAPH, 'closure');
    expect(JSON.stringify(DEMO_GRAPH)).toBe(original);
    expect(altered.edges.find((edge) => edge.id === 'upper-library-walk')!.operationalStatus).toBe('blocked');
    expect(applyScenario(PILOT_GRAPH, 'closure')).toEqual(PILOT_GRAPH);
    expect(applyScenario(PILOT_GRAPH, 'baseline')).not.toBe(PILOT_GRAPH);
  });
});

describe('Dijkstra route topology, directions and failure states', () => {
  it('finds the minimum accumulated edge length in the correct order', () => {
    const result = route(fixture(), 'a', 'c', 'shortest');
    expect(result.nodeIds).toEqual(['a', 'b', 'c']);
    expect(result.edgeIds).toEqual(['ab', 'bc']);
    expect(result.distanceMeters).toBe(12);
  });
  it('traverses bidirectional edges in reverse order', () => {
    const result = route(fixture(), 'c', 'a', 'shortest');
    expect(result.nodeIds).toEqual(['c', 'b', 'a']);
    expect(result.edgeIds).toEqual(['bc', 'ab']);
    expect(result.distanceMeters).toBe(12);
  });
  it('respects one-way geometry', () => {
    const graph = fixture();
    graph.edges = graph.edges.map((edge) => ({ ...edge, isBidirectional: false }));
    expect(route(graph, 'a', 'c', 'shortest').distanceMeters).toBe(12);
    expect(route(graph, 'c', 'a', 'shortest').status).toBe('unreachable');
  });
  it('handles an identical origin and destination without claiming segment coverage', () => {
    const result = route(fixture(), 'a', 'a', 'confirmed');
    expect(result.status).toBe('found');
    expect(result.nodeIds).toEqual(['a']);
    expect(result.edgeIds).toEqual([]);
    expect(result.distanceMeters).toBe(0);
    expect(result.coverage).toMatchObject({ documentedEdges: 0, totalEdges: 0, percent: 0 });
    expect(result.explanation).toContain('not applicable');
  });
  it('returns an invalid state for nonexistent endpoints', () => {
    expect(route(fixture(), 'missing', 'c', 'shortest')).toMatchObject({ status: 'invalid', error: { code: 'UNKNOWN_NODE' } });
  });
  it('does not get stuck in a zero-cost cycle', () => {
    const graph = changeEdge(fixture(), 'ab', { lengthMeters: 0 });
    expect(route(graph, 'a', 'c', 'shortest').distanceMeters).toBe(7);
  });
  it('chooses the same equal-cost path independent of input node and edge order', () => {
    const graph = changeEdge(fixture(), 'ac', { lengthMeters: 12 });
    const expected = route(graph, 'a', 'c', 'shortest');
    const reversed = { ...graph, nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() };
    expect(route(reversed, 'a', 'c', 'shortest')).toEqual(expected);
  });
  it('rejects accumulated numeric overflow', () => {
    const graph = fixture();
    graph.edges = graph.edges.filter((edge) => edge.id !== 'ac').map((edge) => ({ ...edge, lengthMeters: 1e308, isBidirectional: false }));
    expect(route(graph, 'a', 'c', 'shortest')).toMatchObject({ status: 'invalid', error: { code: 'DISTANCE_OVERFLOW' } });
  });
});

describe('access exclusions cannot be weakened into false confirmation', () => {
  it.each([
    { hasStairs: true }, { stepFreeStatus: 'not-step-free' as const }, { stepFreeStatus: 'unknown' as const },
    { operationalStatus: 'blocked' as const }, { operationalStatus: 'unknown' as const },
    { slopePercent: null }, { widthCentimeters: null }, { widthCentimeters: 89 },
    { curbRampStatus: 'missing' as const }, { curbRampStatus: 'unknown' as const },
    { surfaceType: 'unknown' as const }, { verificationStatus: 'unverified' as const },
  ])('rejects unsafe or incomplete attributes in confirmed mode: %j', (attributes) => {
    const graph = fixture();
    graph.edges = graph.edges.map((edge) => ({ ...edge, ...attributes }));
    const result = route(graph, 'a', 'c', 'confirmed', { avoidStairs: false, excludeBlocked: false, requireDocumented: false });
    expect(result.status).toBe('unreachable');
  });
  it('rejects blocked segments in every mode even when the caller disables the legacy toggle', () => {
    const graph = fixture();
    graph.edges = graph.edges.map((edge) => ({ ...edge, operationalStatus: 'blocked' }));
    for (const mode of ['shortest', 'confirmed', 'exploratory'] as const) {
      expect(route(graph, 'a', 'c', mode, { excludeBlocked: false }).status).toBe('unreachable');
    }
  });
  it('never routes known steps as an exploratory step-free path', () => {
    const graph = fixture();
    graph.edges = graph.edges.map((edge) => ({ ...edge, hasStairs: true, stepFreeStatus: 'not-step-free' }));
    expect(route(graph, 'a', 'c', 'exploratory', { avoidStairs: false }).status).toBe('unreachable');
    expect(route(graph, 'a', 'c', 'shortest', { avoidStairs: false }).status).toBe('found');
  });
  it('enforces optional slope, stairs, uneven-surface and documentation filters', () => {
    const steep = changeEdge(fixture(), 'ab', { slopePercent: 12 });
    expect(route(steep, 'a', 'c', 'shortest', { avoidSteepSlopes: true }).edgeIds).toEqual(['ac']);
    expect(route(steep, 'a', 'c', 'shortest', { avoidSteepSlopes: true, maxSlopePercent: 12 }).edgeIds).toEqual(['ab', 'bc']);
    const stair = changeEdge(fixture(), 'ab', { hasStairs: true });
    expect(route(stair, 'a', 'c', 'shortest', { avoidStairs: true }).edgeIds).toEqual(['ac']);
    const uneven = changeEdge(fixture(), 'ab', { surfaceType: 'uneven' });
    expect(route(uneven, 'a', 'c', 'shortest', { avoidUneven: true }).edgeIds).toEqual(['ac']);
    const unknown = changeEdge(fixture(), 'ab', { widthCentimeters: null });
    expect(route(unknown, 'a', 'c', 'exploratory', { requireDocumented: true }).edgeIds).toEqual(['ac']);
  });
  it('does not treat a demonstration tag as verification on a real site', () => {
    const graph = fixture();
    graph.site = { ...graph.site, isDemo: false, siteType: 'school' };
    expect(route(graph, 'a', 'c', 'confirmed').status).toBe('unreachable');
    expect(route(graph, 'a', 'c', 'shortest').coverage).toMatchObject({ documentedEdges: 0, percent: 0, isDemonstration: false });
  });
  it('requires verified site, edges and endpoint nodes for real-site confirmation', () => {
    const graph = fixture();
    graph.site = { ...graph.site, isDemo: false, siteType: 'school', verificationStatus: 'verified' };
    graph.nodes = graph.nodes.map((node) => ({ ...node, verificationStatus: 'verified' }));
    graph.edges = graph.edges.map((edge) => ({ ...edge, verificationStatus: 'verified' }));
    expect(route(graph, 'a', 'c', 'confirmed').status).toBe('found');
    graph.nodes.find((node) => node.id === 'c')!.verificationStatus = 'unverified';
    expect(route(graph, 'a', 'c', 'confirmed').status).toBe('unreachable');
  });
  it('reports actual path-specific unknowns and coverage', () => {
    const graph = changeEdge(fixture(), 'ab', { slopePercent: null, widthCentimeters: null });
    const result = route(graph, 'a', 'c', 'exploratory');
    expect(result.unknowns.map((issue) => issue.label)).toEqual(['Slope unknown', 'Width unknown']);
    expect(result.coverage).toMatchObject({ documentedEdges: 1, totalEdges: 2, percent: 50 });
    expect(edgeIsDocumented(graph.edges[0], graph)).toBe(false);
  });
  it('does not mutate the frozen defaults when preferences change', () => {
    route(fixture(), 'a', 'c', 'shortest', { maxSlopePercent: 1, avoidStairs: true });
    expect(DEFAULT_FILTERS.maxSlopePercent).toBe(8);
    expect(DEFAULT_FILTERS.avoidStairs).toBe(false);
  });
});

describe('graph validation and distance math', () => {
  it.each([NaN, Infinity, -1])('rejects invalid edge weights: %s', (lengthMeters) => {
    const result = route(changeEdge(fixture(), 'ab', { lengthMeters }), 'a', 'c', 'shortest');
    expect(result).toMatchObject({ status: 'invalid', error: { code: 'INVALID_WEIGHT' }, distanceMeters: 0 });
    expect(Number.isNaN(result.distanceMeters)).toBe(false);
  });
  it('rejects missing node references', () => {
    expect(route(changeEdge(fixture(), 'ab', { fromNodeId: 'absent' }), 'a', 'c', 'shortest').error?.code).toBe('MISSING_ENDPOINT');
  });
  it('rejects duplicate node and edge IDs', () => {
    const graph = fixture();
    graph.nodes.push({ ...graph.nodes[0] });
    graph.edges.push({ ...graph.edges[0] });
    expect(validateGraph(graph).errors.map((error) => error.code)).toEqual(['DUPLICATE_NODE', 'DUPLICATE_EDGE']);
  });
  it('rejects invalid coordinates and malformed polylines', () => {
    const graph = fixture();
    graph.nodes[0].latitude = Infinity;
    graph.edges[0].geometry = [[0, NaN], [0, 1]];
    expect(validateGraph(graph).errors.map((error) => error.code)).toEqual(['INVALID_COORDINATE', 'INVALID_GEOMETRY']);
  });
  it('rejects invalid widths, slopes and filter values', () => {
    expect(validateGraph(changeEdge(fixture(), 'ab', { widthCentimeters: 0, slopePercent: -2 })).errors.map((error) => error.code)).toEqual(['INVALID_SLOPE', 'INVALID_WIDTH']);
    expect(route(fixture(), 'a', 'c', 'shortest', { maxSlopePercent: NaN }).error?.code).toBe('INVALID_FILTER');
  });
  it('calculates a known equatorial great-circle distance with a documented Earth radius', () => {
    expect(haversineDistance([0, 0], [0, 1])).toBeCloseTo(111_195.0802335329, 5);
    expect(haversineDistance([0, 0], [0, 0])).toBe(0);
    expect(haversineDistance([91, 0], [0, 0])).toBeNull();
  });
  it('sums polyline segments and returns unavailable for missing geometry', () => {
    expect(polylineDistance([[0, 0], [0, 1], [0, 2]])).toBeCloseTo(222_390.1604670658, 5);
    expect(polylineDistance([])).toBeNull();
    expect(polylineDistance([[0, 0]])).toBeNull();
  });
  it('pops a binary min-heap in order, including ties and repeated values', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    for (const value of [9, 0, 6, 1, 3, 3, 2, 8, -1]) heap.push(value);
    const result: number[] = [];
    while (heap.size) result.push(heap.pop()!);
    expect(result).toEqual([-1, 0, 1, 2, 3, 3, 6, 8, 9]);
    expect(heap.pop()).toBeUndefined();
  });
});

describe('all-pairs confirmed-route safety invariant', () => {
  it('matches an independent Floyd-Warshall shortest-distance oracle for every demo endpoint pair', () => {
    const graph = applyScenario(DEMO_GRAPH, 'closure');
    const indices = new Map(graph.nodes.map((node, index) => [node.id, index]));
    const distances = graph.nodes.map((_, from) => graph.nodes.map((__, to) => from === to ? 0 : Infinity));
    for (const edge of graph.edges) {
      if (edge.operationalStatus === 'blocked') continue;
      const from = indices.get(edge.fromNodeId)!; const to = indices.get(edge.toNodeId)!;
      distances[from][to] = Math.min(distances[from][to], edge.lengthMeters);
      if (edge.isBidirectional) distances[to][from] = Math.min(distances[to][from], edge.lengthMeters);
    }
    for (let middle = 0; middle < graph.nodes.length; middle += 1) {
      for (let from = 0; from < graph.nodes.length; from += 1) {
        for (let to = 0; to < graph.nodes.length; to += 1) {
          distances[from][to] = Math.min(distances[from][to], distances[from][middle] + distances[middle][to]);
        }
      }
    }
    for (let from = 0; from < graph.nodes.length; from += 1) {
      for (let to = 0; to < graph.nodes.length; to += 1) {
        const actual = route(graph, graph.nodes[from].id, graph.nodes[to].id, 'shortest');
        expect(actual.status).toBe('found');
        expect(actual.distanceMeters).toBeCloseTo(distances[from][to], 8);
      }
    }
  });
  it('never returns stairs, closures or undocumented geometry for any simulated endpoint pair or scenario', () => {
    for (const scenario of ['baseline', 'closure', 'uncertain', 'disconnected'] as const) {
      const graph = applyScenario(DEMO_GRAPH, scenario);
      const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
      for (const from of graph.nodes) for (const to of graph.nodes) {
        const result = route(graph, from.id, to.id, 'confirmed', { avoidStairs: false, excludeBlocked: false, requireDocumented: false });
        expect(Number.isFinite(result.distanceMeters)).toBe(true);
        if (result.status !== 'found') continue;
        expect(result.nodeIds[0]).toBe(from.id);
        expect(result.nodeIds.at(-1)).toBe(to.id);
        expect(result.nodeIds.length).toBe(result.edgeIds.length + 1);
        expect(result.unknowns).toHaveLength(0);
        let distance = 0;
        result.edgeIds.forEach((id, index) => {
          const edge = edgeById.get(id)!;
          expect(edge.hasStairs).toBe(false);
          expect(edge.operationalStatus).toBe('open');
          expect(edge.stepFreeStatus).toBe('confirmed');
          expect(edgeIsDocumented(edge, graph)).toBe(true);
          const a = result.nodeIds[index]; const b = result.nodeIds[index + 1];
          expect((edge.fromNodeId === a && edge.toNodeId === b) || (edge.isBidirectional && edge.fromNodeId === b && edge.toNodeId === a)).toBe(true);
          distance += edge.lengthMeters;
        });
        expect(result.distanceMeters).toBeCloseTo(distance, 8);
      }
    }
  });
});
