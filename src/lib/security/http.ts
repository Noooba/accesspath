import { NextResponse } from 'next/server';
import { StorageUnavailableError } from '@/lib/database/client';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof StorageUnavailableError) return json({ error: { code: 'STORAGE_UNAVAILABLE', message: error.message } }, 503);
  console.error('AccessPath request failed:', error instanceof Error ? error.name : 'unknown');
  return json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed. Please try again.' } }, 500);
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    // Next can normalize a loopback request URL to localhost even when the
    // browser used 127.0.0.1. Host is the browser-visible authority; never trust
    // an arbitrary X-Forwarded-Host supplied by a client to bypass this check.
    const internal = new URL(request.url);
    const host = request.headers.get('host') || internal.host;
    const forwardedProtocol = process.env.VERCEL ? request.headers.get('x-forwarded-proto') : null;
    const protocol = forwardedProtocol === 'https' || forwardedProtocol === 'http' ? `${forwardedProtocol}:` : internal.protocol;
    let expectedOrigin = '';
    try { expectedOrigin = new URL(`${protocol}//${host}`).origin; } catch { /* Invalid authority fails closed below. */ }
    if (!expectedOrigin || origin !== expectedOrigin) throw new HttpError(403, 'ORIGIN_REJECTED', 'Requests must come from this application.');
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new HttpError(403, 'ORIGIN_REJECTED', 'Cross-site requests are not accepted.');
}
export async function boundedJson(request: Request, limit = 16384): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'JSON_REQUIRED', 'Send an application/json request.');
  if (Number(request.headers.get('content-length') || '0') > limit) throw new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_JSON', 'The request body is missing.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new HttpError(400, 'INVALID_JSON', 'The request is not valid JSON.'); }
  } finally { reader.releaseLock(); }
}
