/**
 * The job's Emails tab: outreach campaigns.
 *
 *   [Sandbox mode: emails go to the test inbox (Mailpit) · 3 of 50 sent in the last 24 h]
 *   [ Email campaign ]   -> popup: Single email or Sequence, who gets it, then the drafts
 *
 *   JOB-0003 outreach (Day 0 / 3 / 7)        Sending · Next: Possible follow-up 1 in 2:43
 *     Ana Ahmed  ana@example.com  · Contacted                              [Remove]
 *       First email                 Sent · 3 min ago
 *       Possible follow-up 1 · Day 3   Scheduled · in 2:43   (editable until it goes out)
 *       Possible follow-up 2 · Day 7   Scheduled · in 6:43
 *
 * Nothing is sent before "Approve & send"; then a background job sends each step on its day
 * (daily limit; never the same step twice; follow-ups stop when someone replies or
 * unsubscribes: every email has an Unsubscribe button through the standard email headers).
 * Same backend functions as the AI's chat cards.
 */
import { Check, Mail, Pause, Play, Send, UserMinus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { LoadState, StatusChip } from '../components/DataParts';
import { EmptyState } from '../components/PageParts';
import { timeAgo } from '../format';
import type { CandidateStatus } from '../types';
import { notifyDataChanged, useApi } from '../useApi';
import { useJobTasks } from '../useJobTasks';

interface Message {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateStatus: CandidateStatus | null;
  step: number;
  day: number;
  to: string;
  subject: string;
  body: string;
  status: 'draft' | 'approved' | 'sending' | 'sent' | 'skipped' | 'failed';
  sendAt: string | null;
  sentAt: string | null;
  error: string | null;
  note: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: 'drafting' | 'draft' | 'active' | 'paused' | 'done';
  mode: 'sandbox' | 'live';
  stepDays: number[];
  draftTask: { message: string; status: string } | null;
  sendTask: { message: string; status: string } | null;
  messages: Message[];
}

interface Eligible {
  id: string;
  name: string;
  email: string;
  score: number | null;
}

interface CampaignsResponse {
  settings: { mode: 'sandbox' | 'live'; dailyLimit: number; daySeconds: number; sentLast24h: number; eligible: number };
  eligible: Eligible[];
  campaigns: Campaign[];
}

const CAMPAIGN_LABELS: Record<Campaign['status'], string> = {
  drafting: 'The AI is writing drafts…',
  draft: 'Waiting for your approval',
  active: 'Sending',
  paused: 'Paused',
  done: 'Finished',
};
const MESSAGE_LABELS: Record<Message['status'], string> = {
  draft: 'Draft',
  approved: 'Scheduled',
  sending: 'Sending…',
  sent: 'Sent',
  skipped: 'Not sent',
  failed: 'Failed',
};

/** "First email" / "Possible follow-up 1 · Day 3": follow-ups only go out if they haven't replied. */
export function stepLabel(step: number, day: number): string {
  return step === 0 ? 'First email' : `Possible follow-up ${step} · Day ${day}`;
}

/** The current time, updated every second (for the countdowns). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** 163 s -> "2:43"; 2 h 5 min -> "2 h 5 min"; 3 days -> "3 days 4 h". */
function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(s / 3600);
  if (h < 24) return `${h} h ${Math.floor((s % 3600) / 60)} min`;
  return `${Math.floor(h / 24)} days ${h % 24} h`;
}

