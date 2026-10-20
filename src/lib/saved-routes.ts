import { z } from 'zod';
import { accessPreferenceSchema, accessSummarySchema } from './access-preferences';

export const SAVED_ROUTES_KEY = 'accesspath.saved-routes.v1';
export const SAVED_ROUTES_EVENT = 'accesspath:saved-routes';
const point = z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180) });
const tuple = z.tuple([point.shape.lat, point.shape.lon]);
const positive = z.number().finite().nonnegative();
const place = point.extend({ id: z.string().max(200), label: z.string().min(1).max(700), source: z.enum(['photon', 'map', 'coordinates']) });
const walkingRoute = z.object({
  id: z.string().max(200), distanceMeters: positive.max(1_000_000), durationSeconds: positive.max(604_800),
  coordinates: z.array(tuple).min(2).max(20_000),
  steps: z.array(z.object({ instruction: z.string().max(1000), distanceMeters: positive, location: tuple })).max(500),
  snappedStart: point, snappedEnd: point, startSnapDistanceMeters: positive, endSnapDistanceMeters: positive,
  warnings: z.array(z.string().max(1000)).max(20),
});
const filters = z.object({ avoidStairs: z.boolean(), requireDocumented: z.boolean(), avoidSteepSlopes: z.boolean(), maxSlopePercent: positive.max(100), avoidUneven: z.boolean(), excludeBlocked: z.boolean() });
export const savedJourneySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('street'), start: place, end: place, route: walkingRoute, fetchedAt: z.iso.datetime(), preference: z.enum(['suggested', 'shortest','accessibility']), accessPreferences:accessPreferenceSchema.optional(),access:accessSummarySchema.optional() }),
  z.object({ kind: z.literal('campus'), siteId: z.string().min(1).max(100), startId: z.string().min(1).max(100), endId: z.string().min(1).max(100), startLabel: z.string().min(1).max(200), endLabel: z.string().min(1).max(200), distanceMeters: positive, mode: z.enum(['shortest', 'confirmed', 'exploratory']), scenario: z.enum(['baseline', 'closure', 'uncertain', 'disconnected']), filters }),
]);
export type SavedJourney = z.infer<typeof savedJourneySchema>;
const savedRouteSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(100), tags: z.array(z.string().min(1).max(24)).max(8),
  favorite: z.boolean(), savedAt: z.iso.datetime(), journey: savedJourneySchema,
});
export type SavedRoute = z.infer<typeof savedRouteSchema>;
const collection = z.object({ version: z.literal(1), routes: z.array(savedRouteSchema).max(50) });
const MAX_BYTES = 3_000_000;
export function parseSavedRoutes(raw: string | null): { routes: SavedRoute[]; error: string } {
  if (!raw) return { routes: [], error: '' };
  try {
    if (raw.length > MAX_BYTES) throw new Error();
    const parsed = collection.parse(JSON.parse(raw));
    return { routes: parsed.routes, error: '' };
  } catch { return { routes: [], error: 'Saved routes could not be read. Existing browser data has been left untouched.' }; }
}
export function parseTags(value: string) {
  const tags = [...new Set(value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 8 || tags.some(tag => tag.length > 24)) throw new Error('Use up to 8 tags, each 24 characters or fewer.');
  return tags;
}
export function readSavedSnapshot() {
  try { return window.localStorage.getItem(SAVED_ROUTES_KEY); }
  catch { return '__storage_unavailable__'; }
}
export function writeSavedRoutes(update: (routes: SavedRoute[]) => SavedRoute[]) {
  const current = parseSavedRoutes(readSavedSnapshot());
  if (current.error) throw new Error(current.error);
  const routes = update(current.routes);
  if (routes.length > 50) throw new Error('Your library holds up to 50 routes. Remove a route before saving another.');
  const value = JSON.stringify(collection.parse({ version: 1, routes }));
  if (value.length > MAX_BYTES) throw new Error('This route is too large for the remaining library space. Remove an older route and try again.');
  try { window.localStorage.setItem(SAVED_ROUTES_KEY, value); }
  catch { throw new Error('Your browser could not save this route. Storage may be full or blocked.'); }
  window.dispatchEvent(new Event(SAVED_ROUTES_EVENT));
}
export function shortestRouteIndex(routes: { distanceMeters: number }[]) {
  return routes.reduce((best, route, index) => route.distanceMeters < routes[best].distanceMeters ? index : best, 0);
}
