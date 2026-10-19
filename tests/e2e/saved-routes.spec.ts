import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { capture, expectNoHorizontalOverflow } from './helpers';
import { installLiveFixtures, START_FIXTURE, END_FIXTURE, walkingFixture } from './live-fixtures';

async function calculatedWalk(page: Page) {
  const fixture = await installLiveFixtures(page, test.info().project.use.baseURL!);
  await page.goto('/routes');
  for (const [label, query, place] of [['Starting place','fixture start',START_FIXTURE],['Destination place','fixture destination',END_FIXTURE]] as const) {
    await page.getByRole('textbox',{name:label,exact:true}).fill(query);
    await page.getByRole('button',{name:label==='Starting place'?'Search starting places':'Search destination places',exact:true}).click();
    await page.getByRole('button',{name:place.label,exact:true}).click();
  }
  await page.getByRole('button',{name:'Calculate walking route',exact:true}).click();
  await expect(page.locator('.real-result-summary h2')).toHaveText('704 m');
  return fixture;
}
async function save(page: Page, name='Morning walk') {
  await page.getByRole('button',{name:'Save route',exact:true}).click();
  await page.getByRole('textbox',{name:'Route name',exact:true}).fill(name);
  await page.getByRole('textbox',{name:'Tags, separated by commas',exact:true}).fill('Commute, quiet, commute');
  await page.getByRole('checkbox',{name:'Add to favorites',exact:true}).check();
  await page.getByRole('button',{name:'Save to library',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Route saved to this browser.'})).toBeVisible();
}
test('saves, reloads and reopens the original map without another provider request', async ({page}) => {
  const fixture = await calculatedWalk(page);
  await save(page);
  await page.goto('/saved');
  await expect(page.getByRole('heading',{name:'Morning walk',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Favorite Morning walk',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('list',{name:'Route tags'})).toHaveText('commutequiet');
  await page.reload();
  await page.getByRole('link',{name:'Open map',exact:true}).click();
  await expect(page.locator('.real-result-summary h2')).toHaveText('704 m');
  await expect(page.locator('.saved-snapshot')).toContainText('2026-10-17');
  await expect(page.locator('.real-itinerary')).toContainText('E2E fixture: continue');
  expect(fixture.routeRequests).toHaveLength(1);
  await page.reload();
  await expect(page.locator('.saved-snapshot')).toBeVisible();
  expect(fixture.routeRequests).toHaveLength(1);
});
test('edits, filters, favorites and removes routes with confirmation',async({page}) => {
  await calculatedWalk(page); await save(page); await page.goto('/saved');
  await page.getByRole('button',{name:'Edit Morning walk',exact:true}).click();
  await page.getByRole('textbox',{name:'Route name',exact:true}).fill('Library loop');
  await page.getByRole('textbox',{name:'Tags, separated by commas',exact:true}).fill('weekend, library');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.getByRole('searchbox').fill('missing');
  await expect(page.getByText('No routes match just yet.',{exact:true})).toBeVisible();
  await page.getByRole('searchbox').fill('library');
  await page.getByRole('combobox',{name:'Tag',exact:true}).selectOption('weekend');
  await expect(page.getByRole('heading',{name:'Library loop',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Favorite Library loop',exact:true}).click();
  await page.getByRole('button',{name:'Favorites',exact:true}).click();
  await expect(page.locator('.saved-card')).toHaveCount(0);
  await page.getByRole('button',{name:'Favorites',exact:true}).click();
  await page.getByRole('button',{name:'Remove Library loop',exact:true}).click();
  await page.getByRole('button',{name:'Keep route',exact:true}).click();
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Remove Library loop',exact:true}).click();
  await page.getByRole('button',{name:'Confirm removal',exact:true}).click();
  await page.reload(); await expect(page.locator('.saved-card')).toHaveCount(0);
});
test('selects the shortest returned walk rather than the first suggested route',async({page}) => {
  await calculatedWalk(page);
  await page.route('**/api/live/route', async route => {
    const body=walkingFixture(), shorter=structuredClone(body.routes[0]);
    shorter.id='shorter-fixture'; shorter.distanceMeters=410; shorter.durationSeconds=400;
    shorter.steps[0].instruction='E2E fixture: shorter returned alternative'; body.routes.push(shorter);
    await route.fulfill({json:body});
  });
  await page.getByRole('radio',{name:'Shortest available walk',exact:true}).check();
  await page.getByRole('button',{name:'Calculate walking route',exact:true}).click();
  await expect(page.locator('.real-result-summary h2')).toHaveText('410 m');
  await capture(page,'shortest-available-walk-desktop');
  await expect(page.locator('.real-itinerary')).toContainText('shorter returned alternative');
  await page.getByRole('radio',{name:'Suggested walk',exact:true}).check();
  await expect(page.locator('.real-result-summary h2')).toHaveText('704 m');
  await page.getByRole('radio',{name:'Shortest available walk',exact:true}).check();
  await expect(page.locator('.real-result-summary h2')).toHaveText('410 m');
});
test('restores saved campus endpoints, shortest mode and scenario',async({page}) => {
  await page.goto('/explore?mode=shortest');
  await expect(page.locator('.result-distance')).toHaveText('168m');
  await page.getByRole('combobox',{name:'Demo scenario',exact:true}).selectOption('closure');
  await expect(page.getByRole('button',{name:'Save route',exact:true})).toBeVisible();
  await save(page,'Campus shortcut'); await page.goto('/saved');
  await page.getByRole('link',{name:'Open map',exact:true}).click();
  await expect(page.getByRole('radio',{name:/^Shortest walk/})).toBeChecked();
  await expect(page.getByRole('combobox',{name:'Demo scenario',exact:true})).toHaveValue('closure');
  await expect(page.locator('.result-distance')).toBeVisible();
});
test('library reflows at desktop, tablet and mobile with keyboard focus and reduced motion',async({page}) => {
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await calculatedWalk(page); await save(page); await page.goto('/saved');
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const [name,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',375,844]] as const) {
    await page.setViewportSize({width,height}); await expectNoHorizontalOverflow(page);
    await page.getByRole('searchbox').focus(); await expect(page.getByRole('searchbox')).toBeFocused();
    await capture(page,`saved-routes-${name}`);
  }
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(audit.violations).toEqual([]); expect(errors).toEqual([]);
});
test('handles corrupt browser storage without replacing it',async({page}) => {
  await page.goto('/saved');
  await page.evaluate(()=>localStorage.setItem('accesspath.saved-routes.v1','broken'));
  await page.reload(); await expect(page.locator('.saved-error[role="alert"]')).toContainText('left untouched');
  expect(await page.evaluate(()=>localStorage.getItem('accesspath.saved-routes.v1'))).toBe('broken');
  await page.goto('/routes?saved=missing');
  await expect(page.getByRole('heading',{name:'Saved map unavailable.'})).toBeVisible();
});
test('does not claim a route was saved when storage is full or blocked',async({page}) => {
  await calculatedWalk(page);
  await page.evaluate(()=> { Storage.prototype.setItem = () => { throw new DOMException('Test storage quota','QuotaExceededError'); }; });
  await page.getByRole('button',{name:'Save route',exact:true}).click();
  await page.getByRole('button',{name:'Save to library',exact:true}).click();
  await expect(page.locator('.saved-editor [role="alert"]')).toContainText('full or blocked');
  await expect(page.getByText('Route saved to this browser.',{exact:false})).toHaveCount(0);
});
test('updates favorites across tabs in the same browser',async({page,context}) => {
  await calculatedWalk(page); await save(page); await page.goto('/saved');
  const other=await context.newPage(); await other.goto('/saved');
  await expect(other.getByRole('button',{name:'Favorite Morning walk',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Favorite Morning walk',exact:true}).click();
  await expect(other.getByRole('button',{name:'Favorite Morning walk',exact:true})).toHaveAttribute('aria-pressed','false');
  await other.close();
});
