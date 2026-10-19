import { createAdminSession, setAdminCookie, adminConfigured } from '@/lib/security/admin';
import { boundedJson, errorResponse, HttpError, json, requireSameOrigin } from '@/lib/security/http';
import { rateLimit } from '@/lib/security/rate-limit';
import { loginInput } from '@/lib/validation/requests';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!adminConfigured()) throw new HttpError(503, 'ADMIN_UNCONFIGURED', 'Administrator access is not configured on this deployment.');
    const result = loginInput.safeParse(await boundedJson(request));
    if (!result.success) throw new HttpError(400, 'INVALID_INPUT', 'Enter an administrator key.');
    await rateLimit('login');
    const token = await createAdminSession(result.data.key);
    const response = json({ authenticated: true });
    setAdminCookie(response, token);
    return response;
  } catch (error) { return errorResponse(error); }
}
