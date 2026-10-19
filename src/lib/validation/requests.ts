import { z } from 'zod';

const identifier = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const plainText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum).refine((value) => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), 'Use plain text without HTML.');
export const reportInput = z.object({
  siteId: identifier, edgeId: identifier,
  category: z.enum(['blocked-path', 'stairs', 'damaged-surface', 'missing-curb-ramp', 'steep-slope', 'inaccessible-entrance', 'other']),
  description: plainText(0, 800).optional().default(''), website: z.string().max(200).optional().default(''),
});
export const routeInput = z.object({
  siteId: identifier, startId: identifier, endId: identifier,
  mode: z.enum(['shortest', 'confirmed', 'exploratory']),
  scenarioId: z.enum(['baseline', 'closure', 'uncertain', 'disconnected']).default('baseline'),
  filters: z.object({ avoidStairs: z.boolean().optional(), requireDocumented: z.boolean().optional(), avoidSteepSlopes: z.boolean().optional(), maxSlopePercent: z.number().finite().min(0).max(100).optional(), avoidUneven: z.boolean().optional(), excludeBlocked: z.boolean().optional() }).strict().optional(),
});
export const moderationInput = z.object({ reviewStatus: z.enum(['approved', 'rejected']), moderatorNotes: plainText(0, 800).default(''), operationalStatus: z.enum(['open', 'blocked', 'unknown']).optional() }).strict();
export const loginInput = z.object({ key: z.string().min(1).max(512) }).strict();
export const siteIdInput = identifier;