export function EmailsTab({ jobId }: { jobId: string }) {
  const { data, error, loading } = useApi<CampaignsResponse>(`/jobs/${jobId}/campaigns`);
  // Live: drafting / sending progress updates this tab (through the shared live stream).
  useJobTasks(jobId);
  const location = useLocation();
  const navigate = useNavigate();
  // Came from "Email them" on the Candidates tab: open the popup with those people ticked.
  const preselected = (location.state as { campaignFor?: string[] } | null)?.campaignFor;
  const [dialog, setDialog] = useState<{ open: boolean; preselected?: string[] }>({ open: Boolean(preselected), preselected });
  useEffect(() => {
    if (preselected) navigate(location.pathname, { replace: true, state: null }); // don't reopen on refresh
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <LoadState loading={loading} error={error} />;
  const { settings, campaigns } = data;

  return (
    <div className="emails-tab">
      <div className={`mode-banner mode-banner--${settings.mode}`}>
        <Mail size={16} aria-hidden="true" />
        {settings.mode === 'sandbox' ? (
          <span>
            <strong>Sandbox mode:</strong> outreach emails go to the test inbox,{' '}
            <a href="http://localhost:8025" target="_blank" rel="noreferrer noopener">
              Mailpit (localhost:8025)
            </a>
            . No real candidate gets mail.
          </span>
        ) : (
          <span>
            <strong>Live mode:</strong> approved emails are sent to the real candidates.
          </span>
        )}
        <span className="muted small mode-banner__limit">
          {settings.sentLast24h} of {settings.dailyLimit} sent in the last 24 h
          {settings.daySeconds !== 86_400 && ` · demo days: 1 day = ${settings.daySeconds} s`}
        </span>
      </div>

      <div className="emails-tab__new">
        <button type="button" className="button" onClick={() => setDialog({ open: true })}>
          <Send size={16} aria-hidden="true" /> Email campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="card">
          <EmptyState icon={Mail} title="No outreach yet">
            Press <strong>Email campaign</strong> (or ask the AI) to write a personal email, or a first email with two possible
            follow-ups, for accepted candidates. You see and edit every draft, and nothing is sent until you approve.
          </EmptyState>
        </div>
      ) : (
        campaigns.map((c) => <CampaignCard key={c.id} jobId={jobId} campaign={c} />)
      )}

      {dialog.open && (
        <CampaignDialog
          jobId={jobId}
          data={data}
          preselected={dialog.preselected}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </div>
  );
}

/**
 * "Email campaign" popup:
 *   1. choose: Single email, or Sequence (first email + possible follow-up 1 on Day 3 +
 *      possible follow-up 2 on Day 7), and who gets it (Accepted candidates with an email)
 *   2. "Write drafts": the AI writes them (live progress)
 *   3. every draft, per person: First email / Possible follow-up 1 / Possible follow-up 2,
 *      editable; then "Approve & send" (or close: the drafts stay on the Emails tab)
 */
function CampaignDialog({ jobId, data, preselected, onClose }: { jobId: string; data: CampaignsResponse; preselected?: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sequence, setSequence] = useState<'single' | 'sequence'>('sequence');
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(preselected?.length ? data.eligible.filter((e) => preselected.includes(e.id)).map((e) => e.id) : data.eligible.map((e) => e.id)),
  );
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campaign = campaignId ? data.campaigns.find((c) => c.id === campaignId) : undefined;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function toggle(id: string) {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function writeDrafts() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ campaignId: string }>(`/jobs/${jobId}/campaigns`, { method: 'POST', body: { sequence, candidateIds: [...ticked] } });
      setCampaignId(r.campaignId);
      notifyDataChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the campaign.');
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/jobs/${jobId}/campaigns/${campaignId}/approve`, { method: 'POST', body: {} });
      notifyDataChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve.');
    } finally {
      setBusy(false);
    }
  }

  const people = new Map<string, Message[]>();
  for (const m of campaign?.messages ?? []) people.set(m.candidateId, [...(people.get(m.candidateId) ?? []), m]);

  return (
    <dialog ref={ref} className="details-dialog campaign-dialog" aria-labelledby="campaign-title" onClose={onClose}>
      <div className="details-dialog__panel">
        <header className="details-dialog__header">
          <h2 id="campaign-title">
            <Send size={18} aria-hidden="true" /> Email campaign
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {!campaignId && (
          <>
            <div className="campaign-dialog__types" role="radiogroup" aria-label="Single email or sequence">
              {(['single', 'sequence'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={sequence === s}
                  className={`campaign-type${sequence === s ? ' campaign-type--active' : ''}`}
                  onClick={() => setSequence(s)}
                >
                  <strong>{s === 'single' ? 'Single email' : 'Sequence of emails'}</strong>
                  <span className="muted small">
                    {s === 'single'
                      ? 'One personal email to each candidate.'
                      : 'First email, then Possible follow-up 1 (Day 3) and Possible follow-up 2 (Day 7), only if they haven\'t replied.'}
                  </span>
                </button>
              ))}
            </div>

            <h3 className="campaign-dialog__subtitle">Who gets it ({ticked.size})</h3>
            {data.eligible.length === 0 ? (
              <p className="muted">Nobody yet: accept candidates who have an email on the Candidates tab.</p>
            ) : (
              <ul className="status-pick">
                {data.eligible.map((c) => (
                  <li key={c.id}>
                    <label>
                      <input type="checkbox" checked={ticked.has(c.id)} onChange={() => toggle(c.id)} />
                      <strong>{c.name}</strong>
                      <span className="muted small">
                        {c.email}
                        {c.score !== null ? ` · ${c.score}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="button button--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="button" onClick={writeDrafts} disabled={busy || ticked.size === 0}>
                {busy ? 'Starting…' : `Write drafts for ${ticked.size}`}
              </button>
            </div>
            <p className="muted small">The AI writes the drafts; you see and edit all of them here before anything is sent.</p>
          </>
        )}

        {campaignId && (!campaign || campaign.status === 'drafting') && (
          <div className="campaign-dialog__wait" role="status">
            <span className="task-progress__dot" aria-hidden="true" /> {campaign?.draftTask?.message ?? 'The AI is writing the drafts…'}
          </div>
        )}

        {campaign && campaign.status !== 'drafting' && (
          <>
            <p className="muted small">
              {people.size} candidate{people.size === 1 ? '' : 's'} · {campaign.stepDays.length === 1 ? 'single email' : 'first email + 2 possible follow-ups'}. Edit any draft,
              then approve.
            </p>
            <div className="campaign-dialog__drafts">
              {[...people.entries()].map(([candidateId, messages]) => (
                <div key={candidateId} className="campaign__person">
                  <div className="campaign__person-head">
                    <strong>{messages[0]!.candidateName}</strong>
                    <span className="muted small">{messages[0]!.to}</span>
                  </div>
                  {messages.map((m) => (
                    <MessageRow key={m.id} jobId={jobId} message={m} />
                  ))}
                </div>
              ))}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="button button--ghost" onClick={onClose}>
                Close (keep as drafts)
              </button>
              {campaign.status === 'draft' && (
                <button type="button" className="button" onClick={approve} disabled={busy}>
                  <Check size={16} aria-hidden="true" /> {busy ? 'Approving…' : 'Approve & send'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

function CampaignCard({ jobId, campaign }: { jobId: string; campaign: Campaign }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const people = new Map<string, Message[]>();
  for (const m of campaign.messages) people.set(m.candidateId, [...(people.get(m.candidateId) ?? []), m]);
  const sent = campaign.messages.filter((m) => m.status === 'sent').length;
  // The next email due (for the countdown in the header).
  const next = campaign.messages
    .filter((m) => m.status === 'approved' && m.sendAt)
    .sort((a, b) => new Date(a.sendAt!).getTime() - new Date(b.sendAt!).getTime())[0];

  async function act(path: string, body: object = {}) {
    setBusy(true);
    setError(null);
    try {
      await api(`/jobs/${jobId}/campaigns/${campaign.id}/${path}`, { method: 'POST', body });
      notifyDataChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card campaign">
      <header className="campaign__header">
        <div>
          <h3 className="campaign__name">{campaign.name}</h3>
          <span className={`campaign__status campaign__status--${campaign.status}`}>{CAMPAIGN_LABELS[campaign.status]}</span>
          <span className="muted small">
            {' '}
            · {people.size} candidate{people.size === 1 ? '' : 's'} · {sent} of {campaign.messages.length} emails sent
            {campaign.mode === 'sandbox' && ' · sandbox'}
          </span>
          {next && campaign.status === 'active' && (
            <div className="campaign__next">
              Next: {stepLabel(next.step, next.day)} to {next.candidateName} in{' '}
              <strong className="countdown">{countdown(new Date(next.sendAt!).getTime() - now)}</strong>
            </div>
          )}
        </div>
        <div className="campaign__actions">
          {campaign.status === 'draft' && (
            <button type="button" className="button" onClick={() => act('approve')} disabled={busy}>
              <Check size={16} aria-hidden="true" /> Approve &amp; send
            </button>
          )}
          {campaign.status === 'active' && (
            <button type="button" className="button button--ghost" onClick={() => act('pause')} disabled={busy}>
              <Pause size={16} aria-hidden="true" /> Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button type="button" className="button" onClick={() => act('resume')} disabled={busy}>
              <Play size={16} aria-hidden="true" /> Resume
            </button>
          )}
        </div>
      </header>
      {campaign.status === 'drafting' && campaign.draftTask?.message && <p className="campaign__progress muted small">{campaign.draftTask.message}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {[...people.entries()].map(([candidateId, messages]) => {
        const first = messages[0]!;
        const removable = messages.some((m) => m.status === 'draft' || m.status === 'approved');
        return (
          <div key={candidateId} className="campaign__person">
            <div className="campaign__person-head">
              <strong>{first.candidateName}</strong>
              <span className="muted small">{first.to}</span>
              {first.candidateStatus && <StatusChip status={first.candidateStatus} />}
              {removable && campaign.status !== 'done' && (
                <button
                  type="button"
                  className="link-button campaign__remove"
                  onClick={() => act('remove', { candidateId })}
                  disabled={busy}
                  title="Take this candidate out of the campaign (their unsent emails won't be sent)"
                >
                  <UserMinus size={14} aria-hidden="true" /> Remove
                </button>
              )}
            </div>
            {messages.map((m) => (
              <MessageRow key={m.id} jobId={jobId} message={m} now={now} />
            ))}
          </div>
        );
      })}
    </section>
  );
}

/** One email: editable while it's a draft or scheduled; read-only once sent / not sent. */
function MessageRow({ jobId, message, now }: { jobId: string; message: Message; now?: number }) {
  const editable = message.status === 'draft' || message.status === 'approved';
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = subject !== message.subject || body !== message.body;
  // New text from the server (e.g. the AI just finished the draft): show it, unless being edited.
  useEffect(() => {
    if (!dirty) {
      setSubject(message.subject);
      setBody(message.body);
    }
  }, [message.subject, message.body]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaved('saving');
    try {
      await api(`/jobs/${jobId}/campaigns/messages/${message.id}`, { method: 'PATCH', body: { subject, body } });
      setSaved('saved');
      notifyDataChanged();
    } catch {
      setSaved('error');
    }
  }

  return (
    <div className={`email-step email-step--${message.status}`}>
      <div className="email-step__meta">
        <span className="email-step__day">{stepLabel(message.step, message.day)}</span>
        <span className={`email-step__status email-step__status--${message.status}`}>{MESSAGE_LABELS[message.status]}</span>
        {message.status === 'approved' && message.sendAt && (
          <span className="small countdown">in {countdown(new Date(message.sendAt).getTime() - (now ?? Date.now()))}</span>
        )}
        {message.sentAt && <span className="muted small">{timeAgo(message.sentAt)}</span>}
      </div>
      {editable ? (
        <div className="email-step__edit">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={`Subject, ${stepLabel(message.step, message.day)}, ${message.candidateName}`} placeholder="Subject" />
          <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} aria-label={`Email text, ${stepLabel(message.step, message.day)}, ${message.candidateName}`} placeholder="Email text" />
          <div className="email-step__save">
            <button type="button" className="button button--small button--ghost" onClick={save} disabled={!dirty || saved === 'saving'}>
              {saved === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {saved === 'saved' && !dirty && <span className="muted small">Saved</span>}
            {saved === 'error' && <span className="form-hint form-hint--error">Couldn't save. Try again.</span>}
          </div>
        </div>
      ) : (
        <div className="email-step__read">
          <strong>{message.subject}</strong>
          <p>{message.body}</p>
        </div>
      )}
      {message.error && <p className="form-hint form-hint--error">{message.error}</p>}
      {message.note && <p className="muted small">{message.note}</p>}
    </div>
  );
}
