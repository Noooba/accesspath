/** WGS84-like geographic positions; the demo coordinates are entirely synthetic. */
export type Coordinate = [latitude: number, longitude: number];

const EARTH_RADIUS_METERS = 6_371_008.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90 &&
    typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180;
}

/** Great-circle distance, not a walking-time or terrain estimate. Invalid input is unavailable. */
export function haversineDistance(from: Coordinate, to: Coordinate): number | null {
  if (!isCoordinate(from) || !isCoordinate(to)) return null;
  const deltaLatitude = radians(to[0] - from[0]);
  const deltaLongitude = radians(to[1] - from[1]);
  const a = Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

/** Sum the supplied polyline segments. No straight-line substitute for missing geometry. */
export function polylineDistance(geometry: Coordinate[]): number | null {
  if (!Array.isArray(geometry) || geometry.length < 2) return null;
  let total = 0;
  for (let index = 1; index < geometry.length; index += 1) {
    const segment = haversineDistance(geometry[index - 1], geometry[index]);
    if (segment === null) return null;
    total += segment;
  }
  return total;
}
