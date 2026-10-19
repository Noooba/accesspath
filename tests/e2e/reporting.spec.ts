import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { capture } from './helpers';

const observation = (purpose: string) => `E2E synthetic demonstration only: ${purpose} ${randomUUID()}`;
const reportData = (description: string, edgeId = 'upper-library-walk') => ({ siteId: 'demo-campus', edgeId, category: 'blocked-path', description });

test('saves a public report as pending, preserves its receipt on reload and rejects duplicates', async ({ page }) => {
  const description = observation('persistence check');
  await page.goto('/report?site=demo-campus&edge=upper-library-walk');
  await expect(page.getByRole('combobox', { name: /^Pathway segment/ })).toHaveValue('upper-library-walk');
  await page.getByRole('combobox', { name: /^Barrier category/ }).selectOption('blocked-path');
  await page.getByRole('textbox', { name: /^What did you notice/ }).fill(description);
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your report is on the record.' })).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('receipt');
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const reports = await (await page.request.get('/api/reports?siteId=demo-campus')).json();
  expect(reports.reports.filter((item: { description: string }) => item.description === description)).toHaveLength(1);
  expect(reports.reports.find((item: { id: string }) => item.id === id)).toMatchObject({ reviewStatus: 'pending', reviewedAt: null, moderatorNotes: '' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your report is on the record.' })).toBeVisible();
  await expect(page.locator('.receipt')).toContainText(id!);
  const duplicate = await page.request.post('/api/reports', { data: reportData(description) });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).error.code).toBe('DUPLICATE_REPORT');
  await capture(page, 'report-receipt-desktop');
});

test('rejects invalid and cross-origin reports while ignoring forged public verification claims', async ({ request }) => {
  const before = await (await request.get('/api/sites/demo-campus/graph')).json();
  const malformed = await request.post('/api/reports', { data: reportData('x'.repeat(801)) });
  expect(malformed.status()).toBe(400);
  const html = await request.post('/api/reports', { data: reportData('<script>alert(1)</script>') });
  expect(html.status()).toBe(400);
  const foreign = await request.post('/api/reports', { headers: { Origin: 'https://outside.invalid' }, data: reportData(observation('cross-origin rejection')) });
  expect(foreign.status()).toBe(403);
  const forged = await request.post('/api/reports', { data: { ...reportData(observation('untrusted extras ignored')), reviewStatus: 'approved', verificationStatus: 'verified', operationalStatus: 'blocked', moderatorNotes: 'Forged note must be ignored' } });
  expect(forged.status()).toBe(201);
  expect((await forged.json()).report).toMatchObject({ reviewStatus: 'pending', moderatorNotes: '', reviewedAt: null });
  const after = await (await request.get('/api/sites/demo-campus/graph')).json();
  expect(after.edges).toEqual(before.edges);
});

test('accepts the explicitly optional description without inventing an observation', async ({ page }) => {
  await page.goto('/report?site=demo-campus&edge=cafe-arts');
  await expect(page.getByRole('combobox', { name: /^Pathway segment/ })).toHaveValue('cafe-arts');
  await page.getByRole('combobox', { name: /^Barrier category/ }).selectOption('other');
  await expect(page.getByRole('textbox', { name: /^What did you notice/ })).toHaveValue('');
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your report is on the record.' })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('receipt');
  const reports = await (await page.request.get('/api/reports?siteId=demo-campus')).json();
  expect(reports.reports.find((report: { id: string }) => report.id === id)).toMatchObject({ description: '', reviewStatus: 'pending' });
});

