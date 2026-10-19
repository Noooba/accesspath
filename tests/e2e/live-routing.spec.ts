import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { capture, expectNoHorizontalOverflow } from './helpers';
import { END_FIXTURE, FIXTURE_WARNING, installLiveFixtures, START_FIXTURE, type LiveFixtureState } from './live-fixtures';

const result = (page: Page) => page.locator('.real-result');
const startPicker = (page: Page) => page.locator('.real-place-picker').nth(0);
const endPicker = (page: Page) => page.locator('.real-place-picker').nth(1);
const calculate = (page: Page) => page.getByRole('button', { name: 'Calculate walking route', exact: true });
const base = () => test.info().project.use.baseURL ?? 'http://127.0.0.1:3060';

async function openPlanner(page: Page, state?: Partial<LiveFixtureState>) {
  const fixture = await installLiveFixtures(page, base(), state);
  await page.goto('/routes');
  await expect(page.getByRole('heading', { name: 'Find a real-world walking route.' })).toBeVisible();
  await expect(page.locator('.real-map')).toBeVisible();
  return fixture;
}
async function choosePlaces(page: Page, fixture: LiveFixtureState) {
  await page.getByRole('textbox', { name: 'Starting place', exact: true }).fill('fixture start');
  expect(fixture.searchQueries).toEqual([]);
  await page.getByRole('button', { name: 'Search starting places', exact: true }).click();
  await page.getByRole('list', { name: 'Starting place search results', exact: true }).getByRole('button', { name: START_FIXTURE.label, exact: true }).click();
  await page.getByRole('textbox', { name: 'Destination place', exact: true }).fill('fixture destination');
  await page.getByRole('button', { name: 'Search destination places', exact: true }).click();
  await page.getByRole('list', { name: 'Destination place search results', exact: true }).getByRole('button', { name: END_FIXTURE.label, exact: true }).click();
  expect(fixture.searchQueries).toEqual(['fixture start', 'fixture destination']);
}
async function getRoute(page: Page) {
  await calculate(page).click();
  await expect(result(page).locator('.real-result-summary h2')).toHaveText('704 m');
}

test('manually searches places and displays provider geometry, measurements and unverified walking directions', async ({ page }) => {
  const fixture = await openPlanner(page);
  await expect(calculate(page)).toBeDisabled();
  await expect(page.getByText('Walking directions · accessibility unverified', { exact: true })).toBeVisible();
  await choosePlaces(page, fixture);
  expect(fixture.routeRequests).toEqual([]);
  await getRoute(page);
  expect(fixture.routeRequests).toEqual([{ start: { lat: START_FIXTURE.lat, lon: START_FIXTURE.lon }, end: { lat: END_FIXTURE.lat, lon: END_FIXTURE.lon } }]);
  await expect(result(page).getByText('Ordinary walking route', { exact: true })).toBeVisible();
  await expect(result(page).getByText('Accessibility unverified', { exact: true })).toBeVisible();
  await expect(result(page).locator('.real-result-summary')).toContainText('10 min');
  await expect(result(page).getByText(FIXTURE_WARNING, { exact: true })).toBeVisible();
  await expect(result(page).locator('.real-itinerary li')).toHaveCount(2);
  await expect(result(page).getByText('E2E fixture: continue along the recorded walking segment.', { exact: true })).toBeVisible();
  await expect(result(page).locator('.real-itinerary li').nth(0)).toContainText('482 m');
  const drawnRoute = page.locator('.real-map .leaflet-overlay-pane path[stroke="#087f78"]');
  await expect(drawnRoute).toHaveCount(1);
  expect((await drawnRoute.getAttribute('d'))?.match(/L/g)?.length).toBeGreaterThanOrEqual(2);
  expect(fixture.blockedExternalRequests).toEqual([]);
  await capture(page, 'live-routing-desktop-fixture');
});

test('builds an explicit Google Maps walking URL without opening or contacting Google', async ({ page }) => {
  const fixture = await openPlanner(page);
  await choosePlaces(page, fixture);
  const link = page.getByRole('link', { name: 'Open walking directions in Google Maps, opens in a new tab', exact: true });
  const url = new URL((await link.getAttribute('href'))!);
  expect(url.hostname).toBe('www.google.com');
  expect(url.pathname).toBe('/maps/dir/');
  expect(url.searchParams.get('api')).toBe('1');
  expect(url.searchParams.get('travelmode')).toBe('walking');
  expect(url.searchParams.get('origin')).toBe(`${START_FIXTURE.lat},${START_FIXTURE.lon}`);
  expect(url.searchParams.get('destination')).toBe(`${END_FIXTURE.lat},${END_FIXTURE.lon}`);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  expect(fixture.blockedExternalRequests).toEqual([]);
});

