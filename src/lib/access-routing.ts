import { z } from 'zod';
import { MinHeap } from './routing/heap';
import { distanceMetres, segmentProjection } from './navigation';
import type { AccessPreferences, AccessSummary, WorldObstacle } from '@/types/accessibility';
import type { LatLon, RealWalkingRoute } from '@/types/live-routing';
import { HttpError } from './security/http';

const tagsSchema = z.record(z.string().max(100), z.string().max(1000));
const nodeSchema = z.object({type:z.literal('node'),id:z.number().int().positive(),lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180),tags:tagsSchema.optional()});
const waySchema = z.object({type:z.literal('way'),id:z.number().int().positive(),nodes:z.array(z.number().int().positive()).min(2).max(10000),tags:tagsSchema});
const responseSchema = z.object({elements:z.array(z.discriminatedUnion('type',[nodeSchema,waySchema])).max(30000),remark:z.string().optional()});
type OsmNode = z.infer<typeof nodeSchema>;
type OsmWay = z.infer<typeof waySchema>;
export type AccessNetwork = {nodes:Map<number,OsmNode>;ways:OsmWay[]};
export function parseAccessNetwork(raw:unknown):AccessNetwork {
  const parsed=responseSchema.safeParse(raw);
  if(!parsed.success || parsed.data.remark) throw new HttpError(502,'ACCESS_MAP_INCOMPLETE','The access map returned incomplete data. No accessible route has been assumed.');
  return {nodes:new Map(parsed.data.elements.filter((item):item is OsmNode=>item.type==='node').map(node=>[node.id,node])),ways:parsed.data.elements.filter((item):item is OsmWay=>item.type==='way')};
}
export function taggedMetres(value?:string) {
  if (!value) return null;
  const match=value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(m|cm|ft|')?$/i);
  if(!match) return null;
  const unit=match[2]?.toLowerCase(), amount=Number(match[1]);
  return amount*(unit==='cm'?.01:unit==='ft'||unit==="'"?.3048:1);
}
export function taggedSlope(value?:string) {
  if(!value) return null;
  const match=value.trim().match(/^([+-]?[0-9]+(?:\.[0-9]+)?)\s*(%|°)?$/);
  if(!match) return null;
  return Math.abs(match[2]==='°'?Math.tan(Number(match[1])*Math.PI/180)*100:Number(match[1]));
}
const rough=new Set(['gravel','fine_gravel','sand','ground','dirt','grass','mud','cobblestone','sett','pebblestone','woodchips','rock']);
const smooth=new Set(['asphalt','concrete','concrete:plates','concrete:lanes','paving_stones','paved','metal','wood']);
const excludedAccess=new Set(['no','private','customers','delivery','agricultural','forestry']);
export function inspectAccess(wayTags:Record<string,string>, aTags:Record<string,string>={}, bTags:Record<string,string>={}, preferences:AccessPreferences) {
  const reasons:string[]=[], unknown=new Set<string>();
  const all=[wayTags,aTags,bTags];
  if (wayTags.highway==='steps' || Number(wayTags.step_count)>0) reasons.push('Mapped stairs');
  if (all.some(tags=>excludedAccess.has(tags.foot ?? '') || (excludedAccess.has(tags.access ?? '') && !['yes','designated','permissive'].includes(tags.foot ?? '')))) reasons.push('Restricted pedestrian access');
  if (all.some(tags=>['no','limited'].includes(tags.wheelchair ?? ''))) reasons.push('Mapped wheelchair restriction');
  if(all.some(tags=>tags.construction || tags.highway==='construction' || tags.highway==='proposed')) reasons.push('Construction or proposed path');
  const ramp=all.some(tags=>['yes','designated'].includes(tags.ramp ?? '') || tags['ramp:wheelchair']==='yes');
  if(ramp && preferences.avoidRamps) reasons.push('Ramp excluded by preference');
  let curbKnown=false;
  const slopeKnown=taggedSlope(wayTags.incline)!==null, widthKnown=taggedMetres(wayTags.width ?? wayTags['width:physical'] ?? wayTags['maxwidth:physical'])!==null;
  for(const tags of all) {
    const slope=taggedSlope(tags.incline);
    if(slope!==null && slope>preferences.maxSlopePercent) reasons.push('Slope above preference');
    const width=taggedMetres(tags.width ?? tags['width:physical'] ?? tags['maxwidth:physical']);
    if(width!==null && width*100<preferences.minWidthCm) reasons.push('Width below preference');
    const kerb=taggedMetres(tags['kerb:height']);
    if(kerb!==null) {curbKnown=true;if(kerb*100>preferences.maxKerbCm) reasons.push('Kerb above preference');}
    if(['raised','rolled'].includes(tags.kerb ?? '')) reasons.push('Raised or rolled kerb');
    if(['flush','lowered','no'].includes(tags.kerb ?? '')) curbKnown=true;
    if(tags.barrier && !['no','entrance','kerb','bollard','gate','lift_gate','cycle_barrier'].includes(tags.barrier)) reasons.push('Mapped barrier');
    if(tags.barrier && !['no','entrance','kerb'].includes(tags.barrier) && !['yes','designated'].includes(tags.wheelchair ?? '')) reasons.push('Barrier clearance not established');
    if(rough.has(tags.surface ?? '') || ['bad','very_bad','horrible','very_horrible','impassable'].includes(tags.smoothness ?? '')) reasons.push('Rough or impassable surface');
    if(tags.highway==='elevator') reasons.push('Lift operation is not verified');
    if(tags.locked==='yes' || tags.sac_scale && tags.sac_scale!=='hiking') reasons.push('Locked or difficult trail');
    if(tags['access:conditional'] || tags['foot:conditional'] || tags.opening_hours) unknown.add('time-dependent access');
  }
  if(!slopeKnown) unknown.add('slope');
  if(!widthKnown) unknown.add('width');
  if(!smooth.has(wayTags.surface ?? '')) unknown.add('surface');
  if(!['yes','designated'].includes(wayTags.wheelchair ?? '')) unknown.add('wheelchair access');
  if((wayTags.footway==='crossing' || all.some(tags=>tags.highway==='crossing' || tags.barrier==='kerb')) && !curbKnown) unknown.add('kerb access');
  if(preferences.requireKnownAccess && unknown.size) reasons.push('Required access details are missing');
  return {allowed:reasons.length===0,reasons,ramp,unknown:[...unknown]};
}
type Segment={from:number;to:number;way:OsmWay;length:number;info:ReturnType<typeof inspectAccess>};
/** Local graph routing: remove forbidden segments before Dijkstra; never substitute an unchecked provider walk. */
export function accessRoute(network:AccessNetwork,start:LatLon,end:LatLon,preferences:AccessPreferences,reports:WorldObstacle[]=[]) : {route:RealWalkingRoute;access:AccessSummary} {
  const segments:Segment[]=[], blockedReports=reports.filter(report=>report.reviewStatus==='approved' && Date.parse(report.expiresAt)>Date.now());
  const excludedReportIds=new Set<string>(); let excluded=0;
  const walkable=new Set(['footway','path','pedestrian','living_street','steps']);
  for(const way of network.ways) {
    const tags=way.tags;
    // Do not route a wheelchair along a vehicle-road centreline or invent a sidewalk connection.
    if(!walkable.has(tags.highway) && !(tags.highway==='cycleway' && ['yes','designated'].includes(tags.foot))) continue;
    if(tags.area==='yes' || tags.indoor==='yes') continue;
    for(let index=1;index<way.nodes.length;index++) {
      const a=network.nodes.get(way.nodes[index-1]),b=network.nodes.get(way.nodes[index]);
      if(!a||!b) throw new HttpError(502,'ACCESS_MAP_INCOMPLETE','The pedestrian graph is incomplete. No replacement route has been fabricated.');
      const info=inspectAccess(tags,a.tags,b.tags,preferences);
      let obstacle=false;
      for(const report of blockedReports) if(segmentProjection(report,a,b).distance<=report.radiusMeters) {obstacle=true;excludedReportIds.add(report.id);}
      if(!info.allowed || obstacle) {excluded++;continue;}
      const length=distanceMetres(a,b); if(length===0) continue;
      if(tags['oneway:foot']!=='-1') segments.push({from:a.id,to:b.id,way,length,info});
      if(tags['oneway:foot']!=='yes' && tags['oneway:foot']!=='1') segments.push({from:b.id,to:a.id,way,length,info});
    }
  }
  const ids=new Set(segments.flatMap(segment=>[segment.from,segment.to]));
  function nearest(point:LatLon) {
    let id:number|undefined, distance=Infinity;
    for(const candidate of ids) {const d=distanceMetres(point,network.nodes.get(candidate)!);if(d<distance) {id=candidate;distance=d;}}
    if(id===undefined||distance>60) throw new HttpError(422,'ACCESS_ENDPOINT_UNMAPPED','No suitable mapped pedestrian connection exists within 60 m of one endpoint. Choose an exact sidewalk or entrance point. Unmapped connections cannot be certified.');
    return {id,distance};
  }
  const origin=nearest(start), destination=nearest(end);
  if(preferences.requireKnownAccess && (origin.distance>5 || destination.distance>5)) throw new HttpError(422,'ACCESS_ENDPOINT_GAP','Strict access mode cannot establish an unmapped endpoint connection. Choose exact mapped pedestrian endpoints within 5 m.');
  if(origin.id===destination.id) throw new HttpError(422,'ACCESS_ENDPOINT_SAME_NODE','Both places connect to the same mapped point. Select distinct documented pathway points.');
  const adjacency=new Map<number,Segment[]>();
  for(const segment of segments) {const list=adjacency.get(segment.from)??[];list.push(segment);adjacency.set(segment.from,list);}
  const queue=new MinHeap<{id:number;distance:number}>((a,b)=>a.distance-b.distance||a.id-b.id),distances=new Map([[origin.id,0]]),previous=new Map<number,Segment>();
  queue.push({id:origin.id,distance:0});
  while(queue.size) {
    const current=queue.pop()!;if(current.distance!==distances.get(current.id)) continue;if(current.id===destination.id) break;
    for(const edge of adjacency.get(current.id)??[]) {const distance=current.distance+edge.length;if(distance<(distances.get(edge.to)??Infinity)) {distances.set(edge.to,distance);previous.set(edge.to,edge);queue.push({id:edge.to,distance});}}
  }
  if(!distances.has(destination.id)) throw new HttpError(422,'NO_ACCESS_ROUTE','No connected pedestrian route meets these access preferences in the downloaded map. Stairs, known barriers and reviewed obstacles were excluded. Missing map data may be the reason; no unchecked substitute route is shown.');
  const path:Segment[]=[];let id=destination.id;
  while(id!==origin.id) {const segment=previous.get(id)!;path.unshift(segment);id=segment.from;}
  if(path.length>5000) throw new HttpError(422,'ACCESS_ROUTE_TOO_LONG','The mapped detour is too complex for this local planner. Try closer points.');
  const coordinates:[number,number][]=[origin.id,...path.map(segment=>segment.to)].map(id=>{const node=network.nodes.get(id)!;return [node.lat,node.lon];});
  const steps:RealWalkingRoute['steps']=[];
  let lastWay=-1;
  for(const [index,segment] of path.entries()) {
    const node=network.nodes.get(segment.from)!;
    let turn='';
    if(index>0){const previous=network.nodes.get(path[index-1].from)!,next=network.nodes.get(segment.to)!,cosine=Math.cos(node.lat*Math.PI/180),ax=(node.lon-previous.lon)*cosine,ay=node.lat-previous.lat,bx=(next.lon-node.lon)*cosine,by=next.lat-node.lat;const angle=Math.atan2(ax*by-ay*bx,ax*bx+ay*by)*180/Math.PI;if(Math.abs(angle)>35)turn=angle>0?'Turn left onto':'Turn right onto';}
    if(segment.way.id===lastWay&&!turn) steps[steps.length-1].distanceMeters+=segment.length;
    else {steps.push({instruction:`${turn||'Continue along'} ${segment.way.tags.name||'the mapped pedestrian path'}${segment.info.ramp?' — ramp ahead; review its slope':''}.`,distanceMeters:segment.length,location:[node.lat,node.lon]});lastWay=segment.way.id;}
  }
  if(steps.length>499) throw new HttpError(422,'ACCESS_ROUTE_TOO_COMPLEX','This local route has too many changes for reliable guidance. Try nearer points.');
  steps.push({instruction:'Arrive at the mapped endpoint. Check the final entrance and any unmapped gap.',distanceMeters:0,location:coordinates.at(-1)!});
  const ramps=path.filter(segment=>segment.info.ramp).length, unknowns=path.filter(segment=>segment.info.unknown.length).length;
  const unknownFields=[...new Set(path.flatMap(segment=>segment.info.unknown))];
  const warnings=['Access-aware route from OpenStreetMap tags, not a field-verified accessibility guarantee. Unmapped stairs, barriers, crossings, closures or tag errors can still exist.'];
  if(unknowns) warnings.push(`${unknowns} route segments have missing ${unknownFields.join(', ')} information. Confirm conditions before relying on this route.`);
  if(ramps) warnings.push(`${ramps} mapped ramp segments are included. Ramps can require effort or assistance; inspect the slope and current conditions before starting.`);
  if(origin.distance>0||destination.distance>0) warnings.push(`Unrouted endpoint gaps: ${Math.round(origin.distance)} m at start and ${Math.round(destination.distance)} m at destination. These links were not checked for obstacles.`);
  const pending=reports.filter(report=>report.reviewStatus==='pending').filter(report=>path.some(segment=>segmentProjection(report,network.nodes.get(segment.from)!,network.nodes.get(segment.to)!).distance<=report.radiusMeters+20)).length;
  if(pending) warnings.push(`${pending} unreviewed community obstacle reports are near this route. They are shown for caution, not treated as verified pathway changes.`);
  const distance=distances.get(destination.id)!;
  const firstNode=network.nodes.get(origin.id)!,lastNode=network.nodes.get(destination.id)!;
  warnings.push('Travel time uses an illustrative 1.1 m/s pace, not a personal mobility estimate.');
  return {route:{id:'access-aware-osm',distanceMeters:distance,durationSeconds:distance/1.1,coordinates,steps,snappedStart:{lat:firstNode.lat,lon:firstNode.lon},snappedEnd:{lat:lastNode.lat,lon:lastNode.lon},startSnapDistanceMeters:origin.distance,endSnapDistanceMeters:destination.distance,warnings},access:{source:'OpenStreetMap',checkedSegments:path.length,excludedSegments:excluded,rampSegments:ramps,unknownSegments:unknowns,reviewedObstaclesAvoided:excludedReportIds.size,pendingReportsNearby:pending,preferences}};
}
