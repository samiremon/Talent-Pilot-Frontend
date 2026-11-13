/**
 * "Import CSV" card in the chat (after attaching a CSV with 📎).
 *
 * Before Confirm: what the file contains (rows, new people, duplicates, unusable rows) and
 * the first few names, so you can check it's the right file for the right job. Nothing is
 * imported yet.
 * After Confirm: the import is done and AI scoring runs in the background; the card shows
 * the scoring progress live (same live updates as the job page).
 */
import { Check, FileSpreadsheet, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useJobTasks } from '../useJobTasks';
import type { ActionCard, DecisionResult } from './JobCard';

interface ImportPayload {
  jobId: string;
  jobCode?: string;
  title?: string;
  fileName: string;
  rows: number;
  fresh: number;
  duplicates: number;
  invalid: number;
  withoutText: number;
  preview: { name: string; headline: string | null }[];
}

/** Live scoring progress for the job, shown once the import is confirmed. */
function LiveScoring({ jobId }: { jobId: string }) {
  const { latest } = useJobTasks(jobId);
  if (!latest) return <p className="job-card__hint">Starting AI scoring…</p>;
  const active = latest.status === 'queued' || latest.status === 'running';
  const percent = latest.progress.total ? Math.round((latest.progress.done / latest.progress.total) * 100) : 100;
  return (
    <div className={`task-progress task-progress--${latest.status}`} role="status" aria-live="polite">
      <span className="task-progress__text">
        {active && <span className="task-progress__dot" aria-hidden="true" />}
        {latest.message}
      </span>
      {latest.progress.total > 0 && (
        <span className="task-progress__track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Scoring progress">
          <span style={{ width: `${percent}%` }} />
        </span>
      )}
    </div>
  );
}

export function ImportCsvCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const p = card.payload as unknown as ImportPayload;
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = card.status === 'pending';
  const result = card.result as { added?: number; taskId?: string | null } | null;

  async function decide(kind: 'confirm' | 'cancel') {
    setBusy(kind);
    setError(null);
    try {
      onDecided(await api<DecisionResult>(`/chat/actions/${card.id}/${kind}`, { method: 'POST', body: {} }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Import CSV">
      <header className="job-card__header">
        <span className="job-card__title">
          <FileSpreadsheet size={16} aria-hidden="true" /> Import CSV
        </span>
        <span className={`job-card__state job-card__state--${card.status}`}>
          {pending ? 'Needs your input' : card.status === 'confirmed' ? 'Imported' : 'Cancelled'}
        </span>
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {p.fileName} → {p.jobCode} {p.title}
        </p>
        <dl className="import-counts">
          <div>
            <dt>Rows</dt>
            <dd>{p.rows}</dd>
          </div>
          <div className="import-counts--good">
            <dt>New</dt>
            <dd>{p.fresh}</dd>
          </div>
          <div>
            <dt>Duplicates</dt>
            <dd>{p.duplicates}</dd>
          </div>
          <div>
            <dt>Unusable</dt>
            <dd>{p.invalid}</dd>
          </div>
        </dl>
        {pending && p.preview?.length > 0 && (
          <ul className="import-preview">
            {p.preview.map((person) => (
              <li key={person.name}>
                <strong>{person.name}</strong>
                {person.headline && <span className="muted"> · {person.headline}</span>}
              </li>
            ))}
            {p.fresh > p.preview.length && <li className="muted">…and {p.fresh - p.preview.length} more</li>}
          </ul>
        )}
        {pending && p.withoutText > 0 && (
          <p className="job-card__notes">
            {p.withoutText} new candidate{p.withoutText === 1 ? ' has' : 's have'} no description, so they won't get a score.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {pending ? (
          <>
            <div className="job-card__actions">
              <button type="button" className="button" onClick={() => decide('confirm')} disabled={busy !== null}>
                <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Importing…' : `Confirm: import ${p.fresh} & score`}
              </button>
              <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
            <p className="job-card__hint">Nothing is imported until you press Confirm. Scoring uses the AI (about 1 call per 10 people).</p>
          </>
        ) : (
          card.status === 'confirmed' && (
            <>
              {result?.taskId && <LiveScoring jobId={p.jobId} />}
              <Link className="job-card__open" to={`/jobs/${p.jobId}`}>
                Open candidates →
              </Link>
            </>
          )
        )}
      </div>
    </section>
  );
}
