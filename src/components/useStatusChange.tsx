/**
 * Moving candidates to a new status (Accept / Reject / Move to ...), with Undo:
 *
 *   const status = useStatusChange(jobId);
 *   status.move([id1, id2], 'accepted');
 *   {status.notice}   ->  "Moved 2 to Accepted: Ana, Ben.  [Undo]"
 *
 * Calls POST /api/jobs/:id/candidates/status: the same backend function the AI's status
 * card uses (the pipeline rules decide; people who can't move are listed with the reason).
 * Undo calls the undo endpoint for each change just made.
 */
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../api';
import { STATUS_LABELS } from '../pipeline';
import type { CandidateStatus } from '../types';
import { notifyDataChanged } from '../useApi';

interface MoveResult {
  to: CandidateStatus;
  changed: { id: string; name: string; activityId: string }[];
  skipped: { id: string; name: string; reason: string }[];
}

export function useStatusChange(jobId: string) {
  const [last, setLast] = useState<MoveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(candidateIds: string[], to: CandidateStatus) {
    setBusy(true);
    setError(null);
    try {
      setLast(await api<MoveResult>(`/jobs/${jobId}/candidates/status`, { method: 'POST', body: { candidateIds, to } }));
      notifyDataChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the status. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!last) return;
    setBusy(true);
    setError(null);
    try {
      // Newest first, so a chain of changes unwinds in the right order.
      for (const change of [...last.changed].reverse()) await api(`/jobs/${jobId}/activity/${change.activityId}/undo`, { method: 'POST', body: {} });
      setLast(null);
      notifyDataChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not undo.');
    } finally {
      setBusy(false);
    }
  }

  const notice =
    error || last ? (
      <div className={`status-notice${error ? ' status-notice--error' : ''}`} role={error ? 'alert' : 'status'}>
        {error ?? (
          <>
            {last!.changed.length
              ? `Moved ${last!.changed.length} to ${STATUS_LABELS[last!.to]}: ${last!.changed.map((c) => c.name).join(', ')}.`
              : `Nobody was moved to ${STATUS_LABELS[last!.to]}.`}
            {last!.skipped.length > 0 && <span className="muted"> Skipped: {last!.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}</span>}
            {last!.changed.length > 0 && (
              <button type="button" className="link-button" onClick={undo} disabled={busy}>
                <Undo2 size={14} aria-hidden="true" /> Undo
              </button>
            )}
          </>
        )}
        <button type="button" className="link-button muted" onClick={() => { setLast(null); setError(null); }} aria-label="Dismiss">
          ✕
        </button>
      </div>
    ) : null;

  return { move, busy, notice };
}
