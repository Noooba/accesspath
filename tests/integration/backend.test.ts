import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/database/schema';
import { GET as getSites } from '@/app/api/sites/route';
import { GET as getGraph } from '@/app/api/sites/[siteId]/graph/route';
import { POST as postReport, GET as getReports } from '@/app/api/reports/route';
import { POST as login } from '@/app/api/admin/login/route';
import { POST as logout } from '@/app/api/admin/logout/route';
import { GET as adminReports } from '@/app/api/admin/reports/route';
import { PATCH as review } from '@/app/api/admin/reports/[id]/route';
import { POST as postRoute } from '@/app/api/route/route';
import { GET as evidence } from '@/app/api/evidence/route';
import { DEMO_GRAPH, SITES } from '@/data/demo-campus';
import { closeDatabases, getDatabase, getStorageStatus, initializeDatabase } from '@/lib/database/client';
import { listReports, loadGraph, readyDatabase, seedDatabase } from '@/lib/database/repository';
import { rateLimit } from '@/lib/security/rate-limit';

const original = { url: process.env.DATABASE_URL, admin: process.env.ADMIN_KEY, secret: process.env.SESSION_SECRET, vercel: process.env.VERCEL };
let directory = '';
let cookie = '';
let reportId = '';
const makeRequest = (path: string, body: unknown, options: { method?: string; cookie?: string; origin?: string; contentType?: string } = {}) => new Request(`http://localhost:3050${path}`, { method: options.method || 'POST', headers: { 'content-type': options.contentType || 'application/json', origin: options.origin || 'http://localhost:3050', ...(options.cookie ? { cookie: options.cookie } : {}) }, body: JSON.stringify(body) });
const validReport = { siteId: DEMO_GRAPH.site.id, edgeId: DEMO_GRAPH.edges[0].id, category: 'blocked-path', description: 'An example obstacle recorded for integration testing.' };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'accesspath-backend-'));
  process.env.DATABASE_URL = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
  process.env.ADMIN_KEY = randomBytes(32).toString('hex');
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  delete process.env.VERCEL;
  await readyDatabase();
});
afterAll(async () => {
  await closeDatabases();
  for (const [env, value] of Object.entries({ DATABASE_URL: original.url, ADMIN_KEY: original.admin, SESSION_SECRET: original.secret, VERCEL: original.vercel })) {
    if (value === undefined) delete process.env[env]; else process.env[env] = value;
  }
  try { await rm(directory, { recursive: true, force: true }); }
  catch (error) {
    // libsql 0.18's Windows native binding can retain its file handle until worker exit,
    // even after Client.close(). Only that cleanup limitation is deferred to OS temp cleanup.
    if (!(error instanceof Error && 'code' in error && error.code === 'EBUSY')) throw error;
    console.warn('Windows native SQLite handle cleanup deferred until this test worker exits.');
  }
});

