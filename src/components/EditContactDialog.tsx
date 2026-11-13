/**
 * "Edit contact" popup: add or change a candidate's email and profile link (e.g. people found
 * by web search have a profile link but never an email).
 *
 * Calls PATCH /api/jobs/:id/candidates/:candidateId: the same backend function the AI's
 * "Edit contact" card uses. The server checks the email/link, refuses one another candidate
 * in the job already has, and keeps at least one of the two. Email typos like "gmai.com"
 * are pointed out as you type (not silently changed).
 */
import { PencilLine } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { Candidate } from '../types';
import { notifyDataChanged } from '../useApi';
import { TYPO_FIXES } from './AddCandidateDialog';

interface Props {
  jobId: string;
  candidate: Candidate | null;
  onClose: () => void;
}

export function EditContactDialog({ jobId, candidate, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (candidate && !dialog.open) {
      setEmail(candidate.email ?? '');
      setProfileUrl(candidate.profileUrl ?? '');
      setError(null);
      dialog.showModal();
    }
    if (!candidate && dialog.open) dialog.close();
  }, [candidate]);

  const domain = email.split('@')[1]?.trim().toLowerCase() ?? '';
  const typoFix = TYPO_FIXES[domain];
  const canSave = Boolean(email.trim() || profileUrl.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidate) return;
    setSaving(true);
    setError(null);
    try {
      // Only what changed is sent ("" = remove it).
      const body: Record<string, string> = {};
      if (email.trim() !== (candidate.email ?? '')) body.email = email.trim();
      if (profileUrl.trim() !== (candidate.profileUrl ?? '')) body.profileUrl = profileUrl.trim();
      if (Object.keys(body).length) {
        await api(`/jobs/${jobId}/candidates/${candidate.id}`, { method: 'PATCH', body });
        notifyDataChanged();
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="details-dialog" aria-labelledby="edit-contact-title" onClose={onClose}>
      {candidate && (
        <form className="details-dialog__panel" onSubmit={handleSubmit}>
          <header className="details-dialog__header">
            <h2 id="edit-contact-title">
              <PencilLine size={18} aria-hidden="true" /> Edit contact · {candidate.name}
            </h2>
          </header>
          <div className="form-row">
            <label htmlFor="edit-email">Email</label>
            <input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus />
            {typoFix && (
              <span className="form-hint form-hint--error">
                "{domain}" looks like a typo.{' '}
                <button type="button" className="link-button" onClick={() => setEmail(email.replace(/@.*$/, `@${typoFix}`))}>
                  Use {typoFix}?
                </button>
              </span>
            )}
          </div>
          <div className="form-row">
            <label htmlFor="edit-profile">Profile link</label>
            <input id="edit-profile" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} placeholder="LinkedIn, GitHub or portfolio" />
            <span className="form-hint">Keep at least one of the two. Leave a field empty to remove it.</span>
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
            <button type="submit" className="button" disabled={saving || !canSave}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
