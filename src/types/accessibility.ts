import type { LatLon } from './live-routing';

export type AccessPreferences = {
  avoidRamps: boolean;
  maxSlopePercent: number;
  minWidthCm: number;
  maxKerbCm: number;
  requireKnownAccess: boolean;
};
export const DEFAULT_ACCESS_PREFERENCES: AccessPreferences = { avoidRamps: false, maxSlopePercent: 8, minWidthCm: 90, maxKerbCm: 2, requireKnownAccess: false };
export type AccessSummary = {
  source: 'OpenStreetMap';
  checkedSegments: number;
  excludedSegments: number;
  rampSegments: number;
  unknownSegments: number;
  reviewedObstaclesAvoided: number;
  pendingReportsNearby: number;
  preferences: AccessPreferences;
};
export type WorldObstacle = LatLon & {
  id: string;
  kind: 'world';
  category: string;
  description: string;
  radiusMeters: number;
  reportedAt: string;
  expiresAt: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  moderatorNotes: string;
};
