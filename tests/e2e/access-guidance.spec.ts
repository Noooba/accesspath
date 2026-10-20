import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { installLiveFixtures,START_FIXTURE,END_FIXTURE,walkingFixture } from './live-fixtures';
import { capture,expectNoHorizontalOverflow } from './helpers';
import { DEFAULT_ACCESS_PREFERENCES } from '../../src/types/accessibility';
const base=()=>test.info().project.use.baseURL!;
async function places(page:Page) {
  for(const [label,query,place] of [['Starting place','fixture start',START_FIXTURE],['Destination place','fixture destination',END_FIXTURE]] as const) {
    await page.getByRole('textbox',{name:label,exact:true}).fill(query);await page.getByRole('button',{name:label==='Starting place'?'Search starting places':'Search destination places',exact:true}).click();await page.getByRole('button',{name:place.label,exact:true}).click();
  }
}
function accessResponse() {
  return {...walkingFixture(),provider:'OpenStreetMap pedestrian graph',access:{source:'OpenStreetMap',checkedSegments:2,excludedSegments:3,rampSegments:1,unknownSegments:1,reviewedObstaclesAvoided:1,pendingReportsNearby:0,preferences:DEFAULT_ACCESS_PREFERENCES},obstacles:[]};
}
test('access mode submits actual preferences and requires ramp/unknown review before guidance',async({page})=>{
  await installLiveFixtures(page,base());let submitted:unknown;
  await page.route('**/api/live/access-route',async route=>{submitted=route.request().postDataJSON();await route.fulfill({json:accessResponse()});});
  await page.goto('/routes?access=1');await places(page);
  await page.getByRole('spinbutton',{name:'Maximum slope (%)',exact:true}).fill('6');
  await page.getByRole('button',{name:'Find access-aware walk',exact:true}).click();
  await expect(page.locator('.access-result-summary')).toContainText('1 mapped ramp');
  expect(submitted).toMatchObject({preferences:{maxSlopePercent:6,avoidRamps:false}});
  await expect(page.getByRole('button',{name:'Start live guidance',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:/I have reviewed the ramps/}).check();
  await expect(page.getByRole('button',{name:'Start live guidance',exact:true})).toBeEnabled();
  await page.getByRole('checkbox',{name:'Avoid mapped ramps',exact:true}).check();
  await expect(page.locator('.real-result')).toHaveCount(0);
  await page.getByRole('button',{name:'Find access-aware walk',exact:true}).click();expect(submitted).toMatchObject({preferences:{avoidRamps:true}});
  for(const [name,width,height]of [['desktop',1440,900],['tablet',768,1024],['mobile',375,844]] as const){await page.setViewportSize({width,height});await expectNoHorizontalOverflow(page);await capture(page,`access-mode-${name}`);}
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations).toEqual([]);
});
test('a missing access connection never becomes an ordinary unchecked walking result',async({page})=>{
  await installLiveFixtures(page,base());await page.route('**/api/live/access-route',route=>route.fulfill({status:422,json:{error:{message:'No connected pedestrian route meets these access preferences. Fixture only.'}}}));
  await page.goto('/routes?access=1');await places(page);await page.getByRole('button',{name:'Find access-aware walk',exact:true}).click();
  await expect(page.locator('.real-route-error')).toContainText('No connected pedestrian route');await expect(page.locator('.real-result')).toHaveCount(0);
});
test('wheelchair-provider results keep missing coverage unknown and require review',async({page})=>{
  await installLiveFixtures(page,base());
  await page.route('**/api/live/access-route',route=>route.fulfill({json:{...accessResponse(),provider:'openrouteservice wheelchair',access:{...accessResponse().access,engine:'openrouteservice',checkedSegments:null,excludedSegments:null,rampSegments:null,unknownSegments:null}}}));
  await page.goto('/routes?access=1');await places(page);await page.getByRole('button',{name:'Find access-aware walk',exact:true}).click();
  await expect(page.locator('.access-result-summary')).toContainText('does not report complete');await expect(page.locator('.access-result-summary')).not.toContainText('0 mapped ramp');await expect(page.getByRole('button',{name:'Start live guidance',exact:true})).toBeDisabled();await page.getByRole('checkbox',{name:/I have reviewed/}).check();await expect(page.getByRole('button',{name:'Start live guidance',exact:true})).toBeEnabled();
});
test('uses simulated browser GPS, advances live guidance, reroutes only after repeated deviation and stops tracking',async({page,context})=>{
  const fixture=await installLiveFixtures(page,base());await context.grantPermissions(['geolocation'],{origin:new URL(base()).origin});await context.setGeolocation({latitude:START_FIXTURE.lat,longitude:START_FIXTURE.lon,accuracy:5});
  await page.goto('/routes');expect((await page.request.get('/routes')).headers()['permissions-policy']).toContain('geolocation=(self)');
  await page.getByRole('button',{name:'Use my current location',exact:true}).click();await expect(page.getByRole('textbox',{name:'Starting place',exact:true})).toHaveValue('Current location');
  await page.getByRole('textbox',{name:'Destination place',exact:true}).fill('fixture destination');await page.getByRole('button',{name:'Search destination places',exact:true}).click();await page.getByRole('button',{name:END_FIXTURE.label,exact:true}).click();
  await page.getByRole('button',{name:'Calculate walking route',exact:true}).click();await expect(page.locator('.real-result-summary h2')).toHaveText('704 m');
  await page.getByRole('checkbox',{name:'Recalculate if I leave the route',exact:true}).check();await page.getByRole('button',{name:'Start live guidance',exact:true}).click();await expect(page.locator('.guidance-current')).toContainText('Live GPS');
  await context.setGeolocation({latitude:START_FIXTURE.lat+.0005,longitude:START_FIXTURE.lon,accuracy:5});await expect(page.locator('.guidance-current')).toContainText('remaining');
  await context.setGeolocation({latitude:START_FIXTURE.lat-.002,longitude:START_FIXTURE.lon-.002,accuracy:5});await expect(page.locator('.guidance-current')).toContainText('Off route');
  await context.setGeolocation({latitude:START_FIXTURE.lat-.0022,longitude:START_FIXTURE.lon-.0022,accuracy:5});await expect.poll(()=>fixture.routeRequests.length).toBe(2);
  await context.setGeolocation({latitude:START_FIXTURE.lat-.004,longitude:START_FIXTURE.lon-.004,accuracy:5});await context.setGeolocation({latitude:START_FIXTURE.lat-.0045,longitude:START_FIXTURE.lon-.0045,accuracy:5});
  await page.setViewportSize({width:375,height:844});await expectNoHorizontalOverflow(page);await capture(page,'live-navigation-mobile-simulated');
  await context.setGeolocation({latitude:START_FIXTURE.lat-.005,longitude:START_FIXTURE.lon-.005,accuracy:150});await expect(page.locator('.guidance-current')).toContainText('GPS needs a better signal');expect(fixture.routeRequests).toHaveLength(2);
  await page.getByRole('button',{name:'Stop live guidance',exact:true}).click();await expect(page.locator('.guidance-current')).toHaveCount(0);expect(fixture.routeRequests).toHaveLength(2);
  await capture(page,'live-gps-simulated');
});
test('denied location permission remains recoverable without a fabricated start point',async({page})=>{
  await installLiveFixtures(page,base());await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_ok:unknown,error:(event:{code:number})=>void)=>error({code:1}),clearWatch:()=>{}}});});
  await page.goto('/routes');await page.getByRole('button',{name:'Use my current location',exact:true}).click();await expect(page.locator('.saved-error')).toContainText('permission was denied');await expect(page.getByRole('textbox',{name:'Starting place',exact:true})).toHaveValue('');
});
test('keeps driving, cycling and transit handoffs genuine and separate from walking results',async({page})=>{
  const fixture=await installLiveFixtures(page,base());await page.goto('/routes');await places(page);
  for(const [name,mode] of [['Drive','driving'],['Cycle','bicycling'],['Bus / transit','transit']] as const) {
    await page.getByRole('radio',{name,exact:true}).check();
    const link=page.locator('.real-calculate a'),url=new URL((await link.getAttribute('href'))!);expect(url.searchParams.get('travelmode')).toBe(mode);await expect(page.getByRole('button',{name:'Calculate walking route',exact:true})).toHaveCount(0);
  }
  expect(fixture.routeRequests).toHaveLength(0);
});
test('saves and reloads a public real-place obstacle with explicit consent',async({page})=>{
  await installLiveFixtures(page,base());await page.goto('/report?place=world&lat=33.81&lon=-118.354');
  await page.getByRole('combobox',{name:'Obstacle category',exact:true}).selectOption('blocked-path');await page.getByRole('textbox',{name:/^What did you observe/}).fill(`Synthetic E2E observation only ${Date.now()}`);
  await expect(page.getByRole('button',{name:'Submit real-place report',exact:true})).toBeDisabled();await page.getByRole('checkbox',{name:/I understand that this exact obstacle location/}).check();await page.getByRole('button',{name:'Submit real-place report',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your observation is saved.',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Your observation is saved.',exact:true})).toBeVisible();
  await capture(page,'world-obstacle-receipt');
});
test('real-place report controls and spatial illustrations are accessible and responsive',async({page})=>{
  await installLiveFixtures(page,base());await page.goto('/report?place=world');
  await expect(page.locator('.world-report-map .real-map')).toBeVisible();
  for(const [name,width,height]of [['desktop',1440,900],['tablet',768,1024],['mobile',375,844]] as const){await page.setViewportSize({width,height});await expectNoHorizontalOverflow(page);await capture(page,`world-report-${name}`);}
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations).toEqual([]);
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:'Stairs',exact:true}).click();await expect(page.locator('.model-description')).toContainText('removes mapped stair');await page.getByRole('button',{name:'Ramp',exact:true}).click();await expect(page.locator('.model-description')).toContainText('slope, width');await expectNoHorizontalOverflow(page);await page.locator('.access-model').screenshot({path:'output/playwright/access-spatial-model-mobile.png',animations:'disabled'});
  await page.setViewportSize({width:1440,height:900});await page.locator('.access-model').screenshot({path:'output/playwright/access-spatial-model-desktop.png',animations:'disabled'});
});
