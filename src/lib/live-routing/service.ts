import type { LatLon, LiveRouteResponse, PlaceSearchResponse } from '@/types/live-routing';
import { HttpError } from '@/lib/security/http';
import { BoundedTtlCache } from './cache';
import { acquireProviderSlot } from './provider-gate';
import { earthDistance, parsePlaceResponse, parseWalkingResponse } from './parsers';
import { providerBase, providerJson } from './transport';

const searches = new BoundedTtlCache<PlaceSearchResponse>(100, 512 * 1024, 10 * 60_000);
const routes = new BoundedTtlCache<LiveRouteResponse>(12, 6 * 1024 * 1024, 5 * 60_000);
export async function searchPlaces(query: string): Promise<PlaceSearchResponse> {
  const url = providerBase('photon');
  const key = `${url.href}:${query.trim().toLowerCase()}`;
  const cached = searches.get(key);
  if (cached) return cached;
  await acquireProviderSlot('photon');
  url.searchParams.set('q', query.trim()); url.searchParams.set('limit', '5'); url.searchParams.set('lang', 'en');
  const response = parsePlaceResponse(await providerJson(url, { maxBytes: 256 * 1024 }));
  searches.set(key, response);
  return response;
}
export async function walkingRoutes(start: LatLon, end: LatLon): Promise<LiveRouteResponse> {
  if (earthDistance(start, end) > 50_000) throw new HttpError(400, 'WALKING_RANGE_LIMIT', 'For this low-volume walking demo, choose locations within 50 km of each other.');
  const url = providerBase('foot-router');
  const coordinates = `${start.lon},${start.lat};${end.lon},${end.lat}`;
  const key = `${url.href}:${coordinates}`;
  const cached = routes.get(key);
  if (cached) return cached;
  await acquireProviderSlot('foot-router');
  url.pathname += coordinates;
  url.searchParams.set('overview', 'full'); url.searchParams.set('geometries', 'geojson'); url.searchParams.set('steps', 'true'); url.searchParams.set('alternatives', 'true');
  const response = parseWalkingResponse(await providerJson(url, { allowClientError: true }));
  routes.set(key, response);
  return response;
}
export function clearLiveCaches() { searches.clear(); routes.clear(); }
