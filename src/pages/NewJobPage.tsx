/**
 * "New job" form at /jobs/new: the recruiter creates a job by hand.
 *
 * This does exactly what the AI's job card does when you press Confirm: it calls
 * POST /api/jobs. The backend logs it as done by the recruiter, and the assistant reads
 * that log, so the AI knows about jobs created here too.
 *
 * Only Title and Description are required. Anything left blank is saved as "Unknown"
 * (we never fill in guesses).
 *
 * "✨ Fill from description" sends the pasted description to the AI (POST /api/ai/extract-job),
 * which is the SAME reader the chat uses, and fills the fields for the recruiter to check.
 * The backend drops anything the AI "found" that isn't actually in the text, and we show
 * what was dropped. The extraction id is sent along on Create, so its tokens are counted
 * on the new job's token meter.
 */
import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { PageHeader } from '../components/PageParts';
import { TagInput } from '../components/TagInput';
import { tokens } from '../format';
import type { Job } from '../types';

type RemotePolicy = Job['remotePolicy'];

interface FormState {
  title: string;
  company: string;
  description: string;
  sourceUrl: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  seniority: string;
  location: string;
  salary: string;
  remotePolicy: RemotePolicy;
}

const EMPTY: FormState = {
  title: '',
  company: '',
  description: '',
  sourceUrl: '',
  mustHaveSkills: [],
  niceToHaveSkills: [],
  seniority: '',
  location: '',
  salary: '',
  remotePolicy: 'unknown',
};

/** What POST /api/ai/extract-job returns. */
interface Extraction {
  fields: {
    title: string;
    company: string | null;
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    seniority: string | null;
    location: string | null;
    salary: string | null;
    remotePolicy: RemotePolicy;
  };
  removed: string[];
  extractionId: string;
  usage: { inputTokens: number; outputTokens: number };
  mode: 'groq' | 'mock';
}

/** The backend's 400 error lists bad fields as { path, message }. */
interface FieldProblem {
  path: string;
  message: string;
}

