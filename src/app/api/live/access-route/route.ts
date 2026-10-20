import { z } from 'zod';
import { latLon } from '@/lib/live-routing/validation';
import { DEFAULT_ACCESS_PREFERENCES } from '@/types/accessibility';
import { boundedJson, errorResponse, HttpError, json, requireSameOrigin } from '@/lib/security/http';
import { accessRoute, parseAccessNetwork, type AccessNetwork } from '@/lib/access-routing';
import { distanceMetres } from '@/lib/navigation';
import { acquireProviderSlot } from '@/lib/live-routing/provider-gate';
import { providerBase, providerJson } from '@/lib/live-routing/transport';
import { boundsInput, worldReports } from '@/lib/world-obstacles';
import { BoundedTtlCache } from '@/lib/live-routing/cache';
import { accessPreferenceSchema } from '@/lib/access-preferences';
import { wheelchairProviderRoute } from '@/lib/wheelchair-provider';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const inputSchema=z.object({start:latLon,end:latLon,preferences:accessPreferenceSchema.default(DEFAULT_ACCESS_PREFERENCES)}).strict();
const networks=new BoundedTtlCache<{raw:unknown;fetchedAt:string}>(6,12*1024*1024,10*60_000);
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);
    const parsed=inputSchema.safeParse(await boundedJson(request,2048));
    if(!parsed.success) throw new HttpError(400,'INVALID_ACCESS_REQUEST','Choose valid places and accessibility preferences.');
    const {start,end,preferences}=parsed.data;
    if(distanceMetres(start,end)>3000 || Math.max(Math.abs(start.lat),Math.abs(end.lat))>80 || Math.abs(start.lon-end.lon)>.15) throw new HttpError(400,'ACCESS_AREA_LIMIT','Access-aware routing currently covers local walks up to 3 km apart, away from polar and date-line areas. Use closer points; ordinary walking remains available separately.');
    const padding=.004;
    const box={south:Math.max(-90,Math.floor((Math.min(start.lat,end.lat)-padding)*1000)/1000),north:Math.min(90,Math.ceil((Math.max(start.lat,end.lat)+padding)*1000)/1000),west:Math.max(-180,Math.floor((Math.min(start.lon,end.lon)-padding)*1000)/1000),east:Math.min(180,Math.ceil((Math.max(start.lon,end.lon)+padding)*1000)/1000)};
    if(!boundsInput.safeParse(box).success) throw new HttpError(400,'ACCESS_AREA_LIMIT','This area is too large for the local accessibility map.');
    if(process.env.ORS_API_KEY) return json(await wheelchairProviderRoute(start,end,preferences,await worldReports(box)));
    const key=JSON.stringify(box),cached=networks.get(key);let raw=cached?.raw,fetchedAt=cached?.fetchedAt;
    if(!raw) {
      await acquireProviderSlot('overpass');
      const url=providerBase('overpass');
      const query=`[out:json][timeout:12][maxsize:16777216];way["highway"~"^(footway|path|pedestrian|living_street|steps|cycleway)$"](${box.south},${box.west},${box.north},${box.east});(._;>;);out body;`;
      raw=await providerJson(url,{maxBytes:4*1024*1024,timeoutMs:35000,formBody:new URLSearchParams({data:query}).toString()});
      fetchedAt=new Date().toISOString();parseAccessNetwork(raw);networks.set(key,{raw,fetchedAt});
    }
    const network:AccessNetwork=parseAccessNetwork(raw), reports=await worldReports(box);
    const result=accessRoute(network,start,end,preferences,reports);
    return json({provider:'OpenStreetMap pedestrian graph',profile:'walking',dataSource:'OpenStreetMap',routes:[result.route],access:result.access,fetchedAt,obstacles:reports.filter(report=>report.reviewStatus!=='rejected')});
  } catch(error) {return errorResponse(error);}
}
