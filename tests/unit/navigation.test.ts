import { describe, expect, it } from 'vitest';
import { distanceMetres, reliableFix, routeProgress, segmentProjection } from '@/lib/navigation';
import { googleDirections } from '@/lib/live-links';
import { walkingFixture,START_FIXTURE,END_FIXTURE } from '../e2e/live-fixtures';
describe('foreground navigation geometry and privacy boundaries',()=>{
  it('advances through the actual route geometry and decreases remaining distance',()=>{
    const route=walkingFixture().routes[0],start=routeProgress(START_FIXTURE,route),end=routeProgress(END_FIXTURE,route);
    expect(start.remainingMeters).toBeCloseTo(route.distanceMeters);expect(end.remainingMeters).toBeCloseTo(0);expect(end.stepIndex).toBe(1);
    expect(routeProgress({lat:34,lon:-118},route).distanceFromRoute).toBeGreaterThan(100);
  });
  it('calculates distance to a segment rather than just to its endpoint',()=>{
    expect(segmentProjection({lat:0,lon:.001},{lat:0,lon:0},{lat:0,lon:.002})).toMatchObject({fraction:.5,distance:0});
    expect(distanceMetres({lat:0,lon:0},{lat:0,lon:.001})).toBeCloseTo(111.195,2);
  });
  it('does not trust old, future, impossible or imprecise position fixes',()=>{
    const now=100000,fix={lat:33,lon:-118,accuracy:10,timestamp:now};
    expect(reliableFix(fix,now)).toBe(true);
    for(const invalid of [{...fix,accuracy:100},{...fix,timestamp:now-16000},{...fix,timestamp:now+6000},{...fix,lat:91},{...fix,accuracy:NaN}]) expect(reliableFix(invalid,now)).toBe(false);
  });
  it.each(['walking','driving','bicycling','transit'] as const)('creates an actual %s provider handoff',mode=>{
    const url=new URL(googleDirections(START_FIXTURE,END_FIXTURE,mode));expect(url.hostname).toBe('www.google.com');expect(url.searchParams.get('travelmode')).toBe(mode);expect(url.searchParams.get('api')).toBe('1');
  });
});