export function NewJobPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // AI fill state: running, the last result (for the notice + its id), or an error.
  const [filling, setFilling] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);

  /** Updates one field and clears its error message. */
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors(({ [key]: _removed, ...rest }) => rest);
  }

  /** Ask the AI to read the description and fill the other fields. */
  async function fillFromDescription() {
    setFilling(true);
    setFillError(null);
    try {
      const result = await api<Extraction>('/ai/extract-job', {
        method: 'POST',
        body: { description: form.description },
      });
      const f = result.fields;
      // Replace the fields with what the AI found; null ("not in the text") becomes blank.
      setForm((current) => ({
        ...current,
        title: f.title,
        company: f.company ?? '',
        mustHaveSkills: f.mustHaveSkills,
        niceToHaveSkills: f.niceToHaveSkills,
        seniority: f.seniority ?? '',
        location: f.location ?? '',
        salary: f.salary ?? '',
        remotePolicy: f.remotePolicy,
      }));
      setFieldErrors({});
      setExtraction(result);
    } catch (err) {
      setFillError(err instanceof ApiError ? err.message : 'The AI could not read this description. Please try again.');
    } finally {
      setFilling(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // extractionId: lets the backend count the AI fill's tokens on this new job.
      const body = { ...form, extractionId: extraction?.extractionId };
      const { job } = await api<{ job: Job }>('/jobs', { method: 'POST', body });
      navigate(`/jobs/${job.id}`); // straight to the new job's page
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        // Show each backend complaint next to its field.
        const details = (err.details ?? []) as FieldProblem[];
        setFieldErrors(Object.fromEntries(details.map((d) => [d.path, d.message])));
      } else {
        setError('Something went wrong. Please try again.');
      }
      setSaving(false);
    }
  }

  /** Field label + input + its error message, wired together for screen readers. */
  function field(key: keyof FormState, label: string, input: React.ReactNode, hint?: string) {
    const problem = fieldErrors[key];
    return (
      <div className="form-row">
        <label htmlFor={`job-${key}`}>{label}</label>
        {input}
        {hint && !problem && <span className="form-hint">{hint}</span>}
        {problem && (
          <span className="form-hint form-hint--error" id={`job-${key}-error`}>
            {label.replace(' *', '')} {problem}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="New job"
        subtitle="Fill this in yourself, or paste the job description into the chat and let TalentPilot fill it for you."
      />

      <form className="card job-form" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {field(
            'title',
            'Job title *',
            <input
              id="job-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              aria-invalid={Boolean(fieldErrors.title)}
              placeholder="e.g. Senior React Developer"
              required
            />,
          )}
          {field(
            'company',
            'Company',
            <input id="job-company" value={form.company} onChange={(e) => set('company', e.target.value)} />,
          )}
        </div>

        {field(
          'description',
          'Job description *',
          <textarea
            id="job-description"
            rows={8}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
            placeholder="Paste the full job description here"
            required
          />,
          'At least 20 characters. Candidates are scored against this.',
        )}

        {/* AI helper: fills the fields below from the description above. */}
        <div className="ai-fill">
          <button
            type="button"
            className="button button--ghost"
            onClick={fillFromDescription}
            disabled={filling || form.description.trim().length < 20}
            title={form.description.trim().length < 20 ? 'Paste a job description first' : undefined}
          >
            <Sparkles size={16} aria-hidden="true" /> {filling ? 'Reading the description…' : 'Fill from description'}
          </button>
          {fillError && (
            <p className="form-hint form-hint--error" role="alert">
              {fillError}
            </p>
          )}
          {extraction && !filling && (
            <div className="ai-fill__notice" role="status">
              <strong>Filled by {extraction.mode === 'groq' ? 'AI' : 'sample AI (mock mode)'}.</strong> Please check every
              field before creating. Unknown details were left blank.{' '}
              <span className="muted">
                ({tokens(extraction.usage.inputTokens + extraction.usage.outputTokens)} tokens)
              </span>
              {extraction.removed.length > 0 && (
                <div className="ai-fill__removed">
                  Removed because they're not in the description: {extraction.removed.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-grid">
          {field(
            'mustHaveSkills',
            'Must-have skills',
            <TagInput
              id="job-mustHaveSkills"
              value={form.mustHaveSkills}
              onChange={(v) => set('mustHaveSkills', v)}
              placeholder="Type a skill, press Enter"
            />,
          )}
          {field(
            'niceToHaveSkills',
            'Nice-to-have skills',
            <TagInput
              id="job-niceToHaveSkills"
              value={form.niceToHaveSkills}
              onChange={(v) => set('niceToHaveSkills', v)}
              placeholder="Type a skill, press Enter"
            />,
          )}
          {field(
            'seniority',
            'Seniority',
            <input
              id="job-seniority"
              value={form.seniority}
              onChange={(e) => set('seniority', e.target.value)}
              placeholder="e.g. Senior"
            />,
          )}
          {field(
            'location',
            'Location',
            <input
              id="job-location"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Dhaka"
            />,
          )}
          {field(
            'remotePolicy',
            'Work style',
            <select
              id="job-remotePolicy"
              value={form.remotePolicy}
              onChange={(e) => set('remotePolicy', e.target.value as RemotePolicy)}
            >
              <option value="unknown">Unknown</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>,
          )}
          {field(
            'salary',
            'Salary',
            <input
              id="job-salary"
              value={form.salary}
              onChange={(e) => set('salary', e.target.value)}
              placeholder="e.g. $90–110k"
            />,
            'Saved exactly as you write it.',
          )}
        </div>

        {field(
          'sourceUrl',
          'Link to the original posting',
          <input
            id="job-sourceUrl"
            type="url"
            value={form.sourceUrl}
            onChange={(e) => set('sourceUrl', e.target.value)}
            aria-invalid={Boolean(fieldErrors.sourceUrl)}
            placeholder="https://…"
          />,
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <Link to="/jobs" className="button button--ghost">
            Cancel
          </Link>
          <button type="submit" className="button" disabled={saving || !form.title.trim() || !form.description.trim()}>
            {saving ? 'Creating…' : 'Create job'}
          </button>
        </div>
      </form>
    </>
  );
}
