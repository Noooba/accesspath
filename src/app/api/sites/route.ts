import { listSites } from '@/lib/database/repository';
import { getStorageStatus, StorageUnavailableError } from '@/lib/database/client';
import { errorResponse, json } from '@/lib/security/http';
import { SITES } from '@/data/demo-campus';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return json({ sites: await listSites(), storage: getStorageStatus() }); }
  catch (error) {
    if (error instanceof StorageUnavailableError) return json({ sites: SITES, storage: { ...getStorageStatus(), reason: error.message } });
    return errorResponse(error);
  }
}
