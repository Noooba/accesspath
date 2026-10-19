"use client";
import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Bookmark, Star, ArrowUpRight, Map, Pencil, Trash2, Check } from 'lucide-react';
import { parseSavedRoutes, parseTags, readSavedSnapshot, SAVED_ROUTES_EVENT, SAVED_ROUTES_KEY, writeSavedRoutes, type SavedJourney, type SavedRoute } from '@/lib/saved-routes';

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === SAVED_ROUTES_KEY || event.key === null) listener(); };
  window.addEventListener('storage', storage);
  window.addEventListener(SAVED_ROUTES_EVENT, listener);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(SAVED_ROUTES_EVENT, listener); };
}
export function useSavedRoutes() {
  const raw = useSyncExternalStore(subscribe, readSavedSnapshot, () => null);
  const loaded = useSyncExternalStore(() => () => {}, () => true, () => false);
  return { ...useMemo(() => parseSavedRoutes(raw), [raw]), loaded };
}
export function SaveRouteForm({ journey, defaultName }: { journey: SavedJourney; defaultName: string }) {
  const [open, setOpen] = useState(false), [name, setName] = useState(defaultName.slice(0, 100)), [tags, setTags] = useState(''), [favorite, setFavorite] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  return <div className="route-save">
    <button className="button secondary" aria-expanded={open} onClick={() => setOpen(!open)}><Bookmark size={16} /> Save route</button>
    {open && <form className="saved-editor" onSubmit={event => {
      event.preventDefault(); setError('');
      try {
        const record: SavedRoute = { id: crypto.randomUUID(), name: name.trim(), tags: parseTags(tags), favorite, savedAt: new Date().toISOString(), journey };
        if (!record.name) throw new Error('Give this route a name.');
        writeSavedRoutes(routes => [record, ...routes]); setMessage('Route saved to this browser.'); setOpen(false);
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not save route.'); }
    }}>
      <label>Route name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Tags, separated by commas<input maxLength={210} placeholder="commute, campus, weekend" value={tags} onChange={e => setTags(e.target.value)} /></label>
      <label className="saved-checkbox"><input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} /> Add to favorites</label>
      <p>Only on this device and browser. Clearing site data removes saved routes. Street maps still need internet.</p>
      {error && <p className="saved-error" role="alert">{error}</p>}
      <button className="button primary" type="submit"><Check size={16} /> Save to library</button>
    </form>}
    <p role="status">{message && <>{message} <Link href="/saved">View saved routes →</Link></>}</p>
  </div>;
}

