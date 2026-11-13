/**
 * Everything needed for "Delete job" with a confirmation popup, shared by the Jobs list
 * and the job page:
 *
 *   const del = useDeleteJob({ onDeleted: () => navigate('/jobs') });
 *   <button onClick={() => del.ask(job)}>Delete</button>
 *   {del.dialog}
 *
 * The popup says exactly what will be removed. Deleting calls DELETE /api/jobs/:id: the
 * same function the AI's delete card uses. Other pages refresh by themselves afterwards.
 */
import { useState } from 'react';
import { api } from '../api';
import type { Job } from '../types';
import { notifyDataChanged } from '../useApi';
import { ConfirmDialog } from './ConfirmDialog';

export function useDeleteJob({ onDeleted }: { onDeleted?: () => void } = {}) {
  const [target, setTarget] = useState<Job | null>(null);

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      danger
      title={target ? `Delete ${target.jobCode ?? 'this job'}?` : 'Delete job?'}
      confirmLabel="Delete job"
      onCancel={() => setTarget(null)}
      onConfirm={async () => {
        if (!target) return;
        await api(`/jobs/${target.id}`, { method: 'DELETE' });
        setTarget(null);
        notifyDataChanged();
        onDeleted?.();
      }}
    >
      {target && (
        <>
          <p>
            <strong>{target.title}</strong> will be deleted, together with its{' '}
            <strong>
              {target.totalCandidates} candidate{target.totalCandidates === 1 ? '' : 's'}
            </strong>
            .
          </p>
          <p className="muted">This can't be undone. The activity history is kept.</p>
        </>
      )}
    </ConfirmDialog>
  );

  return { ask: setTarget, dialog };
}
