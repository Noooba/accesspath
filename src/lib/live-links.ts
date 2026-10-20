import type { LatLon } from "@/types/live-routing";

export type TravelMode = 'walking' | 'driving' | 'bicycling' | 'transit';
export function googleDirections(start: LatLon, end: LatLon, mode: TravelMode = 'walking', navigate = false): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${start.lat},${start.lon}`);
  url.searchParams.set("destination", `${end.lat},${end.lon}`);
  url.searchParams.set("travelmode", mode);
  if (navigate) url.searchParams.set('dir_action','navigate');
  return url.toString();
}
export const googleWalkingDirections = (start: LatLon, end: LatLon) => googleDirections(start,end,'walking');
