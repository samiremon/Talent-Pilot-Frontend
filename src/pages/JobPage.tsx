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
import { ExternalLink, History, Inbox, Info, Mail, Pencil, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ActivityList, LoadState, ScoreBadge, StatusChip } from '../components/DataParts';
import { JobDetailsDialog } from '../components/JobDetailsDialog';
import { CandidateDetailsDialog } from '../components/CandidateDetailsDialog';
import { SourcingBar } from '../components/SourcingBar';
import { useDeleteJob } from '../components/useDeleteJob';
import { useDeleteCandidate } from '../components/useDeleteCandidate';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../api';
import { useJobTasks, type JobTask } from '../useJobTasks';
import { EmptyState, PageHeader } from '../components/PageParts';
import { orUnknown, profileSite } from '../format';
import { EXIT_STATUSES, PIPELINE_STATUSES } from '../pipeline';
import { rankCandidates } from '../ranking';
import type { ActivityItem, Candidate, Job } from '../types';
import { notifyDataChanged, useApi } from '../useApi';

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
  /** The newest background task (e.g. scoring), updated live. */
  latestTask: JobTask | null;
}

export function JobPage() {
  const { jobId = '' } = useParams();
  const jobRequest = useApi<{ job: Job }>(`/jobs/${jobId}`);
  // "Job details" panel open? (Declared before the early return below: React's rule that
  // hooks always run in the same order.)
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();
  // Live background-task progress for this job (Server-Sent Events).
  const { latest: latestTask } = useJobTasks(jobRequest.data?.job.id);
  // After deleting, this page has nothing to show: go back to the list.
  const deleteJob = useDeleteJob({ onDeleted: () => navigate('/jobs') });
  const candidatesRequest = useApi<{ candidates: Candidate[] }>(`/jobs/${jobId}/candidates`);

  const job = jobRequest.data?.job;
  const candidates = candidatesRequest.data?.candidates ?? [];

  if (!job) {
    return <LoadState loading={jobRequest.loading} error={jobRequest.error} />;
  }

  return (
    <>
      {/* Kept short on purpose: all the job's fields are one click away in "Job details". */}
      <PageHeader
        title={job.title}
        subtitle={[job.jobCode, job.company].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={() => setShowDetails(true)}>
              <Info size={16} aria-hidden="true" /> Job details
            </button>
            <Link to={`/jobs/${job.id}/edit`} className="button button--ghost">
              <Pencil size={16} aria-hidden="true" /> Edit
            </Link>
            <button type="button" className="button button--ghost button--ghost-danger" onClick={() => deleteJob.ask(job)}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </>
        }
      />
      <JobDetailsDialog job={job} open={showDetails} onClose={() => setShowDetails(false)} />
      {deleteJob.dialog}

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
      <Outlet context={{ job, candidates, latestTask } satisfies JobContext} />
    </>
  );
}

function useJob(): JobContext {
  return useOutletContext<JobContext>();
}

/** "Show" choices for the top-N filter: everyone, or the best 5 / 10 / 20 / 50. */
const TOP_CHOICES = [5, 10, 20, 50];