describe('Persistent backend', () => {
  it('seeds the synthetic graph once and includes empty pilot sites', async () => {
    await seedDatabase([DEMO_GRAPH]);
    const response = await getSites();
    expect(response.status).toBe(200);
    expect((await response.json()).sites).toHaveLength(SITES.length);
    const graph = await getGraph(new Request('http://localhost'), { params: Promise.resolve({ siteId: DEMO_GRAPH.site.id }) });
    expect((await graph.json()).edges).toHaveLength(DEMO_GRAPH.edges.length);
  });
  it('rejects invalid or missing site graph', async () => {
    expect((await getGraph(new Request('http://localhost'), { params: Promise.resolve({ siteId: 'does-not-exist' }) })).status).toBe(404);
  });
  it('saves an unauthenticated report as pending despite forged moderation fields', async () => {
    const response = await postReport(makeRequest('/api/reports', { ...validReport, reviewStatus: 'approved', moderatorNotes: 'forged' }));
    expect(response.status).toBe(201);
    const { report } = await response.json(); reportId = report.id;
    expect(report.reviewStatus).toBe('pending'); expect(report.moderatorNotes).toBe(''); expect(report.reviewedAt).toBeNull();
  });
  it('stores the report in a durable file visible to another connection', async () => {
    const independent = createClient({ url: process.env.DATABASE_URL! });
    const rows = await independent.execute({ sql: 'SELECT id,review_status FROM reports WHERE id=?', args: [reportId] });
    expect(rows.rows[0].id).toBe(reportId); expect(rows.rows[0].review_status).toBe('pending'); independent.close();
  });
  it('rejects exact normalized duplicates even from a new request', async () => {
    expect((await postReport(makeRequest('/api/reports', { ...validReport, description: validReport.description.toUpperCase() }))).status).toBe(409);
  });
  it('rejects cross-site edges, HTML, invalid categories and overlong text', async () => {
    for (const change of [{ siteId: SITES.find((site) => !site.isDemo)!.id }, { description: '<img src=x onerror=alert(1)>' }, { category: 'verified' }, { description: 'x'.repeat(801) }, { website: 'https://bot.example' }]) {
      expect((await postReport(makeRequest('/api/reports', { ...validReport, ...change }))).status).toBe(400);
    }
  });
  it('bounds content type, request size, and cross-origin mutations', async () => {
    expect((await postReport(makeRequest('/api/reports', validReport, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect((await postReport(makeRequest('/api/reports', validReport, { contentType: 'text/plain' }))).status).toBe(415);
    expect((await postReport(makeRequest('/api/reports', { description: 'x'.repeat(17000) }))).status).toBe(413);
  });
  it('exposes public reports without internal duplicate fingerprints or moderator notes', async () => {
    const response = await getReports(new Request(`http://localhost/api/reports?siteId=${DEMO_GRAPH.site.id}`));
    const reports = (await response.json()).reports;
    expect(reports[0].id).toBe(reportId); expect(reports[0]).not.toHaveProperty('duplicateKey'); expect(reports[0].moderatorNotes).toBe('');
  });
  it('requires server authentication for both review listing and mutation', async () => {
    expect((await adminReports(new Request('http://localhost/api/admin/reports'))).status).toBe(401);
    expect((await review(makeRequest('/api/admin/reports/id', { reviewStatus: 'approved' }, { method: 'PATCH' }), params(reportId))).status).toBe(401);
    expect((await login(makeRequest('/api/admin/login', { key: 'wrong' }))).status).toBe(401);
    expect((await adminReports(new Request('http://localhost/api/admin/reports', { headers: { cookie: 'accesspath-admin=forged-role-moderator' } }))).status).toBe(401);
  });
  it('sets an HttpOnly strict cookie and uses it to authorize report review', async () => {
    const response = await login(makeRequest('/api/admin/login', { key: process.env.ADMIN_KEY }));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie')!; expect(setCookie).toContain('HttpOnly'); expect(setCookie.toLowerCase()).toContain('samesite=strict');
    cookie = setCookie.split(';')[0];
    expect((await adminReports(new Request('http://localhost/api/admin/reports', { headers: { cookie } }))).status).toBe(200);
  });
  it('approving alone does not verify or alter path accessibility', async () => {
    const before = await loadGraph(DEMO_GRAPH.site.id);
    const response = await review(makeRequest(`/api/admin/reports/${reportId}`, { reviewStatus: 'approved', moderatorNotes: 'Desk review only.' }, { method: 'PATCH', cookie }), params(reportId));
    expect(response.status).toBe(200);
    const after = await loadGraph(DEMO_GRAPH.site.id);
    expect(after?.edges).toEqual(before?.edges);
    expect((await listReports(undefined, true))[0].reviewStatus).toBe('approved');
  });
  it('an explicit path-status action changes only operational status and keeps provenance', async () => {
    const before = await loadGraph(DEMO_GRAPH.site.id);
    const response = await review(makeRequest(`/api/admin/reports/${reportId}`, { reviewStatus: 'approved', operationalStatus: 'blocked' }, { method: 'PATCH', cookie }), params(reportId));
    expect(response.status).toBe(200);
    const after = await loadGraph(DEMO_GRAPH.site.id);
    const edge = after!.edges.find((edge) => edge.id === validReport.edgeId)!;
    expect(edge.operationalStatus).toBe('blocked');
    expect(edge.verificationStatus).toBe(before!.edges.find((candidate) => candidate.id === edge.id)?.verificationStatus);
    expect(edge.stepFreeStatus).toBe(before!.edges.find((candidate) => candidate.id === edge.id)?.stepFreeStatus);
  });
  it('reports actual database counts and clears the login cookie on logout', async () => {
    const result = await (await evidence()).json(); expect(result.nodes).toBe(DEMO_GRAPH.nodes.length); expect(result.reports.approved).toBe(1); expect(result.storage.mode).toBe('local-sqlite');
    const response = await logout(makeRequest('/api/admin/logout', {})); expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('rejects cross-site nodes in SQL even when a node ID exists on another site', async () => {
    const db = await getDatabase();
    await expect(db.client.execute({ sql: 'INSERT INTO nodes(id,site_id,name,latitude,longitude,node_type,verification_status,source_description,created_at) VALUES(?,?,?,?,?,?,?,?,?)', args: ['bad', DEMO_GRAPH.site.id, 'Bad coordinates', 91, 0, 'regular', 'unverified', 'fixture', new Date().toISOString()] })).rejects.toThrow();
    await expect(db.client.execute({ sql: 'UPDATE edges SET length_meters=-1 WHERE site_id=? AND id=?', args: [DEMO_GRAPH.site.id, validReport.edgeId] })).rejects.toThrow();
    await expect(db.client.execute({ sql: 'UPDATE edges SET from_node_id=? WHERE site_id=? AND id=?', args: ['nonexistent', DEMO_GRAPH.site.id, validReport.edgeId] })).rejects.toThrow();
    const pilotId = SITES.find((site) => !site.isDemo)!.id;
    await db.client.execute({ sql: 'INSERT INTO nodes(id,site_id,name,latitude,longitude,node_type,verification_status,source_description,created_at) VALUES(?,?,?,?,?,?,?,?,?)', args: ['pilot-only-node', pilotId, 'Isolated schema-test node', 0, 0, 'regular', 'unverified', 'Test-only fixture', new Date().toISOString()] });
    await expect(db.client.execute({ sql: 'UPDATE edges SET from_node_id=? WHERE site_id=? AND id=?', args: ['pilot-only-node', DEMO_GRAPH.site.id, validReport.edgeId] })).rejects.toThrow();
    await db.client.execute({ sql: 'DELETE FROM nodes WHERE site_id=? AND id=?', args: [pilotId, 'pilot-only-node'] });
  });
  it('returns calculated routes and rejects invalid endpoints without fabricating a route', async () => {
    const response = await postRoute(makeRequest('/api/route', { siteId: DEMO_GRAPH.site.id, startId: 'main-gate', endId: 'library', mode: 'shortest' }));
    expect(response.status).toBe(200); expect((await response.json()).route.status).toBe('found');
    const invalid = await postRoute(makeRequest('/api/route', { siteId: DEMO_GRAPH.site.id, startId: 'nonsense', endId: 'library', mode: 'shortest' }));
    expect((await invalid.json()).route.status).toBe('invalid');
  });
  it('fails closed on serverless file storage and serves only labeled read-only demo data', async () => {
    process.env.VERCEL = '1';
    try {
      expect(getStorageStatus().available).toBe(false);
      expect((await postReport(makeRequest('/api/reports', { ...validReport, description: 'A different report with unavailable persistent storage.' }))).status).toBe(503);
      const response = await getSites(); expect((await response.json()).storage.mode).toBe('unavailable');
      const result = await (await evidence()).json(); expect(result.reportsUnavailable).toBe(true);
    } finally { delete process.env.VERCEL; }
  });
  it('disables admin login when server secrets are missing', async () => {
    const previous = process.env.ADMIN_KEY;
    delete process.env.ADMIN_KEY;
    try { expect((await login(makeRequest('/api/admin/login', { key: 'anything' }))).status).toBe(503); }
    finally { process.env.ADMIN_KEY = previous; }
  });
  it('enforces a persisted deployment-wide login quota', async () => {
    for (let attempt = 0; attempt < 8; attempt++) await rateLimit('login');
    await expect(rateLimit('login')).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    const db = await getDatabase();
    const result = await db.client.execute("SELECT hits FROM rate_limits WHERE bucket LIKE 'login:%'");
    expect(Number(result.rows[0].hits)).toBeGreaterThan(10);
  });
  it('persists a report with its optional description omitted', async () => {
    const response = await postReport(makeRequest('/api/reports', { siteId: validReport.siteId, edgeId: validReport.edgeId, category: 'other' }));
    expect(response.status).toBe(201);
    const { report } = await response.json();
    expect(report.description).toBe('');
    expect((await listReports(validReport.siteId)).find((item) => item.id === report.id)?.description).toBe('');
  });
  it('accepts an explicitly empty description while retaining moderation defaults', async () => {
    const response = await postReport(makeRequest('/api/reports', { ...validReport, category: 'damaged-surface', description: '   ', reviewStatus: 'approved' }));
    expect(response.status).toBe(201);
    const { report } = await response.json();
    expect(report.description).toBe(''); expect(report.reviewStatus).toBe('pending');
  });
  it('migrates existing reports to optional descriptions without losing prior rows', async () => {
    const client = createClient({ url: `file:${join(directory, 'legacy.db').replace(/\\/g, '/')}`, concurrency: 1 });
    const db = { client, orm: drizzle(client, { schema }), mode: 'local-sqlite' };
    try {
      await client.executeMultiple(await readFile(resolve(process.cwd(), 'drizzle/0000_initial.sql'), 'utf8'));
      await seedDatabase([DEMO_GRAPH], db);
      await client.execute({ sql: 'INSERT INTO reports(id,site_id,edge_id,category,description,reported_at,review_status,moderator_notes,duplicate_key) VALUES(?,?,?,?,?,?,?,?,?)', args: ['legacy-report', validReport.siteId, validReport.edgeId, 'other', 'An existing report must be retained.', '2026-10-16T00:00:00Z', 'approved', 'Existing note', 'legacy-hash'] });
      await initializeDatabase(db);
      const result = await client.execute("SELECT description,review_status,moderator_notes FROM reports WHERE id='legacy-report'");
      expect(result.rows[0]).toMatchObject({ description: 'An existing report must be retained.', review_status: 'approved', moderator_notes: 'Existing note' });
      await client.execute({ sql: 'INSERT INTO reports(id,site_id,edge_id,category,description,reported_at,duplicate_key) VALUES(?,?,?,?,?,?,?)', args: ['empty-description', validReport.siteId, validReport.edgeId, 'other', '', new Date().toISOString(), 'new-hash'] });
      await initializeDatabase(db);
      expect((await client.execute('SELECT COUNT(*) AS count FROM reports')).rows[0].count).toBe(2);
    } finally { client.close(); }
  });
});
