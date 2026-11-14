/**
 * Outreach page (left sidebar → Outreach): every job's emails and replies.
 *
 *   /outreach                  the jobs table, exactly like the Jobs page (minus "New job").
 *                              Clicking a job opens its outreach:
 *   /outreach/:jobId           that job's Emails tab
 *   /outreach/:jobId/replies   that job's Replies tab
 *
 *   ← All jobs
 *   JOB-0003 · Senior React Developer                         [Open job]
 *   Emails | Replies (2)
 *   (exactly the job page's Emails / Replies tab)
 *
 * The table is the Jobs page's <JobsTable>, and the tabs are the SAME components the job
 * page uses (EmailsTab, RepliesTab), so every button works identically here and there:
 * one code path, and the backend logs every action in the Activity log the AI reads.
 */
import { ArrowLeft, ExternalLink, Inbox, Mail } from 'lucide-react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { LoadState } from '../components/DataParts';
import { EmptyState, PageHeader } from '../components/PageParts';
import type { Job } from '../types';
import { useApi } from '../useApi';
import { EmailsTab } from './EmailsTab';
import { JobsTable } from './JobsPage';
import { RepliesTab } from './RepliesTab';

/** Statuses that mean "they wrote back" (for the count on the Replies tab). */
const REPLIED_OR_LATER = [
  'replied',
  'interested',
  'not_interested',
  'meeting_booked',
  'interviewed',
  'shortlisted',
  'hired',
] as const;

export function OutreachPage() {
  // jobId and tab come from the address: /outreach/:jobId/:tab?
  const { jobId } = useParams();
  return jobId ? <JobOutreach jobId={jobId} /> : <OutreachJobs />;
}

/** /outreach: the jobs table; a click opens that job's Emails / Replies. */
function OutreachJobs() {
  const { data, error, loading } = useApi<{ jobs: Job[] }>('/jobs');

  return (
    <>
      <PageHeader title="Outreach" subtitle="Pick a job to see its emails and replies." />
      <LoadState loading={loading && !data} error={error} />

      {data && data.jobs.length === 0 && (
        <div className="card">
          <EmptyState icon={Mail} title="No jobs yet">
            Outreach is done per job. <Link to="/jobs/new">Create a job</Link> (or paste a job description into the
            chat), add candidates, accept the ones you like, then start an email campaign.
          </EmptyState>
        </div>
      )}

      {data && data.jobs.length > 0 && <JobsTable jobs={data.jobs} linkTo={(job) => `/outreach/${job.id}`} />}
    </>
  );
}

/** /outreach/:jobId[/replies]: one job's Emails and Replies tabs. */
function JobOutreach({ jobId }: { jobId: string }) {
  const { tab } = useParams();
  const { data, error, loading } = useApi<{ job: Job }>(`/jobs/${jobId}`);
  const job = data?.job;

  return (
    <>
      <Link to="/outreach" className="back-link">
        <ArrowLeft size={14} aria-hidden="true" /> All jobs
      </Link>
      {!job ? (
        <LoadState loading={loading} error={error} />
      ) : (
        <>
          <PageHeader
            title={job.title}
            subtitle={[job.jobCode, job.company, 'Outreach'].filter(Boolean).join(' · ')}
            actions={
              <Link to={`/jobs/${job.id}`} className="button button--ghost">
                <ExternalLink size={16} aria-hidden="true" /> Open job
              </Link>
            }
          />
          <nav className="tabs" aria-label="Outreach sections">
            <NavLink to={`/outreach/${job.id}`} end className="tab tab--icon">
              <Mail size={14} aria-hidden="true" /> Emails
            </NavLink>
            <NavLink to={`/outreach/${job.id}/replies`} className="tab tab--icon">
              <Inbox size={14} aria-hidden="true" /> Replies
              <span className="tab__count">{REPLIED_OR_LATER.reduce((n, s) => n + (job.counts[s] ?? 0), 0)}</span>
            </NavLink>
          </nav>
          {/* key = job id: switching jobs starts the tab fresh (no leftover selection). */}
          {tab === 'replies' ? <RepliesTab key={job.id} jobId={job.id} /> : <EmailsTab key={job.id} jobId={job.id} />}
        </>
      )}
    </>
  );
}
