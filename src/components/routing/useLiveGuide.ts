"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { distanceMetres, reliableFix, routeProgress, type LocationFix } from '@/lib/navigation';
import type { LatLon, RealWalkingRoute } from '@/types/live-routing';

export function useLiveGuide(route: RealWalkingRoute | null, reroute: (point: LatLon) => Promise<void>, canReroute: boolean) {
  const [fix,setFix]=useState<LocationFix|null>(null),[tracking,setTracking]=useState(false),[locating,setLocating]=useState(false),[error,setError]=useState(''),[voice,setVoice]=useState(false),[autoReroute,setAutoReroute]=useState(false),[now,setNow]=useState(0),[arrived,setArrived]=useState(false);
  const watch=useRef<number|null>(null),generation=useRef(0), offRouteCount=useRef(0),lastReroute=useRef(0),rerouting=useRef(false),lastReroutePoint=useRef<LatLon|null>(null),spoken=useRef('');
  const options=useRef({route,reroute,canReroute,voice,autoReroute});
  useEffect(()=> {options.current={route,reroute,canReroute,voice,autoReroute};},[route,reroute,canReroute,voice,autoReroute]);
  const stop=useCallback(()=> {
    generation.current++;
    if(watch.current!==null) navigator.geolocation?.clearWatch(watch.current);
    watch.current=null;setTracking(false);setLocating(false);setArrived(false);offRouteCount.current=0;
    window.speechSynthesis?.cancel();spoken.current='';
  },[]);
  useEffect(()=>()=> {generation.current++;if(watch.current!==null) navigator.geolocation?.clearWatch(watch.current);window.speechSynthesis?.cancel();},[]);
  useEffect(()=>{if(!voice) window.speechSynthesis?.cancel();},[voice]);
  useEffect(()=> {
    if(!tracking && !fix) return;
    const interval=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(interval);
  },[tracking,fix]);
  function supported() {
    if(!window.isSecureContext || !navigator.geolocation) {setError('Location needs HTTPS and a browser with geolocation support. You can still choose points manually.');return false;}
    return true;
  }
  function locationError(event:GeolocationPositionError) {
    setLocating(false);
    setError(event.code===1?'Location permission was denied. Enable it in your browser settings or choose points manually.':event.code===3?'Location timed out. Move to an open area and try again.':'Your location is unavailable. Try again or choose a starting point.');
    if(event.code===1) stop();
  }
  function fromPosition(position:GeolocationPosition):LocationFix {
    return {lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp,heading:position.coords.heading};
  }
  function locate(onPoint:(point:LatLon)=>void) {
    if(!supported()) return;
    setLocating(true);setError('');const current=generation.current;
    navigator.geolocation.getCurrentPosition(position=> {
      if(current!==generation.current) return;
      const point=fromPosition(position);setFix(point);setNow(Date.now());setLocating(false);
      if(!reliableFix(point)) {setError('This location is too old or inaccurate to choose a reliable start. Try again or choose a point on the map.');return;}
      onPoint({lat:point.lat,lon:point.lon});
    },event=> {if(current===generation.current) locationError(event);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  function start() {
    if(!supported()||!route) return;
    stop();setError('');setArrived(false);setTracking(true);setLocating(true);lastReroute.current=0;lastReroutePoint.current=null;
    const current=generation.current;
    watch.current=navigator.geolocation.watchPosition(position=> {
      if(current!==generation.current) return;
      const point=fromPosition(position);setFix(point);setNow(Date.now());setLocating(false);
      if(!reliableFix(point)) {setError('GPS accuracy is low or the location is stale. Guidance and automatic rerouting are paused until it improves.');offRouteCount.current=0;return;}
      setError('');
      const config=options.current,activeRoute=config.route;if(!activeRoute) return;
      const progress=routeProgress(point,activeRoute),destination=activeRoute.coordinates.at(-1)!;
      if(progress.remainingMeters<15 && distanceMetres(point,{lat:destination[0],lon:destination[1]})<=Math.max(12,point.accuracy)) {stop();setArrived(true);return;}
      const instruction=activeRoute.steps[progress.stepIndex]?.instruction;
      const speechKey=`${activeRoute.id}:${activeRoute.distanceMeters}:${progress.stepIndex}`;
      if(config.voice && instruction && spoken.current!==speechKey && typeof SpeechSynthesisUtterance!=='undefined') {
        window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(instruction));spoken.current=speechKey;
      }
      if(progress.distanceFromRoute>Math.max(35,point.accuracy*2)) offRouteCount.current++;else offRouteCount.current=0;
      const moved=!lastReroutePoint.current||distanceMetres(point,lastReroutePoint.current)>20;
      if(config.autoReroute && config.canReroute && offRouteCount.current>=2 && !rerouting.current && Date.now()-lastReroute.current>=45000 && moved) {
        rerouting.current=true;lastReroute.current=Date.now();lastReroutePoint.current=point;offRouteCount.current=0;
        void config.reroute({lat:point.lat,lon:point.lon}).finally(()=>{rerouting.current=false;});
      }
    },event=> {if(current===generation.current) locationError(event);},{enableHighAccuracy:true,timeout:15000,maximumAge:3000});
  }
  const reliable=Boolean(fix&&reliableFix(fix,now));
  const progress=fix&&route&&reliable?routeProgress(fix,route):null;
  return {fix,tracking,locating,error,voice,setVoice,autoReroute,setAutoReroute,start,stop,locate,reliable,progress,arrived};
}
