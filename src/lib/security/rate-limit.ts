import { readyDatabase } from '@/lib/database/repository';
import { HttpError } from './http';

/** A conservative deployment-wide quota. No IP addresses or device identifiers are stored. */
export async function rateLimit(action: 'report' | 'login') {
  const { client } = await readyDatabase();
  const now = Date.now();
  const duration = action === 'login' ? 15 * 60_000 : 10 * 60_000;
  const maximum = action === 'login' ? 10 : 30;
  const bucket = `${action}:${Math.floor(now / duration)}`;
  const result = await client.execute({ sql: 'INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits', args: [bucket, now + duration] });
  await client.execute({ sql: 'DELETE FROM rate_limits WHERE expires_at < ?', args: [now] });
  if (Number(result.rows[0]?.hits) > maximum) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.');
}
