import { createReport, listReports, loadGraph, reportEdgeExists } from '@/lib/database/repository';
import { boundedJson, errorResponse, HttpError, json, requireSameOrigin } from '@/lib/security/http';
import { rateLimit } from '@/lib/security/rate-limit';
import { reportInput, siteIdInput } from '@/lib/validation/requests';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const result = siteIdInput.safeParse(new URL(request.url).searchParams.get('siteId'));
    if (!result.success) throw new HttpError(400, 'INVALID_SITE', 'Choose a valid site.');
    if (!await loadGraph(result.data)) throw new HttpError(404, 'SITE_NOT_FOUND', 'This site could not be found.');
    return json({ reports: await listReports(result.data) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const result = reportInput.safeParse(await boundedJson(request));
    if (!result.success) throw new HttpError(400, 'INVALID_REPORT', result.error.issues[0]?.message || 'Check the report fields.');
    if (result.data.website) throw new HttpError(400, 'INVALID_REPORT', 'The report could not be accepted.');
    await rateLimit('report');
    const { siteId, edgeId, category, description } = result.data;
    const input = { siteId, edgeId, category, description };
    if (!await reportEdgeExists(input.siteId, input.edgeId)) throw new HttpError(400, 'INVALID_EDGE', 'The selected path does not belong to this site.');
    const report = await createReport(input);
    if (!report) throw new HttpError(409, 'DUPLICATE_REPORT', 'This report has already been submitted.');
    return json({ report }, 201);
  } catch (error) { return errorResponse(error); }
}
