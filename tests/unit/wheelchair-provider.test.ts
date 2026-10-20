import { afterEach, describe, expect, it, vi } from 'vitest';
import { wheelchairRequest, parseWheelchairResponse, wheelchairProviderRoute } from '@/lib/wheelchair-provider';
import { DEFAULT_ACCESS_PREFERENCES } from '@/types/accessibility';
import type { WorldObstacle } from '@/types/accessibility';
import { boundedProviderResponse } from '@/lib/bounded-provider-response';
import { START_FIXTURE,END_FIXTURE,walkingFixture } from '../e2e/live-fixtures';
vi.mock('@/lib/live-routing/provider-gate',()=>({acquireProviderSlot:vi.fn().mockResolvedValue(undefined)}));
const originalKey=process.env.ORS_API_KEY;
const providerPreferences={...DEFAULT_ACCESS_PREFERENCES,maxSlopePercent:6,maxKerbCm:3};
function fixture() {
  const route=walkingFixture().routes[0];
  return {type:'FeatureCollection',features:[{geometry:{type:'LineString',coordinates:route.coordinates.map(([lat,lon])=>[lon,lat])},properties:{summary:{distance:704.2,duration:600},segments:[{steps:route.steps.map((step,index)=>({instruction:step.instruction,distance:step.distanceMeters,way_points:index===0?[0,2]:[2,3]}))}],warnings:[] as unknown[]}}]};
}
afterEach(()=>{vi.unstubAllGlobals();if(originalKey===undefined)delete process.env.ORS_API_KEY;else process.env.ORS_API_KEY=originalKey;});
describe('server-only wheelchair provider contract',()=>{
  it('requests a wheelchair profile with steps excluded and mapped user restrictions',()=>{
    const body=wheelchairRequest(START_FIXTURE,END_FIXTURE,providerPreferences,[]);
    expect(body.coordinates[0]).toEqual([START_FIXTURE.lon,START_FIXTURE.lat]);
    expect(body.options.avoid_features).toEqual(['steps','ferries']);expect(body.options.profile_params.restrictions).toMatchObject({maximum_incline:6,minimum_width:.9,maximum_sloped_kerb:.03,smoothness_type:'good'});
  });
  it('does not pretend unsupported complete-data or no-ramp options can be honored',()=>{
    expect(()=>wheelchairRequest(START_FIXTURE,END_FIXTURE,{...providerPreferences,avoidRamps:true},[])).toThrow(/cannot confirm/);
    expect(()=>wheelchairRequest(START_FIXTURE,END_FIXTURE,{...providerPreferences,requireKnownAccess:true},[])).toThrow(/cannot confirm/);
  });
  it('keeps unreported segment and ramp counts unknown instead of inventing zero',()=>{
    const response=parseWheelchairResponse(fixture(),START_FIXTURE,END_FIXTURE,providerPreferences,[]);
    expect(response.access).toMatchObject({engine:'openrouteservice',checkedSegments:null,rampSegments:null,unknownSegments:null});expect(response.routes[0].coordinates[0]).toEqual([START_FIXTURE.lat,START_FIXTURE.lon]);expect(response.routes[0].warnings.join(' ')).toContain('Ramps may be included');
  });
  it('rejects incomplete geometry, bad directions and excessive endpoint snapping',()=>{
    expect(()=>parseWheelchairResponse({},START_FIXTURE,END_FIXTURE,providerPreferences,[])).toThrow();
    const invalid=fixture();invalid.features[0].properties.segments[0].steps[0].way_points=[0,99999];expect(()=>parseWheelchairResponse(invalid,START_FIXTURE,END_FIXTURE,providerPreferences,[])).toThrow(/indices/);
    expect(()=>parseWheelchairResponse(fixture(),{lat:34,lon:-118},END_FIXTURE,providerPreferences,[])).toThrow(/endpoint/);
  });
  it('refuses warning-bearing provider results rather than assuming constraints were honored',()=>{
    const raw=fixture();raw.features[0].properties.warnings=[{code:1,message:'Fixture: restrictions could not be applied'}];expect(()=>parseWheelchairResponse(raw,START_FIXTURE,END_FIXTURE,providerPreferences,[])).toThrow(/limitations/);
  });
  it('sends reviewed obstacle polygons and independently rejects a returned crossing',()=>{
    const point=walkingFixture().routes[0].coordinates[1];
    const report:WorldObstacle={id:'world-test',kind:'world',lat:point[0],lon:point[1],category:'blocked-path',radiusMeters:10,description:'Synthetic fixture',reportedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),reviewStatus:'approved',reviewedAt:null,moderatorNotes:''};
    expect(wheelchairRequest(START_FIXTURE,END_FIXTURE,providerPreferences,[report]).options.avoid_polygons?.coordinates).toHaveLength(1);
    expect(()=>parseWheelchairResponse(fixture(),START_FIXTURE,END_FIXTURE,providerPreferences,[report])).toThrow(/reviewed obstacle/);
    expect(wheelchairRequest(START_FIXTURE,END_FIXTURE,providerPreferences,[{...report,reviewStatus:'pending'}]).options).not.toHaveProperty('avoid_polygons');
  });
  it('keeps the key out of URLs and gives the browser only parsed route data',async()=>{
    process.env.ORS_API_KEY='unit-fixture-not-a-real-key';const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture())));vi.stubGlobal('fetch',fetch);
    const result=await wheelchairProviderRoute(START_FIXTURE,END_FIXTURE,providerPreferences,[]);expect(result.provider).toBe('openrouteservice wheelchair');expect(String(fetch.mock.calls[0][0])).toBe('https://api.heigit.org/openrouteservice/v2/directions/wheelchair/geojson');expect(fetch.mock.calls[0][1].headers.Authorization).toBe(process.env.ORS_API_KEY);expect(JSON.stringify(result)).not.toContain(process.env.ORS_API_KEY);
  });
  it('returns a configuration error when no key exists and bounds response size',async()=>{
    delete process.env.ORS_API_KEY;await expect(wheelchairProviderRoute(START_FIXTURE,END_FIXTURE,providerPreferences,[])).rejects.toThrow(/not been connected/);
    await expect(boundedProviderResponse(new Response('x'.repeat(1000)),100)).rejects.toThrow(/too large/);
  });
});
