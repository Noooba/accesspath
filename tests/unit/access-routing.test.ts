import { describe, expect, it } from 'vitest';
import { accessRoute, inspectAccess, parseAccessNetwork, taggedMetres, taggedSlope } from '@/lib/access-routing';
import { DEFAULT_ACCESS_PREFERENCES } from '@/types/accessibility';
import type { WorldObstacle } from '@/types/accessibility';
import { ACCESS_END, ACCESS_RAMP_POINT, ACCESS_START, accessMapFixture, fullAccessTags } from '../fixtures/access-map';

const preferences=DEFAULT_ACCESS_PREFERENCES;
describe('actual barrier exclusions on an invented OSM graph',()=>{
  it('removes the shorter stairs and uses the connected ramp path, with a ramp warning',()=>{
    const {route,access}=accessRoute(parseAccessNetwork(accessMapFixture()),ACCESS_START,ACCESS_END,preferences);
    expect(route.coordinates).toContainEqual([ACCESS_RAMP_POINT.lat,ACCESS_RAMP_POINT.lon]);
    expect(route.coordinates).not.toContainEqual([33.81,-118.353]);
    expect(route.warnings.join(' ')).toContain('ramp');expect(access.rampSegments).toBe(2);expect(access.unknownSegments).toBe(0);
  });
  it('finds a different genuine path when ramps are excluded',()=>{
    const {route,access}=accessRoute(parseAccessNetwork(accessMapFixture()),ACCESS_START,ACCESS_END,{...preferences,avoidRamps:true});
    expect(route.coordinates).toContainEqual([33.8088,-118.353]);expect(access.rampSegments).toBe(0);
  });
  it('does not invent a connection if every remaining path is excluded',()=>{
    expect(()=>accessRoute(parseAccessNetwork(accessMapFixture()),ACCESS_START,ACCESS_END,{...preferences,maxSlopePercent:0})).toThrow();
  });
  it('removes approved obstacle areas but keeps pending observations as warnings',()=>{
    const report:WorldObstacle={...ACCESS_RAMP_POINT,id:'world-fixture',kind:'world',category:'blocked-path',description:'Synthetic obstacle fixture',radiusMeters:10,reportedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),reviewStatus:'approved',reviewedAt:new Date().toISOString(),moderatorNotes:''};
    const approved=accessRoute(parseAccessNetwork(accessMapFixture()),ACCESS_START,ACCESS_END,preferences,[report]);
    expect(approved.route.coordinates).toContainEqual([33.8088,-118.353]);expect(approved.access.reviewedObstaclesAvoided).toBe(1);
    const pending=accessRoute(parseAccessNetwork(accessMapFixture()),ACCESS_START,ACCESS_END,preferences,[{...report,reviewStatus:'pending'}]);
    expect(pending.access.pendingReportsNearby).toBe(1);expect(pending.access.rampSegments).toBe(2);
    const expired=accessRoute(parseAccessNetwork(accessMapFixture()),ACCESS_START,ACCESS_END,preferences,[{...report,expiresAt:'2000-01-01T00:00:00.000Z'}]);
    expect(expired.access.reviewedObstaclesAvoided).toBe(0);
  });
  it('preserves missing access information and rejects it in strict mode',()=>{
    const unknown={highway:'footway'};
    expect(inspectAccess(unknown,{}, {},preferences).unknown).toEqual(expect.arrayContaining(['slope','width','surface','wheelchair access']));
    expect(inspectAccess(unknown,{}, {},{...preferences,requireKnownAccess:true}).allowed).toBe(false);
  });
  it.each([
    {highway:'steps'},{incline:'15%'},{width:'0.7'},{wheelchair:'no'},{wheelchair:'limited'},{surface:'gravel'},{smoothness:'bad'},{access:'private'},{barrier:'stile'},{'kerb:height':'0.1'},{kerb:'raised'},{highway:'elevator'},{locked:'yes'},
  ] as Record<string,string>[])('excludes a real recorded barrier: %j',tags=>{
    expect(inspectAccess({...fullAccessTags,...tags},{},{},preferences).allowed).toBe(false);
  });
  it('does not treat a node width/slope as a measurement of an entire path',()=>{
    const result=inspectAccess({highway:'footway',surface:'asphalt',wheelchair:'yes'},{incline:'1%',width:'2'}, {},{...preferences,requireKnownAccess:true});
    expect(result.allowed).toBe(false);expect(result.unknown).toContain('slope');expect(result.unknown).toContain('width');
  });
  it('rejects missing network nodes and refuses distant or strict unmapped endpoints',()=>{
    const broken=accessMapFixture();broken.elements=broken.elements.filter(item=>item.id!==4);
    expect(()=>accessRoute(parseAccessNetwork(broken),ACCESS_START,ACCESS_END,preferences)).toThrow(/incomplete/);
    expect(()=>accessRoute(parseAccessNetwork(accessMapFixture()),{lat:34,lon:-118},ACCESS_END,preferences)).toThrow(/60 m/);
    expect(()=>accessRoute(parseAccessNetwork(accessMapFixture()),{lat:ACCESS_START.lat-.0001,lon:ACCESS_START.lon},ACCESS_END,{...preferences,requireKnownAccess:true})).toThrow(/unmapped endpoint/);
  });
  it('parses known units without guessing unknown slope text',()=>{
    expect(taggedMetres('90 cm')).toBeCloseTo(.9);expect(taggedMetres('3 ft')).toBeCloseTo(.9144);expect(taggedMetres('unknown')).toBeNull();
    expect(taggedSlope('-8%')).toBe(8);expect(taggedSlope('5°')).toBeCloseTo(8.7488);expect(taggedSlope('up')).toBeNull();
  });
  it('rejects partial Overpass responses instead of claiming no barriers',()=>{
    expect(()=>parseAccessNetwork({elements:[],remark:'runtime timeout'})).toThrow(/incomplete/);
  });
});
