/**
 * The bar above a job's candidates:
 *
 *   [ Upload CSV ] [ Add candidate ]                 (live) Scoring… 15 of 23  ▓▓▓▓░░
 *
 * - Add candidate: a small form for ONE person (same as asking the AI to add them).
 *
 * - Upload CSV: pick a .csv file -> candidates are added (duplicates skipped) and AI
 *   scoring starts in the background automatically. A short summary is shown.
 * - The progress line updates live while the background worker scores.
 *
 * These call the same backend functions the AI will use from the chat.
 */
import { FileUp, UserPlus } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { API_BASE, ApiError } from '../api';
import type { JobTask } from '../useJobTasks';
import { AddCandidateDialog } from './AddCandidateDialog';
import { notifyDataChanged } from '../useApi';

interface UploadResult {
  rows: number;
  added: number;
  duplicates: number;
  invalid: number;
}

export function SourcingBar({ jobId, latest }: { jobId: string; latest: JobTask | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const active = latest && (latest.status === 'queued' || latest.status === 'running');

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again still triggers a change
    if (!file) return;
    setBusy('upload');
    setNotice(null);
    try {
      // Files go as multipart form data, so this uses fetch directly instead of api().
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/jobs/${jobId}/candidates/csv`, { method: 'POST', body: form, credentials: 'same-origin' });
      const data = (await res.json().catch(() => ({}))) as UploadResult & { error?: { message?: string } };
      if (!res.ok) throw new ApiError(res.status, 'UPLOAD', data.error?.message ?? 'Upload failed.');
      const parts = [`${data.added} added`];
      if (data.duplicates) parts.push(`${data.duplicates} duplicate${data.duplicates === 1 ? '' : 's'} skipped`);
      if (data.invalid) parts.push(`${data.invalid} row${data.invalid === 1 ? '' : 's'} without email or profile link skipped`);
      setNotice({ ok: true, text: `${file.name}: ${data.rows} rows read, ${parts.join(', ')}.${data.added ? ' Scoring has started.' : ''}` });
      notifyDataChanged();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : 'Upload failed. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  const percent =
    latest && latest.progress.total > 0 ? Math.round((latest.progress.done / latest.progress.total) * 100) : latest?.status === 'done' ? 100 : 0;

  return (
    <div className="sourcing-bar">
      <div className="sourcing-bar__actions">
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={upload} />
        <button type="button" className="button" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          <FileUp size={16} aria-hidden="true" /> {busy === 'upload' ? 'Uploading…' : 'Upload CSV'}
        </button>
        <button type="button" className="button button--ghost" onClick={() => setAdding(true)} disabled={busy !== null}>
          <UserPlus size={16} aria-hidden="true" /> Add candidate
        </button>
      </div>
      <AddCandidateDialog
        jobId={jobId}
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(text) => setNotice({ ok: true, text })}
      />

      {latest && (
        <div className={`task-progress task-progress--${latest.status}`} role="status" aria-live="polite">
          <span className="task-progress__text">
            {active && <span className="task-progress__dot" aria-hidden="true" />}
            {latest.message}
          </span>
          {(active || latest.status === 'done') && latest.progress.total > 0 && (
            <span
              className="task-progress__track"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Scoring progress"
            >
              <span style={{ width: `${percent}%` }} />
            </span>
          )}
        </div>
      )}

      {notice && (
        <p className={notice.ok ? 'form-notice sourcing-bar__notice' : 'form-error sourcing-bar__notice'} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}
    </div>
  );
}
