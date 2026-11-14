/**
 * Chat cards for changing or deleting an existing job (the AI proposes, you confirm):
 *
 *   <JobEditCard>    "Edit JOB-0007": each changed field as  old → new  (the new values can
 *                    still be adjusted), then Confirm / Cancel
 *   <JobDeleteCard>  red card: "Delete JOB-0007? 23 candidates will be removed." Confirm / Cancel
 *   <SendReplyCard>   a candidate replied: their message + the AI's drafted answer (editable) -> Send
 *   <SimulateReplyCard> "pretend Priya answered this" (stands in for a real inbox) -> Confirm
 *   <CreateCampaignCard> outreach: who (ticked; only Accepted with an email) + single / Day 0,3,7
 *                    -> the AI drafts -> posts a preview with an <ApproveCampaignCard>
 *   <ApproveCampaignCard> "Approve & send 6 emails" (nothing is sent before this)
 *   <StatusChangeCard> "Move to Accepted": who (ticked), from which status; ones the rules don't
 *                    allow are greyed out with the reason. Confirm -> moved (+ activity log)
 *   <EditContactCard>  "Edit contact: Rafi Karim": email / profile link, old -> new (editable)
 *   <DeleteAllCandidatesCard> red card: "Delete all 33 candidates of JOB-0003?" (the job stays)
 *   <ScoreAgainCard>   "Score 22 unscored candidates in JOB-0002 again?" Confirm -> live progress
 *                    -> the AI posts the result
 *   <FindCandidatesCard> "Find candidates for JOB-0003": sites + search words (editable),
 *                    Confirm -> web search -> new people scored -> the AI posts the best matches
 *   <DeleteCandidateCard> red card: "Remove Abir Hossain from JOB-0003?" Confirm / Keep
 *   <AddCandidateCard> "Add candidate to JOB-0007": every field editable (e.g. fix an email
 *                    typo the AI pointed out), Confirm -> added + scored, with live progress;
 *                    when scoring is done the AI posts the score and rank in the chat
 *
 * Both use the same card look as the job card (dark header = "needs your input") and call
 * POST /api/chat/actions/:id/confirm|cancel, which runs the same code as the Edit and
 * Delete buttons on the Jobs page.
 */
