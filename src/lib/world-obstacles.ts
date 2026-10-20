import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { readyDatabase } from './database/repository';
import type { WorldObstacle } from '@/types/accessibility';
import { latLon } from './live-routing/validation';

export const WORLD_CATEGORIES = ['blocked-path', 'stairs', 'damaged-surface', 'missing-curb-ramp', 'steep-slope', 'inaccessible-entrance', 'broken-lift', 'other'] as const;
export const worldReportInput = latLon.extend({
  category: z.enum(WORLD_CATEGORIES), radiusMeters: z.number().min(5).max(30).default(10),
  description: z.string().trim().max(800).refine(value => !/[<>\u0000-\u001f]/.test(value), 'Use plain text without personal details.').default(''),
  consentPublicLocation: z.literal(true), website: z.string().max(200).optional().default(''),
}).strict();
export const boundsInput = z.object({ south: z.coerce.number().min(-90).max(90), north: z.coerce.number().min(-90).max(90), west: z.coerce.number().min(-180).max(180), east: z.coerce.number().min(-180).max(180) }).refine(box => box.north >= box.south && box.east >= box.west && box.north - box.south <= .12 && box.east - box.west <= .18, 'Choose a smaller map area.');
export type Bounds = z.infer<typeof boundsInput>;
function convert(row: Record<string, unknown>, includeNotes = false): WorldObstacle {
  return { kind:'world', id:String(row.id), lat:Number(row.latitude), lon:Number(row.longitude), radiusMeters:Number(row.radius_meters), category:String(row.category), description:String(row.description), reportedAt:String(row.reported_at), expiresAt:String(row.expires_at), reviewStatus:row.review_status as WorldObstacle['reviewStatus'], reviewedAt:row.reviewed_at ? String(row.reviewed_at) : null, moderatorNotes:includeNotes ? String(row.moderator_notes) : '' };
}
export async function worldReports(bounds?: Bounds, includeNotes = false) {
  const {client} = await readyDatabase();
  const where = bounds ? 'WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? AND expires_at>?' : '';
  const result = await client.execute({sql:`SELECT * FROM world_reports ${where} ORDER BY reported_at DESC LIMIT 200`,args:bounds ? [bounds.south,bounds.north,bounds.west,bounds.east,new Date().toISOString()] : []});
  return result.rows.map(row => convert(row,includeNotes));
}
export async function findWorldReport(id: string, includeNotes = false) {
  const {client} = await readyDatabase();
  const result = await client.execute({sql:'SELECT * FROM world_reports WHERE id=?',args:[id]});
  return result.rows[0] ? convert(result.rows[0],includeNotes) : null;
}
export async function createWorldReport(input: z.infer<typeof worldReportInput>) {
  const {client} = await readyDatabase(), reportedAt = new Date().toISOString();
  const duplicateKey = createHash('sha256').update(JSON.stringify([input.lat.toFixed(5),input.lon.toFixed(5),input.category,input.description.toLowerCase(),reportedAt.slice(0,10)])).digest('hex');
  const id = `world-${randomUUID()}`, expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const created = await client.execute({sql:"INSERT INTO world_reports(id,latitude,longitude,radius_meters,category,description,reported_at,expires_at,duplicate_key) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(duplicate_key) DO NOTHING RETURNING id",args:[id,input.lat,input.lon,input.radiusMeters,input.category,input.description,reportedAt,expiresAt,duplicateKey]});
  return created.rows.length ? findWorldReport(id) : null;
}
export async function moderateWorldReport(id: string, input: {reviewStatus:'approved'|'rejected';moderatorNotes:string}) {
  const {client} = await readyDatabase();
  await client.execute({sql:'UPDATE world_reports SET review_status=?,moderator_notes=?,reviewed_at=? WHERE id=?',args:[input.reviewStatus,input.moderatorNotes,new Date().toISOString(),id]});
  return findWorldReport(id,true);
}
