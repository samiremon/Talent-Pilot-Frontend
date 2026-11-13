/**
 * Chat cards for changing or deleting an existing job (the AI proposes, you confirm):
 *
 *   <JobEditCard>    "Edit JOB-0007": each changed field as  old → new  (the new values can
 *                    still be adjusted), then Confirm / Cancel
 *   <JobDeleteCard>  red card: "Delete JOB-0007? 23 candidates will be removed." Confirm / Cancel
 *   <AddCandidateCard> "Add candidate to JOB-0007": every field editable (e.g. fix an email
 *                    typo the AI pointed out), Confirm -> added + scored, with live progress;
 *                    when scoring is done the AI posts the score and rank in the chat
 *
 * Both use the same card look as the job card (dark header = "needs your input") and call
 * POST /api/chat/actions/:id/confirm|cancel, which runs the same code as the Edit and
 * Delete buttons on the Jobs page.
 */
import { Check, PencilLine, Trash2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { remoteLabel } from '../format';
import type { Job } from '../types';
import type { ChatMessage } from './ChatPanel';
import { LiveScoring } from './ImportCsvCard';
import type { ActionCard, DecisionResult } from './JobCard';

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  company: 'Company',
  description: 'Description',
  seniority: 'Seniority',
  location: 'Location',
  salary: 'Salary',
  remotePolicy: 'Work style',
  mustHaveSkills: 'Must-have skills',
  niceToHaveSkills: 'Nice-to-have skills',
};

/** A value as readable text: lists joined, work style named, empty = "Unknown". */
function show(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Unknown';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';
  if (key === 'remotePolicy') return remoteLabel(value as Job['remotePolicy']);
  return String(value);
}

