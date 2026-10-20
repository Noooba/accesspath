import { listReports } from '@/lib/database/repository';
import { requireAdmin } from '@/lib/security/admin';
import { worldReports } from '@/lib/world-obstacles';
import { errorResponse, json } from '@/lib/security/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { await requireAdmin(request); return json({ reports: [...await listReports(undefined, true), ...await worldReports(undefined,true)], authenticated: true }); }
  catch (error) { return errorResponse(error); }
}
