import { expect, type Page } from '@playwright/test';

export const routePanel = (page: Page) => page.locator('aside.route-details');
export async function openPlannerIfCollapsed(page: Page) {
  const trigger = page.getByRole('button', { name: 'Plan your route', exact: true });
  if (await trigger.isVisible()) { await trigger.click(); return true; }
  return false;
}
export async function closeMobilePlanner(page: Page) {
  const close = page.getByRole('button', { name: 'Close route planner', exact: true });
  if (await close.isVisible()) await close.click();
}
export async function openExplorer(page: Page) {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Your route', exact: true })).toBeVisible();
  await expect(routePanel(page).locator('.result-distance')).toHaveText('193m');
  await expect(page.locator('.leaflet-container')).toBeVisible();
}
export async function selectMode(page: Page, mode: 'Shortest walk' | 'Confirmed step-free' | 'Exploratory step-free') {
  const opened = await openPlannerIfCollapsed(page);
  await page.getByRole('radio', { name: new RegExp(`^${mode}`) }).check();
  if (opened) await closeMobilePlanner(page);
}
export async function selectScenario(page: Page, value: 'baseline' | 'closure' | 'uncertain' | 'disconnected') {
  const opened = await openPlannerIfCollapsed(page);
  await page.getByRole('combobox', { name: 'Demo scenario', exact: true }).selectOption(value);
  if (opened) await closeMobilePlanner(page);
}
export async function showPreferences(page: Page) {
  const details = page.locator('details.filter-details');
  if (await details.getAttribute('open') === null) await page.getByText('Additional preferences', { exact: true }).click();
}
export async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
}
export async function capture(page: Page, filename: string, fullPage = true) {
  await page.screenshot({ path: `output/playwright/${filename}.png`, fullPage, animations: 'disabled' });
}