/** Confirm/Cancel buttons + the request, shared by both cards. */
function useDecision(card: ActionCard, onDecided: (r: DecisionResult) => void) {
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function decide(kind: 'confirm' | 'cancel', fields?: Record<string, unknown>) {
    setBusy(kind);
    setError(null);
    try {
      const result = await api<DecisionResult>(`/chat/actions/${card.id}/${kind}`, {
        method: 'POST',
        body: kind === 'confirm' && fields ? { fields } : {},
      });
      onDecided(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, decide };
}

function StateLabel({ status }: { status: ActionCard['status'] }) {
  return (
    <span className={`job-card__state job-card__state--${status}`}>
      {status === 'pending' ? 'Needs your input' : status === 'confirmed' ? 'Done' : 'Cancelled'}
    </span>
  );
}

export function JobEditCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as {
    jobId: string;
    jobCode?: string;
    title?: string;
    changes: Record<string, unknown>;
    before: Record<string, unknown>;
  };
  // The new values, as editable text (lists as "a, b, c").
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(payload.changes).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v ?? '')]),
    ),
  );
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';

  /** Back to the right types: lists split on commas; work style kept as its code. */
  function finalFields(): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(values).map(([k, v]) => [
        k,
        Array.isArray(payload.changes[k])
          ? v
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : v.trim(),
      ]),
    );
  }

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Proposed job edit">
      <header className="job-card__header">
        <span className="job-card__title">
          <PencilLine size={16} aria-hidden="true" /> Edit {payload.jobCode ?? 'job'}
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">{payload.title}</p>
        <table className="change-table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Now</th>
              <th scope="col">New</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(payload.changes).map((key) => (
              <tr key={key}>
                <th scope="row">{FIELD_LABELS[key] ?? key}</th>
                <td className="change-table__old">{show(key, payload.before?.[key])}</td>
                <td>
                  {pending && key === 'remotePolicy' ? (
                    <select
                      value={values[key]}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      aria-label={`New ${FIELD_LABELS[key]}`}
                    >
                      <option value="unknown">Unknown</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">On-site</option>
                    </select>
                  ) : pending ? (
                    <input
                      value={values[key]}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      aria-label={`New ${FIELD_LABELS[key] ?? key}`}
                    />
                  ) : (
                    <strong>{show(key, payload.changes[key])}</strong>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending ? (
          <>
            <div className="job-card__actions">
              <button type="button" className="button" onClick={() => decide('confirm', finalFields())} disabled={busy !== null}>
                <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Saving…' : 'Confirm'}
              </button>
              <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
            <p className="job-card__hint">Nothing changes until you press Confirm. You can adjust the new values first.</p>
          </>
        ) : (
          card.status === 'confirmed' && (
            <Link className="job-card__open" to={`/jobs/${payload.jobId}`}>
              Open job →
            </Link>
          )
        )}
      </div>
    </section>
  );
}

export function JobDeleteCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as { jobCode?: string; title?: string; candidateCount?: number };
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const count = payload.candidateCount ?? 0;

  return (
    <section className={`job-card job-card--danger job-card--${card.status}`} aria-label="Proposed job deletion">
      <header className="job-card__header">
        <span className="job-card__title">
          <Trash2 size={16} aria-hidden="true" /> Delete {payload.jobCode ?? 'job'}
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {pending ? 'Delete' : card.status === 'confirmed' ? 'Deleted' : 'Kept'} <strong>{payload.title}</strong>
          {pending && (
            <>
              {' '}
              and its <strong>{count} candidate{count === 1 ? '' : 's'}</strong>? This can't be undone (the history is kept).
            </>
          )}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending && (
          <div className="job-card__actions">
            <button type="button" className="button button--danger" onClick={() => decide('confirm')} disabled={busy !== null}>
              <Trash2 size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Deleting…' : 'Delete job'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Keep it
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const CANDIDATE_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'headline', label: 'Title' },
  { key: 'location', label: 'Location' },
  { key: 'profileUrl', label: 'Profile link' },
] as const;

export function AddCandidateCard({
  card,
  onDecided,
  onMessage,
}: {
  card: ActionCard;
  onDecided: (r: DecisionResult) => void;
  /** Gets the AI's "scored X/100, rank #N" message once scoring is done. */
  onMessage?: (message: ChatMessage) => void;
}) {
  const payload = card.payload as { jobId: string; jobCode?: string; title?: string; candidate: Record<string, string | null> };
  const [values, setValues] = useState<Record<string, string>>(() => ({
    name: payload.candidate.name ?? '',
    email: payload.candidate.email ?? '',
    headline: payload.candidate.headline ?? '',
    location: payload.candidate.location ?? '',
    profileUrl: payload.candidate.profileUrl ?? '',
    profileText: payload.candidate.profileText ?? '',
  }));
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const result = card.result as { taskId?: string | null } | null;
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Proposed new candidate">
      <header className="job-card__header">
        <span className="job-card__title">
          <UserPlus size={16} aria-hidden="true" /> Add candidate
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          → {payload.jobCode} {payload.title}
        </p>
        <div className="job-card__grid">
          {CANDIDATE_FIELDS.map(({ key, label }) => (
            <label key={key} className="job-card__field">
              <span>{label}</span>
              <input value={values[key]} onChange={(e) => set(key, e.target.value)} disabled={!pending} placeholder="Unknown" />
            </label>
          ))}
        </div>
        <label className="job-card__field">
          <span>Experience &amp; skills (what the AI scores)</span>
          <textarea
            className="job-card__textarea"
            rows={3}
            value={values.profileText}
            onChange={(e) => set('profileText', e.target.value)}
            disabled={!pending}
            placeholder="Unknown"
          />
        </label>
        {card.notes.length > 0 && pending && (
          <ul className="job-card__notes">
            {card.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending ? (
          <>
            <div className="job-card__actions">
              <button type="button" className="button" onClick={() => decide('confirm', values)} disabled={busy !== null || !values.name?.trim()}>
                <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Adding…' : 'Confirm: add & score'}
              </button>
              <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
            <p className="job-card__hint">Nothing is added until you press Confirm. You can fix any field first.</p>
          </>
        ) : (
          card.status === 'confirmed' && (
            <>
              {result?.taskId && <LiveScoring jobId={payload.jobId} cardId={card.id} taskId={result.taskId} onMessage={onMessage} />}
              <Link className="job-card__open" to={`/jobs/${payload.jobId}`}>
                Open candidates →
              </Link>
            </>
          )
        )}
      </div>
    </section>
  );
}
