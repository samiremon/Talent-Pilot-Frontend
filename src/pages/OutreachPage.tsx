/**
 * Outreach page (left sidebar → Outreach): ALL jobs' emails and replies in one place.
 *
 *   ┌ Jobs ──────────────────────┐┌ JOB-0003 · Backend Engineer          [Open job →] ┐
 *   │ JOB-0003 Backend Engineer  ││  Emails | Replies                                  │
 *   │   4 contacted · 2 replied  ││  (exactly the job page's Emails / Replies tab)     │
 *   │ JOB-0002 Designer          ││                                                    │
 *   │   0 contacted · 0 replied  ││                                                    │
 *   └────────────────────────────┘└────────────────────────────────────────────────────┘
 *
 * Addresses (so a refresh or a shared link opens the same view):
 *   /outreach                    -> opens the first job's Emails
 *   /outreach/:jobId             -> that job's Emails tab
 *   /outreach/:jobId/replies     -> that job's Replies tab
 *
 * The Emails and Replies tabs are the SAME components the job page uses (EmailsTab,
 * RepliesTab), so every button works identically here and there: one code path, and the
 * backend logs every action in the Activity log the AI reads.
 */
import { Briefcase, ExternalLink, Inbox, Mail } from 'lucide-react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { LoadState } from '../components/DataParts';
import { EmptyState, PageHeader } from '../components/PageParts';
import type { Job, StatusCounts } from '../types';
import { useApi } from '../useApi';
import { EmailsTab } from './EmailsTab';
import { RepliesTab } from './RepliesTab';

/** Statuses that mean "we emailed them" (contacted or any step after it). */
const CONTACTED_OR_LATER = [
  'contacted',
  'replied',
  'interested',
  'not_interested',
  'meeting_booked',
  'interviewed',
  'shortlisted',
  'hired',
  'unsubscribed',
] as const;
/** Statuses that mean "they wrote back". */
const REPLIED_OR_LATER = ['replied', 'interested', 'not_interested', 'meeting_booked', 'interviewed', 'shortlisted', 'hired'] as const;

/** Adds up the candidates in the given statuses (counts are today's statuses). */
function sum(counts: StatusCounts, statuses: readonly (keyof StatusCounts)[]): number {
  return statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);
}

export function OutreachPage() {
  // jobId and tab come from the address: /outreach/:jobId/:tab?
  const { jobId, tab } = useParams();
  const { data, error, loading } = useApi<{ jobs: Job[] }>('/jobs');
  const jobs = data?.jobs ?? [];
  const job = jobs.find((j) => j.id === jobId);

  // No job chosen yet (or a deleted one): open the first job, so the page is never empty.
  if (data && jobs.length > 0 && !job) {
    return <Navigate to={`/outreach/${jobs[0]!.id}`} replace />;
  }

  return (
    <>
      <PageHeader title="Outreach" subtitle="Emails and replies for every job, in one place." />
      <LoadState loading={loading && !data} error={error} />

      {data && jobs.length === 0 && (
        <div className="card">
          <EmptyState icon={Mail} title="No jobs yet">
            Outreach is done per job. <Link to="/jobs/new">Create a job</Link> (or paste a job description into the chat),
            add candidates, accept the ones you like, then start an email campaign.
          </EmptyState>
        </div>
      )}

      {job && (
        <div className="outreach">
          {/* Left: every job, with how many people were emailed and how many replied. */}
          <nav className="card outreach__jobs" aria-label="Jobs">
            <div className="outreach__jobs-header">Jobs</div>
            <ul>
              {jobs.map((j) => (
                <li key={j.id}>
                  <NavLink
                    // Keep the same tab when switching jobs (Replies stays Replies).
                    to={`/outreach/${j.id}${tab === 'replies' ? '/replies' : ''}`}
                    className={() => (j.id === job.id ? 'outreach__job outreach__job--active' : 'outreach__job')}
                    aria-current={j.id === job.id ? 'page' : undefined}
                  >
                    <span className="outreach__job-title">
                      <Briefcase size={14} aria-hidden="true" /> {j.title}
                    </span>
                    <span className="muted small">
                      {[j.jobCode, `${sum(j.counts, CONTACTED_OR_LATER)} contacted`, `${sum(j.counts, REPLIED_OR_LATER)} replied`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right: the chosen job's Emails / Replies tabs. */}
          <section className="outreach__detail" aria-label={`Outreach for ${job.title}`}>
            <div className="outreach__detail-head">
              <h2 className="outreach__detail-title">
                {job.jobCode ? `${job.jobCode} · ` : ''}
                {job.title}
              </h2>
              <Link to={`/jobs/${job.id}`} className="button button--ghost button--small">
                <ExternalLink size={14} aria-hidden="true" /> Open job
              </Link>
            </div>

            <nav className="tabs" aria-label="Outreach sections">
              <NavLink to={`/outreach/${job.id}`} end className="tab tab--icon">
                <Mail size={14} aria-hidden="true" /> Emails
              </NavLink>
              <NavLink to={`/outreach/${job.id}/replies`} className="tab tab--icon">
                <Inbox size={14} aria-hidden="true" /> Replies
                <span className="tab__count">{sum(job.counts, REPLIED_OR_LATER)}</span>
              </NavLink>
            </nav>

            {/* key = job id: switching jobs starts the tab fresh (no leftover selection). */}
            {tab === 'replies' ? <RepliesTab key={job.id} jobId={job.id} /> : <EmailsTab key={job.id} jobId={job.id} />}
          </section>
        </div>
      )}
    </>
  );
}