test('protects moderator APIs and reports invalid sign-in clearly', async ({ page, request }) => {
  expect((await request.get('/api/admin/reports')).status()).toBe(401);
  expect((await request.patch('/api/admin/reports/nonexistent', { data: { reviewStatus: 'approved', moderatorNotes: '' } })).status()).toBe(401);
  await page.goto('/admin');
  await page.getByLabel('Moderator key', { exact: true }).fill('intentionally-invalid-demo-key-for-e2e-only');
  await page.getByRole('button', { name: 'Sign in to review', exact: false }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('not accepted');
  await expect(page.getByRole('heading', { name: 'Review with responsibility.' })).toBeVisible();
});

test('authenticates a moderator, approves an explicit closure, restores it and rejects a separate report', async ({ page }) => {
  const key = process.env.ACCESSPATH_E2E_ADMIN_KEY;
  if (!key) throw new Error('Moderator browser testing requires the isolated server. Run with ACCESSPATH_E2E_START_SERVER=1 or supply a dedicated ACCESSPATH_E2E_ADMIN_KEY.');
  const approveDescription = observation('moderator approval and explicit temporary operation change');
  const rejectDescription = observation('moderator rejection leaves geometry unchanged');
  const firstResponse = await page.request.post('/api/reports', { data: reportData(approveDescription) });
  expect(firstResponse.status()).toBe(201);
  const first = (await firstResponse.json()).report as { id: string };
  const secondResponse = await page.request.post('/api/reports', { data: reportData(rejectDescription, 'gate-plaza') });
  expect(secondResponse.status()).toBe(201);
  const second = (await secondResponse.json()).report as { id: string };
  await page.goto('/admin');
  await page.getByLabel('Moderator key', { exact: true }).fill(key);
  await page.getByRole('button', { name: 'Sign in to review', exact: false }).click();
  await expect(page.getByText('Authenticated review session', { exact: true })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'accesspath-admin')).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
  try {
    const item = page.locator('article.review-item').filter({ hasText: approveDescription });
    await item.getByLabel(/^Moderator notes/).fill('Automated synthetic workflow verification; not a real observation.');
    await item.getByRole('combobox', { name: 'Explicit pathway operational update', exact: true }).selectOption('blocked');
    await item.getByRole('button', { name: 'Approve report', exact: true }).click();
    await expect(item).toHaveCount(0);
    const graph = await (await page.request.get('/api/sites/demo-campus/graph')).json();
    expect(graph.edges.find((edge: { id: string }) => edge.id === 'upper-library-walk')).toMatchObject({ operationalStatus: 'blocked', verificationStatus: 'demonstration', verifiedAt: null });
    const rerouted = await (await page.request.post('/api/route', { data: { siteId: 'demo-campus', startId: 'main-gate', endId: 'library', mode: 'confirmed' } })).json();
    expect(rerouted.route.edgeIds).not.toContain('upper-library-walk');
    expect(rerouted.route.distanceMeters).toBeCloseTo(195.96742656, 5);
    const rejectedItem = page.locator('article.review-item').filter({ hasText: rejectDescription });
    await rejectedItem.getByRole('button', { name: 'Reject report', exact: true }).click();
    await expect(rejectedItem).toHaveCount(0);
    // Browser fetch retains the browser's secure loopback-cookie treatment; APIRequestContext
    // does not necessarily send a Secure cookie on plain local HTTP.
    const reviewed = await page.evaluate(async () => {
      const response = await fetch('/api/admin/reports', { cache: 'no-store' });
      return { status: response.status, body: await response.json() };
    });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.reports.find((report: { id: string }) => report.id === first.id)).toMatchObject({ reviewStatus: 'approved' });
    expect(reviewed.body.reports.find((report: { id: string }) => report.id === second.id)).toMatchObject({ reviewStatus: 'rejected' });
  } finally {
    // Restore only the explicitly modified test edge, even if an assertion fails.
    const restoreStatus = await page.evaluate(async (id) => {
      const response = await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: 'approved', moderatorNotes: 'Automated synthetic test: original operational status restored.', operationalStatus: 'open' }) });
      return response.status;
    }, first.id);
    expect(restoreStatus).toBe(200);
  }
  await page.getByRole('button', { name: 'Sign out', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Review with responsibility.' })).toBeVisible();
  expect((await page.request.get('/api/admin/reports')).status()).toBe(401);
});
