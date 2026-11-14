/**
 * The job's Replies tab: candidates' answers to outreach, read by the AI.
 *
 *   [ Simulate reply ]       (stands in for a real inbox, as the brief allows)
 *   ┌ inbox ──────────────────┐┌ the selected reply ─────────────────────────────────┐
 *   │ Priya Das               ││ Their message: "Sounds great, Thursday works?"       │
 *   │ Wants a meeting · Draft ││ AI: Wants a meeting (95%) · Contacted → Replied →    │
 *   │ Rahim Uddin             ││     Interested · 2 follow-ups stopped                │
 *   │ Not interested · Sent   ││ Response (draft): [subject] [text with booking link] │
 *   └─────────────────────────┘│ [ Send ] [ Discard ]          Meeting: booked Thu 10:00│
 *                              └──────────────────────────────────────────────────────┘
 *
 * The AI classifies each reply, moves the status, stops follow-ups and drafts a response;
 * nothing is sent until you press Send. Same backend functions as the AI's chat cards.
 */
import { AlertTriangle, CalendarCheck, Check, Inbox, Mail, MessageSquareReply, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { LoadState, StatusChip } from '../components/DataParts';
import { EmptyState } from '../components/PageParts';
import { timeAgo } from '../format';
import type { CandidateStatus } from '../types';
import { notifyDataChanged, useApi } from '../useApi';
import { useJobTasks } from '../useJobTasks';

type Label = 'interested' | 'not_interested' | 'question' | 'wants_meeting' | 'unsubscribe';

interface Reply {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateStatus: CandidateStatus | null;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: 'processing' | 'done' | 'failed';
  error: string | null;
  label: Label | null;
  confidence: number | null;
  summary: string | null;
  flagged: boolean;
  statusPath: string[];
  followUpsStopped: number;
  response: { subject: string | null; body: string | null; status: 'none' | 'draft' | 'sending' | 'sent' | 'discarded' | 'failed'; sentAt: string | null; autoSent: boolean; error: string | null };
  meeting: { status: 'offered' | 'booked' | 'cancelled'; slot: string | null; bookedAt: string | null } | null;
}

interface RepliesResponse {
  canReply: { id: string; name: string; status: CandidateStatus }[];
  replies: Reply[];
}

export const LABELS: Record<Label, string> = {
  interested: 'Interested',
  not_interested: 'Not interested',
  question: 'Question',
  wants_meeting: 'Wants a meeting',
  unsubscribe: 'Unsubscribe',
};

const RESPONSE_LABELS: Record<Reply['response']['status'], string> = {
  none: 'No response',
  draft: 'Response waiting for you',
  sending: 'Sending…',
  sent: 'Response sent',
  discarded: 'Not answered',
  failed: 'Response failed',
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  if (!data) return <LoadState loading={loading} error={error} />;
  const selected = data.replies.find((r) => r.id === selectedId) ?? data.replies[0] ?? null;

  return (
    <div className="replies-tab">
      <div className="emails-tab__new">
        <button type="button" className="button" onClick={() => setSimulating(true)} disabled={data.canReply.length === 0} title={data.canReply.length ? undefined : 'Only candidates who were emailed can reply'}>
          <MessageSquareReply size={16} aria-hidden="true" /> Simulate reply
        </button>
        <span className="muted small">Stands in for a real inbox: type what a candidate answered and the AI handles it.</span>
      </div>

      <div className="card inbox">
        <div className="inbox__list">
          <div className="inbox__list-header">Replies ({data.replies.length})</div>
          {data.replies.length === 0 ? (
            <EmptyState icon={Inbox} title="No replies yet">
              When an emailed candidate replies, it shows up here, read and labelled by the AI.
            </EmptyState>
          ) : (
            <ul className="reply-list">
              {data.replies.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`reply-item${selected?.id === r.id ? ' reply-item--active' : ''}`} onClick={() => setSelectedId(r.id)}>
                    <span className="reply-item__top">
                      <strong>{r.candidateName}</strong>
                      <span className="muted small">{timeAgo(r.receivedAt)}</span>
                    </span>
                    <span className="reply-item__meta">
                      {r.status === 'processing' ? (
                        <span className="muted small">
                          <span className="task-progress__dot" aria-hidden="true" /> The AI is reading it…
                        </span>
                      ) : r.label ? (
                        <span className={`reply-label reply-label--${r.label}`}>{LABELS[r.label]}</span>
                      ) : (
                        <span className="reply-label reply-label--failed">Failed</span>
                      )}
                      {r.status === 'done' && <span className={`muted small reply-item__response reply-item__response--${r.response.status}`}>{RESPONSE_LABELS[r.response.status]}</span>}
                      {r.meeting?.status === 'booked' && (
                        <span className="small reply-item__meeting">
                          <CalendarCheck size={12} aria-hidden="true" /> Booked
                        </span>
                      )}
                    </span>
                    {r.summary && <span className="muted small reply-item__summary">{r.summary}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected ? (
          <ReplyDetail key={selected.id} jobId={jobId} reply={selected} />
        ) : (
          <EmptyState icon={Mail} title="Select a reply">
            You'll see the conversation and the AI's drafted answer, ready to send, edit or discard.
          </EmptyState>
        )}
      </div>

      {simulating && <SimulateDialog jobId={jobId} people={data.canReply} onClose={() => setSimulating(false)} onSent={(id) => setSelectedId(id)} />}
    </div>
  );
}

function ReplyDetail({ jobId, reply }: { jobId: string; reply: Reply }) {
  const [subject, setSubject] = useState(reply.response.subject ?? '');
  const [body, setBody] = useState(reply.response.body ?? '');
  const [busy, setBusy] = useState<'send' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The AI finished the draft after this opened: show it (unless the recruiter is editing).
  useEffect(() => {
    setSubject((s) => s || (reply.response.subject ?? ''));
    setBody((b) => b || (reply.response.body ?? ''));
  }, [reply.response.subject, reply.response.body]);

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
    <div className="reply-detail">
      <header className="reply-detail__head">
        <div>
          <h3>{reply.candidateName}</h3>
          <span className="muted small">
            {reply.from} · {new Date(reply.receivedAt).toLocaleString()}
          </span>
        </div>
        {reply.candidateStatus && <StatusChip status={reply.candidateStatus} />}
      </header>

      <section className="reply-detail__message">
        <span className="muted small">Their message{reply.subject ? `: ${reply.subject}` : ''}</span>
        <p>{reply.body}</p>
      </section>

      {reply.status === 'processing' && (
        <p className="muted">
          <span className="task-progress__dot" aria-hidden="true" /> The AI is reading the reply…
        </p>
      )}
      {reply.status === 'failed' && <p className="form-error">The AI couldn't process this reply: {reply.error}</p>}

      {reply.status === 'done' && reply.label && (
        <section className="reply-detail__ai">
          <div className="reply-detail__ai-top">
            <span className={`reply-label reply-label--${reply.label}`}>{LABELS[reply.label]}</span>
            {reply.confidence !== null && <span className="muted small">{Math.round(reply.confidence * 100)}% sure</span>}
          </div>
          {reply.summary && <p>{reply.summary}</p>}
          {reply.flagged && (
            <p className="flag-banner">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>This reply contained instructions for the AI. They were ignored; please read it yourself. It's never answered automatically.</span>
            </p>
          )}
          <ul className="reply-detail__facts">
            {reply.statusPath.length > 0 && <li>Status: {reply.statusPath.join(' → ')}</li>}
            {reply.followUpsStopped > 0 && (
              <li>
                {reply.followUpsStopped} follow-up email{reply.followUpsStopped === 1 ? '' : 's'} stopped
              </li>
            )}
            {reply.meeting?.status === 'booked' && reply.meeting.slot && (
              <li className="reply-detail__booked">
                <CalendarCheck size={14} aria-hidden="true" /> Meeting booked: {slotText(reply.meeting.slot)}
              </li>
            )}
            {reply.meeting?.status === 'offered' && <li>Booking link offered: waiting for them to pick a time</li>}
          </ul>
        </section>
      )}

      {reply.status === 'done' && reply.response.status === 'none' && (
        <p className="muted">They asked not to be contacted, so there's no response and no more emails.</p>
      )}

      {(reply.response.status === 'draft' || reply.response.status === 'failed') && (
        <section className="reply-detail__response">
          <h4>Response (draft: nothing is sent until you press Send)</h4>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Response subject" placeholder="Subject" />
          <textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Response text" />
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
        </section>
      )}

      {reply.response.status === 'sent' && (
        <section className="reply-detail__response reply-detail__response--sent">
          <h4>
            <Check size={14} aria-hidden="true" /> Response sent {reply.response.sentAt && timeAgo(reply.response.sentAt)}
            {reply.response.autoSent && ' (automatically)'}
          </h4>
          <strong>{reply.response.subject}</strong>
          <p>{reply.response.body}</p>
        </section>
      )}
      {reply.response.status === 'discarded' && <p className="muted">You chose not to answer this one.</p>}
    </div>
  );
}

/** "Simulate reply": pick an emailed candidate, type (or pick) what they answered. */
function SimulateDialog({ jobId, people, onClose, onSent }: { jobId: string; people: RepliesResponse['canReply']; onClose: () => void; onSent: (replyId: string) => void }) {
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
      const r = await api<{ replyId: string }>(`/jobs/${jobId}/candidates/${candidateId}/simulate-reply`, { method: 'POST', body: { body: text } });
      notifyDataChanged();
      onSent(r.replyId);
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
        <p className="muted small">As if this candidate answered your email. The AI reads it, updates their status, stops their follow-ups and drafts a response for you.</p>
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
            {busy ? 'Sending…' : 'Simulate reply'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
