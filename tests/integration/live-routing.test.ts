import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST as search } from '@/app/api/live/search/route';
import { POST as route } from '@/app/api/live/route/route';
import { clearLiveCaches } from '@/lib/live-routing/service';
import { acquireProviderSlot } from '@/lib/live-routing/provider-gate';
import { readyDatabase } from '@/lib/database/repository';
import { closeDatabases } from '@/lib/database/client';

const original = { database: process.env.DATABASE_URL, vercel: process.env.VERCEL, photon: process.env.PHOTON_API_URL, foot: process.env.FOOT_ROUTER_URL };
let directory = '';
const request = (path: string, body: unknown, origin = 'http://localhost:3050') => new Request(`http://localhost:3050${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
const places = { type: 'FeatureCollection', features: [{ geometry: { type: 'Point', coordinates: [13.3888, 52.517] }, properties: { osm_id: 123, osm_type: 'N', name: 'Integration fixture library', city: 'Fixture city' } }] };
const walking = { code: 'Ok', waypoints: [{ location: [13.3888, 52.517], distance: 2 }, { location: [13.3976, 52.5294], distance: 3 }], routes: [{ distance: 1500, duration: 1200, geometry: { type: 'LineString', coordinates: [[13.3888, 52.517], [13.392, 52.52], [13.3976, 52.5294]] }, legs: [{ steps: [{ distance: 1500, name: 'Fixture street', mode: 'walking', maneuver: { type: 'depart', location: [13.3888, 52.517] } }, { distance: 0, name: '', mode: 'walking', maneuver: { type: 'arrive', location: [13.3976, 52.5294] } }] }] }] };
const endpoints = { start: { lat: 52.517, lon: 13.3888 }, end: { lat: 52.5294, lon: 13.3976 } };

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'accesspath-live-'));
  process.env.DATABASE_URL = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
  delete process.env.VERCEL; delete process.env.PHOTON_API_URL; delete process.env.FOOT_ROUTER_URL;
  await readyDatabase();
});
beforeEach(async () => {
  clearLiveCaches();
  const { client } = await readyDatabase(); await client.execute("DELETE FROM rate_limits WHERE bucket LIKE 'live-provider:%'");
  // Every integration request uses fixture fetches. No public geocoder/router is called.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(places))));
});
afterEach(() => { vi.unstubAllGlobals(); });
afterAll(async () => {
  await closeDatabases();
  for (const [key, value] of Object.entries({ DATABASE_URL: original.database, VERCEL: original.vercel, PHOTON_API_URL: original.photon, FOOT_ROUTER_URL: original.foot })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  try { await rm(directory, { recursive: true, force: true }); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EBUSY')) throw error; }
});

describe('Live map API boundaries', () => {
  it('returns parsed place results and caches explicit repeated searches', async () => {
    const response = await search(request('/api/live/search', { query: 'Fixture library' }));
    expect(response.status).toBe(200); expect((await response.json()).places[0].label).toContain('Integration fixture library');
    expect((await search(request('/api/live/search', { query: 'fixture library' }))).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0])); expect(url.hostname).toBe('photon.komoot.io'); expect(url.searchParams.get('limit')).toBe('5');
  });
  it('rejects malformed client data and cross-origin requests before contacting providers', async () => {
    expect((await search(request('/api/live/search', { query: 'x' }))).status).toBe(400);
    expect((await search(request('/api/live/search', { query: 'library', url: 'http://127.0.0.1/private' }))).status).toBe(400);
    expect((await search(request('/api/live/search', { query: 'library' }, 'https://attacker.example'))).status).toBe(403);
    expect((await route(request('/api/live/route', { ...endpoints, start: { lat: NaN, lon: 0 } }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the foot routing dataset and returns source distances, instructions, and snapping', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(walking))));
    const response = await route(request('/api/live/route', endpoints));
    expect(response.status).toBe(200);
    const result = await response.json(); expect(result.profile).toBe('walking'); expect(result.routes[0].distanceMeters).toBe(1500); expect(result.routes[0].coordinates[0]).toEqual([52.517, 13.3888]);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0])); expect(url.pathname).toContain('/routed-foot/route/v1/foot/13.3888,52.517;13.3976,52.5294'); expect(url.searchParams.get('steps')).toBe('true'); expect(url.searchParams.get('geometries')).toBe('geojson');
    expect((await route(request('/api/live/route', endpoints))).status).toBe(200); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('returns 422 when the provider finds no path instead of drawing a straight line', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'NoRoute' }), { status: 400 })));
    const response = await route(request('/api/live/route', endpoints)); expect(response.status).toBe(422); expect((await response.json()).error.code).toBe('NO_WALKING_ROUTE');
  });
  it('bounds demo route range without querying the provider', async () => {
    const response = await route(request('/api/live/route', { start: { lat: 0, lon: 0 }, end: { lat: 1, lon: 1 } })); expect(response.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it('returns a truthful error for malformed successful provider responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'Ok', routes: [] }))));
    const response = await route(request('/api/live/route', endpoints)); expect(response.status).toBe(502); expect((await response.json()).error.code).toBe('LIVE_MALFORMED_RESPONSE');
  });
  it('permits only one concurrent uncached call per provider across database users', async () => {
    const results = await Promise.allSettled([acquireProviderSlot('photon'), acquireProviderSlot('photon')]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')[0]).toMatchObject({ reason: { status: 429, code: 'LIVE_PROVIDER_BUSY' } });
    await expect(acquireProviderSlot('foot-router')).resolves.toBeUndefined();
    const { client } = await readyDatabase();
    const row = (await client.execute("SELECT hits,expires_at,bucket FROM rate_limits WHERE bucket='live-provider:photon'")).rows[0];
    expect(row.hits).toBe(1); expect(Number(row.expires_at)).toBeGreaterThan(Date.now());
    await client.execute("UPDATE rate_limits SET expires_at=0 WHERE bucket='live-provider:photon'");
    await expect(acquireProviderSlot('photon')).resolves.toBeUndefined();
    const rows = (await client.execute("SELECT bucket FROM rate_limits WHERE bucket LIKE 'live-provider:%'")).rows; expect(rows).toHaveLength(2);
  });
  it('rejects a second uncached search promptly and sends no second provider request', async () => {
    expect((await search(request('/api/live/search', { query: 'First fixture library' }))).status).toBe(200);
    expect((await search(request('/api/live/search', { query: 'Second fixture library' }))).status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('fails closed when a serverless deployment has no durable shared rate gate', async () => {
    process.env.VERCEL = '1';
    try {
      const response = await search(request('/api/live/search', { query: 'A fixture library' })); expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('LIVE_RATE_GATE_UNAVAILABLE'); expect(fetch).not.toHaveBeenCalled();
    } finally { delete process.env.VERCEL; }
  });
  it('leaves existing graph records and reports unchanged during live searches and routes', async () => {
    const { client } = await readyDatabase();
    const site = (await client.execute('SELECT id FROM sites WHERE is_demo=1 LIMIT 1')).rows[0];
    const edge = (await client.execute({ sql: 'SELECT id FROM edges WHERE site_id=? LIMIT 1', args: [site.id] })).rows[0];
    await client.execute({ sql: 'INSERT INTO reports(id,site_id,edge_id,category,description,reported_at,review_status,moderator_notes,duplicate_key) VALUES(?,?,?,?,?,?,?,?,?)', args: ['preservation-fixture', site.id, edge.id, 'other', 'Existing test report', '2026-10-17T00:00:00Z', 'approved', 'Retain this test note.', 'live-preservation-fixture'] });
    const snapshot = async () => ({ nodes: (await client.execute('SELECT * FROM nodes ORDER BY site_id,id')).rows, edges: (await client.execute('SELECT * FROM edges ORDER BY site_id,id')).rows, reports: (await client.execute('SELECT * FROM reports ORDER BY id')).rows });
    const before = await snapshot();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: URL | string) => Promise.resolve(new Response(JSON.stringify(String(input).includes('photon') ? places : walking)))));
    expect((await search(request('/api/live/search', { query: 'Preservation fixture library' }))).status).toBe(200);
    expect((await route(request('/api/live/route', endpoints))).status).toBe(200);
    expect(await snapshot()).toEqual(before);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
