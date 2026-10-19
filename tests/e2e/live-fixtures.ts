import type { Page } from '@playwright/test';
import type { LatLon, LiveRouteResponse, PlaceSearchResponse, RealPlace } from '../../src/types/live-routing';

export const START_FIXTURE: RealPlace = { id: 'e2e-start', label: 'E2E fixture start — not a surveyed place', lat: 33.81, lon: -118.354, source: 'photon' };
export const END_FIXTURE: RealPlace = { id: 'e2e-end', label: 'E2E fixture destination — not a surveyed place', lat: 33.813, lon: -118.35, source: 'photon' };
export const FIXTURE_WARNING = 'Automated E2E fixture only. This is not a real-world walking-route verification.';

export function walkingFixture(start: LatLon = START_FIXTURE, end: LatLon = END_FIXTURE): LiveRouteResponse {
  return {
    provider: 'FOSSGIS OSRM', profile: 'walking', dataSource: 'OpenStreetMap', fetchedAt: '2026-10-17T00:00:00.000Z',
    routes: [{ id: 'e2e-fixture-route', distanceMeters: 704.2, durationSeconds: 600,
      coordinates: [[start.lat, start.lon], [start.lat + (end.lat - start.lat) / 3, start.lon], [start.lat + (end.lat - start.lat) / 3, end.lon], [end.lat, end.lon]],
      steps: [
        { instruction: 'E2E fixture: continue along the recorded walking segment.', distanceMeters: 482, location: [start.lat, start.lon] },
        { instruction: 'E2E fixture: turn toward the selected destination.', distanceMeters: 222.2, location: [start.lat + (end.lat - start.lat) / 3, end.lon] },
      ], snappedStart: { lat: start.lat, lon: start.lon }, snappedEnd: { lat: end.lat, lon: end.lon },
      startSnapDistanceMeters: 0, endSnapDistanceMeters: 0, warnings: [FIXTURE_WARNING] }],
  };
}

export type LiveFixtureState = {
  searchQueries: string[];
  routeRequests: { start: LatLon; end: LatLon }[];
  blockedExternalRequests: string[];
  searchFailure: boolean;
  routeFailure: boolean;
  noRoute: boolean;
  emptySearch: boolean;
  tilesUnavailable: boolean;
  alternatives: boolean;
  snapGap: boolean;
};

/** Every provider request is intercepted; automated browser tests never contact public services. */
export async function installLiveFixtures(page: Page, baseURL: string, options: Partial<LiveFixtureState> = {}): Promise<LiveFixtureState> {
  const state: LiveFixtureState = { searchQueries: [], routeRequests: [], blockedExternalRequests: [], searchFailure: false,
    routeFailure: false, noRoute: false, emptySearch: false, tilesUnavailable: false, alternatives: false, snapGap: false, ...options };
  const applicationOrigin = new URL(baseURL).origin;
  await page.route('**/*', async (request) => {
    const url = new URL(request.request().url());
    if (url.origin === applicationOrigin || ['data:', 'blob:', 'about:'].includes(url.protocol)) return request.continue();
    if (url.hostname === 'tile.openstreetmap.org' || url.hostname.endsWith('.tile.openstreetmap.org')) {
      return request.fulfill(state.tilesUnavailable ? { status: 503, body: 'E2E tile failure fixture' } : {
        status: 200, contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf3ef"/><path d="M0 128H256M128 0V256" stroke="#e1e9e3"/></svg>',
      });
    }
    state.blockedExternalRequests.push(`${url.origin}${url.pathname}`);
    await request.abort('blockedbyclient');
  });
  await page.route('**/api/live/search', async (request) => {
    const data = request.request().postDataJSON() as { query?: string };
    const query = data.query ?? '';
    state.searchQueries.push(query);
    if (state.searchFailure) return request.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'E2E fixture: place search is temporarily unavailable.' } }) });
    const body: PlaceSearchResponse = { provider: 'Photon', attribution: '© OpenStreetMap contributors',
      places: state.emptySearch ? [] : [query.toLowerCase().includes('destination') || query.toLowerCase().includes('end') ? END_FIXTURE : START_FIXTURE] };
    await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/live/route', async (request) => {
    const data = request.request().postDataJSON() as { start: LatLon; end: LatLon };
    state.routeRequests.push(data);
    if (state.routeFailure || state.noRoute) return request.fulfill({ status: state.noRoute ? 422 : 502, contentType: 'application/json',
      body: JSON.stringify({ error: { code: state.noRoute ? 'NO_ROUTE' : 'PROVIDER_UNAVAILABLE', message: state.noRoute ? 'E2E fixture: no walking connection was found.' : 'E2E fixture: walking service is temporarily unavailable.' } }) });
    const body = walkingFixture(data.start, data.end);
    if (state.snapGap) {
      body.routes[0].snappedStart = { lat: data.start.lat + 0.0004, lon: data.start.lon };
      body.routes[0].startSnapDistanceMeters = 45;
      body.routes[0].coordinates[0] = [body.routes[0].snappedStart.lat, body.routes[0].snappedStart.lon];
    }
    if (state.alternatives) {
      const alternative = structuredClone(body.routes[0]);
      alternative.id = 'e2e-alternative'; alternative.distanceMeters = 814.5; alternative.durationSeconds = 780;
      alternative.coordinates[1] = [data.start.lat + 0.0006, data.start.lon - 0.0003];
      alternative.steps[0].instruction = 'E2E fixture: take the alternative walking segment.';
      body.routes.push(alternative);
    }
    await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return state;
}
