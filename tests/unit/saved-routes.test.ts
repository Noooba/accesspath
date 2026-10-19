// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSavedRoutes, parseTags, SAVED_ROUTES_KEY, savedJourneySchema, shortestRouteIndex, writeSavedRoutes, type SavedRoute } from '../../src/lib/saved-routes';
import { walkingFixture, START_FIXTURE, END_FIXTURE } from '../e2e/live-fixtures';
const record = (): SavedRoute => ({ id: '4171b918-48b4-484a-bb3e-63d2b9ce4b41', name: 'Test walk', favorite: true, tags: ['commute'], savedAt: '2026-10-18T00:00:00.000Z', journey: {kind:'street', start:START_FIXTURE, end:END_FIXTURE, route:walkingFixture().routes[0], fetchedAt:walkingFixture().fetchedAt, preference:'shortest'} });
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe('personal route storage', () => {
  it('round trips the actual line, directions and metadata', () => {
    writeSavedRoutes(() => [record()]);
    expect(parseSavedRoutes(localStorage.getItem(SAVED_ROUTES_KEY))).toEqual({routes:[record()], error:''});
  });
  it('leaves corrupt or unsupported data untouched rather than overwriting it', () => {
    for (const raw of ['{broken', JSON.stringify({version:2,routes:[]}), JSON.stringify({version:1,routes:[{...record(),journey:{...record().journey, start:{...START_FIXTURE,lat:NaN}}}]})]) {
      localStorage.setItem(SAVED_ROUTES_KEY,raw);
      expect(parseSavedRoutes(raw).error).toBeTruthy();
      expect(() => writeSavedRoutes(() => [])).toThrow(/left untouched/);
      expect(localStorage.getItem(SAVED_ROUTES_KEY)).toBe(raw);
    }
  });
  it('does not report success when browser storage rejects writes', () => {
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new DOMException('Quota','QuotaExceededError'); });
    expect(() => writeSavedRoutes(() => [record()])).toThrow(/full or blocked/);
  });
  it('bounds the library and validates coordinates and geometry', () => {
    expect(() => writeSavedRoutes(() => Array.from({length:51}, () => record()))).toThrow(/50 routes/);
    const journey=record().journey;
    expect(savedJourneySchema.safeParse({...journey,start:{...START_FIXTURE,lat:91}}).success).toBe(false);
    if (journey.kind==='street') expect(savedJourneySchema.safeParse({...journey,route:{...journey.route,coordinates:[[33,-118]]}}).success).toBe(false);
  });
  it('normalizes, deduplicates and limits tags', () => {
    expect(parseTags(' Commute, SCHOOL, commute, ,quiet ')).toEqual(['commute','school','quiet']);
    expect(() => parseTags('a'.repeat(25))).toThrow(/24/);
    expect(() => parseTags('a,b,c,d,e,f,g,h,i')).toThrow(/8/);
  });
  it('chooses the actual minimum distance, preserving order for ties', () => {
    expect(shortestRouteIndex([{distanceMeters:704},{distanceMeters:500},{distanceMeters:600}])).toBe(1);
    expect(shortestRouteIndex([{distanceMeters:500},{distanceMeters:500}])).toBe(0);
    expect(shortestRouteIndex([{distanceMeters:704}])).toBe(0);
  });
});
