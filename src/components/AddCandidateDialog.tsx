/**
 * "Add candidate" form (popup) on the job page: add ONE person by hand.
 *
 * Calls POST /api/jobs/:id/candidates: the same backend function the AI's "Add candidate"
 * card uses. Rules: a name, plus an email or a profile link. After adding, AI scoring
 * starts automatically (the live progress bar on the page shows it).
 *
 * Email typos like "gmai.com" are pointed out (not silently changed) as you type.
 */
import { UserPlus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { notifyDataChanged } from '../useApi';

// Common typos of popular email domains (the backend checks the same list).
const TYPO_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
};

const EMPTY = { name: '', email: '', headline: '', location: '', profileUrl: '', profileText: '' };

interface Props {
  jobId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a successful add, with a short message to show. */
  onAdded: (message: string) => void;
}

export function AddCandidateDialog({ jobId, open, onClose, onAdded }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setForm(EMPTY);
      setError(null);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (key: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const domain = form.email.split('@')[1]?.trim().toLowerCase() ?? '';
  const typoFix = TYPO_FIXES[domain];
  const canSave = form.name.trim() && (form.email.trim() || form.profileUrl.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/jobs/${jobId}/candidates`, { method: 'POST', body: form });
      notifyDataChanged();
      onAdded(`${form.name.trim()} was added. AI scoring has started.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the candidate. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="details-dialog" aria-labelledby="add-candidate-title" onClose={onClose}>
      <form className="details-dialog__panel" onSubmit={handleSubmit}>
        <header className="details-dialog__header">
          <h2 id="add-candidate-title">
            <UserPlus size={18} aria-hidden="true" /> Add candidate
          </h2>
        </header>

        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="add-name">Name *</label>
            <input id="add-name" value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </div>
          <div className="form-row">
            <label htmlFor="add-email">Email</label>
            <input id="add-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            {typoFix && (
              <span className="form-hint form-hint--error">
                "{domain}" looks like a typo.{' '}
                <button type="button" className="link-button" onClick={() => set('email', form.email.replace(/@.*$/, `@${typoFix}`))}>
                  Use {typoFix}?
                </button>
              </span>
            )}
          </div>
          <div className="form-row">
            <label htmlFor="add-headline">Title</label>
            <input id="add-headline" value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="e.g. Software Engineer" />
          </div>
          <div className="form-row">
            <label htmlFor="add-location">Location</label>
            <input id="add-location" value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="add-profile">Profile link</label>
          <input id="add-profile" value={form.profileUrl} onChange={(e) => set('profileUrl', e.target.value)} placeholder="LinkedIn, GitHub or portfolio" />
        </div>
        <div className="form-row">
          <label htmlFor="add-text">Experience &amp; skills</label>
          <textarea
            id="add-text"
            rows={4}
            value={form.profileText}
            onChange={(e) => set('profileText', e.target.value)}
            placeholder="e.g. 2 years of experience with FastAPI and PostgreSQL…"
          />
          <span className="form-hint">This is what the AI scores. Without it the candidate is added but not scored.</span>
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
          <button type="submit" className="button" disabled={saving || !canSave} title={canSave ? undefined : 'A name and an email or profile link are needed'}>
            {saving ? 'Adding…' : 'Add & score'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
