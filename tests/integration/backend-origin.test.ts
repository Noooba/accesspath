import { describe, expect, it } from 'vitest';
import { requireSameOrigin } from '@/lib/security/http';

describe('Mutation origin checks', () => {
  it('accepts a browser-visible loopback Host when Next normalizes its internal URL', () => {
    const request = new Request('http://localhost:3060/api/reports', { headers: { host: '127.0.0.1:3060', origin: 'http://127.0.0.1:3060', 'sec-fetch-site': 'same-origin' } });
    expect(() => requireSameOrigin(request)).not.toThrow();
  });
  it('accepts a normal localhost browser origin', () => {
    const request = new Request('http://localhost:3060/api/reports', { headers: { host: 'localhost:3060', origin: 'http://localhost:3060' } });
    expect(() => requireSameOrigin(request)).not.toThrow();
  });
  it('rejects another origin even when it supplies a matching forwarded host', () => {
    const request = new Request('http://localhost:3060/api/reports', { headers: { host: '127.0.0.1:3060', origin: 'https://attacker.example', 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' } });
    expect(() => requireSameOrigin(request)).toThrow('Requests must come from this application.');
  });
  it('does not accept the internal localhost origin when the actual Host is different', () => {
    const request = new Request('http://localhost:3060/api/reports', { headers: { host: '127.0.0.1:3060', origin: 'http://localhost:3060' } });
    expect(() => requireSameOrigin(request)).toThrow();
  });
  it('rejects a scheme mismatch and a cross-site fetch signal', () => {
    expect(() => requireSameOrigin(new Request('http://localhost:3060/api/reports', { headers: { host: 'localhost:3060', origin: 'https://localhost:3060' } }))).toThrow();
    expect(() => requireSameOrigin(new Request('http://localhost:3060/api/reports', { headers: { host: 'localhost:3060', origin: 'http://localhost:3060', 'sec-fetch-site': 'cross-site' } }))).toThrow();
  });
  it('allows non-browser API requests without an Origin but rejects cross-site metadata', () => {
    expect(() => requireSameOrigin(new Request('http://localhost/api/reports'))).not.toThrow();
    expect(() => requireSameOrigin(new Request('http://localhost/api/reports', { headers: { 'sec-fetch-site': 'cross-site' } }))).toThrow();
  });
});
