import { loadGraph } from '@/lib/database/repository';
import { StorageUnavailableError } from '@/lib/database/client';
import { errorResponse, HttpError, json } from '@/lib/security/http';
import { DEMO_GRAPH, SITES } from '@/data/demo-campus';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params;
    let graph;
    try { graph = await loadGraph(siteId); }
    catch (error) {
      if (!(error instanceof StorageUnavailableError)) throw error;
      const site = SITES.find((candidate) => candidate.id === siteId);
      graph = siteId === DEMO_GRAPH.site.id ? DEMO_GRAPH : site ? { site, nodes: [], edges: [] } : null;
      if (graph) { const response = json(graph); response.headers.set('X-AccessPath-Storage', 'unavailable'); return response; }
    }
    if (!graph) throw new HttpError(404, 'SITE_NOT_FOUND', 'This site could not be found.');
    return json(graph);
  } catch (error) { return errorResponse(error); }
}