test('clears old directions when an endpoint changes or the selected places are swapped', async ({ page }) => {
  const fixture = await openPlanner(page);
  await choosePlaces(page, fixture);
  await getRoute(page);
  await page.getByRole('button', { name: 'Swap places', exact: true }).click();
  await expect(result(page)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Starting place', exact: true })).toHaveValue(END_FIXTURE.label);
  await expect(page.getByRole('textbox', { name: 'Destination place', exact: true })).toHaveValue(START_FIXTURE.label);
  await getRoute(page);
  expect(fixture.routeRequests.at(-1)).toEqual({ start: { lat: END_FIXTURE.lat, lon: END_FIXTURE.lon }, end: { lat: START_FIXTURE.lat, lon: START_FIXTURE.lon } });
  await page.getByRole('textbox', { name: 'Starting place', exact: true }).fill('edited endpoint draft');
  await expect(result(page)).toHaveCount(0);
  await expect(calculate(page)).toBeDisabled();
  expect(fixture.searchQueries).toHaveLength(2);
  await expect(page.getByRole('link', { name: 'Open walking directions in Google Maps, opens in a new tab', exact: true })).toHaveCount(0);
});

test('shows geocoder empty/error states and allows deliberate retry', async ({ page }) => {
  const fixture = await openPlanner(page, { emptySearch: true });
  const input = page.getByRole('textbox', { name: 'Starting place', exact: true });
  await input.fill('no matching fixtures');
  await page.getByRole('button', { name: 'Search starting places', exact: true }).click();
  await expect(startPicker(page).locator('.real-search-results').getByRole('status')).toContainText('No matching places found.');
  await expect(calculate(page)).toBeDisabled();
  fixture.emptySearch = false; fixture.searchFailure = true;
  await input.fill('fixture start');
  await page.getByRole('button', { name: 'Search starting places', exact: true }).click();
  await expect(startPicker(page).getByRole('alert')).toContainText('place search is temporarily unavailable');
  fixture.searchFailure = false;
  await page.getByRole('button', { name: 'Search starting places', exact: true }).click();
  await page.getByRole('list', { name: 'Starting place search results', exact: true }).getByRole('button', { name: START_FIXTURE.label, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Starting place', exact: true })).toHaveValue(START_FIXTURE.label);
  expect(fixture.blockedExternalRequests).toEqual([]);
});

test('returns no fabricated result for unavailable or disconnected walking services', async ({ page }) => {
  const fixture = await openPlanner(page, { noRoute: true });
  await choosePlaces(page, fixture);
  await calculate(page).click();
  await expect(page.locator('.real-route-error')).toContainText('no walking connection was found');
  await expect(result(page)).toHaveCount(0);
  fixture.noRoute = false; fixture.routeFailure = true;
  await calculate(page).click();
  await expect(page.locator('.real-route-error')).toContainText('walking service is temporarily unavailable');
  await expect(result(page)).toHaveCount(0);
  await expect(calculate(page)).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Open walking directions in Google Maps, opens in a new tab', exact: true })).toBeVisible();
  fixture.routeFailure = false;
  await getRoute(page);
  await expect(page.locator('.real-route-error')).toHaveCount(0);
  expect(fixture.blockedExternalRequests).toEqual([]);
});

test('preserves written directions when street tiles fail', async ({ page }) => {
  const fixture = await openPlanner(page, { tilesUnavailable: true });
  await expect(page.locator('.real-service-note')).toContainText('Street tiles could not load.');
  await choosePlaces(page, fixture);
  await getRoute(page);
  await expect(result(page).locator('.real-itinerary li')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Open walking directions in Google Maps, opens in a new tab', exact: true })).toBeVisible();
  await capture(page, 'live-routing-tile-fallback-fixture');
});

test('supports coordinates without geocoding and updates coordinate editors after a swap', async ({ page }) => {
  const fixture = await openPlanner(page);
  for (const [picker, label, point] of [[startPicker(page), 'Starting place', START_FIXTURE], [endPicker(page), 'Destination place', END_FIXTURE]] as const) {
    await picker.getByText('Use coordinates', { exact: true }).click();
    await picker.getByRole('spinbutton', { name: `${label} latitude`, exact: true }).fill(String(point.lat));
    await picker.getByRole('spinbutton', { name: `${label} longitude`, exact: true }).fill(String(point.lon));
    await picker.getByRole('button', { name: 'Use this point', exact: false }).click();
  }
  expect(fixture.searchQueries).toEqual([]);
  await getRoute(page);
  await page.getByRole('button', { name: 'Swap places', exact: true }).click();
  await startPicker(page).getByText('Use coordinates', { exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Starting place latitude', exact: true })).toHaveValue(String(END_FIXTURE.lat));
  await expect(page.getByRole('spinbutton', { name: 'Starting place longitude', exact: true })).toHaveValue(String(END_FIXTURE.lon));
  await expect(result(page)).toHaveCount(0);
});

test('selects a genuine returned alternative and distinguishes an unrouted endpoint gap', async ({ page }) => {
  const fixture = await openPlanner(page, { alternatives: true, snapGap: true });
  await choosePlaces(page, fixture);
  await getRoute(page);
  await expect(page.getByRole('note')).toContainText('unrouted connection, not verified');
  await expect(result(page).getByText(/route starts 45 m from your start point/)).toBeVisible();
  const alternate = page.locator('.real-alternatives').getByRole('button', { name: /Alternative 1/ });
  await alternate.click();
  await expect(alternate).toHaveAttribute('aria-pressed', 'true');
  await expect(result(page).locator('.real-result-summary h2')).toHaveText('815 m');
  await expect(result(page).locator('.real-result-summary')).toContainText('13 min');
  await expect(result(page).getByText('E2E fixture: take the alternative walking segment.', { exact: true })).toBeVisible();
  expect(fixture.routeRequests).toHaveLength(1);
});

test('selects both endpoints on the map while map controls never pick unintended places', async ({ page }) => {
  const fixture = await openPlanner(page);
  await startPicker(page).getByRole('button', { name: 'Choose on map', exact: true }).click();
  await expect(startPicker(page).getByRole('button', { name: 'Choosing on map…', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Zoom street map in', 'Zoom street map out', 'Pan street map east']) {
    const control = page.getByRole('button', { name, exact: true });
    const box = await control.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    await control.click();
    await expect(page.getByRole('textbox', { name: 'Starting place', exact: true })).toHaveValue('');
  }
  const map = page.locator('.real-map');
  let box = await map.boundingBox();
  await map.click({ position: { x: box!.width * 0.35, y: box!.height * 0.6 } });
  await expect(page.getByRole('textbox', { name: 'Starting place', exact: true })).toHaveValue(/^Map point ·/);
  await endPicker(page).getByRole('button', { name: 'Choose on map', exact: true }).click();
  box = await map.boundingBox();
  await map.click({ position: { x: box!.width * 0.4, y: box!.height * 0.7 } });
  await expect(page.getByRole('textbox', { name: 'Destination place', exact: true })).toHaveValue(/^Map point ·/);
  await getRoute(page);
  expect(fixture.searchQueries).toEqual([]);
  expect(fixture.routeRequests).toHaveLength(1);
  expect(fixture.routeRequests[0].start).not.toEqual(fixture.routeRequests[0].end);
  for (const point of Object.values(fixture.routeRequests[0])) {
    expect(Number.isFinite(point.lat) && Number.isFinite(point.lon)).toBe(true);
  }
});

test('keeps out-of-Mercator coordinates intact and explains map coverage instead of moving a place', async ({ page }) => {
  const fixture = await openPlanner(page);
  const picker = startPicker(page);
  await picker.getByText('Use coordinates', { exact: true }).click();
  await picker.getByRole('spinbutton', { name: 'Starting place latitude', exact: true }).fill('86');
  await picker.getByRole('spinbutton', { name: 'Starting place longitude', exact: true }).fill('0');
  await picker.getByRole('button', { name: 'Use this point', exact: false }).click();
  await expect(page.locator('.real-map-coverage-notice')).toContainText('They have not been moved to fit.');
  await expect(page.getByRole('textbox', { name: 'Starting place', exact: true })).toHaveValue('Coordinates · 86.00000, 0.00000');
  expect(fixture.searchQueries).toEqual([]);
  expect(fixture.routeRequests).toEqual([]);
  await expect(calculate(page)).toBeDisabled();
});

test('keeps live-route controls keyboard accessible and responsive at desktop, tablet and mobile widths', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const fixture = await openPlanner(page);
  await page.getByRole('textbox', { name: 'Starting place', exact: true }).focus();
  await page.keyboard.type('fixture start');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: START_FIXTURE.label, exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Destination place', exact: true }).fill('fixture destination');
  await page.getByRole('button', { name: 'Search destination places', exact: true }).click();
  await page.getByRole('button', { name: END_FIXTURE.label, exact: true }).click();
  await getRoute(page);
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await expectNoHorizontalOverflow(page);
    await expect(calculate(page)).toBeVisible();
    for (const fill of ['#087f78', '#192b48']) {
      const endpoint = page.locator(`.real-map .leaflet-overlay-pane path[fill="${fill}"][stroke="#fff"]`);
      await expect.poll(async () => {
        const map = await page.locator('.real-map').boundingBox();
        const marker = await endpoint.boundingBox();
        if (!map || !marker || marker.width === 0 || marker.height === 0) return false;
        return marker.x >= map.x && marker.y >= map.y && marker.x + marker.width <= map.x + map.width && marker.y + marker.height <= map.y + map.height;
      }, { message: `Both selected endpoints must remain inside the ${name} map after resizing.` }).toBe(true);
    }
    await capture(page, `live-routing-${name}-fixture`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  expect(errors).toEqual([]);
  expect(fixture.blockedExternalRequests).toEqual([]);
});
