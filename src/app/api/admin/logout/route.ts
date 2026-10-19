import { clearAdminCookie } from '@/lib/security/admin';
import { errorResponse, json, requireSameOrigin } from '@/lib/security/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { requireSameOrigin(request); const response = json({ authenticated: false }); clearAdminCookie(response); return response; }
  catch (error) { return errorResponse(error); }
}
