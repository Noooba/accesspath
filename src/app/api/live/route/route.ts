import { boundedJson, errorResponse, HttpError, json, requireSameOrigin } from '@/lib/security/http';
import { liveRouteInput } from '@/lib/live-routing/validation';
import { walkingRoutes } from '@/lib/live-routing/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = liveRouteInput.safeParse(await boundedJson(request, 2048));
    if (!input.success) throw new HttpError(400, 'INVALID_WALKING_ROUTE', 'Choose two different valid map locations.');
    return json(await walkingRoutes(input.data.start, input.data.end));
  } catch (error) { return errorResponse(error); }
}