function SavedCard({ route, reportError }: { route: SavedRoute; reportError: (message: string) => void }) {
  const [editing, setEditing] = useState(false), [name, setName] = useState(route.name), [tags, setTags] = useState(route.tags.join(', ')), [confirmDelete, setConfirmDelete] = useState(false);
  function mutate(update: (record: SavedRoute) => SavedRoute) {
    try { writeSavedRoutes(routes => routes.map(item => item.id === route.id ? update(item) : item)); reportError(''); return true; }
    catch (e) { reportError(e instanceof Error ? e.message : 'Could not update saved route.'); return false; }
  }
  const journey = route.journey, distance = journey.kind === 'street' ? journey.route.distanceMeters : journey.distanceMeters;
  return <article className="saved-card">
    <div className="saved-card-heading"><span className="eyebrow"><Map size={14} /> {journey.kind === 'street' ? 'Street route snapshot' : 'Demo campus route'}</span><button className="icon-button" aria-label={`Favorite ${route.name}`} aria-pressed={route.favorite} onClick={() => mutate(item => ({ ...item, favorite: !item.favorite }))}><Star size={19} fill={route.favorite ? 'currentColor' : 'none'} /></button></div>
    <h2>{route.name}</h2>
    <p className="saved-endpoints">{journey.kind === 'street' ? journey.start.label : journey.startLabel}<span>to</span>{journey.kind === 'street' ? journey.end.label : journey.endLabel}</p>
    <p className="saved-meta">{distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`} · {journey.kind === 'street' ? 'Accessibility unverified' : `${journey.mode === 'shortest' ? 'Shortest walk' : journey.mode === 'confirmed' ? 'Confirmed step-free' : 'Exploratory'} · synthetic data`}</p>
    {route.tags.length > 0 && <ul className="saved-tags" aria-label="Route tags">{route.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
    <div className="saved-card-actions"><Link className="button primary" href={`${journey.kind === 'street' ? '/routes' : '/explore'}?saved=${encodeURIComponent(route.id)}`}>Open map <ArrowUpRight size={15} /></Link><button className="icon-button" aria-label={`Edit ${route.name}`} aria-expanded={editing} onClick={() => { setName(route.name); setTags(route.tags.join(', ')); setEditing(!editing); }}><Pencil size={17} /></button><button className="icon-button" aria-label={`Remove ${route.name}`} aria-expanded={confirmDelete} onClick={() => setConfirmDelete(!confirmDelete)}><Trash2 size={17} /></button></div>
    {editing && <form className="saved-editor" onSubmit={e => { e.preventDefault(); try { const nextTags = parseTags(tags); if (mutate(item => ({ ...item, name: name.trim(), tags: nextTags }))) setEditing(false); } catch (e) { reportError(e instanceof Error ? e.message : 'Could not edit route.'); } }}><label>Route name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>Tags, separated by commas<input value={tags} maxLength={210} onChange={e => setTags(e.target.value)} /></label><button className="button secondary" type="submit">Save changes</button></form>}
    {confirmDelete && <div className="saved-delete"><p>Remove “{route.name}” from this browser?</p><button className="button secondary" onClick={() => setConfirmDelete(false)}>Keep route</button><button className="button secondary" onClick={() => { try { writeSavedRoutes(routes => routes.filter(item => item.id !== route.id)); } catch (e) { reportError(e instanceof Error ? e.message : 'Could not remove route.'); } }}>Confirm removal</button></div>}
  </article>;
}
export function SavedRoutesLibrary() {
  const { routes, error: storageError, loaded } = useSavedRoutes();
  const [query, setQuery] = useState(''), [favorites, setFavorites] = useState(false), [tag, setTag] = useState(''), [error, setError] = useState('');
  const tags = [...new Set(routes.flatMap(route => route.tags))].sort();
  const filtered = routes.filter(route => (!favorites || route.favorite) && (!tag || route.tags.includes(tag)) && `${route.name} ${route.tags.join(' ')} ${route.journey.kind === 'street' ? route.journey.start.label + route.journey.end.label : route.journey.startLabel + route.journey.endLabel}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="saved-page page-width" id="main-content" tabIndex={-1}>
    <header className="saved-heading"><span className="eyebrow"><Bookmark size={15} /> Your route library</span><h1>Places worth keeping.</h1><p>Save a journey, make it a favorite, and find it by tag. Your library stays in this browser—no account or cloud sync.</p><Link className="button secondary" href="/routes">Plan a new walk <ArrowUpRight size={15} /></Link></header>
    <div className="saved-toolbar"><label>Find a saved route<input type="search" placeholder="Search names, places or tags" value={query} onChange={e => setQuery(e.target.value)} /></label><label>Tag<select value={tag} onChange={e => setTag(e.target.value)}><option value="">All tags</option>{tags.map(value => <option key={value} value={value}>{value}</option>)}</select></label><button className="button secondary" aria-pressed={favorites} onClick={() => setFavorites(!favorites)}><Star size={16} fill={favorites ? 'currentColor' : 'none'} /> Favorites</button></div>
    {(storageError || error) && <p className="saved-error" role="alert">{storageError || error}</p>}
    <p className="saved-count" role="status">{!loaded ? 'Opening your library…' : `${filtered.length} ${filtered.length === 1 ? 'route' : 'routes'}${favorites ? ' in favorites' : ''}`}</p>
    <div className="saved-grid">{filtered.map(route => <SavedCard key={route.id} route={route} reportError={setError} />)}</div>
    {loaded && !storageError && !filtered.length && <div className="saved-empty"><Bookmark size={30} /><h2>{routes.length ? 'No routes match just yet.' : 'Your next regular route starts here.'}</h2><p>{routes.length ? 'Try a different search, tag or favorite filter.' : 'Calculate a street or campus route, then choose Save route to keep its map and route details.'}</p><Link href="/routes" className="button primary">Find a walking route</Link></div>}
    <p className="saved-privacy">Saved street routes are dated snapshots, not current condition reports. Recalculate before travel. Map tiles need internet; clearing browser data removes this library.</p>
  </main>;
}
