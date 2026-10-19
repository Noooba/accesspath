import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, openExplorer, routePanel, selectMode, selectScenario } from './helpers';

test('Firefox renders the real graph and changes between mode and uncertainty states', async ({ page }) => {
  await openExplorer(page);
  await selectMode(page, 'Shortest walk');
  await expect(routePanel(page).locator('.result-distance')).toHaveText('168m');
  await selectMode(page, 'Confirmed step-free');
  await selectScenario(page, 'uncertain');
  await expect(routePanel(page).getByText('No qualifying route', { exact: true })).toBeVisible();
  await selectMode(page, 'Exploratory step-free');
  await expect(routePanel(page).getByText('80%', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Firefox supports mobile reflow and the protected moderator entry', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore routes', exact: false }).click();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await expectNoHorizontalOverflow(page);
  await page.goto('/admin');
  await expect(page.getByLabel('Moderator key', { exact: true })).toHaveAttribute('type', 'password');
  expect((await request.get('/api/admin/reports')).status()).toBe(401);
});
