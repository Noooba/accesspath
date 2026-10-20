"use client";
import { Accessibility } from 'lucide-react';
import type { AccessPreferences } from '@/types/accessibility';
export function AccessPreferencesPanel({preferences,onChange,wheelchairProvider}:{preferences:AccessPreferences;onChange:(next:Partial<AccessPreferences>)=>void;wheelchairProvider:boolean}) {
  const slopes=[3,6,10,15],kerbs=[3,6,10];
  return <fieldset className="access-preferences">
    <legend><Accessibility size={16}/> Plan around your access needs</legend>
    <p>Always excludes mapped stairs and reviewed obstacle areas. Local walks up to 3 km apart.</p>
    <label className="access-check"><input type="checkbox" disabled={wheelchairProvider&&!preferences.avoidRamps} checked={preferences.avoidRamps} onChange={event=>onChange({avoidRamps:event.target.checked})}/>Avoid mapped ramps</label>
    <label className="access-check"><input type="checkbox" disabled={wheelchairProvider&&!preferences.requireKnownAccess} checked={preferences.requireKnownAccess} onChange={event=>onChange({requireKnownAccess:event.target.checked})}/>Only paths with mapped access details</label>
    {wheelchairProvider&&<p>These two detailed local-map options are unavailable with this provider: it does not return complete ramp or attribute coverage. Ramps may be included and must be reviewed.</p>}
    <label>Maximum slope (%)
      {wheelchairProvider?<select value={preferences.maxSlopePercent} onChange={event=>onChange({maxSlopePercent:Number(event.target.value)})}>{!slopes.includes(preferences.maxSlopePercent)&&<option value={preferences.maxSlopePercent} disabled>{preferences.maxSlopePercent} — not supported by this provider</option>}{slopes.map(value=><option key={value} value={value}>{value}%</option>)}</select>:<input type="number" min={0} max={15} step={.5} value={preferences.maxSlopePercent} onChange={event=>onChange({maxSlopePercent:Number(event.target.value)})}/>}
    </label>
    <label>Minimum clear width (cm)<input type="number" min={60} max={200} step={5} value={preferences.minWidthCm} onChange={event=>onChange({minWidthCm:Number(event.target.value)})}/></label>
    <label>Maximum kerb height (cm)
      {wheelchairProvider?<select value={preferences.maxKerbCm} onChange={event=>onChange({maxKerbCm:Number(event.target.value)})}>{!kerbs.includes(preferences.maxKerbCm)&&<option value={preferences.maxKerbCm} disabled>{preferences.maxKerbCm} — not supported by this provider</option>}{kerbs.map(value=><option key={value} value={value}>{value} cm</option>)}</select>:<input type="number" min={0} max={5} step={.5} value={preferences.maxKerbCm} onChange={event=>onChange({maxKerbCm:Number(event.target.value)})}/>}
    </label>
    <p>Personal planning preferences, not accessibility standards. Mapped restrictions are requested; missing measurements still need confirmation. Ramps are allowed by default and flagged before guidance starts.</p>
  </fieldset>;
}
