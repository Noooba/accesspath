import { z } from 'zod';
import { HttpError } from './security/http';
import { distanceMetres, segmentProjection } from './navigation';
import { acquireProviderSlot } from './live-routing/provider-gate';
import { boundedProviderResponse } from './bounded-provider-response';
import type { AccessPreferences, WorldObstacle } from '@/types/accessibility';
import type { LatLon, LiveRouteResponse } from '@/types/live-routing';
const tuple=z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)]);
const featureSchema=z.object({type:z.literal('FeatureCollection'),features:z.array(z.object({geometry:z.object({type:z.literal('LineString'),coordinates:z.array(z.union([tuple,z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90),z.number().finite()])])).min(2).max(20000)}),properties:z.object({summary:z.object({distance:z.number().finite().nonnegative().max(1000000),duration:z.number().finite().nonnegative().max(604800)}),segments:z.array(z.object({steps:z.array(z.object({instruction:z.string().max(1000),distance:z.number().finite().nonnegative(),way_points:z.tuple([z.number().int().nonnegative(),z.number().int().nonnegative()])})).max(500)})).min(1).max(1),warnings:z.array(z.unknown()).optional()})})).min(1).max(1)});
export function wheelchairRequest(start:LatLon,end:LatLon,preferences:AccessPreferences,reports:WorldObstacle[]) {
  if(preferences.avoidRamps || preferences.requireKnownAccess) throw new HttpError(422,'PROVIDER_ACCESS_DETAIL_LIMIT','This wheelchair provider cannot confirm complete ramp/attribute coverage or exclude every ramp. Turn off those local-map-only options; all route details still require review.');
  if(![3,6,10,15].includes(preferences.maxSlopePercent)||![3,6,10].includes(preferences.maxKerbCm)) throw new HttpError(422,'PROVIDER_PREFERENCE_LIMIT','The wheelchair provider supports maximum slopes of 3, 6, 10 or 15 percent and kerb heights of 3, 6 or 10 cm. Choose a supported value; your requested limit has not been silently relaxed.');
  const active=reports.filter(report=>report.reviewStatus==='approved'&&Date.parse(report.expiresAt)>Date.now());
  const polygons=active.map(report=>[Array.from({length:13},(_,index)=>{
    const angle=2*Math.PI*index/12,radius=report.radiusMeters+3,lat=report.lat+Math.sin(angle)*radius/111195,lon=report.lon+Math.cos(angle)*radius/(111195*Math.max(.05,Math.cos(report.lat*Math.PI/180)));
    return [lon,lat];
  })]);
  return {coordinates:[[start.lon,start.lat],[end.lon,end.lat]],radiuses:[60,60],instructions:true,units:'m',language:'en',options:{avoid_features:['steps','ferries'],profile_params:{restrictions:{maximum_incline:preferences.maxSlopePercent,minimum_width:preferences.minWidthCm/100,maximum_sloped_kerb:preferences.maxKerbCm/100,surface_type:'paving_stones',smoothness_type:'good',track_type:'grade1'}},...(polygons.length?{avoid_polygons:{type:'MultiPolygon',coordinates:polygons}}:{})}};
}
export function parseWheelchairResponse(raw:unknown,start:LatLon,end:LatLon,preferences:AccessPreferences,reports:WorldObstacle[]):LiveRouteResponse {
  const parsed=featureSchema.safeParse(raw);
  if(!parsed.success) throw new HttpError(502,'WHEELCHAIR_RESPONSE_INVALID','The wheelchair provider returned incomplete route data. No unchecked replacement route is shown.');
  const feature=parsed.data.features[0],coordinates:[number,number][]=feature.geometry.coordinates.map(([lon,lat])=>[lat,lon]);
  if(feature.properties.warnings?.length) {
    const messages=feature.properties.warnings.map(warning=>warning&&typeof warning==='object'&&'message'in warning&&typeof warning.message==='string'?warning.message.replace(/[\u0000-\u001f]/g,' ').slice(0,300):'Unspecified provider warning').join(' ');
    throw new HttpError(422,'WHEELCHAIR_PROVIDER_LIMITATION',`The wheelchair provider reported limitations: ${messages} No route is accepted until those limitations are reviewed.`);
  }
  const approved=reports.filter(report=>report.reviewStatus==='approved'&&Date.parse(report.expiresAt)>Date.now());
  for(const report of approved) for(let index=1;index<coordinates.length;index++) if(segmentProjection(report,{lat:coordinates[index-1][0],lon:coordinates[index-1][1]},{lat:coordinates[index][0],lon:coordinates[index][1]}).distance<=report.radiusMeters) throw new HttpError(422,'REVIEWED_OBSTACLE_ON_ROUTE','The provider route still crosses a reviewed obstacle area. No route is accepted; choose different endpoints.');
  const snappedStart={lat:coordinates[0][0],lon:coordinates[0][1]},snappedEnd={lat:coordinates.at(-1)![0],lon:coordinates.at(-1)![1]},startGap=distanceMetres(start,snappedStart),endGap=distanceMetres(end,snappedEnd);
  if(startGap>60 || endGap>60) throw new HttpError(422,'WHEELCHAIR_SNAP_TOO_FAR','The wheelchair route does not connect close enough to an endpoint. Choose an exact entrance or pedestrian path.');
  const steps=feature.properties.segments[0].steps.map(step=>{
    const location=coordinates[step.way_points[0]];
    if(!location || step.way_points[1]>=coordinates.length) throw new HttpError(502,'WHEELCHAIR_RESPONSE_INVALID','The provider returned invalid direction indices.');
    return {instruction:step.instruction,distanceMeters:step.distance,location};
  });
  if(!steps.length) throw new HttpError(502,'WHEELCHAIR_RESPONSE_INVALID','The provider returned no usable directions.');
  const warnings=['Wheelchair routing profile requested with steps and ferries excluded and your mapped slope, width, kerb and surface restrictions. This is not a field-verified accessibility guarantee.','The provider does not return complete per-segment ramp, width or missing-data coverage. Ramps may be included; confirm their slope and condition before starting.','Unmapped or outdated barriers can remain. An absent map tag must not be read as verified access.'];
  if(feature.properties.warnings?.length) warnings.push('The routing provider returned additional limitations. Review the route and confirm conditions before travelling.');
  if(startGap>5||endGap>5) warnings.push(`Unrouted endpoint gaps: ${Math.round(startGap)} m at start and ${Math.round(endGap)} m at destination. These have not been checked for barriers.`);
  const pending=reports.filter(report=>report.reviewStatus==='pending').filter(report=>coordinates.slice(1).some((point,index)=>segmentProjection(report,{lat:coordinates[index][0],lon:coordinates[index][1]},{lat:point[0],lon:point[1]}).distance<=report.radiusMeters+20)).length;
  if(pending) warnings.push(`${pending} unreviewed reports are near this route. They remain unverified.`);
  return {provider:'openrouteservice wheelchair',profile:'walking',dataSource:'OpenStreetMap',fetchedAt:new Date().toISOString(),routes:[{id:'ors-wheelchair',coordinates,steps,distanceMeters:feature.properties.summary.distance,durationSeconds:feature.properties.summary.duration,snappedStart,snappedEnd,startSnapDistanceMeters:startGap,endSnapDistanceMeters:endGap,warnings}],access:{source:'OpenStreetMap',engine:'openrouteservice',checkedSegments:null,excludedSegments:null,rampSegments:null,unknownSegments:null,reviewedObstaclesAvoided:approved.length,pendingReportsNearby:pending,preferences},obstacles:reports.filter(report=>report.reviewStatus!=='rejected')};
}
export async function wheelchairProviderRoute(start:LatLon,end:LatLon,preferences:AccessPreferences,reports:WorldObstacle[]) {
  const body=wheelchairRequest(start,end,preferences,reports),key=process.env.ORS_API_KEY;
  if(!key) throw new HttpError(503,'WHEELCHAIR_PROVIDER_NOT_CONFIGURED','The wheelchair route provider has not been connected.');
  await acquireProviderSlot('ors');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch('https://api.heigit.org/openrouteservice/v2/directions/wheelchair/geojson',{method:'POST',headers:{Authorization:key,'Content-Type':'application/json',Accept:'application/geo+json, application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store',redirect:'error'});
    if(!response.ok) throw new HttpError(response.status===429?429:response.status===400||response.status===404?422:502,'WHEELCHAIR_PROVIDER_UNAVAILABLE',response.status===400?'The wheelchair provider could not apply these preferences. Try a supported slope/kerb limit or different endpoints.':response.status===429?'The wheelchair provider request limit was reached. Try again later.':'The wheelchair provider could not return a route. Check the connection or choose different endpoints.');
    const raw=await boundedProviderResponse(response);
    return parseWheelchairResponse(raw,start,end,preferences,reports);
  }catch(error){if(error instanceof HttpError)throw error;throw new HttpError(502,'WHEELCHAIR_PROVIDER_UNAVAILABLE','The wheelchair provider could not be reached. No unchecked walk is substituted.');}finally{clearTimeout(timer);}
}
