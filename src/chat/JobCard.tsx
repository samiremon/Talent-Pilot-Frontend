/**
 * The job card the AI shows after reading a pasted job description.
 *
 * While "pending": every field is editable, and nothing exists yet. Confirm sends the
 * fields (with the recruiter's edits) to POST /api/chat/actions/:id/confirm, which creates
 * the job with the same code as the New job form. Cancel drops it.
 * After that the card shows the result ("Created → Open job" / "Cancelled").
 *
 * Look: cards are deliberately NOT chat bubbles. They have a dark "form" header strip,
 * a cool grey body and a "Needs your input" label, so the recruiter can tell at a glance
 * "this is something I fill in / approve" vs "this is the AI talking".
 */
import { Check, ClipboardList, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { TagInput } from '../components/TagInput';
import type { Job } from '../types';

export interface ActionCard {
  id: string;
  type: 'create_job' | 'update_job' | 'delete_job' | 'import_csv' | 'add_candidate' | 'delete_candidate' | 'find_candidates' | 'score_candidates' | 'delete_all_candidates' | 'update_candidate' | 'change_status' | 'create_campaign' | 'approve_campaign';
  status: 'pending' | 'confirmed' | 'cancelled';
  payload: Record<string, unknown>;
  notes: string[];
  result: { jobId?: string; title?: string } | null;
}

/** What the server sends back after Confirm/Cancel: the updated card + a chat note. */
export interface DecisionResult {
  card: ActionCard;
  message: unknown;
}

interface Fields {
  title: string;
  company: string;
  seniority: string;
  location: string;
  salary: string;
  remotePolicy: Job['remotePolicy'];
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
}

function toFields(payload: Record<string, unknown>): Fields {
  const text = (key: string) => (typeof payload[key] === 'string' ? (payload[key] as string) : '');
  const list = (key: string) => (Array.isArray(payload[key]) ? (payload[key] as string[]) : []);
  return {
    title: text('title'),
    company: text('company'),
    seniority: text('seniority'),
    location: text('location'),
    salary: text('salary'),
    remotePolicy: (text('remotePolicy') || 'unknown') as Job['remotePolicy'],
    mustHaveSkills: list('mustHaveSkills'),
    niceToHaveSkills: list('niceToHaveSkills'),
  };
}

export function JobCard({ card, onDecided }: { card: ActionCard; onDecided: (result: DecisionResult) => void }) {
  const [fields, setFields] = useState<Fields>(() => toFields(card.payload));
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = card.status === 'pending';

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((f) => ({ ...f, [key]: value }));

  async function decide(kind: 'confirm' | 'cancel') {
    setBusy(kind);
    setError(null);
    try {
      const result = await api<DecisionResult>(`/chat/actions/${card.id}/${kind}`, {
        method: 'POST',
        body: kind === 'confirm' ? { fields } : {},
      });
      onDecided(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  // One labelled input; read-only once the card is decided.
  const input = (key: 'title' | 'company' | 'seniority' | 'location' | 'salary', label: string) => (
    <label className="job-card__field">
      <span>{label}</span>
      <input
        value={fields[key]}
        onChange={(e) => set(key, e.target.value)}
        disabled={!pending}
        placeholder="Unknown"
      />
    </label>
  );

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Proposed job">
      <header className="job-card__header">
        <span className="job-card__title">
          <ClipboardList size={16} aria-hidden="true" /> Job card
        </span>
        <span className={`job-card__state job-card__state--${card.status}`}>
          {pending ? 'Needs your input' : card.status === 'confirmed' ? 'Created' : 'Cancelled'}
        </span>
      </header>

      <div className="job-card__body">

      <div className="job-card__grid">
        {input('title', 'Title')}
        {input('company', 'Company')}
        {input('seniority', 'Seniority')}
        {input('location', 'Location')}
        {input('salary', 'Salary')}
        <label className="job-card__field">
          <span>Work style</span>
          <select
            value={fields.remotePolicy}
            onChange={(e) => set('remotePolicy', e.target.value as Job['remotePolicy'])}
            disabled={!pending}
          >
            <option value="unknown">Unknown</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </label>
      </div>

      <div className="job-card__field">
        <span>Must-have skills</span>
        {pending ? (
          <TagInput id={`must-${card.id}`} value={fields.mustHaveSkills} onChange={(v) => set('mustHaveSkills', v)} />
        ) : (
          <span className="job-card__tags">{fields.mustHaveSkills.join(', ') || 'Unknown'}</span>
        )}
      </div>
      <div className="job-card__field">
        <span>Nice-to-have skills</span>
        {pending ? (
          <TagInput id={`nice-${card.id}`} value={fields.niceToHaveSkills} onChange={(v) => set('niceToHaveSkills', v)} />
        ) : (
          <span className="job-card__tags">{fields.niceToHaveSkills.join(', ') || 'None'}</span>
        )}
      </div>

      {card.notes.length > 0 && (
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
            <button type="button" className="button" onClick={() => decide('confirm')} disabled={busy !== null || !fields.title.trim()}>
              <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Creating…' : 'Confirm'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          </div>
          <p className="job-card__hint">Nothing is created until you press Confirm. You can edit any field first.</p>
        </>
      ) : (
        card.status === 'confirmed' &&
        card.result?.jobId && (
          <Link className="job-card__open" to={`/jobs/${card.result.jobId}`}>
            Open job →
          </Link>
        )
      )}
      </div>
    </section>
  );
}
