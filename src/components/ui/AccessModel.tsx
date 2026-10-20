"use client";
import { useId, useState } from 'react';
import { Accessibility, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
type Model='ramp'|'stairs'|'kerb';
const descriptions:Record<Model,string>={ramp:'A ramp can provide a step-free connection, but its slope, width, surface and current condition still matter. Review the details before guidance starts.',stairs:'A stair shortcut can be shorter and still be unusable with a wheelchair or walker. Access-aware street routing removes mapped stair segments before finding a path.',kerb:'A small raised kerb can interrupt a whole journey. The access profile checks recorded kerb heights and warns when crossing details are missing.'};
export function AccessModel({compact=false}:{compact?:boolean}) {
  const [model,setModel]=useState<Model>('ramp'),id=useId();
  return <section className={`access-model ${compact?'compact':''}`} aria-labelledby={id}>
    <div className="access-model-copy"><span className="eyebrow"><Accessibility size={15}/> Different paths. Different needs.</span><h2 id={id}>The details make<br/>the difference.</h2><p>Built to help people who walk, roll, use mobility aids or need fewer barriers—not just a shorter line on a map.</p></div>
    <div className="access-model-demo"><div className="access-model-stage" aria-hidden="true" onPointerMove={event=>{
      if(event.pointerType!=='mouse'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const bounds=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--model-tilt',`${(event.clientX-bounds.left)/bounds.width*12-6}deg`);
    }} onPointerLeave={event=>event.currentTarget.style.setProperty('--model-tilt','0deg')}>
      <div className={`access-model-world model-${model}`}><div className="model-ground"/><div className="model-path"/>{model==='stairs'?Array.from({length:5},(_,index)=><div key={index} className="model-step" style={{left:`${52+index*26}px`,height:`${12+index*12}px`,transform:`translateZ(${index*12}px)`}}><i/><b/></div>):model==='ramp'?<><div className="model-ramp"/><div className="model-rail rail-left"/><div className="model-rail rail-right"/></>:<div className="model-kerb"><i/><b/></div>}<div className="model-pin"><span/></div></div>
    </div><div className="model-controls" role="group" aria-label="Explore access features">{(['ramp','stairs','kerb'] as const).map(value=><button key={value} aria-pressed={model===value} onClick={()=>setModel(value)}>{value==='ramp'?'Ramp':value==='stairs'?'Stairs':'Raised kerb'}</button>)}</div><p className="model-description" role="status" aria-atomic="true">{descriptions[model]}</p><small>Interactive illustration, not a real pathway or a compliance diagram.</small></div>
    {!compact&&<div className="access-model-actions"><Link className="button primary" href="/routes?access=1">Plan around my access needs <ArrowUpRight size={16}/></Link><Link className="button secondary" href="/report?place=world">Report a real-place obstacle</Link></div>}
  </section>;
}
