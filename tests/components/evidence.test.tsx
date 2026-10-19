// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EvidenceDashboard } from '@/components/community/EvidenceDashboard';

const evidence = {
  nodes: 26, edges: 42, reports: { pending: 3, approved: 1, rejected: 2 },
  storage: { available: true, persistent: true, mode: 'local-sqlite' },
};
const response = (value: unknown, ok = true) => ({ ok, json: async () => value });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('evidence dashboard', () => {
  it('shows fetched graph and report counts with their actual meaning', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(evidence)));
    render(<EvidenceDashboard />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(await screen.findByText(/3 reports await review/)).toBeTruthy();
    expect(screen.getByRole('row', { name: /Approved 1 A moderator accepted/ })).toBeTruthy();
    expect(screen.getByText(/Stored demo reports are not proof/)).toBeTruthy();
  });

  it('does not present fallback zero reports as a real count when storage is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      ...evidence, reports: { pending: 0, approved: 0, rejected: 0 }, reportsUnavailable: true,
      storage: { available: false, persistent: false, mode: 'unavailable', reason: 'Storage needs configuration.' },
    })));
    render(<EvidenceDashboard />);
    expect(await screen.findByText(/Report counts are unavailable/)).toBeTruthy();
    expect(screen.getByRole('row', { name: /Pending Unavailable A report was received/ })).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByText(/Storage needs configuration/)).toBeTruthy();
  });

  it('allows a failed request to be retried without inventing a loaded state', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Temporary connection failure.')).mockResolvedValueOnce(response(evidence));
    vi.stubGlobal('fetch', fetchMock);
    render(<EvidenceDashboard />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('26')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/3 reports await review/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects incomplete or negative count payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...evidence, nodes: -1 })));
    render(<EvidenceDashboard />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/response was incomplete/)).toBeTruthy();
    expect(screen.queryByText('-1')).toBeNull();
  });

  it('keeps pending counts unknown and cancels a request after leaving the page', () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<EvidenceDashboard />);
    expect(screen.getByRole('status').textContent).toContain('Loading');
    expect(screen.queryByText('0')).toBeNull();
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });

  it('replaces a stalled request with a retryable timeout state', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    render(<EvidenceDashboard />);
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(screen.getByRole('alert').textContent).toContain('timed out');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
