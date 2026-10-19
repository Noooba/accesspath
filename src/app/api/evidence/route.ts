import { databaseCounts } from '@/lib/database/repository';
import { getStorageStatus, StorageUnavailableError } from '@/lib/database/client';
import { adminConfigured } from '@/lib/security/admin';
import { errorResponse, json } from '@/lib/security/http';
import { DEMO_GRAPH } from '@/data/demo-campus';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const counts = await databaseCounts();
    return json({ sites: counts.sites, nodes: counts.nodes, edges: counts.edges, reports: { pending: counts.pending, approved: counts.approved, rejected: counts.rejected }, storage: getStorageStatus(), adminConfigured: adminConfigured() });
  } catch (error) {
    if (error instanceof StorageUnavailableError) return json({ nodes: DEMO_GRAPH.nodes.length, edges: DEMO_GRAPH.edges.length, reports: { pending: 0, approved: 0, rejected: 0 }, reportsUnavailable: true, storage: { ...getStorageStatus(), reason: error.message }, adminConfigured: adminConfigured() });
    return errorResponse(error);
  }
}
