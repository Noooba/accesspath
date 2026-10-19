import { createHash, randomUUID } from 'node:crypto';
import { and, eq, desc } from 'drizzle-orm';
import type { SiteGraph, Site, ObstacleReport, RouteNode, RouteEdge } from '@/types';
import { getDatabase, getStorageStatus, StorageUnavailableError, initializeDatabase, type Database } from './client';
import { sites, nodes, edges, reports } from './schema';

export async function seedDatabase(graphs: SiteGraph[], database?: Database) {
  const db = database ?? await getDatabase();
  for (const graph of graphs) {
    await db.orm.insert(sites).values(graph.site).onConflictDoNothing();
    for (const node of graph.nodes) await db.orm.insert(nodes).values(node).onConflictDoNothing();
    for (const edge of graph.edges) await db.orm.insert(edges).values(edge).onConflictDoNothing();
  }
}
const readiness = new Map<string, Promise<Database>>();
export async function readyDatabase() {
  if (!getStorageStatus().available) throw new StorageUnavailableError();
  const key = `${process.env.DATABASE_URL || 'local'}:${process.env.DATABASE_AUTH_TOKEN ?? ''}`;
  let ready = readiness.get(key);
  if (!ready) {
    ready = (async () => {
      const db = await initializeDatabase();
      const { DEMO_GRAPH, SITES } = await import('@/data/demo-campus');
      await seedDatabase([DEMO_GRAPH, ...SITES.filter((site) => site.id !== DEMO_GRAPH.site.id).map((site) => ({ site, nodes: [], edges: [] }))], db);
      return db;
    })();
    readiness.set(key, ready);
    ready.catch(() => readiness.delete(key));
  }
  return ready;
}
export async function listSites(): Promise<Site[]> {
  const { orm } = await readyDatabase();
  return await orm.select().from(sites) as Site[];
}
export async function loadGraph(siteId: string): Promise<SiteGraph | null> {
  const { orm } = await readyDatabase();
  const [site] = await orm.select().from(sites).where(eq(sites.id, siteId));
  if (!site) return null;
  const [graphNodes, graphEdges] = await Promise.all([orm.select().from(nodes).where(eq(nodes.siteId, siteId)), orm.select().from(edges).where(eq(edges.siteId, siteId))]);
  return { site: site as Site, nodes: graphNodes as RouteNode[], edges: graphEdges as RouteEdge[] };
}
export async function listReports(siteId?: string, includeNotes = false): Promise<ObstacleReport[]> {
  const { orm } = await readyDatabase();
  const query = orm.select().from(reports).orderBy(desc(reports.reportedAt)).limit(200);
  const rows = siteId ? await query.where(eq(reports.siteId, siteId)) : await query;
  return rows.map(({ duplicateKey, ...report }) => { void duplicateKey; return { ...report, moderatorNotes: includeNotes ? report.moderatorNotes : '' }; }) as ObstacleReport[];
}
export async function reportEdgeExists(siteId: string, edgeId: string) {
  const { orm } = await readyDatabase();
  return (await orm.select({ id: edges.id }).from(edges).where(and(eq(edges.siteId, siteId), eq(edges.id, edgeId))).limit(1)).length > 0;
}
export async function createReport(input: Pick<ObstacleReport, 'siteId' | 'edgeId' | 'category' | 'description'>) {
  const { orm } = await readyDatabase();
  const duplicateKey = createHash('sha256').update(JSON.stringify([input.siteId, input.edgeId, input.category, input.description.toLowerCase().replace(/\s+/g, ' ').trim()])).digest('hex');
  const existing = await orm.select({ id: reports.id }).from(reports).where(eq(reports.duplicateKey, duplicateKey)).limit(1);
  if (existing.length) return null;
  const report: ObstacleReport = { ...input, id: randomUUID(), reportedAt: new Date().toISOString(), reviewStatus: 'pending', reviewedAt: null, moderatorNotes: '' };
  try { await orm.insert(reports).values({ ...report, duplicateKey }); }
  catch (error) {
    // The unique index also closes the race between simultaneous duplicate submissions.
    const cause = error instanceof Error && 'cause' in error ? error.cause : null;
    if (`${String(error)} ${String(cause)}`.includes('reports.duplicate_key')) return null;
    throw error;
  }
  return report;
}
export async function moderateReport(id: string, input: { reviewStatus: 'approved' | 'rejected'; moderatorNotes: string; operationalStatus?: 'open' | 'blocked' | 'unknown' }) {
  const db = await readyDatabase();
  const [report] = await db.orm.select().from(reports).where(eq(reports.id, id));
  if (!report) return null;
  const reviewedAt = new Date().toISOString();
  const statements = [{ sql: 'UPDATE reports SET review_status=?,moderator_notes=?,reviewed_at=? WHERE id=?', args: [input.reviewStatus, input.moderatorNotes, reviewedAt, id] }];
  if (input.operationalStatus && input.reviewStatus === 'approved') {
    statements.push({ sql: 'UPDATE edges SET operational_status=?,updated_at=? WHERE site_id=? AND id=?', args: [input.operationalStatus, reviewedAt, report.siteId, report.edgeId] });
  }
  await db.client.batch(statements, 'write');
  const { duplicateKey, ...updated } = { ...report, reviewStatus: input.reviewStatus, moderatorNotes: input.moderatorNotes, reviewedAt };
  void duplicateKey;
  return updated as ObstacleReport;
}
export async function databaseCounts() {
  const { client } = await readyDatabase();
  const result = await client.execute("SELECT (SELECT COUNT(*) FROM sites) AS sites, (SELECT COUNT(*) FROM nodes) AS nodes, (SELECT COUNT(*) FROM edges) AS edges, (SELECT COUNT(*) FROM reports) AS reports, (SELECT COUNT(*) FROM reports WHERE review_status='pending') AS pending, (SELECT COUNT(*) FROM reports WHERE review_status='approved') AS approved, (SELECT COUNT(*) FROM reports WHERE review_status='rejected') AS rejected");
  return Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
}
