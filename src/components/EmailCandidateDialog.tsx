/**
 * "Send email" to ONE candidate (from the candidate popup): e.g. a polite rejection.
 *
 *   Purpose: [Rejection] [Update] [Custom]    Notes for the AI (optional)   [Write with AI]
 *   To: priya@example.com
 *   Subject [.............]   Message [.....................]          [Cancel] [Send]
 *
 * "Write with AI" drafts it (POST .../email/draft); you edit; Send (POST .../email) sends it
 * through the outreach mailer (sandbox = Mailpit) with the Unsubscribe button. Same
 * functions as the AI's "Send email" card in the chat.
 */
import { Mail, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import type { Candidate } from '../types';
import { notifyDataChanged } from '../useApi';

const PURPOSES = [
  { id: 'rejection', label: 'Rejection' },
  { id: 'update', label: 'Update' },
  { id: 'custom', label: 'Custom' },
] as const;

export function EmailCandidateDialog({ jobId, candidate, onClose }: { jobId: string; candidate: Candidate | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]['id']>('rejection');
  const [notes, setNotes] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<'draft' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (candidate && !dialog.open) {
      setPurpose(candidate.status === 'rejected' ? 'rejection' : 'update');
      setNotes('');
      setSubject('');
      setBody('');
      setError(null);
      setSent(false);
      dialog.showModal();
    }
    if (!candidate && dialog.open) dialog.close();
  }, [candidate]);

  async function draft() {
    if (!candidate) return;
    setBusy('draft');
    setError(null);
    try {
      const d = await api<{ subject: string; body: string }>(`/jobs/${jobId}/candidates/${candidate.id}/email/draft`, { method: 'POST', body: { purpose, notes: notes.trim() || undefined } });
      setSubject(d.subject);
      setBody(d.body);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not write the draft.');
    } finally {
      setBusy(null);
    }
  }

  async function sendIt() {
    if (!candidate) return;
    setBusy('send');
    setError(null);
    try {
      await api(`/jobs/${jobId}/candidates/${candidate.id}/email`, { method: 'POST', body: { subject, body, purpose } });
      setSent(true);
      notifyDataChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the email.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <dialog ref={ref} className="details-dialog" aria-labelledby="email-title" onClose={onClose}>
      {candidate && (
        <div className="details-dialog__panel">
          <header className="details-dialog__header">
            <h2 id="email-title">
              <Mail size={18} aria-hidden="true" /> Email {candidate.name}
            </h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </header>
          {sent ? (
            <>
              <p className="form-notice">Sent to {candidate.email}. It's in their conversation on the Replies tab and in their timeline.</p>
              <div className="form-actions">
                <button type="button" className="button" onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="segmented-field">
                <span className="segmented-field__label">Purpose</span>
                <div className="segmented" role="radiogroup" aria-label="Purpose">
                  {PURPOSES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={purpose === p.id}
                      className={`segmented__option${purpose === p.id ? ' segmented__option--active' : ''}`}
                      onClick={() => setPurpose(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="email-notes">Notes for the AI (optional)</label>
                <input id="email-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. we chose a candidate with more Next.js experience" />
              </div>
              <div>
                <button type="button" className="button button--ghost" onClick={draft} disabled={busy !== null}>
                  <Sparkles size={16} aria-hidden="true" /> {busy === 'draft' ? 'Writing…' : subject || body ? 'Write again with AI' : 'Write with AI'}
                </button>
              </div>
              <p className="muted small">To: {candidate.email}</p>
              <div className="form-row">
                <label htmlFor="email-subject">Subject</label>
                <input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="email-body">Message</label>
                <textarea id="email-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
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
                <button type="button" className="button" onClick={sendIt} disabled={busy !== null || !subject.trim() || !body.trim()}>
                  <Mail size={16} aria-hidden="true" /> {busy === 'send' ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
