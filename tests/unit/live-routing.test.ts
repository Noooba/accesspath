import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoundedTtlCache } from '@/lib/live-routing/cache';
import { parsePlaceResponse, parseWalkingResponse, earthDistance } from '@/lib/live-routing/parsers';
import { providerBase, providerJson } from '@/lib/live-routing/transport';
import { liveRouteInput, placeSearchInput } from '@/lib/live-routing/validation';

const fixture = () => ({ code: 'Ok', waypoints: [{ location: [13.3888, 52.517], distance: 2 }, { location: [13.3976, 52.5294], distance: 3 }], routes: [{ distance: 1500, duration: 1200, geometry: { type: 'LineString', coordinates: [[13.3888, 52.517], [13.392, 52.52], [13.3976, 52.5294]] }, legs: [{ steps: [{ distance: 1500, name: 'Fixture street', mode: 'walking', maneuver: { type: 'depart', location: [13.3888, 52.517] } }, { distance: 0, name: '', mode: 'walking', maneuver: { type: 'arrive', location: [13.3976, 52.5294] } }] }] }] });
const photon = () => ({ type: 'FeatureCollection', features: [{ geometry: { type: 'Point', coordinates: [13.3888, 52.517] }, properties: { osm_id: 123, osm_type: 'N', name: 'Fixture library', city: 'Fixture city', country: 'Fixture country' } }] });
const originalPhoton = process.env.PHOTON_API_URL;
const originalFoot = process.env.FOOT_ROUTER_URL;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalPhoton === undefined) delete process.env.PHOTON_API_URL; else process.env.PHOTON_API_URL = originalPhoton;
  if (originalFoot === undefined) delete process.env.FOOT_ROUTER_URL; else process.env.FOOT_ROUTER_URL = originalFoot;
});

describe('Live route data parsing', () => {
  it('converts provider GeoJSON coordinates to Leaflet lat/lon without inventing geometry', () => {
    const raw = fixture();
    const result = parseWalkingResponse(raw, '2026-10-17T00:00:00Z');
    expect(result.routes[0].coordinates).toEqual([[52.517, 13.3888], [52.52, 13.392], [52.5294, 13.3976]]);
    expect(result.routes[0].steps[0].location).toEqual([52.517, 13.3888]);
    expect(result.routes[0].distanceMeters).toBe(raw.routes[0].distance);
    expect(result.routes[0].durationSeconds).toBe(raw.routes[0].duration);
    expect(result.routes[0].snappedStart).toEqual({ lat: 52.517, lon: 13.3888 });
    expect(result.routes[0].startSnapDistanceMeters).toBe(2);
    expect(result.profile).toBe('walking');
    expect(result.fetchedAt).toBe('2026-10-17T00:00:00Z');
    expect(result.routes[0].warnings.join(' ')).toContain('have not been verified');
    expect(result.routes[0]).not.toHaveProperty('verified');
  });
  it('preserves a real absence of alternatives and reports no-route explicitly', () => {
    expect(parseWalkingResponse(fixture()).routes).toHaveLength(1);
    expect(() => parseWalkingResponse({ code: 'NoRoute' })).toThrow('No walking route');
    expect(() => parseWalkingResponse({ code: 'NoSegment' })).toThrow('No walking route');
  });
  it('rejects incomplete, nonfinite, invalid-coordinate and overlarge route geometry', () => {
    expect(() => parseWalkingResponse({ code: 'Ok', routes: [] })).toThrow('invalid map data');
    const nonfinite = fixture(); nonfinite.routes[0].distance = Infinity;
    expect(() => parseWalkingResponse(nonfinite)).toThrow();
    const bounds = fixture(); bounds.routes[0].geometry.coordinates[1] = [181, 52];
    expect(() => parseWalkingResponse(bounds)).toThrow();
    const huge = fixture(); huge.routes[0].geometry.coordinates = Array.from({ length: 20001 }, () => [13, 52]);
    expect(() => parseWalkingResponse(huge)).toThrow();
  });
  it('rejects geometry that does not join the provider snapped endpoints', () => {
    const raw = fixture(); raw.routes[0].geometry.coordinates[0] = [13, 52];
    expect(() => parseWalkingResponse(raw)).toThrow('invalid map data');
  });
  it('discloses a large endpoint snap without drawing a fictional connector', () => {
    const raw = fixture(); raw.waypoints[0].distance = 80;
    const result = parseWalkingResponse(raw);
    expect(result.routes[0].warnings.join(' ')).toContain('more than 25 m');
    expect(result.routes[0].coordinates).toHaveLength(3);
  });
  it('rejects an explicitly reported car or bicycle profile', () => {
    for (const mode of ['driving', 'cycling']) {
      const raw = fixture(); raw.routes[0].legs[0].steps[0].mode = mode;
      expect(() => parseWalkingResponse(raw)).toThrow('vehicle route');
    }
  });
  it('builds instructions only from supplied maneuver fields', () => {
    const raw = fixture(); raw.routes[0].legs[0].steps[0].maneuver = { type: 'turn', location: [13.3888, 52.517], ...{ modifier: 'left' } };
    expect(parseWalkingResponse(raw).routes[0].steps[0].instruction).toBe('Turn left onto Fixture street');
  });
  it('maps geocoder coordinates/labels and allows a genuine empty result', () => {
    const result = parsePlaceResponse(photon());
    expect(result.places[0]).toEqual({ id: 'photon-N-123', label: 'Fixture library, Fixture city, Fixture country', lat: 52.517, lon: 13.3888, source: 'photon' });
    expect(parsePlaceResponse({ type: 'FeatureCollection', features: [] }).places).toEqual([]);
    expect(() => parsePlaceResponse({ type: 'FeatureCollection', features: [{ geometry: { coordinates: [400, 52] } }] })).toThrow();
  });
  it('caps geocoding results at five and rejects malformed feature collections', () => {
    const raw = photon(); raw.features = Array.from({ length: 6 }, () => raw.features[0]);
    expect(parsePlaceResponse(raw).places).toHaveLength(5);
    raw.features = Array.from({ length: 51 }, () => raw.features[0]);
    expect(() => parsePlaceResponse(raw)).toThrow();
  });
  it('validates input bounds without accepting client-supplied provider URLs', () => {
    expect(placeSearchInput.safeParse({ query: 'Library', url: 'https://attacker.example' }).success).toBe(false);
    expect(placeSearchInput.safeParse({ query: 'a' }).success).toBe(false);
    expect(liveRouteInput.safeParse({ start: { lat: 91, lon: 0 }, end: { lat: 1, lon: 1 } }).success).toBe(false);
    expect(liveRouteInput.safeParse({ start: { lat: 1, lon: 1 }, end: { lat: 1, lon: 1 } }).success).toBe(false);
    expect(earthDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111195.08, 0);
  });
});

