import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { capture, closeMobilePlanner, expectNoHorizontalOverflow, openExplorer, openPlannerIfCollapsed, routePanel, selectScenario } from './helpers';

test('supports keyboard navigation, visible focus and automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await openExplorer(page);
  await page.getByRole('combobox', { name: 'Starting point', exact: true }).focus();
  await expect(page.getByRole('combobox', { name: 'Starting point', exact: true })).toBeFocused();
  const focus = await page.getByRole('combobox', { name: 'Starting point', exact: true }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, boxShadow: style.boxShadow };
  });
  expect(focus.outlineStyle !== 'none' && parseFloat(focus.outlineWidth) > 0 || focus.boxShadow !== 'none').toBe(true);
  const explorerAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(explorerAudit.violations).toEqual([]);
  await page.goto('/report');
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeVisible();
  const reportAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(reportAudit.violations).toEqual([]);
});

test('renders desktop, tablet and mobile without horizontal overflow', async ({ page }) => {
  const exceptions: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => exceptions.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Find a path that works for you.', exact: false })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, `landing-${name}`);
    await openExplorer(page);
    await expectNoHorizontalOverflow(page);
    await capture(page, `explorer-${name}`);
    await selectScenario(page, 'disconnected');
    await expect(routePanel(page).getByText('No qualifying route', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, `no-route-${name}`);
    await page.goto('/report');
    await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, `report-${name}`);
  }
  expect(exceptions).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('keeps the planner usable with reduced motion and a narrow 320px reflow viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  await openExplorer(page);
  await expectNoHorizontalOverflow(page);
  await openPlannerIfCollapsed(page);
  await expect(page.getByRole('combobox', { name: 'Starting point', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calculate route', exact: false })).toBeEnabled();
  await closeMobilePlanner(page);
  await expect(page.getByRole('button', { name: 'Zoom map in', exact: true })).toBeVisible();
  const animated = await page.locator('.button, .map-loader').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { duration: style.animationDuration, transition: style.transitionDuration };
  }));
  expect(animated.every((item) => item.duration.split(',').every((value) => parseFloat(value) <= 0.01) && item.transition.split(',').every((value) => parseFloat(value) <= 0.01))).toBe(true);
  await capture(page, 'explorer-320-reduced-motion');
});

test('presents a recoverable routing error without fabricated results', async ({ page }) => {
  await page.route('**/api/route', (request) => request.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_UNAVAILABLE', message: 'Automated test: route service temporarily unavailable.' } }) }));
  await page.goto('/explore');
  await expect(routePanel(page).getByRole('heading', { name: 'We couldn’t calculate that route.' })).toBeVisible();
  await expect(routePanel(page).getByRole('alert')).toContainText('temporarily unavailable');
  await expect(routePanel(page).locator('.result-distance')).toHaveCount(0);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.unroute('**/api/route');
  await page.getByRole('button', { name: 'Calculate route', exact: false }).click();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
});

test('keeps explanatory navigation and the actual evidence dashboard available', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Community', exact: true }).click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(page.getByRole('status').filter({ hasText: 'Evidence loaded:' })).toContainText('26 synthetic locations and 42 synthetic pathway segments');
  const evidence = await (await request.get('/api/evidence')).json();
  expect(evidence).toMatchObject({ nodes: 26, edges: 42, storage: { available: true, persistent: true, mode: 'local-sqlite' } });
  await page.getByRole('link', { name: 'Accessibility', exact: true }).click();
  await expect(page).toHaveURL(/\/accessibility$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('recovers an unavailable graph request without an infinite spinner', async ({ page }) => {
  await page.route('**/api/sites/demo-campus/graph', (request) => request.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_UNAVAILABLE', message: 'Automated test: graph data is unavailable.' } }) }));
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Site information is unavailable.' })).toBeVisible();
  await expect(page.locator('main').getByRole('alert')).toContainText('graph data is unavailable');
  await expect(page.locator('.result-distance')).toHaveCount(0);
  await page.unroute('**/api/sites/demo-campus/graph');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
});

test('collapses route details and keeps the mobile navigation keyboard accessible', async ({ page }) => {
  await openExplorer(page);
  await page.getByRole('button', { name: 'Hide route details', exact: true }).click();
  await expect(routePanel(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show route details', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Show route details', exact: true }).click();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await page.setViewportSize({ width: 390, height: 844 });
  const planner = page.getByRole('button', { name: 'Plan your route', exact: true });
  await planner.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close route planner', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await capture(page, 'mobile-route-planner', false);
  await page.getByRole('combobox', { name: 'Starting point', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(planner).toHaveAttribute('aria-expanded', 'false');
  await expect(planner).toBeFocused();
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Find your way.', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link')).toHaveCount(9);
  await expect(drawer.getByRole('link', { name: 'Saved routes', exact: true })).toBeVisible();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Tab');
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  const menuAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(menuAudit.violations).toEqual([]);
  await capture(page, 'mobile-navigation', false);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Community & evidence', exact: true }).click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
