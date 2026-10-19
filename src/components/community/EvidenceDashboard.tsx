'use client';

import { useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';

type Evidence = {
  nodes: number;
  edges: number;
  reports: { pending: number; approved: number; rejected: number };
  reportsUnavailable?: boolean;
  storage: { available: boolean; persistent: boolean; mode: string; reason?: string };
};
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; evidence: Evidence };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isEvidence(value: unknown): value is Evidence {
  if (!isRecord(value) || !isCount(value.nodes) || !isCount(value.edges) || !isRecord(value.reports) || !isRecord(value.storage)) return false;
  return isCount(value.reports.pending) && isCount(value.reports.approved) && isCount(value.reports.rejected)
    && typeof value.storage.available === 'boolean' && typeof value.storage.persistent === 'boolean'
    && typeof value.storage.mode === 'string' && (value.storage.reason === undefined || typeof value.storage.reason === 'string')
    && (value.reportsUnavailable === undefined || typeof value.reportsUnavailable === 'boolean');
}

export function EvidenceDashboard() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [requestNumber, setRequestNumber] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/evidence', { cache: 'no-store', signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok) {
          const message = isRecord(value) && isRecord(value.error) && typeof value.error.message === 'string'
            ? value.error.message : 'The evidence record could not be loaded. Please try again.';
          throw new Error(message);
        }
        if (!isEvidence(value)) throw new Error('The evidence response was incomplete. No counts are being shown.');
        if (active) setState({ status: 'ready', evidence: value });
      } catch (error) {
        if (active) setState({ status: 'error', message: controller.signal.aborted ? 'The evidence request timed out. Please try again.' : error instanceof Error ? error.message : 'The evidence record could not be loaded.' });
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [requestNumber]);

  function refresh() {
    setState({ status: 'loading' });
    setRequestNumber((previous) => previous + 1);
  }

  if (state.status === 'error') return <div className="data-note" role="alert">
    <strong>Evidence unavailable.</strong><p>{state.message}</p>
    <button type="button" className="button secondary" onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
  </div>;

  if (state.status === 'loading') return <div aria-busy="true">
    <p role="status">Loading the current graph and report counts…</p>
    <div className="metric-grid" aria-hidden="true">
      <article><span className="muted">Synthetic locations</span><h3>—</h3></article>
      <article><span className="muted">Synthetic segments</span><h3>—</h3></article>
      <article><span className="muted">Pending reports</span><h3>—</h3></article>
    </div>
  </div>;

  const { evidence } = state;
  const reportsAvailable = evidence.storage.available && !evidence.reportsUnavailable;
  const storageLabel = evidence.storage.mode === 'local-sqlite' ? 'Local SQLite' : evidence.storage.mode === 'remote-libsql' ? 'Remote libSQL' : 'Unavailable';

  return <div>
    <p role="status" aria-atomic="true">Evidence loaded: {evidence.nodes} synthetic locations and {evidence.edges} synthetic pathway segments. {reportsAvailable ? `${evidence.reports.pending} reports await review.` : 'Report counts are unavailable.'}</p>
    <div className="metric-grid">
      <article><span className="eyebrow">Demo graph</span><h3>{evidence.nodes}</h3><p>Synthetic locations</p></article>
      <article><span className="eyebrow">Demo graph</span><h3>{evidence.edges}</h3><p>Synthetic pathway segments</p></article>
      <article><span className="eyebrow">Reporting workflow</span><h3>{reportsAvailable ? evidence.reports.pending : '—'}</h3><p>{reportsAvailable ? 'Reports awaiting review' : 'Report count unavailable'}</p></article>
    </div>
    <div className="table-scroll"><table>
      <caption>Current stored report statuses</caption>
      <thead><tr><th scope="col">Status</th><th scope="col">Count</th><th scope="col">What it establishes</th></tr></thead>
      <tbody>
        <tr><th scope="row">Pending</th><td>{reportsAvailable ? evidence.reports.pending : 'Unavailable'}</td><td>A report was received; its claim has not been accepted.</td></tr>
        <tr><th scope="row">Approved</th><td>{reportsAvailable ? evidence.reports.approved : 'Unavailable'}</td><td>A moderator accepted a report. Other pathway attributes may still be unknown.</td></tr>
        <tr><th scope="row">Rejected</th><td>{reportsAvailable ? evidence.reports.rejected : 'Unavailable'}</td><td>A moderator did not accept the report.</td></tr>
      </tbody>
    </table></div>
    <aside className="data-note"><Database size={18} aria-hidden="true" /> <strong>Storage: {storageLabel}.</strong> {evidence.storage.available && evidence.storage.persistent ? 'Counts come from the configured persistent database. Stored demo reports are not proof of a real-world barrier or impact.' : evidence.storage.reason || 'Persistent report storage is not available on this deployment. Graph counts describe the bundled synthetic fixture only.'}</aside>
    <button type="button" className="button secondary" onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> Refresh evidence</button>
  </div>;
}
