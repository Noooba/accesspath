import type { LatLon } from "@/types/live-routing";

export function googleWalkingDirections(start: LatLon, end: LatLon): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${start.lat},${start.lon}`);
  url.searchParams.set("destination", `${end.lat},${end.lon}`);
  url.searchParams.set("travelmode", "walking");
  return url.toString();
}
