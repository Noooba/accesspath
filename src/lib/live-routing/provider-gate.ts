import { readyDatabase } from '@/lib/database/repository';
import { StorageUnavailableError } from '@/lib/database/client';
import { HttpError } from '@/lib/security/http';

export type LiveProvider = 'photon' | 'foot-router';
export const PROVIDER_INTERVAL_MS = 1100;
/** Atomic across application instances sharing the database. No query/location is persisted. */
export async function acquireProviderSlot(provider: LiveProvider) {
  try {
    const { client } = await readyDatabase();
    const result = await client.execute({
      // The database clock, rather than separate function-instance clocks,
      // decides the interval when multiple servers use the same database.
      sql: "INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)+?) ON CONFLICT(bucket) DO UPDATE SET hits=rate_limits.hits+1,expires_at=excluded.expires_at WHERE rate_limits.expires_at<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) RETURNING expires_at",
      args: [`live-provider:${provider}`, PROVIDER_INTERVAL_MS],
    });
    if (result.rows.length === 0) throw new HttpError(429, 'LIVE_PROVIDER_BUSY', 'The shared map service is busy. Wait a moment, then submit again.');
  } catch (error) {
    if (error instanceof StorageUnavailableError) throw new HttpError(503, 'LIVE_RATE_GATE_UNAVAILABLE', 'Live map requests require configured persistent storage for the shared provider request limit.');
    throw error;
  }
}
