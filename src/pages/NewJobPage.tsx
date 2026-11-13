/**
 * "New job" form at /jobs/new: the recruiter creates a job by hand.
 *
 * This does exactly what the AI's job card does when you press Confirm: it calls
 * POST /api/jobs. The backend logs it as done by the recruiter, and the assistant reads
 * that log, so the AI knows about jobs created here too.
 *
 * Only Title and Description are required. Anything left blank is saved as "Unknown"
 * (we never fill in guesses).
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { PageHeader } from '../components/PageParts';
import { TagInput } from '../components/TagInput';
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

  /** Updates one field and clears its error message. */
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors(({ [key]: _removed, ...rest }) => rest);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { job } = await api<{ job: Job }>('/jobs', { method: 'POST', body: form });
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
