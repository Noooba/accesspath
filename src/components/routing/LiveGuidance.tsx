"use client";
import { Navigation, LocateFixed, Square, Volume2, RotateCw } from 'lucide-react';
import type { RealWalkingRoute } from '@/types/live-routing';
import type { useLiveGuide } from './useLiveGuide';
type Guide = ReturnType<typeof useLiveGuide>;
export function LiveGuidance({guide,route,busy,needsAcknowledgment,acknowledged,onAcknowledge}:{guide:Guide;route:RealWalkingRoute;busy:boolean;needsAcknowledgment:boolean;acknowledged:boolean;onAcknowledge:(checked:boolean)=>void}) {
  const step=guide.progress?route.steps[guide.progress.stepIndex]:null;
  const offRoute=Boolean(guide.progress&&guide.progress.distanceFromRoute>Math.max(35,(guide.fix?.accuracy??0)*2));
  return <section className="live-guidance" aria-label="Live walking guidance">
    <div className="live-guidance-heading"><Navigation size={21}/><div><h3>Follow your walk.</h3><p>Live position, next step and optional spoken prompts.</p></div></div>
    {needsAcknowledgment && <label className="access-check warning-check"><input type="checkbox" checked={acknowledged} onChange={e=>onAcknowledge(e.target.checked)} />I have reviewed the ramps, unknown access details and endpoint gaps before starting.</label>}
    <div className="guidance-options"><label className="access-check"><input type="checkbox" checked={guide.voice} onChange={e=>guide.setVoice(e.target.checked)}/><Volume2 size={16}/> Spoken directions</label><label className="access-check"><input type="checkbox" checked={guide.autoReroute} onChange={e=>guide.setAutoReroute(e.target.checked)}/><RotateCw size={16}/> Recalculate if I leave the route</label></div>
    <p className="guidance-privacy">Foreground GPS only. Stop any time. Recalculation shares your off-route point with the map service. Recalculate saved snapshots before starting.</p><details className="guidance-privacy"><summary>Location, voice &amp; privacy</summary><p>Your moving position stays in this tab. If you enable recalculation, an off-route position is sent to AccessPath and the selected map service, at most once every 45 seconds. No location history is saved. Spoken prompts use your browser or operating system’s voice service. Keep the page open; browser guidance is not guaranteed while your phone is locked.</p></details>
    <div className="guidance-actions">{guide.tracking?<button className="button secondary" onClick={guide.stop}><Square size={15}/> Stop live guidance</button>:<button className="button primary" onClick={guide.start} disabled={busy||(needsAcknowledgment&&!acknowledged)}><LocateFixed size={17}/> Start live guidance</button>}</div>
    {guide.tracking && <div className="guidance-current" role="status" aria-atomic="true"><span>{guide.locating?'Waiting for GPS…':guide.reliable?'Live GPS':'GPS needs a better signal'}</span><strong>{busy?'Recalculating your route…':offRoute?'Off route. Check the map before continuing.':step?.instruction ?? 'Waiting for an accurate location.'}</strong>{guide.progress&&<p>{Math.round(guide.progress.distanceToNextStep)} m to next step · {Math.round(guide.progress.remainingMeters)} m remaining{offRoute?' · Off route':''}</p>}</div>}
    {guide.fix&&<p className="guidance-quality">GPS accuracy: about {Math.round(guide.fix.accuracy)} m. {guide.reliable?'':'Old or low-accuracy fixes are not used for automatic rerouting.'}</p>}
    {guide.arrived&&<p role="status" className="success-notice">You reached the mapped endpoint. Check any final entrance or unmapped connection.</p>}
    {guide.error&&<p className="saved-error" role="alert">{guide.error}</p>}
  </section>;
}
