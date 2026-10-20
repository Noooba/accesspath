import { HttpError } from '@/lib/security/http';

export const PROVIDER_TIMEOUT_MS = 12_000;
export const MAX_UPSTREAM_BYTES = 4 * 1024 * 1024;
/** Only operator-configured HTTPS bases are supported; request bodies cannot supply URLs. */
export function providerBase(provider: 'photon' | 'foot-router' | 'overpass') {
  const configured = provider === 'overpass' ? process.env.OVERPASS_API_URL || 'https://overpass.private.coffee/api/interpreter' : provider === 'photon' ? process.env.PHOTON_API_URL || 'https://photon.komoot.io/api/' : process.env.FOOT_ROUTER_URL || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new HttpError(503, 'LIVE_PROVIDER_CONFIG', 'The map provider configuration is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || /^\[|^\d+(\.\d+){3}$/.test(url.hostname)) throw new HttpError(503, 'LIVE_PROVIDER_CONFIG', 'Configure a public HTTPS map provider without credentials or query parameters.');
  // The default is a foot-profile dataset. A custom endpoint must explicitly retain
  // the foot profile; OSRM's profile string alone cannot turn car data into walking data.
  if (provider === 'foot-router' && !url.pathname.endsWith('/foot/')) throw new HttpError(503, 'LIVE_PROVIDER_CONFIG', 'The configured OSRM endpoint must use an explicitly deployed foot profile.');
  return url;
}
export async function providerJson(url: URL, options: { allowClientError?: boolean; maxBytes?: number; timeoutMs?: number; formBody?: string } = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', redirect: 'error', ...(options.formBody?{method:'POST',body:options.formBody}:{}),headers: { Accept: 'application/json',...(options.formBody?{'Content-Type':'application/x-www-form-urlencoded'}:{}),'User-Agent': process.env.LIVE_PROVIDER_USER_AGENT || 'AccessPath/0.2 (+https://accesspath-alpha.vercel.app; low-volume opt-in walking guidance)' } });
    if (response.status === 429) throw new HttpError(429, 'LIVE_UPSTREAM_LIMIT', 'The public map provider is limiting requests. Please try again later.');
    if (!response.ok && !(options.allowClientError && response.status === 400)) throw new HttpError(502, 'LIVE_PROVIDER_UNAVAILABLE', 'The public map service is unavailable. Try again later.');
    const limit = options.maxBytes ?? MAX_UPSTREAM_BYTES;
    if (Number(response.headers.get('content-length') || '0') > limit) throw new HttpError(502, 'LIVE_RESPONSE_TOO_LARGE', 'The map provider returned too much data. Choose a shorter route or more specific place.');
    const reader = response.body?.getReader();
    if (!reader) throw new HttpError(502, 'LIVE_MALFORMED_RESPONSE', 'The map provider returned an empty response.');
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) { await reader.cancel(); throw new HttpError(502, 'LIVE_RESPONSE_TOO_LARGE', 'The map provider returned too much data. Choose a shorter route or more specific place.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new HttpError(502, 'LIVE_MALFORMED_RESPONSE', 'The map provider returned invalid JSON.'); }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) throw new HttpError(504, 'LIVE_PROVIDER_TIMEOUT', 'The map provider took too long to respond. Try again later.');
    throw new HttpError(502, 'LIVE_PROVIDER_UNAVAILABLE', 'Could not reach the public map provider. Please try again later.');
  } finally { clearTimeout(timeout); }
}
