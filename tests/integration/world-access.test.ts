import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { POST as submitObstacle, GET as getObstacles } from '@/app/api/obstacles/route';
import { POST as accessRoute } from '@/app/api/live/access-route/route';
import { POST as login } from '@/app/api/admin/login/route';
import { PATCH as moderate } from '@/app/api/admin/reports/[id]/route';
import { GET as adminReports } from '@/app/api/admin/reports/route';
import { readyDatabase } from '@/lib/database/repository';
import { closeDatabases } from '@/lib/database/client';
import { ACCESS_END,ACCESS_RAMP_POINT,ACCESS_START,accessMapFixture } from '../fixtures/access-map';
import { DEFAULT_ACCESS_PREFERENCES } from '@/types/accessibility';

const prior=Object.fromEntries(['DATABASE_URL','VERCEL','ADMIN_KEY','SESSION_SECRET','OVERPASS_API_URL'].map(key=>[key,process.env[key]]));
let directory='',cookie='';const key=randomBytes(32).toString('hex');
const request=(path:string,body:unknown,headers:Record<string,string>={})=>new Request(`http://localhost:3050${path}`,{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3050',...headers},body:JSON.stringify(body)});
const observation={...ACCESS_RAMP_POINT,category:'blocked-path',radiusMeters:10,description:'Synthetic integration obstacle only.',consentPublicLocation:true};
beforeAll(async()=>{directory=await mkdtemp(join(tmpdir(),'accesspath-world-'));process.env.DATABASE_URL=`file:${join(directory,'test.db').replaceAll('\\','/')}`;delete process.env.VERCEL;delete process.env.OVERPASS_API_URL;process.env.ADMIN_KEY=key;process.env.SESSION_SECRET=randomBytes(32).toString('hex');await readyDatabase();const response=await login(request('/api/admin/login',{key}));cookie=response.headers.get('set-cookie')!.split(';')[0];});
beforeEach(async()=>{const {client}=await readyDatabase();await client.execute('DELETE FROM world_reports');await client.execute("DELETE FROM rate_limits WHERE bucket LIKE 'live-provider:%'");vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(accessMapFixture()))));});
afterEach(()=>vi.unstubAllGlobals());
afterAll(async()=>{
  await closeDatabases();
  for(const [name,value]of Object.entries(prior)){if(value===undefined)delete process.env[name];else process.env[name]=value;}
  if(!directory.startsWith(join(tmpdir(),'accesspath-world-')))throw new Error('Unexpected temporary database path');
  try {await rm(directory,{recursive:true,force:true,maxRetries:2,retryDelay:100});}
  catch(error){if(process.platform!=='win32'||!(error instanceof Error)||!('code'in error)||error.code!=='EBUSY')throw error;console.warn('Windows retained a native SQLite test handle; temporary-file cleanup is deferred until the worker exits.');}
});
describe('world reports, review and real graph exclusions',()=>{
  it('stores a public pending observation, preserves its reference and rejects duplicates',async()=>{
    const response=await submitObstacle(request('/api/obstacles',observation));expect(response.status).toBe(201);const {report}=await response.json();expect(report.reviewStatus).toBe('pending');expect(report.moderatorNotes).toBe('');
    const read=await getObstacles(new Request(`http://localhost:3050/api/obstacles?id=${report.id}`));expect((await read.json()).report).toMatchObject({id:report.id,lat:observation.lat,lon:observation.lon});
    expect((await submitObstacle(request('/api/obstacles',observation))).status).toBe(409);
  });
  it.each([{...observation,consentPublicLocation:false},{...observation,lat:91},{...observation,radiusMeters:500},{...observation,reviewStatus:'approved'}])('rejects missing consent, invalid locations and forged verification',async body=>{expect((await submitObstacle(request('/api/obstacles',body))).status).toBe(400);});
  it('rejects cross-origin writes and unbounded report queries',async()=>{
    expect((await submitObstacle(request('/api/obstacles',observation,{origin:'https://unrelated.example'}))).status).toBe(403);
    expect((await getObstacles(new Request('http://localhost:3050/api/obstacles?south=-90&north=90&west=-180&east=180'))).status).toBe(400);
  });
  it('only changes routing after authorized review, without exposing moderator notes',async()=>{
    const body={start:ACCESS_START,end:ACCESS_END,preferences:DEFAULT_ACCESS_PREFERENCES};
    const first=await accessRoute(request('/api/live/access-route',body));expect(first.status).toBe(200);expect((await first.json()).access.rampSegments).toBe(2);
    const providerCall=vi.mocked(fetch).mock.calls[0];expect(new URL(String(providerCall[0])).hostname).toBe('overpass.private.coffee');expect(providerCall[1]).toMatchObject({method:'POST'});expect(String(providerCall[1]?.body)).toContain('data=');
    const submitted=await submitObstacle(request('/api/obstacles',observation)),{report}=await submitted.json();
    const pending=await accessRoute(request('/api/live/access-route',body));expect((await pending.json()).access.pendingReportsNearby).toBe(1);
    const unauthorized=await moderate(request(`/api/admin/reports/${report.id}`,{reviewStatus:'approved'}),{params:Promise.resolve({id:report.id})});expect(unauthorized.status).toBe(401);
    const reviewed=await moderate(request(`/api/admin/reports/${report.id}`,{reviewStatus:'approved',moderatorNotes:'Synthetic private review fixture.'},{cookie}),{params:Promise.resolve({id:report.id})});expect(reviewed.status).toBe(200);
    const avoided=await accessRoute(request('/api/live/access-route',body)),data=await avoided.json();expect(data.access.reviewedObstaclesAvoided).toBe(1);expect(data.access.rampSegments).toBe(0);expect(data.routes[0].coordinates).toContainEqual([33.8088,-118.353]);
    const publicReport=await getObstacles(new Request(`http://localhost:3050/api/obstacles?id=${report.id}`));expect((await publicReport.json()).report.moderatorNotes).toBe('');
    const dashboard=await adminReports(new Request('http://localhost:3050/api/admin/reports',{headers:{cookie}}));expect((await dashboard.json()).reports.some((item:{id:string})=>item.id===report.id)).toBe(true);
  });
  it('does not silently substitute an ordinary walk for unsupported areas or bad preferences',async()=>{
    expect((await accessRoute(request('/api/live/access-route',{start:ACCESS_START,end:{lat:34,lon:-118},preferences:DEFAULT_ACCESS_PREFERENCES}))).status).toBe(400);
    expect((await accessRoute(request('/api/live/access-route',{start:ACCESS_START,end:ACCESS_END,preferences:{...DEFAULT_ACCESS_PREFERENCES,minWidthCm:-1}}))).status).toBe(400);
  });
});