describe('Bounded provider transport and cache', () => {
  it('uses only HTTPS operator configuration and a foot-profile endpoint', () => {
    delete process.env.PHOTON_API_URL; delete process.env.FOOT_ROUTER_URL;
    expect(providerBase('foot-router').href).toBe('https://routing.openstreetmap.de/routed-foot/route/v1/foot/');
    process.env.FOOT_ROUTER_URL = 'https://example.com/route/v1/driving/';
    expect(() => providerBase('foot-router')).toThrow('foot profile');
    for (const bad of ['http://example.com/api/', 'https://127.0.0.1/api/', 'https://user:pass@example.com/api/', 'https://example.com/api/?url=evil']) {
      process.env.PHOTON_API_URL = bad;
      expect(() => providerBase('photon')).toThrow();
    }
  });
  it('identifies the application and refuses redirects', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', upstream);
    await expect(providerJson(new URL('https://example.com/api/'))).resolves.toEqual({ ok: true });
    expect(upstream.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store', headers: { 'User-Agent': expect.stringContaining('AccessPath') } });
  });
  it('bounds an upstream body even when Content-Length is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(100))));
    await expect(providerJson(new URL('https://example.com'), { maxBytes: 20 })).rejects.toMatchObject({ status: 502, code: 'LIVE_RESPONSE_TOO_LARGE' });
  });
  it('handles provider throttling, invalid JSON and network failure honestly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(providerJson(new URL('https://example.com'))).rejects.toMatchObject({ status: 429 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not json</html>')));
    await expect(providerJson(new URL('https://example.com'))).rejects.toMatchObject({ code: 'LIVE_MALFORMED_RESPONSE' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    await expect(providerJson(new URL('https://example.com'))).rejects.toMatchObject({ code: 'LIVE_PROVIDER_UNAVAILABLE' });
  });
  it('aborts a slow provider request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => { options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); })));
    await expect(providerJson(new URL('https://example.com'), { timeoutMs: 5 })).rejects.toMatchObject({ status: 504, code: 'LIVE_PROVIDER_TIMEOUT' });
  });
  it('expires and evicts cache entries and protects cached objects from mutation', () => {
    const cache = new BoundedTtlCache<{ n: number }>(2, 100, 50);
    cache.set('one', { n: 1 }, 0); cache.set('two', { n: 2 }, 1);
    cache.get('one', 2)!.n = 99; expect(cache.get('one', 2)).toEqual({ n: 1 });
    cache.set('three', { n: 3 }, 3); expect(cache.get('one', 4)).toBeUndefined();
    expect(cache.get('three', 53)).toBeUndefined();
    cache.clear(); expect(cache.get('two', 4)).toBeUndefined();
  });
});
