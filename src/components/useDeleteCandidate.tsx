/**
 * "Remove candidate" with a confirmation popup, used on the job's Candidates tab (trash
 * button on each row) and in the candidate details popup:
 *
 *   const del = useDeleteCandidate(jobId, { onDeleted: () => setSelected(null) });
 *   <button onClick={() => del.ask(candidate)}>Remove</button>
 *   {del.dialog}
 *
 * Calls DELETE /api/jobs/:id/candidates/:candidateId: the same function the AI's red
 * "Remove candidate" card uses. The activity log records who removed whom.
 */
import { useState } from 'react';
import { api } from '../api';
import type { Candidate } from '../types';
import { notifyDataChanged } from '../useApi';
import { ConfirmDialog } from './ConfirmDialog';

export function useDeleteCandidate(jobId: string, { onDeleted }: { onDeleted?: () => void } = {}) {
  const [target, setTarget] = useState<Candidate | null>(null);

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      danger
      title={target ? `Remove ${target.name}?` : 'Remove candidate?'}
      confirmLabel="Remove candidate"
      onCancel={() => setTarget(null)}
      onConfirm={async () => {
        if (!target) return;
        await api(`/jobs/${jobId}/candidates/${target.id}`, { method: 'DELETE' });
        setTarget(null);
        notifyDataChanged();
        onDeleted?.();
      }}
    >
      {target && (
        <>
          <p>
            <strong>{target.name}</strong>
            {target.score !== null && <> (score {target.score})</>} will be removed from this job.
          </p>
          <p className="muted">This can't be undone. The activity log keeps a note of it.</p>
        </>
      )}
    </ConfirmDialog>
  );

  return { ask: setTarget, dialog };
}
