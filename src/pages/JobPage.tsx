/**
 * One job's page, with tabs. Each tab has its own address so a refresh (or a shared link)
 * opens the same tab:
 *
 *   /jobs/:jobId              Candidates  (table: score, reason, evidence, status)
 *   /jobs/:jobId/pipeline     Pipeline    (kanban board, one column per status: from idea 4)
 *   /jobs/:jobId/replies      Replies     (inbox: reply list + AI draft answer: from idea 6)
 *   /jobs/:jobId/emails       Emails      (the outreach sequence)
 *   /jobs/:jobId/activity     Activity    (every change)
 *
 * This component loads the job and its candidates ONCE and hands them to whichever tab
 * is open (through react-router's "outlet context"), so switching tabs is instant.
 */
import { ExternalLink, History, Inbox, Mail, Users } from 'lucide-react';
import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { ActivityList, LoadState, ScoreBadge, StatusChip } from '../components/DataParts';
import { EmptyState, PageHeader } from '../components/PageParts';
import { money, orUnknown, remoteLabel } from '../format';
import { EXIT_STATUSES, PIPELINE_STATUSES } from '../pipeline';
import type { ActivityItem, Candidate, Job } from '../types';
import { useApi } from '../useApi';

const TABS = [
  { to: '', label: 'Candidates' },
  { to: 'pipeline', label: 'Pipeline' },
  { to: 'replies', label: 'Replies' },
  { to: 'emails', label: 'Emails' },
  { to: 'activity', label: 'Activity' },
];

/** What every tab receives from the job page. */
interface JobContext {
  job: Job;
  candidates: Candidate[];
}

export function JobPage() {
  const { jobId = '' } = useParams();
  const jobRequest = useApi<{ job: Job }>(`/jobs/${jobId}`);
  const candidatesRequest = useApi<{ candidates: Candidate[] }>(`/jobs/${jobId}/candidates`);

  const job = jobRequest.data?.job;
  const candidates = candidatesRequest.data?.candidates ?? [];

  if (!job) {
    return <LoadState loading={jobRequest.loading} error={jobRequest.error} />;
  }

  return (
    <>
      <PageHeader title={job.title} subtitle={job.company ?? undefined} />

      {/* The key facts as chips. Missing ones say "Unknown" instead of being guessed. */}
      <div className="facts">
        <span className="fact">{orUnknown(job.seniority)}</span>
        <span className="fact">
          {orUnknown(job.location)} · {remoteLabel(job.remotePolicy)}
        </span>
        <span className="fact">Salary: {orUnknown(job.salary)}</span>
        <span className="fact">AI cost: {money(job.aiUsage.costUsd)}</span>
        {job.sourceUrl && (
          <a className="fact" href={job.sourceUrl} target="_blank" rel="noreferrer noopener">
            Original posting <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
      <div className="skills">
        {job.mustHaveSkills.map((skill) => (
          <span key={skill} className="skill skill--must" title="Must-have">
            {skill}
          </span>
        ))}
        {job.niceToHaveSkills.map((skill) => (
          <span key={skill} className="skill" title="Nice to have">
            {skill}
          </span>
        ))}
      </div>

      <nav className="tabs" aria-label="Job sections">
        {TABS.map((tab) => (
          // `end` on the first tab: otherwise "Candidates" would stay active on every tab.
          <NavLink key={tab.label} to={tab.to} end={tab.to === ''} className="tab">
            {tab.label}
            {tab.to === '' && <span className="tab__count">{job.totalCandidates}</span>}
          </NavLink>
        ))}
      </nav>

      <LoadState loading={candidatesRequest.loading && !candidatesRequest.data} error={candidatesRequest.error} />
      {/* The selected tab's component is shown here, with the job + candidates handed down. */}
      <Outlet context={{ job, candidates } satisfies JobContext} />
    </>
  );
}

function useJob(): JobContext {
  return useOutletContext<JobContext>();
}

export function JobCandidatesTab() {
  const { candidates } = useJob();
  if (candidates.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={Users} title="No candidates for this job yet">
          Ask TalentPilot to start searching, or upload a CSV. Each candidate gets a 0–100 score with the reason and
          the evidence behind it.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Score</th>
            <th scope="col">Candidate</th>
            <th scope="col">Why</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id}>
              <td>
                <ScoreBadge score={c.score} />
              </td>
              <td>
                <div className="table__title">{c.name}</div>
                <div className="muted small">{orUnknown(c.headline)}</div>
                <div className="small">
                  {c.profileUrl ? (
                    <a href={c.profileUrl} target="_blank" rel="noreferrer noopener">
                      Profile
                    </a>
                  ) : (
                    <span className="muted">No profile link</span>
                  )}
                  {' · '}
                  <span className="muted">{c.email ?? 'Email unknown'}</span>
                </div>
              </td>
              <td>
                <div>{c.scoreReason ?? <span className="muted">Not scored yet</span>}</div>
                {/* The exact words from their profile that back up the score. */}
                {c.evidence.map((quote) => (
                  <q key={quote} className="evidence">
                    {quote}
                  </q>
                ))}
              </td>
              <td>
                <StatusChip status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Kanban board: one column per status, a card for each candidate in it. */
export function JobPipelineTab() {
  const { candidates } = useJob();
  const columns = [...PIPELINE_STATUSES, ...EXIT_STATUSES];
  return (
    <div className="board" role="list" aria-label="Pipeline board">
      {columns.map((status) => {
        const inColumn = candidates.filter((c) => c.status === status.id);
        return (
          <section key={status.id} className="board__column" role="listitem" aria-label={status.label}>
            <div className="board__heading">
              <span>{status.label}</span>
              <span className="board__count">{inColumn.length}</span>
            </div>
            {inColumn.length === 0 ? (
              <div className="board__empty">No candidates</div>
            ) : (
              inColumn.map((c) => (
                <article key={c.id} className="board__card">
                  <div className="board__card-top">
                    <span className="board__name">{c.name}</span>
                    <ScoreBadge score={c.score} />
                  </div>
                  <div className="muted small">{orUnknown(c.headline)}</div>
                </article>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Inbox: replies list on the left, the selected conversation + AI draft on the right. */
export function JobRepliesTab() {
  return (
    <div className="card inbox">
      <div className="inbox__list">
        <div className="inbox__list-header">Replies</div>
        <EmptyState icon={Inbox} title="No replies yet">
          Candidate replies will be listed here, labelled by the AI.
        </EmptyState>
      </div>
      <EmptyState icon={Mail} title="Select a reply">
        You'll see the conversation and the AI's drafted answer, ready to approve, edit or discard.
      </EmptyState>
    </div>
  );
}

export function JobEmailsTab() {
  return (
    <div className="card">
      <EmptyState icon={Mail} title="No outreach yet">
        TalentPilot will draft a personalised email or a sequence (e.g. Day 0, 3 and 7) for accepted candidates. You
        preview and approve before anything is sent.
      </EmptyState>
    </div>
  );
}

export function JobActivityTab() {
  const { job } = useJob();
  const { data, error, loading } = useApi<{ activity: ActivityItem[] }>(`/jobs/${job.id}/activity`);
  if (!data) return <LoadState loading={loading} error={error} />;
  if (data.activity.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={History} title="No activity yet">
          Every change to this job is recorded here: who did it (you, the AI or the system) and when.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="card panel">
      <ActivityList items={data.activity} />
    </div>
  );
}
