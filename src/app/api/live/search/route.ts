import { boundedJson, errorResponse, HttpError, json, requireSameOrigin } from '@/lib/security/http';
import { placeSearchInput } from '@/lib/live-routing/validation';
import { searchPlaces } from '@/lib/live-routing/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = placeSearchInput.safeParse(await boundedJson(request, 2048));
    if (!input.success) throw new HttpError(400, 'INVALID_PLACE_QUERY', 'Enter a place name between 3 and 160 characters.');
    return json(await searchPlaces(input.data.query));
  } catch (error) { return errorResponse(error); }
}
