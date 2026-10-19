import { createHash, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { NextResponse } from 'next/server';
import { HttpError } from './http';

const COOKIE = 'accesspath-admin';
const SESSION_SECONDS = 60 * 60;
function credentials() {
  const key = process.env.ADMIN_KEY;
  const secret = process.env.SESSION_SECRET;
  if (!key || key.length < 32 || !secret || secret.length < 32) throw new HttpError(503, 'ADMIN_UNCONFIGURED', 'Administrator access is not configured on this deployment.');
  return { key, secret: new TextEncoder().encode(secret) };
}
export function adminConfigured() {
  return Boolean(process.env.ADMIN_KEY && process.env.ADMIN_KEY.length >= 32 && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32);
}
export async function createAdminSession(submittedKey: string) {
  const { key, secret } = credentials();
  const actual = createHash('sha256').update(key).digest();
  const provided = createHash('sha256').update(submittedKey).digest();
  if (!timingSafeEqual(actual, provided)) throw new HttpError(401, 'INVALID_CREDENTIALS', 'The administrator key was not accepted.');
  return new SignJWT({ role: 'moderator' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setIssuer('accesspath').setAudience('accesspath-admin').setExpirationTime(`${SESSION_SECONDS}s`).sign(secret);
}
export async function requireAdmin(request: Request) {
  const { secret } = credentials();
  const token = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in to review reports.');
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], issuer: 'accesspath', audience: 'accesspath-admin' });
    if (payload.role !== 'moderator') throw new Error('Invalid role');
  } catch { throw new HttpError(401, 'UNAUTHORIZED', 'Your administrator session is invalid or expired.'); }
}
export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL), path: '/', maxAge: SESSION_SECONDS });
}
export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL), path: '/', maxAge: 0 });
}