import { ArrowRightLeft, Check, Mail, MessageSquareReply, PencilLine, RefreshCw, Search, Send, Trash2, UserMinus, UserPlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { remoteLabel } from '../format';
import type { Job } from '../types';
import type { ChatMessage } from './ChatPanel';
import { SOURCE_HINTS, type SourceSearch } from '../components/FindCandidatesDialog';
import { useJobTasks } from '../useJobTasks';
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

/** Red card: "Remove NAME from JOB-0003?" Same function as the trash button on the job page. */
export function DeleteCandidateCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as {
    jobId: string;
    jobCode?: string;
    title?: string;
    name?: string;
    email?: string | null;
    headline?: string | null;
    score?: number | null;
  };
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';

  return (
    <section className={`job-card job-card--danger job-card--${card.status}`} aria-label="Proposed candidate removal">
      <header className="job-card__header">
        <span className="job-card__title">
          <UserMinus size={16} aria-hidden="true" /> Remove candidate
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {pending ? 'Remove' : card.status === 'confirmed' ? 'Removed' : 'Kept'} <strong>{payload.name}</strong>
          {payload.score !== null && payload.score !== undefined && <> (score {payload.score})</>}{' '}
          {pending ? 'from' : card.status === 'confirmed' ? 'from' : 'in'} {payload.jobCode} {payload.title}
          {pending && '? This can\'t be undone.'}
        </p>
        {(payload.headline || payload.email) && (
          <p className="muted small">{[payload.headline, payload.email].filter(Boolean).join(' · ')}</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending && (
          <div className="job-card__actions">
            <button type="button" className="button button--danger" onClick={() => decide('confirm')} disabled={busy !== null}>
              <Trash2 size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Removing…' : 'Remove candidate'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Keep
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Live progress for a confirmed web search: first the search ("LinkedIn page 1 of 1: 9
 * found"), then the scoring of the new people. When both are finished it asks the server
 * for the AI's follow-up ("found 24 profiles: 19 new. Best new matches: …").
 */
function LiveSearch({ jobId, cardId, taskId, onMessage }: { jobId: string; cardId: string; taskId: string; onMessage?: (m: ChatMessage) => void }) {
  const { tasks } = useJobTasks(jobId);
  const asked = useRef(false);
  const searchTask = tasks.find((t) => t.id === taskId);
  // The scoring the search started (created after it).
  const scoring = searchTask
    ? tasks.find((t) => t.type === 'score_candidates' && t.createdAt && searchTask.createdAt && t.createdAt >= searchTask.createdAt)
    : undefined;
  const isActive = (t?: { status: string }) => t?.status === 'queued' || t?.status === 'running';
  const finished = Boolean(searchTask) && !isActive(searchTask) && !isActive(scoring);

  useEffect(() => {
    if (!finished || !onMessage || asked.current) return;
    asked.current = true;
    api<{ message: ChatMessage }>(`/chat/actions/${cardId}/follow-up`, { method: 'POST', body: {} })
      .then((data) => onMessage(data.message))
      .catch(() => {
        asked.current = false; // e.g. scoring hadn't been queued yet: try again on the next update
      });
  }, [finished, cardId, onMessage, tasks]);

  const shown = isActive(scoring) || (scoring && !isActive(searchTask)) ? scoring : searchTask;
  if (!shown) return <p className="job-card__hint">Starting the web search…</p>;
  const percent = shown.progress.total ? Math.round((shown.progress.done / shown.progress.total) * 100) : 100;
  return (
    <div className={`task-progress task-progress--${shown.status}`} role="status" aria-live="polite">
      <span className="task-progress__text">
        {isActive(shown) && <span className="task-progress__dot" aria-hidden="true" />}
        {shown.message}
      </span>
      {shown.progress.total > 0 && (
        <span className="task-progress__track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <span style={{ width: `${percent}%` }} />
        </span>
      )}
    </div>
  );
}

/** "Find candidates for JOB-0003": which sites, with what search words, how many results. */
export function FindCandidatesCard({
  card,
  onDecided,
  onMessage,
}: {
  card: ActionCard;
  onDecided: (r: DecisionResult) => void;
  onMessage?: (message: ChatMessage) => void;
}) {
  const payload = card.payload as { jobId: string; jobCode?: string; title?: string; searches: SourceSearch[]; pages: number };
  const [searches, setSearches] = useState<SourceSearch[]>(payload.searches);
  const [pages, setPages] = useState(payload.pages ?? 1);
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const result = card.result as { taskId?: string | null } | null;
  const chosen = searches.filter((s) => s.checked);
  const update = (source: SourceSearch['source'], change: Partial<SourceSearch>) =>
    setSearches((all) => all.map((s) => (s.source === source ? { ...s, ...change } : s)));

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Proposed web search for candidates">
      <header className="job-card__header">
        <span className="job-card__title">
          <Search size={16} aria-hidden="true" /> Find candidates
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          → {payload.jobCode} {payload.title}
        </p>
        <div className="source-list source-list--card">
          {searches.map((s) => (
            <div key={s.source} className={`source-row${s.checked ? '' : ' source-row--off'}`}>
              <label className="source-row__name">
                <input type="checkbox" checked={Boolean(s.checked)} onChange={(e) => update(s.source, { checked: e.target.checked })} disabled={!pending} />
                <strong>{s.label}</strong> <span className="muted small">{SOURCE_HINTS[s.source]}</span>
              </label>
              <input
                className="source-row__query"
                value={s.query}
                onChange={(e) => update(s.source, { query: e.target.value })}
                disabled={!pending || !s.checked}
                aria-label={`${s.label} search words`}
              />
            </div>
          ))}
        </div>
        <label className="job-card__field">
          <span>Results per site</span>
          <select value={pages} onChange={(e) => setPages(Number(e.target.value))} disabled={!pending}>
            <option value={1}>Up to 10</option>
            <option value={2}>Up to 20</option>
            <option value={3}>Up to 30</option>
          </select>
        </label>
        {pending && (
          <p className="job-card__hint">
            {chosen.length
              ? `Up to ${chosen.length * pages * 10} profiles · ${chosen.length * pages} web search${chosen.length * pages === 1 ? '' : 'es'}. New people are added (duplicates skipped) and scored automatically.`
              : 'Tick at least one site.'}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending ? (
          <div className="job-card__actions">
            <button
              type="button"
              className="button"
              onClick={() => decide('confirm', { searches, pages })}
              disabled={busy !== null || chosen.length === 0 || chosen.some((s) => s.query.trim().length < 3)}
            >
              <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Starting…' : 'Confirm: search & score'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          </div>
        ) : (
          card.status === 'confirmed' && (
            <>
              {result?.taskId && <LiveSearch jobId={payload.jobId} cardId={card.id} taskId={result.taskId} onMessage={onMessage} />}
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

/** "Score 22 unscored candidates in JOB-0002 again?" (offered when the AI had a problem). */
export function ScoreAgainCard({
  card,
  onDecided,
  onMessage,
}: {
  card: ActionCard;
  onDecided: (r: DecisionResult) => void;
  onMessage?: (message: ChatMessage) => void;
}) {
  const payload = card.payload as { jobId: string; jobCode?: string; title?: string; unscored?: number };
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const result = card.result as { taskId?: string | null } | null;
  const n = payload.unscored ?? 0;

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Score unscored candidates again">
      <header className="job-card__header">
        <span className="job-card__title">
          <RefreshCw size={16} aria-hidden="true" /> Score again
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {pending ? 'Score' : card.status === 'confirmed' ? 'Scoring' : 'Not scoring'} the <strong>{n}</strong> unscored candidate
          {n === 1 ? '' : 's'} in {payload.jobCode} {payload.title}
          {pending ? ' again?' : '.'}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending ? (
          <div className="job-card__actions">
            <button type="button" className="button" onClick={() => decide('confirm')} disabled={busy !== null}>
              <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Starting…' : 'Confirm: score again'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          </div>
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

/** Red card: "Delete all 33 candidates of JOB-0003?" Same function as the "Delete all" button. */
export function DeleteAllCandidatesCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as { jobId: string; jobCode?: string; title?: string; count?: number };
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const n = payload.count ?? 0;

  return (
    <section className={`job-card job-card--danger job-card--${card.status}`} aria-label="Proposed removal of all candidates">
      <header className="job-card__header">
        <span className="job-card__title">
          <Trash2 size={16} aria-hidden="true" /> Delete all candidates
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {pending ? 'Delete' : card.status === 'confirmed' ? 'Deleted' : 'Kept'} all{' '}
          <strong>
            {n} candidate{n === 1 ? '' : 's'}
          </strong>{' '}
          of {payload.jobCode} {payload.title}
          {pending && '? The job itself stays. This can\'t be undone.'}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending && (
          <div className="job-card__actions">
            <button type="button" className="button button--danger" onClick={() => decide('confirm')} disabled={busy !== null}>
              <Trash2 size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Deleting…' : 'Delete all'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Keep
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const CONTACT_LABELS: Record<string, string> = { email: 'Email', profileUrl: 'Profile link' };

/** "Edit contact: Rafi Karim": the email / profile link, old -> new (still editable). */
export function EditContactCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as {
    jobId: string;
    jobCode?: string;
    name?: string;
    before: Record<string, string | null>;
    changes: Record<string, string | null>;
  };
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(payload.changes).map(([k, v]) => [k, v ?? ''])),
  );
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Proposed contact change">
      <header className="job-card__header">
        <span className="job-card__title">
          <PencilLine size={16} aria-hidden="true" /> Edit contact
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {payload.name} · {payload.jobCode}
        </p>
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
                <th scope="row">{CONTACT_LABELS[key] ?? key}</th>
                <td className="change-table__old">{payload.before?.[key] || 'None'}</td>
                <td>
                  {pending ? (
                    <input
                      value={values[key]}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      aria-label={`New ${CONTACT_LABELS[key] ?? key}`}
                    />
                  ) : (
                    <strong>{payload.changes[key] || 'None'}</strong>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        {pending && (
          <>
            <div className="job-card__actions">
              <button type="button" className="button" onClick={() => decide('confirm', values)} disabled={busy !== null}>
                <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Saving…' : 'Confirm'}
              </button>
              <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
            <p className="job-card__hint">Nothing changes until you press Confirm. You can fix the new value first.</p>
          </>
        )}
      </div>
    </section>
  );
}

/** "Move to Accepted": the people, ticked; the ones the pipeline rules don't allow are greyed out. */
export function StatusChangeCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as {
    jobCode?: string;
    title?: string;
    toLabel?: string;
    candidates: { id: string; name: string; fromLabel: string; score: number | null; rank: number | null; allowed: boolean; reason: string | null }[];
  };
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(payload.candidates.filter((c) => c.allowed).map((c) => c.id)));
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Proposed status change">
      <header className="job-card__header">
        <span className="job-card__title">
          <ArrowRightLeft size={16} aria-hidden="true" /> Move to {payload.toLabel}
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {payload.jobCode} {payload.title}
        </p>
        <ul className="status-pick">
          {payload.candidates.map((c) => (
            <li key={c.id} className={c.allowed ? '' : 'status-pick__off'}>
              <label>
                <input type="checkbox" checked={ticked.has(c.id)} onChange={() => toggle(c.id)} disabled={!pending || !c.allowed} />
                <strong>{c.name}</strong>
                <span className="muted small">
                  {c.rank ? ` #${c.rank}` : ''}
                  {c.score !== null ? ` · ${c.score}` : ''} · {c.fromLabel} → {payload.toLabel}
                </span>
              </label>
              {!c.allowed && c.reason && <span className="status-pick__reason">{c.reason}</span>}
            </li>
          ))}
        </ul>
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
        {pending && (
          <div className="job-card__actions">
            <button type="button" className="button" onClick={() => decide('confirm', { candidateIds: [...ticked] })} disabled={busy !== null || ticked.size === 0}>
              <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Saving…' : `Confirm (${ticked.size})`}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** "Create campaign": who gets it (ticked) and single email vs Day 0 / 3 / 7. */
export function CreateCampaignCard({
  card,
  onDecided,
  onMessage,
}: {
  card: ActionCard;
  onDecided: (r: DecisionResult) => void;
  onMessage?: (message: ChatMessage) => void;
}) {
  const payload = card.payload as {
    jobId: string;
    jobCode?: string;
    title?: string;
    sequence: 'single' | 'sequence';
    candidates: { id: string; name: string; email: string; score: number | null }[];
  };
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(payload.candidates.map((c) => c.id)));
  const [sequence, setSequence] = useState<'single' | 'sequence'>(payload.sequence);
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const result = card.result as { taskId?: string | null } | null;
  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Proposed outreach campaign">
      <header className="job-card__header">
        <span className="job-card__title">
          <Mail size={16} aria-hidden="true" /> Create campaign
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {payload.jobCode} {payload.title}
        </p>
        <div className="segmented" role="radiogroup" aria-label="Single email or sequence">
          {(['single', 'sequence'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sequence === s}
              className={`segmented__option${sequence === s ? ' segmented__option--active' : ''}`}
              onClick={() => setSequence(s)}
              disabled={!pending}
            >
              {s === 'single' ? 'Single email' : 'Day 0 / 3 / 7'}
            </button>
          ))}
        </div>
        <ul className="status-pick">
          {payload.candidates.map((c) => (
            <li key={c.id}>
              <label>
                <input type="checkbox" checked={ticked.has(c.id)} onChange={() => toggle(c.id)} disabled={!pending} />
                <strong>{c.name}</strong>
                <span className="muted small">
                  {c.email}
                  {c.score !== null ? ` · ${c.score}` : ''}
                </span>
              </label>
            </li>
          ))}
        </ul>
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
              <button
                type="button"
                className="button"
                onClick={() => decide('confirm', { candidateIds: [...ticked], sequence })}
                disabled={busy !== null || ticked.size === 0}
              >
                <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Creating…' : `Confirm: draft for ${ticked.size}`}
              </button>
              <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
            <p className="job-card__hint">This only writes drafts. You review them, and nothing is sent until you approve.</p>
          </>
        ) : (
          card.status === 'confirmed' && (
            <>
              {result?.taskId && <LiveScoring jobId={payload.jobId} cardId={card.id} taskId={result.taskId} onMessage={onMessage} />}
              <Link className="job-card__open" to={`/jobs/${payload.jobId}/emails`}>
                Open the drafts →
              </Link>
            </>
          )
        )}
      </div>
    </section>
  );
}

/** "Approve & send": the only step that sends outreach. */
export function ApproveCampaignCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as { jobId: string; jobCode?: string; name?: string; emails?: number; candidates?: number; stepDays?: number[]; mode?: string };
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const result = card.result as { taskId?: string | null } | null;

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Approve outreach campaign">
      <header className="job-card__header">
        <span className="job-card__title">
          <Send size={16} aria-hidden="true" /> Approve &amp; send
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">{payload.name}</p>
        <p className="small">
          {payload.emails} email{payload.emails === 1 ? '' : 's'} to {payload.candidates} candidate{payload.candidates === 1 ? '' : 's'}
          {(payload.stepDays?.length ?? 1) > 1 ? `, sent on Day ${payload.stepDays!.join(' / ')} (follow-ups stop if they reply)` : ''}.
          {payload.mode === 'sandbox' ? ' Sandbox: they go to the test inbox (Mailpit), not to real candidates.' : ' Live: real emails to the candidates.'}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending ? (
          <div className="job-card__actions">
            <button type="button" className="button" onClick={() => decide('confirm')} disabled={busy !== null}>
              <Send size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Approving…' : 'Approve & send'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Not yet
            </button>
          </div>
        ) : (
          card.status === 'confirmed' && result?.taskId && <LiveScoring jobId={payload.jobId} taskId={result.taskId} />
        )}
        <Link className="job-card__open" to={`/jobs/${payload.jobId}/emails`}>
          {pending ? 'Check or edit the drafts first →' : 'Open the Emails tab →'}
        </Link>
      </div>
    </section>
  );
}

const REPLY_LABELS: Record<string, string> = {
  interested: 'Interested',
  not_interested: 'Not interested',
  question: 'Question',
  wants_meeting: 'Wants a meeting',
  unsubscribe: 'Unsubscribe',
};

/** A candidate replied: their message, the AI's label, and the drafted answer (editable) -> Send. */
export function SendReplyCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as { jobId: string; jobCode?: string; candidateName?: string; label?: string; theirReply?: string; subject?: string; body?: string };
  const [subject, setSubject] = useState(payload.subject ?? '');
  const [body, setBody] = useState(payload.body ?? '');
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Answer to a candidate's reply">
      <header className="job-card__header">
        <span className="job-card__title">
          <Send size={16} aria-hidden="true" /> Answer {payload.candidateName}
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          {payload.jobCode} · {payload.label ? (REPLY_LABELS[payload.label] ?? payload.label) : 'Reply'}
        </p>
        {payload.theirReply && <blockquote className="reply-quote">{payload.theirReply}</blockquote>}
        <label className="job-card__field">
          <span>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!pending} />
        </label>
        <label className="job-card__field">
          <span>Response</span>
          <textarea className="job-card__textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} disabled={!pending} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending ? (
          <div className="job-card__actions">
            <button type="button" className="button" onClick={() => decide('confirm', { subject, body })} disabled={busy !== null || !body.trim()}>
              <Send size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Sending…' : 'Send'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Not now
            </button>
          </div>
        ) : (
          <Link className="job-card__open" to={`/jobs/${payload.jobId}/replies`}>
            Open the Replies tab →
          </Link>
        )}
      </div>
    </section>
  );
}

/** "Simulate a reply from Priya": stands in for a real inbox. Confirm -> the AI handles it. */
export function SimulateReplyCard({ card, onDecided }: { card: ActionCard; onDecided: (r: DecisionResult) => void }) {
  const payload = card.payload as { jobId: string; jobCode?: string; candidateName?: string; body: string };
  const [body, setBody] = useState(payload.body);
  const { busy, error, decide } = useDecision(card, onDecided);
  const pending = card.status === 'pending';
  const result = card.result as { taskId?: string | null } | null;

  return (
    <section className={`job-card job-card--${card.status}`} aria-label="Simulate a candidate reply">
      <header className="job-card__header">
        <span className="job-card__title">
          <MessageSquareReply size={16} aria-hidden="true" /> Simulate reply
        </span>
        <StateLabel status={card.status} />
      </header>
      <div className="job-card__body">
        <p className="job-card__lead">
          From {payload.candidateName} · {payload.jobCode}
        </p>
        <label className="job-card__field">
          <span>Their reply</span>
          <textarea className="job-card__textarea" rows={4} value={body} onChange={(e) => setBody(e.target.value)} disabled={!pending} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {pending ? (
          <div className="job-card__actions">
            <button type="button" className="button" onClick={() => decide('confirm', { body })} disabled={busy !== null || !body.trim()}>
              <Check size={16} aria-hidden="true" /> {busy === 'confirm' ? 'Sending…' : 'Confirm'}
            </button>
            <button type="button" className="button button--ghost" onClick={() => decide('cancel')} disabled={busy !== null}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          </div>
        ) : (
          card.status === 'confirmed' && (
            <>
              {result?.taskId && <LiveScoring jobId={payload.jobId} taskId={result.taskId} />}
              <Link className="job-card__open" to={`/jobs/${payload.jobId}/replies`}>
                Open the Replies tab →
              </Link>
            </>
          )
        )}
      </div>
    </section>
  );
}
