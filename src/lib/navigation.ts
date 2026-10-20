import type { LatLon, RealWalkingRoute } from '@/types/live-routing';

export function distanceMetres(a: LatLon, b: LatLon) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, value)), Math.sqrt(Math.max(0, 1 - value)));
}
/** Closest point on a geographic segment in a local metre projection. No straight-line route is generated. */
export function segmentProjection(point: LatLon, a: LatLon, b: LatLon) {
  const scale = 111195, cosine = Math.max(.001, Math.cos(point.lat * Math.PI / 180));
  const longitude = (lon: number) => ((lon - point.lon + 540) % 360 - 180) * scale * cosine;
  const ax = longitude(a.lon), ay = (a.lat - point.lat) * scale, bx = longitude(b.lon), by = (b.lat - point.lat) * scale;
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
  const fraction = length2 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / length2)) : 0;
  return { distance: Math.hypot(ax + fraction * dx, ay + fraction * dy), fraction };
}
export function routeProgress(point: LatLon, route: RealWalkingRoute) {
  let bestDistance = Infinity, along = 0, total = 0;
  const lengths: number[] = [];
  for (let index = 1; index < route.coordinates.length; index++) {
    const [aLat, aLon] = route.coordinates[index - 1], [bLat, bLon] = route.coordinates[index];
    const a = {lat:aLat,lon:aLon}, b = {lat:bLat,lon:bLon};
    const length = distanceMetres(a, b), projected = segmentProjection(point, a, b);
    if (projected.distance < bestDistance) { bestDistance = projected.distance; along = total + projected.fraction * length; }
    total += length; lengths.push(length);
  }
  let walked = 0, stepIndex = Math.max(0, route.steps.length - 1);
  // Provider step distances and line distances can differ slightly; normalize consistently.
  const stepTotal = route.steps.reduce((sum, step) => sum + step.distanceMeters, 0);
  const providerAlong = total > 0 ? along / total * stepTotal : 0;
  for (let index = 0; index < route.steps.length; index++) {
    if (providerAlong < walked + route.steps[index].distanceMeters || index === route.steps.length - 1) { stepIndex = index; break; }
    walked += route.steps[index].distanceMeters;
  }
  return { distanceFromRoute: bestDistance, remainingMeters: Math.max(0, route.distanceMeters * (total > 0 ? 1 - along / total : 0)), stepIndex, distanceToNextStep: Math.max(0, walked + (route.steps[stepIndex]?.distanceMeters ?? 0) - providerAlong) };
}
export type LocationFix = LatLon & { accuracy: number; timestamp: number; heading?: number | null };
export function reliableFix(fix: LocationFix, now = Date.now()) {
  return Number.isFinite(fix.lat) && Number.isFinite(fix.lon) && Math.abs(fix.lat) <= 90 && Math.abs(fix.lon) <= 180 && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= 50 && now - fix.timestamp <= 15000 && fix.timestamp <= now + 5000;
}
