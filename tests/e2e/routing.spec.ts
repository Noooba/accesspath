import { test, expect } from '@playwright/test';
import { capture, openExplorer, routePanel, selectMode, selectScenario, showPreferences } from './helpers';

test('compares actual shortest and documented demo geometry', async ({ page }) => {
  await openExplorer(page);
  await expect(routePanel(page).getByText('100%', { exact: true })).toBeVisible();
  await expect(routePanel(page).getByText('Demo step-free rules satisfied', { exact: true })).toBeVisible();
  await expect(routePanel(page).locator('.itinerary li')).toHaveCount(5);
  await selectMode(page, 'Shortest walk');
  await expect(routePanel(page).locator('.result-distance')).toHaveText('168m');
  await expect(routePanel(page).getByText('Stairs / steps', { exact: true })).toBeVisible();
  await expect(routePanel(page).locator('.itinerary li')).toHaveCount(2);
  await selectMode(page, 'Confirmed step-free');
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await capture(page, 'explorer-desktop');
});

test('reroutes the library walkway closure through the open courtyard', async ({ page }) => {
  await openExplorer(page);
  await selectScenario(page, 'closure');
  await expect(routePanel(page).locator('.result-distance')).toHaveText('196m');
  await expect(routePanel(page).locator('.itinerary').getByText('Student center', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Inspect a pathway', exact: true }).selectOption('upper-library-walk');
  await expect(page.locator('.path-inspector').getByText('blocked', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset simulation' }).click();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
});

test('withholds uncertain confirmation and explains the exploratory 80% documentation coverage', async ({ page }) => {
  await openExplorer(page);
  await selectScenario(page, 'uncertain');
  await expect(routePanel(page).getByRole('heading', { name: 'No confirmed step-free route is available with the current data.' })).toBeVisible();
  await page.getByRole('button', { name: 'View an unverified option' }).click();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await expect(routePanel(page).getByText('80%', { exact: true })).toBeVisible();
  await expect(routePanel(page).getByText('Step-free status unknown', { exact: true }).first()).toBeVisible();
  await expect(routePanel(page).getByText('Width unknown', { exact: true })).toBeVisible();
  await expect(routePanel(page).locator('.route-warning')).toContainText('unverified');
  await capture(page, 'exploratory-unknowns');
  await showPreferences(page);
  await page.getByRole('checkbox', { name: 'Require documented details', exact: true }).check();
  await expect(routePanel(page).getByRole('heading', { name: 'No available route matches these preferences.' })).toBeVisible();
});

test('never routes a disconnected destination through a closure in any mode', async ({ page, request }) => {
  await openExplorer(page);
  await selectScenario(page, 'disconnected');
  await expect(routePanel(page).getByText('No qualifying route', { exact: true })).toBeVisible();
  for (const mode of ['Shortest walk', 'Exploratory step-free'] as const) {
    await selectMode(page, mode);
    await expect(routePanel(page).getByRole('heading', { name: 'No available route matches these preferences.' })).toBeVisible();
    await expect(routePanel(page).locator('.result-distance')).toHaveCount(0);
  }
  const response = await request.post('/api/route', { data: { siteId: 'demo-campus', startId: 'main-gate', endId: 'library', mode: 'confirmed', scenarioId: 'disconnected', filters: { excludeBlocked: false, avoidStairs: false, requireDocumented: false } } });
  expect(response.ok()).toBe(true);
  expect((await response.json()).route).toMatchObject({ status: 'unreachable', edgeIds: [], distanceMeters: 0 });
  await capture(page, 'no-route-desktop');
});

test('supports identity routes, endpoint swaps and honest zero segment coverage', async ({ page }) => {
  await openExplorer(page);
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption('main-gate');
  await expect(routePanel(page).locator('.result-distance')).toHaveText('0m');
  await expect(routePanel(page).getByText('0%', { exact: true })).toBeVisible();
  await expect(routePanel(page).getByText('You are already at the selected destination.', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption('library');
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await page.getByRole('button', { name: 'Swap starting point and destination' }).click();
  await expect(page.getByRole('combobox', { name: 'Starting point', exact: true })).toHaveValue('library');
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toHaveValue('main-gate');
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
});

test('applies stairs and slope preferences to actual path calculations', async ({ page }) => {
  await openExplorer(page);
  await selectMode(page, 'Shortest walk');
  await showPreferences(page);
  const stairs = page.getByRole('checkbox', { name: 'Avoid stairs in shortest walk', exact: true });
  await stairs.check();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await stairs.uncheck();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('168m');
  await page.getByRole('checkbox', { name: 'Avoid known steep slopes', exact: true }).check();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await page.getByRole('spinbutton', { name: 'Maximum recorded slope' }).fill('0');
  await expect(routePanel(page).getByRole('heading', { name: 'No available route matches these preferences.' })).toBeVisible();
});

test('provides map alternatives, real pan/zoom controls and pathway details', async ({ page }) => {
  await openExplorer(page);
  const map = page.locator('.leaflet-map-pane');
  const before = await map.getAttribute('style');
  await page.getByRole('button', { name: 'Pan map east', exact: true }).click();
  await expect.poll(() => map.getAttribute('style')).not.toBe(before);
  const endpoint = page.locator('.leaflet-overlay-pane path[fill="#087f78"][stroke="#fff"]').first();
  const beforeZoom = await endpoint.getAttribute('d');
  await page.getByRole('button', { name: 'Zoom map in', exact: true }).click();
  await expect.poll(() => endpoint.getAttribute('d')).not.toBe(beforeZoom);
  const afterZoomIn = await endpoint.getAttribute('d');
  await page.getByRole('button', { name: 'Zoom map out', exact: true }).click();
  await expect.poll(() => endpoint.getAttribute('d')).not.toBe(afterZoomIn);
  await page.getByRole('button', { name: 'Fit demo campus in map' }).click();
  for (const label of ['Zoom map in', 'Zoom map out', 'Pan map east', 'Pan map west', 'Pan map north', 'Pan map south']) {
    const bounds = await page.getByRole('button', { name: label, exact: true }).boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('combobox', { name: 'Inspect a pathway', exact: true }).selectOption('stair-flight');
  await expect(page.locator('.path-inspector').getByText('not-step-free', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close pathway details' }).click();
  await page.getByTitle('Stair segment', { exact: true }).click();
  await expect(page.getByText('Pathway details', { exact: true })).toBeVisible();
  // Leaflet draws endpoint CircleMarkers as SVG paths; exercise the actual node hit target.
  await endpoint.click();
  await expect(page.locator('.node-inspector').getByText('Main gate', { exact: true })).toBeVisible();
  await expect(page.locator('.node-inspector').getByRole('button', { name: 'Start here', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close place details', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Overlay comparison', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Overlay comparison', exact: true })).toBeChecked();
});

test('refuses to invent locations or routes for the unverified potential pilot', async ({ page, request }) => {
  await openExplorer(page);
  await page.getByRole('combobox', { name: 'Supported site', exact: true }).selectOption('palos-verdes-potential-pilot');
  await expect(page.getByRole('heading', { name: 'Good data comes before a route.' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Starting point', exact: true })).toBeDisabled();
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  const graph = await (await request.get('/api/sites/palos-verdes-potential-pilot/graph')).json();
  expect(graph.nodes).toEqual([]); expect(graph.edges).toEqual([]);
  expect(graph.site).toMatchObject({ isDemo: false, verificationStatus: 'unverified' });
  await page.getByRole('button', { name: 'Explore the synthetic campus', exact: false }).click();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
});
