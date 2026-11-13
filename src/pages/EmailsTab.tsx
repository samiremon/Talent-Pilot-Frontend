/**
 * The job's Emails tab: outreach campaigns.
 *
 *   [Sandbox mode: emails go to the test inbox (Mailpit) · 3 of 50 sent in the last 24 h]
 *   [ New campaign ]                              (only Accepted candidates with an email)
 *
 *   JOB-0003 outreach (Day 0 / 3 / 7)        Draft · Waiting for your approval
 *     [ Approve & send ]
 *     Ana Ahmed  ana@example.com  · Accepted                                  [Remove]
 *       Day 0  [subject ...........]  [text .....................]   Draft
 *       Day 3  ...
 *
 * Every draft can be edited until it's sent. Nothing is sent before "Approve & send";
 * then a background job sends each step on its day (daily limit; never the same step
 * twice; follow-ups stop when someone replies). Same backend functions as the AI's cards.
 */
import { Check, Mail, Pause, Play, Send, UserMinus } from 'lucide-react';
import { useState } from 'react';
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

interface CampaignsResponse {
  settings: { mode: 'sandbox' | 'live'; dailyLimit: number; daySeconds: number; sentLast24h: number; eligible: number };
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
  skipped: 'Skipped',
  failed: 'Failed',
};

export function EmailsTab({ jobId }: { jobId: string }) {
  const { data, error, loading } = useApi<CampaignsResponse>(`/jobs/${jobId}/campaigns`);
  // Live: drafting / sending progress updates this tab (through the shared live stream).
  useJobTasks(jobId);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(sequence: 'single' | 'sequence') {
    setCreating(true);
    setNotice(null);
    try {
      const r = await api<{ candidates: number }>(`/jobs/${jobId}/campaigns`, { method: 'POST', body: { sequence } });
      setNotice({ ok: true, text: `Campaign created for ${r.candidates} candidate${r.candidates === 1 ? '' : 's'}. The AI is writing the drafts.` });
      notifyDataChanged();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : 'Could not create the campaign.' });
    } finally {
      setCreating(false);
    }
  }

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
        <span className="muted small">
          {settings.eligible
            ? `${settings.eligible} accepted candidate${settings.eligible === 1 ? '' : 's'} with an email can be added.`
            : 'Only Accepted candidates with an email can be emailed. Accept some on the Candidates tab first.'}
        </span>
        <button type="button" className="button" onClick={() => create('single')} disabled={creating || settings.eligible === 0}>
          <Send size={16} aria-hidden="true" /> Single email
        </button>
        <button type="button" className="button button--ghost" onClick={() => create('sequence')} disabled={creating || settings.eligible === 0}>
          <Send size={16} aria-hidden="true" /> Sequence: Day 0 / 3 / 7
        </button>
      </div>
      {notice && <p className={notice.ok ? 'form-notice' : 'form-error'}>{notice.text}</p>}

      {campaigns.length === 0 ? (
        <div className="card">
          <EmptyState icon={Mail} title="No outreach yet">
            Create a campaign above (or ask the AI). It drafts a personal email, or a Day 0 / 3 / 7 sequence, for each accepted
            candidate. You preview and edit, and nothing is sent until you approve.
          </EmptyState>
        </div>
      ) : (
        campaigns.map((c) => <CampaignCard key={c.id} jobId={jobId} campaign={c} />)
      )}
    </div>
  );
}

function CampaignCard({ jobId, campaign }: { jobId: string; campaign: Campaign }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = new Map<string, Message[]>();
  for (const m of campaign.messages) people.set(m.candidateId, [...(people.get(m.candidateId) ?? []), m]);
  const sent = campaign.messages.filter((m) => m.status === 'sent').length;

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

  const progress = campaign.status === 'drafting' ? campaign.draftTask?.message : campaign.sendTask?.message;
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
      {progress && <p className="campaign__progress muted small">{progress}</p>}
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
                  title="Take this candidate out of the campaign (their unsent emails are skipped)"
                >
                  <UserMinus size={14} aria-hidden="true" /> Remove
                </button>
              )}
            </div>
            {messages.map((m) => (
              <MessageRow key={m.id} jobId={jobId} message={m} />
            ))}
          </div>
        );
      })}
    </section>
  );
}

/** One email: editable while it's a draft or scheduled; read-only once sent / skipped. */
function MessageRow({ jobId, message }: { jobId: string; message: Message }) {
  const editable = message.status === 'draft' || message.status === 'approved';
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = subject !== message.subject || body !== message.body;

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
        <span className="email-step__day">Day {message.day}</span>
        <span className={`email-step__status email-step__status--${message.status}`}>{MESSAGE_LABELS[message.status]}</span>
        {message.status === 'approved' && message.sendAt && <span className="muted small">at {new Date(message.sendAt).toLocaleString()}</span>}
        {message.sentAt && <span className="muted small">{timeAgo(message.sentAt)}</span>}
      </div>
      {editable ? (
        <div className="email-step__edit">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={`Subject, Day ${message.day}, ${message.candidateName}`} placeholder="Subject" />
          <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} aria-label={`Email text, Day ${message.day}, ${message.candidateName}`} placeholder="Email text" />
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
