/**
 * "Find candidates" popup on the job page: search the web for new people for this job.
 *
 *   [x] LinkedIn        site:linkedin.com/in "React" "TypeScript" ... Dhaka   (editable)
 *   [x] GitHub          site:github.com "React" "TypeScript" Dhaka
 *   [x] Stack Overflow  site:stackoverflow.com/users "React" ...
 *   [ ] Kaggle          site:kaggle.com ...
 *   Results per site: 10 / 20 / 30           -> "Uses 3 of your web searches (Serper credits)"
 *
 * The sites and search words are suggested from the job (no AI used) and can be changed.
 * Search runs in the background (live progress on the page); new people are added
 * (duplicates skipped) and scored automatically. Same backend function as the AI's
 * "Find candidates" card in the chat.
 */
import { Search } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { notifyDataChanged } from '../useApi';

export interface SourceSearch {
  source: 'linkedin' | 'github' | 'stackoverflow' | 'kaggle';
  label: string;
  query: string;
  suggested?: boolean;
  checked?: boolean;
}

interface Suggestion {
  sources: SourceSearch[];
  mode: 'serper' | 'sample';
  maxPages: number;
  resultsPerPage: number;
}

/** What each site is good for (shown next to its name). */
export const SOURCE_HINTS: Record<SourceSearch['source'], string> = {
  linkedin: 'every role',
  github: 'developers',
  stackoverflow: 'developers',
  kaggle: 'data / ML',
};

interface Props {
  jobId: string;
  open: boolean;
  onClose: () => void;
  /** Called after the search started, with a short message to show. */
  onStarted: (message: string) => void;
}

export function FindCandidatesDialog({ jobId, open, onClose, onStarted }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [searches, setSearches] = useState<SourceSearch[]>([]);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      setPages(1);
      setSuggestion(null);
      dialog.showModal();
      // Fresh suggestions each time (the job may have been edited).
      api<Suggestion>(`/jobs/${jobId}/source`)
        .then((data) => {
          setSuggestion(data);
          setSearches(data.sources.map((s) => ({ ...s, checked: Boolean(s.suggested) })));
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the suggestions.'));
    }
    if (!open && dialog.open) dialog.close();
  }, [open, jobId]);

  const chosen = searches.filter((s) => s.checked);
  const credits = chosen.length * pages;
  const canStart = chosen.length > 0 && chosen.every((s) => s.query.trim().length >= 3);

  function update(source: SourceSearch['source'], change: Partial<SourceSearch>) {
    setSearches((all) => all.map((s) => (s.source === source ? { ...s, ...change } : s)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/jobs/${jobId}/source`, {
        method: 'POST',
        body: { pages, searches: chosen.map((s) => ({ source: s.source, query: s.query.trim() })) },
      });
      notifyDataChanged();
      onStarted(`Searching ${chosen.map((s) => s.label).join(', ')}… New people will be added and scored automatically.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the search. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="details-dialog" aria-labelledby="find-title" onClose={onClose}>
      <form className="details-dialog__panel" onSubmit={handleSubmit}>
        <header className="details-dialog__header">
          <h2 id="find-title">
            <Search size={18} aria-hidden="true" /> Find candidates on the web
          </h2>
        </header>

        {suggestion?.mode === 'sample' && (
          <p className="form-notice">
            Sample mode: no SERPER_API_KEY is set, so this adds made-up sample profiles (marked "sample") to show how it works.
          </p>
        )}
        <p className="muted small">
          We search Google for public profiles on these sites (suggested from the job; you can change the sites and the search
          words). Only what Google shows is used: name, headline, link and a short summary. No emails.
        </p>

        {!suggestion && !error && <p className="muted">Loading suggestions…</p>}
        {suggestion && (
          <fieldset className="source-list">
            <legend className="sr-only">Sites to search</legend>
            {searches.map((s) => (
              <div key={s.source} className={`source-row${s.checked ? '' : ' source-row--off'}`}>
                <label className="source-row__name">
                  <input type="checkbox" checked={Boolean(s.checked)} onChange={(e) => update(s.source, { checked: e.target.checked })} />
                  <strong>{s.label}</strong> <span className="muted small">{SOURCE_HINTS[s.source]}</span>
                </label>
                <input
                  className="source-row__query"
                  value={s.query}
                  onChange={(e) => update(s.source, { query: e.target.value })}
                  disabled={!s.checked}
                  aria-label={`${s.label} search words`}
                />
              </div>
            ))}
          </fieldset>
        )}

        {suggestion && (
          <div className="form-row">
            <label htmlFor="find-pages">Results per site</label>
            <select id="find-pages" value={pages} onChange={(e) => setPages(Number(e.target.value))}>
              {Array.from({ length: suggestion.maxPages }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Up to {n * suggestion.resultsPerPage}
                </option>
              ))}
            </select>
            <span className="form-hint">
              {chosen.length === 0
                ? 'Tick at least one site.'
                : `Up to ${credits * suggestion.resultsPerPage} profiles · uses ${credits} web search${credits === 1 ? '' : 'es'}${suggestion.mode === 'serper' ? ' (Serper credits)' : ''}. New people are scored by the AI afterwards.`}
            </span>
          </div>
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
          <button type="submit" className="button" disabled={saving || !canStart}>
            <Search size={16} aria-hidden="true" /> {saving ? 'Starting…' : 'Search'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
