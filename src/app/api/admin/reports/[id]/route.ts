import { moderateReport } from '@/lib/database/repository';
import { requireAdmin } from '@/lib/security/admin';
import { boundedJson, errorResponse, HttpError, json, requireSameOrigin } from '@/lib/security/http';
import { moderationInput } from '@/lib/validation/requests';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    await requireAdmin(request);
    const result = moderationInput.safeParse(await boundedJson(request));
    if (!result.success) throw new HttpError(400, 'INVALID_REVIEW', 'Check the review fields.');
    if (result.data.operationalStatus && result.data.reviewStatus !== 'approved') throw new HttpError(400, 'INVALID_REVIEW', 'Only an approved report can explicitly change a path status.');
    const { id } = await context.params;
    const report = await moderateReport(id, result.data);
    if (!report) throw new HttpError(404, 'REPORT_NOT_FOUND', 'The report could not be found.');
    return json({ report });
  } catch (error) { return errorResponse(error); }
}
