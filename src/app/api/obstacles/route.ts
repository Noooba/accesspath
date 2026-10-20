import { boundedJson, errorResponse, HttpError, json, requireSameOrigin } from '@/lib/security/http';
import { boundsInput, createWorldReport, findWorldReport, worldReportInput, worldReports } from '@/lib/world-obstacles';
import { rateLimit } from '@/lib/security/rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, id=params.get('id');
    if (id) {
      if (!/^world-[0-9a-f-]{36}$/.test(id)) throw new HttpError(400,'INVALID_REFERENCE','Choose a valid report reference.');
      const report=await findWorldReport(id);
      if (!report) throw new HttpError(404,'REPORT_NOT_FOUND','This report could not be found.');
      return json({report});
    }
    const bounds=boundsInput.safeParse(Object.fromEntries(params));
    if(!bounds.success) throw new HttpError(400,'INVALID_AREA','Choose a valid local map area.');
    return json({reports:(await worldReports(bounds.data)).filter(report=>report.reviewStatus!=='rejected')});
  } catch(error) {return errorResponse(error);}
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input=worldReportInput.safeParse(await boundedJson(request,4096));
    if(!input.success || input.data.website) throw new HttpError(400,'INVALID_OBSTACLE','Choose a location and category, and confirm that the report location will be public.');
    await rateLimit('report');
    const report=await createWorldReport(input.data);
    if(!report) throw new HttpError(409,'DUPLICATE_REPORT','An identical report was already submitted today.');
    return json({report},201);
  } catch(error) {return errorResponse(error);}
}
