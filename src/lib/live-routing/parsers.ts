import { z } from 'zod';
import { HttpError } from '@/lib/security/http';
import type { LatLon, PlaceSearchResponse, LiveRouteResponse, RealWalkingRoute, WalkingStep } from '@/types/live-routing';
import { lonLatTuple } from './validation';

const malformed = () => new HttpError(502, 'LIVE_MALFORMED_RESPONSE', 'The map provider returned incomplete or invalid map data. No route was fabricated.');
const finiteNonnegative = z.number().finite().nonnegative();
const waypoint = z.object({ location: lonLatTuple, distance: finiteNonnegative.max(100_000) });
const step = z.object({ distance: finiteNonnegative.max(1_000_000), name: z.string().max(300).optional().default(''), mode: z.string().max(40).optional(), maneuver: z.object({ type: z.string().min(1).max(40), modifier: z.string().max(40).optional(), location: lonLatTuple, exit: z.number().int().min(1).max(100).optional() }) });
const osrmRoute = z.object({ distance: finiteNonnegative.max(1_000_000), duration: finiteNonnegative.max(604_800), geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(lonLatTuple).min(2).max(20_000) }), legs: z.array(z.object({ steps: z.array(step).min(1).max(500) })).length(1) });
const osrmResponse = z.object({ code: z.literal('Ok'), routes: z.array(osrmRoute).min(1).max(3), waypoints: z.array(waypoint).length(2) });
const text = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const toLatLon = ([lon, lat]: [number, number]): LatLon => ({ lat, lon });
const toTuple = ([lon, lat]: [number, number]): [number, number] => [lat, lon];

export function earthDistance(a: LatLon, b: LatLon) {
  const radians = Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * radians;
  const deltaLon = (b.lon - a.lon) * radians;
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function stepInstruction(value: z.infer<typeof step>): string {
  const name = text(value.name);
  const along = name ? ` onto ${name}` : '';
  const modifiers: Record<string, string> = { left: 'left', right: 'right', 'slight left': 'slightly left', 'slight right': 'slightly right', 'sharp left': 'sharply left', 'sharp right': 'sharply right', straight: 'straight', uturn: 'back' };
  const direction = value.maneuver.modifier ? modifiers[value.maneuver.modifier] : undefined;
  switch (value.maneuver.type) {
    case 'depart': return name ? `Start along ${name}` : 'Start along the mapped walking route';
    case 'arrive': return 'Arrive at the mapped destination';
    case 'turn': case 'end of road': case 'fork': case 'roundabout turn': return direction ? `Turn ${direction}${along}` : `Continue${along}`;
    case 'roundabout': case 'rotary': return value.maneuver.exit ? `At the roundabout, take exit ${value.maneuver.exit}${along}` : `Continue through the roundabout${along}`;
    case 'exit roundabout': case 'exit rotary': return `Exit the roundabout${along}`;
    case 'continue': case 'new name': return name ? `Continue along ${name}` : 'Continue along the mapped route';
    default: return name ? `Continue along ${name}` : 'Continue along the mapped route';
  }
}
export function parseWalkingResponse(raw: unknown, fetchedAt = new Date().toISOString()): LiveRouteResponse {
  if (raw && typeof raw === 'object' && 'code' in raw && (raw.code === 'NoRoute' || raw.code === 'NoSegment')) throw new HttpError(422, 'NO_WALKING_ROUTE', 'No walking route was found between these locations. Try points closer to mapped paths.');
  const parsed = osrmResponse.safeParse(raw);
  if (!parsed.success) throw malformed();
  const [start, end] = parsed.data.waypoints;
  const routes: RealWalkingRoute[] = parsed.data.routes.map((route, index) => {
    if (route.legs[0].steps.some((item) => item.mode === 'driving' || item.mode === 'cycling')) throw new HttpError(502, 'LIVE_PROFILE_MISMATCH', 'The provider returned a vehicle route instead of the configured walking profile.');
    const first = route.geometry.coordinates[0];
    const last = route.geometry.coordinates.at(-1)!;
    if (earthDistance(toLatLon(first), toLatLon(start.location)) > 10 || earthDistance(toLatLon(last), toLatLon(end.location)) > 10) throw malformed();
    const warnings = ['Mapped walking route only. Step-free access, slopes, surface quality, width, and temporary obstructions have not been verified.', 'Travel time is a provider estimate; this is not accessible-route certification or emergency navigation.'];
    if (start.distance > 25 || end.distance > 25) warnings.push('One or both selected points are more than 25 m from the mapped path. Travel between each selected point and its snapped point is not included or verified.');
    if (route.legs[0].steps.some((item) => item.mode && item.mode !== 'walking' && item.mode !== 'foot')) warnings.push('The provider reports a non-walking segment, such as a ferry; inspect the route before travel.');
    const steps: WalkingStep[] = route.legs[0].steps.map((item) => ({ instruction: stepInstruction(item), distanceMeters: item.distance, location: toTuple(item.maneuver.location) }));
    return { id: `walking-${index + 1}`, distanceMeters: route.distance, durationSeconds: route.duration, coordinates: route.geometry.coordinates.map(toTuple), steps, snappedStart: toLatLon(start.location), snappedEnd: toLatLon(end.location), startSnapDistanceMeters: start.distance, endSnapDistanceMeters: end.distance, warnings };
  });
  return { provider: 'FOSSGIS OSRM', profile: 'walking', dataSource: 'OpenStreetMap', routes, fetchedAt };
}

const photonFeature = z.object({ geometry: z.object({ type: z.literal('Point'), coordinates: lonLatTuple }), properties: z.object({ osm_id: z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.string().max(40)]).optional(), osm_type: z.string().max(10).optional(), name: z.string().max(300).optional(), street: z.string().max(200).optional(), housenumber: z.string().max(40).optional(), city: z.string().max(200).optional(), town: z.string().max(200).optional(), village: z.string().max(200).optional(), county: z.string().max(200).optional(), state: z.string().max(200).optional(), country: z.string().max(200).optional() }) });
export function parsePlaceResponse(raw: unknown): PlaceSearchResponse {
  const result = z.object({ type: z.literal('FeatureCollection'), features: z.array(photonFeature).max(50) }).safeParse(raw);
  if (!result.success) throw malformed();
  const places = result.data.features.slice(0, 5).map((feature, index) => {
    const { properties: p, geometry: { coordinates: [lon, lat] } } = feature;
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const labelParts = [p.name || street, p.city || p.town || p.village || p.county, p.state, p.country].filter((value): value is string => Boolean(value)).map(text).filter(Boolean);
    const label = Array.from(new Set(labelParts)).join(', ').slice(0, 700);
    if (!label) throw malformed();
    return { id: p.osm_id === undefined ? `photon-${index}-${lon}-${lat}` : `photon-${p.osm_type || 'osm'}-${p.osm_id}`, label, lat, lon, source: 'photon' as const };
  });
  return { places, provider: 'Photon', attribution: '© OpenStreetMap contributors' };
}
