/**
 * The job's Replies tab: one CONVERSATION per candidate, start to end.
 *
 *   [ Search by name ]  [ Simulate reply ]
 *   ┌ conversations ──────────┐┌ Priya Das ───────────────────────────────────────────┐
 *   │ Priya Das         2 min ││ You  · First email           "Opportunity for ..."   │
 *   │ Wants a meeting · Booked││ Priya · reply   "Sounds great, Thursday?"            │
 *   │ Rahim Uddin       1 h   ││   AI: Wants a meeting (95%) · Contacted → Interested │
 *   │ Question · waiting      ││ You  · answer   "Hi Priya, pick a time: <link>"      │
 *   └─────────────────────────┘│ 📅 Call booked: Sun 15 Nov, 14:00                    │
 *                              │ Priya · reply   "Also, is it remote?"  -> draft answer │
 *                              │                 [subject] [text]  [Send] [Discard]   │
 *                              └──────────────────────────────────────────────────────┘
 *
 * The AI reads each reply, moves the status, stops follow-ups and drafts an answer; nothing
 * is sent until you press Send. Opened from the bell: /jobs/:id/replies?candidate=<id>.
 */
import { AlertTriangle, CalendarCheck, Check, Inbox, Mail, MessageSquareReply, Search, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { LoadState, StatusChip } from '../components/DataParts';
import { EmptyState } from '../components/PageParts';
import { timeAgo } from '../format';
import type { CandidateStatus } from '../types';
import { notifyDataChanged, useApi } from '../useApi';
import { useJobTasks } from '../useJobTasks';
import { stepLabel } from './EmailsTab';

type Label = 'interested' | 'not_interested' | 'question' | 'wants_meeting' | 'unsubscribe';

type ReplyEvent = {
  kind: 'reply';
  at: string;
  id: string;
  subject: string;
  body: string;
  status: 'processing' | 'done' | 'failed';
  error: string | null;
  label: Label | null;
  confidence: number | null;
  summary: string | null;
  flagged: boolean;
  statusPath: string[];
  followUpsStopped: number;
  response: { subject: string | null; body: string | null; status: 'none' | 'draft' | 'sending' | 'sent' | 'discarded' | 'failed'; error: string | null };
};
type Event =
  | { kind: 'sent'; at: string; id: string; subject: string; body: string; step: number; day: number }
  | ReplyEvent
  | { kind: 'response'; at: string; id: string; subject: string | null; body: string | null; autoSent: boolean }
  | { kind: 'meeting'; at: string; id: string; slot: string | null };

interface Conversation {
  candidateId: string;
  candidateName: string;
  candidateStatus: CandidateStatus | null;
  email: string | null;
  lastAt: string;
  replies: number;
  label: Label | null;
  summary: string | null;
  processing: boolean;
  waiting: boolean;
  booked: boolean;
  events: Event[];
}

interface RepliesResponse {
  canReply: { id: string; name: string; status: CandidateStatus }[];
  conversations: Conversation[];
}

export const LABELS: Record<Label, string> = {
  interested: 'Interested',
  not_interested: 'Not interested',
  question: 'Question',
  wants_meeting: 'Wants a meeting',
  unsubscribe: 'Unsubscribe',
};

/** Ready-made replies for the simulator: one per kind. */
const EXAMPLES: { label: string; text: string }[] = [
  { label: 'Interested', text: 'Thanks for reaching out! This sounds like a great fit, I am interested.' },
  { label: 'Wants a meeting', text: 'Sounds great. Could we schedule a short call this week? Thursday afternoon works for me.' },
  { label: 'Question', text: 'Thanks! Before I decide: is the role fully remote, and what is the salary range?' },
  { label: 'Not interested', text: "Thank you, but I'm not interested right now. I'm happy in my current role." },
  { label: 'Unsubscribe', text: 'Please unsubscribe me and stop emailing me.' },
];

/** "Thu 19 Nov, 10:00 (Dhaka time)": same wording as the booking page. */
function slotText(iso: string): string {
  return `${new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} (Dhaka time)`;
}

export function RepliesTab({ jobId }: { jobId: string }) {
  const { data, error, loading } = useApi<RepliesResponse>(`/jobs/${jobId}/replies`);
  useJobTasks(jobId); // live: a reply being processed updates the list when it's done
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('candidate');
  const [search, setSearch] = useState('');
  const [simulating, setSimulating] = useState(false);

  if (!data) return <LoadState loading={loading} error={error} />;
  const query = search.trim().toLowerCase();
  const shown = data.conversations.filter((c) => !query || c.candidateName.toLowerCase().includes(query));
  const selected = data.conversations.find((c) => c.candidateId === selectedId) ?? shown[0] ?? null;
  const select = (candidateId: string) => setParams({ candidate: candidateId }, { replace: true });

  return (
    <div className="replies-tab">
      <div className="table-filters">
        <label className="table-filters__search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" aria-label="Search conversations by name" />
        </label>
        <button type="button" className="button" onClick={() => setSimulating(true)} disabled={data.canReply.length === 0} title={data.canReply.length ? 'Stands in for a real inbox' : 'Only candidates who were emailed can reply'}>
          <MessageSquareReply size={16} aria-hidden="true" /> Simulate reply
        </button>
      </div>

      <div className="card inbox">
        <div className="inbox__list">
          <div className="inbox__list-header">
            Conversations ({shown.length}
            {query ? ` of ${data.conversations.length}` : ''})
          </div>
          {data.conversations.length === 0 ? (
            <EmptyState icon={Inbox} title="No replies yet">
              When an emailed candidate replies, their conversation shows up here, read and labelled by the AI.
            </EmptyState>
          ) : shown.length === 0 ? (
            <p className="muted inbox__none">No conversation with "{search.trim()}".</p>
          ) : (
            <ul className="reply-list">
              {shown.map((c) => (
                <li key={c.candidateId}>
                  <button type="button" className={`reply-item${selected?.candidateId === c.candidateId ? ' reply-item--active' : ''}`} onClick={() => select(c.candidateId)}>
                    <span className="reply-item__top">
                      <strong>{c.candidateName}</strong>
                      <span className="muted small">{timeAgo(c.lastAt)}</span>
                    </span>
                    <span className="reply-item__meta">
                      {c.processing ? (
                        <span className="muted small">
                          <span className="task-progress__dot" aria-hidden="true" /> The AI is reading a reply…
                        </span>
                      ) : (
                        c.label && <span className={`reply-label reply-label--${c.label}`}>{LABELS[c.label]}</span>
                      )}
                      {c.waiting && <span className="small reply-item__response--draft">Answer waiting for you</span>}
                      {c.booked && (
                        <span className="small reply-item__meeting">
                          <CalendarCheck size={12} aria-hidden="true" /> Booked
                        </span>
                      )}
                      {c.replies > 1 && <span className="muted small">{c.replies} replies</span>}
                    </span>
                    {c.summary && <span className="muted small reply-item__summary">{c.summary}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected ? (
          <ConversationView key={selected.candidateId} jobId={jobId} conversation={selected} />
        ) : (
          <EmptyState icon={Mail} title="Select a conversation">
            You'll see everything with that candidate, start to end, and any drafted answer ready to send.
          </EmptyState>
        )}
      </div>

      {simulating && <SimulateDialog jobId={jobId} people={data.canReply} onClose={() => setSimulating(false)} onSent={select} />}
    </div>
  );
}

/** The whole conversation with one candidate, oldest first. */
function ConversationView({ jobId, conversation }: { jobId: string; conversation: Conversation }) {
  const first = conversation.candidateName.split(' ')[0];
  const endRef = useRef<HTMLDivElement>(null);
  // Open at the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [conversation.events.length]);

  return (
    <div className="reply-detail">
      <header className="reply-detail__head">
        <div>
          <h3>{conversation.candidateName}</h3>
          <span className="muted small">{conversation.email}</span>
        </div>
        {conversation.candidateStatus && <StatusChip status={conversation.candidateStatus} />}
      </header>

      <ol className="thread">
        {conversation.events.map((e) => {
          if (e.kind === 'sent') {
            return (
              <li key={e.id} className="thread__msg thread__msg--us">
                <div className="thread__meta">
                  You · {stepLabel(e.step, e.day)} · {timeAgo(e.at)}
                </div>
                <strong>{e.subject}</strong>
                <p>{e.body}</p>
              </li>
            );
          }
          if (e.kind === 'response') {
            return (
              <li key={e.id} className="thread__msg thread__msg--us">
                <div className="thread__meta">
                  You · answer{e.autoSent ? ' (sent automatically)' : ''} · {timeAgo(e.at)}
                </div>
                <strong>{e.subject}</strong>
                <p>{e.body}</p>
              </li>
            );
          }
          if (e.kind === 'meeting') {
            return (
              <li key={e.id} className="thread__event">
                <CalendarCheck size={14} aria-hidden="true" /> {first} booked a call{e.slot ? `: ${slotText(e.slot)}` : ''} · {timeAgo(e.at)}
              </li>
            );
          }
          return <ReplyBlock key={e.id} jobId={jobId} reply={e} first={first ?? ''} />;
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
}

/** One reply from them: their words, the AI's reading, and the drafted answer if it's waiting. */
function ReplyBlock({ jobId, reply, first }: { jobId: string; reply: ReplyEvent; first: string }) {
  return (
    <li className="thread__msg thread__msg--them">
      <div className="thread__meta">
        {first} · reply · {timeAgo(reply.at)}
      </div>
      <p>{reply.body}</p>
      {reply.status === 'processing' && (
        <p className="muted small">
          <span className="task-progress__dot" aria-hidden="true" /> The AI is reading it…
        </p>
      )}
      {reply.status === 'failed' && <p className="form-error">The AI couldn't process this reply: {reply.error}</p>}
      {reply.status === 'done' && reply.label && (
        <div className="thread__ai">
          <span className={`reply-label reply-label--${reply.label}`}>{LABELS[reply.label]}</span>
          {reply.confidence !== null && <span className="muted small">{Math.round(reply.confidence * 100)}% sure</span>}
          {reply.summary && <span className="small">{reply.summary}</span>}
          {(reply.statusPath.length > 0 || reply.followUpsStopped > 0) && (
            <span className="muted small thread__facts">
              {reply.statusPath.length > 0 && <>Status: {reply.statusPath.join(' → ')}. </>}
              {reply.followUpsStopped > 0 && (
                <>
                  {reply.followUpsStopped} follow-up{reply.followUpsStopped === 1 ? '' : 's'} stopped.
                </>
              )}
            </span>
          )}
          {reply.flagged && (
            <span className="flag-banner small">
              <AlertTriangle size={14} aria-hidden="true" /> This reply contained instructions for the AI. They were ignored; read it yourself. Never answered automatically.
            </span>
          )}
          {reply.label === 'unsubscribe' && <span className="muted small">They asked not to be contacted: no answer, no more emails.</span>}
        </div>
      )}
      {(reply.response.status === 'draft' || reply.response.status === 'failed') && <DraftAnswer jobId={jobId} reply={reply} />}
      {reply.response.status === 'discarded' && <p className="muted small">You chose not to answer this one.</p>}
    </li>
  );
}

/** The AI's drafted answer, editable, with Send / Discard. Nothing goes out before Send. */
function DraftAnswer({ jobId, reply }: { jobId: string; reply: ReplyEvent }) {
  const [subject, setSubject] = useState(reply.response.subject ?? '');
  const [body, setBody] = useState(reply.response.body ?? '');
  const [busy, setBusy] = useState<'send' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(reply.response.error);

  async function act(kind: 'send' | 'discard') {
    setBusy(kind);
    setError(null);
    try {
      await api(`/jobs/${jobId}/replies/${reply.id}/${kind}`, { method: 'POST', body: kind === 'send' ? { subject, body } : {} });
      notifyDataChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="reply-detail__response thread__draft">
      <h4>Drafted answer (nothing is sent until you press Send)</h4>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Answer subject" placeholder="Subject" />
      <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Answer text" />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button button--ghost" onClick={() => act('discard')} disabled={busy !== null}>
          <Trash2 size={16} aria-hidden="true" /> Discard
        </button>
        <button type="button" className="button" onClick={() => act('send')} disabled={busy !== null || !body.trim()}>
          <Send size={16} aria-hidden="true" /> {busy === 'send' ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

/** "Simulate reply": pick an emailed candidate, type (or pick) what they answered. */
function SimulateDialog({ jobId, people, onClose, onSent }: { jobId: string; people: RepliesResponse['canReply']; onClose: () => void; onSent: (candidateId: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [candidateId, setCandidateId] = useState(people[0]?.id ?? '');
  const [text, setText] = useState(EXAMPLES[1]!.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/jobs/${jobId}/candidates/${candidateId}/simulate-reply`, { method: 'POST', body: { body: text } });
      notifyDataChanged();
      onSent(candidateId);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not simulate the reply.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="details-dialog" aria-labelledby="simulate-title" onClose={onClose}>
      <div className="details-dialog__panel">
        <header className="details-dialog__header">
          <h2 id="simulate-title">
            <MessageSquareReply size={18} aria-hidden="true" /> Simulate a reply
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <p className="muted small">As if this candidate answered your email. The AI reads it, updates their status, stops their follow-ups and drafts an answer for you.</p>
        <div className="form-row">
          <label htmlFor="sim-candidate">From</label>
          <select id="sim-candidate" value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <span className="form-label">Examples</span>
          <div className="reply-examples">
            {EXAMPLES.map((e) => (
              <button key={e.label} type="button" className={`chip${text === e.text ? ' chip--active' : ''}`} onClick={() => setText(e.text)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="sim-text">Their reply</label>
          <textarea id="sim-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button" onClick={submit} disabled={busy || !candidateId || !text.trim()}>
            <Check size={16} aria-hidden="true" /> {busy ? 'Sending…' : 'Simulate reply'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
