import { loadGraph } from '@/lib/database/repository';
import { StorageUnavailableError } from '@/lib/database/client';
import { boundedJson, errorResponse, HttpError, json } from '@/lib/security/http';
import { routeInput } from '@/lib/validation/requests';
import { route } from '@/lib/routing';
import { DEMO_GRAPH, SITES, applyScenario } from '@/data/demo-campus';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const input = routeInput.safeParse(await boundedJson(request));
    if (!input.success) throw new HttpError(400, 'INVALID_ROUTE', 'Choose valid route endpoints, mode, and filters.');
    const { siteId, startId, endId, mode, scenarioId, filters } = input.data;
    let graph;
    let storageUnavailable = false;
    try { graph = await loadGraph(siteId); }
    catch (error) {
      if (!(error instanceof StorageUnavailableError)) throw error;
      storageUnavailable = true;
      const site = SITES.find((candidate) => candidate.id === siteId);
      graph = siteId === DEMO_GRAPH.site.id ? DEMO_GRAPH : site ? { site, nodes: [], edges: [] } : null;
    }
    if (!graph) throw new HttpError(404, 'SITE_NOT_FOUND', 'This site could not be found.');
    if (!graph.site.isDemo && scenarioId !== 'baseline') throw new HttpError(400, 'DEMO_SCENARIO_ONLY', 'Demonstration scenarios can only be used on the synthetic campus.');
    const result = route(applyScenario(graph, scenarioId), startId, endId, mode, filters);
    return json({ route: result, storageUnavailable });
  } catch (error) { return errorResponse(error); }
}