export function JobCandidatesTab() {
  const { job, candidates, latestTask } = useJob();
  // The candidate whose details popup is open (null = closed).
  const [selected, setSelected] = useState<Candidate | null>(null);
  // Filters: search by name, and "show only the top N by score" (0 = everyone).
  const [search, setSearch] = useState('');
  const [top, setTop] = useState(0);
  // Rank by score (#1 = best). Computed on ALL candidates, so filtering never changes ranks.
  const ranks = useMemo(() => rankCandidates(candidates), [candidates]);
  const scoredCount = ranks.size;

  // The list arrives best score first (unscored last). Top N = ranks 1..N (people who
  // tie on the Nth score are all kept), then the name search narrows it further.
  const query = search.trim().toLowerCase();
  const shown = candidates.filter((c) => {
    if (top > 0) {
      const rank = ranks.get(c.id);
      if (rank === undefined || rank > top) return false;
    }
    return !query || c.name.toLowerCase().includes(query);
  });

  // Remove a candidate (trash button / popup), with a confirmation popup first.
  const deleteCandidate = useDeleteCandidate(job.id, { onDeleted: () => setSelected(null) });
  // "Delete all": removes every candidate of this job (asks first; the job stays).
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // No score AND no reason = the AI hasn't scored them yet (e.g. a run hit a problem).
  const unscored = candidates.filter((c) => c.score === null && !c.scoreReason).length;
  const bar = <SourcingBar jobId={job.id} latest={latestTask} unscored={unscored} />;
  if (candidates.length === 0) {
    return (
      <>
        {bar}
        <div className="card">
          <EmptyState icon={Users} title="No candidates for this job yet">
            Upload a CSV, or attach one in the chat with 📎. Each candidate gets a 0–100 score with the reason and the
            evidence behind it.
          </EmptyState>
        </div>
      </>
    );
  }
  return (
    <>
    {bar}
    <div className="table-filters" role="search">
      <label className="table-filters__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          aria-label="Search candidates by name"
        />
      </label>
      <label className="table-filters__top">
        Show
        <select value={top} onChange={(e) => setTop(Number(e.target.value))} aria-label="Show the top candidates">
          <option value={0}>All candidates</option>
          {TOP_CHOICES.map((n) => (
            <option key={n} value={n}>
              Top {n}
            </option>
          ))}
        </select>
      </label>
      <span className="muted small table-filters__count">
        Showing {shown.length} of {candidates.length} · {scoredCount} scored
      </span>
      <button type="button" className="button button--danger-ghost button--small" onClick={() => setConfirmDeleteAll(true)}>
        <Trash2 size={14} aria-hidden="true" /> Delete all
      </button>
    </div>
    <ConfirmDialog
      open={confirmDeleteAll}
      danger
      title={`Delete all ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} of ${job.jobCode ?? 'this job'}?`}
      confirmLabel="Delete all candidates"
      onCancel={() => setConfirmDeleteAll(false)}
      onConfirm={async () => {
        await api(`/jobs/${job.id}/candidates`, { method: 'DELETE' });
        setConfirmDeleteAll(false);
        notifyDataChanged();
      }}
    >
      <p>
        Every candidate of <strong>{job.title}</strong> will be removed: <strong>{candidates.length}</strong> people, with their
        scores. The job itself stays.
      </p>
      <p className="muted">This can't be undone. The activity log keeps a note of it.</p>
    </ConfirmDialog>
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col" title="Rank by AI score: #1 = best match">
              Rank
            </th>
            <th scope="col">Score</th>
            <th scope="col">Candidate</th>
            <th scope="col">Profile</th>
            <th scope="col">Why</th>
            <th scope="col">Status</th>
            <th scope="col" className="row-actions">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td colSpan={7} className="muted table__empty">
                {query ? `No candidate named "${search.trim()}"${top ? ` in the top ${top}` : ''}.` : 'No scored candidates yet.'}
              </td>
            </tr>
          )}
          {shown.map((c) => (
            <tr
              key={c.id}
              // Red row = their profile tried to instruct the AI (it was ignored, but look twice).
              className={`row-link${c.flagged ? ' row--flagged' : ''}`}
              // The whole row opens the details popup (click, or Tab + Enter).
              tabIndex={0}
              aria-label={`Show details for ${c.name}${c.flagged ? ' (flagged: profile contains instructions aimed at the AI)' : ''}`}
              onClick={() => setSelected(c)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setSelected(c);
              }}
            >
              <td className="rank-cell">
                {ranks.has(c.id) ? `#${ranks.get(c.id)}` : <span className="muted" title="Not scored yet, so no rank">–</span>}
              </td>
              <td>
                <ScoreBadge score={c.score} />
              </td>
              <td>
                <div className="table__title">{c.name}</div>
                <div className="muted small">{orUnknown(c.headline)}</div>
                <div className="muted small">{c.email ?? 'Email unknown'}</div>
              </td>
              <td className="profile-cell">
                {/* Their LinkedIn (or GitHub, Stack Overflow, ...) page, in a new tab. */}
                {c.profileUrl ? (
                  <a
                    href={c.profileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    title={c.profileUrl}
                  >
                    {profileSite(c.profileUrl)} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="muted">–</span>
                )}
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
              <td className="row-actions">
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label={`Remove ${c.name}`}
                  title="Remove candidate"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteCandidate.ask(c);
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <CandidateDetailsDialog
      candidate={selected}
      rank={selected ? ranks.get(selected.id) : undefined}
      rankedCount={scoredCount}
      onClose={() => setSelected(null)}
      onRemove={deleteCandidate.ask}
    />
    {deleteCandidate.dialog}
    </>
  );
}

/** Kanban board: one column per status, a card for each candidate in it. */
export function JobPipelineTab() {
  const { candidates } = useJob();
  const [selected, setSelected] = useState<Candidate | null>(null);
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
                <article
                  key={c.id}
                  className={`board__card board__card--link${c.flagged ? ' board__card--flagged' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Show details for ${c.name}`}
                  onClick={() => setSelected(c)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelected(c);
                  }}
                >
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
      <CandidateDetailsDialog candidate={selected} onClose={() => setSelected(null)} />
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
