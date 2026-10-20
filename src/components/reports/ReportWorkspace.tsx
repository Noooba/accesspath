"use client";
import { useState } from 'react';
import { ReportForm } from './ReportForm';
import { WorldReportForm } from './WorldReportForm';
import type { LatLon } from '@/types/live-routing';
export function ReportWorkspace({realPlace=false,initialPoint,storageAvailable,initialSite,initialEdge,receipt}:{realPlace?:boolean;initialPoint?:LatLon;storageAvailable:boolean;initialSite?:string;initialEdge?:string;receipt?:string}) {
  const [world,setWorld]=useState(realPlace);
  return <><fieldset className="report-workspace-switch"><legend>Where is the obstacle?</legend><label className={world?'selected':''}><input type="radio" name="report-place" checked={world} onChange={()=>setWorld(true)}/>A real place / anywhere</label><label className={!world?'selected':''}><input type="radio" name="report-place" checked={!world} onChange={()=>setWorld(false)}/>Demo campus pathway</label></fieldset>{world?<WorldReportForm initialPoint={initialPoint} available={storageAvailable} receipt={realPlace?receipt:undefined}/>:<ReportForm initialSite={initialSite} initialEdge={initialEdge} storageAvailable={storageAvailable} receipt={!realPlace?receipt:undefined}/>}</>;
}
